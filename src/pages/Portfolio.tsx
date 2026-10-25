import React from "react";
import { Link, useNavigate } from "react-router-dom";
import Landscape from "../components/Landscape";
import type { BatchInfo } from "../data/batches";
import { useAccount } from "../hooks/useAccount";
import { useHoldings } from "../hooks/useHoldings";
import { money, pctChange } from "../lib/format";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL_DARK = "#08403E";
const RULE = "rgba(43, 27, 61, 0.22)";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

type Tab = "bought" | "produced";

/* ------------------------------- Illustrations ----------------------------- */

const Sun: React.FC = () => (
  <svg
    width="240"
    height="240"
    viewBox="0 0 240 240"
    style={{ position: "absolute", right: -90, top: -80 }}
    aria-hidden="true"
  >
    <g fill="none" strokeWidth="18">
      <circle cx="120" cy="120" r="108" stroke="#C8341E" />
      <circle cx="120" cy="120" r="88" stroke="#F07C2B" />
      <circle cx="120" cy="120" r="68" stroke="#F5B82E" />
      <circle cx="120" cy="120" r="48" stroke="#F7A8C8" />
    </g>
    <circle cx="120" cy="120" r="30" fill="#157A78" />
  </svg>
);

const Bottle: React.FC<{ info: BatchInfo }> = ({ info }) => (
  <svg width="34" height="68" viewBox="0 0 40 68" aria-hidden="true">
    <path
      d="M16 6 L24 6 L24 22 C24 28 32 30 32 38 L32 66 L8 66 L8 38 C8 30 16 28 16 22 Z"
      fill={info.glass}
    />
    <rect x="15" y="2" width="10" height="12" rx="2" fill={info.cap} />
    <rect x="10" y="42" width="20" height="18" rx="3" fill={info.labelColor} />
  </svg>
);

/* ---------------------------------- Pieces --------------------------------- */

const Row: React.FC<{
  info: BatchInfo;
  meta: string;
  amount: string;
  change?: string;
  last?: boolean;
}> = ({ info, meta, amount, change, last }) => (
  <Link
    to={`/batch/${info.batchId}`}
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: "16px 0",
      borderTop: `1.5px solid ${RULE}`,
      borderBottom: last ? `1.5px solid ${RULE}` : 0,
      textDecoration: "none",
      color: INK,
    }}
  >
    <Bottle info={info} />
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 2,
      }}
    >
      <span style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.1 }}>
        {info.name}
      </span>
      <span style={{ fontSize: 13, color: INK_SOFT }}>{meta}</span>
    </div>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-end",
        gap: 2,
      }}
    >
      <span style={{ fontFamily: MONO, fontWeight: 700, fontSize: 15 }}>
        {amount}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 11,
          fontWeight: 700,
          color: change?.startsWith("▼") ? RED : TEAL_DARK,
        }}
      >
        {change ?? "—"}
      </span>
    </div>
  </Link>
);

const segment = (on: boolean): React.CSSProperties => ({
  height: 44,
  padding: "0 18px",
  borderRadius: 22,
  border: 0,
  background: on ? RED : "transparent",
  color: on ? CREAM : INK,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 15,
  display: "flex",
  alignItems: "center",
  gap: 6,
  cursor: "pointer",
});

/* ---------------------------------- Page ----------------------------------- */

const Portfolio: React.FC = () => {
  const account = useAccount();
  const navigate = useNavigate();
  const { holdings, produced, value, sales, loading, configured } =
    useHoldings();
  const [tab, setTab] = React.useState<Tab>("bought");

  const rows = tab === "bought" ? holdings : produced;
  const headline = tab === "bought" ? value : sales;

  return (
    <div style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 16,
          padding: "18px 24px 0",
        }}
      >
        <Sun />

        <div
          style={{
            position: "relative",
            fontFamily: DISPLAY,
            fontSize: 30,
            lineHeight: 1.05,
            color: RED,
          }}
        >
          <span style={{ fontSize: 20, lineHeight: 1.05 }}>Fermentos</span>
          <br />
          {account.address ? "Your cellar" : "Portfolio"}
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 11,
              color: INK_SOFT,
              textTransform: "uppercase",
            }}
          >
            {tab === "bought" ? "Worth today" : "Sold so far"}
          </span>
          <span
            style={{
              fontSize: 56,
              fontWeight: 800,
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            {account.address ? money(headline) : "$0.00"}
          </span>
        </div>

        <div
          role="tablist"
          style={{
            alignSelf: "flex-start",
            display: "flex",
            padding: 4,
            borderRadius: 26,
            background: CREAM,
          }}
        >
          <button
            type="button"
            role="tab"
            aria-selected={tab === "bought"}
            onClick={() => setTab("bought")}
            style={segment(tab === "bought")}
          >
            Bought
            <span style={{ fontFamily: MONO, fontSize: 12, opacity: 0.75 }}>
              {holdings.length}
            </span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "produced"}
            onClick={() => setTab("produced")}
            style={segment(tab === "produced")}
          >
            Produced
            <span style={{ fontFamily: MONO, fontSize: 12, opacity: 0.75 }}>
              {produced.length}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {!account.address && (
            <p
              style={{
                margin: 0,
                padding: "16px 0",
                borderTop: `1.5px solid ${RULE}`,
                fontSize: 15,
              }}
            >
              <button
                type="button"
                onClick={() => navigate("/signin")}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  fontFamily: SANS,
                  fontSize: 15,
                  fontWeight: 700,
                  color: RED,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>{" "}
              to see what you own and what you have listed.
            </p>
          )}

          {account.address && !configured && (
            <p style={{ margin: 0, padding: "16px 0", fontSize: 14 }}>
              Contracts are not configured in .env.
            </p>
          )}

          {account.address && configured && rows.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "16px 0",
                borderTop: `1.5px solid ${RULE}`,
                fontSize: 15,
                color: INK_SOFT,
              }}
            >
              {loading
                ? "Reading the ledger…"
                : tab === "bought"
                  ? "Nothing bought yet. Find a batch on the market."
                  : "Nothing listed yet. Add a ferment to put a batch on sale."}
            </p>
          )}

          {tab === "bought" &&
            holdings.map((h, i) => (
              <Row
                key={h.info.batchId}
                info={h.info}
                meta={`${h.info.vintage} · ${h.info.label} · ${h.shares.toString()} shares`}
                amount={money(h.price * h.shares)}
                change={pctChange(h.offering.price, h.price)}
                last={i === holdings.length - 1}
              />
            ))}

          {tab === "produced" &&
            produced.map((p, i) => (
              <Row
                key={p.info.batchId}
                info={p.info}
                meta={`${p.info.vintage} · ${p.info.label} · ${p.offering.sold.toString()}/${p.offering.total_shares.toString()} sold`}
                amount={money(p.offering.price * p.offering.sold)}
                change={
                  p.mark ? pctChange(p.offering.price, p.mark.value) : undefined
                }
                last={i === produced.length - 1}
              />
            ))}
        </div>

        {account.address && (
          <Link
            to={produced.length > 0 ? "/producer/me" : "/produce"}
            style={{
              alignSelf: "flex-start",
              marginTop: -12,
              display: "flex",
              alignItems: "center",
              gap: 8,
              height: 36,
              padding: "0 14px 0 16px",
              borderRadius: 18,
              background: CREAM,
              color: INK,
              fontSize: 14,
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            {produced.length > 0 ? "Your producer page" : "Add a ferment"}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke={RED}
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}

        <Landscape />
      </div>
    </div>
  );
};

export default Portfolio;
