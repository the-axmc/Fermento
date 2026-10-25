#![cfg(test)]

extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger as _},
    token, Address, Env,
};

use crate::contract::{BatchShares, BatchSharesClient};

const DAY: u64 = 86_400;
const USDC: i128 = 10_000_000; // 7 decimals

/// Stand-in for the batch registry: records the last claim and hands out ids.
#[contracttype]
pub enum MockKey {
    Count,
    Last,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MockClaim {
    pub batch_id: u32,
    pub claimer: Address,
    pub units: u32,
    pub caller: Address,
}

#[contract]
pub struct MockRegistry;

#[contractimpl]
impl MockRegistry {
    pub fn claim(e: Env, batch_id: u32, claimer: Address, units: u32, caller: Address) -> u32 {
        caller.require_auth();
        let id: u32 = e.storage().instance().get(&MockKey::Count).unwrap_or(0) + 1;
        e.storage().instance().set(&MockKey::Count, &id);
        e.storage()
            .instance()
            .set(&MockKey::Last, &MockClaim { batch_id, claimer, units, caller });
        id
    }

    pub fn last(e: Env) -> Option<MockClaim> {
        e.storage().instance().get(&MockKey::Last)
    }
}

struct Setup<'a> {
    env: Env,
    shares: BatchSharesClient<'a>,
    shares_addr: Address,
    registry: Address,
    usdc: Address,
    usdc_admin: Address,
    share_token: Address,
    issuer: Address,
    pauser: Address,
    producer: Address,
    treasury: Address,
    buyer: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(1_000 * DAY);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let pauser = Address::generate(&env);
    let producer = Address::generate(&env);
    let treasury = Address::generate(&env);
    let buyer = Address::generate(&env);

    let usdc_admin = Address::generate(&env);
    let usdc = env.register_stellar_asset_contract_v2(usdc_admin.clone()).address();
    let registry = env.register(MockRegistry, ());

    let shares_addr = env.register(
        BatchShares,
        (
            admin.clone(),
            issuer.clone(),
            pauser.clone(),
            usdc.clone(),
            registry.clone(),
            treasury.clone(),
        ),
    );
    let shares = BatchSharesClient::new(&env, &shares_addr);

    // Share asset for batch 14, with this contract as SAC admin.
    let share_issuer = Address::generate(&env);
    let share_token = env.register_stellar_asset_contract_v2(share_issuer).address();
    token::StellarAssetClient::new(&env, &share_token).set_admin(&shares_addr);

    // Buyer starts with 1000 USDC.
    token::StellarAssetClient::new(&env, &usdc).mint(&buyer, &(1_000 * USDC));

    Setup {
        env,
        shares,
        shares_addr,
        registry,
        usdc,
        usdc_admin,
        share_token,
        issuer,
        pauser,
        producer,
        treasury,
        buyer,
    }
}

/// Opens batch 14: 1000 shares at 12 USDC, 0.01 USDC/share/day, 10 shares a unit,
/// filled now, mature in 365 days.
fn open_default(s: &Setup) {
    let now = s.env.ledger().timestamp();
    s.shares.open_offering(
        &14,
        &s.share_token,
        &s.producer,
        &(12 * USDC),
        &1_000,
        &(USDC / 100),
        &10,
        &now,
        &(now + 365 * DAY),
        &s.issuer,
    );
}

fn balance(env: &Env, token_addr: &Address, who: &Address) -> i128 {
    token::Client::new(env, token_addr).balance(who)
}

#[test]
fn constructor_stores_config() {
    let s = setup();
    assert_eq!(s.shares.payment_token(), s.usdc);
    assert_eq!(s.shares.registry(), s.registry);
    assert_eq!(s.shares.treasury(), s.treasury);
    assert!(!s.shares.paused());
}

#[test]
fn open_offering_records_terms() {
    let s = setup();
    open_default(&s);
    let o = s.shares.offering(&14);
    assert_eq!(o.price, 12 * USDC);
    assert_eq!(o.total_shares, 1_000);
    assert_eq!(o.sold, 0);
    assert!(o.open);
    assert_eq!(s.shares.remaining(&14), 1_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #600)")]
fn open_offering_twice_panics() {
    let s = setup();
    open_default(&s);
    open_default(&s);
}

#[test]
#[should_panic(expected = "Error(Contract, #607)")]
fn open_offering_rejects_zero_price() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.shares.open_offering(
        &15, &s.share_token, &s.producer, &0, &100, &0, &10, &now, &now, &s.issuer,
    );
}

#[test]
fn buy_pays_producer_and_mints_shares() {
    let s = setup();
    open_default(&s);

    let paid = s.shares.buy(&14, &s.buyer, &5);

    assert_eq!(paid, 60 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 60 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.buyer), 940 * USDC);
    assert_eq!(balance(&s.env, &s.share_token, &s.buyer), 5);
    assert_eq!(s.shares.remaining(&14), 995);
    assert_eq!(s.shares.circulating(&14), 5);
    let p = s.shares.get_position(&14, &s.buyer);
    assert_eq!(p.shares, 5);
    assert_eq!(p.fee_paid_until, s.env.ledger().timestamp());
}

#[test]
#[should_panic(expected = "Error(Contract, #604)")]
fn buy_more_than_supply_panics() {
    let s = setup();
    open_default(&s);
    s.shares.buy(&14, &s.buyer, &1_001);
}

#[test]
#[should_panic(expected = "Error(Contract, #602)")]
fn buy_after_close_panics() {
    let s = setup();
    open_default(&s);
    s.shares.close_offering(&14, &s.issuer);
    s.shares.buy(&14, &s.buyer, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #601)")]
fn buy_unknown_batch_panics() {
    let s = setup();
    s.shares.buy(&99, &s.buyer, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #1000)")]
fn buy_while_paused_panics() {
    let s = setup();
    open_default(&s);
    s.shares.pause(&s.pauser);
    s.shares.buy(&14, &s.buyer, &1);
}

#[test]
fn fee_accrues_per_whole_day() {
    let s = setup();
    open_default(&s);
    s.shares.buy(&14, &s.buyer, &10);

    assert_eq!(s.shares.accrued_fee(&14, &s.buyer, &10), 0);

    let now = s.env.ledger().timestamp();
    s.env.ledger().set_timestamp(now + 30 * DAY + 100);
    // 0.01 USDC * 30 days * 10 shares = 3 USDC
    assert_eq!(s.shares.accrued_fee(&14, &s.buyer, &10), 3 * USDC);
}

#[test]
fn fee_for_dex_bought_shares_counts_from_fill() {
    let s = setup();
    open_default(&s);
    let stranger = Address::generate(&s.env);
    let now = s.env.ledger().timestamp();
    s.env.ledger().set_timestamp(now + 10 * DAY);
    // No position here, so the whole period since fill is charged.
    assert_eq!(s.shares.accrued_fee(&14, &stranger, &10), USDC);
}

#[test]
#[should_panic(expected = "Error(Contract, #605)")]
fn redeem_before_maturity_panics() {
    let s = setup();
    open_default(&s);
    s.shares.buy(&14, &s.buyer, &10);
    s.shares.redeem(&14, &s.buyer, &10);
}

#[test]
#[should_panic(expected = "Error(Contract, #606)")]
fn redeem_partial_unit_panics() {
    let s = setup();
    open_default(&s);
    s.shares.buy(&14, &s.buyer, &10);
    s.shares.set_maturity(&14, &s.env.ledger().timestamp(), &s.issuer);
    s.shares.redeem(&14, &s.buyer, &7);
}

#[test]
fn redeem_burns_shares_charges_fee_and_claims() {
    let s = setup();
    open_default(&s);
    s.shares.buy(&14, &s.buyer, &30);

    let now = s.env.ledger().timestamp();
    s.env.ledger().set_timestamp(now + 365 * DAY);

    let claim_id = s.shares.redeem(&14, &s.buyer, &20);

    assert_eq!(claim_id, 1);
    // 20 shares burned, 10 left; nothing parked in the contract.
    assert_eq!(balance(&s.env, &s.share_token, &s.buyer), 10);
    assert_eq!(balance(&s.env, &s.share_token, &s.shares_addr), 0);
    assert_eq!(s.shares.circulating(&14), 10);
    // Fee: 0.01 * 365 * 20 = 73 USDC to treasury. Buyer paid 360 for shares.
    assert_eq!(balance(&s.env, &s.usdc, &s.treasury), 73 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.buyer), (1_000 - 360 - 73) * USDC);

    let last = MockRegistryClient::new(&s.env, &s.registry).last().unwrap();
    assert_eq!(last.batch_id, 14);
    assert_eq!(last.claimer, s.buyer);
    assert_eq!(last.units, 2);
    assert_eq!(last.caller, s.shares_addr);

    let p = s.shares.get_position(&14, &s.buyer);
    assert_eq!(p.shares, 10);
    assert_eq!(p.fee_paid_until, now + 365 * DAY);
}

#[test]
fn redeem_works_with_zero_fee_and_usdc_admin_unused() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.shares.open_offering(
        &15, &s.share_token, &s.producer, &USDC, &100, &0, &1, &now, &now, &s.issuer,
    );
    s.shares.buy(&15, &s.buyer, &3);
    let claim_id = s.shares.redeem(&15, &s.buyer, &3);
    assert_eq!(claim_id, 1);
    assert_eq!(balance(&s.env, &s.usdc, &s.treasury), 0);
    // usdc_admin only exists to show who could mint more test USDC.
    assert_ne!(s.usdc_admin, s.buyer);
}
