/**
 * Local activity ledger for the wallet page.
 *
 * The smart account is a contract, so there is no cheap way to read its
 * history from the network. Instead every action this app submits (funding,
 * buying, redeeming, sending) is appended here, per account, in localStorage.
 */

export type ActivityKind = "funds" | "buy" | "redeem" | "send";

export interface Activity {
  id: string;
  kind: ActivityKind;
  /** Unix milliseconds. */
  at: number;
  title: string;
  batchId?: number;
  /** Signed amount in 7-decimal token units; positive is incoming. */
  amount?: bigint;
  /** Currency symbol for `amount`. */
  symbol?: string;
}

type Stored = Omit<Activity, "amount"> & { amount?: string };

const KEY = (address: string) => `fermento:activity:${address}`;
const EVENT = "fermento:activity";
const LIMIT = 50;

const parse = (raw: string | null): Activity[] => {
  if (!raw) return [];
  try {
    const rows = JSON.parse(raw) as Stored[];
    return rows.map((r) => ({
      ...r,
      amount: r.amount === undefined ? undefined : BigInt(r.amount),
    }));
  } catch {
    return [];
  }
};

export const readActivity = (address: string): Activity[] => {
  try {
    return parse(localStorage.getItem(KEY(address)));
  } catch {
    return [];
  }
};

/** Append one entry (newest first) and notify open hooks. */
export const recordActivity = (
  address: string,
  entry: Omit<Activity, "id" | "at">,
): void => {
  const row: Activity = {
    ...entry,
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    at: Date.now(),
  };
  const rows = [row, ...readActivity(address)].slice(0, LIMIT);
  const stored: Stored[] = rows.map((r) => ({
    ...r,
    amount: r.amount === undefined ? undefined : r.amount.toString(),
  }));
  try {
    localStorage.setItem(KEY(address), JSON.stringify(stored));
  } catch {
    /* private mode or full storage: the ledger is a convenience only */
  }
  window.dispatchEvent(new Event(EVENT));
};

/** Subscribe to changes made by `recordActivity` in this tab or another. */
export const onActivity = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(EVENT, listener);
    window.removeEventListener("storage", listener);
  };
};
