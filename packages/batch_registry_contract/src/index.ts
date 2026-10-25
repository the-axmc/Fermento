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
 * A unit claim, verifiable from a QR code pointing at `claim_id`.
 */
export interface UnitClaim {
  batch_id: u32;
  claimer: string;
  ledger: u32;
  units: u32;
}





export const BatchRegistryError = {
  /**
   * A claim must redeem at least one unit.
   */
  500: {message:"ZeroUnits"},
  /**
   * No claim exists with this id.
   */
  501: {message:"ClaimNotFound"},
  /**
   * The caller is not the producer of this batch.
   */
  502: {message:"NotProducer"},
  /**
   * This tag is already bound to another batch.
   */
  503: {message:"TagTaken"}
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






export const NonFungibleTokenError = {
  /**
   * Indicates a non-existent `token_id`.
   */
  200: {message:"NonExistentToken"},
  /**
   * Indicates an error related to the ownership over a particular token.
   * Used in transfers.
   */
  201: {message:"IncorrectOwner"},
  /**
   * Indicates a failure with the `operator`s approval. Used in transfers.
   */
  202: {message:"InsufficientApproval"},
  /**
   * Indicates a failure with the `approver` of a token to be approved. Used
   * in approvals.
   */
  203: {message:"InvalidApprover"},
  /**
   * Indicates an invalid value for `live_until_ledger` when setting
   * approvals.
   */
  204: {message:"InvalidLiveUntilLedger"},
  /**
   * Indicates overflow when adding two values
   */
  205: {message:"MathOverflow"},
  /**
   * Indicates all possible `token_id`s are already in use.
   */
  206: {message:"TokenIDsAreDepleted"},
  /**
   * Indicates an invalid amount to batch mint in `consecutive` extension.
   */
  207: {message:"InvalidAmount"},
  /**
   * Indicates the token does not exist in owner's list.
   */
  208: {message:"TokenNotFoundInOwnerList"},
  /**
   * Indicates the token does not exist in global list.
   */
  209: {message:"TokenNotFoundInGlobalList"},
  /**
   * Indicates access to unset metadata.
   */
  210: {message:"UnsetMetadata"},
  /**
   * Indicates the length of the base URI exceeds the maximum allowed.
   */
  211: {message:"BaseUriMaxLenExceeded"},
  /**
   * Indicates the royalty amount is higher than 10_000 (100%) basis points.
   */
  212: {message:"InvalidRoyaltyAmount"},
  /**
   * Indicates the length of the name exceeds the maximum allowed.
   */
  213: {message:"NameMaxLenExceeded"},
  /**
   * Indicates the length of the symbol exceeds the maximum allowed.
   */
  214: {message:"SymbolMaxLenExceeded"}
}

export interface Client {
  /**
   * Construct and simulate a tag transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Tag bound to a batch, if any.
   */
  tag: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<Buffer>>>

  /**
   * Construct and simulate a burn transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn: ({from, token_id}: {from: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a mint transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Mint a batch token without metadata. Kept for the existing Home page.
   */
  mint: ({to, token_id, caller}: {to: string, token_id: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a name transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection name.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  name: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Record that `claimer` redeemed `units` from a batch. Returns the claim
   * id that goes on the unit label QR code.
   */
  claim: ({batch_id, claimer, units, caller}: {batch_id: u32, claimer: string, units: u32, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a pause transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  pause: ({caller}: {caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a stage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Current stage of a batch, `None` for tokens minted without `register_batch`.
   */
  stage: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a paused transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  paused: (options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a symbol transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the token collection symbol.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  symbol: (options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a approve transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Gives permission to `approved` to transfer the token with `token_id` to
   * another account. The approval is cleared when the token is
   * transferred.
   * 
   * Only a single account can be approved at a time for a `token_id`.
   * To remove an approval, the approver can approve their own address,
   * effectively removing the previous approved address. Alternatively,
   * setting the `live_until_ledger` to `0` will also revoke the approval.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `approver` - The address of the approver (should be `owner` or
   * `operator`).
   * * `approved` - The address receiving the approval.
   * * `token_id` - Token ID as a number.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   * * [`NonFungibleTokenError::InvalidApprover`] - If the owner address is
   * not the actual owner of the token.
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledge
   */
  approve: ({approver, approved, token_id, live_until_ledger}: {approver: string, approved: string, token_id: u32, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the number of tokens owned by `account`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The address for which the balance is being queried.
   */
  balance: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
   * Construct and simulate a link_tag transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Bind a physical NFC tag to a batch. `tag` is the sha256 of the tag's
   * serial number, so the chain never carries the raw serial. Authorized by
   * the producer's own account. Re-linking replaces the previous tag.
   */
  link_tag: ({batch_id, producer, tag}: {batch_id: u32, producer: string, tag: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a owner_of transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the owner of the token with `token_id`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  owner_of: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

  /**
   * Construct and simulate a producer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  producer: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer: ({from, to, token_id}: {from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a burn_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  burn_from: ({spender, from, token_id}: {spender: string, from: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a get_claim transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Look up a claim by id, for the warehouse verification page.
   */
  get_claim: ({claim_id}: {claim_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<UnitClaim>>

  /**
   * Construct and simulate a set_stage transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Move a batch to a new lifecycle stage and emit `BatchStageChanged`.
   */
  set_stage: ({batch_id, stage, caller}: {batch_id: u32, stage: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Per-batch URI when one was registered, otherwise `base_uri + token_id`.
   */
  token_uri: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<string>>

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
   * Construct and simulate a batch_of_tag transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Batch a tapped tag belongs to, for the verification page.
   */
  batch_of_tag: ({tag}: {tag: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<Option<u32>>>

  /**
   * Construct and simulate a get_approved transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the account approved for the token with `token_id`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `token_id` - Token ID as a number.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::NonExistentToken`] - If the token does not
   * exist.
   */
  get_approved: ({token_id}: {token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<Option<string>>>

  /**
   * Construct and simulate a get_token_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the `token_id` at a given `index` in the global token list.
   * Use along with [`NonFungibleEnumerable::total_supply`] to enumerate
   * all the tokens in the contract.
   * 
   * A function to get all tokens of a contract is not provided because that
   * would be unbounded. To enumerate all tokens of a contract, use
   * [`NonFungibleEnumerable::total_supply`] to get the total number of
   * tokens and then use [`NonFungibleEnumerable::get_token_id`] to retrieve
   * each token one by one.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `index` - Index of the token in the global list.
   * 
   * # Errors
   * 
   * * [`crate::non_fungible::NonFungibleTokenError::TokenNotFoundInGlobalList`] - When the token
   * ID is not found in the global enumeration.
   */
  get_token_id: ({index}: {index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a set_producer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Name the producer account of a batch, which may then bind an NFC tag.
   */
  set_producer: ({batch_id, producer, caller}: {batch_id: u32, producer: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a total_supply transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the total amount of tokens stored by the contract.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   */
  total_supply: (options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a claimed_units transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Total units claimed against a batch.
   */
  claimed_units: ({batch_id}: {batch_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

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
   * Construct and simulate a set_token_uri transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Replace the metadata URI of an existing batch.
   */
  set_token_uri: ({batch_id, uri, caller}: {batch_id: u32, uri: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   */
  transfer_from: ({spender, from, to, token_id}: {spender: string, from: string, to: string, token_id: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Register a batch at fill: mint the token, store its metadata URI and set
   * the stage to `filled`.
   */
  register_batch: ({to, batch_id, uri, caller}: {to: string, batch_id: u32, uri: string, caller: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a approve_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Approve or remove `operator` as an operator for the owner.
   * 
   * Operators can call `transfer_from()` for any token held by `owner`,
   * and call `approve()` on behalf of `owner`.
   * 
   * # Arguments
   * 
   * * `e` - Access to Soroban environment.
   * * `owner` - The address holding the tokens.
   * * `operator` - Account to add to the set of authorized operators.
   * * `live_until_ledger` - The ledger number at which the allowance
   * expires. If `live_until_ledger` is `0`, the approval is revoked.
   * 
   * # Errors
   * 
   * * [`NonFungibleTokenError::InvalidLiveUntilLedger`] - If the ledger
   * number is less than the current ledger number.
   * 
   * # Events
   * 
   * * topics - `["approve_for_all", owner: Address]`
   * * data - `[operator: Address, live_until_ledger: u32]`
   */
  approve_for_all: ({owner, operator, live_until_ledger}: {owner: string, operator: string, live_until_ledger: u32}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

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
   * Construct and simulate a get_owner_token_id transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the `token_id` owned by `owner` at a given `index` in the
   * owner's local list. Use along with
   * [`crate::non_fungible::NonFungibleToken::balance`] to enumerate all of
   * `owner`'s tokens.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `owner` - Account of the token's owner.
   * * `index` - Index of the token in the owner's local list.
   * 
   * # Errors
   * 
   * * [`crate::non_fungible::NonFungibleTokenError::TokenNotFoundInOwnerList`] - When the token
   * ID is not found in the owner's enumeration.
   */
  get_owner_token_id: ({owner, index}: {owner: string, index: u32}, options?: MethodOptions) => Promise<AssembledTransaction<u32>>

  /**
   * Construct and simulate a is_approved_for_all transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns whether the `operator` is allowed to manage all the assets of
   * `owner`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `owner` - Account of the token's owner.
   * * `operator` - Account to be checked.
   */
  is_approved_for_all: ({owner, operator}: {owner: string, operator: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

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
        {admin, pauser, upgrader, minter}: {admin: string, pauser: string, upgrader: string, minter: string},
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
    return ContractClient.deploy({admin, pauser, upgrader, minter}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAQAAAD9BIHVuaXQgY2xhaW0sIHZlcmlmaWFibGUgZnJvbSBhIFFSIGNvZGUgcG9pbnRpbmcgYXQgYGNsYWltX2lkYC4AAAAAAAAAAAlVbml0Q2xhaW0AAAAAAAAEAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAAB2NsYWltZXIAAAAAEwAAAAAAAAAGbGVkZ2VyAAAAAAAEAAAAAAAAAAV1bml0cwAAAAAAAAQ=",
        "AAAAAAAAAB1UYWcgYm91bmQgdG8gYSBiYXRjaCwgaWYgYW55LgAAAAAAAAN0YWcAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAA+gAAAPuAAAAIA==",
        "AAAABQAAAAAAAAAAAAAACVRhZ0xpbmtlZAAAAAAAAAEAAAAKdGFnX2xpbmtlZAAAAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAAAAAAAAIcHJvZHVjZXIAAAATAAAAAAAAAAAAAAADdGFnAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAAAAAAAAAAAAAEYnVybgAAAAIAAAAAAAAABGZyb20AAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAA",
        "AAAAAAAAAEVNaW50IGEgYmF0Y2ggdG9rZW4gd2l0aG91dCBtZXRhZGF0YS4gS2VwdCBmb3IgdGhlIGV4aXN0aW5nIEhvbWUgcGFnZS4AAAAAAAAEbWludAAAAAMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAFtSZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIG5hbWUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAARuYW1lAAAAAAAAAAEAAAAQ",
        "AAAAAAAAAG5SZWNvcmQgdGhhdCBgY2xhaW1lcmAgcmVkZWVtZWQgYHVuaXRzYCBmcm9tIGEgYmF0Y2guIFJldHVybnMgdGhlIGNsYWltCmlkIHRoYXQgZ29lcyBvbiB0aGUgdW5pdCBsYWJlbCBRUiBjb2RlLgAAAAAABWNsYWltAAAAAAAABAAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAdjbGFpbWVyAAAAABMAAAAAAAAABXVuaXRzAAAAAAAABAAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAFcGF1c2UAAAAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAExDdXJyZW50IHN0YWdlIG9mIGEgYmF0Y2gsIGBOb25lYCBmb3IgdG9rZW5zIG1pbnRlZCB3aXRob3V0IGByZWdpc3Rlcl9iYXRjaGAuAAAABXN0YWdlAAAAAAAAAQAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAQAAA+gAAAAR",
        "AAAAAAAAAAAAAAAGcGF1c2VkAAAAAAAAAAAAAQAAAAE=",
        "AAAAAAAAAF1SZXR1cm5zIHRoZSB0b2tlbiBjb2xsZWN0aW9uIHN5bWJvbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4AAAAAAAAGc3ltYm9sAAAAAAAAAAAAAQAAABA=",
        "AAAABQAAAAAAAAAAAAAADFVuaXRzQ2xhaW1lZAAAAAEAAAANdW5pdHNfY2xhaW1lZAAAAAAAAAQAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAAAAAAACGNsYWltX2lkAAAABAAAAAEAAAAAAAAAB2NsYWltZXIAAAAAEwAAAAAAAAAAAAAABXVuaXRzAAAAAAAABAAAAAAAAAAC",
        "AAAAAAAABABHaXZlcyBwZXJtaXNzaW9uIHRvIGBhcHByb3ZlZGAgdG8gdHJhbnNmZXIgdGhlIHRva2VuIHdpdGggYHRva2VuX2lkYCB0bwphbm90aGVyIGFjY291bnQuIFRoZSBhcHByb3ZhbCBpcyBjbGVhcmVkIHdoZW4gdGhlIHRva2VuIGlzCnRyYW5zZmVycmVkLgoKT25seSBhIHNpbmdsZSBhY2NvdW50IGNhbiBiZSBhcHByb3ZlZCBhdCBhIHRpbWUgZm9yIGEgYHRva2VuX2lkYC4KVG8gcmVtb3ZlIGFuIGFwcHJvdmFsLCB0aGUgYXBwcm92ZXIgY2FuIGFwcHJvdmUgdGhlaXIgb3duIGFkZHJlc3MsCmVmZmVjdGl2ZWx5IHJlbW92aW5nIHRoZSBwcmV2aW91cyBhcHByb3ZlZCBhZGRyZXNzLiBBbHRlcm5hdGl2ZWx5LApzZXR0aW5nIHRoZSBgbGl2ZV91bnRpbF9sZWRnZXJgIHRvIGAwYCB3aWxsIGFsc28gcmV2b2tlIHRoZSBhcHByb3ZhbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhcHByb3ZlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgYXBwcm92ZXIgKHNob3VsZCBiZSBgb3duZXJgIG9yCmBvcGVyYXRvcmApLgoqIGBhcHByb3ZlZGAgLSBUaGUgYWRkcmVzcyByZWNlaXZpbmcgdGhlIGFwcHJvdmFsLgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6Tm9uRXhpc3RlbnRUb2tlbmBdIC0gSWYgdGhlIHRva2VuIGRvZXMgbm90CmV4aXN0LgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpJbnZhbGlkQXBwcm92ZXJgXSAtIElmIHRoZSBvd25lciBhZGRyZXNzIGlzCm5vdCB0aGUgYWN0dWFsIG93bmVyIG9mIHRoZSB0b2tlbi4KKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAAAAAAhhcHByb3ZlZAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAA==",
        "AAAAAAAAAKtSZXR1cm5zIHRoZSBudW1iZXIgb2YgdG9rZW5zIG93bmVkIGJ5IGBhY2NvdW50YC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWRkcmVzcyBmb3Igd2hpY2ggdGhlIGJhbGFuY2UgaXMgYmVpbmcgcXVlcmllZC4AAAAAB2JhbGFuY2UAAAAAAQAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAAHdW5wYXVzZQAAAAABAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAAAAAAAHdXBncmFkZQAAAAACAAAAAAAAAA1uZXdfd2FzbV9oYXNoAAAAAAAD7gAAACAAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAA=",
        "AAAAAAAAAXJSZXR1cm5zIGBTb21lKGluZGV4KWAgaWYgdGhlIGFjY291bnQgaGFzIHRoZSBzcGVjaWZpZWQgcm9sZSwKd2hlcmUgYGluZGV4YCBpcyB0aGUgcG9zaXRpb24gb2YgdGhlIGFjY291bnQgZm9yIHRoYXQgcm9sZSwKYW5kIGNhbiBiZSB1c2VkIHRvIHF1ZXJ5IFtgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyKClgXS4KUmV0dXJucyBgTm9uZWAgaWYgdGhlIGFjY291bnQgZG9lcyBub3QgaGF2ZSB0aGUgc3BlY2lmaWVkIHJvbGUuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBjaGVjay4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBjaGVjayBmb3IuAAAAAAAIaGFzX3JvbGUAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAABHJvbGUAAAARAAAAAQAAA+gAAAAE",
        "AAAAAAAAAM5CaW5kIGEgcGh5c2ljYWwgTkZDIHRhZyB0byBhIGJhdGNoLiBgdGFnYCBpcyB0aGUgc2hhMjU2IG9mIHRoZSB0YWcncwpzZXJpYWwgbnVtYmVyLCBzbyB0aGUgY2hhaW4gbmV2ZXIgY2FycmllcyB0aGUgcmF3IHNlcmlhbC4gQXV0aG9yaXplZCBieQp0aGUgcHJvZHVjZXIncyBvd24gYWNjb3VudC4gUmUtbGlua2luZyByZXBsYWNlcyB0aGUgcHJldmlvdXMgdGFnLgAAAAAACGxpbmtfdGFnAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAhwcm9kdWNlcgAAABMAAAAAAAAAA3RhZwAAAAPuAAAAIAAAAAA=",
        "AAAAAAAAAOVSZXR1cm5zIHRoZSBvd25lciBvZiB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAACG93bmVyX29mAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABM=",
        "AAAAAAAAAAAAAAAIcHJvZHVjZXIAAAABAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAD6AAAABM=",
        "AAAAAAAAAAAAAAAIdHJhbnNmZXIAAAADAAAAAAAAAARmcm9tAAAAEwAAAAAAAAACdG8AAAAAABMAAAAAAAAACHRva2VuX2lkAAAABAAAAAA=",
        "AAAAAAAAAAAAAAAJYnVybl9mcm9tAAAAAAAAAwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAAARmcm9tAAAAEwAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAA==",
        "AAAAAAAAAE9SZXR1cm5zIHRoZSBhZG1pbiBhY2NvdW50LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAlnZXRfYWRtaW4AAAAAAAAAAAAAAQAAA+gAAAAT",
        "AAAAAAAAADtMb29rIHVwIGEgY2xhaW0gYnkgaWQsIGZvciB0aGUgd2FyZWhvdXNlIHZlcmlmaWNhdGlvbiBwYWdlLgAAAAAJZ2V0X2NsYWltAAAAAAAAAQAAAAAAAAAIY2xhaW1faWQAAAAEAAAAAQAAB9AAAAAJVW5pdENsYWltAAAA",
        "AAAAAAAAAENNb3ZlIGEgYmF0Y2ggdG8gYSBuZXcgbGlmZWN5Y2xlIHN0YWdlIGFuZCBlbWl0IGBCYXRjaFN0YWdlQ2hhbmdlZGAuAAAAAAlzZXRfc3RhZ2UAAAAAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAABXN0YWdlAAAAAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAAEdQZXItYmF0Y2ggVVJJIHdoZW4gb25lIHdhcyByZWdpc3RlcmVkLCBvdGhlcndpc2UgYGJhc2VfdXJpICsgdG9rZW5faWRgLgAAAAAJdG9rZW5fdXJpAAAAAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAABA=",
        "AAAABQAAAAAAAAAAAAAAD0JhdGNoUmVnaXN0ZXJlZAAAAAABAAAAEGJhdGNoX3JlZ2lzdGVyZWQAAAADAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAABAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAAAAAAAAN1cmkAAAAAEAAAAAAAAAAC",
        "AAAAAAAAAj5HcmFudHMgYSByb2xlIHRvIGFuIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byBncmFudCB0aGUgcm9sZSB0by4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBncmFudC4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFkbWluIG9yIGhhdmUgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGNhbGxlciBkb2VzIG5vdCBoYXZlCmVub3VnaCBwcml2aWxlZ2VzLgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpNYXhSb2xlc0V4Y2VlZGVkYF0gLSBJZiBhZGRpbmcgYSBuZXcgcm9sZSB3b3VsZApleGNlZWQgdGhlIG1heGltdW0gYWxsb3dlZCBudW1iZXIgb2Ygcm9sZXMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2dyYW50ZWQiLCByb2xlOiBTeW1ib2wsIGFjY291bnQ6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2NhbGxlcjogQWRkcmVzc11gAAAAAAAKZ3JhbnRfcm9sZQAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAAAAAAArdSZXZva2VzIGEgcm9sZSBmcm9tIGFuIGFjY291bnQuClRvIHJldm9rZSB0aGUgY2FsbGVyJ3Mgb3duIHJvbGUsIHVzZQpbYEFjY2Vzc0NvbnRyb2w6OnJlbm91bmNlX3JvbGUoKWBdIGluc3RlYWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgYWNjb3VudGAgLSBUaGUgYWNjb3VudCB0byByZXZva2UgdGhlIHJvbGUgZnJvbS4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZXZva2UuCiogYGNhbGxlcmAgLSBUaGUgYWRkcmVzcyBvZiB0aGUgY2FsbGVyLCBtdXN0IGJlIHRoZSBhZG1pbiBvciBoYXMgdGhlCmBSb2xlQWRtaW5gIGZvciB0aGUgYHJvbGVgLgoKIyBFcnJvcnMKCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlVuYXV0aG9yaXplZGBdIC0gSWYgdGhlIGBjYWxsZXJgIGRvZXMgbm90IGhhdmUKZW5vdWdoIHByaXZpbGVnZXMuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVOb3RIZWxkYF0gLSBJZiB0aGUgYGFjY291bnRgIGRvZXNuJ3QgaGF2ZQp0aGUgcm9sZS4KKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZUlzRW1wdHlgXSAtIElmIHRoZSByb2xlIGhhcyBubyBtZW1iZXJzLgoKIyBFdmVudHMKCiogdG9waWNzIC0gYFsicm9sZV9yZXZva2VkIiwgcm9sZTogU3ltYm9sLCBhY2NvdW50OiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtjYWxsZXI6IEFkZHJlc3NdYAAAAAALcmV2b2tlX3JvbGUAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAGY2FsbGVyAAAAAAATAAAAAA==",
        "AAAABQAAAAAAAAAAAAAAEUJhdGNoU3RhZ2VDaGFuZ2VkAAAAAAAAAQAAABNiYXRjaF9zdGFnZV9jaGFuZ2VkAAAAAAIAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAAAAAAABXN0YWdlAAAAAAAAEQAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAAEkJhdGNoUmVnaXN0cnlFcnJvcgAAAAAABAAAACZBIGNsYWltIG11c3QgcmVkZWVtIGF0IGxlYXN0IG9uZSB1bml0LgAAAAAACVplcm9Vbml0cwAAAAAAAfQAAAAdTm8gY2xhaW0gZXhpc3RzIHdpdGggdGhpcyBpZC4AAAAAAAANQ2xhaW1Ob3RGb3VuZAAAAAAAAfUAAAAtVGhlIGNhbGxlciBpcyBub3QgdGhlIHByb2R1Y2VyIG9mIHRoaXMgYmF0Y2guAAAAAAAAC05vdFByb2R1Y2VyAAAAAfYAAAArVGhpcyB0YWcgaXMgYWxyZWFkeSBib3VuZCB0byBhbm90aGVyIGJhdGNoLgAAAAAIVGFnVGFrZW4AAAH3",
        "AAAAAAAAADlCYXRjaCBhIHRhcHBlZCB0YWcgYmVsb25ncyB0bywgZm9yIHRoZSB2ZXJpZmljYXRpb24gcGFnZS4AAAAAAAAMYmF0Y2hfb2ZfdGFnAAAAAQAAAAAAAAADdGFnAAAAA+4AAAAgAAAAAQAAA+gAAAAE",
        "AAAAAAAAAPFSZXR1cm5zIHRoZSBhY2NvdW50IGFwcHJvdmVkIGZvciB0aGUgdG9rZW4gd2l0aCBgdG9rZW5faWRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGB0b2tlbl9pZGAgLSBUb2tlbiBJRCBhcyBhIG51bWJlci4KCiMgRXJyb3JzCgoqIFtgTm9uRnVuZ2libGVUb2tlbkVycm9yOjpOb25FeGlzdGVudFRva2VuYF0gLSBJZiB0aGUgdG9rZW4gZG9lcyBub3QKZXhpc3QuAAAAAAAADGdldF9hcHByb3ZlZAAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAEAAAPoAAAAEw==",
        "AAAAAAAAAtBSZXR1cm5zIHRoZSBgdG9rZW5faWRgIGF0IGEgZ2l2ZW4gYGluZGV4YCBpbiB0aGUgZ2xvYmFsIHRva2VuIGxpc3QuClVzZSBhbG9uZyB3aXRoIFtgTm9uRnVuZ2libGVFbnVtZXJhYmxlOjp0b3RhbF9zdXBwbHlgXSB0byBlbnVtZXJhdGUKYWxsIHRoZSB0b2tlbnMgaW4gdGhlIGNvbnRyYWN0LgoKQSBmdW5jdGlvbiB0byBnZXQgYWxsIHRva2VucyBvZiBhIGNvbnRyYWN0IGlzIG5vdCBwcm92aWRlZCBiZWNhdXNlIHRoYXQKd291bGQgYmUgdW5ib3VuZGVkLiBUbyBlbnVtZXJhdGUgYWxsIHRva2VucyBvZiBhIGNvbnRyYWN0LCB1c2UKW2BOb25GdW5naWJsZUVudW1lcmFibGU6OnRvdGFsX3N1cHBseWBdIHRvIGdldCB0aGUgdG90YWwgbnVtYmVyIG9mCnRva2VucyBhbmQgdGhlbiB1c2UgW2BOb25GdW5naWJsZUVudW1lcmFibGU6OmdldF90b2tlbl9pZGBdIHRvIHJldHJpZXZlCmVhY2ggdG9rZW4gb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgaW5kZXhgIC0gSW5kZXggb2YgdGhlIHRva2VuIGluIHRoZSBnbG9iYWwgbGlzdC4KCiMgRXJyb3JzCgoqIFtgY3JhdGU6Om5vbl9mdW5naWJsZTo6Tm9uRnVuZ2libGVUb2tlbkVycm9yOjpUb2tlbk5vdEZvdW5kSW5HbG9iYWxMaXN0YF0gLSBXaGVuIHRoZSB0b2tlbgpJRCBpcyBub3QgZm91bmQgaW4gdGhlIGdsb2JhbCBlbnVtZXJhdGlvbi4AAAAMZ2V0X3Rva2VuX2lkAAAAAQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAAAQ=",
        "AAAAAAAAAEVOYW1lIHRoZSBwcm9kdWNlciBhY2NvdW50IG9mIGEgYmF0Y2gsIHdoaWNoIG1heSB0aGVuIGJpbmQgYW4gTkZDIHRhZy4AAAAAAAAMc2V0X3Byb2R1Y2VyAAAAAwAAAAAAAAAIYmF0Y2hfaWQAAAAEAAAAAAAAAAhwcm9kdWNlcgAAABMAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAHNSZXR1cm5zIHRoZSB0b3RhbCBhbW91bnQgb2YgdG9rZW5zIHN0b3JlZCBieSB0aGUgY29udHJhY3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuAAAAAAx0b3RhbF9zdXBwbHkAAAAAAAAAAQAAAAQ=",
        "AAAAAAAAAAAAAAANX19jb25zdHJ1Y3RvcgAAAAAAAAQAAAAAAAAABWFkbWluAAAAAAAAEwAAAAAAAAAGcGF1c2VyAAAAAAATAAAAAAAAAAh1cGdyYWRlcgAAABMAAAAAAAAABm1pbnRlcgAAAAAAEwAAAAA=",
        "AAAAAAAAACRUb3RhbCB1bml0cyBjbGFpbWVkIGFnYWluc3QgYSBiYXRjaC4AAAANY2xhaW1lZF91bml0cwAAAAAAAAEAAAAAAAAACGJhdGNoX2lkAAAABAAAAAEAAAAE",
        "AAAAAAAAAhZBbGxvd3MgYW4gYWNjb3VudCB0byByZW5vdW5jZSBhIHJvbGUgYXNzaWduZWQgdG8gaXRzZWxmLgpVc2VycyBjYW4gb25seSByZW5vdW5jZSByb2xlcyBmb3IgdGhlaXIgb3duIGFjY291bnQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byByZW5vdW5jZS4KKiBgY2FsbGVyYCAtIFRoZSBhZGRyZXNzIG9mIHRoZSBjYWxsZXIsIG11c3QgYmUgdGhlIGFjY291bnQgdGhhdCBoYXMgdGhlCnJvbGUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6Um9sZU5vdEhlbGRgXSAtIElmIHRoZSBgY2FsbGVyYCBkb2Vzbid0IGhhdmUgdGhlCnJvbGUuCiogW2BBY2Nlc3NDb250cm9sRXJyb3I6OlJvbGVJc0VtcHR5YF0gLSBJZiB0aGUgcm9sZSBoYXMgbm8gbWVtYmVycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJvbGVfcmV2b2tlZCIsIHJvbGU6IFN5bWJvbCwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbY2FsbGVyOiBBZGRyZXNzXWAAAAAAAA1yZW5vdW5jZV9yb2xlAAAAAAAAAgAAAAAAAAAEcm9sZQAAABEAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAC5SZXBsYWNlIHRoZSBtZXRhZGF0YSBVUkkgb2YgYW4gZXhpc3RpbmcgYmF0Y2guAAAAAAANc2V0X3Rva2VuX3VyaQAAAAAAAAMAAAAAAAAACGJhdGNoX2lkAAAABAAAAAAAAAADdXJpAAAAABAAAAAAAAAABmNhbGxlcgAAAAAAEwAAAAA=",
        "AAAAAAAAAAAAAAANdHJhbnNmZXJfZnJvbQAAAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAA",
        "AAAAAAAAAMVSZXR1cm5zIHRoZSBhZG1pbiByb2xlIGZvciBhIHNwZWNpZmljIHJvbGUuCklmIG5vIGFkbWluIHJvbGUgaXMgZXhwbGljaXRseSBzZXQsIHJldHVybnMgYE5vbmVgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYHJvbGVgIC0gVGhlIHJvbGUgdG8gcXVlcnkgdGhlIGFkbWluIHJvbGUgZm9yLgAAAAAAAA5nZXRfcm9sZV9hZG1pbgAAAAAAAQAAAAAAAAAEcm9sZQAAABEAAAABAAAD6AAAABE=",
        "AAAAAAAAAF9SZWdpc3RlciBhIGJhdGNoIGF0IGZpbGw6IG1pbnQgdGhlIHRva2VuLCBzdG9yZSBpdHMgbWV0YWRhdGEgVVJJIGFuZCBzZXQKdGhlIHN0YWdlIHRvIGBmaWxsZWRgLgAAAAAOcmVnaXN0ZXJfYmF0Y2gAAAAAAAQAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAhiYXRjaF9pZAAAAAQAAAAAAAAAA3VyaQAAAAAQAAAAAAAAAAZjYWxsZXIAAAAAABMAAAAA",
        "AAAAAAAAAfZBbGxvd3MgdGhlIGN1cnJlbnQgYWRtaW4gdG8gcmVub3VuY2UgdGhlaXIgcm9sZSwgbWFraW5nIHRoZSBjb250cmFjdApwZXJtYW5lbnRseSBhZG1pbi1sZXNzLiBUaGlzIGlzIHVzZWZ1bCBmb3IgZGVjZW50cmFsaXphdGlvbiBwdXJwb3NlcwpvciB3aGVuIHRoZSBhZG1pbiByb2xlIGlzIG5vIGxvbmdlciBuZWVkZWQuIE9uY2UgdGhlIGFkbWluIGlzCnJlbm91bmNlZCwgaXQgY2Fubm90IGJlIHJlaW5zdGF0ZWQuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgRXJyb3JzCgoqIFtgQWNjZXNzQ29udHJvbEVycm9yOjpBZG1pbk5vdFNldGBdIC0gSWYgbm8gYWRtaW4gYWNjb3VudCBpcyBzZXQuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhZG1pbl9yZW5vdW5jZWQiLCBhZG1pbjogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAKCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAOcmVub3VuY2VfYWRtaW4AAAAAAAAAAAAA",
        "AAAAAAAAAb1TZXRzIGBhZG1pbl9yb2xlYCBhcyB0aGUgYWRtaW4gcm9sZSBvZiBgcm9sZWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgcm9sZWAgLSBUaGUgcm9sZSB0byBzZXQgdGhlIGFkbWluIGZvci4KKiBgYWRtaW5fcm9sZWAgLSBUaGUgbmV3IGFkbWluIHJvbGUuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyb2xlX2FkbWluX2NoYW5nZWQiLCByb2xlOiBTeW1ib2xdYAoqIGRhdGEgLSBgW3ByZXZpb3VzX2FkbWluX3JvbGU6IFN5bWJvbCwgbmV3X2FkbWluX3JvbGU6IFN5bWJvbF1gCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6QWRtaW5Ob3RTZXRgXSAtIElmIGFkbWluIGFjY291bnQgaXMgbm90IHNldC4KCiMgTm90ZXMKCiogQXV0aG9yaXphdGlvbiBmb3IgdGhlIGN1cnJlbnQgYWRtaW4gaXMgcmVxdWlyZWQuAAAAAAAADnNldF9yb2xlX2FkbWluAAAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAKYWRtaW5fcm9sZQAAAAAAEQAAAAA=",
        "AAAAAAAAAsBBcHByb3ZlIG9yIHJlbW92ZSBgb3BlcmF0b3JgIGFzIGFuIG9wZXJhdG9yIGZvciB0aGUgb3duZXIuCgpPcGVyYXRvcnMgY2FuIGNhbGwgYHRyYW5zZmVyX2Zyb20oKWAgZm9yIGFueSB0b2tlbiBoZWxkIGJ5IGBvd25lcmAsCmFuZCBjYWxsIGBhcHByb3ZlKClgIG9uIGJlaGFsZiBvZiBgb3duZXJgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYG93bmVyYCAtIFRoZSBhZGRyZXNzIGhvbGRpbmcgdGhlIHRva2Vucy4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBhZGQgdG8gdGhlIHNldCBvZiBhdXRob3JpemVkIG9wZXJhdG9ycy4KKiBgbGl2ZV91bnRpbF9sZWRnZXJgIC0gVGhlIGxlZGdlciBudW1iZXIgYXQgd2hpY2ggdGhlIGFsbG93YW5jZQpleHBpcmVzLiBJZiBgbGl2ZV91bnRpbF9sZWRnZXJgIGlzIGAwYCwgdGhlIGFwcHJvdmFsIGlzIHJldm9rZWQuCgojIEVycm9ycwoKKiBbYE5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6SW52YWxpZExpdmVVbnRpbExlZGdlcmBdIC0gSWYgdGhlIGxlZGdlcgpudW1iZXIgaXMgbGVzcyB0aGFuIHRoZSBjdXJyZW50IGxlZGdlciBudW1iZXIuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJhcHByb3ZlX2Zvcl9hbGwiLCBvd25lcjogQWRkcmVzc11gCiogZGF0YSAtIGBbb3BlcmF0b3I6IEFkZHJlc3MsIGxpdmVfdW50aWxfbGVkZ2VyOiB1MzJdYAAAAA9hcHByb3ZlX2Zvcl9hbGwAAAAAAwAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAhvcGVyYXRvcgAAABMAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAA=",
        "AAAAAAAAAllSZXR1cm5zIHRoZSBhY2NvdW50IGF0IHRoZSBzcGVjaWZpZWQgaW5kZXggZm9yIGEgZ2l2ZW4gcm9sZS4KCkEgZnVuY3Rpb24gdG8gZ2V0IGFsbCBtZW1iZXJzIG9mIGEgcm9sZSBpcyBub3QgcHJvdmlkZWQgYmVjYXVzZSB0aGF0CndvdWxkIGJlIHVuYm91bmRlZC4gVG8gZW51bWVyYXRlIGFsbCBtZW1iZXJzIG9mIGEgcm9sZSwgdXNlCltgQWNjZXNzQ29udHJvbDo6Z2V0X3JvbGVfbWVtYmVyX2NvdW50KClgXSB0byBnZXQgdGhlIHRvdGFsIG51bWJlciBvZgptZW1iZXJzIGFuZCB0aGVuIHVzZSBbYEFjY2Vzc0NvbnRyb2w6OmdldF9yb2xlX21lbWJlcigpYF0gdG8gcmV0cmlldmUKZWFjaCBtZW1iZXIgb25lIGJ5IG9uZS4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byBTb3JvYmFuIGVudmlyb25tZW50LgoqIGByb2xlYCAtIFRoZSByb2xlIHRvIHF1ZXJ5LgoqIGBpbmRleGAgLSBUaGUgaW5kZXggb2YgdGhlIGFjY291bnQgdG8gcmV0cmlldmUuCgojIEVycm9ycwoKKiBbYEFjY2Vzc0NvbnRyb2xFcnJvcjo6SW5kZXhPdXRPZkJvdW5kc2BdIC0gSWYgdGhlIGluZGV4IGlzIG91dCBvZgpib3VuZHMgZm9yIHRoZSByb2xlJ3MgbWVtYmVyIGxpc3QuAAAAAAAAD2dldF9yb2xlX21lbWJlcgAAAAACAAAAAAAAAARyb2xlAAAAEQAAAAAAAAAFaW5kZXgAAAAAAAAEAAAAAQAAABM=",
        "AAAAAAAAARxSZXR1cm5zIGEgdmVjdG9yIGNvbnRhaW5pbmcgYWxsIGV4aXN0aW5nIHJvbGVzLgpEZWZhdWx0cyB0byBlbXB0eSB2ZWN0b3IgaWYgbm8gcm9sZXMgZXhpc3QuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gU29yb2JhbiBlbnZpcm9ubWVudC4KCiMgTm90ZXMKClRoaXMgZnVuY3Rpb24gcmV0dXJucyBhbGwgcm9sZXMgdGhhdCBjdXJyZW50bHkgaGF2ZSBhdCBsZWFzdCBvbmUgbWVtYmVyLgpUaGUgbWF4aW11bSBudW1iZXIgb2Ygcm9sZXMgaXMgbGltaXRlZCBieSBbYE1BWF9ST0xFU2BdLgAAABJnZXRfZXhpc3Rpbmdfcm9sZXMAAAAAAAAAAAABAAAD6gAAABE=",
        "AAAAAAAAAe1SZXR1cm5zIHRoZSBgdG9rZW5faWRgIG93bmVkIGJ5IGBvd25lcmAgYXQgYSBnaXZlbiBgaW5kZXhgIGluIHRoZQpvd25lcidzIGxvY2FsIGxpc3QuIFVzZSBhbG9uZyB3aXRoCltgY3JhdGU6Om5vbl9mdW5naWJsZTo6Tm9uRnVuZ2libGVUb2tlbjo6YmFsYW5jZWBdIHRvIGVudW1lcmF0ZSBhbGwgb2YKYG93bmVyYCdzIHRva2Vucy4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgaW5kZXhgIC0gSW5kZXggb2YgdGhlIHRva2VuIGluIHRoZSBvd25lcidzIGxvY2FsIGxpc3QuCgojIEVycm9ycwoKKiBbYGNyYXRlOjpub25fZnVuZ2libGU6Ok5vbkZ1bmdpYmxlVG9rZW5FcnJvcjo6VG9rZW5Ob3RGb3VuZEluT3duZXJMaXN0YF0gLSBXaGVuIHRoZSB0b2tlbgpJRCBpcyBub3QgZm91bmQgaW4gdGhlIG93bmVyJ3MgZW51bWVyYXRpb24uAAAAAAAAEmdldF9vd25lcl90b2tlbl9pZAAAAAAAAgAAAAAAAAAFb3duZXIAAAAAAAATAAAAAAAAAAVpbmRleAAAAAAAAAQAAAABAAAABA==",
        "AAAAAAAAANdSZXR1cm5zIHdoZXRoZXIgdGhlIGBvcGVyYXRvcmAgaXMgYWxsb3dlZCB0byBtYW5hZ2UgYWxsIHRoZSBhc3NldHMgb2YKYG93bmVyYC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgb3duZXJgIC0gQWNjb3VudCBvZiB0aGUgdG9rZW4ncyBvd25lci4KKiBgb3BlcmF0b3JgIC0gQWNjb3VudCB0byBiZSBjaGVja2VkLgAAAAATaXNfYXBwcm92ZWRfZm9yX2FsbAAAAAACAAAAAAAAAAVvd25lcgAAAAAAABMAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAEAAAAB",
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
        "AAAABAAAAAAAAAAAAAAADVBhdXNhYmxlRXJyb3IAAAAAAAACAAAANFRoZSBvcGVyYXRpb24gZmFpbGVkIGJlY2F1c2UgdGhlIGNvbnRyYWN0IGlzIHBhdXNlZC4AAAANRW5mb3JjZWRQYXVzZQAAAAAAA+gAAAA4VGhlIG9wZXJhdGlvbiBmYWlsZWQgYmVjYXVzZSB0aGUgY29udHJhY3QgaXMgbm90IHBhdXNlZC4AAAANRXhwZWN0ZWRQYXVzZQAAAAAAA+k=",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBidXJuZWQuAAAAAAAAAAAAAARCdXJuAAAAAQAAAARidXJuAAAAAgAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyBtaW50ZWQuAAAAAAAAAAAAAARNaW50AAAAAQAAAARtaW50AAAAAgAAAAAAAAACdG8AAAAAABMAAAABAAAAAAAAAAh0b2tlbl9pZAAAAAQAAAAAAAAAAg==",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYW4gYXBwcm92YWwgaXMgZ3JhbnRlZC4AAAAAAAAAAAAHQXBwcm92ZQAAAAABAAAAB2FwcHJvdmUAAAAABAAAAAAAAAAIYXBwcm92ZXIAAAATAAAAAQAAAAAAAAAIdG9rZW5faWQAAAAEAAAAAQAAAAAAAAAIYXBwcm92ZWQAAAATAAAAAAAAAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAEAAAAAAAAAAI=",
        "AAAABQAAACpFdmVudCBlbWl0dGVkIHdoZW4gYSB0b2tlbiBpcyB0cmFuc2ZlcnJlZC4AAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAAAwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACHRva2VuX2lkAAAABAAAAAAAAAAC",
        "AAAABQAAADZFdmVudCBlbWl0dGVkIHdoZW4gYXBwcm92YWwgZm9yIGFsbCB0b2tlbnMgaXMgZ3JhbnRlZC4AAAAAAAAAAAANQXBwcm92ZUZvckFsbAAAAAAAAAEAAAAPYXBwcm92ZV9mb3JfYWxsAAAAAAMAAAAAAAAABW93bmVyAAAAAAAAEwAAAAEAAAAAAAAACG9wZXJhdG9yAAAAEwAAAAAAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAC",
        "AAAABAAAAAAAAAAAAAAAFU5vbkZ1bmdpYmxlVG9rZW5FcnJvcgAAAAAAAA8AAAAkSW5kaWNhdGVzIGEgbm9uLWV4aXN0ZW50IGB0b2tlbl9pZGAuAAAAEE5vbkV4aXN0ZW50VG9rZW4AAADIAAAAV0luZGljYXRlcyBhbiBlcnJvciByZWxhdGVkIHRvIHRoZSBvd25lcnNoaXAgb3ZlciBhIHBhcnRpY3VsYXIgdG9rZW4uClVzZWQgaW4gdHJhbnNmZXJzLgAAAAAOSW5jb3JyZWN0T3duZXIAAAAAAMkAAABFSW5kaWNhdGVzIGEgZmFpbHVyZSB3aXRoIHRoZSBgb3BlcmF0b3JgcyBhcHByb3ZhbC4gVXNlZCBpbiB0cmFuc2ZlcnMuAAAAAAAAFEluc3VmZmljaWVudEFwcHJvdmFsAAAAygAAAFVJbmRpY2F0ZXMgYSBmYWlsdXJlIHdpdGggdGhlIGBhcHByb3ZlcmAgb2YgYSB0b2tlbiB0byBiZSBhcHByb3ZlZC4gVXNlZAppbiBhcHByb3ZhbHMuAAAAAAAAD0ludmFsaWRBcHByb3ZlcgAAAADLAAAASkluZGljYXRlcyBhbiBpbnZhbGlkIHZhbHVlIGZvciBgbGl2ZV91bnRpbF9sZWRnZXJgIHdoZW4gc2V0dGluZwphcHByb3ZhbHMuAAAAAAAWSW52YWxpZExpdmVVbnRpbExlZGdlcgAAAAAAzAAAAClJbmRpY2F0ZXMgb3ZlcmZsb3cgd2hlbiBhZGRpbmcgdHdvIHZhbHVlcwAAAAAAAAxNYXRoT3ZlcmZsb3cAAADNAAAANkluZGljYXRlcyBhbGwgcG9zc2libGUgYHRva2VuX2lkYHMgYXJlIGFscmVhZHkgaW4gdXNlLgAAAAAAE1Rva2VuSURzQXJlRGVwbGV0ZWQAAAAAzgAAAEVJbmRpY2F0ZXMgYW4gaW52YWxpZCBhbW91bnQgdG8gYmF0Y2ggbWludCBpbiBgY29uc2VjdXRpdmVgIGV4dGVuc2lvbi4AAAAAAAANSW52YWxpZEFtb3VudAAAAAAAAM8AAAAzSW5kaWNhdGVzIHRoZSB0b2tlbiBkb2VzIG5vdCBleGlzdCBpbiBvd25lcidzIGxpc3QuAAAAABhUb2tlbk5vdEZvdW5kSW5Pd25lckxpc3QAAADQAAAAMkluZGljYXRlcyB0aGUgdG9rZW4gZG9lcyBub3QgZXhpc3QgaW4gZ2xvYmFsIGxpc3QuAAAAAAAZVG9rZW5Ob3RGb3VuZEluR2xvYmFsTGlzdAAAAAAAANEAAAAjSW5kaWNhdGVzIGFjY2VzcyB0byB1bnNldCBtZXRhZGF0YS4AAAAADVVuc2V0TWV0YWRhdGEAAAAAAADSAAAAQUluZGljYXRlcyB0aGUgbGVuZ3RoIG9mIHRoZSBiYXNlIFVSSSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAFUJhc2VVcmlNYXhMZW5FeGNlZWRlZAAAAAAAANMAAABHSW5kaWNhdGVzIHRoZSByb3lhbHR5IGFtb3VudCBpcyBoaWdoZXIgdGhhbiAxMF8wMDAgKDEwMCUpIGJhc2lzIHBvaW50cy4AAAAAFEludmFsaWRSb3lhbHR5QW1vdW50AAAA1AAAAD1JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgbmFtZSBleGNlZWRzIHRoZSBtYXhpbXVtIGFsbG93ZWQuAAAAAAAAEk5hbWVNYXhMZW5FeGNlZWRlZAAAAAAA1QAAAD9JbmRpY2F0ZXMgdGhlIGxlbmd0aCBvZiB0aGUgc3ltYm9sIGV4Y2VlZHMgdGhlIG1heGltdW0gYWxsb3dlZC4AAAAAFFN5bWJvbE1heExlbkV4Y2VlZGVkAAAA1g==" ]),
      options
    )
  }
  public readonly fromJSON = {
    tag: this.txFromJSON<Option<Buffer>>,
        burn: this.txFromJSON<null>,
        mint: this.txFromJSON<null>,
        name: this.txFromJSON<string>,
        claim: this.txFromJSON<u32>,
        pause: this.txFromJSON<null>,
        stage: this.txFromJSON<Option<string>>,
        paused: this.txFromJSON<boolean>,
        symbol: this.txFromJSON<string>,
        approve: this.txFromJSON<null>,
        balance: this.txFromJSON<u32>,
        unpause: this.txFromJSON<null>,
        upgrade: this.txFromJSON<null>,
        has_role: this.txFromJSON<Option<u32>>,
        link_tag: this.txFromJSON<null>,
        owner_of: this.txFromJSON<string>,
        producer: this.txFromJSON<Option<string>>,
        transfer: this.txFromJSON<null>,
        burn_from: this.txFromJSON<null>,
        get_admin: this.txFromJSON<Option<string>>,
        get_claim: this.txFromJSON<UnitClaim>,
        set_stage: this.txFromJSON<null>,
        token_uri: this.txFromJSON<string>,
        grant_role: this.txFromJSON<null>,
        revoke_role: this.txFromJSON<null>,
        batch_of_tag: this.txFromJSON<Option<u32>>,
        get_approved: this.txFromJSON<Option<string>>,
        get_token_id: this.txFromJSON<u32>,
        set_producer: this.txFromJSON<null>,
        total_supply: this.txFromJSON<u32>,
        claimed_units: this.txFromJSON<u32>,
        renounce_role: this.txFromJSON<null>,
        set_token_uri: this.txFromJSON<null>,
        transfer_from: this.txFromJSON<null>,
        get_role_admin: this.txFromJSON<Option<string>>,
        register_batch: this.txFromJSON<null>,
        renounce_admin: this.txFromJSON<null>,
        set_role_admin: this.txFromJSON<null>,
        approve_for_all: this.txFromJSON<null>,
        get_role_member: this.txFromJSON<string>,
        get_existing_roles: this.txFromJSON<Array<string>>,
        get_owner_token_id: this.txFromJSON<u32>,
        is_approved_for_all: this.txFromJSON<boolean>,
        transfer_admin_role: this.txFromJSON<null>,
        accept_admin_transfer: this.txFromJSON<null>,
        get_role_member_count: this.txFromJSON<u32>
  }
}