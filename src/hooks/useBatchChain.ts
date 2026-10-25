/**
 * On-chain state of a batch, read from the three contracts with simulated
 * (free) calls. Each piece is independent, so a batch that has an offering but
 * no oracle entry still renders what it can.
 */

import { useCallback, useEffect, useState } from "react";
import { Buffer } from "buffer";
import type { Escrow, Listing, Offering } from "batch_shares_contract";
import type { Attestation } from "batch_registry_contract";
import type {
  Breakdown,
  Checkin,
  Mark,
  Stats,
} from "condition_oracle_contract";
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
  /** Buyer money held for the batch; absent for offerings that predate escrow. */
  escrow?: Escrow;
  /** Payment held per unit now: what a holder gets back if the batch fails. */
  heldPerShare?: bigint;
  /** Latest independent inspection: the batch exists and holds this many units. */
  attestation?: Attestation;
  /** Open resale listings from other holders, cheapest first. */
  listings: Listing[];
  mark?: Mark;
  /** Every factor of the mark: age, cellar, care, producer rating. */
  breakdown?: Breakdown;
  stats?: Stats;
  history: Mark[];
  /** Producer check-ins, newest first. */
  checkins: Checkin[];
  /** Account allowed to post check-ins and link the tag. */
  producer?: string;
  /** sha256 of the NFC tag serial bound to the batch, as hex. */
  tag?: string;
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
  const oracle = ORACLE_ID ? getOracle() : undefined;
  const registry = REGISTRY_ID ? getRegistry() : undefined;
  const id = { batch_id: batchId };
  const shares = SHARES_ID ? getShares() : undefined;
  const [
    offering,
    escrow,
    heldPerShare,
    attestation,
    listings,
    breakdown,
    stats,
    history,
    checkins,
    producer,
    stage,
    tag,
  ] = await Promise.all([
    shares ? quiet(() => shares.offering(id)) : undefined,
    shares ? quiet(() => shares.escrow(id)) : undefined,
    shares ? quiet(() => shares.held_per_share_now(id)) : undefined,
    registry ? quiet(() => registry.attestation(id)) : undefined,
    shares ? quiet(() => shares.listings(id)) : undefined,
    oracle ? quiet(() => oracle.breakdown(id)) : undefined,
    oracle ? quiet(() => oracle.get_stats(id)) : undefined,
    oracle ? quiet(() => oracle.mark_history(id)) : undefined,
    oracle ? quiet(() => oracle.checkins(id)) : undefined,
    oracle ? quiet(() => oracle.producer(id)) : undefined,
    registry ? quiet(() => registry.stage(id)) : undefined,
    registry ? quiet(() => registry.tag(id)) : undefined,
  ]);
  const mark: Mark | undefined = breakdown && {
    value: breakdown.value,
    timestamp: breakdown.timestamp,
    age_bps: breakdown.age_bps,
    condition_bps: breakdown.condition_bps,
    fee_per_share: breakdown.fee_per_share,
  };
  return {
    offering,
    escrow: escrow ?? undefined,
    heldPerShare,
    attestation: attestation ?? undefined,
    listings: [...(listings ?? [])].sort((a, b) =>
      a.price < b.price ? -1 : a.price > b.price ? 1 : 0,
    ),
    mark,
    breakdown,
    stats,
    history: history ?? [],
    checkins: [...(checkins ?? [])].reverse(),
    producer: producer ?? undefined,
    stage: stage ?? undefined,
    tag: tag ? Buffer.from(tag).toString("hex") : undefined,
  };
};

export const useBatchChain = (
  batchId: number | undefined,
  intervalMs = 15_000,
): BatchChain => {
  const offline = !SHARES_ID && !ORACLE_ID && !REGISTRY_ID;
  const [state, setState] = useState<Omit<BatchChain, "refresh" | "offline">>({
    history: [],
    checkins: [],
    listings: [],
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

/** Offerings, marks and cellar stats for a list of batches, for the market and producer pages. */
export const useBatchesChain = (ids: number[], intervalMs = 20_000) => {
  const offline = !SHARES_ID && !ORACLE_ID;
  const [rows, setRows] = useState<
    Record<
      number,
      {
        offering?: Offering;
        escrow?: Escrow;
        heldPerShare?: bigint;
        listings?: Listing[];
        mark?: Mark;
        stats?: Stats;
      }
    >
  >({});
  const [loading, setLoading] = useState(!offline);
  const key = ids.join(",");

  useEffect(() => {
    if (offline) return;
    let active = true;
    const load = async () => {
      const entries = await Promise.all(
        ids.map(async (id) => {
          const shares = SHARES_ID ? getShares() : undefined;
          const [offering, escrow, heldPerShare, listings, mark, stats] =
            await Promise.all([
              shares
                ? quiet(() => shares.offering({ batch_id: id }))
                : undefined,
              shares ? quiet(() => shares.escrow({ batch_id: id })) : undefined,
              shares
                ? quiet(() => shares.held_per_share_now({ batch_id: id }))
                : undefined,
              shares
                ? quiet(() => shares.listings({ batch_id: id }))
                : undefined,
              ORACLE_ID
                ? quiet(() => getOracle().mark({ batch_id: id }))
                : undefined,
              ORACLE_ID
                ? quiet(() => getOracle().get_stats({ batch_id: id }))
                : undefined,
            ]);
          return [
            id,
            {
              offering,
              escrow: escrow ?? undefined,
              heldPerShare,
              listings,
              mark,
              stats,
            },
          ] as const;
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
