import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Landscape from "../components/Landscape";
import type { BatchInfo } from "../data/batches";
import { useCatalogue } from "../hooks/useCatalogue";
import MarkChart from "../components/MarkChart";
import { useAccount } from "../hooks/useAccount";
import { useBalance } from "../hooks/useBalance";
import { useBatchChain } from "../hooks/useBatchChain";
import { SHARES_ID, USDC_ID, getShares } from "../contracts/client";
import { recordActivity } from "../lib/activity";
import { celsius, money, pctChange, progress, shortDate } from "../lib/format";
import Checkins from "../components/Checkins";
import { useProducer } from "../hooks/useProducer";
import "./Batch.css";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const ORANGE = "#F07C2B";
const PINK = "#F7A8C8";
const YELLOW = "#F5B82E";
const TEAL = "#157A78";
const RULE = "rgba(43, 27, 61, 0.22)";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

/* ------------------------------- Illustrations ----------------------------- */

const Barrel: React.FC = () => (
  <g>
    <path
      d="M16 8 C4 50 4 100 16 142 L114 142 C126 100 126 50 114 8 Z"
      fill="#B8733E"
      stroke={INK}
      strokeWidth="3"
      strokeLinejoin="round"
    />
    <g fill="none" stroke="#8A4F28" strokeWidth="1.5">
      {[34, 50, 80, 96].map((x) => (
        <path key={x} d={`M${x} 12 Q${65 + (x - 65) * 1.25} 75 ${x} 140`} />
      ))}
      <path d="M65 12 V140" />
    </g>
    <g fill="none" stroke={INK} strokeWidth="7" strokeLinecap="round">
      <path d="M9 30 Q65 36 121 30" />
      <path d="M6 50 Q65 56 124 50" />
      <path d="M6 100 Q65 106 124 100" />
      <path d="M9 122 Q65 128 121 122" />
    </g>
    <ellipse
      cx="65"
      cy="9"
      rx="50"
      ry="9"
      fill="#D99358"
      stroke={INK}
      strokeWidth="3"
    />
    <circle cx="65" cy="76" r="9" fill={RED} stroke={INK} strokeWidth="3" />
  </g>
);

const Bottle: React.FC<{ listing: BatchInfo }> = ({ listing }) => (
  <g>
    <path
      d="M17 28 L33 28 L33 60 C33 78 48 84 48 102 L48 178 Q48 184 42 184 L8 184 Q2 184 2 178 L2 102 C2 84 17 78 17 60 Z"
      fill={listing.glass}
    />
    <rect
      x="14"
      y="0"
      width="22"
      height="30"
      rx="5"
      fill={listing.cap}
      stroke={INK}
      strokeWidth="2.5"
    />
    <rect x="6" y="118" width="32" height="50" rx="3" fill={CREAM} />
    <rect
      x="41"
      y="108"
      width="3"
      height="64"
      rx="1.5"
      fill="rgba(255, 255, 255, 0.3)"
    />
    <circle cx="22" cy="132" r="9" fill={listing.labelColor} />
    <text
      x="22"
      y="134.5"
      textAnchor="middle"
      fontFamily={DISPLAY}
      fontSize="7"
      fill={RED}
    >
      N&amp;R
    </text>
    <text
      x="22"
      y="153"
      textAnchor="middle"
      fontFamily={SANS}
      fontSize="4.6"
      fontWeight="800"
      fill={INK}
    >
      {listing.cat.toUpperCase()}
    </text>
    <text
      x="22"
      y="160"
      textAnchor="middle"
      fontFamily={SANS}
      fontSize="4.4"
      fontWeight="700"
      fill={TEAL}
    >
      {listing.vintage}
    </text>
  </g>
);

/** Rainbow over the vessel and its unit, bleeding to both edges of the frame. */
const Hero: React.FC<{ listing: BatchInfo }> = ({ listing }) => (
  <svg
    className="hero-art"
    viewBox="0 0 390 270"
    style={{
      display: "block",
      flexShrink: 0,
      width: "calc(100% + 48px)",
      height: "auto",
      margin: "0 -24px",
    }}
    aria-hidden="true"
  >
    <g stroke={BG} strokeWidth="4">
      <circle cx="195" cy="270" r="258" fill={RED} />
      <circle cx="195" cy="270" r="224" fill={ORANGE} />
      <circle cx="195" cy="270" r="194" fill={PINK} />
      <circle cx="195" cy="270" r="164" fill={TEAL} />
    </g>
    <circle cx="195" cy="270" r="150" fill={CREAM} />
    <g fill={CREAM}>
      <path d="M339 56 Q341 68 353 70 Q341 72 339 84 Q337 72 325 70 Q337 68 339 56 Z" />
      <circle cx="48" cy="65" r="4" />
      <circle cx="320" cy="105" r="3" />
    </g>
    <g fill="rgba(43, 27, 61, 0.14)">
      <ellipse cx="169" cy="262" rx="74" ry="6" />
      <ellipse cx="270" cy="262" rx="26" ry="4" />
    </g>
    <g transform="translate(104 112)">
      <Barrel />
    </g>
    <g transform="translate(245 76)">
      <Bottle listing={listing} />
    </g>
  </svg>
);

const WineGlass: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke={INK}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M7 3h10l-.6 5.5a4.4 4.4 0 0 1-8.8 0z" />
    <path d="M12 13v8M8 21h8" />
  </svg>
);

/* ---------------------------------- Pieces --------------------------------- */

const mono: React.CSSProperties = {
  fontFamily: MONO,
  fontWeight: 700,
};

/** Luggage tag: pointed left edge with a punched hole, rounded right corners. */
const PriceTag: React.FC<{
  tilt: number;
  background: string;
  color: string;
  children: React.ReactNode;
}> = ({ tilt, background, color, children }) => (
  <div
    style={{
      position: "relative",
      flex: 1,
      minWidth: 0,
      minHeight: 98,
      boxSizing: "border-box",
      padding: "16px 14px 14px 30px",
      borderRadius: 12,
      clipPath: "polygon(18px 0, 100% 0, 100% 100%, 18px 100%, 0 50%)",
      transform: `rotate(${tilt}deg)`,
      background,
      color,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      gap: 2,
    }}
  >
    <span
      aria-hidden="true"
      style={{
        position: "absolute",
        left: 16,
        top: "50%",
        width: 9,
        height: 9,
        marginTop: -4.5,
        borderRadius: "50%",
        background: BG,
      }}
    />
    {children}
  </div>
);

const tagLabel: React.CSSProperties = {
  ...mono,
  fontSize: 10,
  textTransform: "uppercase",
};

const tagPrice: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 30,
  lineHeight: 1.05,
  letterSpacing: "-0.04em",
};

const DetailRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "baseline",
      gap: 16,
      padding: "10px 0",
      borderBottom: `1.5px solid ${RULE}`,
      fontSize: 15,
    }}
  >
    <span style={{ color: INK_SOFT }}>{label}</span>
    <span style={{ fontWeight: 700, textAlign: "right" }}>{value}</span>
  </div>
);

const Timeline: React.FC<{ filledAt?: bigint; maturesAt?: bigint }> = ({
  filledAt,
  maturesAt,
}) => {
  const share =
    filledAt !== undefined && maturesAt !== undefined
      ? progress(filledAt, maturesAt)
      : 0;
  const pct = `${share * 100}%`;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {/* Track runs from the centre of the fill dot to the centre of the glass */}
      <div style={{ position: "relative", height: 62, margin: "0 15px 0 6px" }}>
        <span
          style={{
            position: "absolute",
            left: pct,
            top: 0,
            transform: "translateX(-50%)",
            fontSize: 13,
            fontWeight: 800,
            whiteSpace: "nowrap",
          }}
        >
          Today
        </span>
        <span
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            top: 39,
            height: 8,
            borderRadius: 4,
            background: "rgba(21, 122, 120, 0.35)",
          }}
        />
        <span
          style={{
            position: "absolute",
            left: 0,
            width: pct,
            top: 39,
            height: 8,
            borderRadius: 4,
            background: RED,
          }}
        />
        <span
          style={{
            position: "absolute",
            left: -6,
            top: 37,
            width: 12,
            height: 12,
            borderRadius: "50%",
            background: INK,
          }}
        />
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: pct,
            top: 30,
            width: 26,
            height: 26,
            marginLeft: -13,
            boxSizing: "border-box",
            borderRadius: "50%",
            border: `4px solid ${CREAM}`,
            background: RED,
          }}
        />
        <span
          style={{
            position: "absolute",
            right: -15,
            top: 28,
            width: 30,
            height: 30,
            borderRadius: "50%",
            background: CREAM,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <WineGlass />
        </span>
      </div>
      <div
        style={{ display: "flex", justifyContent: "space-between", gap: 16 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 13, color: INK_SOFT }}>Filled</span>
          <span style={{ ...mono, fontSize: 15 }}>{shortDate(filledAt)}</span>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 2,
            alignItems: "flex-end",
          }}
        >
          <span style={{ fontSize: 13, color: INK_SOFT }}>Ready to enjoy</span>
          <span style={{ ...mono, fontSize: 15 }}>{shortDate(maturesAt)}</span>
        </div>
      </div>
    </div>
  );
};

/* --------------------------------- Buy sheet -------------------------------- */

const BuySheet: React.FC<{
  info: BatchInfo;
  price: bigint;
  remaining: bigint;
  onClose: () => void;
  onBought: () => void;
}> = ({ info, price, remaining, onClose, onBought }) => {
  const account = useAccount();
  const navigate = useNavigate();
  const usdc = useBalance(USDC_ID, account.address);
  const [qty, setQty] = React.useState("5");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<string | null>(null);

  const shares = BigInt(qty.replace(/\D/g, "") || "0");
  const total = price * shares;
  const tooMany = shares > remaining;
  const cantPay = usdc !== undefined && total > usdc;
  const disabled = busy || shares === 0n || tooMany || cantPay;

  const buy = async () => {
    if (!account.address) {
      navigate("/signin");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tx = await getShares().buy({
        batch_id: info.batchId,
        buyer: account.address,
        shares,
      });
      setHash(await account.submit(tx));
      recordActivity(account.address, {
        kind: "buy",
        title: `${shares.toString()} shares · ${info.label}`,
        batchId: info.batchId,
        amount: -total,
      });
      onBought();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const field: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    padding: "6px 0",
    fontSize: 14,
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
        aria-label="Buy shares"
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
        }}
      >
        <h2
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 28,
            lineHeight: 1,
            letterSpacing: "-0.03em",
          }}
        >
          {hash ? "You're in the cellar" : `Buy shares of ${info.label}`}
        </h2>

        {hash ? (
          <>
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
              {shares.toString()} shares are in your account. The producer was
              paid {money(total)} in USDC.
            </p>
            <a
              href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: 14, fontWeight: 700 }}
            >
              See it on the explorer
            </a>
            <button type="button" onClick={onClose} style={bigButton}>
              Done
            </button>
          </>
        ) : (
          <>
            <label
              style={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "center",
                gap: 8,
                color: RED,
                fontWeight: 800,
                fontSize: 56,
                lineHeight: 1.05,
                letterSpacing: "-0.05em",
              }}
            >
              <input
                type="text"
                inputMode="numeric"
                value={qty}
                onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                aria-label="Number of shares"
                style={{
                  width: `${Math.max(qty.length, 1) + 0.4}ch`,
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  color: RED,
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 56,
                  letterSpacing: "-0.05em",
                  outline: "none",
                }}
              />
              <span style={{ fontSize: 18, color: INK }}>shares</span>
            </label>

            <div
              role="group"
              aria-label="Quick amounts"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                gap: 8,
              }}
            >
              {[1, 5, 10, 25].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setQty(String(n))}
                  style={{
                    height: 40,
                    borderRadius: 20,
                    border: `1.5px solid ${INK}`,
                    background: Number(qty) === n ? INK : "transparent",
                    color: Number(qty) === n ? CREAM : INK,
                    fontFamily: SANS,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {n}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={field}>
                <span style={{ color: INK_SOFT }}>Price per share</span>
                <span style={mono}>{money(price)}</span>
              </div>
              <div style={field}>
                <span style={{ color: INK_SOFT }}>Your USDC</span>
                <span style={mono}>{money(usdc)}</span>
              </div>
              <div style={field}>
                <span style={{ fontWeight: 700 }}>You pay</span>
                <span style={{ ...mono, color: TEAL }}>
                  {money(total)} USDC
                </span>
              </div>
            </div>

            {tooMany && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>
                Only {remaining.toString()} shares are left.
              </p>
            )}
            {cantPay && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>
                Not enough USDC. Add funds in your wallet first.
              </p>
            )}
            {error && (
              <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>
            )}

            <button
              type="button"
              disabled={disabled && !!account.address}
              onClick={() => void buy()}
              style={{
                ...bigButton,
                opacity: disabled && account.address ? 0.5 : 1,
              }}
            >
              {!account.address
                ? "Sign in to buy"
                : busy
                  ? "Confirming…"
                  : `Buy for ${money(total)}`}
            </button>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: INK_SOFT,
                textAlign: "center",
              }}
            >
              Confirmed with your passkey. Network fees are on us.
            </p>
          </>
        )}
      </div>
    </div>
  );
};

const bigButton: React.CSSProperties = {
  height: 56,
  minHeight: 56,
  flexShrink: 0,
  borderRadius: 28,
  border: 0,
  background: INK,
  color: CREAM,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 18,
  cursor: "pointer",
};

/* --------------------------------- Component ------------------------------- */

const Batch: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const catalogue = useCatalogue();
  const info = catalogue.find((b) => b.batchId === Number(id));
  const chain = useBatchChain(info?.batchId);
  const account = useAccount();
  const { producer, rating } = useProducer(
    info?.producerAddress ?? info?.producerSlug,
  );
  const certified = producer?.tier === "certified" || !!rating?.certified;
  const mine = !!account.address && chain.producer === account.address;
  const [buying, setBuying] = React.useState(false);

  const offering = chain.offering;
  const fillPrice = offering?.price;
  const worth = chain.mark?.value ?? fillPrice;
  const change =
    fillPrice !== undefined && worth !== undefined
      ? pctChange(fillPrice, worth)
      : undefined;
  const remaining =
    offering !== undefined ? offering.total_shares - offering.sold : 0n;
  const canBuy = !!offering?.open && remaining > 0n && !!SHARES_ID;
  const stats = chain.stats;

  return (
    <div className="batch" style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 16,
          padding: "18px 24px 0",
        }}
      >
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 6,
            minHeight: 44,
          }}
        >
          <Link
            to="/market"
            aria-label="Back to the market"
            style={{
              width: 44,
              height: 44,
              marginLeft: -12,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: INK,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
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
        </div>

        {!info && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 12,
              padding: "48px 0",
              textAlign: "center",
            }}
          >
            <h1
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 36,
                letterSpacing: "-0.04em",
              }}
            >
              Batch not found
            </h1>
            <Link to="/market" style={{ fontSize: 16, fontWeight: 700 }}>
              Back to the market
            </Link>
          </div>
        )}

        {info && (
          <>
            <Hero listing={info} />

            <div
              className="batch-tags"
              style={{ display: "flex", gap: 18, padding: "8px 0 4px" }}
            >
              <PriceTag tilt={-3.5} background={CREAM} color={INK}>
                <span style={tagLabel}>Bought at fill</span>
                <span style={tagPrice}>{money(fillPrice)}</span>
                <span style={{ fontSize: 13 }}>per share</span>
              </PriceTag>
              <PriceTag tilt={3.5} background={RED} color={CREAM}>
                <span style={tagLabel}>Worth now</span>
                <span style={tagPrice}>{money(worth)}</span>
                {change && (
                  <span
                    style={{
                      ...mono,
                      alignSelf: "flex-start",
                      marginTop: 2,
                      padding: "2px 10px",
                      borderRadius: 12,
                      background: YELLOW,
                      color: INK,
                      fontSize: 11,
                    }}
                  >
                    {change}
                  </span>
                )}
              </PriceTag>
            </div>

            <h1
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 37,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                textAlign: "center",
              }}
            >
              {info.name}
            </h1>

            <p
              style={{
                margin: 0,
                padding: "0 8px",
                fontSize: 15,
                lineHeight: 1.45,
                textAlign: "center",
              }}
            >
              {info.description}
            </p>

            <button
              type="button"
              disabled={!canBuy}
              onClick={() => setBuying(true)}
              style={{ ...bigButton, opacity: canBuy ? 1 : 0.5 }}
            >
              {chain.loading
                ? "Loading…"
                : !offering
                  ? "Not on sale yet"
                  : !offering.open
                    ? "Sale closed"
                    : remaining === 0n
                      ? "Sold out"
                      : `Buy · ${remaining.toString()} left`}
            </button>

            <Timeline
              filledAt={offering?.filled_at}
              maturesAt={offering?.matures_at}
            />

            <div
              style={{
                borderRadius: 20,
                background: CREAM,
                padding: "14px 16px 10px",
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 15 }}>
                  Value mark
                </span>
                <span style={{ fontSize: 12, color: INK_SOFT }}>
                  {chain.history.length} marks
                </span>
              </div>
              <MarkChart history={chain.history} />
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontSize: 13,
                  color: INK_SOFT,
                }}
              >
                <span>
                  Cellar now:{" "}
                  <strong style={{ color: INK }}>
                    {stats && stats.total > 0
                      ? `${celsius(stats.last_temp_c)} · ${(stats.last_humidity / 100).toFixed(0)} % RH`
                      : "no readings yet"}
                  </strong>
                </span>
                <span>
                  {stats && stats.total > 0
                    ? `${Math.round((stats.in_range / stats.total) * 100)} % in range`
                    : ""}
                </span>
              </div>
            </div>

            {mine && (
              <Link
                to={`/batch/${info.batchId}/manage`}
                style={{
                  ...bigButton,
                  background: CREAM,
                  color: INK,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  textDecoration: "none",
                }}
              >
                Manage this batch
              </Link>
            )}

            <div
              style={{
                borderRadius: 20,
                background: CREAM,
                padding: "14px 16px 4px",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                }}
              >
                <span style={{ fontWeight: 800, fontSize: 15 }}>
                  Producer check-ins
                </span>
                <span style={{ fontSize: 12, color: INK_SOFT }}>
                  {chain.breakdown
                    ? `care ${(Number(chain.breakdown.care_bps) / 100 - 100).toFixed(1) === "0.0" ? "±0" : `+${(Number(chain.breakdown.care_bps) / 100 - 100).toFixed(1)}`} %`
                    : ""}
                </span>
              </div>
              <Checkins
                rows={chain.checkins}
                fillPrice={fillPrice}
                emptyText="The producer has not checked in yet."
              />
            </div>

            <div
              style={{
                display: "flex",
                flexDirection: "column",
                borderTop: `1.5px solid ${RULE}`,
              }}
            >
              <DetailRow
                label="Producer"
                value={`${info.producer}${certified ? " ✓ certified" : ""}`}
              />
              <DetailRow
                label="NFC card"
                value={
                  chain.tag
                    ? "Linked · tap the card to verify"
                    : chain.offline
                      ? "—"
                      : "Not linked"
                }
              />
              <DetailRow label="Region" value={info.region} />
              <DetailRow label="Category" value={info.category} />
              <DetailRow
                label="Stage"
                value={chain.stage ?? (chain.offline ? "—" : "not registered")}
              />
              {offering && (
                <DetailRow
                  label="One unit"
                  value={`${offering.shares_per_unit.toString()} shares · 1 ${info.unit}`}
                />
              )}
              {offering && (
                <DetailRow
                  label="Storage fee"
                  value={`${money(offering.fee_per_share_day)} per share a day`}
                />
              )}
            </div>

            <Link
              to={`/producer/${info.producerSlug}`}
              className="batch-verify"
              style={{
                alignSelf: "flex-end",
                fontSize: 16,
                fontWeight: 600,
                textUnderlineOffset: 3,
              }}
            >
              Verify this product
            </Link>
          </>
        )}

        <Landscape />

        {buying && info && offering && (
          <BuySheet
            info={info}
            price={offering.price}
            remaining={remaining}
            onClose={() => setBuying(false)}
            onBought={chain.refresh}
          />
        )}
      </div>
    </div>
  );
};

export default Batch;
