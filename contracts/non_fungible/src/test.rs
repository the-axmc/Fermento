#![cfg(test)]

extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

use crate::contract::{BatchRegistry, BatchRegistryClient};

struct Setup<'a> {
    env: Env,
    client: BatchRegistryClient<'a>,
    minter: Address,
    pauser: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    let admin = Address::generate(&env);
    let pauser = Address::generate(&env);
    let upgrader = Address::generate(&env);
    let minter = Address::generate(&env);
    let addr = env.register(
        BatchRegistry,
        (admin.clone(), pauser.clone(), upgrader.clone(), minter.clone()),
    );
    let client = BatchRegistryClient::new(&env, &addr);
    Setup { env, client, minter, pauser }
}

#[test]
fn initial_state() {
    let s = setup();
    assert_eq!(s.client.name(), String::from_str(&s.env, "Fermento Batches"));
    assert_eq!(s.client.symbol(), String::from_str(&s.env, "BATCH"));
    assert_eq!(s.client.total_supply(), 0);
    assert!(!s.client.paused());
}

#[test]
fn register_batch_sets_owner_uri_and_stage() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let uri = String::from_str(&s.env, "ipfs://batch-14");

    s.client.register_batch(&platform, &14, &uri, &s.minter);

    assert_eq!(s.client.owner_of(&14), platform);
    assert_eq!(s.client.token_uri(&14), uri);
    assert_eq!(s.client.stage(&14), Some(Symbol::new(&s.env, "filled")));
    assert_eq!(s.client.total_supply(), 1);
}

#[test]
fn plain_mint_falls_back_to_base_uri() {
    let s = setup();
    let platform = Address::generate(&s.env);
    s.client.mint(&platform, &7, &s.minter);

    assert_eq!(
        s.client.token_uri(&7),
        String::from_str(&s.env, "https://fermento.app/batch/7")
    );
    assert_eq!(s.client.stage(&7), None);
}

#[test]
fn set_stage_and_uri_update_storage() {
    let s = setup();
    let platform = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "a"), &s.minter);

    s.client.set_stage(&14, &Symbol::new(&s.env, "aging"), &s.minter);
    s.client.set_token_uri(&14, &String::from_str(&s.env, "b"), &s.minter);

    assert_eq!(s.client.stage(&14), Some(Symbol::new(&s.env, "aging")));
    assert_eq!(s.client.token_uri(&14), String::from_str(&s.env, "b"));
}

#[test]
#[should_panic(expected = "Error(Contract, #200)")]
fn set_stage_on_unknown_batch_panics() {
    let s = setup();
    s.client.set_stage(&99, &Symbol::new(&s.env, "aging"), &s.minter);
}

#[test]
fn claim_records_units_sequentially() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let buyer = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "a"), &s.minter);

    let first = s.client.claim(&14, &buyer, &6, &s.minter);
    let second = s.client.claim(&14, &buyer, &3, &s.minter);

    assert_eq!(first, 1);
    assert_eq!(second, 2);
    assert_eq!(s.client.claimed_units(&14), 9);

    let record = s.client.get_claim(&second);
    assert_eq!(record.batch_id, 14);
    assert_eq!(record.claimer, buyer);
    assert_eq!(record.units, 3);
}

#[test]
#[should_panic(expected = "Error(Contract, #500)")]
fn claim_zero_units_panics() {
    let s = setup();
    let platform = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "a"), &s.minter);
    s.client.claim(&14, &platform, &0, &s.minter);
}

#[test]
#[should_panic(expected = "Error(Contract, #501)")]
fn unknown_claim_panics() {
    let s = setup();
    s.client.get_claim(&42);
}

#[test]
#[should_panic(expected = "Error(Contract, #1000)")]
fn paused_blocks_transfer() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let other = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "a"), &s.minter);

    s.client.pause(&s.pauser);
    s.client.transfer(&platform, &other, &14);
}

#[test]
fn unpause_restores_transfer() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let other = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "a"), &s.minter);

    s.client.pause(&s.pauser);
    s.client.unpause(&s.pauser);
    s.client.transfer(&platform, &other, &14);
    assert_eq!(s.client.owner_of(&14), other);
}
