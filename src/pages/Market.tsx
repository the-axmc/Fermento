import React from "react";
import { Link } from "react-router-dom";
import Landscape from "../components/Landscape";
import type { BatchInfo } from "../data/batches";
import { useCatalogue } from "../hooks/useCatalogue";
import { useBatchesChain } from "../hooks/useBatchChain";
import { money, shortDate } from "../lib/format";
import "./Market.css";

/* ---------------------------------- Types --------------------------------- */

type View = "list" | "grid";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL_DARK = "#08403E";
const PLUM = "#7A1645";
const RULE = "rgba(43, 27, 61, 0.18)";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

/** Catalogue entry plus the live figures the cards show. */
type Row = BatchInfo & {
  price: string;
  left: string;
  matures: string;
  meta: string;
};

/* ------------------------------- Illustrations ----------------------------- */

const Bottle: React.FC<{
  listing: Row;
  width: number;
  height: number;
  base: number;
}> = ({ listing, width, height, base }) => (
  <svg width={width} height={height} viewBox="0 0 40 68" aria-hidden="true">
    <path
      d={`M16 6 L24 6 L24 22 C24 28 32 30 32 38 L32 ${base} L8 ${base} L8 38 C8 30 16 28 16 22 Z`}
      fill={listing.glass}
    />
    <rect x="15" y="2" width="10" height="12" rx="2" fill={listing.cap} />
    <rect
      x="10"
      y="42"
      width="20"
      height="18"
      rx="3"
      fill={listing.labelColor}
    />
  </svg>
);

const SunArcs: React.FC = () => (
  <svg
    viewBox="0 0 230 150"
    style={{
      position: "absolute",
      right: -30,
      top: 54,
      width: 200,
      height: 91,
    }}
    aria-hidden="true"
  >
    <g fill="none" strokeWidth="16">
      <path d="M25 160 A90 90 0 0 1 205 160" stroke="#C8341E" />
      <path d="M41 160 A74 74 0 0 1 189 160" stroke="#F07C2B" />
      <path d="M57 160 A58 58 0 0 1 173 160" stroke="#F5B82E" />
      <path d="M73 160 A42 42 0 0 1 157 160" stroke="#FFF4E2" />
    </g>
    <circle cx="115" cy="160" r="34" fill="#157A78" />
  </svg>
);

/* ---------------------------------- Pieces --------------------------------- */

const resaleTag: React.CSSProperties = {
  fontFamily: MONO,
  fontSize: 10,
  lineHeight: "14px",
  fontWeight: 700,
  textTransform: "uppercase",
  color: PLUM,
};

const oneLine: React.CSSProperties = {
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

const viewButtonStyle = (active: boolean): React.CSSProperties => ({
  width: 40,
  height: 36,
  padding: 0,
  borderRadius: 18,
  border: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",
  background: active ? RED : "transparent",
  color: active ? CREAM : INK,
});

const ListRow: React.FC<{ listing: Row }> = ({ listing }) => (
  <Link
    to={`/batch/${listing.batchId}`}
    className="market-item"
    style={{
      display: "flex",
      alignItems: "center",
      gap: 12,
      padding: "10px 0",
      borderBottom: `1.5px solid ${RULE}`,
      textDecoration: "none",
    }}
  >
    <Bottle listing={listing} width={26} height={52} base={66} />
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        flex: 1,
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span
          className="market-item-name"
          style={{ fontWeight: 800, fontSize: 17, lineHeight: 1.1 }}
        >
          {listing.name}
        </span>
      </div>
      <span style={{ fontSize: 12, color: INK_SOFT }}>{listing.meta}</span>
      <span style={{ fontSize: 12, color: INK_SOFT }}>
        Matures {listing.matures}
      </span>
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
        {listing.price}
      </span>
      <span style={{ fontSize: 12, color: TEAL_DARK, fontWeight: 700 }}>
        {listing.left}
      </span>
    </div>
  </Link>
);

/** Every slot has a fixed height so all grid cards render at the same size. */
const GridCard: React.FC<{ listing: Row }> = ({ listing }) => (
  <Link
    to={`/batch/${listing.batchId}`}
    className="market-item"
    style={{
      display: "flex",
      flexDirection: "column",
      gap: 8,
      minWidth: 0,
      textDecoration: "none",
    }}
  >
    <div
      style={{
        height: 126,
        borderRadius: 18,
        background: listing.tile,
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Bottle listing={listing} width={46} height={104} base={68} />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {/* Reserve the tag row on every card so names line up */}
      <span
        style={{
          ...resaleTag,
          height: 14,
          visibility: "hidden",
        }}
        aria-hidden
      >
        Resale
      </span>
      <span
        className="market-item-name"
        style={{
          fontWeight: 800,
          fontSize: 16,
          lineHeight: 1.1,
          height: "2.2em",
          overflow: "hidden",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
        }}
      >
        {listing.name}
      </span>
      <span
        style={{
          ...oneLine,
          fontSize: 12,
          lineHeight: "16px",
          color: INK_SOFT,
        }}
      >
        {listing.label}
      </span>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          gap: 6,
          height: 22,
          minWidth: 0,
        }}
      >
        <span
          style={{
            ...oneLine,
            fontFamily: MONO,
            fontWeight: 700,
            fontSize: 14,
            minWidth: 0,
          }}
        >
          {listing.price}
        </span>
        <span
          style={{
            whiteSpace: "nowrap",
            flexShrink: 0,
            fontSize: 12,
            color: TEAL_DARK,
            fontWeight: 700,
          }}
        >
          {listing.left}
        </span>
      </div>
    </div>
  </Link>
);

/* --------------------------------- Component ------------------------------- */

const Market: React.FC = () => {
  const [view, setView] = React.useState<View>("list");
  const [q, setQ] = React.useState("");

  const catalogue = useCatalogue();
  const ids = React.useMemo(() => catalogue.map((b) => b.batchId), [catalogue]);
  const chain = useBatchesChain(ids);

  const all: Row[] = catalogue.map((b) => {
    const live = chain.rows[b.batchId];
    const offering = live?.offering;
    const left =
      offering === undefined
        ? chain.loading
          ? "…"
          : "not on sale"
        : !offering.open
          ? "sale closed"
          : `${(offering.total_shares - offering.sold).toString()} left`;
    return {
      ...b,
      meta: `${b.label} · ${b.producer}`,
      price: money(live?.mark?.value ?? offering?.price),
      left,
      matures: offering ? shortDate(offering.matures_at) : "—",
    };
  });

  const needle = q.trim().toLowerCase();
  const rows = all.filter(
    (r) => !needle || `${r.name} ${r.meta}`.toLowerCase().includes(needle),
  );

  return (
    <div className="market" style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 14,
          padding: "18px 24px 0",
        }}
      >
        <SunArcs />

        {/* Brand on the left, view switch on the right: one row instead of three */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 12,
            minHeight: 36,
          }}
        >
          <div
            style={{
              fontFamily: DISPLAY,
              fontSize: 20,
              lineHeight: 1,
              color: RED,
            }}
          >
            Fermentos
            <br />
            Norberto <span style={{ color: INK }}>&amp;</span> Raimunda
          </div>

          <div
            role="group"
            aria-label="View"
            style={{
              display: "flex",
              flexShrink: 0,
              padding: 3,
              borderRadius: 22,
              background: CREAM,
            }}
          >
            <button
              type="button"
              aria-pressed={view === "list"}
              aria-label="List view"
              onClick={() => setView("list")}
              style={viewButtonStyle(view === "list")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <circle cx="5" cy="6" r="2.2" />
                <circle cx="5" cy="12" r="2.2" />
                <circle cx="5" cy="18" r="2.2" />
                <rect x="9.5" y="4.5" width="11.5" height="3" rx="1.5" />
                <rect x="9.5" y="10.5" width="11.5" height="3" rx="1.5" />
                <rect x="9.5" y="16.5" width="11.5" height="3" rx="1.5" />
              </svg>
            </button>
            <button
              type="button"
              aria-pressed={view === "grid"}
              aria-label="Grid view"
              onClick={() => setView("grid")}
              style={viewButtonStyle(view === "grid")}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <rect x="3" y="3" width="8" height="8" rx="2.5" />
                <rect x="13" y="3" width="8" height="8" rx="4" />
                <rect x="3" y="13" width="8" height="8" rx="4" />
                <rect x="13" y="13" width="8" height="8" rx="2.5" />
              </svg>
            </button>
          </div>
        </div>

        <h1
          style={{
            position: "relative",
            margin: "6px 0 0",
            fontFamily: SANS,
            fontWeight: 800,
            fontSize: 38,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            color: INK,
          }}
        >
          The market
        </h1>

        <label
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            gap: 10,
            height: 46,
            padding: "0 16px",
            borderRadius: 23,
            background: "#FFFFFF",
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke={INK}
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="6.5" />
            <path d="M16 16l4 4" />
          </svg>
          <span
            style={{
              position: "absolute",
              width: 1,
              height: 1,
              overflow: "hidden",
              clip: "rect(0 0 0 0)",
            }}
          >
            Search batches
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search batches or producers"
            style={{
              flex: 1,
              minWidth: 0,
              height: 44,
              border: 0,
              background: "transparent",
              fontFamily: SANS,
              fontSize: 16,
              color: INK,
              outline: "none",
            }}
          />
        </label>

        {rows.length > 0 && view === "list" && (
          <div className="market-list" style={{ position: "relative" }}>
            {rows.map((r) => (
              <ListRow key={r.batchId} listing={r} />
            ))}
          </div>
        )}

        {rows.length > 0 && view === "grid" && (
          <div
            className="market-grid"
            style={{
              position: "relative",
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gridAutoRows: "1fr",
              gap: "16px 14px",
            }}
          >
            {rows.map((r) => (
              <GridCard key={r.batchId} listing={r} />
            ))}
          </div>
        )}

        {rows.length === 0 && (
          <p
            style={{
              margin: 0,
              padding: "16px 0",
              textAlign: "center",
              fontSize: 15,
              color: INK_SOFT,
            }}
          >
            No batches match that search.
          </p>
        )}

        <Landscape />
      </div>
    </div>
  );
};

export default Market;
