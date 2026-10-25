import { useCallback, useEffect, useMemo, useState } from "react";
import type { KeyPair } from "stellar-confidential-token-sdk";
import { getConfidential } from "../contracts/client";
import { recordActivity } from "../lib/activity";
import {
  AUDITOR_ID,
  auditorKey,
  confidentialConfigured,
  keysFor,
  proveRegister,
  proveTransfer,
  proveWithdraw,
  recipientViewingKey,
  syncPrivateState,
  type PrivateState,
} from "../lib/confidential";
import { useAccount } from "./useAccount";

export type Phase = "idle" | "proving" | "signing" | "waiting" | "syncing";

export interface Confidential {
  /** The batch has a wrapper and the app is configured for it. */
  available: boolean;
  loading: boolean;
  registered: boolean;
  /** Shares spendable privately right now. */
  spendable: bigint;
  /** Shares received privately but not yet merged. */
  receiving: bigint;
  verified: boolean;
  phase: Phase;
  /** Last proof time in milliseconds, for the status line. */
  lastProofMs?: number;
  error?: string;
  refresh: () => void;
  /** Register on the wrapper (one proof), then deposit `amount` shares and merge. */
  hide: (amount: bigint) => Promise<void>;
  /** Fold received shares into the spendable balance. */
  merge: () => Promise<void>;
  /** Send `amount` private shares to another registered account. */
  send: (to: string, amount: bigint) => Promise<void>;
  /** Move `amount` shares back to the public token. */
  reveal: (amount: bigint) => Promise<void>;
}

/**
 * The signed-in account's private position on one batch's wrapper, with the
 * actions that move shares in, around and out. Proofs run in the browser;
 * the passkey signs; the relayer pays.
 */
export const useConfidential = (
  token: string | undefined,
  batchId: number | undefined,
): Confidential => {
  const account = useAccount();
  const address = account.address;
  const available = !!token && confidentialConfigured();
  const [priv, setPriv] = useState<PrivateState | undefined>();
  const [loading, setLoading] = useState(available);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | undefined>();
  const [lastProofMs, setLastProofMs] = useState<number | undefined>();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const keys: KeyPair | undefined = useMemo(() => {
    if (!available || !address || !token) return undefined;
    try {
      return keysFor(address, token);
    } catch {
      return undefined;
    }
  }, [available, address, token]);

  useEffect(() => {
    if (!available || !address || !token || !keys) {
      setLoading(false);
      setPriv(undefined);
      return;
    }
    let active = true;
    setLoading(true);
    syncPrivateState(token, address, keys)
      .then((s) => {
        if (active) setPriv(s);
      })
      .catch((e: unknown) => {
        if (active) setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [available, address, token, keys, tick]);

  /** Submit a prepared call, then re-sync. */
  const run = useCallback(
    async (label: string, work: () => Promise<void>): Promise<void> => {
      setError(undefined);
      try {
        await work();
        setPhase("syncing");
        if (token && address && keys) {
          setPriv(await syncPrivateState(token, address, keys));
        }
        if (address) {
          recordActivity(address, {
            kind: "privacy",
            title: `${label} · Batch ${batchId ?? ""}`.trim(),
            batchId,
          });
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
        throw e;
      } finally {
        setPhase("idle");
      }
    },
    [token, address, keys, batchId],
  );

  const client = useCallback(() => {
    if (!token) throw new Error("No confidential wrapper for this batch.");
    return getConfidential(token);
  }, [token]);
  const need = useCallback(() => {
    if (!address || !keys) throw new Error("Sign in first.");
    return { address, keys };
  }, [address, keys]);

  const hide = useCallback(
    (amount: bigint) =>
      run("Shares made private", async () => {
        const { address: me, keys: k } = need();
        const c = client();
        if (!priv?.registered) {
          setPhase("proving");
          const reg = await proveRegister(k);
          setLastProofMs(reg.ms);
          setPhase("signing");
          await account.submit(
            await c.register({
              account: me,
              auditor_id: AUDITOR_ID,
              data: reg.payload,
            }),
          );
        }
        setPhase("signing");
        await account.submit(await c.deposit({ from: me, to: me, amount }));
        await account.submit(await c.merge({ account: me }));
      }),
    [run, priv?.registered, account, client, need],
  );

  const merge = useCallback(
    () =>
      run("Private shares merged", async () => {
        const { address: me } = need();
        setPhase("signing");
        await account.submit(await client().merge({ account: me }));
      }),
    [run, account, client, need],
  );

  const send = useCallback(
    (to: string, amount: bigint) =>
      run("Private transfer", async () => {
        const { address: me, keys: k } = need();
        if (!token) throw new Error("No wrapper.");
        if (!priv?.verified) {
          throw new Error(
            "Your local balance does not match the chain yet. Refresh and try again.",
          );
        }
        if (amount <= 0n || amount > priv.state.spendable.v) {
          throw new Error("Not that many private shares.");
        }
        const pvkB = await recipientViewingKey(token, to);
        if (!pvkB) {
          throw new Error(
            "That account has not set up privacy on this batch yet. Ask them to open the batch and tap Keep private.",
          );
        }
        const kAud = await auditorKey(token);
        setPhase("proving");
        const proved = await proveTransfer({
          keys: k,
          v: priv.state.spendable.v,
          r: priv.state.spendable.r,
          amount,
          pvkB,
          kAudR: kAud,
          kAudS: kAud,
        });
        setLastProofMs(proved.ms);
        setPhase("signing");
        await account.submit(
          await client().confidential_transfer({
            from: me,
            to,
            data: proved.payload,
          }),
        );
      }),
    [run, priv, token, account, client, need],
  );

  const reveal = useCallback(
    (amount: bigint) =>
      run("Shares made public", async () => {
        const { address: me, keys: k } = need();
        if (!token) throw new Error("No wrapper.");
        if (!priv?.verified) {
          throw new Error(
            "Your local balance does not match the chain yet. Refresh and try again.",
          );
        }
        if (amount <= 0n || amount > priv.state.spendable.v) {
          throw new Error("Not that many private shares.");
        }
        const kAud = await auditorKey(token);
        setPhase("proving");
        const proved = await proveWithdraw({
          keys: k,
          v: priv.state.spendable.v,
          r: priv.state.spendable.r,
          amount,
          kAudS: kAud,
        });
        setLastProofMs(proved.ms);
        setPhase("signing");
        await account.submit(
          await client().withdraw({
            from: me,
            to: me,
            amount,
            data: proved.payload,
          }),
        );
      }),
    [run, priv, token, account, client, need],
  );

  return {
    available,
    loading,
    registered: !!priv?.registered,
    spendable: priv?.state.spendable.v ?? 0n,
    receiving: priv?.state.receiving.v ?? 0n,
    verified: !!priv?.verified,
    phase,
    lastProofMs,
    error,
    refresh,
    hide,
    merge,
    send,
    reveal,
  };
};
