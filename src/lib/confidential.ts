/**
 * Confidential shares: OpenZeppelin confidential tokens in the browser.
 *
 * Each batch with a confidential wrapper lets a holder move shares out of
 * public view. On chain the wrapper keeps Pedersen commitments; the amounts
 * live only here, in the holder's browser, reconstructed from the wrapper's
 * events with the holder's viewing key. Every proof is generated on the
 * phone (Noir circuits, UltraHonk via bb.js) and the smart account signs the
 * call with its passkey, so no server ever sees a secret.
 *
 * Keys: passkey smart accounts have no ed25519 signer to derive from, so the
 * SDK's "raw 32-byte root" path is used: one random root per account, kept
 * in localStorage and exportable as a backup phrase. Everything else (one
 * spending key per wrapper, viewing keys) derives from it deterministically.
 *
 * Status: developer preview. OpenZeppelin's current verifier accepts
 * non-zero-knowledge UltraHonk proofs, so amounts are not yet cryptographically
 * hidden from a determined analyst. Testnet only.
 */

import { Buffer } from "buffer";
import type { CompiledCircuit } from "@noir-lang/noir_js";
import {
  CircuitProver,
  StateEngine,
  addressToField,
  bigintReplacer,
  buildRegisterWitness,
  buildTransferWitness,
  buildWithdrawWitness,
  deriveKeys,
  deriveSk,
  encodeRegisterData,
  encodeTransferData,
  encodeWithdrawData,
  pointFromBytes,
  pointToBytes,
  reviveState,
  setUltraHonkBackendLoader,
  type AccountState,
  type KeyPair,
  type Point,
  type StateStore,
  type TransferParams,
  type WithdrawParams,
} from "stellar-confidential-token-sdk";
import {
  ChainClient,
  hybridFetchEvents,
  type OnChainAccount,
} from "stellar-confidential-token-sdk/chain";
import { networkPassphrase, rpcUrl } from "../contracts/util";

/* --------------------------------- Config ---------------------------------- */

const env = import.meta.env;
export const CONFIDENTIAL_VERIFIER = String(
  env.PUBLIC_CONFIDENTIAL_VERIFIER ?? "",
);
export const CONFIDENTIAL_AUDITOR = String(
  env.PUBLIC_CONFIDENTIAL_AUDITOR ?? "",
);
export const AUDITOR_ID = Number(env.PUBLIC_AUDITOR_ID ?? 0);

/** True when the verifier and auditor registries are configured. */
export const confidentialConfigured = () =>
  CONFIDENTIAL_VERIFIER !== "" && CONFIDENTIAL_AUDITOR !== "";

/* ------------------------------ Root and keys ------------------------------ */

const ROOT_KEY = (address: string) => `fermento:privacy-root:${address}`;

const randomRoot = (): Uint8Array => {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return b;
};

const hex = (b: Uint8Array) => Buffer.from(b).toString("hex");
const unhex = (s: string) => new Uint8Array(Buffer.from(s.trim(), "hex"));

/** The account's privacy root, created on first use. */
export const getRoot = (address: string): Uint8Array => {
  try {
    const stored = localStorage.getItem(ROOT_KEY(address));
    if (stored && stored.length === 64) return unhex(stored);
    const root = randomRoot();
    localStorage.setItem(ROOT_KEY(address), hex(root));
    return root;
  } catch {
    throw new Error(
      "This browser blocks local storage, which holds your privacy key.",
    );
  }
};

export const hasRoot = (address: string): boolean => {
  try {
    return (localStorage.getItem(ROOT_KEY(address))?.length ?? 0) === 64;
  } catch {
    return false;
  }
};

/** Backup string: 64 hex characters. Whoever holds it can read and spend the private balances. */
export const exportRoot = (address: string): string => hex(getRoot(address));

/** Restore a root from a backup string, replacing the current one. */
export const importRoot = (address: string, backup: string): void => {
  const clean = backup.trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(clean)) {
    throw new Error("A backup is 64 hexadecimal characters.");
  }
  localStorage.setItem(ROOT_KEY(address), clean);
};

/** Keys bound to one wrapper contract, derived from the account's root. */
export const keysFor = (address: string, token: string): KeyPair => {
  const { sk, addrF } = deriveSk(getRoot(address), token, address);
  return deriveKeys(sk, addrF, addressToField(address));
};

/* --------------------------------- Prover ---------------------------------- */

const circuits = new Map<string, Promise<CompiledCircuit>>();

/** Compiled Noir circuits are served from /circuits and fetched once. */
export const loadCircuit = (
  name: "register" | "transfer" | "withdraw",
): Promise<CompiledCircuit> => {
  let p = circuits.get(name);
  if (!p) {
    p = fetch(`/circuits/${name}.json`).then(async (r) => {
      if (!r.ok) throw new Error(`circuit ${name} not found (${r.status})`);
      return (await r.json()) as CompiledCircuit;
    });
    circuits.set(name, p);
  }
  return p;
};

let backendReady = false;
/** bb.js browser build: wasm and workers ship inside the package. */
const ensureBackend = () => {
  if (backendReady) return;
  setUltraHonkBackendLoader(async () => {
    const mod = await import("@aztec/bb.js");
    return mod.UltraHonkBackend as unknown as Parameters<
      typeof setUltraHonkBackendLoader
    >[0] extends () => Promise<infer C>
      ? C
      : never;
  });
  backendReady = true;
};

const bytesOf = (scVal: { bytes(): Uint8Array }) => Buffer.from(scVal.bytes());

export interface Proved {
  /** The `data: Bytes` argument of the contract call. */
  payload: Buffer;
  /** Proof generation time in milliseconds. */
  ms: number;
}

/** Prove registration of `keys` on their wrapper. */
export const proveRegister = async (keys: KeyPair): Promise<Proved> => {
  ensureBackend();
  const t0 = performance.now();
  const witness = buildRegisterWitness(keys, keys.acctF);
  const prover = new CircuitProver(await loadCircuit("register"));
  try {
    const { proof } = await prover.prove(witness.inputs);
    return {
      payload: bytesOf(encodeRegisterData(witness, proof)),
      ms: performance.now() - t0,
    };
  } finally {
    await prover.destroy();
  }
};

/** Prove a confidential transfer; `next` is the sender's opening afterwards. */
export const proveTransfer = async (
  params: TransferParams,
): Promise<Proved & { next: { v: bigint; r: bigint } }> => {
  ensureBackend();
  const t0 = performance.now();
  const witness = buildTransferWitness(params);
  const prover = new CircuitProver(await loadCircuit("transfer"));
  try {
    const { proof } = await prover.prove(witness.inputs);
    return {
      payload: bytesOf(encodeTransferData(witness, proof)),
      next: { v: witness.next.v, r: witness.next.r },
      ms: performance.now() - t0,
    };
  } finally {
    await prover.destroy();
  }
};

/** Prove a withdrawal back to the public share token. */
export const proveWithdraw = async (
  params: WithdrawParams,
): Promise<Proved> => {
  ensureBackend();
  const t0 = performance.now();
  const witness = buildWithdrawWitness(params);
  const prover = new CircuitProver(await loadCircuit("withdraw"));
  try {
    const { proof } = await prover.prove(witness.inputs);
    return {
      payload: bytesOf(encodeWithdrawData(witness, proof)),
      ms: performance.now() - t0,
    };
  } finally {
    await prover.destroy();
  }
};

/* ------------------------------- Local state ------------------------------- */

const STATE_KEY = (token: string, address: string) =>
  `fermento:privacy-state:${token}:${address}`;
const CURSOR_KEY = (token: string, address: string) =>
  `fermento:privacy-cursor:${token}:${address}`;

/** Openings in localStorage. Losing them means replaying events, which the RPC keeps for about a week. */
class LocalStore implements StateStore {
  constructor(private token: string) {}
  load(address: string): Promise<AccountState | null> {
    try {
      const raw = localStorage.getItem(STATE_KEY(this.token, address));
      return Promise.resolve(
        raw ? reviveState(JSON.parse(raw) as Record<string, unknown>) : null,
      );
    } catch {
      return Promise.resolve(null);
    }
  }
  save(address: string, state: AccountState): Promise<void> {
    try {
      localStorage.setItem(
        STATE_KEY(this.token, address),
        JSON.stringify(state, bigintReplacer),
      );
    } catch {
      /* storage full or blocked: the next sync replays events */
    }
    return Promise.resolve();
  }
}

export const chainClient = (token: string) =>
  new ChainClient({
    rpcUrl,
    networkPassphrase,
    contracts: {
      token,
      verifier: CONFIDENTIAL_VERIFIER,
      auditor: CONFIDENTIAL_AUDITOR,
    },
  });

/** Fermento's auditor key, the one every transfer's audit channel encrypts to. */
export const auditorKey = (token: string): Promise<Point> =>
  chainClient(token).auditorKey(AUDITOR_ID);

/** On-chain account of `address` on the wrapper, or null when not registered. */
export const onChainAccount = (
  token: string,
  address: string,
): Promise<OnChainAccount | null> =>
  chainClient(token).confidentialBalance(address);

export interface PrivateState {
  state: AccountState;
  /** Local openings re-commit to the on-chain points. False means do not spend. */
  verified: boolean;
  registered: boolean;
  onchain: OnChainAccount | null;
  engine: StateEngine;
}

/**
 * Bring the local openings up to date with the wrapper's events and check
 * them against the chain. New events since the stored cursor are appended;
 * a device with no state replays what the RPC still holds.
 */
export const syncPrivateState = async (
  token: string,
  address: string,
  keys: KeyPair,
): Promise<PrivateState> => {
  const client = chainClient(token);
  const store = new LocalStore(token);
  const engine = new StateEngine({ address, keys, store });
  await engine.load();

  const onchain = await client.confidentialBalance(address);
  if (!onchain) {
    return {
      state: engine.state(),
      verified: false,
      registered: false,
      onchain: null,
      engine,
    };
  }

  let cursor: string | undefined;
  try {
    cursor = localStorage.getItem(CURSOR_KEY(token, address)) ?? undefined;
  } catch {
    cursor = undefined;
  }
  const { events, cursor: next } = await hybridFetchEvents(client, undefined, {
    fromLedger: 0,
    startCursor: cursor,
  });
  const mine = events.filter((ev) =>
    "account" in ev
      ? ev.account === address
      : ev.from === address || ev.to === address,
  );
  engine.ingestEvents(mine);
  if (next) {
    try {
      localStorage.setItem(CURSOR_KEY(token, address), next);
    } catch {
      /* best effort */
    }
  }

  const check = engine.verifyAgainstChain({
    spendableC: pointToBytes(onchain.spendableBalance),
    receivingC: pointToBytes(onchain.receivingBalance),
  });
  return {
    state: engine.state(),
    verified: check.ok,
    registered: true,
    onchain,
    engine,
  };
};

/** Forget the cursor so the next sync replays from the RPC's retention floor. */
export const resetPrivateState = (token: string, address: string) => {
  try {
    localStorage.removeItem(CURSOR_KEY(token, address));
    localStorage.removeItem(STATE_KEY(token, address));
  } catch {
    /* nothing to clear */
  }
};

/** Public viewing key of a registered recipient, needed to send to them. */
export const recipientViewingKey = async (
  token: string,
  to: string,
): Promise<Point | null> => {
  const acct = await chainClient(token).confidentialBalance(to);
  return acct ? acct.viewingPublicKey : null;
};

export { pointFromBytes, pointToBytes };
export type { KeyPair, Point, AccountState, OnChainAccount };

/**
 * Private shares as last synced on this device, without touching the network
 * or deriving keys. For list pages; the batch page syncs for real.
 */
export const cachedPrivateShares = (token: string, address: string): bigint => {
  try {
    const raw = localStorage.getItem(STATE_KEY(token, address));
    if (!raw) return 0n;
    const s = reviveState(JSON.parse(raw) as Record<string, unknown>);
    return s.spendable.v + s.receiving.v;
  } catch {
    return 0n;
  }
};
