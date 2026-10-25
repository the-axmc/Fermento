// src/contracts/client.ts
//
// Typed clients for the three Fermento contracts. Contract IDs come from the
// environment (see .env.example); scripts/deploy-testnet.sh prints them.

import { Client as RegistryClient } from "batch_registry_contract";
import { Client as SharesClient } from "batch_shares_contract";
import { Client as OracleClient } from "condition_oracle_contract";
import { Client as ConfidentialClient } from "confidential_token_contract";
import type { ClientOptions } from "@stellar/stellar-sdk/contract";
import { networkPassphrase, rpcUrl } from "./util";

/** Signer for write calls; omit for read-only calls. */
export type ContractSigner = Pick<
  ClientOptions,
  "publicKey" | "signTransaction" | "signAuthEntry"
>;

export const REGISTRY_ID: string = import.meta.env.PUBLIC_REGISTRY_ID ?? "";
export const SHARES_ID: string = import.meta.env.PUBLIC_SHARES_ID ?? "";
export const ORACLE_ID: string = import.meta.env.PUBLIC_ORACLE_ID ?? "";
export const USDC_ID: string = import.meta.env.PUBLIC_USDC_ID ?? "";

const base = (contractId: string, signer: ContractSigner) => ({
  contractId,
  rpcUrl,
  networkPassphrase,
  allowHttp: rpcUrl.startsWith("http://"),
  ...signer,
});

/** Batch registry: one NFT per physical batch, stages and unit claims. */
export function getRegistry(signer: ContractSigner = {}): RegistryClient {
  return new RegistryClient(base(REGISTRY_ID, signer));
}

/** Batch shares: primary sale in USDC, storage fees, redemption. */
export function getShares(signer: ContractSigner = {}): SharesClient {
  return new SharesClient(base(SHARES_ID, signer));
}

/** Condition oracle: signed cellar readings, age curves and the value mark. */
export function getOracle(signer: ContractSigner = {}): OracleClient {
  return new OracleClient(base(ORACLE_ID, signer));
}

/** Confidential wrapper of one batch's share token: register, deposit, merge, transfer, withdraw. */
export function getConfidential(
  contractId: string,
  signer: ContractSigner = {},
): ConfidentialClient {
  return new ConfidentialClient(base(contractId, signer));
}

/** Kept for code that still refers to the single registry client. */
export const getContract = getRegistry;
export const CONTRACT_ID = REGISTRY_ID;
