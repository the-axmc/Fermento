// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.8.0
//
// Batch shares: primary sale, storage fee accrual and redemption for the
// fungible shares of a registered batch.
//
// One classic Stellar asset (and its Stellar Asset Contract, SAC) exists per
// batch so shares can trade on the native DEX. The issuer makes this contract
// the SAC admin; this contract mints shares on purchase and burns them on
// redemption. Prices and fees are in the payment token (USDC, 7 decimals).
//
// Roles (stellar-access AccessControl):
//   issuer - opens, prices and closes offerings
//   pauser - emergency stop for buy and redeem

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_contract_utils::upgradeable::{self as upgradeable, Upgradeable};
use stellar_macros::{only_admin, only_role, when_not_paused};

const SECONDS_PER_DAY: u64 = 86_400;

// ################## CROSS-CONTRACT ##################

/// The slice of the batch registry this contract calls.
#[contractclient(name = "RegistryClient")]
pub trait BatchRegistryInterface {
    fn claim(e: Env, batch_id: u32, claimer: Address, units: u32, caller: Address) -> u32;
}

// ################## STORAGE ##################

#[contracttype]
pub enum DataKey {
    /// Payment token (USDC SAC).
    PaymentToken,
    /// Batch registry contract.
    Registry,
    /// Receives storage fees.
    Treasury,
    /// Offering for a batch id.
    Offering(u32),
    /// Position of a holder in a batch: shares bought here and fee checkpoint.
    Position(u32, Address),
}

/// Sale terms and state of one batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Offering {
    pub batch_id: u32,
    /// SAC of the share asset. This contract must be its admin.
    pub share_token: Address,
    /// Receives the sale proceeds.
    pub producer: Address,
    /// Price per share in payment token units.
    pub price: i128,
    pub total_shares: i128,
    pub sold: i128,
    /// Shares redeemed so far, so `sold - redeemed` is the circulating supply.
    pub redeemed: i128,
    /// Storage fee per share per day in payment token units.
    pub fee_per_share_day: i128,
    /// Shares a holder gives up for one unit.
    pub shares_per_unit: i128,
    /// Unix time the batch was filled; fees accrue from here.
    pub filled_at: u64,
    /// Unix time redemption opens.
    pub matures_at: u64,
    pub open: bool,
}

/// Fee bookkeeping for a holder in one batch. Shares bought on the DEX are not
/// known here, so the fee is charged on the shares presented at redemption,
/// from the holder's checkpoint or the fill date when they have none.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Position {
    pub shares: i128,
    /// Unix time up to which storage fees have been settled.
    pub fee_paid_until: u64,
}

// ################## ERRORS ##################

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BatchSharesError {
    OfferingExists = 600,
    OfferingNotFound = 601,
    OfferingClosed = 602,
    InvalidAmount = 603,
    SoldOut = 604,
    NotMature = 605,
    /// Redemption amount is not a whole number of units.
    NotWholeUnits = 606,
    InvalidTerms = 607,
}

// ################## EVENTS ##################

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfferingOpened {
    #[topic]
    pub batch_id: u32,
    pub share_token: Address,
    pub producer: Address,
    pub price: i128,
    pub total_shares: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharesBought {
    #[topic]
    pub batch_id: u32,
    #[topic]
    pub buyer: Address,
    pub shares: i128,
    pub paid: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct SharesRedeemed {
    #[topic]
    pub batch_id: u32,
    #[topic]
    pub holder: Address,
    pub shares: i128,
    pub units: u32,
    pub fee: i128,
    pub claim_id: u32,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct OfferingClosed {
    #[topic]
    pub batch_id: u32,
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
pub struct BatchShares;

#[contractimpl]
#[allow(clippy::too_many_arguments)]
impl BatchShares {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        issuer: Address,
        pauser: Address,
        payment_token: Address,
        registry: Address,
        treasury: Address,
    ) {
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &issuer, &Symbol::new(e, "issuer"), &admin);
        access_control::grant_role_no_auth(e, &pauser, &Symbol::new(e, "pauser"), &admin);
        access_control::grant_role_no_auth(e, &admin, &Symbol::new(e, "upgrader"), &admin);
        e.storage().instance().set(&DataKey::PaymentToken, &payment_token);
        e.storage().instance().set(&DataKey::Registry, &registry);
        e.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    // ---------- admin ----------

    /// Open the primary sale of a batch. `share_token` is the SAC of the
    /// batch's share asset and this contract must already be its admin.
    #[only_role(caller, "issuer")]
    #[allow(clippy::too_many_arguments)]
    pub fn open_offering(
        e: &Env,
        batch_id: u32,
        share_token: Address,
        producer: Address,
        price: i128,
        total_shares: i128,
        fee_per_share_day: i128,
        shares_per_unit: i128,
        filled_at: u64,
        matures_at: u64,
        caller: Address,
    ) {
        if e.storage().persistent().has(&DataKey::Offering(batch_id)) {
            panic_with_error!(e, BatchSharesError::OfferingExists);
        }
        if price <= 0
            || total_shares <= 0
            || fee_per_share_day < 0
            || shares_per_unit <= 0
            || matures_at < filled_at
        {
            panic_with_error!(e, BatchSharesError::InvalidTerms);
        }
        let offering = Offering {
            batch_id,
            share_token: share_token.clone(),
            producer: producer.clone(),
            price,
            total_shares,
            sold: 0,
            redeemed: 0,
            fee_per_share_day,
            shares_per_unit,
            filled_at,
            matures_at,
            open: true,
        };
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));
        OfferingOpened { batch_id, share_token, producer, price, total_shares }.publish(e);
    }

    /// Stop the primary sale. Redemption stays available.
    #[only_role(caller, "issuer")]
    pub fn close_offering(e: &Env, batch_id: u32, caller: Address) {
        let mut offering = Self::load(e, batch_id);
        offering.open = false;
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));
        OfferingClosed { batch_id }.publish(e);
    }

    /// Move the maturity date, for example when the cellar declares the batch
    /// ready early. Also what the demo uses to open redemption.
    #[only_role(caller, "issuer")]
    pub fn set_maturity(e: &Env, batch_id: u32, matures_at: u64, caller: Address) {
        let mut offering = Self::load(e, batch_id);
        offering.matures_at = matures_at;
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));
    }

    #[only_admin]
    pub fn set_treasury(e: &Env, treasury: Address) {
        e.storage().instance().set(&DataKey::Treasury, &treasury);
    }

    // ---------- buyers ----------

    /// Buy `shares` of a batch. The buyer pays `price * shares` in the payment
    /// token straight to the producer and receives freshly minted shares.
    #[when_not_paused]
    pub fn buy(e: &Env, batch_id: u32, buyer: Address, shares: i128) -> i128 {
        buyer.require_auth();
        if shares <= 0 {
            panic_with_error!(e, BatchSharesError::InvalidAmount);
        }
        let mut offering = Self::load(e, batch_id);
        if !offering.open {
            panic_with_error!(e, BatchSharesError::OfferingClosed);
        }
        if offering.sold + shares > offering.total_shares {
            panic_with_error!(e, BatchSharesError::SoldOut);
        }

        let paid = offering.price * shares;
        token::Client::new(e, &Self::payment_token(e)).transfer(&buyer, &offering.producer, &paid);
        token::StellarAssetClient::new(e, &offering.share_token).mint(&buyer, &shares);

        offering.sold += shares;
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));

        // Fees for these shares accrue from now; earlier shares keep their
        // checkpoint, so the position is settled at the weighted date.
        let now = e.ledger().timestamp();
        let position = Self::position(e, batch_id, &buyer);
        let paid_until = if position.shares == 0 {
            now
        } else {
            Self::weighted_checkpoint(position.shares, position.fee_paid_until, shares, now)
        };
        e.storage().persistent().set(
            &DataKey::Position(batch_id, buyer.clone()),
            &Position { shares: position.shares + shares, fee_paid_until: paid_until },
        );
        keep_key(e, &DataKey::Position(batch_id, buyer.clone()));

        SharesBought { batch_id, buyer, shares, paid }.publish(e);
        paid
    }

    /// Redeem `shares` for units once the batch is mature. The holder gives
    /// back the shares, pays the accrued storage fee to the treasury, and a
    /// claim is recorded on the registry. Returns the claim id.
    #[when_not_paused]
    pub fn redeem(e: &Env, batch_id: u32, holder: Address, shares: i128) -> u32 {
        holder.require_auth();
        if shares <= 0 {
            panic_with_error!(e, BatchSharesError::InvalidAmount);
        }
        let mut offering = Self::load(e, batch_id);
        let now = e.ledger().timestamp();
        if now < offering.matures_at {
            panic_with_error!(e, BatchSharesError::NotMature);
        }
        if shares % offering.shares_per_unit != 0 {
            panic_with_error!(e, BatchSharesError::NotWholeUnits);
        }
        let units = (shares / offering.shares_per_unit) as u32;

        // Shares come back here, then are burned so supply visibly falls.
        let share_client = token::Client::new(e, &offering.share_token);
        let this = e.current_contract_address();
        share_client.transfer(&holder, &this, &shares);
        share_client.burn(&this, &shares);

        // Storage fee on the shares presented.
        let fee = Self::fee_for(e, &offering, batch_id, &holder, shares, now);
        if fee > 0 {
            let treasury = Self::treasury(e);
            token::Client::new(e, &Self::payment_token(e)).transfer(&holder, &treasury, &fee);
        }
        let position = Self::position(e, batch_id, &holder);
        let remaining = if position.shares > shares { position.shares - shares } else { 0 };
        e.storage().persistent().set(
            &DataKey::Position(batch_id, holder.clone()),
            &Position { shares: remaining, fee_paid_until: now },
        );
        keep_key(e, &DataKey::Position(batch_id, holder.clone()));

        offering.redeemed += shares;
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));

        let claim_id =
            RegistryClient::new(e, &Self::registry(e)).claim(&batch_id, &holder, &units, &this);

        SharesRedeemed { batch_id, holder, shares, units, fee, claim_id }.publish(e);
        claim_id
    }

    // ---------- views ----------

    pub fn offering(e: &Env, batch_id: u32) -> Offering {
        Self::load(e, batch_id)
    }

    /// Shares still for sale in the primary offering.
    pub fn remaining(e: &Env, batch_id: u32) -> i128 {
        let offering = Self::load(e, batch_id);
        offering.total_shares - offering.sold
    }

    /// Shares in circulation: sold here minus redeemed.
    pub fn circulating(e: &Env, batch_id: u32) -> i128 {
        let offering = Self::load(e, batch_id);
        offering.sold - offering.redeemed
    }

    pub fn get_position(e: &Env, batch_id: u32, holder: Address) -> Position {
        Self::position(e, batch_id, &holder)
    }

    /// Storage fee `holder` would pay now to redeem `shares`.
    pub fn accrued_fee(e: &Env, batch_id: u32, holder: Address, shares: i128) -> i128 {
        let offering = Self::load(e, batch_id);
        Self::fee_for(e, &offering, batch_id, &holder, shares, e.ledger().timestamp())
    }

    pub fn payment_token(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::PaymentToken).expect("payment token set")
    }

    pub fn registry(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Registry).expect("registry set")
    }

    pub fn treasury(e: &Env) -> Address {
        e.storage().instance().get(&DataKey::Treasury).expect("treasury set")
    }

    // ---------- internals ----------

    fn load(e: &Env, batch_id: u32) -> Offering {
        e.storage()
            .persistent()
            .get(&DataKey::Offering(batch_id))
            .unwrap_or_else(|| panic_with_error!(e, BatchSharesError::OfferingNotFound))
    }

    fn position(e: &Env, batch_id: u32, holder: &Address) -> Position {
        e.storage()
            .persistent()
            .get(&DataKey::Position(batch_id, holder.clone()))
            .unwrap_or(Position { shares: 0, fee_paid_until: 0 })
    }

    /// Fee for `shares` from the holder's checkpoint, or from the fill date for
    /// shares acquired elsewhere (DEX), up to `now`. Whole days only.
    fn fee_for(
        e: &Env,
        offering: &Offering,
        batch_id: u32,
        holder: &Address,
        shares: i128,
        now: u64,
    ) -> i128 {
        if offering.fee_per_share_day == 0 {
            return 0;
        }
        let position = Self::position(e, batch_id, holder);
        let from = if position.shares > 0 { position.fee_paid_until } else { offering.filled_at };
        let from = if from < offering.filled_at { offering.filled_at } else { from };
        let days = if now > from { ((now - from) / SECONDS_PER_DAY) as i128 } else { 0 };
        offering.fee_per_share_day * days * shares
    }

    /// Checkpoint for a merged position: existing shares settled until `old_at`
    /// and `new` shares settled until `new_at`.
    fn weighted_checkpoint(old: i128, old_at: u64, new: i128, new_at: u64) -> u64 {
        let total = old + new;
        ((old_at as i128 * old + new_at as i128 * new) / total) as u64
    }
}

// ################## UTILS ##################

#[contractimpl]
impl Upgradeable for BatchShares {
    #[only_role(operator, "upgrader")]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}

#[contractimpl]
impl Pausable for BatchShares {
    fn paused(e: &Env) -> bool {
        pausable::paused(e)
    }

    #[only_role(caller, "pauser")]
    fn pause(e: &Env, caller: Address) {
        pausable::pause(e);
    }

    #[only_role(caller, "pauser")]
    fn unpause(e: &Env, caller: Address) {
        pausable::unpause(e);
    }
}

#[contractimpl(contracttrait)]
impl AccessControl for BatchShares {}
