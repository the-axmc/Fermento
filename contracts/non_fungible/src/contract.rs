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
//   inspector - independent party: attests that a batch exists and how many
//               units it holds, and may re-link its NFC tag once attested
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
    /// Producer account of a batch: may link its NFC tag.
    Producer(u32),
    /// NFC tag bound to a batch (sha256 of the tag serial), for tap-to-verify.
    Tag(u32),
    /// Reverse lookup: which batch a tag is bound to.
    TagBatch(BytesN<32>),
    /// Latest independent attestation of a batch.
    Attestation(u32),
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

/// An inspector's record that a batch exists. `units` caps how many units can
/// ever be sold against it; `evidence` is the sha256 of the inspection report
/// (photos, certificates, lab reference sample), kept off chain.
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Attestation {
    pub inspector: Address,
    pub units: u32,
    pub evidence: BytesN<32>,
    pub timestamp: u64,
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
    /// The caller is not the producer of this batch.
    NotProducer = 502,
    /// This tag is already bound to another batch.
    TagTaken = 503,
    /// The batch is attested and has a tag: only an inspector may re-link it.
    TagLocked = 504,
    /// An attestation must cover at least one unit.
    InvalidAttestation = 505,
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

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TagLinked {
    #[topic]
    pub batch_id: u32,
    pub producer: Address,
    pub tag: BytesN<32>,
}

#[contractevent]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BatchAttested {
    #[topic]
    pub batch_id: u32,
    pub inspector: Address,
    pub units: u32,
    pub evidence: BytesN<32>,
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
    // ---------- producer and NFC tag ----------

    /// Name the producer account of a batch, which may then bind an NFC tag.
    #[only_role(caller, "minter")]
    pub fn set_producer(e: &Env, batch_id: u32, producer: Address, caller: Address) {
        Base::owner_of(e, batch_id);
        e.storage().persistent().set(&BatchKey::Producer(batch_id), &producer);
        keep_key(e, &BatchKey::Producer(batch_id));
    }

    /// Bind a physical NFC tag to a batch. `tag` is the sha256 of the tag's
    /// serial number, so the chain never carries the raw serial. Authorized by
    /// the producer's own account. Re-linking replaces the previous tag, until
    /// an inspector attests the batch: from then on a linked tag is locked, so
    /// the producer cannot move it to another cask.
    pub fn link_tag(e: &Env, batch_id: u32, producer: Address, tag: BytesN<32>) {
        producer.require_auth();
        Base::owner_of(e, batch_id);
        let stored: Option<Address> = e.storage().persistent().get(&BatchKey::Producer(batch_id));
        if stored.as_ref() != Some(&producer) {
            panic_with_error!(e, BatchRegistryError::NotProducer);
        }
        if e.storage().persistent().has(&BatchKey::Attestation(batch_id))
            && e.storage().persistent().has(&BatchKey::Tag(batch_id))
        {
            panic_with_error!(e, BatchRegistryError::TagLocked);
        }
        Self::bind_tag(e, batch_id, tag.clone());
        TagLinked { batch_id, producer, tag }.publish(e);
    }

    /// Re-link the tag of a batch on the inspector's authority, e.g. when a
    /// tag is damaged and replaced during an inspection.
    #[only_role(caller, "inspector")]
    pub fn inspector_link_tag(e: &Env, batch_id: u32, tag: BytesN<32>, caller: Address) {
        Base::owner_of(e, batch_id);
        Self::bind_tag(e, batch_id, tag.clone());
        TagLinked { batch_id, producer: caller, tag }.publish(e);
    }

    // ---------- inspection ----------

    /// Record an independent inspection: the batch exists and holds `units`
    /// units. `batch_shares` refuses to sell more units than this. A later
    /// attestation replaces the earlier one (e.g. after regauging).
    #[only_role(caller, "inspector")]
    pub fn attest(e: &Env, batch_id: u32, units: u32, evidence: BytesN<32>, caller: Address) {
        Base::owner_of(e, batch_id);
        if units == 0 {
            panic_with_error!(e, BatchRegistryError::InvalidAttestation);
        }
        let record = Attestation {
            inspector: caller.clone(),
            units,
            evidence: evidence.clone(),
            timestamp: e.ledger().timestamp(),
        };
        e.storage().persistent().set(&BatchKey::Attestation(batch_id), &record);
        keep_key(e, &BatchKey::Attestation(batch_id));
        BatchAttested { batch_id, inspector: caller, units, evidence }.publish(e);
    }

    /// Latest attestation of a batch, if an inspector has visited it.
    pub fn attestation(e: &Env, batch_id: u32) -> Option<Attestation> {
        e.storage().persistent().get(&BatchKey::Attestation(batch_id))
    }

    pub fn producer(e: &Env, batch_id: u32) -> Option<Address> {
        e.storage().persistent().get(&BatchKey::Producer(batch_id))
    }

    /// Tag bound to a batch, if any.
    pub fn tag(e: &Env, batch_id: u32) -> Option<BytesN<32>> {
        e.storage().persistent().get(&BatchKey::Tag(batch_id))
    }

    /// Batch a tapped tag belongs to, for the verification page.
    pub fn batch_of_tag(e: &Env, tag: BytesN<32>) -> Option<u32> {
        e.storage().persistent().get(&BatchKey::TagBatch(tag))
    }

    // ---------- internals ----------

    /// Point `batch_id` at `tag`, freeing its previous tag. A tag bound to
    /// another batch is refused.
    fn bind_tag(e: &Env, batch_id: u32, tag: BytesN<32>) {
        if let Some(other) = e.storage().persistent().get::<_, u32>(&BatchKey::TagBatch(tag.clone())) {
            if other != batch_id {
                panic_with_error!(e, BatchRegistryError::TagTaken);
            }
        }
        if let Some(old) = e.storage().persistent().get::<_, BytesN<32>>(&BatchKey::Tag(batch_id)) {
            if old != tag {
                e.storage().persistent().remove(&BatchKey::TagBatch(old));
            }
        }
        e.storage().persistent().set(&BatchKey::Tag(batch_id), &tag);
        keep_key(e, &BatchKey::Tag(batch_id));
        e.storage().persistent().set(&BatchKey::TagBatch(tag.clone()), &batch_id);
        keep_key(e, &BatchKey::TagBatch(tag));
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
