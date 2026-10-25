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
 * Escrow terms and state of one batch.
 */
export interface Escrow {
  /**
 * Declared failed by an inspector: sales and redemption stop, refunds open.
 */
defaulted: boolean;
  inspected: boolean;
  /**
 * Share of the price released when an inspector confirms the batch.
 */
inspection_bps: i128;
  /**
 * Held for shares still in circulation. Claims hold their own amount.
 */
pool: i128;
  /**
 * Shares handed back for a refund after a default.
 */
refunded: i128;
  /**
 * Share of the price paid to the producer at purchase, in bps.
 */
upfront_bps: i128;
}


/**
 * Sale terms and state of one batch.
 */
export interface Offering {
  batch_id: u32;
  /**
 * Storage fee per share per day in payment token units.
 */
fee_per_share_day: i128;
  /**
 * Unix time the batch was filled; fees accrue from here.
 */
filled_at: u64;
  /**
 * Unix time redemption opens.
 */
matures_at: u64;
  open: boolean;
  /**
 * Price per share in payment token units.
 */
price: i128;
  /**
 * Receives the sale proceeds.
 */
producer: string;
  /**
 * Shares redeemed so far, so `sold - redeemed` is the circulating supply.
 */
redeemed: i128;
  /**
 * SAC of the share asset. This contract must be its admin.
 */
share_token: string;
  /**
 * Shares a holder gives up for one unit.
 */
shares_per_unit: i128;
  sold: i128;
  total_shares: i128;
}


/**
 * Fee bookkeeping for a holder in one batch. Shares bought on the DEX are not
 * known here, so the fee is charged on the shares presented at redemption,
 * from the holder's checkpoint or the fill date when they have none.
 */
export interface Position {
  /**
 * Unix time up to which storage fees have been settled.
 */
fee_paid_until: u64;
  shares: i128;
}



/**
 * Money held for one claim, released to the producer on collection.
 */
export interface ClaimEscrow {
  amount: i128;
  batch_id: u32;
  holder: string;
  settled: boolean;
}







export const BatchSharesError = {
  600: {message:"OfferingExists"},
  601: {message:"OfferingNotFound"},
  602: {message:"OfferingClosed"},
  603: {message:"InvalidAmount"},
  604: {message:"SoldOut"},
  605: {message:"NotMature"},
  /**
   * Redemption amount is not a whole number of units.
   */
  606: {message:"NotWholeUnits"},
  607: {message:"InvalidTerms"},
  /**
   * No inspector has attested this batch on the registry.
   */
  608: {message:"NotAttested"},
  /**
   * More shares than the attested units can back.
   */
  609: {message:"ExceedsAttested"},
  /**
   * The offering predates escrow.
   */
  610: {message:"NoEscrow"},
  /**
   * The batch was declared failed.
   */
  611: {message:"Defaulted"},
  /**
   * Refunds need the batch to be declared failed first.
   */
  612: {message:"NotDefaulted"},
  613: {message:"AlreadyInspected"},
  614: {message:"ClaimNotFound"},
  615: {message:"AlreadySettled"},
  /**
   * Only the claim's holder or an inspector may confirm or refund it.
   */
  616: {message:"NotClaimant"}
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





export const PausableError = {
  /**
   * The operation failed because the contract is paused.
   */
  1000: {message:"EnforcedPause"},
  /**
   * The operation failed because the contract is not paused.
   */
  1001: {message:"ExpectedPause"}
}

export interface Client {
  /**
   * Construct and simulate a buy transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Buy `shares` of a batch for `price * shares` in the payment token. The
   * producer gets the upfront part at once and this contract holds the
   * rest; the buyer receives freshly minted shares.
   */
  buy: ({batch_id, buyer, shares}: {batch_id: u32, buyer: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escrow of a batch; `None` for offerings opened before escrow existed.
   */
  escrow: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Escrow>>>

  /**
   * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a redeem transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Redeem `shares` for units once the batch is mature. The holder gives
   * back the shares, pays the accrued storage fee to the treasury, and a
   * claim is recorded on the registry. The money still held for these
   * shares moves to the claim until the units are collected. Returns the
   * claim id.
   */
  redeem: ({batch_id, holder, shares}: {batch_id: u32, holder: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a refund transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * After a default, hand back `shares` (burned) for the money still held
   * for them. Works for shares bought anywhere, including the DEX.
   */
  refund: ({batch_id, holder, shares}: {batch_id: u32, holder: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a unpause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  unpause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a upgrade transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  upgrade: ({new_wasm_hash, operator}: {new_wasm_hash: Buffer, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a offering transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  offering: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Offering>>

  /**
   * Construct and simulate a registry transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  registry: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  treasury: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
   * Construct and simulate a remaining transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Shares still for sale in the primary offering.
   */
  remaining: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
   * Construct and simulate a accrued_fee transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Storage fee `holder` would pay now to redeem `shares`.
   */
  accrued_fee: ({batch_id, holder, shares}: {batch_id: u32, holder: string, shares: i128}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a circulating transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Shares in circulation: sold here minus redeemed.
   */
  circulating: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
   * Construct and simulate a claim_escrow transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Money held for a claim until its units are collected.
   */
  claim_escrow: ({claim_id}: {claim_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<ClaimEscrow>>>

  /**
   * Construct and simulate a get_position transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  get_position: ({batch_id, holder}: {batch_id: u32, holder: string}, options?: MethodOptions) => Promise<AssembledTransaction<Position>>

  /**
   * Construct and simulate a refund_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * After a default, the holder of an uncollected claim takes back what
   * was held for it.
   */
  refund_claim: ({claim_id}: {claim_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a set_maturity transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Move the maturity date, for example when the cellar declares the batch
   * ready early. Also what the demo uses to open redemption.
   */
  set_maturity: ({batch_id, matures_at, caller}: {batch_id: u32, matures_at: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a set_treasury transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  set_treasury: ({treasury}: {treasury: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a open_offering transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Open the primary sale of a batch. `share_token` is the SAC of the
   * batch's share asset and this contract must already be its admin. The
   * batch must be attested on the registry, and `total_shares` may not
   * exceed the attested units.
   */
  open_offering: ({batch_id, share_token, producer, price, total_shares, fee_per_share_day, shares_per_unit, filled_at, matures_at, caller}: {batch_id: u32, share_token: string, producer: string, price: i128, total_shares: i128, fee_per_share_day: i128, shares_per_unit: i128, filled_at: u64, matures_at: u64, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a payment_token transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  payment_token: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
   * Construct and simulate a close_offering transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Stop the primary sale. Redemption stays available.
   */
  close_offering: ({batch_id, caller}: {batch_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a declare_default transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * An inspector finds the batch missing, swapped or spoiled. Sales and
   * redemption stop and holders can take back the money still held.
   */
  declare_default: ({batch_id, caller}: {batch_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a confirm_collection transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * The units of a claim were handed over: release what was held for them
   * to the producer. Confirmed by the holder, or by an inspector who
   * witnessed the collection.
   */
  confirm_collection: ({claim_id, caller}: {claim_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

  /**
   * Construct and simulate a confirm_inspection transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * An inspector confirms the batch is in the cellar and in good order
   * while it ages: the inspection part of every circulating share goes to
   * the producer. Once per batch.
   */
  confirm_inspection: ({batch_id, caller}: {batch_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
   * Construct and simulate a held_per_share_now transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Payment held per circulating share right now: what a holder gets back
   * per share if the batch fails.
   */
  held_per_share_now: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<i128>>

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
        {admin, issuer, pauser, payment_token, registry, treasury}: {admin: string, issuer: string, pauser: string, payment_token: string, registry: string, treasury: string},
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
    return ContractClient.deploy({admin, issuer, pauser, payment_token, registry, treasury}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAACRFc2Nyb3cgdGVybXMgYW5kIHN0YXRlIG9mIG9uZSBiYXRjaC4AAAAAAAAABkVzY3JvdwAAAAAABgAAAElEZWNsYXJlZCBmYWlsZWQgYnkgYW4gaW5zcGVjdG9yOiBzYWxlcyBhbmQgcmVkZW1wdGlvbiBzdG9wLCByZWZ1bmRzIG9wZW4uAAAAAAAACWRlZmF1bHRlZAAAAAAAAAEAAAAAAAAACWluc3BlY3RlZAAAAAAAAAEAAABBU2hhcmUgb2YgdGhlIHByaWNlIHJlbGVhc2VkIHdoZW4gYW4gaW5zcGVjdG9yIGNvbmZpcm1zIHRoZSBiYXRjaC4AAAAAAAAOaW5zcGVjdGlvbl9icHMAAAAAAAsAAABDSGVsZCBmb3Igc2hhcmVzIHN0aWxsIGluIGNpcmN1bGF0aW9uLiBDbGFpbXMgaG9sZCB0aGVpciBvd24gYW1vdW50LgAAAAAEcG9vbAAAAAsAAAAwU2hhcmVzIGhhbmRlZCBiYWNrIGZvciBhIHJlZnVuZCBhZnRlciBhIGRlZmF1bHQuAAAACHJlZnVuZGVkAAAACwAAADxTaGFyZSBvZiB0aGUgcHJpY2UgcGFpZCB0byB0aGUgcHJvZHVjZXIgYXQgcHVyY2hhc2UsIGluIGJwcy4AAAALdXBmcm9udF9icHMAAAAACw==",
        "AAAAAAAAALlCdXkgYHNoYXJlc2Agb2YgYSBiYXRjaCBmb3IgYHByaWNlICogc2hhcmVzYCBpbiB0aGUgcGF5bWVudCB0b2tlbi4gVGhlCnByb2R1Y2VyIGdldHMgdGhlIHVwZnJvbnQgcGFydCBhdCBvbmNlIGFuZCB0aGlzIGNvbnRyYWN0IGhvbGRzIHRoZQpyZXN0OyB0aGUgYnV5ZXIgcmVjZWl2ZXMgZnJlc2hseSBtaW50ZWQgc2hhcmVzLgAAAAAAAANidXkAAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAVidXllcgAAAAAAABMAAAAAAAAABnNoYXJlcwAAAAAACwAAAAEAAAAL",
        "AAAAAQAAACJTYWxlIHRlcm1zIGFuZCBzdGF0ZSBvZiBvbmUgYmF0Y2guAAAAAAAAAAAACE9mZmVyaW5nAAAADAAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAANVN0b3JhZ2UgZmVlIHBlciBzaGFyZSBwZXIgZGF5IGluIHBheW1lbnQgdG9rZW4gdW5pdHMuAAAAAAAAEWZlZV9wZXJfc2hhcmVfZGF5AAAAAAAACwAAADZVbml4IHRpbWUgdGhlIGJhdGNoIHdhcyBmaWxsZWQ7IGZlZXMgYWNjcnVlIGZyb20gaGVyZS4AAAAAAAlmaWxsZWRfYXQAAAAAAAAGAAAAG1VuaXggdGltZSByZWRlbXB0aW9uIG9wZW5zLgAAAAAKbWF0dXJlc19hdAAAAAAABgAAAAAAAAAEb3BlbgAAAAEAAAAnUHJpY2UgcGVyIHNoYXJlIGluIHBheW1lbnQgdG9rZW4gdW5pdHMuAAAAAAVwcmljZQAAAAAAAAsAAAAbUmVjZWl2ZXMgdGhlIHNhbGUgcHJvY2VlZHMuAAAAAAhwcm9kdWNlcgAAABMAAABHU2hhcmVzIHJlZGVlbWVkIHNvIGZhciwgc28gYHNvbGQgLSByZWRlZW1lZGAgaXMgdGhlIGNpcmN1bGF0aW5nIHN1cHBseS4AAAAACHJlZGVlbWVkAAAACwAAADhTQUMgb2YgdGhlIHNoYXJlIGFzc2V0LiBUaGlzIGNvbnRyYWN0IG11c3QgYmUgaXRzIGFkbWluLgAAAAtzaGFyZV90b2tlbgAAAAATAAAAJlNoYXJlcyBhIGhvbGRlciBnaXZlcyB1cCBmb3Igb25lIHVuaXQuAAAAAAAPc2hhcmVzX3Blcl91bml0AAAAAAsAAAAAAAAABHNvbGQAAAALAAAAAAAAAAx0b3RhbF9zaGFyZXMAAAAL",
        "AAAAAQAAANdGZWUgYm9va2tlZXBpbmcgZm9yIGEgaG9sZGVyIGluIG9uZSBiYXRjaC4gU2hhcmVzIGJvdWdodCBvbiB0aGUgREVYIGFyZSBub3QKa25vd24gaGVyZSwgc28gdGhlIGZlZSBpcyBjaGFyZ2VkIG9uIHRoZSBzaGFyZXMgcHJlc2VudGVkIGF0IHJlZGVtcHRpb24sCmZyb20gdGhlIGhvbGRlcidzIGNoZWNrcG9pbnQgb3IgdGhlIGZpbGwgZGF0ZSB3aGVuIHRoZXkgaGF2ZSBub25lLgAAAAAAAAAACFBvc2l0aW9uAAAAAgAAADVVbml4IHRpbWUgdXAgdG8gd2hpY2ggc3RvcmFnZSBmZWVzIGhhdmUgYmVlbiBzZXR0bGVkLgAAAAAAAA5mZWVfcGFpZF91bnRpbAAAAAAABgAAAAAAAAAGc2hhcmVzAAAAAAAL",
        "AAAABQAAAAAAAAAAAAAACFJlZnVuZGVkAAAAAQAAAAhyZWZ1bmRlZAAAAAQAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAEAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAC",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAEVFc2Nyb3cgb2YgYSBiYXRjaDsgYE5vbmVgIGZvciBvZmZlcmluZ3Mgb3BlbmVkIGJlZm9yZSBlc2Nyb3cgZXhpc3RlZC4AAAAAAAAGZXNjcm93AAAAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAD6AAAB9AAAAAGRXNjcm93AAA=",
        "AAAAAAAAAAAAAAAGcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAARpSZWRlZW0gYHNoYXJlc2AgZm9yIHVuaXRzIG9uY2UgdGhlIGJhdGNoIGlzIG1hdHVyZS4gVGhlIGhvbGRlciBnaXZlcwpiYWNrIHRoZSBzaGFyZXMsIHBheXMgdGhlIGFjY3J1ZWQgc3RvcmFnZSBmZWUgdG8gdGhlIHRyZWFzdXJ5LCBhbmQgYQpjbGFpbSBpcyByZWNvcmRlZCBvbiB0aGUgcmVnaXN0cnkuIFRoZSBtb25leSBzdGlsbCBoZWxkIGZvciB0aGVzZQpzaGFyZXMgbW92ZXMgdG8gdGhlIGNsYWltIHVudGlsIHRoZSB1bml0cyBhcmUgY29sbGVjdGVkLiBSZXR1cm5zIHRoZQpjbGFpbSBpZC4AAAAAAAZyZWRlZW0AAAAAAAMAAAAAAAAACGJhdGNoX2lkAAAABAAAAAAAAAAGaG9sZGVyAAAAAAATAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAABAAAABA==",
        "AAAAAAAAAIRBZnRlciBhIGRlZmF1bHQsIGhhbmQgYmFjayBgc2hhcmVzYCAoYnVybmVkKSBmb3IgdGhlIG1vbmV5IHN0aWxsIGhlbGQKZm9yIHRoZW0uIFdvcmtzIGZvciBzaGFyZXMgYm91Z2h0IGFueXdoZXJlLCBpbmNsdWRpbmcgdGhlIERFWC4AAAAGcmVmdW5kAAAAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
        "AAAAAQAAAEFNb25leSBoZWxkIGZvciBvbmUgY2xhaW0sIHJlbGVhc2VkIHRvIHRoZSBwcm9kdWNlciBvbiBjb2xsZWN0aW9uLgAAAAAAAAAAAAALQ2xhaW1Fc2Nyb3cAAAAABAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAHc2V0dGxlZAAAAAAB",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAAAAAAAAAIb2ZmZXJpbmcAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAH0AAAAAhPZmZlcmluZw==",
        "AAAAAAAAAAAAAAAIcmVnaXN0cnkAAAAAAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAIdHJlYXN1cnkAAAAAAAAAAQAAABM=",
        "AAAABQAAAAAAAAAAAAAADFNoYXJlc0JvdWdodAAAAAEAAAANc2hhcmVzX2JvdWdodAAAAAAAAAQAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAAAAAAABWJ1eWVyAAAAAAAAEwAAAAEAAAAAAAAABnNoYXJlcwAAAAAACwAAAAAAAAAAAAAABHBhaWQAAAALAAAAAAAAAAI=",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAAC5TaGFyZXMgc3RpbGwgZm9yIHNhbGUgaW4gdGhlIHByaW1hcnkgb2ZmZXJpbmcuAAAAAAAJcmVtYWluaW5nAAAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAABQAAAAAAAAAAAAAADkJhdGNoRGVmYXVsdGVkAAAAAAABAAAAD2JhdGNoX2RlZmF1bHRlZAAAAAACAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAlpbnNwZWN0b3IAAAAAAAATAAAAAAAAAAI=",
        "AAAABQAAAExIZWxkIG1vbmV5IHBhaWQgb3V0IHRvIHRoZSBwcm9kdWNlcjogYHJlYXNvbmAgaXMgYGluc3BlY3RlZGAgb3IgYGNvbGxlY3RlZGAuAAAAAAAAAA5Fc2Nyb3dSZWxlYXNlZAAAAAAAAQAAAA9lc2Nyb3dfcmVsZWFzZWQAAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAAAAAAAAGcmVhc29uAAAAAAARAAAAAAAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAAAAAAAAAAAAADk9mZmVyaW5nQ2xvc2VkAAAAAAABAAAAD29mZmVyaW5nX2Nsb3NlZAAAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAg==",
        "AAAABQAAAAAAAAAAAAAADk9mZmVyaW5nT3BlbmVkAAAAAAABAAAAD29mZmVyaW5nX29wZW5lZAAAAAAFAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAtzaGFyZV90b2tlbgAAAAATAAAAAAAAAAAAAAAIcHJvZHVjZXIAAAATAAAAAAAAAAAAAAAFcHJpY2UAAAAAAAALAAAAAAAAAAAAAAAMdG90YWxfc2hhcmVzAAAACwAAAAAAAAAC",
        "AAAABQAAAAAAAAAAAAAADlNoYXJlc1JlZGVlbWVkAAAAAAABAAAAD3NoYXJlc19yZWRlZW1lZAAAAAAGAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAZob2xkZXIAAAAAABMAAAABAAAAAAAAAAZzaGFyZXMAAAAAAAsAAAAAAAAAAAAAAAV1bml0cwAAAAAAAAQAAAAAAAAAAAAAAANmZWUAAAAACwAAAAAAAAAAAAAACGNsYWltX2lkAAAABAAAAAAAAAAC",
        "AAAAAAAAADZTdG9yYWdlIGZlZSBgaG9sZGVyYCB3b3VsZCBwYXkgbm93IHRvIHJlZGVlbSBgc2hhcmVzYC4AAAAAAAthY2NydWVkX2ZlZQAAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABmhvbGRlcgAAAAAAEwAAAAAAAAAGc2hhcmVzAAAAAAALAAAAAQAAAAs=",
        "AAAAAAAAADBTaGFyZXMgaW4gY2lyY3VsYXRpb246IHNvbGQgaGVyZSBtaW51cyByZWRlZW1lZC4AAAALY2lyY3VsYXRpbmcAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAAAs=",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAABAAAAAAAAAAAAAAAEEJhdGNoU2hhcmVzRXJyb3IAAAARAAAAAAAAAA5PZmZlcmluZ0V4aXN0cwAAAAACWAAAAAAAAAAQT2ZmZXJpbmdOb3RGb3VuZAAAAlkAAAAAAAAADk9mZmVyaW5nQ2xvc2VkAAAAAAJaAAAAAAAAAA1JbnZhbGlkQW1vdW50AAAAAAACWwAAAAAAAAAHU29sZE91dAAAAAJcAAAAAAAAAAlOb3RNYXR1cmUAAAAAAAJdAAAAMVJlZGVtcHRpb24gYW1vdW50IGlzIG5vdCBhIHdob2xlIG51bWJlciBvZiB1bml0cy4AAAAAAAANTm90V2hvbGVVbml0cwAAAAAAAl4AAAAAAAAADEludmFsaWRUZXJtcwAAAl8AAAA1Tm8gaW5zcGVjdG9yIGhhcyBhdHRlc3RlZCB0aGlzIGJhdGNoIG9uIHRoZSByZWdpc3RyeS4AAAAAAAALTm90QXR0ZXN0ZWQAAAACYAAAAC1Nb3JlIHNoYXJlcyB0aGFuIHRoZSBhdHRlc3RlZCB1bml0cyBjYW4gYmFjay4AAAAAAAAPRXhjZWVkc0F0dGVzdGVkAAAAAmEAAAAdVGhlIG9mZmVyaW5nIHByZWRhdGVzIGVzY3Jvdy4AAAAAAAAITm9Fc2Nyb3cAAAJiAAAAHlRoZSBiYXRjaCB3YXMgZGVjbGFyZWQgZmFpbGVkLgAAAAAACURlZmF1bHRlZAAAAAAAAmMAAAAzUmVmdW5kcyBuZWVkIHRoZSBiYXRjaCB0byBiZSBkZWNsYXJlZCBmYWlsZWQgZmlyc3QuAAAAAAxOb3REZWZhdWx0ZWQAAAJkAAAAAAAAABBBbHJlYWR5SW5zcGVjdGVkAAACZQAAAAAAAAANQ2xhaW1Ob3RGb3VuZAAAAAAAAmYAAAAAAAAADkFscmVhZHlTZXR0bGVkAAAAAAJnAAAAQU9ubHkgdGhlIGNsYWltJ3MgaG9sZGVyIG9yIGFuIGluc3BlY3RvciBtYXkgY29uZmlybSBvciByZWZ1bmQgaXQuAAAAAAAAC05vdENsYWltYW50AAAAAmg=",
        "AAAAAAAAADVNb25leSBoZWxkIGZvciBhIGNsYWltIHVudGlsIGl0cyB1bml0cyBhcmUgY29sbGVjdGVkLgAAAAAAAAxjbGFpbV9lc2Nyb3cAAAABAAAAAAAAAAhjbGFpbV9pZAAAAAQAAAABAAAD6AAAB9AAAAALQ2xhaW1Fc2Nyb3cA",
        "AAAAAAAAAAAAAAAMZ2V0X3Bvc2l0aW9uAAAAAgAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAZob2xkZXIAAAAAABMAAAABAAAH0AAAAAhQb3NpdGlvbg==",
        "AAAAAAAAAFRBZnRlciBhIGRlZmF1bHQsIHRoZSBob2xkZXIgb2YgYW4gdW5jb2xsZWN0ZWQgY2xhaW0gdGFrZXMgYmFjayB3aGF0CndhcyBoZWxkIGZvciBpdC4AAAAMcmVmdW5kX2NsYWltAAAAAQAAAAAAAAAIY2xhaW1faWQAAAAEAAAAAQAAAAs=",
        "AAAAAAAAAH9Nb3ZlIHRoZSBtYXR1cml0eSBkYXRlLCBmb3IgZXhhbXBsZSB3aGVuIHRoZSBjZWxsYXIgZGVjbGFyZXMgdGhlIGJhdGNoCnJlYWR5IGVhcmx5LiBBbHNvIHdoYXQgdGhlIGRlbW8gdXNlcyB0byBvcGVuIHJlZGVtcHRpb24uAAAAAAxzZXRfbWF0dXJpdHkAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAACm1hdHVyZXNfYXQAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAAMc2V0X3RyZWFzdXJ5AAAAAQAAAAAAAAAIdHJlYXN1cnkAAAATAAAAAA==",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAYAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGaXNzdWVyAAAAAAATAAAAAAAAAAZwYXVzZXIAAAAAABMAAAAAAAAADXBheW1lbnRfdG9rZW4AAAAAAAATAAAAAAAAAAhyZWdpc3RyeQAAABMAAAAAAAAACHRyZWFzdXJ5AAAAEwAAAAA=",
        "AAAAAAAAAORPcGVuIHRoZSBwcmltYXJ5IHNhbGUgb2YgYSBiYXRjaC4gYHNoYXJlX3Rva2VuYCBpcyB0aGUgU0FDIG9mIHRoZQpiYXRjaCdzIHNoYXJlIGFzc2V0IGFuZCB0aGlzIGNvbnRyYWN0IG11c3QgYWxyZWFkeSBiZSBpdHMgYWRtaW4uIFRoZQpiYXRjaCBtdXN0IGJlIGF0dGVzdGVkIG9uIHRoZSByZWdpc3RyeSwgYW5kIGB0b3RhbF9zaGFyZXNgIG1heSBub3QKZXhjZWVkIHRoZSBhdHRlc3RlZCB1bml0cy4AAAANb3Blbl9vZmZlcmluZwAAAAAAAAoAAAAAAAAACGJhdGNoX2lkAAAABAAAAAAAAAALc2hhcmVfdG9rZW4AAAAAEwAAAAAAAAAIcHJvZHVjZXIAAAATAAAAAAAAAAVwcmljZQAAAAAAAAsAAAAAAAAADHRvdGFsX3NoYXJlcwAAAAsAAAAAAAAAEWZlZV9wZXJfc2hhcmVfZGF5AAAAAAAACwAAAAAAAAAPc2hhcmVzX3Blcl91bml0AAAAAAsAAAAAAAAACWZpbGxlZF9hdAAAAAAAAAYAAAAAAAAACm1hdHVyZXNfYXQAAAAAAAYAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANcGF5bWVudF90b2tlbgAAAAAAAAAAAAABAAAAEw==",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAADJTdG9wIHRoZSBwcmltYXJ5IHNhbGUuIFJlZGVtcHRpb24gc3RheXMgYXZhaWxhYmxlLgAAAAAADmNsb3NlX29mZmVyaW5nAAAAAAACAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAINBbiBpbnNwZWN0b3IgZmluZHMgdGhlIGJhdGNoIG1pc3NpbmcsIHN3YXBwZWQgb3Igc3BvaWxlZC4gU2FsZXMgYW5kCnJlZGVtcHRpb24gc3RvcCBhbmQgaG9sZGVycyBjYW4gdGFrZSBiYWNrIHRoZSBtb25leSBzdGlsbCBoZWxkLgAAAAAPZGVjbGFyZV9kZWZhdWx0AAAAAAIAAAAAAAAACGJhdGNoX2lkAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAAKBUaGUgdW5pdHMgb2YgYSBjbGFpbSB3ZXJlIGhhbmRlZCBvdmVyOiByZWxlYXNlIHdoYXQgd2FzIGhlbGQgZm9yIHRoZW0KdG8gdGhlIHByb2R1Y2VyLiBDb25maXJtZWQgYnkgdGhlIGhvbGRlciwgb3IgYnkgYW4gaW5zcGVjdG9yIHdobwp3aXRuZXNzZWQgdGhlIGNvbGxlY3Rpb24uAAAAEmNvbmZpcm1fY29sbGVjdGlvbgAAAAAAAgAAAAAAAAAIY2xhaW1faWQAAAAEAAAAAAAAAAZjYWxsZXIAAAAAABMAAAABAAAACw==",
        "AAAAAAAAAKZBbiBpbnNwZWN0b3IgY29uZmlybXMgdGhlIGJhdGNoIGlzIGluIHRoZSBjZWxsYXIgYW5kIGluIGdvb2Qgb3JkZXIKd2hpbGUgaXQgYWdlczogdGhlIGluc3BlY3Rpb24gcGFydCBvZiBldmVyeSBjaXJjdWxhdGluZyBzaGFyZSBnb2VzIHRvCnRoZSBwcm9kdWNlci4gT25jZSBwZXIgYmF0Y2guAAAAAAASY29uZmlybV9pbnNwZWN0aW9uAAAAAAACAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAEAAAAL",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAAAGNQYXltZW50IGhlbGQgcGVyIGNpcmN1bGF0aW5nIHNoYXJlIHJpZ2h0IG5vdzogd2hhdCBhIGhvbGRlciBnZXRzIGJhY2sKcGVyIHNoYXJlIGlmIHRoZSBiYXRjaCBmYWlscy4AAAAAEmhlbGRfcGVyX3NoYXJlX25vdwAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAAAs=",
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
        "AAAABQAAADJFdmVudCBlbWl0dGVkIHdoZW4gYW4gYWRtaW4gdHJhbnNmZXIgaXMgaW5pdGlhdGVkLgAAAAAAAAAAABZBZG1pblRyYW5zZmVySW5pdGlhdGVkAAAAAAABAAAAGGFkbWluX3RyYW5zZmVyX2luaXRpYXRlZAAAAAMAAAAAAAAADWN1cnJlbnRfYWRtaW4AAAAAAAATAAAAAQAAAAAAAAAJbmV3X2FkbWluAAAAAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAAAAAAAAAAGUGF1c2VkAAAAAAABAAAABnBhdXNlZAAAAAAAAAAAAAI=",
        "AAAABQAAACxFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0IGlzIHVucGF1c2VkLgAAAAAAAAAIVW5wYXVzZWQAAAABAAAACHVucGF1c2VkAAAAAAAAAAI=",
        "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k=" ]),
      options
    )
  }
  public readonly fromJSON = {
    buy: this.txFromJSON<i128>,
        pause: this.txFromJSON<null>,
        escrow: this.txFromJSON<Option<Escrow>>,
        paused: this.txFromJSON<boolean>,
        redeem: this.txFromJSON<u32>,
        refund: this.txFromJSON<i128>,
        unpause: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        has_role: this.txFromJSON<Option<u32>>,
        offering: this.txFromJSON<Offering>,
        registry: this.txFromJSON<string>,
        treasury: this.txFromJSON<string>,
        get_admin: this.txFromJSON<Option<string>>,
        remaining: this.txFromJSON<i128>,
        grant_role: this.txFromJSON<null>,
        accrued_fee: this.txFromJSON<i128>,
        circulating: this.txFromJSON<i128>,
        revoke_role: this.txFromJSON<null>,
        claim_escrow: this.txFromJSON<Option<ClaimEscrow>>,
        get_position: this.txFromJSON<Position>,
        refund_claim: this.txFromJSON<i128>,
        set_maturity: this.txFromJSON<null>,
        set_treasury: this.txFromJSON<null>,
        open_offering: this.txFromJSON<null>,
        payment_token: this.txFromJSON<string>,
        renounce_role: this.txFromJSON<null>,
        close_offering: this.txFromJSON<null>,
        get_role_admin: this.txFromJSON<Option<string>>,
        renounce_admin: this.txFromJSON<null>,
        set_role_admin: this.txFromJSON<null>,
        declare_default: this.txFromJSON<null>,
        get_role_member: this.txFromJSON<string>,
        confirm_collection: this.txFromJSON<i128>,
        confirm_inspection: this.txFromJSON<i128>,
        get_existing_roles: this.txFromJSON<Array<string>>,
        held_per_share_now: this.txFromJSON<i128>,
        transfer_admin_role: this.txFromJSON<null>,
        accept_admin_transfer: this.txFromJSON<null>,
        get_role_member_count: this.txFromJSON<u32>
  }
}