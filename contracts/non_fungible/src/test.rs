#![cfg(test)]

extern crate std;

use soroban_sdk::{testutils::Address as _, Address, Env, String, Symbol};

use crate::contract::{BatchRegistry, BatchRegistryClient};

struct Setup<'a> {
    env: Env,
    client: BatchRegistryClient<'a>,
    minter: Address,
    pauser: Address,
    inspector: Address,
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
    let inspector = Address::generate(&env);
    client.grant_role(&inspector, &Symbol::new(&env, "inspector"), &admin);
    Setup { env, client, minter, pauser, inspector }
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

// ---------- producer and NFC tag ----------

use soroban_sdk::BytesN;

fn tag(env: &Env, byte: u8) -> BytesN<32> {
    BytesN::from_array(env, &[byte; 32])
}

#[test]
fn producer_links_a_tag_and_it_resolves_back() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let producer = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "u"), &s.minter);
    assert_eq!(s.client.producer(&14), None);
    s.client.set_producer(&14, &producer, &s.minter);
    assert_eq!(s.client.producer(&14), Some(producer.clone()));

    assert_eq!(s.client.tag(&14), None);
    s.client.link_tag(&14, &producer, &tag(&s.env, 1));
    assert_eq!(s.client.tag(&14), Some(tag(&s.env, 1)));
    assert_eq!(s.client.batch_of_tag(&tag(&s.env, 1)), Some(14));

    // Re-linking replaces the tag and frees the old one.
    s.client.link_tag(&14, &producer, &tag(&s.env, 2));
    assert_eq!(s.client.tag(&14), Some(tag(&s.env, 2)));
    assert_eq!(s.client.batch_of_tag(&tag(&s.env, 1)), None);
    assert_eq!(s.client.batch_of_tag(&tag(&s.env, 2)), Some(14));
}

#[test]
#[should_panic(expected = "Error(Contract, #502)")]
fn stranger_cannot_link_a_tag() {
    let s = setup();
    let platform = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "u"), &s.minter);
    s.client.set_producer(&14, &Address::generate(&s.env), &s.minter);
    s.client.link_tag(&14, &Address::generate(&s.env), &tag(&s.env, 1));
}

#[test]
#[should_panic(expected = "Error(Contract, #503)")]
fn a_tag_binds_to_one_batch_only() {
    let s = setup();
    let platform = Address::generate(&s.env);
    let producer = Address::generate(&s.env);
    for id in [14u32, 15] {
        s.client.register_batch(&platform, &id, &String::from_str(&s.env, "u"), &s.minter);
        s.client.set_producer(&id, &producer, &s.minter);
    }
    s.client.link_tag(&14, &producer, &tag(&s.env, 1));
    s.client.link_tag(&15, &producer, &tag(&s.env, 1));
}

// ---------- inspection ----------

fn registered_with_producer(s: &Setup) -> Address {
    let platform = Address::generate(&s.env);
    let producer = Address::generate(&s.env);
    s.client.register_batch(&platform, &14, &String::from_str(&s.env, "u"), &s.minter);
    s.client.set_producer(&14, &producer, &s.minter);
    producer
}

#[test]
fn inspector_attests_a_batch() {
    let s = setup();
    registered_with_producer(&s);
    assert_eq!(s.client.attestation(&14), None);
    s.client.attest(&14, &600, &tag(&s.env, 9), &s.inspector);
    let a = s.client.attestation(&14).unwrap();
    assert_eq!(a.inspector, s.inspector);
    assert_eq!(a.units, 600);
    assert_eq!(a.evidence, tag(&s.env, 9));

    // A later visit replaces it.
    s.client.attest(&14, &580, &tag(&s.env, 8), &s.inspector);
    assert_eq!(s.client.attestation(&14).unwrap().units, 580);
}

#[test]
#[should_panic(expected = "Error(Contract, #2000)")]
fn producer_cannot_attest_its_own_batch() {
    let s = setup();
    let producer = registered_with_producer(&s);
    s.client.attest(&14, &600, &tag(&s.env, 9), &producer);
}

#[test]
#[should_panic(expected = "Error(Contract, #505)")]
fn attestation_of_zero_units_panics() {
    let s = setup();
    registered_with_producer(&s);
    s.client.attest(&14, &0, &tag(&s.env, 9), &s.inspector);
}

#[test]
fn producer_may_link_a_first_tag_after_attestation() {
    let s = setup();
    let producer = registered_with_producer(&s);
    s.client.attest(&14, &600, &tag(&s.env, 9), &s.inspector);
    s.client.link_tag(&14, &producer, &tag(&s.env, 1));
    assert_eq!(s.client.tag(&14), Some(tag(&s.env, 1)));
}

#[test]
#[should_panic(expected = "Error(Contract, #504)")]
fn tag_is_locked_once_attested() {
    let s = setup();
    let producer = registered_with_producer(&s);
    s.client.link_tag(&14, &producer, &tag(&s.env, 1));
    s.client.attest(&14, &600, &tag(&s.env, 9), &s.inspector);
    s.client.link_tag(&14, &producer, &tag(&s.env, 2));
}

#[test]
fn inspector_relinks_a_locked_tag() {
    let s = setup();
    let producer = registered_with_producer(&s);
    s.client.link_tag(&14, &producer, &tag(&s.env, 1));
    s.client.attest(&14, &600, &tag(&s.env, 9), &s.inspector);
    s.client.inspector_link_tag(&14, &tag(&s.env, 2), &s.inspector);
    assert_eq!(s.client.tag(&14), Some(tag(&s.env, 2)));
    assert_eq!(s.client.batch_of_tag(&tag(&s.env, 1)), None);
    assert_eq!(s.client.batch_of_tag(&tag(&s.env, 2)), Some(14));
}
