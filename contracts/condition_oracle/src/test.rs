#![cfg(test)]

extern crate std;

use ed25519_dalek::{Signer, SigningKey};
use soroban_sdk::{
    testutils::{Address as _, Ledger as _},
    vec, Address, BytesN, Env, Symbol,
};

use crate::contract::{BatchConfig, ConditionOracle, ConditionOracleClient, Reading};

const DAY: u64 = 86_400;
const MONTH: u64 = 2_629_746;
const USDC: i128 = 10_000_000;
const T0: u64 = 1_000 * DAY;

struct Setup<'a> {
    env: Env,
    oracle: ConditionOracleClient<'a>,
    curator: Address,
    inspector: Address,
    sensor: SigningKey,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_timestamp(T0);
    let admin = Address::generate(&env);
    let curator = Address::generate(&env);
    let addr = env.register(ConditionOracle, (admin.clone(), curator.clone()));
    let oracle = ConditionOracleClient::new(&env, &addr);
    let inspector = Address::generate(&env);
    oracle.grant_role(&inspector, &Symbol::new(&env, "inspector"), &admin);
    let sensor = SigningKey::from_bytes(&[7u8; 32]);
    Setup { env, oracle, curator, inspector, sensor }
}

fn sensor_key(env: &Env, key: &SigningKey) -> BytesN<32> {
    BytesN::from_array(env, &key.verifying_key().to_bytes())
}

fn moscatel_curve(s: &Setup) {
    // 1.00, 1.02, 1.04, ... per month, then +12% from month 12 onward.
    s.oracle.set_curve(
        &Symbol::new(&s.env, "moscatel"),
        &vec![&s.env, 10_000, 10_200, 10_400, 10_600, 10_800, 11_000, 11_200, 11_200, 11_200, 11_200, 11_200, 11_200, 12_000],
        &s.curator,
    );
}

fn register_14(s: &Setup) {
    moscatel_curve(s);
    s.oracle.register_batch(
        &BatchConfig {
            batch_id: 14,
            category: Symbol::new(&s.env, "moscatel"),
            sensor: sensor_key(&s.env, &s.sensor),
            fill_price: 12 * USDC,
            filled_at: T0,
            fee_per_share_day: USDC / 100,
            temp_min: 1_200,
            temp_max: 1_800,
            humidity_min: 6_000,
            humidity_max: 8_000,
        },
        &s.curator,
    );
}

fn signed(s: &Setup, key: &SigningKey, reading: &Reading) -> BytesN<64> {
    let payload = s.env.as_contract(&s.oracle.address, || {
        ConditionOracle::reading_payload(&s.env, reading)
    });
    let mut raw = std::vec![0u8; payload.len() as usize];
    payload.copy_into_slice(&mut raw);
    BytesN::from_array(&s.env, &key.sign(&raw).to_bytes())
}

fn reading(ts: u64, temp_c: i32, humidity: u32) -> Reading {
    Reading { batch_id: 14, timestamp: ts, temp_c, humidity }
}

#[test]
fn register_and_read_back() {
    let s = setup();
    register_14(&s);
    let cfg = s.oracle.batch(&14);
    assert_eq!(cfg.fill_price, 12 * USDC);
    assert_eq!(s.oracle.get_stats(&14).total, 0);
    assert_eq!(s.oracle.curve(&Symbol::new(&s.env, "moscatel")).len(), 13);
}

#[test]
#[should_panic(expected = "Error(Contract, #702)")]
fn register_without_curve_panics() {
    let s = setup();
    s.oracle.register_batch(
        &BatchConfig {
            batch_id: 1,
            category: Symbol::new(&s.env, "nocurve"),
            sensor: sensor_key(&s.env, &s.sensor),
            fill_price: USDC,
            filled_at: T0,
            fee_per_share_day: 0,
            temp_min: 0,
            temp_max: 1,
            humidity_min: 0,
            humidity_max: 1,
        },
        &s.curator,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #703)")]
fn empty_curve_panics() {
    let s = setup();
    s.oracle.set_curve(&Symbol::new(&s.env, "x"), &vec![&s.env], &s.curator);
}

#[test]
fn payload_is_20_bytes_big_endian() {
    let s = setup();
    let r = reading(0x0102030405060708, 0x11121314, 0x21222324);
    let payload = s.env.as_contract(&s.oracle.address, || {
        ConditionOracle::reading_payload(&s.env, &r)
    });
    let mut raw = [0u8; 20];
    payload.copy_into_slice(&mut raw);
    assert_eq!(
        raw,
        [
            0, 0, 0, 14, 1, 2, 3, 4, 5, 6, 7, 8, 0x11, 0x12, 0x13, 0x14, 0x21, 0x22, 0x23, 0x24
        ]
    );
}

#[test]
fn signed_reading_updates_stats() {
    let s = setup();
    register_14(&s);

    let r1 = reading(T0 + 60, 1_500, 7_000);
    let in_range = s.oracle.post_reading(&14, &r1, &signed(&s, &s.sensor, &r1));
    assert!(in_range);

    let r2 = reading(T0 + 120, 2_500, 7_000); // too warm
    let in_range = s.oracle.post_reading(&14, &r2, &signed(&s, &s.sensor, &r2));
    assert!(!in_range);

    let stats = s.oracle.get_stats(&14);
    assert_eq!(stats.total, 2);
    assert_eq!(stats.in_range, 1);
    assert_eq!(stats.last_timestamp, r2.timestamp);
    assert_eq!(stats.last_temp_c, 2_500);
    assert_eq!(stats.last_humidity, 7_000);
}

#[test]
#[should_panic]
fn wrong_key_is_rejected() {
    let s = setup();
    register_14(&s);
    let impostor = SigningKey::from_bytes(&[9u8; 32]);
    let r = reading(T0 + 60, 1_500, 7_000);
    s.oracle.post_reading(&14, &r, &signed(&s, &impostor, &r));
}

#[test]
#[should_panic]
fn tampered_reading_is_rejected() {
    let s = setup();
    register_14(&s);
    let r = reading(T0 + 60, 1_500, 7_000);
    let sig = signed(&s, &s.sensor, &r);
    let tampered = reading(T0 + 60, 1_501, 7_000);
    s.oracle.post_reading(&14, &tampered, &sig);
}

#[test]
#[should_panic(expected = "Error(Contract, #705)")]
fn replayed_reading_is_rejected() {
    let s = setup();
    register_14(&s);
    let r = reading(T0 + 60, 1_500, 7_000);
    let sig = signed(&s, &s.sensor, &r);
    s.oracle.post_reading(&14, &r, &sig);
    s.oracle.post_reading(&14, &r, &sig);
}

#[test]
#[should_panic(expected = "Error(Contract, #706)")]
fn future_reading_is_rejected() {
    let s = setup();
    register_14(&s);
    let r = reading(T0 + 3_600, 1_500, 7_000);
    s.oracle.post_reading(&14, &r, &signed(&s, &s.sensor, &r));
}

#[test]
#[should_panic(expected = "Error(Contract, #707)")]
fn reading_for_other_batch_is_rejected() {
    let s = setup();
    register_14(&s);
    let r = Reading { batch_id: 15, timestamp: T0 + 60, temp_c: 1_500, humidity: 7_000 };
    s.oracle.post_reading(&14, &r, &signed(&s, &s.sensor, &r));
}

#[test]
fn rotated_sensor_key_is_honoured() {
    let s = setup();
    register_14(&s);
    let new_key = SigningKey::from_bytes(&[3u8; 32]);
    s.oracle.set_sensor(&14, &sensor_key(&s.env, &new_key), &s.curator);
    let r = reading(T0 + 60, 1_500, 7_000);
    assert!(s.oracle.post_reading(&14, &r, &signed(&s, &new_key, &r)));
}

#[test]
fn mark_at_fill_equals_fill_price() {
    let s = setup();
    register_14(&s);
    let m = s.oracle.mark(&14);
    assert_eq!(m.value, 12 * USDC);
    assert_eq!(m.age_bps, 10_000);
    assert_eq!(m.condition_bps, 10_000);
    assert_eq!(m.fee_per_share, 0);
}

#[test]
fn mark_rises_with_age_and_falls_with_fees() {
    let s = setup();
    register_14(&s);
    // 3 months and 2 days later: curve 1.06, 92 days of 0.01 fee.
    s.env.ledger().set_timestamp(T0 + 3 * MONTH + 2 * DAY);
    let m = s.oracle.mark(&14);
    let days = ((3 * MONTH + 2 * DAY) / DAY) as i128;
    assert_eq!(m.age_bps, 10_600);
    assert_eq!(m.fee_per_share, days * USDC / 100);
    assert_eq!(m.value, 12 * USDC * 10_600 / 10_000 - days * USDC / 100);
}

#[test]
fn mark_holds_last_curve_point() {
    let s = setup();
    register_14(&s);
    s.env.ledger().set_timestamp(T0 + 40 * MONTH);
    assert_eq!(s.oracle.mark(&14).age_bps, 12_000);
}

#[test]
fn bad_conditions_discount_the_mark() {
    let s = setup();
    register_14(&s);
    // One in range, one out: share 0.5 -> 0.7 + 0.3 * 0.5 = 0.85
    let r1 = reading(T0 + 60, 1_500, 7_000);
    s.oracle.post_reading(&14, &r1, &signed(&s, &s.sensor, &r1));
    let r2 = reading(T0 + 120, 3_000, 7_000);
    s.oracle.post_reading(&14, &r2, &signed(&s, &s.sensor, &r2));

    let m = s.oracle.mark(&14);
    assert_eq!(m.condition_bps, 8_500);
    assert_eq!(m.value, 12 * USDC * 8_500 / 10_000);
}

#[test]
fn publish_mark_appends_history() {
    let s = setup();
    register_14(&s);
    s.oracle.publish_mark(&14);
    s.env.ledger().set_timestamp(T0 + DAY);
    let m = s.oracle.publish_mark(&14);

    let history = s.oracle.mark_history(&14);
    assert_eq!(history.len(), 2);
    assert_eq!(history.get(1).unwrap(), m);
    assert_eq!(history.get(0).unwrap().timestamp, T0);
}

// ---------- check-ins, care and ratings ----------

fn checkin(s: &Setup, producer: &Address, score: u32) -> i128 {
    s.oracle.post_checkin(
        &14,
        producer,
        &Symbol::new(&s.env, "lab"),
        &soroban_sdk::String::from_str(&s.env, "pH down to 3.2, sugar at 4 Bx."),
        &score,
    )
}

fn inspection(s: &Setup, score: u32) -> i128 {
    s.oracle.post_inspection(
        &14,
        &Symbol::new(&s.env, "visit"),
        &soroban_sdk::String::from_str(&s.env, "Cask 14 sealed, level at the bung."),
        &score,
        &s.inspector,
    )
}

#[test]
fn checkin_by_producer_is_recorded_but_not_rewarded() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    assert_eq!(s.oracle.producer(&14), Some(producer.clone()));

    let before = s.oracle.mark(&14).value;
    // A perfect self-reported score does not move the mark.
    assert_eq!(checkin(&s, &producer, 100), 10_000);
    let b = s.oracle.breakdown(&14);
    assert_eq!(b.care_bps, 10_000);
    assert_eq!(b.checkins, 1);
    assert_eq!(b.value, before);

    let history = s.oracle.checkins(&14);
    assert_eq!(history.len(), 1);
    let c = history.get(0).unwrap();
    assert_eq!(c.score, 100);
    assert_eq!(c.bonus_bps, 0);
    assert_eq!(c.poster, producer);
    assert_eq!(c.kind, Symbol::new(&s.env, "lab"));
}

#[test]
fn inspection_raises_the_mark() {
    let s = setup();
    register_14(&s);
    let before = s.oracle.mark(&14).value;
    // One perfect visit: 1.05x.
    assert_eq!(inspection(&s, 100), 10_500);
    let b = s.oracle.breakdown(&14);
    assert_eq!(b.care_bps, 10_500);
    assert_eq!(b.value, before * 10_500 / 10_000);
    let c = s.oracle.checkins(&14).get(0).unwrap();
    assert_eq!(c.poster, s.inspector);
    assert_eq!(c.bonus_bps, 500);
    // A weaker visit earns less, scaled by its score.
    assert_eq!(inspection(&s, 40), 10_700);
}

#[test]
#[should_panic(expected = "Error(Contract, #2000)")]
fn producer_cannot_post_an_inspection() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    s.oracle.post_inspection(
        &14,
        &Symbol::new(&s.env, "visit"),
        &soroban_sdk::String::from_str(&s.env, "All good."),
        &100,
        &producer,
    );
}

#[test]
#[should_panic(expected = "Error(Contract, #708)")]
fn checkin_by_stranger_panics() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    let stranger = Address::generate(&s.env);
    checkin(&s, &stranger, 50);
}

#[test]
#[should_panic(expected = "Error(Contract, #708)")]
fn checkin_without_producer_panics() {
    let s = setup();
    register_14(&s);
    checkin(&s, &Address::generate(&s.env), 50);
}

#[test]
#[should_panic(expected = "Error(Contract, #709)")]
fn checkin_score_over_100_panics() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    checkin(&s, &producer, 101);
}

#[test]
fn care_bonus_is_capped_and_decays_when_the_producer_goes_quiet() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    let mut care = 0;
    for i in 0..5u64 {
        s.env.ledger().set_timestamp(T0 + i * 30 * DAY);
        care = inspection(&s, 100);
    }
    // 5 x 500 would be 2 500; the cap is 2 000.
    assert_eq!(care, 12_000);
    let last = T0 + 4 * 30 * DAY;
    // Within the grace period nothing is lost.
    s.env.ledger().set_timestamp(last + 14 * DAY);
    assert_eq!(s.oracle.breakdown(&14).care_bps, 12_000);
    // 10 days past it: 10 x 25 bps gone.
    s.env.ledger().set_timestamp(last + 24 * DAY);
    assert_eq!(s.oracle.breakdown(&14).care_bps, 11_750);
    // A producer check-in restarts the grace period without adding bonus.
    checkin(&s, &producer, 100);
    assert_eq!(s.oracle.breakdown(&14).care_bps, 12_000);
    // Long silence returns to neutral, never below.
    s.env.ledger().set_timestamp(last + 400 * DAY);
    assert_eq!(s.oracle.breakdown(&14).care_bps, 10_000);
}

#[test]
fn producer_rating_scales_the_mark() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    assert_eq!(s.oracle.rating(&producer), None);
    let neutral = s.oracle.mark(&14).value;

    s.oracle.set_rating(&producer, &11_000, &true, &s.curator);
    let r = s.oracle.rating(&producer).unwrap();
    assert!(r.certified);
    assert_eq!(r.index_bps, 11_000);
    let b = s.oracle.breakdown(&14);
    assert_eq!(b.producer_bps, 11_000);
    assert_eq!(b.value, neutral * 11_000 / 10_000);

    s.oracle.set_rating(&producer, &9_000, &false, &s.curator);
    assert_eq!(s.oracle.breakdown(&14).value, neutral * 9_000 / 10_000);
}

#[test]
#[should_panic(expected = "Error(Contract, #711)")]
fn rating_outside_band_panics() {
    let s = setup();
    // 1.5x was allowed before; the band is now 0.8x to 1.2x.
    s.oracle.set_rating(&Address::generate(&s.env), &15_000, &true, &s.curator);
}

#[test]
fn rating_stored_under_the_old_band_is_clamped() {
    let s = setup();
    register_14(&s);
    let producer = Address::generate(&s.env);
    s.oracle.set_producer(&14, &producer, &s.curator);
    // What a 2.0x rating written by the previous contract version looks like.
    let rating = crate::contract::Rating { index_bps: 20_000, certified: true, updated_at: T0 };
    s.env.as_contract(&s.oracle.address, || {
        s.env
            .storage()
            .persistent()
            .set(&crate::contract::DataKey::Rating(producer.clone()), &rating);
    });
    assert_eq!(s.oracle.breakdown(&14).producer_bps, 12_000);
}
