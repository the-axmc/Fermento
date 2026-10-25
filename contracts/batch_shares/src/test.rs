#![cfg(test)]

extern crate std;

use soroban_sdk::{
    contract, contractimpl, contracttype,
    testutils::{Address as _, Ledger as _},
    token, Address, BytesN, Env, Symbol,
};

use crate::contract::{Attestation, BatchShares, BatchSharesClient, DataKey};

const DAY: u64 = 86_400;
const USDC: i128 = 10_000_000; // 7 decimals

/// Stand-in for the batch registry: records the last claim and hands out ids.
#[contracttype]
pub enum MockKey {
    Count,
    Last,
    Attested(u32),
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

    pub fn attest(e: Env, batch_id: u32, units: u32) {
        let record = Attestation {
            inspector: e.current_contract_address(),
            units,
            evidence: BytesN::from_array(&e, &[7; 32]),
            timestamp: e.ledger().timestamp(),
        };
        e.storage().instance().set(&MockKey::Attested(batch_id), &record);
    }

    pub fn attestation(e: Env, batch_id: u32) -> Option<Attestation> {
        e.storage().instance().get(&MockKey::Attested(batch_id))
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
    inspector: Address,
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

    // An inspector has visited batches 14 and 15: 100 units each.
    let inspector = Address::generate(&env);
    shares.grant_role(&inspector, &Symbol::new(&env, "inspector"), &admin);
    let mock = MockRegistryClient::new(&env, &registry);
    mock.attest(&14, &100);
    mock.attest(&15, &100);

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
        inspector,
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

    // 70% to the producer now, 30% held here.
    assert_eq!(paid, 60 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 42 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.shares_addr), 18 * USDC);
    assert_eq!(s.shares.escrow(&14).unwrap().pool, 18 * USDC);
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

    // 3.6 USDC held per share: 20 shares' worth moves to the claim.
    let held = s.shares.claim_escrow(&1).unwrap();
    assert_eq!(held.amount, 72 * USDC);
    assert!(!held.settled);
    assert_eq!(s.shares.escrow(&14).unwrap().pool, 36 * USDC);
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

// ---------- attestation ----------

#[test]
#[should_panic(expected = "Error(Contract, #608)")]
fn open_offering_without_attestation_panics() {
    let s = setup();
    let now = s.env.ledger().timestamp();
    s.shares.open_offering(
        &16, &s.share_token, &s.producer, &USDC, &10, &0, &1, &now, &now, &s.issuer,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #609)")]
fn open_offering_beyond_attested_units_panics() {
    let s = setup();
    MockRegistryClient::new(&s.env, &s.registry).attest(&16, &5);
    let now = s.env.ledger().timestamp();
    // 60 shares at 10 a unit is 6 units; only 5 were attested.
    s.shares.open_offering(
        &16, &s.share_token, &s.producer, &USDC, &60, &0, &10, &now, &now, &s.issuer,
    );
}

// ---------- escrow ----------

/// Batch 14 with 10 shares bought: 84 USDC paid, 36 USDC held.
fn bought_ten(s: &Setup) {
    open_default(s);
    s.shares.buy(&14, &s.buyer, &10);
}

fn mature(s: &Setup) {
    s.shares.set_maturity(&14, &s.env.ledger().timestamp(), &s.issuer);
}

#[test]
fn inspection_releases_its_part() {
    let s = setup();
    bought_ten(&s);
    assert_eq!(s.shares.held_per_share_now(&14), 36 * USDC / 10);

    let released = s.shares.confirm_inspection(&14, &s.inspector);

    // 1.8 USDC a share for 10 shares.
    assert_eq!(released, 18 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 102 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.shares_addr), 18 * USDC);
    assert!(s.shares.escrow(&14).unwrap().inspected);
    assert_eq!(s.shares.held_per_share_now(&14), 18 * USDC / 10);

    // Later buyers already pay the inspection part to the producer.
    s.shares.buy(&14, &s.buyer, &10);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), (102 + 102) * USDC);
    assert_eq!(s.shares.escrow(&14).unwrap().pool, 36 * USDC);
}

#[test]
#[should_panic(expected = "Error(Contract, #613)")]
fn inspection_releases_once() {
    let s = setup();
    bought_ten(&s);
    s.shares.confirm_inspection(&14, &s.inspector);
    s.shares.confirm_inspection(&14, &s.inspector);
}

#[test]
#[should_panic(expected = "Error(Contract, #2000)")]
fn producer_cannot_confirm_its_own_inspection() {
    let s = setup();
    bought_ten(&s);
    s.shares.confirm_inspection(&14, &s.producer);
}

#[test]
fn collection_pays_the_producer_in_full() {
    let s = setup();
    bought_ten(&s);
    s.shares.confirm_inspection(&14, &s.inspector);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    assert_eq!(s.shares.claim_escrow(&claim_id).unwrap().amount, 18 * USDC);

    let released = s.shares.confirm_collection(&claim_id, &s.buyer);

    assert_eq!(released, 18 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 120 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.shares_addr), 0);
    assert!(s.shares.claim_escrow(&claim_id).unwrap().settled);
}

#[test]
fn collection_without_inspection_releases_both_parts() {
    let s = setup();
    bought_ten(&s);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    assert_eq!(s.shares.claim_escrow(&claim_id).unwrap().amount, 36 * USDC);
    // An inspector who witnessed the handover may confirm it too.
    s.shares.confirm_collection(&claim_id, &s.inspector);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 120 * USDC);
}

#[test]
#[should_panic(expected = "Error(Contract, #616)")]
fn producer_cannot_confirm_collection() {
    let s = setup();
    bought_ten(&s);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    s.shares.confirm_collection(&claim_id, &s.producer);
}

#[test]
#[should_panic(expected = "Error(Contract, #615)")]
fn collection_is_confirmed_once() {
    let s = setup();
    bought_ten(&s);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    s.shares.confirm_collection(&claim_id, &s.buyer);
    s.shares.confirm_collection(&claim_id, &s.buyer);
}

#[test]
fn default_refunds_what_is_held() {
    let s = setup();
    bought_ten(&s);
    s.shares.declare_default(&14, &s.inspector);
    assert!(!s.shares.offering(&14).open);

    let back = s.shares.refund(&14, &s.buyer, &10);

    // The 30% still held comes back; the shares are burned.
    assert_eq!(back, 36 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.buyer), (1_000 - 120 + 36) * USDC);
    assert_eq!(balance(&s.env, &s.share_token, &s.buyer), 0);
    assert_eq!(balance(&s.env, &s.usdc, &s.shares_addr), 0);
    assert_eq!(s.shares.escrow(&14).unwrap().refunded, 10);
}

#[test]
fn default_after_inspection_refunds_the_collection_part() {
    let s = setup();
    bought_ten(&s);
    s.shares.confirm_inspection(&14, &s.inspector);
    s.shares.declare_default(&14, &s.inspector);
    assert_eq!(s.shares.refund(&14, &s.buyer, &10), 18 * USDC);
}

#[test]
fn default_refunds_an_uncollected_claim() {
    let s = setup();
    bought_ten(&s);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    s.shares.declare_default(&14, &s.inspector);
    let before = balance(&s.env, &s.usdc, &s.buyer);
    assert_eq!(s.shares.refund_claim(&claim_id), 36 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.buyer), before + 36 * USDC);
    assert!(s.shares.claim_escrow(&claim_id).unwrap().settled);
}

#[test]
#[should_panic(expected = "Error(Contract, #612)")]
fn refund_before_default_panics() {
    let s = setup();
    bought_ten(&s);
    s.shares.refund(&14, &s.buyer, &10);
}

#[test]
#[should_panic(expected = "Error(Contract, #611)")]
fn redeem_after_default_panics() {
    let s = setup();
    bought_ten(&s);
    mature(&s);
    s.shares.declare_default(&14, &s.inspector);
    s.shares.redeem(&14, &s.buyer, &10);
}

#[test]
#[should_panic(expected = "Error(Contract, #2000)")]
fn producer_cannot_declare_default() {
    let s = setup();
    bought_ten(&s);
    s.shares.declare_default(&14, &s.producer);
}

#[test]
fn offering_from_before_escrow_still_pays_in_full() {
    let s = setup();
    open_default(&s);
    // What an offering opened by the previous contract version looks like.
    s.env.as_contract(&s.shares_addr, || {
        s.env.storage().persistent().remove(&DataKey::Escrow(14));
    });
    s.shares.buy(&14, &s.buyer, &5);
    assert_eq!(balance(&s.env, &s.usdc, &s.producer), 60 * USDC);
    assert_eq!(s.shares.held_per_share_now(&14), 0);

    // Redeeming records a claim with nothing held for it.
    s.shares.buy(&14, &s.buyer, &5);
    mature(&s);
    let claim_id = s.shares.redeem(&14, &s.buyer, &10);
    assert_eq!(s.shares.claim_escrow(&claim_id), None);
}

// ---------- resale ----------

/// Batch 14 with 10 shares bought by `s.buyer`, and a second buyer with
/// 1000 USDC.
fn resale_setup(s: &Setup) -> Address {
    bought_ten(s);
    let second = Address::generate(&s.env);
    token::StellarAssetClient::new(&s.env, &s.usdc).mint(&second, &(1_000 * USDC));
    second
}

#[test]
fn listed_shares_wait_in_the_contract() {
    let s = setup();
    resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));

    assert_eq!(id, 1);
    assert_eq!(balance(&s.env, &s.share_token, &s.buyer), 6);
    assert_eq!(balance(&s.env, &s.share_token, &s.shares_addr), 4);
    let open = s.shares.listings(&14);
    assert_eq!(open.len(), 1);
    let l = open.get(0).unwrap();
    assert_eq!(l.seller, s.buyer);
    assert_eq!(l.shares, 4);
    assert_eq!(l.price, 15 * USDC);
    // The seller's position no longer counts the listed shares.
    assert_eq!(s.shares.get_position(&14, &s.buyer).shares, 6);
}

#[test]
fn a_second_buyer_takes_part_of_a_listing() {
    let s = setup();
    let second = resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    let seller_before = balance(&s.env, &s.usdc, &s.buyer);

    let paid = s.shares.buy_listing(&id, &second, &3);

    // 45 USDC: 1 % to the treasury, the rest to the seller.
    assert_eq!(paid, 45 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &second), 955 * USDC);
    assert_eq!(balance(&s.env, &s.usdc, &s.treasury), 45 * USDC / 100);
    assert_eq!(
        balance(&s.env, &s.usdc, &s.buyer),
        seller_before + 45 * USDC - 45 * USDC / 100
    );
    assert_eq!(balance(&s.env, &s.share_token, &second), 3);
    assert_eq!(s.shares.listing(&id).shares, 1);

    // Buying the last share closes the listing.
    s.shares.buy_listing(&id, &second, &1);
    assert_eq!(s.shares.listings(&14).len(), 0);
    assert_eq!(balance(&s.env, &s.share_token, &s.shares_addr), 0);
}

#[test]
fn resale_carries_the_storage_fee_checkpoint() {
    let s = setup();
    let second = resale_setup(&s);
    let t0 = s.env.ledger().timestamp();
    s.env.ledger().set_timestamp(t0 + 100 * DAY);
    let id = s.shares.list_for_sale(&14, &s.buyer, &10, &(15 * USDC));
    s.shares.buy_listing(&id, &second, &10);

    // The second buyer owes the fee since the original purchase: 100 days.
    let p = s.shares.get_position(&14, &second);
    assert_eq!(p.shares, 10);
    assert_eq!(p.fee_paid_until, t0);
    assert_eq!(s.shares.accrued_fee(&14, &second, &10), 10 * USDC);
}

#[test]
fn cancelling_returns_the_shares() {
    let s = setup();
    resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.cancel_listing(&id, &s.buyer);
    assert_eq!(balance(&s.env, &s.share_token, &s.buyer), 10);
    assert_eq!(s.shares.get_position(&14, &s.buyer).shares, 10);
    assert_eq!(s.shares.listings(&14).len(), 0);
}

#[test]
#[should_panic(expected = "Error(Contract, #619)")]
fn only_the_seller_cancels() {
    let s = setup();
    let second = resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.cancel_listing(&id, &second);
}

#[test]
#[should_panic(expected = "Error(Contract, #620)")]
fn seller_cannot_buy_its_own_listing() {
    let s = setup();
    resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.buy_listing(&id, &s.buyer, &1);
}

#[test]
#[should_panic(expected = "Error(Contract, #603)")]
fn buying_more_than_listed_panics() {
    let s = setup();
    let second = resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.buy_listing(&id, &second, &5);
}

#[test]
#[should_panic(expected = "Error(Contract, #611)")]
fn no_resale_after_a_default() {
    let s = setup();
    let second = resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.declare_default(&14, &s.inspector);
    s.shares.buy_listing(&id, &second, &1);
}

#[test]
fn a_listing_can_still_be_cancelled_and_refunded_after_a_default() {
    let s = setup();
    resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &4, &(15 * USDC));
    s.shares.declare_default(&14, &s.inspector);
    s.shares.cancel_listing(&id, &s.buyer);
    assert_eq!(s.shares.refund(&14, &s.buyer, &10), 36 * USDC);
}

#[test]
fn bought_back_shares_keep_their_escrow_claim() {
    let s = setup();
    let second = resale_setup(&s);
    let id = s.shares.list_for_sale(&14, &s.buyer, &10, &(15 * USDC));
    s.shares.buy_listing(&id, &second, &10);
    mature(&s);
    // The held 30 % follows the shares to the new holder's claim.
    let claim_id = s.shares.redeem(&14, &second, &10);
    assert_eq!(s.shares.claim_escrow(&claim_id).unwrap().amount, 36 * USDC);
    assert_eq!(s.shares.claim_escrow(&claim_id).unwrap().holder, second);
}
