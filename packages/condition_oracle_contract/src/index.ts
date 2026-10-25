import { Buffer } from "buffer";
import { Address } from "@stellar/stellar-sdk";
import {
  AssembledTransaction,
  Client as ContractClient,
  ClientOptions as ContractClientOptions,
  MethodOptions,
  Result,
  Spec as ContractSpec,
} from "@stellar/stellar-sdk/contract";
import type {
  u32,
  i32,
  u64,
  i64,
  u128,
  i128,
  u256,
  i256,
  Option,
  Timepoint,
  Duration,
} from "@stellar/stellar-sdk/contract";
export * from "@stellar/stellar-sdk";
export * as contract from "@stellar/stellar-sdk/contract";
export * as rpc from "@stellar/stellar-sdk/rpc";

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}





/**
 * Running care figures of a batch.
 */
export interface Care {
  /**
 * Bonus earned so far, before decay, in bps.
 */
bonus_bps: i128;
  count: u32;
  last_timestamp: u64;
}


export interface Mark {
  age_bps: i128;
  condition_bps: i128;
  fee_per_share: i128;
  timestamp: u64;
  value: i128;
}


export interface Stats {
  in_range: u32;
  last_humidity: u32;
  last_temp_c: i32;
  /**
 * Timestamp of the last accepted reading, 0 when none.
 */
last_timestamp: u64;
  total: u32;
}


/**
 * The platform's view of the company behind a batch.
 */
export interface Rating {
  /**
 * Verified as a registered company by the platform.
 */
certified: boolean;
  /**
 * Multiplier in bps: market value of the producer. 10_000 is neutral.
 */
index_bps: i128;
  updated_at: u64;
}


/**
 * A producer's update on a batch: a lab reading, a tasting note, a photo, a
 * racking. Shown to holders and feeding the care multiplier.
 */
export interface Checkin {
  /**
 * Care bonus this check-in earned, in bps.
 */
bonus_bps: i128;
  /**
 * `lab`, `tasting`, `started`, `photo`, `racking`, `other`...
 */
kind: string;
  note: string;
  poster: string;
  /**
 * How good the care was, 0 to 100, as reported by the producer.
 */
score: u32;
  timestamp: u64;
}


/**
 * One sensor reading. The signed payload is the 52-byte big-endian
 * concatenation `oracle_contract_id:[u8;32] | batch_id:u32 | timestamp:u64 |
 * temp_c:i32 | humidity:u32`.
 */
export interface Reading {
  batch_id: u32;
  /**
 * Relative humidity in basis points.
 */
humidity: u32;
  /**
 * Hundredths of a degree Celsius.
 */
temp_c: i32;
  timestamp: u64;
}


/**
 * Every factor of the current mark, for the producer page.
 */
export interface Breakdown {
  age_bps: i128;
  care_bps: i128;
  checkins: u32;
  condition_bps: i128;
  fee_per_share: i128;
  producer_bps: i128;
  timestamp: u64;
  value: i128;
}



/**
 * Terms the oracle needs to value a batch.
 */
export interface BatchConfig {
  batch_id: u32;
  /**
 * Age curve key, e.g. `moscatel`, `port`, `cheddar`.
 */
category: string;
  /**
 * Storage fee per share per day, mirrors batch_shares.
 */
fee_per_share_day: i128;
  /**
 * Issue price per share.
 */
fill_price: i128;
  filled_at: u64;
  humidity_max: u32;
  /**
 * Acceptable relative humidity band, in basis points.
 */
humidity_min: u32;
  /**
 * ed25519 public key of the cellar sensor allowed to post readings.
 */
sensor: Buffer;
  temp_max: i32;
  /**
 * Acceptable temperature band, in hundredths of a degree Celsius.
 */
temp_min: i32;
}

export const OracleError = {
  700: {message:"BatchExists"},
  701: {message:"BatchNotFound"},
  702: {message:"CurveNotFound"},
  703: {message:"InvalidCurve"},
  704: {message:"InvalidTerms"},
  /**
   * Reading is older than or equal to the last accepted one.
   */
  705: {message:"StaleReading"},
  /**
   * Reading is stamped too far in the future.
   */
  706: {message:"FutureReading"},
  /**
   * Reading is for another batch than the one addressed.
   */
  707: {message:"BatchMismatch"},
  /**
   * The caller is not the producer of this batch.
   */
  708: {message:"NotProducer"},
  /**
   * A check-in score must be 0 to 100.
   */
  709: {message:"InvalidScore"},
  /**
   * A check-in note is longer than MAX_NOTE_LEN bytes.
   */
  710: {message:"NoteTooLong"},
  /**
   * A rating is outside the allowed band.
   */
  711: {message:"InvalidRating"}
}




export const RoleTransferError = {
  2200: {message:"NoPendingTransfer"},
  2201: {message:"InvalidLiveUntilLedger"},
  2202: {message:"InvalidPendingAccount"},
  2203: {message:"TransferExpired"}
}





export const AccessControlError = {
  2000: {message:"Unauthorized"},
  2001: {message:"AdminNotSet"},
  2002: {message:"IndexOutOfBounds"},
  2003: {message:"AdminRoleNotFound"},
  2004: {message:"RoleCountIsNotZero"},
  2005: {message:"RoleNotFound"},
  2006: {message:"AdminAlreadySet"},
  2007: {message:"RoleNotHeld"},
  2008: {message:"RoleIsEmpty"},
  2009: {message:"TransferInProgress"},
  2010: {message:"MaxRolesExceeded"}
}



export interface Client {
  /**
   * Construct and simulate a mark transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current reference value of one share, computed from storage.
   */
  mark: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Mark>>

  /**
   * Construct and simulate a batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  batch: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<BatchConfig>>

  /**
   * Construct and simulate a curve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  curve: ({category}: {category: string}, options?: MethodOptions) => Promise<AssembledTransaction<Array<u32>>>

  /**
   * Construct and simulate a rating transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rating of a producer, if the platform has set one.
   */
  rating: ({producer}: {producer: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Rating>>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash, operator}: {new_wasm_hash: Buffer, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a checkins transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Check-ins of a batch, oldest first.
   */
  checkins: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Checkin>>>

  /**
   * Construct and simulate a get_care transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_care: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Care>>

  /**
   * Construct and simulate a has_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `Some(index)` if the account has the specified role,
   * where `index` is the position of the account for that role,
   * and can be used to query [`AccessControl::get_role_member()`].
   * Returns `None` if the account does not have the specified role.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to check.
   * * `role` - The role to check for.
   */
  has_role: ({account, role}: {account: string, role: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a producer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Account allowed to post check-ins for a batch, if one was set.
   */
  producer: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a breakdown transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The mark and every factor behind it.
   */
  breakdown: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Breakdown>>

  /**
   * Construct and simulate a get_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin account.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   */
  get_admin: (options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_stats transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_stats: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Stats>>

  /**
   * Construct and simulate a set_curve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Store the age curve of a category: multiplier in basis points for
   * month 0, 1, 2, ... since fill. The last point holds afterwards.
   */
  set_curve: ({category, points, caller}: {category: string, points: Array<u32>, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a grant_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Grants a role to an account.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to grant the role to.
   * * `role` - The role to grant.
   * * `caller` - The address of the caller, must be the admin or have the
   * `RoleAdmin` for the `role`.
   * 
   * # Errors
   * 
   * * [`AccessControlError::Unauthorized`] - If the caller does not have
   * enough privileges.
   * * [`AccessControlError::MaxRolesExceeded`] - If adding a new role would
   * exceed the maximum allowed number of roles.
   * 
   * # Events
   * 
   * * topics - `["role_granted", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  grant_role: ({account, role, caller}: {account: string, role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_rating transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rate a producer: `index_bps` is the platform's view of the company's
   * market value (certification, sales traction, track record), applied to
   * every batch it produces. 10_000 is neutral.
   */
  set_rating: ({producer, index_bps, certified, caller}: {producer: string, index_bps: i128, certified: boolean, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_sensor transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Rotate the sensor key of a batch.
   */
  set_sensor: ({batch_id, sensor, caller}: {batch_id: u32, sensor: Buffer, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a revoke_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes a role from an account.
   * To revoke the caller's own role, use
   * [`AccessControl::renounce_role()`] instead.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `account` - The account to revoke the role from.
   * * `role` - The role to revoke.
   * * `caller` - The address of the caller, must be the admin or has the
   * `RoleAdmin` for the `role`.
   * 
   * # Errors
   * 
   * * [`AccessControlError::Unauthorized`] - If the `caller` does not have
   * enough privileges.
   * * [`AccessControlError::RoleNotHeld`] - If the `account` doesn't have
   * the role.
   * * [`AccessControlError::RoleIsEmpty`] - If the role has no members.
   * 
   * # Events
   * 
   * * topics - `["role_revoked", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  revoke_role: ({account, role, caller}: {account: string, role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a mark_history transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Stored marks, oldest first.
   */
  mark_history: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Array<Mark>>>

  /**
   * Construct and simulate a post_checkin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The producer of a batch posts an update. Authorized by the producer's
   * own account (the address the curator set with `set_producer`). It is
   * kept for holders and keeps the care bonus from decaying, but earns no
   * bonus itself. Returns the care multiplier now in force.
   */
  post_checkin: ({batch_id, poster, kind, note, score}: {batch_id: u32, poster: string, kind: string, note: string, score: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a post_reading transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Post a sensor reading. Anyone may relay it; the signature by the
   * batch's sensor key is what authorizes it.
   */
  post_reading: ({batch_id, reading, signature}: {batch_id: u32, reading: Reading, signature: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a publish_mark transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Compute the mark now, store it in the batch's history and emit it.
   * Permissionless so a cron or the relayer can post one per epoch. Within
   * MIN_MARK_INTERVAL of the last stored mark it only returns the mark.
   */
  publish_mark: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Mark>>

  /**
   * Construct and simulate a set_producer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Name the account that may post check-ins for a batch.
   */
  set_producer: ({batch_id, producer, caller}: {batch_id: u32, producer: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a renounce_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows an account to renounce a role assigned to itself.
   * Users can only renounce roles for their own account.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to renounce.
   * * `caller` - The address of the caller, must be the account that has the
   * role.
   * 
   * # Errors
   * 
   * * [`AccessControlError::RoleNotHeld`] - If the `caller` doesn't have the
   * role.
   * * [`AccessControlError::RoleIsEmpty`] - If the role has no members.
   * 
   * # Events
   * 
   * * topics - `["role_revoked", role: Symbol, account: Address]`
   * * data - `[caller: Address]`
   */
  renounce_role: ({role, caller}: {role: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the admin role for a specific role.
   * If no admin role is explicitly set, returns `None`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query the admin role for.
   */
  get_role_admin: ({role}: {role: string}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a register_batch transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  register_batch: ({config, caller}: {config: BatchConfig, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a renounce_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Allows the current admin to renounce their role, making the contract
   * permanently admin-less. This is useful for decentralization purposes
   * or when the admin role is no longer needed. Once the admin is
   * renounced, it cannot be reinstated.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Errors
   * 
   * * [`AccessControlError::AdminNotSet`] - If no admin account is set.
   * 
   * # Events
   * 
   * * topics - `["admin_renounced", admin: Address]`
   * * data - `[]`
   * 
   * # Notes
   * 
   * * Authorization for the current admin is required.
   */
  renounce_admin: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_role_admin transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sets `admin_role` as the admin role of `role`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to set the admin for.
   * * `admin_role` - The new admin role.
   * 
   * # Events
   * 
   * * topics - `["role_admin_changed", role: Symbol]`
   * * data - `[previous_admin_role: Symbol, new_admin_role: Symbol]`
   * 
   * # Errors
   * 
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   * 
   * # Notes
   * 
   * * Authorization for the current admin is required.
   */
  set_role_admin: ({role, admin_role}: {role: string, admin_role: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_member transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account at the specified index for a given role.
   * 
   * A function to get all members of a role is not provided because that
   * would be unbounded. To enumerate all members of a role, use
   * [`AccessControl::get_role_member_count()`] to get the total number of
   * members and then use [`AccessControl::get_role_member()`] to retrieve
   * each member one by one.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to query.
   * * `index` - The index of the account to retrieve.
   * 
   * # Errors
   * 
   * * [`AccessControlError::IndexOutOfBounds`] - If the index is out of
   * bounds for the role's member list.
   */
  get_role_member: ({role, index}: {role: string, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a post_inspection transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * An inspector reports a visit. A perfect visit (score 100) earns
   * INSPECTION_BONUS_BPS, scaled by `score` and capped overall at
   * MAX_CARE_BONUS_BPS. Returns the care multiplier now in force.
   */
  post_inspection: ({batch_id, kind, note, score, caller}: {batch_id: u32, kind: string, note: string, score: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a reading_payload transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The exact bytes a sensor signs for `reading`. Starts with this
   * contract's id, so a reading cannot be replayed on another deployment.
   */
  reading_payload: ({reading}: {reading: Reading}, options?: MethodOptions) => Promise<AssembledTransaction<Buffer>>

  /**
   * Construct and simulate a get_existing_roles transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns a vector containing all existing roles.
   * Defaults to empty vector if no roles exist.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Notes
   * 
   * This function returns all roles that currently have at least one member.
   * The maximum number of roles is limited by [`MAX_ROLES`].
   */
  get_existing_roles: (options?: MethodOptions) => Promise<AssembledTransaction<Array<string>>>

  /**
   * Construct and simulate a transfer_admin_role transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Initiates the admin role transfer.
   * Admin privileges for the current admin are not revoked until the
   * recipient accepts the transfer.
   * Overrides the previous pending transfer if there is one.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `new_admin` - The account to transfer the admin privileges to.
   * * `live_until_ledger` - The ledger number at which the pending transfer
   * expires. If `live_until_ledger` is `0`, the pending transfer is
   * cancelled. `live_until_ledger` argument is implicitly bounded by the
   * maximum allowed TTL extension for a temporary storage entry and
   * specifying a higher value will cause the code to panic.
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * trying to cancel a transfer that doesn't exist.
   * * [`crate::role_transfer::RoleTransferError::InvalidLiveUntilLedger`] -
   * If the specified ledger is in the past.
   * * [`crate::role_transfer::RoleTransferError::InvalidPendingAccount`] -
   * If the specified pending account is not the same as the provided `new`
   * address.
   * 
   */
  transfer_admin_role: ({new_admin, live_until_ledger}: {new_admin: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a accept_admin_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Completes the 2-step admin transfer.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * 
   * # Events
   * 
   * * topics - `["admin_transfer_completed", new_admin: Address]`
   * * data - `[previous_admin: Address]`
   * 
   * # Errors
   * 
   * * [`crate::role_transfer::RoleTransferError::NoPendingTransfer`] - If
   * there is no pending transfer to accept.
   * * [`AccessControlError::AdminNotSet`] - If admin account is not set.
   */
  accept_admin_transfer: (options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_role_member_count transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total number of accounts that have the specified role.
   * If the role does not exist, returns 0.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `role` - The role to get the count for.
   */
  get_role_member_count: ({role}: {role: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {admin, curator}: {admin: string, curator: string},
    /** Options for initializing a Client as well as for calling a method, with extras specific to deploying. */
    options: MethodOptions &
      Omit<ContractClientOptions, "contractId"> & {
        /** The hash of the Wasm blob, which must already be installed on-chain. */
        wasmHash: Buffer | string;
        /** Salt used to generate the contract's ID. Passed through to {@link Operation.createCustomContract}. Default: random. */
        salt?: Buffer | Uint8Array;
        /** The format used to decode `wasmHash`, if it's provided as a string. */
        format?: "hex" | "base64";
      }
  ): Promise<AssembledTransaction<T>> {
    return ContractClient.deploy({admin, curator}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAACBSdW5uaW5nIGNhcmUgZmlndXJlcyBvZiBhIGJhdGNoLgAAAAAAAAAEQ2FyZQAAAAMAAAAqQm9udXMgZWFybmVkIHNvIGZhciwgYmVmb3JlIGRlY2F5LCBpbiBicHMuAAAAAAAJYm9udXNfYnBzAAAAAAAACwAAAAAAAAAFY291bnQAAAAAAAAEAAAAAAAAAA5sYXN0X3RpbWVzdGFtcAAAAAAABg==",
        "AAAAAQAAAAAAAAAAAAAABE1hcmsAAAAFAAAAAAAAAAdhZ2VfYnBzAAAAAAsAAAAAAAAADWNvbmRpdGlvbl9icHMAAAAAAAALAAAAAAAAAA1mZWVfcGVyX3NoYXJlAAAAAAAACwAAAAAAAAAJdGltZXN0YW1wAAAAAAAABgAAAAAAAAAFdmFsdWUAAAAAAAAL",
        "AAAAAQAAAAAAAAAAAAAABVN0YXRzAAAAAAAABQAAAAAAAAAIaW5fcmFuZ2UAAAAEAAAAAAAAAA1sYXN0X2h1bWlkaXR5AAAAAAAABAAAAAAAAAALbGFzdF90ZW1wX2MAAAAABQAAADRUaW1lc3RhbXAgb2YgdGhlIGxhc3QgYWNjZXB0ZWQgcmVhZGluZywgMCB3aGVuIG5vbmUuAAAADmxhc3RfdGltZXN0YW1wAAAAAAAGAAAAAAAAAAV0b3RhbAAAAAAAAAQ=",
        "AAAAAQAAADJUaGUgcGxhdGZvcm0ncyB2aWV3IG9mIHRoZSBjb21wYW55IGJlaGluZCBhIGJhdGNoLgAAAAAAAAAAAAZSYXRpbmcAAAAAAAMAAAAxVmVyaWZpZWQgYXMgYSByZWdpc3RlcmVkIGNvbXBhbnkgYnkgdGhlIHBsYXRmb3JtLgAAAAAAAAljZXJ0aWZpZWQAAAAAAAABAAAAQ011bHRpcGxpZXIgaW4gYnBzOiBtYXJrZXQgdmFsdWUgb2YgdGhlIHByb2R1Y2VyLiAxMF8wMDAgaXMgbmV1dHJhbC4AAAAACWluZGV4X2JwcwAAAAAAAAsAAAAAAAAACnVwZGF0ZWRfYXQAAAAAAAY=",
        "AAAAAQAAAIRBIHByb2R1Y2VyJ3MgdXBkYXRlIG9uIGEgYmF0Y2g6IGEgbGFiIHJlYWRpbmcsIGEgdGFzdGluZyBub3RlLCBhIHBob3RvLCBhCnJhY2tpbmcuIFNob3duIHRvIGhvbGRlcnMgYW5kIGZlZWRpbmcgdGhlIGNhcmUgbXVsdGlwbGllci4AAAAAAAAAB0NoZWNraW4AAAAABgAAAChDYXJlIGJvbnVzIHRoaXMgY2hlY2staW4gZWFybmVkLCBpbiBicHMuAAAACWJvbnVzX2JwcwAAAAAAAAsAAAA7YGxhYmAsIGB0YXN0aW5nYCwgYHN0YXJ0ZWRgLCBgcGhvdG9gLCBgcmFja2luZ2AsIGBvdGhlcmAuLi4AAAAABGtpbmQAAAARAAAAAAAAAARub3RlAAAAEAAAAAAAAAAGcG9zdGVyAAAAAAATAAAAPUhvdyBnb29kIHRoZSBjYXJlIHdhcywgMCB0byAxMDAsIGFzIHJlcG9ydGVkIGJ5IHRoZSBwcm9kdWNlci4AAAAAAAAFc2NvcmUAAAAAAAAEAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAAKdPbmUgc2Vuc29yIHJlYWRpbmcuIFRoZSBzaWduZWQgcGF5bG9hZCBpcyB0aGUgNTItYnl0ZSBiaWctZW5kaWFuCmNvbmNhdGVuYXRpb24gYG9yYWNsZV9jb250cmFjdF9pZDpbdTg7MzJdIHwgYmF0Y2hfaWQ6dTMyIHwgdGltZXN0YW1wOnU2NCB8CnRlbXBfYzppMzIgfCBodW1pZGl0eTp1MzJgLgAAAAAAAAAAB1JlYWRpbmcAAAAABAAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAIlJlbGF0aXZlIGh1bWlkaXR5IGluIGJhc2lzIHBvaW50cy4AAAAAAAhodW1pZGl0eQAAAAQAAAAfSHVuZHJlZHRocyBvZiBhIGRlZ3JlZSBDZWxzaXVzLgAAAAAGdGVtcF9jAAAAAAAFAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAG",
        "AAAAAQAAADhFdmVyeSBmYWN0b3Igb2YgdGhlIGN1cnJlbnQgbWFyaywgZm9yIHRoZSBwcm9kdWNlciBwYWdlLgAAAAAAAAAJQnJlYWtkb3duAAAAAAAACAAAAAAAAAAHYWdlX2JwcwAAAAALAAAAAAAAAAhjYXJlX2JwcwAAAAsAAAAAAAAACGNoZWNraW5zAAAABAAAAAAAAAANY29uZGl0aW9uX2JwcwAAAAAAAAsAAAAAAAAADWZlZV9wZXJfc2hhcmUAAAAAAAALAAAAAAAAAAxwcm9kdWNlcl9icHMAAAALAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAV2YWx1ZQAAAAAAAAs=",
        "AAAABQAAAAAAAAAAAAAACVJhdGluZ1NldAAAAAAAAAEAAAAKcmF0aW5nX3NldAAAAAAAAwAAAAAAAAAIcHJvZHVjZXIAAAATAAAAAQAAAAAAAAAJaW5kZXhfYnBzAAAAAAAACwAAAAAAAAAAAAAACWNlcnRpZmllZAAAAAAAAAEAAAAAAAAAAg==",
        "AAAAAQAAAChUZXJtcyB0aGUgb3JhY2xlIG5lZWRzIHRvIHZhbHVlIGEgYmF0Y2guAAAAAAAAAAtCYXRjaENvbmZpZwAAAAAKAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAyQWdlIGN1cnZlIGtleSwgZS5nLiBgbW9zY2F0ZWxgLCBgcG9ydGAsIGBjaGVkZGFyYC4AAAAAAAhjYXRlZ29yeQAAABEAAAA0U3RvcmFnZSBmZWUgcGVyIHNoYXJlIHBlciBkYXksIG1pcnJvcnMgYmF0Y2hfc2hhcmVzLgAAABFmZWVfcGVyX3NoYXJlX2RheQAAAAAAAAsAAAAWSXNzdWUgcHJpY2UgcGVyIHNoYXJlLgAAAAAACmZpbGxfcHJpY2UAAAAAAAsAAAAAAAAACWZpbGxlZF9hdAAAAAAAAAYAAAAAAAAADGh1bWlkaXR5X21heAAAAAQAAAAzQWNjZXB0YWJsZSByZWxhdGl2ZSBodW1pZGl0eSBiYW5kLCBpbiBiYXNpcyBwb2ludHMuAAAAAAxodW1pZGl0eV9taW4AAAAEAAAAQWVkMjU1MTkgcHVibGljIGtleSBvZiB0aGUgY2VsbGFyIHNlbnNvciBhbGxvd2VkIHRvIHBvc3QgcmVhZGluZ3MuAAAAAAAABnNlbnNvcgAAAAAD7gAAACAAAAAAAAAACHRlbXBfbWF4AAAABQAAAD9BY2NlcHRhYmxlIHRlbXBlcmF0dXJlIGJhbmQsIGluIGh1bmRyZWR0aHMgb2YgYSBkZWdyZWUgQ2Vsc2l1cy4AAAAACHRlbXBfbWluAAAABQ==",
        "AAAABAAAAAAAAAAAAAAAC09yYWNsZUVycm9yAAAAAAwAAAAAAAAAC0JhdGNoRXhpc3RzAAAAArwAAAAAAAAADUJhdGNoTm90Rm91bmQAAAAAAAK9AAAAAAAAAA1DdXJ2ZU5vdEZvdW5kAAAAAAACvgAAAAAAAAAMSW52YWxpZEN1cnZlAAACvwAAAAAAAAAMSW52YWxpZFRlcm1zAAACwAAAADhSZWFkaW5nIGlzIG9sZGVyIHRoYW4gb3IgZXF1YWwgdG8gdGhlIGxhc3QgYWNjZXB0ZWQgb25lLgAAAAxTdGFsZVJlYWRpbmcAAALBAAAAKVJlYWRpbmcgaXMgc3RhbXBlZCB0b28gZmFyIGluIHRoZSBmdXR1cmUuAAAAAAAADUZ1dHVyZVJlYWRpbmcAAAAAAALCAAAANFJlYWRpbmcgaXMgZm9yIGFub3RoZXIgYmF0Y2ggdGhhbiB0aGUgb25lIGFkZHJlc3NlZC4AAAANQmF0Y2hNaXNtYXRjaAAAAAAAAsMAAAAtVGhlIGNhbGxlciBpcyBub3QgdGhlIHByb2R1Y2VyIG9mIHRoaXMgYmF0Y2guAAAAAAAAC05vdFByb2R1Y2VyAAAAAsQAAAAiQSBjaGVjay1pbiBzY29yZSBtdXN0IGJlIDAgdG8gMTAwLgAAAAAADEludmFsaWRTY29yZQAAAsUAAAAyQSBjaGVjay1pbiBub3RlIGlzIGxvbmdlciB0aGFuIE1BWF9OT1RFX0xFTiBieXRlcy4AAAAAAAtOb3RlVG9vTG9uZwAAAALGAAAAJUEgcmF0aW5nIGlzIG91dHNpZGUgdGhlIGFsbG93ZWQgYmFuZC4AAAAAAAANSW52YWxpZFJhdGluZwAAAAAAAsc=",
        "AAAAAAAAADxDdXJyZW50IHJlZmVyZW5jZSB2YWx1ZSBvZiBvbmUgc2hhcmUsIGNvbXB1dGVkIGZyb20gc3RvcmFnZS4AAAAEbWFyawAAAAEAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAfQAAAABE1hcms=",
        "AAAAAAAAAAAAAAAFYmF0Y2gAAAAAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAH0AAAAAtCYXRjaENvbmZpZwA=",
        "AAAAAAAAAAAAAAAFY3VydmUAAAAAAAABAAAAAAAAAAhjYXRlZ29yeQAAABEAAAABAAAD6gAAAAQ=",
        "AAAABQAAAAAAAAAAAAAADUNoZWNraW5Qb3N0ZWQAAAAAAAABAAAADmNoZWNraW5fcG9zdGVkAAAAAAAGAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAZwb3N0ZXIAAAAAABMAAAABAAAAAAAAAARraW5kAAAAEQAAAAAAAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAAAAAACXRpbWVzdGFtcAAAAAAAAAYAAAAAAAAAAAAAAAlib251c19icHMAAAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADU1hcmtQdWJsaXNoZWQAAAAAAAABAAAADm1hcmtfcHVibGlzaGVkAAAAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAV2YWx1ZQAAAAAAAAsAAAAAAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADVJlYWRpbmdQb3N0ZWQAAAAAAAABAAAADnJlYWRpbmdfcG9zdGVkAAAAAAAFAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAl0aW1lc3RhbXAAAAAAAAAGAAAAAAAAAAAAAAAGdGVtcF9jAAAAAAAFAAAAAAAAAAAAAAAIaHVtaWRpdHkAAAAEAAAAAAAAAAAAAAAIaW5fcmFuZ2UAAAABAAAAAAAAAAI=",
        "AAAAAAAAADJSYXRpbmcgb2YgYSBwcm9kdWNlciwgaWYgdGhlIHBsYXRmb3JtIGhhcyBzZXQgb25lLgAAAAAABnJhdGluZwAAAAAAAQAAAAAAAAAIcHJvZHVjZXIAAAATAAAAAQAAA+gAAAfQAAAABlJhdGluZwAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAACNDaGVjay1pbnMgb2YgYSBiYXRjaCwgb2xkZXN0IGZpcnN0LgAAAAAIY2hlY2tpbnMAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAD6gAAB9AAAAAHQ2hlY2tpbgA=",
        "AAAAAAAAAAAAAAAIZ2V0X2NhcmUAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAH0AAAAARDYXJl",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAAAD5BY2NvdW50IGFsbG93ZWQgdG8gcG9zdCBjaGVjay1pbnMgZm9yIGEgYmF0Y2gsIGlmIG9uZSB3YXMgc2V0LgAAAAAACHByb2R1Y2VyAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAA+gAAAAT",
        "AAAAAAAAACRUaGUgbWFyayBhbmQgZXZlcnkgZmFjdG9yIGJlaGluZCBpdC4AAAAJYnJlYWtkb3duAAAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAB9AAAAAJQnJlYWtkb3duAAAA",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAAAAAAAJZ2V0X3N0YXRzAAAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAB9AAAAAFU3RhdHMAAAA=",
        "AAAAAAAAAIFTdG9yZSB0aGUgYWdlIGN1cnZlIG9mIGEgY2F0ZWdvcnk6IG11bHRpcGxpZXIgaW4gYmFzaXMgcG9pbnRzIGZvcgptb250aCAwLCAxLCAyLCAuLi4gc2luY2UgZmlsbC4gVGhlIGxhc3QgcG9pbnQgaG9sZHMgYWZ0ZXJ3YXJkcy4AAAAAAAAJc2V0X2N1cnZlAAAAAAAAAwAAAAAAAAAIY2F0ZWdvcnkAAAARAAAAAAAAAAZwb2ludHMAAAAAA+oAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAALdSYXRlIGEgcHJvZHVjZXI6IGBpbmRleF9icHNgIGlzIHRoZSBwbGF0Zm9ybSdzIHZpZXcgb2YgdGhlIGNvbXBhbnkncwptYXJrZXQgdmFsdWUgKGNlcnRpZmljYXRpb24sIHNhbGVzIHRyYWN0aW9uLCB0cmFjayByZWNvcmQpLCBhcHBsaWVkIHRvCmV2ZXJ5IGJhdGNoIGl0IHByb2R1Y2VzLiAxMF8wMDAgaXMgbmV1dHJhbC4AAAAACnNldF9yYXRpbmcAAAAAAAQAAAAAAAAACHByb2R1Y2VyAAAAEwAAAAAAAAAJaW5kZXhfYnBzAAAAAAAACwAAAAAAAAAJY2VydGlmaWVkAAAAAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAACFSb3RhdGUgdGhlIHNlbnNvciBrZXkgb2YgYSBiYXRjaC4AAAAAAAAKc2V0X3NlbnNvcgAAAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAZzZW5zb3IAAAAAA+4AAAAgAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAABtTdG9yZWQgbWFya3MsIG9sZGVzdCBmaXJzdC4AAAAADG1hcmtfaGlzdG9yeQAAAAEAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAPqAAAH0AAAAARNYXJr",
        "AAAAAAAAAQhUaGUgcHJvZHVjZXIgb2YgYSBiYXRjaCBwb3N0cyBhbiB1cGRhdGUuIEF1dGhvcml6ZWQgYnkgdGhlIHByb2R1Y2VyJ3MKb3duIGFjY291bnQgKHRoZSBhZGRyZXNzIHRoZSBjdXJhdG9yIHNldCB3aXRoIGBzZXRfcHJvZHVjZXJgKS4gSXQgaXMKa2VwdCBmb3IgaG9sZGVycyBhbmQga2VlcHMgdGhlIGNhcmUgYm9udXMgZnJvbSBkZWNheWluZywgYnV0IGVhcm5zIG5vCmJvbnVzIGl0c2VsZi4gUmV0dXJucyB0aGUgY2FyZSBtdWx0aXBsaWVyIG5vdyBpbiBmb3JjZS4AAAAMcG9zdF9jaGVja2luAAAABQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAZwb3N0ZXIAAAAAABMAAAAAAAAABGtpbmQAAAARAAAAAAAAAARub3RlAAAAEAAAAAAAAAAFc2NvcmUAAAAAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAGpQb3N0IGEgc2Vuc29yIHJlYWRpbmcuIEFueW9uZSBtYXkgcmVsYXkgaXQ7IHRoZSBzaWduYXR1cmUgYnkgdGhlCmJhdGNoJ3Mgc2Vuc29yIGtleSBpcyB3aGF0IGF1dGhvcml6ZXMgaXQuAAAAAAAMcG9zdF9yZWFkaW5nAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAdyZWFkaW5nAAAAB9AAAAAHUmVhZGluZwAAAAAAAAAACXNpZ25hdHVyZQAAAAAAA+4AAABAAAAAAQAAAAE=",
        "AAAAAAAAAM1Db21wdXRlIHRoZSBtYXJrIG5vdywgc3RvcmUgaXQgaW4gdGhlIGJhdGNoJ3MgaGlzdG9yeSBhbmQgZW1pdCBpdC4KUGVybWlzc2lvbmxlc3Mgc28gYSBjcm9uIG9yIHRoZSByZWxheWVyIGNhbiBwb3N0IG9uZSBwZXIgZXBvY2guIFdpdGhpbgpNSU5fTUFSS19JTlRFUlZBTCBvZiB0aGUgbGFzdCBzdG9yZWQgbWFyayBpdCBvbmx5IHJldHVybnMgdGhlIG1hcmsuAAAAAAAADHB1Ymxpc2hfbWFyawAAAAEAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAfQAAAABE1hcms=",
        "AAAAAAAAADVOYW1lIHRoZSBhY2NvdW50IHRoYXQgbWF5IHBvc3QgY2hlY2staW5zIGZvciBhIGJhdGNoLgAAAAAAAAxzZXRfcHJvZHVjZXIAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAACHByb2R1Y2VyAAAAEwAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAIAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAHY3VyYXRvcgAAAAATAAAAAA==",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAAAAAAAOcmVnaXN0ZXJfYmF0Y2gAAAAAAAIAAAAAAAAABmNvbmZpZwAAAAAH0AAAAAtCYXRjaENvbmZpZwAAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAALtBbiBpbnNwZWN0b3IgcmVwb3J0cyBhIHZpc2l0LiBBIHBlcmZlY3QgdmlzaXQgKHNjb3JlIDEwMCkgZWFybnMKSU5TUEVDVElPTl9CT05VU19CUFMsIHNjYWxlZCBieSBgc2NvcmVgIGFuZCBjYXBwZWQgb3ZlcmFsbCBhdApNQVhfQ0FSRV9CT05VU19CUFMuIFJldHVybnMgdGhlIGNhcmUgbXVsdGlwbGllciBub3cgaW4gZm9yY2UuAAAAAA9wb3N0X2luc3BlY3Rpb24AAAAABQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAARraW5kAAAAEQAAAAAAAAAEbm90ZQAAABAAAAAAAAAABXNjb3JlAAAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAAAs=",
        "AAAAAAAAAIRUaGUgZXhhY3QgYnl0ZXMgYSBzZW5zb3Igc2lnbnMgZm9yIGByZWFkaW5nYC4gU3RhcnRzIHdpdGggdGhpcwpjb250cmFjdCdzIGlkLCBzbyBhIHJlYWRpbmcgY2Fubm90IGJlIHJlcGxheWVkIG9uIGFub3RoZXIgZGVwbG95bWVudC4AAAAPcmVhZGluZ19wYXlsb2FkAAAAAAEAAAAAAAAAB3JlYWRpbmcAAAAH0AAAAAdSZWFkaW5nAAAAAAEAAAAO",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAABABJbml0aWF0ZXMgdGhlIGFkbWluIHJvbGUgdHJhbnNmZXIuCkFkbWluIHByaXZpbGVnZXMgZm9yIHRoZSBjdXJyZW50IGFkbWluIGFyZSBub3QgcmV2b2tlZCB1bnRpbCB0aGUKcmVjaXBpZW50IGFjY2VwdHMgdGhlIHRyYW5zZmVyLgpPdmVycmlkZXMgdGhlIHByZXZpb3VzIHBlbmRpbmcgdHJhbnNmZXIgaWYgdGhlcmUgaXMgb25lLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG5ld19hZG1pbmAgLSBUaGUgYWNjb3VudCB0byB0cmFuc2ZlciB0aGUgYWRtaW4gcHJpdmlsZWdlcyB0by4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIHBlbmRpbmcgdHJhbnNmZXIKZXhwaXJlcy4gSWYgYGxpdmVfdW50aWxfbGVkZ2VyYCBpcyBgMGAsIHRoZSBwZW5kaW5nIHRyYW5zZmVyIGlzCmNhbmNlbGxlZC4gYGxpdmVfdW50aWxfbGVkZ2VyYCBhcmd1bWVudCBpcyBpbXBsaWNpdGx5IGJvdW5kZWQgYnkgdGhlCm1heGltdW0gYWxsb3dlZCBUVEwgZXh0ZW5zaW9uIGZvciBhIHRlbXBvcmFyeSBzdG9yYWdlIGVudHJ5IGFuZApzcGVjaWZ5aW5nIGEgaGlnaGVyIHZhbHVlIHdpbGwgY2F1c2UgdGhlIGNvZGUgdG8gcGFuaWMuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRyeWluZyB0byBjYW5jZWwgYSB0cmFuc2ZlciB0aGF0IGRvZXNuJ3QgZXhpc3QuCiogW2BjcmF0ZTo6cm9sZV90cmFuc2Zlcjo6Um9sZVRyYW5zZmVyRXJyb3I6OkludmFsaWRMaXZlVW50aWxMZWRnZXJgXSAtCklmIHRoZSBzcGVjaWZpZWQgbGVkZ2VyIGlzIGluIHRoZSBwYXN0LgoqIFtgY3JhdGU6OnJvbGVfdHJhbnNmZXI6OlJvbGVUcmFuc2ZlckVycm9yOjpJbnZhbGlkUGVuZGluZ0FjY291bnRgXSAtCklmIHRoZSBzcGVjaWZpZWQgcGVuZGluZyBhY2NvdW50IGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgcHJvdmlkZWQgYG5ld2AKYWRkcmVzcy4KAAAAE3RyYW5zZmVyX2FkbWluX3JvbGUAAAAAAgAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAYVDb21wbGV0ZXMgdGhlIDItc3RlcCBhZG1pbiB0cmFuc2Zlci4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsiYWRtaW5fdHJhbnNmZXJfY29tcGxldGVkIiwgbmV3X2FkbWluOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtwcmV2aW91c19hZG1pbjogQWRkcmVzc11gCgojIEVycm9ycwoKKiBbYGNyYXRlOjpyb2xlX3RyYW5zZmVyOjpSb2xlVHJhbnNmZXJFcnJvcjo6Tm9QZW5kaW5nVHJhbnNmZXJgXSAtIElmCnRoZXJlIGlzIG5vIHBlbmRpbmcgdHJhbnNmZXIgdG8gYWNjZXB0LgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgYWRtaW4gYWNjb3VudCBpcyBub3Qgc2V0LgAAAAAAABVhY2NlcHRfYWRtaW5fdHJhbnNmZXIAAAAAAAAAAAAAAA==",
        "AAAAAAAAAMhSZXR1cm5zIHRoZSB0b3RhbCBudW1iZXIgb2YgYWNjb3VudHMgdGhhdCBoYXZlIHRoZSBzcGVjaWZpZWQgcm9sZS4KSWYgdGhlIHJvbGUgZG9lcyBub3QgZXhpc3QsIHJldHVybnMgMC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIGdldCB0aGUgY291bnQgZm9yLgAAABVnZXRfcm9sZV9tZW1iZXJfY291bnQAAAAAAAABAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAE",
        "AAAABAAAAAAAAAAAAAAAEVJvbGVUcmFuc2ZlckVycm9yAAAAAAAABAAAAAAAAAARTm9QZW5kaW5nVHJhbnNmZXIAAAAAAAiYAAAAAAAAABZJbnZhbGlkTGl2ZVVudGlsTGVkZ2VyAAAAAAiZAAAAAAAAABVJbnZhbGlkUGVuZGluZ0FjY291bnQAAAAAAAiaAAAAAAAAAA9UcmFuc2ZlckV4cGlyZWQAAAAImw==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIGdyYW50ZWQuAAAAAAAAAAAAAAtSb2xlR3JhbnRlZAAAAAABAAAADHJvbGVfZ3JhbnRlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGlzIHJldm9rZWQuAAAAAAAAAAAAAAtSb2xlUmV2b2tlZAAAAAABAAAADHJvbGVfcmV2b2tlZAAAAAMAAAAAAAAABHJvbGUAAAARAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAC9FdmVudCBlbWl0dGVkIHdoZW4gdGhlIGFkbWluIHJvbGUgaXMgcmVub3VuY2VkLgAAAAAAAAAADkFkbWluUmVub3VuY2VkAAAAAAABAAAAD2FkbWluX3Jlbm91bmNlZAAAAAABAAAAAAAAAAVhZG1pbgAAAAAAABMAAAABAAAAAg==",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIHdoZW4gYSByb2xlIGFkbWluIGlzIGNoYW5nZWQuAAAAAAAAAAAQUm9sZUFkbWluQ2hhbmdlZAAAAAEAAAAScm9sZV9hZG1pbl9jaGFuZ2VkAAAAAAADAAAAAAAAAARyb2xlAAAAEQAAAAEAAAAAAAAAE3ByZXZpb3VzX2FkbWluX3JvbGUAAAAAEQAAAAAAAAAAAAAADm5ld19hZG1pbl9yb2xlAAAAAAARAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAAEkFjY2Vzc0NvbnRyb2xFcnJvcgAAAAAACwAAAAAAAAAMVW5hdXRob3JpemVkAAAH0AAAAAAAAAALQWRtaW5Ob3RTZXQAAAAH0QAAAAAAAAAQSW5kZXhPdXRPZkJvdW5kcwAAB9IAAAAAAAAAEUFkbWluUm9sZU5vdEZvdW5kAAAAAAAH0wAAAAAAAAASUm9sZUNvdW50SXNOb3RaZXJvAAAAAAfUAAAAAAAAAAxSb2xlTm90Rm91bmQAAAfVAAAAAAAAAA9BZG1pbkFscmVhZHlTZXQAAAAH1gAAAAAAAAALUm9sZU5vdEhlbGQAAAAH1wAAAAAAAAALUm9sZUlzRW1wdHkAAAAH2AAAAAAAAAASVHJhbnNmZXJJblByb2dyZXNzAAAAAAfZAAAAAAAAABBNYXhSb2xlc0V4Y2VlZGVkAAAH2g==",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgY29tcGxldGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVyQ29tcGxldGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2NvbXBsZXRlZAAAAAIAAAAAAAAACW5ld19hZG1pbgAAAAAAABMAAAABAAAAAAAAAA5wcmV2aW91c19hZG1pbgAAAAAAEwAAAAAAAAAC",
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgaW5pdGlhdGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVySW5pdGlhdGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2luaXRpYXRlZAAAAAMAAAAAAAAADWN1cnJlbnRfYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC" ]),
      options
    )
  }
  public readonly fromJSON = {
    mark: this.txFromJSON<Mark>,
        batch: this.txFromJSON<BatchConfig>,
        curve: this.txFromJSON<Array<u32>>,
        rating: this.txFromJSON<Option<Rating>>,
        upgrade: this.txFromJSON<null>,
        checkins: this.txFromJSON<Array<Checkin>>,
        get_care: this.txFromJSON<Care>,
        has_role: this.txFromJSON<Option<u32>>,
        producer: this.txFromJSON<Option<string>>,
        breakdown: this.txFromJSON<Breakdown>,
        get_admin: this.txFromJSON<Option<string>>,
        get_stats: this.txFromJSON<Stats>,
        set_curve: this.txFromJSON<null>,
        grant_role: this.txFromJSON<null>,
        set_rating: this.txFromJSON<null>,
        set_sensor: this.txFromJSON<null>,
        revoke_role: this.txFromJSON<null>,
        mark_history: this.txFromJSON<Array<Mark>>,
        post_checkin: this.txFromJSON<i128>,
        post_reading: this.txFromJSON<boolean>,
        publish_mark: this.txFromJSON<Mark>,
        set_producer: this.txFromJSON<null>,
        renounce_role: this.txFromJSON<null>,
        get_role_admin: this.txFromJSON<Option<string>>,
        register_batch: this.txFromJSON<null>,
        renounce_admin: this.txFromJSON<null>,
        set_role_admin: this.txFromJSON<null>,
        get_role_member: this.txFromJSON<string>,
        post_inspection: this.txFromJSON<i128>,
        reading_payload: this.txFromJSON<Buffer>,
        get_existing_roles: this.txFromJSON<Array<string>>,
        transfer_admin_role: this.txFromJSON<null>,
        accept_admin_transfer: this.txFromJSON<null>,
        get_role_member_count: this.txFromJSON<u32>
  }
}