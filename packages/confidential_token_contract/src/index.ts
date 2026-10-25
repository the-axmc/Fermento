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

/** A Grumpkin curve point, `be(x) || be(y)`, 64 bytes (the spec names the BytesN<64> alias `Point`). */
export type Point = Buffer;

if (typeof window !== "undefined") {
  //@ts-ignore Buffer exists
  window.Buffer = window.Buffer || Buffer;
}




export const CryptoError = {
  /**
   * The merkle proof length is out of bounds.
   */
  1400: {message:"MerkleProofOutOfBounds"},
  /**
   * The index of the leaf is out of bounds.
   */
  1401: {message:"MerkleIndexOutOfBounds"},
  /**
   * No data in hasher state.
   */
  1402: {message:"HasherEmptyState"},
  /**
   * The point is neither the canonical identity encoding nor a canonical
   * on-curve point.
   */
  1403: {message:"InvalidPoint"}
}













export const ConfidentialTokenError = {
  /**
   * Indicates `account` already has a confidential account registered.
   */
  3500: {message:"AccountAlreadyRegistered"},
  /**
   * Indicates the target account is not registered.
   */
  3501: {message:"AccountNotRegistered"},
  /**
   * Indicates a public amount argument is negative.
   */
  3502: {message:"NegativeAmount"},
  /**
   * Indicates a delegation already exists for `(account, spender)`.
   */
  3503: {message:"DelegationAlreadyExists"},
  /**
   * Indicates no delegation exists for `(account, spender)`.
   */
  3504: {message:"DelegationNotFound"},
  /**
   * Indicates the delegation has expired
   * (`ledger.sequence() > live_until_ledger`).
   */
  3505: {message:"DelegationExpired"},
  /**
   * Indicates the verifier rejected the accompanying proof.
   */
  3506: {message:"InvalidProof"},
  /**
   * Indicates the `data` payload could not be decoded into the expected
   * `…Payload` struct.
   */
  3507: {message:"InvalidData"},
  /**
   * Indicates the contract has not been constructed: the SEP-41 token
   * address is missing.
   */
  3508: {message:"UnderlyingAssetNotSet"},
  /**
   * Indicates the contract has not been constructed: the verifier
   * address is missing.
   */
  3509: {message:"VerifierNotSet"},
  /**
   * Indicates the contract has not been constructed: the auditor
   * registry address is missing.
   */
  3510: {message:"AuditorNotSet"},
  /**
   * Indicates the contract has not been constructed: the `addr_f` field is
   * missing.
   */
  3511: {message:"AddressAsFieldNotSet"},
  /**
   * Indicates the `addr_f` field has already been set; re-initialization is
   * forbidden.
   */
  3512: {message:"AddressAsFieldAlreadySet"},
  /**
   * Indicates the SEP-41 token address has already been set;
   * re-initialization is forbidden.
   */
  3513: {message:"UnderlyingAssetAlreadySet"},
  /**
   * Indicates a prover-supplied 32-byte field representative or Grumpkin
   * coordinate is not a canonical `Bn254Fr` value (`≥ r`). The Soroban
   * host's `bn254_fr_*` deserialiser silently reduces non-canonical
   * encodings, so the contract enforces canonicality at the verifier
   * boundary to keep stored state and emitted events byte-unique per
   * logical value.
   */
  3514: {message:"NonCanonicalEncoding"}
}


/**
 * On-chain spender delegation record.
 */
export interface SpenderDelegation {
  /**
 * Poseidon-encrypted allowance scalar `ã`.
 */
a_tilde: Buffer;
  /**
 * Allowance commitment `C_a = Com(v_a, r_a)`.
 */
allowance_commitment: Point;
  /**
 * Per-delegation salt `σ_a`.
 */
allowance_salt: Buffer;
  /**
 * ECDH escrow of `dvk_i` under the spender's spending key.
 */
escrowed_dvk: Point;
  /**
 * The ledger number at which the delegation expires. Spending is
 * authorized while `ledger.sequence() <= live_until_ledger`.
 */
live_until_ledger: u32;
}


/**
 * On-chain confidential account record.
 */
export interface ConfidentialAccount {
  /**
 * Index of the auditor key in the auditor registry.
 */
auditor_id: u32;
  /**
 * Receiving balance commitment `C_receive`.
 */
receiving_commitment: Point;
  /**
 * Spendable balance commitment `C_spend`.
 */
spendable_commitment: Point;
  /**
 * `Y = sk · H`, the Grumpkin spending public key.
 */
spending_public_key: Point;
  /**
 * `PVK = vk · H`, the Grumpkin viewing public key.
 */
viewing_public_key: Point;
}

export interface Client {
  /**
   * Construct and simulate a merge transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Folds `account.receiving_commitment` into `account.spendable_commitment`
   * and resets the receiving storage entry to the identity.
   * 
   * No proof is required; correctness follows from the homomorphic
   * property of Pedersen commitments. Only the account holder can
   * authorize a merge — third parties cannot weaponize it.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The owner address.
   * 
   * # Errors
   * 
   * * refer to [`storage::merge`] errors.
   * 
   * # Events
   * 
   * * topics - `["merge", account: Address]`
   * * data - `[]`
   */
  merge: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a deposit transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Deposits `amount` units of the underlying SEP-41 token from `from`
   * into `to`'s confidential receiving balance.
   * 
   * No proof is required. The deposit commitment is `a · G` with zero
   * blinding, added homomorphically to `to.receiving_commitment`. The
   * depositor `from` does not need a registered confidential account;
   * only `to` does.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `from` - The depositor (SEP-41 holder).
   * * `to` - The confidential recipient.
   * * `amount` - The non-negative deposit amount.
   * 
   * # Errors
   * 
   * * refer to [`storage::deposit`] errors.
   * 
   * # Events
   * 
   * * topics - `["deposit", from: Address, to: Address]`
   * * data - `[amount: i128]`
   */
  deposit: ({from, to, amount}: {from: string, to: string, amount: i128}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a register transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Registers a confidential account under `account`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The owner address being registered.
   * * `auditor_id` - The auditor key index this account commits to.
   * * `data` - XDR-encoded [`RegisterData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::register`] errors.
   * 
   * # Events
   * 
   * * topics - `["register", account: Address]`
   * * data - `[auditor_id: u32]`
   */
  register: ({account, auditor_id, data}: {account: string, auditor_id: u32, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a withdraw transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Withdraws `amount` units to the public SEP-41 address `to` from the
   * confidential spendable balance of `from`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `from` - The confidential account spending the funds.
   * * `to` - The SEP-41 recipient.
   * * `amount` - The non-negative withdrawal amount.
   * * `data` - XDR-encoded [`WithdrawData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::withdraw`] errors.
   * 
   * # Events
   * 
   * * topics - `["withdraw", from: Address, to: Address]`
   * * data - `[amount: i128, r_e_point: BytesN<64>, sigma: BytesN<32>,
   * b_tilde: BytesN<32>, b_tilde_aud_s: BytesN<32>]`
   */
  withdraw: ({from, to, amount, data}: {from: string, to: string, amount: i128, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a is_spender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns `true` iff a delegation exists for `(account, spender)`
   * and is still live (`ledger.sequence() <= live_until_ledger`).
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The delegating account.
   * * `spender` - The delegated spender.
   */
  is_spender: ({account, spender}: {account: string, spender: string}, options?: MethodOptions) => Promise<AssembledTransaction<boolean>>

  /**
   * Construct and simulate a set_spender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Escrows an allowance from `account`'s spendable balance and delegates it
   * to `spender`. Reverts if a delegation already exists for the `(account,
   * spender)` pair.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The delegating owner.
   * * `spender` - The delegated spender. Must be a registered confidential
   * account so its spending key is available for the `dvk` escrow ECDH.
   * * `live_until_ledger` - The ledger number at which the delegation
   * expires. Spending is authorized while `ledger.sequence() <=
   * live_until_ledger`. The escrowed value persists until
   * `revoke_spender`.
   * * `data` - XDR-encoded [`SetSpenderData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::set_spender`] errors.
   * 
   * # Events
   * 
   * * topics - `["set_spender", account: Address, spender: Address]`
   * * data - `[live_until_ledger: u32, r_e_point, sigma, b_tilde,
   * v_tilde_aud_s, b_tilde_aud_s]`
   */
  set_spender: ({account, spender, live_until_ledger, data}: {account: string, spender: string, live_until_ledger: u32, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a revoke_spender transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Revokes the `(account, spender)` delegation and folds the
   * remaining escrowed allowance back into `account`'s spendable balance.
   * Works for both active and expired-but-not-revoked delegations.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The owner reclaiming the allowance.
   * * `spender` - The previously-delegated spender.
   * * `data` - XDR-encoded [`RevokeSpenderData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::revoke_spender`] errors.
   * 
   * # Events
   * 
   * * topics - `["revoke_spender", account: Address, spender: Address]`
   * * data - `[r_e_point, sigma, b_tilde, v_tilde_aud_s, b_tilde_aud_s]`
   */
  revoke_spender: ({account, spender, data}: {account: string, spender: string, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a confidential_balance transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the [`ConfidentialAccount`] stored under `account`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The owner address.
   * 
   * # Errors
   * 
   * * refer to [`storage::get_account`] errors.
   */
  confidential_balance: ({account}: {account: string}, options?: MethodOptions) => Promise<AssembledTransaction<ConfidentialAccount>>

  /**
   * Construct and simulate a confidential_transfer transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Sends a confidential transfer from `from` to `to`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `from` - The sender.
   * * `to` - The recipient.
   * * `data` - XDR-encoded [`TransferData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::confidential_transfer`] errors.
   * 
   * # Events
   * 
   * * topics - `["transfer", from: Address, to: Address]`
   * * data - `[r_e_point, v_tilde, sigma, b_tilde, v_tilde_aud_r,
   * r_tilde_aud_r, v_tilde_aud_s, b_tilde_aud_s]`
   */
  confidential_transfer: ({from, to, data}: {from: string, to: string, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

  /**
   * Construct and simulate a get_spender_delegation transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Returns the [`SpenderDelegation`] stored under `(account,
   * spender)`.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `account` - The delegating account.
   * * `spender` - The delegated spender.
   * 
   * # Errors
   * 
   * * refer to [`storage::get_spender_delegation`] errors.
   */
  get_spender_delegation: ({account, spender}: {account: string, spender: string}, options?: MethodOptions) => Promise<AssembledTransaction<SpenderDelegation>>

  /**
   * Construct and simulate a confidential_transfer_from transaction. Returns an `AssembledTransaction` object which will have a `result` field containing the result of the simulation. If this transaction changes contract state, you will need to call `signAndSend()` on the returned object.
   * Spends from `from`'s allowance escrowed to `spender`, transferring
   * confidentially to `to`. The owner's authorization was
   * granted at `set_spender` and persists in the on-chain delegation
   * entry; only the spender authorizes this call.
   * 
   * # Arguments
   * 
   * * `e` - Access to the Soroban environment.
   * * `spender` - The delegated spender (the auth principal).
   * * `from` - The owner whose allowance is being spent.
   * * `to` - The recipient.
   * * `data` - XDR-encoded [`SpenderTransferData`].
   * 
   * # Errors
   * 
   * * refer to [`storage::decode_data`] errors.
   * * refer to [`storage::confidential_transfer_from`] errors.
   * 
   * # Events
   * 
   * * topics - `["spender_transfer", spender: Address, from: Address, to:
   * Address]`
   * * data - `[r_e_point, v_tilde, sigma_a, v_tilde_aud_r, r_tilde_aud_r,
   * v_tilde_aud_s, a_tilde_aud_s]`
   */
  confidential_transfer_from: ({spender, from, to, data}: {spender: string, from: string, to: string, data: Buffer}, options?: MethodOptions) => Promise<AssembledTransaction<null>>

}
export class Client extends ContractClient {
  static async deploy<T = Client>(
        /** Constructor/Initialization Args for the contract's `__constructor` method */
        {underlying_asset, verifier, auditor}: {underlying_asset: string, verifier: string, auditor: string},
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
    return ContractClient.deploy({underlying_asset, verifier, auditor}, options)
  }
  constructor(public readonly options: ContractClientOptions) {
    super(
      new ContractSpec([ "AAAAAAAAAgRGb2xkcyBgYWNjb3VudC5yZWNlaXZpbmdfY29tbWl0bWVudGAgaW50byBgYWNjb3VudC5zcGVuZGFibGVfY29tbWl0bWVudGAKYW5kIHJlc2V0cyB0aGUgcmVjZWl2aW5nIHN0b3JhZ2UgZW50cnkgdG8gdGhlIGlkZW50aXR5LgoKTm8gcHJvb2YgaXMgcmVxdWlyZWQ7IGNvcnJlY3RuZXNzIGZvbGxvd3MgZnJvbSB0aGUgaG9tb21vcnBoaWMKcHJvcGVydHkgb2YgUGVkZXJzZW4gY29tbWl0bWVudHMuIE9ubHkgdGhlIGFjY291bnQgaG9sZGVyIGNhbgphdXRob3JpemUgYSBtZXJnZSDigJQgdGhpcmQgcGFydGllcyBjYW5ub3Qgd2VhcG9uaXplIGl0LgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBvd25lciBhZGRyZXNzLgoKIyBFcnJvcnMKCiogcmVmZXIgdG8gW2BzdG9yYWdlOjptZXJnZWBdIGVycm9ycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbIm1lcmdlIiwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbXWAAAAAFbWVyZ2UAAAAAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAAA",
        "AAAAAAAAAolEZXBvc2l0cyBgYW1vdW50YCB1bml0cyBvZiB0aGUgdW5kZXJseWluZyBTRVAtNDEgdG9rZW4gZnJvbSBgZnJvbWAKaW50byBgdG9gJ3MgY29uZmlkZW50aWFsIHJlY2VpdmluZyBiYWxhbmNlLgoKTm8gcHJvb2YgaXMgcmVxdWlyZWQuIFRoZSBkZXBvc2l0IGNvbW1pdG1lbnQgaXMgYGEgwrcgR2Agd2l0aCB6ZXJvCmJsaW5kaW5nLCBhZGRlZCBob21vbW9ycGhpY2FsbHkgdG8gYHRvLnJlY2VpdmluZ19jb21taXRtZW50YC4gVGhlCmRlcG9zaXRvciBgZnJvbWAgZG9lcyBub3QgbmVlZCBhIHJlZ2lzdGVyZWQgY29uZmlkZW50aWFsIGFjY291bnQ7Cm9ubHkgYHRvYCBkb2VzLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBmcm9tYCAtIFRoZSBkZXBvc2l0b3IgKFNFUC00MSBob2xkZXIpLgoqIGB0b2AgLSBUaGUgY29uZmlkZW50aWFsIHJlY2lwaWVudC4KKiBgYW1vdW50YCAtIFRoZSBub24tbmVnYXRpdmUgZGVwb3NpdCBhbW91bnQuCgojIEVycm9ycwoKKiByZWZlciB0byBbYHN0b3JhZ2U6OmRlcG9zaXRgXSBlcnJvcnMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJkZXBvc2l0IiwgZnJvbTogQWRkcmVzcywgdG86IEFkZHJlc3NdYAoqIGRhdGEgLSBgW2Ftb3VudDogaTEyOF1gAAAAAAAAB2RlcG9zaXQAAAAAAwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAAZhbW91bnQAAAAAAAsAAAAA",
        "AAAAAAAAAblSZWdpc3RlcnMgYSBjb25maWRlbnRpYWwgYWNjb3VudCB1bmRlciBgYWNjb3VudGAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYGFjY291bnRgIC0gVGhlIG93bmVyIGFkZHJlc3MgYmVpbmcgcmVnaXN0ZXJlZC4KKiBgYXVkaXRvcl9pZGAgLSBUaGUgYXVkaXRvciBrZXkgaW5kZXggdGhpcyBhY2NvdW50IGNvbW1pdHMgdG8uCiogYGRhdGFgIC0gWERSLWVuY29kZWQgW2BSZWdpc3RlckRhdGFgXS4KCiMgRXJyb3JzCgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6ZGVjb2RlX2RhdGFgXSBlcnJvcnMuCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpyZWdpc3RlcmBdIGVycm9ycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInJlZ2lzdGVyIiwgYWNjb3VudDogQWRkcmVzc11gCiogZGF0YSAtIGBbYXVkaXRvcl9pZDogdTMyXWAAAAAAAAAIcmVnaXN0ZXIAAAADAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAACmF1ZGl0b3JfaWQAAAAAAAQAAAAAAAAABGRhdGEAAAAOAAAAAA==",
        "AAAAAAAAAmxXaXRoZHJhd3MgYGFtb3VudGAgdW5pdHMgdG8gdGhlIHB1YmxpYyBTRVAtNDEgYWRkcmVzcyBgdG9gIGZyb20gdGhlCmNvbmZpZGVudGlhbCBzcGVuZGFibGUgYmFsYW5jZSBvZiBgZnJvbWAuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYGZyb21gIC0gVGhlIGNvbmZpZGVudGlhbCBhY2NvdW50IHNwZW5kaW5nIHRoZSBmdW5kcy4KKiBgdG9gIC0gVGhlIFNFUC00MSByZWNpcGllbnQuCiogYGFtb3VudGAgLSBUaGUgbm9uLW5lZ2F0aXZlIHdpdGhkcmF3YWwgYW1vdW50LgoqIGBkYXRhYCAtIFhEUi1lbmNvZGVkIFtgV2l0aGRyYXdEYXRhYF0uCgojIEVycm9ycwoKKiByZWZlciB0byBbYHN0b3JhZ2U6OmRlY29kZV9kYXRhYF0gZXJyb3JzLgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6d2l0aGRyYXdgXSBlcnJvcnMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ3aXRoZHJhdyIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFthbW91bnQ6IGkxMjgsIHJfZV9wb2ludDogQnl0ZXNOPDY0Piwgc2lnbWE6IEJ5dGVzTjwzMj4sCmJfdGlsZGU6IEJ5dGVzTjwzMj4sIGJfdGlsZGVfYXVkX3M6IEJ5dGVzTjwzMj5dYAAAAAh3aXRoZHJhdwAAAAQAAAAAAAAABGZyb20AAAATAAAAAAAAAAJ0bwAAAAAAEwAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAARkYXRhAAAADgAAAAA=",
        "AAAAAAAAAQFSZXR1cm5zIGB0cnVlYCBpZmYgYSBkZWxlZ2F0aW9uIGV4aXN0cyBmb3IgYChhY2NvdW50LCBzcGVuZGVyKWAKYW5kIGlzIHN0aWxsIGxpdmUgKGBsZWRnZXIuc2VxdWVuY2UoKSA8PSBsaXZlX3VudGlsX2xlZGdlcmApLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBkZWxlZ2F0aW5nIGFjY291bnQuCiogYHNwZW5kZXJgIC0gVGhlIGRlbGVnYXRlZCBzcGVuZGVyLgAAAAAAAAppc19zcGVuZGVyAAAAAAACAAAAAAAAAAdhY2NvdW50AAAAABMAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAB",
        "AAAAAAAAA4VFc2Nyb3dzIGFuIGFsbG93YW5jZSBmcm9tIGBhY2NvdW50YCdzIHNwZW5kYWJsZSBiYWxhbmNlIGFuZCBkZWxlZ2F0ZXMgaXQKdG8gYHNwZW5kZXJgLiBSZXZlcnRzIGlmIGEgZGVsZWdhdGlvbiBhbHJlYWR5IGV4aXN0cyBmb3IgdGhlIGAoYWNjb3VudCwKc3BlbmRlcilgIHBhaXIuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYGFjY291bnRgIC0gVGhlIGRlbGVnYXRpbmcgb3duZXIuCiogYHNwZW5kZXJgIC0gVGhlIGRlbGVnYXRlZCBzcGVuZGVyLiBNdXN0IGJlIGEgcmVnaXN0ZXJlZCBjb25maWRlbnRpYWwKYWNjb3VudCBzbyBpdHMgc3BlbmRpbmcga2V5IGlzIGF2YWlsYWJsZSBmb3IgdGhlIGBkdmtgIGVzY3JvdyBFQ0RILgoqIGBsaXZlX3VudGlsX2xlZGdlcmAgLSBUaGUgbGVkZ2VyIG51bWJlciBhdCB3aGljaCB0aGUgZGVsZWdhdGlvbgpleHBpcmVzLiBTcGVuZGluZyBpcyBhdXRob3JpemVkIHdoaWxlIGBsZWRnZXIuc2VxdWVuY2UoKSA8PQpsaXZlX3VudGlsX2xlZGdlcmAuIFRoZSBlc2Nyb3dlZCB2YWx1ZSBwZXJzaXN0cyB1bnRpbApgcmV2b2tlX3NwZW5kZXJgLgoqIGBkYXRhYCAtIFhEUi1lbmNvZGVkIFtgU2V0U3BlbmRlckRhdGFgXS4KCiMgRXJyb3JzCgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6ZGVjb2RlX2RhdGFgXSBlcnJvcnMuCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpzZXRfc3BlbmRlcmBdIGVycm9ycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInNldF9zcGVuZGVyIiwgYWNjb3VudDogQWRkcmVzcywgc3BlbmRlcjogQWRkcmVzc11gCiogZGF0YSAtIGBbbGl2ZV91bnRpbF9sZWRnZXI6IHUzMiwgcl9lX3BvaW50LCBzaWdtYSwgYl90aWxkZSwKdl90aWxkZV9hdWRfcywgYl90aWxkZV9hdWRfc11gAAAAAAAAC3NldF9zcGVuZGVyAAAAAAQAAAAAAAAAB2FjY291bnQAAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAAAAABFsaXZlX3VudGlsX2xlZGdlcgAAAAAAAAQAAAAAAAAABGRhdGEAAAAOAAAAAA==",
        "AAAAAAAAALtCaW5kcyB0aGUgdW5kZXJseWluZyBTRVAtNDEgYXNzZXQsIHRoZSB2ZXJpZmllciByZWdpc3RyeSwgYW5kIHRoZQphdWRpdG9yIHJlZ2lzdHJ5LCB0aGVuIGZyZWV6ZXMgdGhlIGNvbnRyYWN0J3MgYWRkcmVzcy1hcy1maWVsZCB2YWx1ZQp1c2VkIHRvIGRvbWFpbi1zZXBhcmF0ZSBldmVyeSBhY2NvdW50J3Mgdmlld2luZyBrZXkuAAAAAA1fX2NvbnN0cnVjdG9yAAAAAAAAAwAAAAAAAAAQdW5kZXJseWluZ19hc3NldAAAABMAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAAHYXVkaXRvcgAAAAATAAAAAA==",
        "AAAAAAAAAoFSZXZva2VzIHRoZSBgKGFjY291bnQsIHNwZW5kZXIpYCBkZWxlZ2F0aW9uIGFuZCBmb2xkcyB0aGUKcmVtYWluaW5nIGVzY3Jvd2VkIGFsbG93YW5jZSBiYWNrIGludG8gYGFjY291bnRgJ3Mgc3BlbmRhYmxlIGJhbGFuY2UuCldvcmtzIGZvciBib3RoIGFjdGl2ZSBhbmQgZXhwaXJlZC1idXQtbm90LXJldm9rZWQgZGVsZWdhdGlvbnMuCgojIEFyZ3VtZW50cwoKKiBgZWAgLSBBY2Nlc3MgdG8gdGhlIFNvcm9iYW4gZW52aXJvbm1lbnQuCiogYGFjY291bnRgIC0gVGhlIG93bmVyIHJlY2xhaW1pbmcgdGhlIGFsbG93YW5jZS4KKiBgc3BlbmRlcmAgLSBUaGUgcHJldmlvdXNseS1kZWxlZ2F0ZWQgc3BlbmRlci4KKiBgZGF0YWAgLSBYRFItZW5jb2RlZCBbYFJldm9rZVNwZW5kZXJEYXRhYF0uCgojIEVycm9ycwoKKiByZWZlciB0byBbYHN0b3JhZ2U6OmRlY29kZV9kYXRhYF0gZXJyb3JzLgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6cmV2b2tlX3NwZW5kZXJgXSBlcnJvcnMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJyZXZva2Vfc3BlbmRlciIsIGFjY291bnQ6IEFkZHJlc3MsIHNwZW5kZXI6IEFkZHJlc3NdYAoqIGRhdGEgLSBgW3JfZV9wb2ludCwgc2lnbWEsIGJfdGlsZGUsIHZfdGlsZGVfYXVkX3MsIGJfdGlsZGVfYXVkX3NdYAAAAAAAAA5yZXZva2Vfc3BlbmRlcgAAAAAAAwAAAAAAAAAHYWNjb3VudAAAAAATAAAAAAAAAAdzcGVuZGVyAAAAABMAAAAAAAAABGRhdGEAAAAOAAAAAA==",
        "AAAAAAAAAMxSZXR1cm5zIHRoZSBbYENvbmZpZGVudGlhbEFjY291bnRgXSBzdG9yZWQgdW5kZXIgYGFjY291bnRgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBvd25lciBhZGRyZXNzLgoKIyBFcnJvcnMKCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpnZXRfYWNjb3VudGBdIGVycm9ycy4AAAAUY29uZmlkZW50aWFsX2JhbGFuY2UAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAH0AAAABNDb25maWRlbnRpYWxBY2NvdW50AA==",
        "AAAAAAAAAd1TZW5kcyBhIGNvbmZpZGVudGlhbCB0cmFuc2ZlciBmcm9tIGBmcm9tYCB0byBgdG9gLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBmcm9tYCAtIFRoZSBzZW5kZXIuCiogYHRvYCAtIFRoZSByZWNpcGllbnQuCiogYGRhdGFgIC0gWERSLWVuY29kZWQgW2BUcmFuc2ZlckRhdGFgXS4KCiMgRXJyb3JzCgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6ZGVjb2RlX2RhdGFgXSBlcnJvcnMuCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpjb25maWRlbnRpYWxfdHJhbnNmZXJgXSBlcnJvcnMuCgojIEV2ZW50cwoKKiB0b3BpY3MgLSBgWyJ0cmFuc2ZlciIsIGZyb206IEFkZHJlc3MsIHRvOiBBZGRyZXNzXWAKKiBkYXRhIC0gYFtyX2VfcG9pbnQsIHZfdGlsZGUsIHNpZ21hLCBiX3RpbGRlLCB2X3RpbGRlX2F1ZF9yLApyX3RpbGRlX2F1ZF9yLCB2X3RpbGRlX2F1ZF9zLCBiX3RpbGRlX2F1ZF9zXWAAAAAAAAAVY29uZmlkZW50aWFsX3RyYW5zZmVyAAAAAAAAAwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAARkYXRhAAAADgAAAAA=",
        "AAAAAAAAAQpSZXR1cm5zIHRoZSBbYFNwZW5kZXJEZWxlZ2F0aW9uYF0gc3RvcmVkIHVuZGVyIGAoYWNjb3VudCwKc3BlbmRlcilgLgoKIyBBcmd1bWVudHMKCiogYGVgIC0gQWNjZXNzIHRvIHRoZSBTb3JvYmFuIGVudmlyb25tZW50LgoqIGBhY2NvdW50YCAtIFRoZSBkZWxlZ2F0aW5nIGFjY291bnQuCiogYHNwZW5kZXJgIC0gVGhlIGRlbGVnYXRlZCBzcGVuZGVyLgoKIyBFcnJvcnMKCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpnZXRfc3BlbmRlcl9kZWxlZ2F0aW9uYF0gZXJyb3JzLgAAAAAAFmdldF9zcGVuZGVyX2RlbGVnYXRpb24AAAAAAAIAAAAAAAAAB2FjY291bnQAAAAAEwAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAB9AAAAARU3BlbmRlckRlbGVnYXRpb24AAAA=",
        "AAAAAAAAAwlTcGVuZHMgZnJvbSBgZnJvbWAncyBhbGxvd2FuY2UgZXNjcm93ZWQgdG8gYHNwZW5kZXJgLCB0cmFuc2ZlcnJpbmcKY29uZmlkZW50aWFsbHkgdG8gYHRvYC4gVGhlIG93bmVyJ3MgYXV0aG9yaXphdGlvbiB3YXMKZ3JhbnRlZCBhdCBgc2V0X3NwZW5kZXJgIGFuZCBwZXJzaXN0cyBpbiB0aGUgb24tY2hhaW4gZGVsZWdhdGlvbgplbnRyeTsgb25seSB0aGUgc3BlbmRlciBhdXRob3JpemVzIHRoaXMgY2FsbC4KCiMgQXJndW1lbnRzCgoqIGBlYCAtIEFjY2VzcyB0byB0aGUgU29yb2JhbiBlbnZpcm9ubWVudC4KKiBgc3BlbmRlcmAgLSBUaGUgZGVsZWdhdGVkIHNwZW5kZXIgKHRoZSBhdXRoIHByaW5jaXBhbCkuCiogYGZyb21gIC0gVGhlIG93bmVyIHdob3NlIGFsbG93YW5jZSBpcyBiZWluZyBzcGVudC4KKiBgdG9gIC0gVGhlIHJlY2lwaWVudC4KKiBgZGF0YWAgLSBYRFItZW5jb2RlZCBbYFNwZW5kZXJUcmFuc2ZlckRhdGFgXS4KCiMgRXJyb3JzCgoqIHJlZmVyIHRvIFtgc3RvcmFnZTo6ZGVjb2RlX2RhdGFgXSBlcnJvcnMuCiogcmVmZXIgdG8gW2BzdG9yYWdlOjpjb25maWRlbnRpYWxfdHJhbnNmZXJfZnJvbWBdIGVycm9ycy4KCiMgRXZlbnRzCgoqIHRvcGljcyAtIGBbInNwZW5kZXJfdHJhbnNmZXIiLCBzcGVuZGVyOiBBZGRyZXNzLCBmcm9tOiBBZGRyZXNzLCB0bzoKQWRkcmVzc11gCiogZGF0YSAtIGBbcl9lX3BvaW50LCB2X3RpbGRlLCBzaWdtYV9hLCB2X3RpbGRlX2F1ZF9yLCByX3RpbGRlX2F1ZF9yLAp2X3RpbGRlX2F1ZF9zLCBhX3RpbGRlX2F1ZF9zXWAAAAAAAAAaY29uZmlkZW50aWFsX3RyYW5zZmVyX2Zyb20AAAAAAAQAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAAAAAAEZnJvbQAAABMAAAAAAAAAAnRvAAAAAAATAAAAAAAAAARkYXRhAAAADgAAAAA=",
        "AAAABAAAAAAAAAAAAAAAC0NyeXB0b0Vycm9yAAAAAAQAAAApVGhlIG1lcmtsZSBwcm9vZiBsZW5ndGggaXMgb3V0IG9mIGJvdW5kcy4AAAAAAAAWTWVya2xlUHJvb2ZPdXRPZkJvdW5kcwAAAAAFeAAAACdUaGUgaW5kZXggb2YgdGhlIGxlYWYgaXMgb3V0IG9mIGJvdW5kcy4AAAAAFk1lcmtsZUluZGV4T3V0T2ZCb3VuZHMAAAAABXkAAAAYTm8gZGF0YSBpbiBoYXNoZXIgc3RhdGUuAAAAEEhhc2hlckVtcHR5U3RhdGUAAAV6AAAAVFRoZSBwb2ludCBpcyBuZWl0aGVyIHRoZSBjYW5vbmljYWwgaWRlbnRpdHkgZW5jb2Rpbmcgbm9yIGEgY2Fub25pY2FsCm9uLWN1cnZlIHBvaW50LgAAAAxJbnZhbGlkUG9pbnQAAAV7",
        "AAAABQAAAGJFdmVudCBlbWl0dGVkIHdoZW4gYSBjb25maWRlbnRpYWwgYWNjb3VudCBtZXJnZXMgaXRzIHJlY2VpdmluZyBiYWxhbmNlCmludG8gaXRzIHNwZW5kYWJsZSBiYWxhbmNlLgAAAAAAAAAAAAVNZXJnZQAAAAAAAAEAAAAFbWVyZ2UAAAAAAAABAAAAAAAAAAdhY2NvdW50AAAAABMAAAABAAAAAg==",
        "AAAABQAAAFdFdmVudCBlbWl0dGVkIHdoZW4gYSBkZXBvc2l0IG1vdmVzIFNFUC00MSB0b2tlbnMgaW50byBhIGNvbmZpZGVudGlhbApyZWNlaXZpbmcgYmFsYW5jZS4AAAAAAAAAAAdEZXBvc2l0AAAAAAEAAAAHZGVwb3NpdAAAAAADAAAAAAAAAARmcm9tAAAAEwAAAAEAAAAAAAAAAnRvAAAAAAATAAAAAQAAAAAAAAAGYW1vdW50AAAAAAALAAAAAAAAAAI=",
        "AAAABQAAADhFdmVudCBlbWl0dGVkIHdoZW4gYSBjb25maWRlbnRpYWwgYWNjb3VudCBpcyByZWdpc3RlcmVkLgAAAAAAAAAIUmVnaXN0ZXIAAAABAAAACHJlZ2lzdGVyAAAAAgAAAAAAAAAHYWNjb3VudAAAAAATAAAAAQAAAAAAAAAKYXVkaXRvcl9pZAAAAAAABAAAAAAAAAAC",
        "AAAABQAAAClFdmVudCBlbWl0dGVkIG9uIGEgY29uZmlkZW50aWFsIHRyYW5zZmVyLgAAAAAAAAAAAAAIVHJhbnNmZXIAAAABAAAACHRyYW5zZmVyAAAACgAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACXJfZV9wb2ludAAAAAAAA+4AAABAAAAAAAAAAAAAAAAHdl90aWxkZQAAAAPuAAAAIAAAAAAAAAAAAAAABXNpZ21hAAAAAAAD7gAAACAAAAAAAAAAAAAAAAdiX3RpbGRlAAAAA+4AAAAgAAAAAAAAAAAAAAANdl90aWxkZV9hdWRfcgAAAAAAA+4AAAAgAAAAAAAAAAAAAAANcl90aWxkZV9hdWRfcgAAAAAAA+4AAAAgAAAAAAAAAAAAAAANdl90aWxkZV9hdWRfcwAAAAAAA+4AAAAgAAAAAAAAAAAAAAANYl90aWxkZV9hdWRfcwAAAAAAA+4AAAAgAAAAAAAAAAI=",
        "AAAABQAAACtFdmVudCBlbWl0dGVkIG9uIGEgY29uZmlkZW50aWFsIHdpdGhkcmF3YWwuAAAAAAAAAAAIV2l0aGRyYXcAAAABAAAACHdpdGhkcmF3AAAABwAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAABmFtb3VudAAAAAAACwAAAAAAAAAAAAAACXJfZV9wb2ludAAAAAAAA+4AAABAAAAAAAAAAAAAAAAFc2lnbWEAAAAAAAPuAAAAIAAAAAAAAAAAAAAAB2JfdGlsZGUAAAAD7gAAACAAAAAAAAAAAAAAAA1iX3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAIZFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGF1ZGl0b3IgcmVnaXN0cnkgY29udHJhY3QgYWRkcmVzcyBpcyBzZXQgb3IKcm90YXRlZC4gTWF5IGZpcmUgbW9yZSB0aGFuIG9uY2Ugb3ZlciB0aGUgbGlmZXRpbWUgb2YgdGhlIGNvbnRyYWN0LgAAAAAAAAAAAApBdWRpdG9yU2V0AAAAAAABAAAAC2F1ZGl0b3Jfc2V0AAAAAAEAAAAAAAAAB2F1ZGl0b3IAAAAAEwAAAAAAAAAC",
        "AAAABQAAAChFdmVudCBlbWl0dGVkIHdoZW4gYW4gc3BlbmRlciBpcyBzZXQgdXAuAAAAAAAAAApTZXRTcGVuZGVyAAAAAAABAAAAC3NldF9zcGVuZGVyAAAAAAgAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAAAAAAEWxpdmVfdW50aWxfbGVkZ2VyAAAAAAAABAAAAAAAAAAAAAAACXJfZV9wb2ludAAAAAAAA+4AAABAAAAAAAAAAAAAAAAFc2lnbWEAAAAAAAPuAAAAIAAAAAAAAAAAAAAAB2JfdGlsZGUAAAAD7gAAACAAAAAAAAAAAAAAAA12X3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAAAAAA1iX3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAIdFdmVudCBlbWl0dGVkIHdoZW4gdGhlIHZlcmlmaWVyIHJlZ2lzdHJ5IGNvbnRyYWN0IGFkZHJlc3MgaXMgc2V0IG9yCnJvdGF0ZWQuIE1heSBmaXJlIG1vcmUgdGhhbiBvbmNlIG92ZXIgdGhlIGxpZmV0aW1lIG9mIHRoZSBjb250cmFjdC4AAAAAAAAAAAtWZXJpZmllclNldAAAAAABAAAADHZlcmlmaWVyX3NldAAAAAEAAAAAAAAACHZlcmlmaWVyAAAAEwAAAAAAAAAC",
        "AAAABQAAAClFdmVudCBlbWl0dGVkIHdoZW4gYW4gc3BlbmRlciBpcyByZXZva2VkLgAAAAAAAAAAAAANUmV2b2tlU3BlbmRlcgAAAAAAAAEAAAAOcmV2b2tlX3NwZW5kZXIAAAAAAAcAAAAAAAAAB2FjY291bnQAAAAAEwAAAAEAAAAAAAAAB3NwZW5kZXIAAAAAEwAAAAEAAAAAAAAACXJfZV9wb2ludAAAAAAAA+4AAABAAAAAAAAAAAAAAAAFc2lnbWEAAAAAAAPuAAAAIAAAAAAAAAAAAAAAB2JfdGlsZGUAAAAD7gAAACAAAAAAAAAAAAAAAA12X3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAAAAAA1iX3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAACVFdmVudCBlbWl0dGVkIG9uIGFuIHNwZW5kZXIgdHJhbnNmZXIuAAAAAAAAAAAAAA9TcGVuZGVyVHJhbnNmZXIAAAAAAQAAABBzcGVuZGVyX3RyYW5zZmVyAAAACgAAAAAAAAAHc3BlbmRlcgAAAAATAAAAAQAAAAAAAAAEZnJvbQAAABMAAAABAAAAAAAAAAJ0bwAAAAAAEwAAAAEAAAAAAAAACXJfZV9wb2ludAAAAAAAA+4AAABAAAAAAAAAAAAAAAAHdl90aWxkZQAAAAPuAAAAIAAAAAAAAAAAAAAAB3NpZ21hX2EAAAAD7gAAACAAAAAAAAAAAAAAAA12X3RpbGRlX2F1ZF9yAAAAAAAD7gAAACAAAAAAAAAAAAAAAA1yX3RpbGRlX2F1ZF9yAAAAAAAD7gAAACAAAAAAAAAAAAAAAA12X3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAAAAAA1hX3RpbGRlX2F1ZF9zAAAAAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAJNFdmVudCBlbWl0dGVkIHdoZW4gdGhlIGNvbnRyYWN0J3MgY29tcHJlc3NlZCBgYWRkcl9mYCBmaWVsZCBpcyBjb21wdXRlZCBhbmQKc3RvcmVkLiBFeHBlY3RlZCB0byBmaXJlIGV4YWN0bHkgb25jZSwgZnJvbSB0aGUgY29udHJhY3QncyBjb25zdHJ1Y3Rvci4AAAAAAAAAABFBZGRyZXNzQXNGaWVsZFNldAAAAAAAAAEAAAAUYWRkcmVzc19hc19maWVsZF9zZXQAAAABAAAAAAAAABBhZGRyZXNzX2FzX2ZpZWxkAAAD7gAAACAAAAAAAAAAAg==",
        "AAAABQAAAHNFdmVudCBlbWl0dGVkIHdoZW4gdGhlIFNFUC00MSB0b2tlbiBhZGRyZXNzIGlzIHNldC4gRXhwZWN0ZWQgdG8gZmlyZQpleGFjdGx5IG9uY2UsIGZyb20gdGhlIGNvbnRyYWN0J3MgY29uc3RydWN0b3IuAAAAAAAAAAASVW5kZXJseWluZ0Fzc2V0U2V0AAAAAAABAAAAFHVuZGVybHlpbmdfYXNzZXRfc2V0AAAAAQAAAAAAAAAQdW5kZXJseWluZ19hc3NldAAAABMAAAAAAAAAAg==",
        "AAAABAAAAAAAAAAAAAAAFkNvbmZpZGVudGlhbFRva2VuRXJyb3IAAAAAAA8AAABCSW5kaWNhdGVzIGBhY2NvdW50YCBhbHJlYWR5IGhhcyBhIGNvbmZpZGVudGlhbCBhY2NvdW50IHJlZ2lzdGVyZWQuAAAAAAAYQWNjb3VudEFscmVhZHlSZWdpc3RlcmVkAAANrAAAAC9JbmRpY2F0ZXMgdGhlIHRhcmdldCBhY2NvdW50IGlzIG5vdCByZWdpc3RlcmVkLgAAAAAUQWNjb3VudE5vdFJlZ2lzdGVyZWQAAA2tAAAAL0luZGljYXRlcyBhIHB1YmxpYyBhbW91bnQgYXJndW1lbnQgaXMgbmVnYXRpdmUuAAAAAA5OZWdhdGl2ZUFtb3VudAAAAAANrgAAAD9JbmRpY2F0ZXMgYSBkZWxlZ2F0aW9uIGFscmVhZHkgZXhpc3RzIGZvciBgKGFjY291bnQsIHNwZW5kZXIpYC4AAAAAF0RlbGVnYXRpb25BbHJlYWR5RXhpc3RzAAAADa8AAAA4SW5kaWNhdGVzIG5vIGRlbGVnYXRpb24gZXhpc3RzIGZvciBgKGFjY291bnQsIHNwZW5kZXIpYC4AAAASRGVsZWdhdGlvbk5vdEZvdW5kAAAAAA2wAAAAT0luZGljYXRlcyB0aGUgZGVsZWdhdGlvbiBoYXMgZXhwaXJlZAooYGxlZGdlci5zZXF1ZW5jZSgpID4gbGl2ZV91bnRpbF9sZWRnZXJgKS4AAAAAEURlbGVnYXRpb25FeHBpcmVkAAAAAAANsQAAADdJbmRpY2F0ZXMgdGhlIHZlcmlmaWVyIHJlamVjdGVkIHRoZSBhY2NvbXBhbnlpbmcgcHJvb2YuAAAAAAxJbnZhbGlkUHJvb2YAAA2yAAAAWEluZGljYXRlcyB0aGUgYGRhdGFgIHBheWxvYWQgY291bGQgbm90IGJlIGRlY29kZWQgaW50byB0aGUgZXhwZWN0ZWQKYOKAplBheWxvYWRgIHN0cnVjdC4AAAALSW52YWxpZERhdGEAAAANswAAAFVJbmRpY2F0ZXMgdGhlIGNvbnRyYWN0IGhhcyBub3QgYmVlbiBjb25zdHJ1Y3RlZDogdGhlIFNFUC00MSB0b2tlbgphZGRyZXNzIGlzIG1pc3NpbmcuAAAAAAAAFVVuZGVybHlpbmdBc3NldE5vdFNldAAAAAAADbQAAABRSW5kaWNhdGVzIHRoZSBjb250cmFjdCBoYXMgbm90IGJlZW4gY29uc3RydWN0ZWQ6IHRoZSB2ZXJpZmllcgphZGRyZXNzIGlzIG1pc3NpbmcuAAAAAAAADlZlcmlmaWVyTm90U2V0AAAAAA21AAAAWUluZGljYXRlcyB0aGUgY29udHJhY3QgaGFzIG5vdCBiZWVuIGNvbnN0cnVjdGVkOiB0aGUgYXVkaXRvcgpyZWdpc3RyeSBhZGRyZXNzIGlzIG1pc3NpbmcuAAAAAAAADUF1ZGl0b3JOb3RTZXQAAAAAAA22AAAAT0luZGljYXRlcyB0aGUgY29udHJhY3QgaGFzIG5vdCBiZWVuIGNvbnN0cnVjdGVkOiB0aGUgYGFkZHJfZmAgZmllbGQgaXMKbWlzc2luZy4AAAAAFEFkZHJlc3NBc0ZpZWxkTm90U2V0AAANtwAAAFJJbmRpY2F0ZXMgdGhlIGBhZGRyX2ZgIGZpZWxkIGhhcyBhbHJlYWR5IGJlZW4gc2V0OyByZS1pbml0aWFsaXphdGlvbiBpcwpmb3JiaWRkZW4uAAAAAAAYQWRkcmVzc0FzRmllbGRBbHJlYWR5U2V0AAANuAAAAFhJbmRpY2F0ZXMgdGhlIFNFUC00MSB0b2tlbiBhZGRyZXNzIGhhcyBhbHJlYWR5IGJlZW4gc2V0OwpyZS1pbml0aWFsaXphdGlvbiBpcyBmb3JiaWRkZW4uAAAAGVVuZGVybHlpbmdBc3NldEFscmVhZHlTZXQAAAAAAA25AAABWkluZGljYXRlcyBhIHByb3Zlci1zdXBwbGllZCAzMi1ieXRlIGZpZWxkIHJlcHJlc2VudGF0aXZlIG9yIEdydW1wa2luCmNvb3JkaW5hdGUgaXMgbm90IGEgY2Fub25pY2FsIGBCbjI1NEZyYCB2YWx1ZSAoYOKJpSByYCkuIFRoZSBTb3JvYmFuCmhvc3QncyBgYm4yNTRfZnJfKmAgZGVzZXJpYWxpc2VyIHNpbGVudGx5IHJlZHVjZXMgbm9uLWNhbm9uaWNhbAplbmNvZGluZ3MsIHNvIHRoZSBjb250cmFjdCBlbmZvcmNlcyBjYW5vbmljYWxpdHkgYXQgdGhlIHZlcmlmaWVyCmJvdW5kYXJ5IHRvIGtlZXAgc3RvcmVkIHN0YXRlIGFuZCBlbWl0dGVkIGV2ZW50cyBieXRlLXVuaXF1ZSBwZXIKbG9naWNhbCB2YWx1ZS4AAAAAABROb25DYW5vbmljYWxFbmNvZGluZwAADbo=",
        "AAAAAQAAACNPbi1jaGFpbiBzcGVuZGVyIGRlbGVnYXRpb24gcmVjb3JkLgAAAAAAAAAAEVNwZW5kZXJEZWxlZ2F0aW9uAAAAAAAABQAAAClQb3NlaWRvbi1lbmNyeXB0ZWQgYWxsb3dhbmNlIHNjYWxhciBgw6NgLgAAAAAAAAdhX3RpbGRlAAAAA+4AAAAgAAAAK0FsbG93YW5jZSBjb21taXRtZW50IGBDX2EgPSBDb20odl9hLCByX2EpYC4AAAAAFGFsbG93YW5jZV9jb21taXRtZW50AAAH0AAAAAVQb2ludAAAAAAAABtQZXItZGVsZWdhdGlvbiBzYWx0IGDPg19hYC4AAAAADmFsbG93YW5jZV9zYWx0AAAAAAPuAAAAIAAAADhFQ0RIIGVzY3JvdyBvZiBgZHZrX2lgIHVuZGVyIHRoZSBzcGVuZGVyJ3Mgc3BlbmRpbmcga2V5LgAAAAxlc2Nyb3dlZF9kdmsAAAfQAAAABVBvaW50AAAAAAAAeVRoZSBsZWRnZXIgbnVtYmVyIGF0IHdoaWNoIHRoZSBkZWxlZ2F0aW9uIGV4cGlyZXMuIFNwZW5kaW5nIGlzCmF1dGhvcml6ZWQgd2hpbGUgYGxlZGdlci5zZXF1ZW5jZSgpIDw9IGxpdmVfdW50aWxfbGVkZ2VyYC4AAAAAAAARbGl2ZV91bnRpbF9sZWRnZXIAAAAAAAAE",
        "AAAAAQAAACVPbi1jaGFpbiBjb25maWRlbnRpYWwgYWNjb3VudCByZWNvcmQuAAAAAAAAAAAAABNDb25maWRlbnRpYWxBY2NvdW50AAAAAAUAAAAxSW5kZXggb2YgdGhlIGF1ZGl0b3Iga2V5IGluIHRoZSBhdWRpdG9yIHJlZ2lzdHJ5LgAAAAAAAAphdWRpdG9yX2lkAAAAAAAEAAAAKVJlY2VpdmluZyBiYWxhbmNlIGNvbW1pdG1lbnQgYENfcmVjZWl2ZWAuAAAAAAAAFHJlY2VpdmluZ19jb21taXRtZW50AAAH0AAAAAVQb2ludAAAAAAAACdTcGVuZGFibGUgYmFsYW5jZSBjb21taXRtZW50IGBDX3NwZW5kYC4AAAAAFHNwZW5kYWJsZV9jb21taXRtZW50AAAH0AAAAAVQb2ludAAAAAAAADBgWSA9IHNrIMK3IEhgLCB0aGUgR3J1bXBraW4gc3BlbmRpbmcgcHVibGljIGtleS4AAAATc3BlbmRpbmdfcHVibGljX2tleQAAAAfQAAAABVBvaW50AAAAAAAAMWBQVksgPSB2ayDCtyBIYCwgdGhlIEdydW1wa2luIHZpZXdpbmcgcHVibGljIGtleS4AAAAAAAASdmlld2luZ19wdWJsaWNfa2V5AAAAAAfQAAAABVBvaW50AAAA" ]),
      options
    )
  }
  public readonly fromJSON = {
    merge: this.txFromJSON<null>,
        deposit: this.txFromJSON<null>,
        register: this.txFromJSON<null>,
        withdraw: this.txFromJSON<null>,
        is_spender: this.txFromJSON<boolean>,
        set_spender: this.txFromJSON<null>,
        revoke_spender: this.txFromJSON<null>,
        confidential_balance: this.txFromJSON<ConfidentialAccount>,
        confidential_transfer: this.txFromJSON<null>,
        get_spender_delegation: this.txFromJSON<SpenderDelegation>,
        confidential_transfer_from: this.txFromJSON<null>
  }
}