/**
 * Smart Account Kit configuration.
 *
 * One passkey-controlled OpenZeppelin smart account per user. Fees are paid by
 * the relayer proxy, so the user never holds XLM. Contract addresses are the
 * public testnet deployment of the kit (see .env.example).
 */

import { IndexedDBStorage, SmartAccountKit } from "smart-account-kit";
import { networkPassphrase, rpcUrl } from "../contracts/util";

export const APP_NAME = "Fermento";

const env = import.meta.env;

export const ACCOUNT_WASM_HASH = env.PUBLIC_ACCOUNT_WASM_HASH ?? "";
export const WEBAUTHN_VERIFIER_ID = env.PUBLIC_WEBAUTHN_VERIFIER_ID ?? "";
export const ED25519_VERIFIER_ID = env.PUBLIC_ED25519_VERIFIER_ID ?? "";
export const SPENDING_LIMIT_POLICY_ID =
  env.PUBLIC_SPENDING_LIMIT_POLICY_ID ?? "";
export const RELAYER_URL = env.PUBLIC_RELAYER_URL ?? "";
export const NATIVE_TOKEN_ID = env.PUBLIC_NATIVE_TOKEN_ID ?? "";

export const isAccountConfigured = () =>
  ACCOUNT_WASM_HASH !== "" && WEBAUTHN_VERIFIER_ID !== "";

let instance: SmartAccountKit | undefined;

/** Lazily built singleton; the kit touches IndexedDB, so keep it off the module top level. */
export const getKit = (): SmartAccountKit => {
  if (!instance) {
    instance = new SmartAccountKit({
      rpcUrl,
      networkPassphrase,
      accountWasmHash: ACCOUNT_WASM_HASH,
      webauthnVerifierAddress: WEBAUTHN_VERIFIER_ID,
      ed25519VerifierAddress: ED25519_VERIFIER_ID || undefined,
      relayerUrl: RELAYER_URL || undefined,
      rpName: APP_NAME,
      storage: new IndexedDBStorage(),
    });
  }
  return instance;
};
