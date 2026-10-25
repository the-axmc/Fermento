import { useEffect, useState } from "react";

export interface TreasuryAsset {
  issuer: string;
  sac: string;
  trustline: boolean;
  balance: string;
}

export interface Treasury {
  address: string;
  max: number;
  assets: Record<string, TreasuryAsset>;
}

/** Testnet treasury served by the producer API; undefined while loading or when the API is down. */
export const useTreasury = () => {
  const [treasury, setTreasury] = useState<Treasury | undefined>();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let active = true;
    fetch("/api/treasury")
      .then((r) => (r.ok ? (r.json() as Promise<Treasury>) : undefined))
      .then((t) => {
        if (active) setTreasury(t);
      })
      .catch(() => {
        if (active) setTreasury(undefined);
      });
    return () => {
      active = false;
    };
  }, [tick]);

  return { treasury, refresh: () => setTick((t) => t + 1) };
};

/** Ask the producer API to send test tokens to `to`. Throws with the API's message. */
export const requestFunds = async (
  to: string,
  asset: "USDC" | "EURC",
  amount: number,
): Promise<string> => {
  const r = await fetch("/api/fund", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ to, asset, amount }),
  });
  const body = (await r.json()) as { hash?: string; error?: string };
  if (!r.ok || !body.hash) {
    throw new Error(body.error ?? `Funding failed (${r.status})`);
  }
  return body.hash;
};
