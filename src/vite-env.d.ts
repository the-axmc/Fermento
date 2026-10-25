/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_STELLAR_NETWORK?: string;
  readonly PUBLIC_STELLAR_NETWORK_PASSPHRASE?: string;
  readonly PUBLIC_STELLAR_RPC_URL?: string;
  readonly PUBLIC_STELLAR_HORIZON_URL?: string;
  /** Contract IDs written by scripts/deploy-testnet.sh */
  readonly PUBLIC_REGISTRY_ID?: string;
  readonly PUBLIC_SHARES_ID?: string;
  readonly PUBLIC_ORACLE_ID?: string;
  readonly PUBLIC_USDC_ID?: string;
  /** Smart Account Kit deployment (see .env.example for testnet values) */
  readonly PUBLIC_ACCOUNT_WASM_HASH?: string;
  readonly PUBLIC_WEBAUTHN_VERIFIER_ID?: string;
  readonly PUBLIC_ED25519_VERIFIER_ID?: string;
  readonly PUBLIC_SPENDING_LIMIT_POLICY_ID?: string;
  readonly PUBLIC_RELAYER_URL?: string;
  readonly PUBLIC_NATIVE_TOKEN_ID?: string;
  readonly PUBLIC_ANCHOR_DOMAIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
