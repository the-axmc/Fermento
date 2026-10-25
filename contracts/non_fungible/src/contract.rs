// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Stellar Soroban Contracts ^0.8.0
//
// Batch registry: one non-fungible token per physical batch. The platform holds
// the tokens; `batch_shares` issues the fungible shares that reference them.
//
// Roles (stellar-access AccessControl):
//   minter   - registers batches, sets metadata and lifecycle stages
//   redeemer - records unit claims (the batch_shares contract or an operator)
//   pauser   - emergency stop for transfers and burns
//   upgrader - replaces the contract code

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, panic_with_error, Address,
    BytesN, Env, IntoVal, String, Symbol, Val, Vec,
};
use stellar_access::access_control::{self as access_control, AccessControl};
use stellar_contract_utils::pausable::{self as pausable, Pausable};
use stellar_contract_utils::upgradeable::{self as upgradeable, Upgradeable};
use stellar_macros::{only_role, when_not_paused};
use stellar_tokens::non_fungible::{
    burnable::NonFungibleBurnable,
    enumerable::{Enumerable, NonFungibleEnumerable},
    Base, Compose, ContractOverrides, NonFungibleToken,
};

// ################## STORAGE ##################

#[contracttype]
pub enum BatchKey {
    /// Per-batch metadata URI, overrides the collection base URI when set.
    Uri(u32),
    /// Lifecycle stage of a batch: `filled`, `aging`, `mature`, `unitd`.
    Stage(u32),
    /// Units already claimed against a batch.
    Claimed(u32),
    /// A unit claim, keyed by its sequential id.
    Claim(u32),
    /// Number of claims recorded so far.
    ClaimCount,
}

/// A unit claim, verifiable from a QR code pointing at `claim_id`.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnitClaim {
    pub batch_id: u32,
    pub claimer: Address,
    pub units: u32,
    pub ledger: u32,
}

// ################## ERRORS ##################

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum BatchRegistryError {
    /// A claim must redeem at least one unit.
    ZeroUnits = 500,
    /// No claim exists with this id.
    ClaimNotFound = 501,
}

// ################## EVENTS ##################

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchRegistered {
    #[topic]
    pub batch_id: u32,
    pub owner: Address,
    pub uri: String,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchStageChanged {
    #[topic]
    pub batch_id: u32,
    pub stage: Symbol,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UnitsClaimed {
    #[topic]
    pub batch_id: u32,
    #[topic]
    pub claim_id: u32,
    pub claimer: Address,
    pub units: u32,
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
pub struct BatchRegistry;

#[contractimpl]
impl BatchRegistry {
    pub fn __constructor(
        e: &Env,
        admin: Address,
        pauser: Address,
        upgrader: Address,
        minter: Address,
    ) {
        let uri = String::from_str(e, "https://fermento.app/batch/");
        let name = String::from_str(e, "Fermento Batches");
        let symbol = String::from_str(e, "BATCH");
        Base::set_metadata(e, uri, name, symbol);
        access_control::set_admin(e, &admin);
        access_control::grant_role_no_auth(e, &pauser, &Symbol::new(e, "pauser"), &admin);
        access_control::grant_role_no_auth(e, &upgrader, &Symbol::new(e, "upgrader"), &admin);
        access_control::grant_role_no_auth(e, &minter, &Symbol::new(e, "minter"), &admin);
        // The minter also records claims until batch_shares is granted the role.
        access_control::grant_role_no_auth(e, &minter, &Symbol::new(e, "redeemer"), &admin);
    }

    /// Mint a batch token without metadata. Kept for the existing Home page.
    #[only_role(caller, "minter")]
    #[when_not_paused]
    pub fn mint(e: &Env, to: Address, token_id: u32, caller: Address) {
        <Self as NonFungibleToken>::ContractType::mint_with_id(e, &to, token_id);
    }

    /// Register a batch at fill: mint the token, store its metadata URI and set
    /// the stage to `filled`.
    #[only_role(caller, "minter")]
    #[when_not_paused]
    pub fn register_batch(e: &Env, to: Address, batch_id: u32, uri: String, caller: Address) {
        <Self as NonFungibleToken>::ContractType::mint_with_id(e, &to, batch_id);
        e.storage().persistent().set(&BatchKey::Uri(batch_id), &uri);
        keep_key(e, &BatchKey::Uri(batch_id));
        let stage = Symbol::new(e, "filled");
        e.storage().persistent().set(&BatchKey::Stage(batch_id), &stage);
        keep_key(e, &BatchKey::Stage(batch_id));
        BatchRegistered { batch_id, owner: to, uri }.publish(e);
        BatchStageChanged { batch_id, stage }.publish(e);
    }

    /// Replace the metadata URI of an existing batch.
    #[only_role(caller, "minter")]
    pub fn set_token_uri(e: &Env, batch_id: u32, uri: String, caller: Address) {
        // Panics with NonExistentToken when the batch was never minted.
        Base::owner_of(e, batch_id);
        e.storage().persistent().set(&BatchKey::Uri(batch_id), &uri);
        keep_key(e, &BatchKey::Uri(batch_id));
    }

    /// Move a batch to a new lifecycle stage and emit `BatchStageChanged`.
    #[only_role(caller, "minter")]
    pub fn set_stage(e: &Env, batch_id: u32, stage: Symbol, caller: Address) {
        Base::owner_of(e, batch_id);
        e.storage().persistent().set(&BatchKey::Stage(batch_id), &stage);
        keep_key(e, &BatchKey::Stage(batch_id));
        BatchStageChanged { batch_id, stage }.publish(e);
    }

    /// Current stage of a batch, `None` for tokens minted without `register_batch`.
    pub fn stage(e: &Env, batch_id: u32) -> Option<Symbol> {
        e.storage().persistent().get(&BatchKey::Stage(batch_id))
    }

    /// Record that `claimer` redeemed `units` from a batch. Returns the claim
    /// id that goes on the unit label QR code.
    #[only_role(caller, "redeemer")]
    #[when_not_paused]
    pub fn claim(e: &Env, batch_id: u32, claimer: Address, units: u32, caller: Address) -> u32 {
        if units == 0 {
            panic_with_error!(e, BatchRegistryError::ZeroUnits);
        }
        Base::owner_of(e, batch_id);

        let claim_id: u32 = e.storage().instance().get(&BatchKey::ClaimCount).unwrap_or(0) + 1;
        e.storage().instance().set(&BatchKey::ClaimCount, &claim_id);

        let claimed: u32 = e.storage().persistent().get(&BatchKey::Claimed(batch_id)).unwrap_or(0);
        e.storage().persistent().set(&BatchKey::Claimed(batch_id), &(claimed + units));
        keep_key(e, &BatchKey::Claimed(batch_id));

        let record = UnitClaim { batch_id, claimer: claimer.clone(), units, ledger: e.ledger().sequence() };
        e.storage().persistent().set(&BatchKey::Claim(claim_id), &record);
        keep_key(e, &BatchKey::Claim(claim_id));

        UnitsClaimed { batch_id, claim_id, claimer, units }.publish(e);
        claim_id
    }

    /// Look up a claim by id, for the warehouse verification page.
    pub fn get_claim(e: &Env, claim_id: u32) -> UnitClaim {
        e.storage()
            .persistent()
            .get(&BatchKey::Claim(claim_id))
            .unwrap_or_else(|| panic_with_error!(e, BatchRegistryError::ClaimNotFound))
    }

    /// Total units claimed against a batch.
    pub fn claimed_units(e: &Env, batch_id: u32) -> u32 {
        e.storage().persistent().get(&BatchKey::Claimed(batch_id)).unwrap_or(0)
    }
}

// ################## TOKEN ##################

#[contractimpl(contracttrait)]
impl NonFungibleToken for BatchRegistry {
    type ContractType = Compose<(Enumerable,)>;

    #[when_not_paused]
    fn transfer(e: &Env, from: Address, to: Address, token_id: u32) {
        Self::ContractType::transfer(e, &from, &to, token_id);
    }

    #[when_not_paused]
    fn transfer_from(e: &Env, spender: Address, from: Address, to: Address, token_id: u32) {
        Self::ContractType::transfer_from(e, &spender, &from, &to, token_id);
    }

    /// Per-batch URI when one was registered, otherwise `base_uri + token_id`.
    fn token_uri(e: &Env, token_id: u32) -> String {
        match e.storage().persistent().get::<_, String>(&BatchKey::Uri(token_id)) {
            Some(uri) => uri,
            None => Self::ContractType::token_uri(e, token_id),
        }
    }
}

#[contractimpl(contracttrait)]
impl NonFungibleEnumerable for BatchRegistry {}

#[contractimpl(contracttrait)]
impl NonFungibleBurnable for BatchRegistry {
    #[when_not_paused]
    fn burn(e: &Env, from: Address, token_id: u32) {
        Self::ContractType::burn(e, &from, token_id);
    }

    #[when_not_paused]
    fn burn_from(e: &Env, spender: Address, from: Address, token_id: u32) {
        Self::ContractType::burn_from(e, &spender, &from, token_id);
    }
}

// ################## UTILS ##################

#[contractimpl]
impl Upgradeable for BatchRegistry {
    #[only_role(operator, "upgrader")]
    fn upgrade(e: &Env, new_wasm_hash: BytesN<32>, operator: Address) {
        upgradeable::upgrade(e, &new_wasm_hash);
    }
}

#[contractimpl]
impl Pausable for BatchRegistry {
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
impl AccessControl for BatchRegistry {}
