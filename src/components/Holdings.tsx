import React from "react";
import { Link } from "react-router-dom";
import type { Offering } from "batch_shares_contract";
import { SHARES_ID, getShares } from "../contracts/client";
import type { BatchInfo } from "../data/batches";
import { useCatalogue } from "../hooks/useCatalogue";
import { useAccount } from "../hooks/useAccount";
import { useBatchesChain } from "../hooks/useBatchChain";
import { readBalance } from "../wallet/balances";
import { getKit } from "../wallet/kit";
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
}

type Action = { kind: "redeem" | "send"; holding: Holding } | null;

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
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<string | null>(null);

  const shares = BigInt(qty.replace(/\D/g, "") || "0");
  const now = BigInt(Math.floor(Date.now() / 1000));
  const mature = now >= holding.offering.matures_at;
  const whole = shares > 0n && shares % perUnit === 0n;
  const invalid =
    shares === 0n ||
    shares > holding.shares ||
    (action.kind === "redeem" && (!whole || !mature)) ||
    (action.kind === "send" && !/^[GC][A-Z2-7]{55}$/.test(to.trim()));

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
      } else {
        const result = await getKit().transfer(
          holding.offering.share_token,
          to.trim(),
          Number(shares),
        );
        if (!result.success) throw new Error(result.error.message);
        setHash(result.hash);
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
    <div style={{ position: "absolute", inset: 0, zIndex: 10 }}>
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
          left: 0,
          right: 0,
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
              : "Shares sent"
            : action.kind === "redeem"
              ? `Redeem ${holding.info.label}`
              : `Send shares of ${holding.info.label}`}
        </h2>

        {hash ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
              {action.kind === "redeem"
                ? `${(shares / perUnit).toString()} ${holding.info.unit}(s) are yours to collect. The shares were burned and the storage fee settled.`
                : `${shares.toString()} shares moved to ${to.trim().slice(0, 6)}…`}
            </p>
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
      },
    ];
  });
  const total = holdings.reduce((sum, h) => sum + h.mark * h.shares, 0n);

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
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          padding: "14px 0 6px",
          borderTop: `1.5px solid ${RULE}`,
        }}
      >
        <span style={{ fontSize: 15, fontWeight: 700 }}>In your cellar</span>
        <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>
          {money(total)}
        </span>
      </div>

      {holdings.length === 0 && (
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

      {holdings.map((h) => (
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
            style={{ flex: 1, minWidth: 0, textDecoration: "none", color: INK }}
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
          <button
            type="button"
            onClick={() => setAction({ kind: "redeem", holding: h })}
            style={small(true)}
          >
            Redeem
          </button>
        </div>
      ))}

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
