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
// Buyer protection: an offering only opens once an inspector has attested the
// batch on the registry, and never for more units than attested. Each payment
// is split: UPFRONT_BPS goes to the producer at once, the rest stays here.
// INSPECTION_BPS is released when an inspector confirms the batch while it
// ages; what is left is released per claim once the unit is collected. If the
// inspector declares the batch failed, holders take back what is still held.
//
// Roles (stellar-access AccessControl):
//   issuer    - opens, prices and closes offerings
//   pauser    - emergency stop for buy and redeem
//   inspector - confirms inspections and collections, declares a failed batch

use soroban_sdk::{
    contract, contractclient, contracterror, contractevent, contractimpl, contracttype,
    panic_with_error, token, Address, BytesN, Env, IntoVal, Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_contract_utils::upgradeable::{self as upgradeable, Upgradeable};
use stellar_macros::{only_admin, only_role, when_not_paused};

const SECONDS_PER_DAY: u64 = 86_400;
const BPS: i128 = 10_000;
/// Share of each payment the producer receives at purchase.
const UPFRONT_BPS: i128 = 7_000;
/// Share released to the producer when an inspector confirms the batch.
const INSPECTION_BPS: i128 = 1_500;

// ################## CROSS-CONTRACT ##################

/// The slice of the batch registry this contract calls.
#[contractclient(name = "RegistryClient")]
pub trait BatchRegistryInterface {
    fn claim(e: Env, batch_id: u32, claimer: Address, units: u32, caller: Address) -> u32;
    fn attestation(e: Env, batch_id: u32) -> Option<Attestation>;
}

/// Mirror of the registry's attestation record.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    pub inspector: Address,
    pub units: u32,
    pub evidence: BytesN<32>,
    pub timestamp: u64,
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
    /// Buyer money held for a batch. Absent for offerings opened before
    /// escrow existed, which paid the producer in full.
    Escrow(u32),
    /// Money held for one claim until its units are collected.
    ClaimEscrow(u32),
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

/// Escrow terms and state of one batch.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Escrow {
    /// Share of the price paid to the producer at purchase, in bps.
    pub upfront_bps: i128,
    /// Share of the price released when an inspector confirms the batch.
    pub inspection_bps: i128,
    pub inspected: bool,
    /// Declared failed by an inspector: sales and redemption stop, refunds open.
    pub defaulted: bool,
    /// Held for shares still in circulation. Claims hold their own amount.
    pub pool: i128,
    /// Shares handed back for a refund after a default.
    pub refunded: i128,
}

/// Money held for one claim, released to the producer on collection.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ClaimEscrow {
    pub batch_id: u32,
    pub holder: Address,
    pub amount: i128,
    pub settled: bool,
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
    /// No inspector has attested this batch on the registry.
    NotAttested = 608,
    /// More shares than the attested units can back.
    ExceedsAttested = 609,
    /// The offering predates escrow.
    NoEscrow = 610,
    /// The batch was declared failed.
    Defaulted = 611,
    /// Refunds need the batch to be declared failed first.
    NotDefaulted = 612,
    AlreadyInspected = 613,
    ClaimNotFound = 614,
    AlreadySettled = 615,
    /// Only the claim's holder or an inspector may confirm or refund it.
    NotClaimant = 616,
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

/// Held money paid out to the producer: `reason` is `inspected` or `collected`.
#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EscrowReleased {
    #[topic]
    pub batch_id: u32,
    pub reason: Symbol,
    pub amount: i128,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchDefaulted {
    #[topic]
    pub batch_id: u32,
    pub inspector: Address,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Refunded {
    #[topic]
    pub batch_id: u32,
    #[topic]
    pub holder: Address,
    pub shares: i128,
    pub amount: i128,
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
    /// batch's share asset and this contract must already be its admin. The
    /// batch must be attested on the registry, and `total_shares` may not
    /// exceed the attested units.
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
        let attested = RegistryClient::new(e, &Self::registry(e))
            .attestation(&batch_id)
            .unwrap_or_else(|| panic_with_error!(e, BatchSharesError::NotAttested));
        if total_shares > attested.units as i128 * shares_per_unit {
            panic_with_error!(e, BatchSharesError::ExceedsAttested);
        }
        let escrow = Escrow {
            upfront_bps: UPFRONT_BPS,
            inspection_bps: INSPECTION_BPS,
            inspected: false,
            defaulted: false,
            pool: 0,
            refunded: 0,
        };
        Self::save_escrow(e, batch_id, &escrow);
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

    /// Buy `shares` of a batch for `price * shares` in the payment token. The
    /// producer gets the upfront part at once and this contract holds the
    /// rest; the buyer receives freshly minted shares.
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
        let payment = token::Client::new(e, &Self::payment_token(e));
        let held = match Self::load_escrow(e, batch_id) {
            Some(mut escrow) => {
                if escrow.defaulted {
                    panic_with_error!(e, BatchSharesError::Defaulted);
                }
                let held = Self::held_per_share(&offering, &escrow) * shares;
                escrow.pool += held;
                Self::save_escrow(e, batch_id, &escrow);
                held
            }
            None => 0,
        };
        payment.transfer(&buyer, &offering.producer, &(paid - held));
        if held > 0 {
            let this = e.current_contract_address();
            payment.transfer(&buyer, &this, &held);
        }
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
    /// claim is recorded on the registry. The money still held for these
    /// shares moves to the claim until the units are collected. Returns the
    /// claim id.
    #[when_not_paused]
    pub fn redeem(e: &Env, batch_id: u32, holder: Address, shares: i128) -> u32 {
        holder.require_auth();
        if shares <= 0 {
            panic_with_error!(e, BatchSharesError::InvalidAmount);
        }
        let mut offering = Self::load(e, batch_id);
        let mut escrow = Self::load_escrow(e, batch_id);
        if escrow.as_ref().is_some_and(|esc| esc.defaulted) {
            panic_with_error!(e, BatchSharesError::Defaulted);
        }
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

        if let Some(esc) = escrow.as_mut() {
            let amount = Self::held_per_share(&offering, esc) * shares;
            esc.pool -= amount;
            Self::save_escrow(e, batch_id, esc);
            let record = ClaimEscrow { batch_id, holder: holder.clone(), amount, settled: false };
            e.storage().persistent().set(&DataKey::ClaimEscrow(claim_id), &record);
            keep_key(e, &DataKey::ClaimEscrow(claim_id));
        }

        SharesRedeemed { batch_id, holder, shares, units, fee, claim_id }.publish(e);
        claim_id
    }

    // ---------- escrow ----------

    /// An inspector confirms the batch is in the cellar and in good order
    /// while it ages: the inspection part of every circulating share goes to
    /// the producer. Once per batch.
    #[only_role(caller, "inspector")]
    #[when_not_paused]
    pub fn confirm_inspection(e: &Env, batch_id: u32, caller: Address) -> i128 {
        let offering = Self::load(e, batch_id);
        let mut escrow = Self::escrow_or_panic(e, batch_id);
        if escrow.defaulted {
            panic_with_error!(e, BatchSharesError::Defaulted);
        }
        if escrow.inspected {
            panic_with_error!(e, BatchSharesError::AlreadyInspected);
        }
        let circulating = offering.sold - offering.redeemed - escrow.refunded;
        let amount = offering.price * escrow.inspection_bps / BPS * circulating;
        escrow.pool -= amount;
        escrow.inspected = true;
        Self::save_escrow(e, batch_id, &escrow);
        if amount > 0 {
            token::Client::new(e, &Self::payment_token(e)).transfer(
                &e.current_contract_address(),
                &offering.producer,
                &amount,
            );
        }
        EscrowReleased { batch_id, reason: Symbol::new(e, "inspected"), amount }.publish(e);
        amount
    }

    /// The units of a claim were handed over: release what was held for them
    /// to the producer. Confirmed by the holder, or by an inspector who
    /// witnessed the collection.
    #[when_not_paused]
    pub fn confirm_collection(e: &Env, claim_id: u32, caller: Address) -> i128 {
        caller.require_auth();
        let mut record = Self::claim_escrow_or_panic(e, claim_id);
        if record.settled {
            panic_with_error!(e, BatchSharesError::AlreadySettled);
        }
        if caller != record.holder
            && access_control::has_role(e, &caller, &Symbol::new(e, "inspector")).is_none()
        {
            panic_with_error!(e, BatchSharesError::NotClaimant);
        }
        let offering = Self::load(e, record.batch_id);
        record.settled = true;
        e.storage().persistent().set(&DataKey::ClaimEscrow(claim_id), &record);
        keep_key(e, &DataKey::ClaimEscrow(claim_id));
        if record.amount > 0 {
            token::Client::new(e, &Self::payment_token(e)).transfer(
                &e.current_contract_address(),
                &offering.producer,
                &record.amount,
            );
        }
        EscrowReleased {
            batch_id: record.batch_id,
            reason: Symbol::new(e, "collected"),
            amount: record.amount,
        }
        .publish(e);
        record.amount
    }

    /// An inspector finds the batch missing, swapped or spoiled. Sales and
    /// redemption stop and holders can take back the money still held.
    #[only_role(caller, "inspector")]
    pub fn declare_default(e: &Env, batch_id: u32, caller: Address) {
        let mut offering = Self::load(e, batch_id);
        let mut escrow = Self::escrow_or_panic(e, batch_id);
        escrow.defaulted = true;
        Self::save_escrow(e, batch_id, &escrow);
        offering.open = false;
        e.storage().persistent().set(&DataKey::Offering(batch_id), &offering);
        keep_key(e, &DataKey::Offering(batch_id));
        BatchDefaulted { batch_id, inspector: caller }.publish(e);
    }

    /// After a default, hand back `shares` (burned) for the money still held
    /// for them. Works for shares bought anywhere, including the DEX.
    #[when_not_paused]
    pub fn refund(e: &Env, batch_id: u32, holder: Address, shares: i128) -> i128 {
        holder.require_auth();
        if shares <= 0 {
            panic_with_error!(e, BatchSharesError::InvalidAmount);
        }
        let offering = Self::load(e, batch_id);
        let mut escrow = Self::escrow_or_panic(e, batch_id);
        if !escrow.defaulted {
            panic_with_error!(e, BatchSharesError::NotDefaulted);
        }
        let share_client = token::Client::new(e, &offering.share_token);
        let this = e.current_contract_address();
        share_client.transfer(&holder, &this, &shares);
        share_client.burn(&this, &shares);

        let owed = Self::held_per_share(&offering, &escrow) * shares;
        let amount = if owed > escrow.pool { escrow.pool } else { owed };
        escrow.pool -= amount;
        escrow.refunded += shares;
        Self::save_escrow(e, batch_id, &escrow);
        if amount > 0 {
            token::Client::new(e, &Self::payment_token(e)).transfer(&this, &holder, &amount);
        }
        Refunded { batch_id, holder, shares, amount }.publish(e);
        amount
    }

    /// After a default, the holder of an uncollected claim takes back what
    /// was held for it.
    #[when_not_paused]
    pub fn refund_claim(e: &Env, claim_id: u32) -> i128 {
        let mut record = Self::claim_escrow_or_panic(e, claim_id);
        record.holder.require_auth();
        if record.settled {
            panic_with_error!(e, BatchSharesError::AlreadySettled);
        }
        let escrow = Self::escrow_or_panic(e, record.batch_id);
        if !escrow.defaulted {
            panic_with_error!(e, BatchSharesError::NotDefaulted);
        }
        record.settled = true;
        e.storage().persistent().set(&DataKey::ClaimEscrow(claim_id), &record);
        keep_key(e, &DataKey::ClaimEscrow(claim_id));
        if record.amount > 0 {
            token::Client::new(e, &Self::payment_token(e)).transfer(
                &e.current_contract_address(),
                &record.holder,
                &record.amount,
            );
        }
        Refunded {
            batch_id: record.batch_id,
            holder: record.holder,
            shares: 0,
            amount: record.amount,
        }
        .publish(e);
        record.amount
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

    /// Escrow of a batch; `None` for offerings opened before escrow existed.
    pub fn escrow(e: &Env, batch_id: u32) -> Option<Escrow> {
        Self::load_escrow(e, batch_id)
    }

    /// Payment held per circulating share right now: what a holder gets back
    /// per share if the batch fails.
    pub fn held_per_share_now(e: &Env, batch_id: u32) -> i128 {
        let offering = Self::load(e, batch_id);
        match Self::load_escrow(e, batch_id) {
            Some(escrow) => Self::held_per_share(&offering, &escrow),
            None => 0,
        }
    }

    /// Money held for a claim until its units are collected.
    pub fn claim_escrow(e: &Env, claim_id: u32) -> Option<ClaimEscrow> {
        e.storage().persistent().get(&DataKey::ClaimEscrow(claim_id))
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

    fn load_escrow(e: &Env, batch_id: u32) -> Option<Escrow> {
        e.storage().persistent().get(&DataKey::Escrow(batch_id))
    }

    fn escrow_or_panic(e: &Env, batch_id: u32) -> Escrow {
        Self::load_escrow(e, batch_id)
            .unwrap_or_else(|| panic_with_error!(e, BatchSharesError::NoEscrow))
    }

    fn save_escrow(e: &Env, batch_id: u32, escrow: &Escrow) {
        e.storage().persistent().set(&DataKey::Escrow(batch_id), escrow);
        keep_key(e, &DataKey::Escrow(batch_id));
    }

    fn claim_escrow_or_panic(e: &Env, claim_id: u32) -> ClaimEscrow {
        e.storage()
            .persistent()
            .get(&DataKey::ClaimEscrow(claim_id))
            .unwrap_or_else(|| panic_with_error!(e, BatchSharesError::ClaimNotFound))
    }

    /// Part of one share's price not yet paid to the producer: the inspection
    /// part until an inspector confirms the batch, plus the collection part.
    /// The upfront part is rounded down, the collection part takes the rest.
    fn held_per_share(offering: &Offering, escrow: &Escrow) -> i128 {
        let upfront = offering.price * escrow.upfront_bps / BPS;
        let inspection = offering.price * escrow.inspection_bps / BPS;
        let collection = offering.price - upfront - inspection;
        if escrow.inspected {
            collection
        } else {
            inspection + collection
        }
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
