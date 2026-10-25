// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.8.0
//
// Condition oracle: accepts ed25519-signed cellar readings per batch, keeps
// in-range statistics, stores a reference age curve per category and exposes
// the value mark:
//
//   mark(batch) = fill_price
//               x age_curve[category](months_since_fill)
//               x condition_multiplier(share_of_readings_in_range)
//               - accrued_storage_fee_per_share
//
// Multipliers are in basis points (10_000 = 1.0). Prices are in the payment
// token's units (USDC, 7 decimals).
//
// Roles (stellar-access AccessControl):
//   curator - registers batches, sensors and age curves

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    Bytes, BytesN, Env, IntoVal, Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::upgradeable::{self as upgradeable, Upgradeable};
use stellar_macros::only_role;

const BPS: i128 = 10_000;
/// Average month, in seconds, for the age curve index.
const SECONDS_PER_MONTH: u64 = 2_629_746;
const SECONDS_PER_DAY: u64 = 86_400;
/// A reading may not be stamped further ahead of ledger time than this.
const MAX_CLOCK_SKEW: u64 = 600;
/// Marks kept on chain per batch for the chart.
const MARK_HISTORY: u32 = 180;
/// Condition multiplier floor when no reading was in range.
const MIN_CONDITION_BPS: i128 = 7_000;

// ################## STORAGE ##################

#[contracttype]
pub enum DataKey {
    Batch(u32),
    Stats(u32),
    Marks(u32),
    Curve(Symbol),
}

/// Terms the oracle needs to value a batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchConfig {
    pub batch_id: u32,
    /// Age curve key, e.g. `moscatel`, `port`, `cheddar`.
    pub category: Symbol,
    /// ed25519 public key of the cellar sensor allowed to post readings.
    pub sensor: BytesN<32>,
    /// Issue price per share.
    pub fill_price: i128,
    pub filled_at: u64,
    /// Storage fee per share per day, mirrors batch_shares.
    pub fee_per_share_day: i128,
    /// Acceptable temperature band, in hundredths of a degree Celsius.
    pub temp_min: i32,
    pub temp_max: i32,
    /// Acceptable relative humidity band, in basis points.
    pub humidity_min: u32,
    pub humidity_max: u32,
}

/// One sensor reading. The signed payload is the 20-byte big-endian
/// concatenation `batch_id:u32 | timestamp:u64 | temp_c:i32 | humidity:u32`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Reading {
    pub batch_id: u32,
    pub timestamp: u64,
    /// Hundredths of a degree Celsius.
    pub temp_c: i32,
    /// Relative humidity in basis points.
    pub humidity: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stats {
    pub total: u32,
    pub in_range: u32,
    /// Timestamp of the last accepted reading, 0 when none.
    pub last_timestamp: u64,
    pub last_temp_c: i32,
    pub last_humidity: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Mark {
    pub value: i128,
    pub timestamp: u64,
    pub age_bps: i128,
    pub condition_bps: i128,
    pub fee_per_share: i128,
}

// ################## ERRORS ##################

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum OracleError {
    BatchExists = 700,
    BatchNotFound = 701,
    CurveNotFound = 702,
    InvalidCurve = 703,
    InvalidTerms = 704,
    /// Reading is older than or equal to the last accepted one.
    StaleReading = 705,
    /// Reading is stamped too far in the future.
    FutureReading = 706,
    /// Reading is for another batch than the one addressed.
    BatchMismatch = 707,
}

// ################## EVENTS ##################

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ReadingPosted {
    #[topic]
    pub batch_id: u32,
    pub timestamp: u64,
    pub temp_c: i32,
    pub humidity: u32,
    pub in_range: bool,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct MarkPublished {
    #[topic]
    pub batch_id: u32,
    pub value: i128,
    pub timestamp: u64,
}


// ################## STORAGE TTL ##################
//
// Rent: every write extends the small persistent entry it touches, so active
// batches keep their own data alive. It only triggers within 2 days of archival
// (fresh entries start with the 7-day network minimum), since rent on testnet
// makes every extension noticeable. The contract instance and code
// (35 KB, expensive to extend on testnet) are kept alive out of band by the
// platform with `stellar contract extend` (scripts/extend-ttl.sh); anyone may.

const DAY_IN_LEDGERS: u32 = 17_280;
const TTL_THRESHOLD: u32 = 2 * DAY_IN_LEDGERS;
const TTL_EXTEND_TO: u32 = 14 * DAY_IN_LEDGERS;

fn keep_key<K: IntoVal<Env, Val>>(e: &Env, key: &K) {
    e.storage().persistent().extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

// ################## CONTRACT ##################

#[contract]
pub struct ConditionOracle;

#[contractimpl]
impl ConditionOracle {
    pub fn __constructor(e: &Env, admin: Address, curator: Address) {
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &curator, &Symbol::new(e, "curator"), &admin);
        access_control::grant_role_no_auth(e, &admin, &Symbol::new(e, "upgrader"), &admin);
    }

    // ---------- curation ----------

    /// Store the age curve of a category: multiplier in basis points for
    /// month 0, 1, 2, ... since fill. The last point holds afterwards.
    #[only_role(caller, "curator")]
    pub fn set_curve(e: &Env, category: Symbol, points: Vec<u32>, caller: Address) {
        if points.is_empty() {
            panic_with_error!(e, OracleError::InvalidCurve);
        }
        for p in points.iter() {
            if p == 0 {
                panic_with_error!(e, OracleError::InvalidCurve);
            }
        }
        e.storage().persistent().set(&DataKey::Curve(category.clone()), &points);
        keep_key(e, &DataKey::Curve(category));
    }

    #[only_role(caller, "curator")]
    pub fn register_batch(e: &Env, config: BatchConfig, caller: Address) {
        if e.storage().persistent().has(&DataKey::Batch(config.batch_id)) {
            panic_with_error!(e, OracleError::BatchExists);
        }
        if !e.storage().persistent().has(&DataKey::Curve(config.category.clone())) {
            panic_with_error!(e, OracleError::CurveNotFound);
        }
        if config.fill_price <= 0
            || config.fee_per_share_day < 0
            || config.temp_min > config.temp_max
            || config.humidity_min > config.humidity_max
        {
            panic_with_error!(e, OracleError::InvalidTerms);
        }
        e.storage().persistent().set(&DataKey::Batch(config.batch_id), &config);
        keep_key(e, &DataKey::Batch(config.batch_id));
        e.storage().persistent().set(
            &DataKey::Stats(config.batch_id),
            &Stats { total: 0, in_range: 0, last_timestamp: 0, last_temp_c: 0, last_humidity: 0 },
        );
        keep_key(e, &DataKey::Stats(config.batch_id));
    }

    /// Rotate the sensor key of a batch.
    #[only_role(caller, "curator")]
    pub fn set_sensor(e: &Env, batch_id: u32, sensor: BytesN<32>, caller: Address) {
        let mut config = Self::load(e, batch_id);
        config.sensor = sensor;
        e.storage().persistent().set(&DataKey::Batch(batch_id), &config);
        keep_key(e, &DataKey::Batch(batch_id));
    }

    // ---------- readings ----------

    /// Post a sensor reading. Anyone may relay it; the signature by the
    /// batch's sensor key is what authorizes it.
    pub fn post_reading(e: &Env, batch_id: u32, reading: Reading, signature: BytesN<64>) -> bool {
        if reading.batch_id != batch_id {
            panic_with_error!(e, OracleError::BatchMismatch);
        }
        let config = Self::load(e, batch_id);
        let mut stats = Self::stats(e, batch_id);

        if stats.total > 0 && reading.timestamp <= stats.last_timestamp {
            panic_with_error!(e, OracleError::StaleReading);
        }
        if reading.timestamp > e.ledger().timestamp() + MAX_CLOCK_SKEW {
            panic_with_error!(e, OracleError::FutureReading);
        }

        let payload = Self::reading_payload(e, &reading);
        // Traps on a bad signature.
        e.crypto().ed25519_verify(&config.sensor, &payload, &signature);

        let in_range = reading.temp_c >= config.temp_min
            && reading.temp_c <= config.temp_max
            && reading.humidity >= config.humidity_min
            && reading.humidity <= config.humidity_max;

        stats.total += 1;
        if in_range {
            stats.in_range += 1;
        }
        stats.last_timestamp = reading.timestamp;
        stats.last_temp_c = reading.temp_c;
        stats.last_humidity = reading.humidity;
        e.storage().persistent().set(&DataKey::Stats(batch_id), &stats);
        keep_key(e, &DataKey::Stats(batch_id));

        ReadingPosted {
            batch_id,
            timestamp: reading.timestamp,
            temp_c: reading.temp_c,
            humidity: reading.humidity,
            in_range,
        }
        .publish(e);
        in_range
    }

    /// The exact bytes a sensor signs for `reading`.
    pub fn reading_payload(e: &Env, reading: &Reading) -> Bytes {
        let mut b = Bytes::new(e);
        b.extend_from_array(&reading.batch_id.to_be_bytes());
        b.extend_from_array(&reading.timestamp.to_be_bytes());
        b.extend_from_array(&reading.temp_c.to_be_bytes());
        b.extend_from_array(&reading.humidity.to_be_bytes());
        b
    }

    // ---------- marks ----------

    /// Compute the mark now, store it in the batch's history and emit it.
    /// Permissionless so a cron or the relayer can post one per epoch.
    pub fn publish_mark(e: &Env, batch_id: u32) -> Mark {
        let mark = Self::mark(e, batch_id);
        let mut history: Vec<Mark> =
            e.storage().persistent().get(&DataKey::Marks(batch_id)).unwrap_or(Vec::new(e));
        if history.len() >= MARK_HISTORY {
            history.remove(0);
        }
        history.push_back(mark.clone());
        e.storage().persistent().set(&DataKey::Marks(batch_id), &history);
        keep_key(e, &DataKey::Marks(batch_id));
        MarkPublished { batch_id, value: mark.value, timestamp: mark.timestamp }.publish(e);
        mark
    }

    /// Current reference value of one share, computed from storage.
    pub fn mark(e: &Env, batch_id: u32) -> Mark {
        let config = Self::load(e, batch_id);
        let stats = Self::stats(e, batch_id);
        let now = e.ledger().timestamp();

        let age_bps = Self::age_multiplier(e, &config.category, config.filled_at, now);
        let condition_bps = Self::condition_multiplier(&stats);
        let days = if now > config.filled_at {
            ((now - config.filled_at) / SECONDS_PER_DAY) as i128
        } else {
            0
        };
        let fee_per_share = config.fee_per_share_day * days;

        let gross = config.fill_price * age_bps / BPS * condition_bps / BPS;
        let value = if gross > fee_per_share { gross - fee_per_share } else { 0 };

        Mark { value, timestamp: now, age_bps, condition_bps, fee_per_share }
    }

    /// Stored marks, oldest first.
    pub fn mark_history(e: &Env, batch_id: u32) -> Vec<Mark> {
        Self::load(e, batch_id);
        e.storage().persistent().get(&DataKey::Marks(batch_id)).unwrap_or(Vec::new(e))
    }

    // ---------- views ----------

    pub fn batch(e: &Env, batch_id: u32) -> BatchConfig {
        Self::load(e, batch_id)
    }

    pub fn get_stats(e: &Env, batch_id: u32) -> Stats {
        Self::load(e, batch_id);
        Self::stats(e, batch_id)
    }

    pub fn curve(e: &Env, category: Symbol) -> Vec<u32> {
        e.storage()
            .persistent()
            .get(&DataKey::Curve(category))
            .unwrap_or_else(|| panic_with_error!(e, OracleError::CurveNotFound))
    }

    // ---------- internals ----------

    fn load(e: &Env, batch_id: u32) -> BatchConfig {
        e.storage()
            .persistent()
            .get(&DataKey::Batch(batch_id))
            .unwrap_or_else(|| panic_with_error!(e, OracleError::BatchNotFound))
    }

    fn stats(e: &Env, batch_id: u32) -> Stats {
        e.storage()
            .persistent()
            .get(&DataKey::Stats(batch_id))
            .unwrap_or(Stats { total: 0, in_range: 0, last_timestamp: 0, last_temp_c: 0, last_humidity: 0 })
    }

    /// Curve point for the elapsed whole months, held flat past the end.
    fn age_multiplier(e: &Env, category: &Symbol, filled_at: u64, now: u64) -> i128 {
        let points = Self::curve(e, category.clone());
        let months = if now > filled_at { ((now - filled_at) / SECONDS_PER_MONTH) as u32 } else { 0 };
        let idx = if months >= points.len() { points.len() - 1 } else { months };
        points.get(idx).unwrap() as i128
    }

    /// 1.0 with no readings or all in range, falling linearly to 0.7 when none
    /// were in range.
    fn condition_multiplier(stats: &Stats) -> i128 {
        if stats.total == 0 {
            return BPS;
        }
        let share = stats.in_range as i128 * BPS / stats.total as i128;
        MIN_CONDITION_BPS + (BPS - MIN_CONDITION_BPS) * share / BPS
    }
}

#[contractimpl]
impl Upgradeable for ConditionOracle {
    #[only_role(operator, "upgrader")]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for ConditionOracle {}
