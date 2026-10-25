/**
 * On-chain state of a batch, read from the three contracts with simulated
 * (free) calls. Each piece is independent, so a batch that has an offering but
 * no oracle entry still renders what it can.
 */

import { useCallback, useEffect, useState } from "react";
import type { Offering } from "batch_shares_contract";
import type { Mark, Stats } from "condition_oracle_contract";
import {
  ORACLE_ID,
  REGISTRY_ID,
  SHARES_ID,
  getOracle,
  getRegistry,
  getShares,
} from "../contracts/client";

export interface BatchChain {
  offering?: Offering;
  mark?: Mark;
  stats?: Stats;
  history: Mark[];
  stage?: string;
  loading: boolean;
  /** True when no contract IDs are configured, so the UI can fall back to copy. */
  offline: boolean;
  refresh: () => void;
}

const quiet = async <T>(
  call: () => Promise<{ result: T }>,
): Promise<T | undefined> => {
  try {
    return (await call()).result;
  } catch {
    return undefined;
  }
};

export const readBatch = async (batchId: number) => {
  const [offering, mark, stats, history, stage] = await Promise.all([
    SHARES_ID
      ? quiet(() => getShares().offering({ batch_id: batchId }))
      : undefined,
    ORACLE_ID
      ? quiet(() => getOracle().mark({ batch_id: batchId }))
      : undefined,
    ORACLE_ID
      ? quiet(() => getOracle().get_stats({ batch_id: batchId }))
      : undefined,
    ORACLE_ID
      ? quiet(() => getOracle().mark_history({ batch_id: batchId }))
      : undefined,
    REGISTRY_ID
      ? quiet(() => getRegistry().stage({ batch_id: batchId }))
      : undefined,
  ]);
  return {
    offering,
    mark,
    stats,
    history: history ?? [],
    stage: stage ?? undefined,
  };
};

export const useBatchChain = (
  batchId: number | undefined,
  intervalMs = 15_000,
): BatchChain => {
  const offline = !SHARES_ID && !ORACLE_ID && !REGISTRY_ID;
  const [state, setState] = useState<Omit<BatchChain, "refresh" | "offline">>({
    history: [],
    loading: !offline,
  });
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (batchId === undefined || offline) return;
    let active = true;
    const load = () =>
      readBatch(batchId).then((data) => {
        if (active) setState({ ...data, loading: false });
      });
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [batchId, intervalMs, tick, offline]);

  return { ...state, offline, refresh };
};

/** Offerings and marks for a list of batches, for the market page. */
export const useBatchesChain = (ids: number[], intervalMs = 20_000) => {
  const offline = !SHARES_ID && !ORACLE_ID;
  const [rows, setRows] = useState<
    Record<number, { offering?: Offering; mark?: Mark }>
  >({});
  const [loading, setLoading] = useState(!offline);
  const key = ids.join(",");

  useEffect(() => {
    if (offline) return;
    let active = true;
    const load = async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const [offering, mark] = await Promise.all([
            SHARES_ID
              ? quiet(() => getShares().offering({ batch_id: id }))
              : undefined,
            ORACLE_ID
              ? quiet(() => getOracle().mark({ batch_id: id }))
              : undefined,
          ]);
          return [id, { offering, mark }] as const;
        }),
      );
      if (active) {
        setRows(Object.fromEntries(entries));
        setLoading(false);
      }
    };
    void load();
    const timer = setInterval(() => void load(), intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- ids is keyed by its joined string
  }, [key, intervalMs, offline]);

  return { rows, loading, offline };
};
