// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.8.0
//
// Condition oracle: accepts ed25519-signed cellar readings per batch, keeps
// in-range statistics, stores a reference age curve per category, records the
// producer's check-ins and a per-producer rating, and exposes the value mark:
//
//   mark(batch) = fill_price
//               x age_curve[category](months_since_fill)
//               x condition_multiplier(share_of_readings_in_range)
//               x care_multiplier(check-ins: how often and how well)
//               x producer_multiplier(rating of the company behind the batch)
//               - accrued_storage_fee_per_share
//
// Multipliers are in basis points (10_000 = 1.0). Prices are in the payment
// token's units (USDC, 7 decimals).
//
// Roles (stellar-access AccessControl):
//   curator   - registers batches, sensors, producers, age curves and ratings
//   inspector - independent visits: the only check-ins that earn a care bonus
// The producer of a batch (an address set by the curator) posts check-ins by
// signing with its own account; no role is needed for that. They are shown
// to holders and keep the care bonus from decaying, but never raise it.

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error,
    xdr::ToXdr, Address, Bytes, BytesN, Env, IntoVal, String, Symbol, Val, Vec,
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
/// A published mark is only added to the history this long after the last
/// one, so anyone calling `publish_mark` cannot flush the chart. Matches the
/// keeper's default cadence.
const MIN_MARK_INTERVAL: u64 = 600;
/// Check-ins kept on chain per batch.
const CHECKIN_HISTORY: u32 = 60;
/// Longest check-in note, in bytes.
const MAX_NOTE_LEN: u32 = 280;
/// Condition multiplier floor when no reading was in range.
const MIN_CONDITION_BPS: i128 = 7_000;
/// Care bonus a perfect (score 100) inspection earns, in bps. Producer
/// check-ins earn none: a producer cannot raise its own mark.
const INSPECTION_BONUS_BPS: i128 = 500;
/// The care bonus never exceeds this (1.20x).
const MAX_CARE_BONUS_BPS: i128 = 2_000;
/// Days without a check-in or inspection before the care bonus starts to decay.
const CARE_GRACE_DAYS: u64 = 14;
/// Bonus lost per day of silence past the grace period, in bps.
const CARE_DECAY_BPS_PER_DAY: i128 = 25;
/// A producer rating may not leave this band (0.8x to 1.2x). Ratings stored
/// under the older, wider band are clamped to it when read.
const MIN_RATING_BPS: i128 = 8_000;
const MAX_RATING_BPS: i128 = 12_000;

// ################## STORAGE ##################

#[contracttype]
pub enum DataKey {
    Batch(u32),
    Stats(u32),
    Marks(u32),
    Curve(Symbol),
    /// Producer account allowed to post check-ins for a batch.
    Producer(u32),
    /// Check-ins of a batch, oldest first.
    Checkins(u32),
    /// Running care figures of a batch.
    Care(u32),
    /// Rating of a producer account.
    Rating(Address),
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

/// One sensor reading. The signed payload is the 52-byte big-endian
/// concatenation `oracle_contract_id:[u8;32] | batch_id:u32 | timestamp:u64 |
/// temp_c:i32 | humidity:u32`.
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

/// A producer's update on a batch: a lab reading, a tasting note, a photo, a
/// racking. Shown to holders and feeding the care multiplier.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Checkin {
    pub timestamp: u64,
    /// `lab`, `tasting`, `started`, `photo`, `racking`, `other`...
    pub kind: Symbol,
    pub note: String,
    /// How good the care was, 0 to 100, as reported by the producer.
    pub score: u32,
    pub poster: Address,
    /// Care bonus this check-in earned, in bps.
    pub bonus_bps: i128,
}

/// Running care figures of a batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Care {
    pub count: u32,
    /// Bonus earned so far, before decay, in bps.
    pub bonus_bps: i128,
    pub last_timestamp: u64,
}

/// The platform's view of the company behind a batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Rating {
    /// Multiplier in bps: market value of the producer. 10_000 is neutral.
    pub index_bps: i128,
    /// Verified as a registered company by the platform.
    pub certified: bool,
    pub updated_at: u64,
}

/// Every factor of the current mark, for the producer page.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Breakdown {
    pub value: i128,
    pub timestamp: u64,
    pub age_bps: i128,
    pub condition_bps: i128,
    pub care_bps: i128,
    pub producer_bps: i128,
    pub fee_per_share: i128,
    pub checkins: u32,
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
    /// The caller is not the producer of this batch.
    NotProducer = 708,
    /// A check-in score must be 0 to 100.
    InvalidScore = 709,
    /// A check-in note is longer than MAX_NOTE_LEN bytes.
    NoteTooLong = 710,
    /// A rating is outside the allowed band.
    InvalidRating = 711,
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CheckinPosted {
    #[topic]
    pub batch_id: u32,
    #[topic]
    pub poster: Address,
    pub kind: Symbol,
    pub score: u32,
    pub timestamp: u64,
    pub bonus_bps: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RatingSet {
    #[topic]
    pub producer: Address,
    pub index_bps: i128,
    pub certified: bool,
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

    /// Name the account that may post check-ins for a batch.
    #[only_role(caller, "curator")]
    pub fn set_producer(e: &Env, batch_id: u32, producer: Address, caller: Address) {
        Self::load(e, batch_id);
        e.storage().persistent().set(&DataKey::Producer(batch_id), &producer);
        keep_key(e, &DataKey::Producer(batch_id));
    }

    /// Rate a producer: `index_bps` is the platform's view of the company's
    /// market value (certification, sales traction, track record), applied to
    /// every batch it produces. 10_000 is neutral.
    #[only_role(caller, "curator")]
    pub fn set_rating(
        e: &Env,
        producer: Address,
        index_bps: i128,
        certified: bool,
        caller: Address,
    ) {
        if !(MIN_RATING_BPS..=MAX_RATING_BPS).contains(&index_bps) {
            panic_with_error!(e, OracleError::InvalidRating);
        }
        let rating = Rating { index_bps, certified, updated_at: e.ledger().timestamp() };
        e.storage().persistent().set(&DataKey::Rating(producer.clone()), &rating);
        keep_key(e, &DataKey::Rating(producer.clone()));
        RatingSet { producer, index_bps, certified }.publish(e);
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

    /// The exact bytes a sensor signs for `reading`. Starts with this
    /// contract's id, so a reading cannot be replayed on another deployment.
    pub fn reading_payload(e: &Env, reading: &Reading) -> Bytes {
        let mut b = Bytes::new(e);
        // The address XDR is an 8-byte header (ScVal and ScAddress type)
        // followed by the 32-byte contract id.
        b.append(&e.current_contract_address().to_xdr(e).slice(8..));
        b.extend_from_array(&reading.batch_id.to_be_bytes());
        b.extend_from_array(&reading.timestamp.to_be_bytes());
        b.extend_from_array(&reading.temp_c.to_be_bytes());
        b.extend_from_array(&reading.humidity.to_be_bytes());
        b
    }

    // ---------- check-ins ----------

    /// The producer of a batch posts an update. Authorized by the producer's
    /// own account (the address the curator set with `set_producer`). It is
    /// kept for holders and keeps the care bonus from decaying, but earns no
    /// bonus itself. Returns the care multiplier now in force.
    pub fn post_checkin(
        e: &Env,
        batch_id: u32,
        poster: Address,
        kind: Symbol,
        note: String,
        score: u32,
    ) -> i128 {
        poster.require_auth();
        Self::load(e, batch_id);
        let producer: Option<Address> = e.storage().persistent().get(&DataKey::Producer(batch_id));
        if producer.as_ref() != Some(&poster) {
            panic_with_error!(e, OracleError::NotProducer);
        }
        Self::record_checkin(e, batch_id, poster, kind, note, score, 0)
    }

    /// An inspector reports a visit. A perfect visit (score 100) earns
    /// INSPECTION_BONUS_BPS, scaled by `score` and capped overall at
    /// MAX_CARE_BONUS_BPS. Returns the care multiplier now in force.
    #[only_role(caller, "inspector")]
    pub fn post_inspection(
        e: &Env,
        batch_id: u32,
        kind: Symbol,
        note: String,
        score: u32,
        caller: Address,
    ) -> i128 {
        Self::load(e, batch_id);
        let bonus_bps = INSPECTION_BONUS_BPS * score as i128 / 100;
        Self::record_checkin(e, batch_id, caller, kind, note, score, bonus_bps)
    }

    fn record_checkin(
        e: &Env,
        batch_id: u32,
        poster: Address,
        kind: Symbol,
        note: String,
        score: u32,
        bonus_bps: i128,
    ) -> i128 {
        if score > 100 {
            panic_with_error!(e, OracleError::InvalidScore);
        }
        if note.len() > MAX_NOTE_LEN {
            panic_with_error!(e, OracleError::NoteTooLong);
        }

        let now = e.ledger().timestamp();
        let mut care = Self::care(e, batch_id);
        // Settle the decay so far, so restarting the grace period never brings
        // back bonus already lost.
        care.bonus_bps = Self::care_multiplier(&care, now) - BPS;
        let mut bonus_bps = bonus_bps;
        if care.bonus_bps + bonus_bps > MAX_CARE_BONUS_BPS {
            bonus_bps = MAX_CARE_BONUS_BPS - care.bonus_bps;
        }
        care.count += 1;
        care.bonus_bps += bonus_bps;
        care.last_timestamp = now;
        e.storage().persistent().set(&DataKey::Care(batch_id), &care);
        keep_key(e, &DataKey::Care(batch_id));

        let mut history: Vec<Checkin> =
            e.storage().persistent().get(&DataKey::Checkins(batch_id)).unwrap_or(Vec::new(e));
        if history.len() >= CHECKIN_HISTORY {
            history.remove(0);
        }
        history.push_back(Checkin {
            timestamp: now,
            kind: kind.clone(),
            note,
            score,
            poster: poster.clone(),
            bonus_bps,
        });
        e.storage().persistent().set(&DataKey::Checkins(batch_id), &history);
        keep_key(e, &DataKey::Checkins(batch_id));

        CheckinPosted { batch_id, poster, kind, score, timestamp: now, bonus_bps }.publish(e);
        Self::care_multiplier(&care, now)
    }

    /// Check-ins of a batch, oldest first.
    pub fn checkins(e: &Env, batch_id: u32) -> Vec<Checkin> {
        Self::load(e, batch_id);
        e.storage().persistent().get(&DataKey::Checkins(batch_id)).unwrap_or(Vec::new(e))
    }

    // ---------- marks ----------

    /// Compute the mark now, store it in the batch's history and emit it.
    /// Permissionless so a cron or the relayer can post one per epoch. Within
    /// MIN_MARK_INTERVAL of the last stored mark it only returns the mark.
    pub fn publish_mark(e: &Env, batch_id: u32) -> Mark {
        let mark = Self::mark(e, batch_id);
        let mut history: Vec<Mark> =
            e.storage().persistent().get(&DataKey::Marks(batch_id)).unwrap_or(Vec::new(e));
        if history.last().is_some_and(|last| mark.timestamp < last.timestamp + MIN_MARK_INTERVAL) {
            return mark;
        }
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
        let b = Self::breakdown(e, batch_id);
        Mark {
            value: b.value,
            timestamp: b.timestamp,
            age_bps: b.age_bps,
            condition_bps: b.condition_bps,
            fee_per_share: b.fee_per_share,
        }
    }

    /// The mark and every factor behind it.
    pub fn breakdown(e: &Env, batch_id: u32) -> Breakdown {
        let config = Self::load(e, batch_id);
        let stats = Self::stats(e, batch_id);
        let care = Self::care(e, batch_id);
        let now = e.ledger().timestamp();

        let age_bps = Self::age_multiplier(e, &config.category, config.filled_at, now);
        let condition_bps = Self::condition_multiplier(&stats);
        let care_bps = Self::care_multiplier(&care, now);
        let producer_bps = Self::producer_multiplier(e, batch_id);
        let days = if now > config.filled_at {
            ((now - config.filled_at) / SECONDS_PER_DAY) as i128
        } else {
            0
        };
        let fee_per_share = config.fee_per_share_day * days;

        let gross = config.fill_price * age_bps / BPS * condition_bps / BPS * care_bps / BPS
            * producer_bps
            / BPS;
        let value = if gross > fee_per_share { gross - fee_per_share } else { 0 };

        Breakdown {
            value,
            timestamp: now,
            age_bps,
            condition_bps,
            care_bps,
            producer_bps,
            fee_per_share,
            checkins: care.count,
        }
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

    /// Account allowed to post check-ins for a batch, if one was set.
    pub fn producer(e: &Env, batch_id: u32) -> Option<Address> {
        e.storage().persistent().get(&DataKey::Producer(batch_id))
    }

    /// Rating of a producer, if the platform has set one.
    pub fn rating(e: &Env, producer: Address) -> Option<Rating> {
        e.storage().persistent().get(&DataKey::Rating(producer))
    }

    pub fn get_care(e: &Env, batch_id: u32) -> Care {
        Self::load(e, batch_id);
        Self::care(e, batch_id)
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

    fn care(e: &Env, batch_id: u32) -> Care {
        e.storage()
            .persistent()
            .get(&DataKey::Care(batch_id))
            .unwrap_or(Care { count: 0, bonus_bps: 0, last_timestamp: 0 })
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

    /// 1.0 plus the care bonus, which decays once the producer goes quiet for
    /// longer than CARE_GRACE_DAYS. Never below 1.0.
    fn care_multiplier(care: &Care, now: u64) -> i128 {
        if care.count == 0 {
            return BPS;
        }
        let silent_days = if now > care.last_timestamp {
            (now - care.last_timestamp) / SECONDS_PER_DAY
        } else {
            0
        };
        let decay = if silent_days > CARE_GRACE_DAYS {
            (silent_days - CARE_GRACE_DAYS) as i128 * CARE_DECAY_BPS_PER_DAY
        } else {
            0
        };
        let bonus = if care.bonus_bps > decay { care.bonus_bps - decay } else { 0 };
        BPS + bonus
    }

    /// The producer's rating, or 1.0 when the batch has no producer or the
    /// producer no rating.
    fn producer_multiplier(e: &Env, batch_id: u32) -> i128 {
        let producer: Option<Address> = e.storage().persistent().get(&DataKey::Producer(batch_id));
        match producer {
            Some(p) => e
                .storage()
                .persistent()
                .get::<_, Rating>(&DataKey::Rating(p))
                .map(|r| r.index_bps.clamp(MIN_RATING_BPS, MAX_RATING_BPS))
                .unwrap_or(BPS),
            None => BPS,
        }
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
