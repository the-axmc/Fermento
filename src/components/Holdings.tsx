import React from "react";
import { Link } from "react-router-dom";
import type { Listing, Offering } from "batch_shares_contract";
import { SHARES_ID, getShares } from "../contracts/client";
import type { BatchInfo } from "../data/batches";
import { useCatalogue } from "../hooks/useCatalogue";
import { useAccount } from "../hooks/useAccount";
import { useBatchesChain } from "../hooks/useBatchChain";
import { readBalance } from "../wallet/balances";
import { getKit } from "../wallet/kit";
import { recordActivity } from "../lib/activity";
import { money } from "../lib/format";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL_DARK = "#08403E";
const RULE = "rgba(43, 27, 61, 0.22)";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

interface Holding {
  info: BatchInfo;
  offering: Offering;
  shares: bigint;
  /** Mark per share, or the fill price when no mark exists. */
  mark: bigint;
  /** The inspector declared the batch failed: refunds are open. */
  defaulted: boolean;
  /** Payment still held per share, refunded after a failure. */
  heldPerShare: bigint;
}

type Action = {
  kind: "redeem" | "send" | "refund" | "sell";
  holding: Holding;
} | null;

/** "12.5" -> 125000000n (7-decimal USDC units); undefined when not a price. */
const toUnits = (text: string): bigint | undefined => {
  const m = /^(\d+)(?:[.,](\d{0,7}))?$/.exec(text.trim());
  if (!m) return undefined;
  return BigInt(m[1]) * 10_000_000n + BigInt((m[2] ?? "").padEnd(7, "0"));
};

const fromUnits = (raw: bigint) => (Number(raw) / 10_000_000).toFixed(2);

/* --------------------------------- Sheet ---------------------------------- */

const ActionSheet: React.FC<{
  action: NonNullable<Action>;
  onClose: () => void;
  onDone: () => void;
}> = ({ action, onClose, onDone }) => {
  const account = useAccount();
  const { holding } = action;
  const perUnit = holding.offering.shares_per_unit;
  const maxUnits = holding.shares / perUnit;
  const [qty, setQty] = React.useState(
    action.kind === "redeem" ? perUnit.toString() : holding.shares.toString(),
  );
  const [to, setTo] = React.useState("");
  const [ask, setAsk] = React.useState(fromUnits(holding.mark));
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<string | null>(null);
  const [claimId, setClaimId] = React.useState<number | null>(null);

  const shares = BigInt(qty.replace(/\D/g, "") || "0");
  const now = BigInt(Math.floor(Date.now() / 1000));
  const mature = now >= holding.offering.matures_at;
  const whole = shares > 0n && shares % perUnit === 0n;
  const price = toUnits(ask);
  const invalid =
    shares === 0n ||
    shares > holding.shares ||
    (action.kind === "redeem" && (!whole || !mature)) ||
    (action.kind === "send" && !/^[GC][A-Z2-7]{55}$/.test(to.trim())) ||
    (action.kind === "sell" && !price);

  const run = async () => {
    if (!account.address) return;
    setBusy(true);
    setError(null);
    try {
      if (action.kind === "redeem") {
        const tx = await getShares().redeem({
          batch_id: holding.info.batchId,
          holder: account.address,
          shares,
        });
        setHash(await account.submit(tx));
        // Simulated id: the claim page confirms it against the registry.
        setClaimId(tx.result);
        recordActivity(account.address, {
          kind: "redeem",
          title: `Redeemed ${(shares / perUnit).toString()} ${holding.info.unit}${shares / perUnit === 1n ? "" : "s"} · ${holding.info.label}`,
          batchId: holding.info.batchId,
        });
      } else if (action.kind === "refund") {
        const tx = await getShares().refund({
          batch_id: holding.info.batchId,
          holder: account.address,
          shares,
        });
        setHash(await account.submit(tx));
        recordActivity(account.address, {
          kind: "redeem",
          title: `Refund · ${holding.info.label}`,
          batchId: holding.info.batchId,
          amount: holding.heldPerShare * shares,
        });
      } else if (action.kind === "sell") {
        const tx = await getShares().list_for_sale({
          batch_id: holding.info.batchId,
          seller: account.address,
          shares,
          price: price!,
        });
        setHash(await account.submit(tx));
        recordActivity(account.address, {
          kind: "listing",
          title: `Listed ${shares.toString()} shares at ${money(price)} · ${holding.info.label}`,
          batchId: holding.info.batchId,
        });
      } else {
        const result = await getKit().transfer(
          holding.offering.share_token,
          to.trim(),
          Number(shares),
        );
        if (!result.success) throw new Error(result.error.message);
        setHash(result.hash);
        recordActivity(account.address, {
          kind: "send",
          title: `Sent ${shares.toString()} shares · ${holding.info.label}`,
          batchId: holding.info.batchId,
        });
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const input: React.CSSProperties = {
    height: 48,
    padding: "0 14px",
    borderRadius: 14,
    border: `1.5px solid ${RULE}`,
    background: "#fff",
    fontFamily: MONO,
    fontSize: 15,
    color: INK,
    outline: "none",
  };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 30 }}>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          border: 0,
          padding: 0,
          background: "rgba(43, 27, 61, 0.55)",
          cursor: "pointer",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: "absolute",
          left: "50%",
          transform: "translateX(-50%)",
          width: "100%",
          maxWidth: "var(--frame)",
          boxSizing: "border-box",
          bottom: 0,
          background: CREAM,
          borderRadius: "32px 32px 0 0",
          padding: "28px 24px",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          fontFamily: SANS,
          color: INK,
        }}
      >
        <h2
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 26,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {hash
            ? action.kind === "redeem"
              ? "Claim recorded"
              : action.kind === "refund"
                ? "Money back"
                : action.kind === "sell"
                  ? "Listed for sale"
                  : "Shares sent"
            : action.kind === "redeem"
              ? `Redeem ${holding.info.label}`
              : action.kind === "refund"
                ? `Take back your money`
                : action.kind === "sell"
                  ? `Sell shares of ${holding.info.label}`
                  : `Send shares of ${holding.info.label}`}
        </h2>

        {hash ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
              {action.kind === "redeem"
                ? `${(shares / perUnit).toString()} ${holding.info.unit}(s) are yours to collect. Show the claim at the cellar, then confirm on it once you have them: that pays the producer the rest.`
                : action.kind === "refund"
                  ? `${money(holding.heldPerShare * shares)} is back in your wallet.`
                  : action.kind === "sell"
                    ? `${shares.toString()} shares are on sale at ${money(price)} each. You get paid when someone buys, less a 1 % fee; cancel any time from your cellar.`
                    : `${shares.toString()} shares moved to ${to.trim().slice(0, 6)}…`}
            </p>
            {claimId !== null && (
              <Link
                to={`/claim/${claimId}`}
                style={{ fontSize: 14, fontWeight: 700, color: INK }}
              >
                Open claim Nº {claimId}
              </Link>
            )}
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 14, fontWeight: 700, color: INK }}
            >
              See it on the explorer
            </a>
            <button type="button" onClick={onClose} style={button(true)}>
              Done
            </button>
          </>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                fontSize: 13,
              }}
            >
              Shares ({holding.shares.toString()} held
              {action.kind === "redeem"
                ? `, ${perUnit.toString()} per ${holding.info.unit}, ${maxUnits.toString()} redeemable`
                : ""}
              )
              <input
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                style={input}
              />
            </label>
            {action.kind === "send" && (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                To (another Fermento account, C… or G…)
                <input
                  type="text"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  placeholder="C…"
                  style={input}
                />
              </label>
            )}
            {action.kind === "sell" && (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  fontSize: 13,
                }}
              >
                Price per share in USDC (reference value now{" "}
                {money(holding.mark)})
                <input
                  type="text"
                  inputMode="decimal"
                  value={ask}
                  onChange={(e) => setAsk(e.target.value)}
                  style={input}
                />
                {price !== undefined && shares > 0n && (
                  <span style={{ color: INK_SOFT }}>
                    You receive{" "}
                    {money(price * shares - (price * shares) / 100n)} if it all
                    sells (1 % fee).
                  </span>
                )}
              </label>
            )}
            {action.kind === "refund" && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.4 }}>
                An independent inspector found a problem with this batch. Hand
                back your shares for the {money(holding.heldPerShare)} per share
                the contract still holds.
              </p>
            )}
            {action.kind === "redeem" && !mature && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>
                This batch is not mature yet.
              </p>
            )}
            {action.kind === "redeem" && shares > 0n && !whole && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>
                Redeem whole {holding.info.unit}s: multiples of{" "}
                {perUnit.toString()} shares.
              </p>
            )}
            {error && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>
            )}
            <button
              type="button"
              disabled={invalid || busy}
              onClick={() => void run()}
              style={button(!invalid && !busy)}
            >
              {busy
                ? "Confirming…"
                : action.kind === "redeem"
                  ? `Redeem ${whole ? (shares / perUnit).toString() : ""} ${holding.info.unit}${shares / perUnit === 1n ? "" : "s"}`
                  : action.kind === "refund"
                    ? `Take back ${money(holding.heldPerShare * shares)}`
                    : action.kind === "sell"
                      ? `List ${shares.toString()} for sale`
                      : "Send"}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

const button = (enabled: boolean): React.CSSProperties => ({
  height: 56,
  borderRadius: 28,
  border: 0,
  background: INK,
  color: CREAM,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 18,
  cursor: enabled ? "pointer" : "default",
  opacity: enabled ? 1 : 0.5,
});

/* -------------------------------- Holdings -------------------------------- */

/** Shares the signed-in account holds in each known batch, with Redeem and Send. */
const Holdings: React.FC = () => {
  const account = useAccount();
  const catalogue = useCatalogue();
  const ids = React.useMemo(() => catalogue.map((b) => b.batchId), [catalogue]);
  const chain = useBatchesChain(ids);
  const [balances, setBalances] = React.useState<Record<number, bigint>>({});
  const [action, setAction] = React.useState<Action>(null);
  const [tick, setTick] = React.useState(0);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
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
        shares,
        mark: row.mark?.value ?? row.offering.price,
        defaulted: !!row.escrow?.defaulted,
        heldPerShare: row.heldPerShare ?? 0n,
      },
    ];
  });
  const total = holdings.reduce((sum, h) => sum + h.mark * h.shares, 0n);

  /** This account's open resale listings; their shares wait in the contract. */
  const mine: { info: BatchInfo; listing: Listing }[] = catalogue.flatMap(
    (info) =>
      (chain.rows[info.batchId]?.listings ?? [])
        .filter((l) => l.seller === account.address)
        .map((listing) => ({ info, listing })),
  );
  const [cancelling, setCancelling] = React.useState<number | null>(null);
  const [cancelError, setCancelError] = React.useState<string | null>(null);

  const cancel = async (listing: Listing) => {
    if (!account.address) return;
    setCancelling(listing.id);
    setCancelError(null);
    try {
      const tx = await getShares().cancel_listing({
        listing_id: listing.id,
        seller: account.address,
      });
      await account.submit(tx);
      setTick((t) => t + 1);
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : String(err));
    } finally {
      setCancelling(null);
    }
  };

  if (!account.address || !SHARES_ID) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        fontFamily: SANS,
        color: INK,
      }}
    >
      {/* Summary row; tap to show the batches with Send and Redeem */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 14,
          width: "100%",
          padding: "16px 0",
          border: 0,
          borderBottom: `1.5px solid ${RULE}`,
          background: "transparent",
          fontFamily: SANS,
          color: INK,
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <svg
          width="24"
          height="24"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M7 3h10c1.6 3 1.6 15 0 18H7C5.4 18 5.4 6 7 3z" />
          <path d="M5.9 8.5h12.2M5.9 15.5h12.2" />
        </svg>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800 }}>
          In your cellar
        </span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>
          {money(total)}
        </span>
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          style={{
            transform: open ? "rotate(90deg)" : "none",
            transition: "transform 150ms",
          }}
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && holdings.length === 0 && mine.length === 0 && (
        <p
          style={{
            margin: 0,
            padding: "6px 0 14px",
            fontSize: 14,
            color: INK_SOFT,
          }}
        >
          Nothing yet.{" "}
          <Link to="/market" style={{ color: RED }}>
            Browse the market
          </Link>
          .
        </p>
      )}

      {open &&
        holdings.map((h) => (
          <div
            key={h.info.batchId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderBottom: `1.5px solid ${RULE}`,
            }}
          >
            <Link
              to={`/batch/${h.info.batchId}`}
              style={{
                flex: 1,
                minWidth: 0,
                textDecoration: "none",
                color: INK,
              }}
            >
              <div style={{ fontWeight: 800, fontSize: 15 }}>{h.info.name}</div>
              <div style={{ fontSize: 12, color: INK_SOFT }}>
                {h.shares.toString()} shares · {h.info.label} · {money(h.mark)}{" "}
                each
              </div>
            </Link>
            <button
              type="button"
              onClick={() => setAction({ kind: "send", holding: h })}
              style={small(false)}
            >
              Send
            </button>
            {!h.defaulted && (
              <button
                type="button"
                onClick={() => setAction({ kind: "sell", holding: h })}
                style={small(false)}
              >
                Sell
              </button>
            )}
            {h.defaulted ? (
              <button
                type="button"
                onClick={() => setAction({ kind: "refund", holding: h })}
                style={{ ...small(true), background: RED }}
              >
                Refund
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setAction({ kind: "redeem", holding: h })}
                style={small(true)}
              >
                Redeem
              </button>
            )}
          </div>
        ))}

      {open &&
        mine.map(({ info, listing }) => (
          <div
            key={`listing-${listing.id}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "12px 0",
              borderBottom: `1.5px solid ${RULE}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>
                On sale · {info.name}
              </div>
              <div style={{ fontSize: 12, color: INK_SOFT }}>
                {listing.shares.toString()} shares at {money(listing.price)} ·{" "}
                {info.label}
              </div>
            </div>
            <button
              type="button"
              disabled={cancelling === listing.id}
              onClick={() => void cancel(listing)}
              style={small(false)}
            >
              {cancelling === listing.id ? "…" : "Cancel"}
            </button>
          </div>
        ))}
      {cancelError && (
        <p style={{ margin: "8px 0 0", fontSize: 13, color: RED }}>
          {cancelError}
        </p>
      )}

      {action && (
        <ActionSheet
          action={action}
          onClose={() => setAction(null)}
          onDone={() => setTick((t) => t + 1)}
        />
      )}
    </div>
  );
};

const small = (primary: boolean): React.CSSProperties => ({
  height: 36,
  padding: "0 14px",
  borderRadius: 18,
  border: primary ? 0 : `1.5px solid ${INK}`,
  background: primary ? TEAL_DARK : "transparent",
  color: primary ? CREAM : INK,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 13,
  cursor: "pointer",
  flexShrink: 0,
});

export default Holdings;
