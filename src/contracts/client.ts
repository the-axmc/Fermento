// src/contracts/client.ts
import { Client, networks } from "non_fungible_contract";

const env = (import.meta as any).env || {};
const RPC = env.PUBLIC_STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const PASS =
  env.PUBLIC_STELLAR_NETWORK_PASSPHRASE ||
  (networks?.testnet?.networkPassphrase as string) ||
  "Test SDF Network ; September 2015";
const CONTRACT_ID =
  env.CONTRACT_ID || (networks?.testnet?.contractId as string);

if (!CONTRACT_ID) {
  // Keep a loud error so you notice in Vercel logs if env is missing
  // (this throws during SSR build if you ever SSR this page).
  // For Vite SPA it’s fine at runtime.
  console.warn("⚠️ CONTRACT_ID is not set; client may fail at runtime.");
}

let cached: Client | null = null;

export function getContract(): Client {
  if (cached) return cached;
  cached = new Client({
    contractId: CONTRACT_ID,
    rpcUrl: RPC,
    networkPassphrase: PASS,
    allowHttp: RPC.startsWith("http://"),
  });
  return cached;
}
