/** Display helpers shared by the pages. Amounts are 7-decimal USDC units. */

const DECIMALS = 7n;
const BASE = 10n ** DECIMALS;

/** "$12.40" from raw USDC units. */
export const money = (
  raw: bigint | number | undefined,
  symbol = "$",
): string => {
  if (raw === undefined) return `${symbol}—`;
  const v = BigInt(raw);
  const neg = v < 0n;
  const abs = neg ? -v : v;
  const whole = abs / BASE;
  const cents = ((abs % BASE) * 100n) / BASE;
  return `${neg ? "−" : ""}${symbol}${whole}.${cents.toString().padStart(2, "0")}`;
};

/** "+3.4%" change from a to b, or undefined when a is zero. */
export const pctChange = (from: bigint, to: bigint): string | undefined => {
  if (from === 0n) return undefined;
  const bps = ((to - from) * 10_000n) / from;
  const sign = bps > 0n ? "▲ " : bps < 0n ? "▼ " : "";
  const abs = bps < 0n ? -bps : bps;
  return `${sign}${abs / 100n}.${(abs % 100n).toString().padStart(2, "0").slice(0, 1)}%`;
};

/** "12 Sep 2026" from a unix timestamp in seconds. */
export const shortDate = (unix: bigint | number | undefined): string => {
  if (unix === undefined) return "—";
  return new Date(Number(unix) * 1000).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

/** Share of the aging period already elapsed, from 0 to 1. */
export const progress = (
  filledAt: bigint | number,
  maturesAt: bigint | number,
  now = Date.now() / 1000,
): number => {
  const a = Number(filledAt);
  const b = Number(maturesAt);
  if (b <= a) return 1;
  return Math.min(1, Math.max(0, (now - a) / (b - a)));
};

/** "15.0 °C" from hundredths of a degree. */
export const celsius = (hundredths: number | undefined): string =>
  hundredths === undefined ? "—" : `${(hundredths / 100).toFixed(1)} °C`;

export const shortAddress = (a: string | undefined, n = 4) =>
  a ? `${a.slice(0, n)}…${a.slice(-n)}` : "";
