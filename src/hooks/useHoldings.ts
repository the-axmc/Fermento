import { useEffect, useMemo, useState } from "react";
import type { Offering } from "batch_shares_contract";
import type { Mark } from "condition_oracle_contract";
import { SHARES_ID } from "../contracts/client";
import type { BatchInfo } from "../data/batches";
import { readBalance } from "../wallet/balances";
import { useAccount } from "./useAccount";
import { useBatchesChain } from "./useBatchChain";
import { useCatalogue } from "./useCatalogue";

export interface Holding {
  info: BatchInfo;
  offering: Offering;
  mark?: Mark;
  shares: bigint;
  /** Mark per share, or the fill price when no mark exists. */
  price: bigint;
}

export interface Produced {
  info: BatchInfo;
  offering: Offering;
  mark?: Mark;
}

/**
 * What the signed-in account holds (shares bought) and what it listed
 * (batches whose producer is this account). Refreshes with `refresh()`.
 */
export const useHoldings = () => {
  const account = useAccount();
  const catalogue = useCatalogue();
  const ids = useMemo(() => catalogue.map((b) => b.batchId), [catalogue]);
  const chain = useBatchesChain(ids);
  const [balances, setBalances] = useState<Record<number, bigint>>({});
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!account.address) return;
    let active = true;
    const entries = Object.entries(chain.rows).filter(([, r]) => r.offering);
    void Promise.all(
      entries.map(async ([id, r]) => {
        const shares = await readBalance(
          r.offering!.share_token,
          account.address!,
        );
        return [Number(id), shares] as const;
      }),
    ).then((pairs) => {
      if (active) setBalances(Object.fromEntries(pairs));
    });
    return () => {
      active = false;
    };
  }, [account.address, chain.rows, tick]);

  const holdings: Holding[] = catalogue.flatMap((info) => {
    const row = chain.rows[info.batchId];
    const shares = balances[info.batchId] ?? 0n;
    if (!row?.offering || shares === 0n) return [];
    return [
      {
        info,
        offering: row.offering,
        mark: row.mark,
        shares,
        price: row.mark?.value ?? row.offering.price,
      },
    ];
  });

  const produced: Produced[] = catalogue.flatMap((info) => {
    const row = chain.rows[info.batchId];
    if (!row?.offering) return [];
    const mine =
      !!account.address &&
      (info.producerAddress === account.address ||
        row.offering.producer === account.address);
    return mine ? [{ info, offering: row.offering, mark: row.mark }] : [];
  });

  const value = holdings.reduce((sum, h) => sum + h.price * h.shares, 0n);
  const sales = produced.reduce(
    (sum, p) => sum + p.offering.price * p.offering.sold,
    0n,
  );

  return {
    holdings,
    produced,
    value,
    sales,
    loading: chain.loading,
    configured: !!SHARES_ID,
    refresh: () => setTick((t) => t + 1),
  };
};
