import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import type { Escrow, Offering } from "batch_shares_contract";
import type { Stats } from "condition_oracle_contract";
import Landscape from "../components/Landscape";
import PageHeader from "../components/PageHeader";
import type { BatchInfo } from "../data/batches";
import { type Producer as ProducerProfile, monogram } from "../data/producers";
import { useAccount } from "../hooks/useAccount";
import { useBatchesChain } from "../hooks/useBatchChain";
import { useCatalogue } from "../hooks/useCatalogue";
import { useProducer } from "../hooks/useProducer";
import { celsius, money, shortDate } from "../lib/format";
import {
  BG,
  CREAM,
  DISPLAY,
  INK,
  INK_SOFT,
  MONO,
  ORANGE,
  PINK,
  RED,
  RULE,
  SANS,
  TEAL,
  TEAL_DARK,
  YELLOW,
  bigButton,
  pill,
} from "../lib/theme";
import "./Batch.css";

/* ---------------------------------- Types ---------------------------------- */

type Live = { offering?: Offering; escrow?: Escrow; stats?: Stats };
type Filter = "all" | "sale" | "track";

const DAY = 86_400;

const kindWord: Record<string, string> = {
  kombucha: "Kombucha",
  kefir: "Kefir",
  cider: "Cider",
  mead: "Mead",
  wine: "Wine",
  fortified: "Fortified wines",
  vinegar: "Vinegar",
  kimchi: "Kimchi",
  cheese: "Cheese",
  other: "Ferments",
};

const fmt = (n: bigint | number) => Number(n).toLocaleString("en-GB");

/* ------------------------------- Illustrations ----------------------------- */

const Bottle: React.FC<{ info: BatchInfo; h?: number }> = ({
  info,
  h = 64,
}) => (
  <svg width={h * 0.5} height={h} viewBox="0 0 40 68" aria-hidden="true">
    <path
      d="M16 6 L24 6 L24 22 C24 28 32 30 32 38 L32 66 L8 66 L8 38 C8 30 16 28 16 22 Z"
      fill={info.glass}
    />
    <rect x="15" y="2" width="10" height="12" rx="2" fill={info.cap} />
    <rect x="10" y="42" width="20" height="18" rx="3" fill={info.labelColor} />
  </svg>
);

const Barrel: React.FC = () => (
  <svg width="48" height="52" viewBox="0 0 48 52" aria-hidden="true">
    <path d="M8 4 C2 18 2 34 8 48 L40 48 C46 34 46 18 40 4 Z" fill="#B8733E" />
    <g stroke={PINK} strokeWidth="4" fill="none">
      <path d="M5 14 Q24 17 43 14" />
      <path d="M4 38 Q24 41 44 38" />
    </g>
    <circle cx="24" cy="26" r="3" fill={INK} />
  </svg>
);

const Sun: React.FC<{ right?: number; top?: number }> = ({
  right = -70,
  top = 120,
}) => (
  <svg
    width="300"
    height="300"
    viewBox="0 0 300 300"
    style={{ position: "absolute", right, top, pointerEvents: "none" }}
    aria-hidden="true"
  >
    <g fill={ORANGE}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path
          key={a}
          d="M150 150 L135 30 L165 30 Z"
          transform={`rotate(${a} 150 150)`}
        />
      ))}
    </g>
    <circle cx="150" cy="150" r="78" fill={YELLOW} />
  </svg>
);

const Rainbow: React.FC = () => (
  <svg
    viewBox="0 0 300 160"
    width="300"
    height="160"
    aria-hidden="true"
    style={{ display: "block" }}
  >
    <g fill="none" strokeWidth="22">
      <path d="M20 160 A130 130 0 0 1 280 160" stroke={RED} />
      <path d="M42 160 A108 108 0 0 1 258 160" stroke={ORANGE} />
      <path d="M64 160 A86 86 0 0 1 236 160" stroke={PINK} />
      <path d="M86 160 A64 64 0 0 1 214 160" stroke={TEAL} />
    </g>
  </svg>
);

const Avatar: React.FC<{
  producer: ProducerProfile;
  certified: boolean;
  size?: number;
  background?: string;
  color?: string;
}> = ({
  producer,
  certified,
  size = 140,
  background = INK,
  color = YELLOW,
}) => (
  <span
    style={{
      position: "relative",
      width: size,
      height: size,
      flexShrink: 0,
      borderRadius: "50%",
      background,
      color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: DISPLAY,
      fontSize: size * 0.4,
      overflow: "visible",
    }}
  >
    {producer.logo ? (
      <img
        src={producer.logo}
        alt=""
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
        }}
      />
    ) : (
      monogram(producer.name)
    )}
    {certified && (
      <span
        aria-label="Certified producer"
        style={{
          position: "absolute",
          right: -4,
          bottom: 4,
          width: size * 0.32,
          height: size * 0.32,
          borderRadius: "50%",
          background: TEAL,
          border: `3px solid ${CREAM}`,
          boxSizing: "border-box",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          width="55%"
          height="55%"
          viewBox="0 0 24 24"
          fill="none"
          stroke={CREAM}
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      </span>
    )}
  </span>
);

/* ---------------------------------- Pieces --------------------------------- */

const Bar: React.FC<{ value: number; color: string; track?: string }> = ({
  value,
  color,
  track = "rgba(43, 27, 61, 0.18)",
}) => (
  <span
    style={{
      display: "block",
      height: 8,
      borderRadius: 4,
      background: track,
      overflow: "hidden",
    }}
  >
    <span
      style={{
        display: "block",
        width: `${Math.min(100, Math.max(0, value * 100))}%`,
        height: "100%",
        borderRadius: 4,
        background: color,
      }}
    />
  </span>
);

const Stat: React.FC<{ n: string; label: string; color?: string }> = ({
  n,
  label,
  color = INK,
}) => (
  <div
    style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 0,
    }}
  >
    <span
      style={{
        fontSize: 30,
        fontWeight: 800,
        letterSpacing: "-0.04em",
        lineHeight: 1,
        color,
      }}
    >
      {n}
    </span>
    <span style={{ fontSize: 14, color }}>{label}</span>
  </div>
);

const dayOf = (o: Offering | undefined) =>
  o
    ? Math.max(0, Math.floor((Date.now() / 1000 - Number(o.filled_at)) / DAY))
    : undefined;

const isMature = (o: Offering | undefined) =>
  !!o && Date.now() / 1000 >= Number(o.matures_at);

/* -------------------------- Own page, certified ---------------------------- */

const CertifiedOwn: React.FC<{
  producer: ProducerProfile;
  batches: BatchInfo[];
  rows: Record<number, Live>;
}> = ({ producer, batches, rows }) => {
  // What buyers paid, split into what reached the producer and what the
  // sale contract still holds for inspection and collection.
  const paid = batches.reduce((sum, b) => {
    const o = rows[b.batchId]?.offering;
    return o ? sum + o.price * o.sold : sum;
  }, 0n);
  const held = batches.reduce(
    (sum, b) => sum + (rows[b.batchId]?.escrow?.pool ?? 0n),
    0n,
  );
  const received = paid - held;
  return (
    <div
      style={{
        background: TEAL,
        minHeight: "100dvh",
        color: CREAM,
        fontFamily: SANS,
      }}
    >
      <div
        className="frame"
        style={{
          gap: 18,
          padding: "18px 24px calc(var(--nav-clear) + 8px)",
          overflow: "hidden",
        }}
      >
        <Sun right={-80} top={130} />
        <div
          style={{
            position: "relative",
            display: "flex",
            gap: 16,
            alignItems: "center",
          }}
        >
          <Avatar
            producer={producer}
            certified
            size={96}
            background={CREAM}
            color={RED}
          />
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                letterSpacing: "0.04em",
                color: PINK,
              }}
            >
              CERTIFIED PRODUCER
            </span>
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 34,
                lineHeight: 1,
                color: YELLOW,
                overflowWrap: "anywhere",
              }}
            >
              {producer.name}
            </span>
          </div>
        </div>

        <div style={{ position: "relative", display: "flex", gap: 10 }}>
          <Link
            to={`/producer/${producer.slug}`}
            style={{
              ...pill(CREAM, INK),
              flex: 1,
              height: 48,
              borderRadius: 24,
              justifyContent: "center",
              fontSize: 16,
              textDecoration: "none",
            }}
          >
            <EyeIcon /> Public profile
          </Link>
          <Link
            to="/producer/edit"
            style={{
              ...pill("transparent", CREAM),
              flex: 1,
              height: 48,
              borderRadius: 24,
              justifyContent: "center",
              fontSize: 16,
              border: `2px solid ${CREAM}`,
              boxSizing: "border-box",
              textDecoration: "none",
            }}
          >
            <PenIcon /> Edit profile
          </Link>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            gap: 6,
            marginTop: 10,
          }}
        >
          <span
            style={{
              fontFamily: MONO,
              fontSize: 12,
              letterSpacing: "0.04em",
              color: PINK,
            }}
          >
            RECEIVED AT FILL
          </span>
          <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <span
              style={{
                fontSize: 60,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
              }}
            >
              {money(received, "").replace(/\.\d\d$/, "")}
            </span>
            <span style={{ fontWeight: 800, fontSize: 20, color: YELLOW }}>
              USDC
            </span>
          </span>
          <span style={{ fontSize: 16, color: PINK }}>
            Across {batches.length} registered{" "}
            {batches.length === 1 ? "batch" : "batches"}
            {held > 0n &&
              ` · ${money(held)} held in escrow until inspection and collection`}
          </span>
        </div>

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            marginTop: 8,
            borderTop: `1.5px solid rgba(255, 244, 226, 0.4)`,
          }}
        >
          {batches.map((b) => {
            const live = rows[b.batchId];
            const o = live?.offering;
            const mature = isMature(o);
            const sold = o
              ? Number(o.sold) / Math.max(1, Number(o.total_shares))
              : 0;
            return (
              <Link
                key={b.batchId}
                to={`/batch/${b.batchId}/manage`}
                style={{
                  display: "flex",
                  gap: 16,
                  alignItems: "center",
                  padding: "16px 0",
                  borderBottom: `1.5px solid rgba(255, 244, 226, 0.4)`,
                  color: CREAM,
                  textDecoration: "none",
                }}
              >
                {mature ? <Bottle info={b} h={52} /> : <Barrel />}
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 800, fontSize: 19 }}>
                      {b.label.replace("Nº ", "")} · {b.cat}
                    </span>
                    {live?.stats && live.stats.total > 0 && !mature && (
                      <span style={{ fontFamily: MONO, fontSize: 14 }}>
                        {celsius(live.stats.last_temp_c)}
                      </span>
                    )}
                  </div>
                  {mature ? (
                    <span style={{ fontFamily: MONO, fontSize: 13 }}>
                      <span style={{ color: YELLOW, fontWeight: 700 }}>
                        MATURE
                      </span>{" "}
                      · {fmt(o?.redeemed ?? 0)} redeemed
                    </span>
                  ) : o ? (
                    <>
                      <Bar
                        value={sold}
                        color={sold > 0.5 ? PINK : "#7FD8D6"}
                        track={INK}
                      />
                      <span style={{ fontFamily: MONO, fontSize: 13 }}>
                        {fmt(o.sold)} / {fmt(o.total_shares)} sold
                      </span>
                    </>
                  ) : (
                    <span style={{ fontFamily: MONO, fontSize: 13 }}>
                      {b.onSale === false ? "tracking only" : "not on sale yet"}
                    </span>
                  )}
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          to="/produce"
          style={{ ...bigButton(PINK, INK), height: 64, marginTop: 10 }}
        >
          <PlusIcon /> Register a batch
        </Link>
      </div>
    </div>
  );
};

/* --------------------------- Own page, amateur ----------------------------- */

const AmateurOwn: React.FC<{
  producer: ProducerProfile;
  batches: BatchInfo[];
  rows: Record<number, Live>;
}> = ({ producer, batches, rows }) => {
  const [filter, setFilter] = React.useState<Filter>("all");
  const onSale = batches.filter((b) => !!rows[b.batchId]?.offering?.open);
  const tracking = batches.filter((b) => !rows[b.batchId]?.offering?.open);
  const shown =
    filter === "all" ? batches : filter === "sale" ? onSale : tracking;
  const sharesSold = batches.reduce(
    (s, b) => s + Number(rows[b.batchId]?.offering?.sold ?? 0),
    0,
  );
  const cert = producer.certification;

  const tab = (f: Filter, label: string, n: number) => (
    <button
      type="button"
      role="tab"
      aria-selected={filter === f}
      onClick={() => setFilter(f)}
      style={{
        height: 44,
        padding: "0 16px",
        borderRadius: 22,
        border: 0,
        background: filter === f ? RED : "transparent",
        color: filter === f ? CREAM : INK,
        fontFamily: SANS,
        fontWeight: 700,
        fontSize: 15,
        display: "flex",
        alignItems: "center",
        gap: 6,
        cursor: "pointer",
      }}
    >
      {label}
      <span style={{ fontFamily: MONO, fontSize: 12, opacity: 0.75 }}>{n}</span>
    </button>
  );

  return (
    <div
      style={{
        background: BG,
        minHeight: "100dvh",
        color: INK,
        fontFamily: SANS,
      }}
    >
      <div
        className="frame"
        style={{ gap: 16, padding: "18px 24px calc(var(--nav-clear) + 8px)" }}
      >
        <PageHeader
          back="/portfolio"
          backLabel="Back to your portfolio"
          title={<span style={{ fontSize: 30 }}>{producer.name}</span>}
          right={<ShareButton producer={producer} />}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Rainbow />
          <div style={{ marginTop: -70 }}>
            <Avatar producer={producer} certified={false} size={140} />
          </div>
        </div>

        <p style={{ margin: 0, textAlign: "center", fontSize: 17 }}>
          {producer.location || "Somewhere fermenting"} · Amateur producer since{" "}
          {producer.since}
        </p>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "center",
            gap: 8,
          }}
        >
          {producer.kinds.map((k) => (
            <span key={k} style={pill(CREAM, INK)}>
              {kindWord[k] ?? k}
            </span>
          ))}
        </div>
        <Link
          to="/certify"
          style={{
            ...pill(TEAL, CREAM),
            alignSelf: "center",
            height: 40,
            borderRadius: 20,
            padding: "0 16px",
            fontSize: 15,
            textDecoration: "none",
          }}
        >
          <BadgeIcon />
          {cert?.status === "pending"
            ? "Certification under review"
            : cert?.status === "rejected"
              ? "Certification: apply again"
              : "Are you a company? Get certified"}
        </Link>

        {producer.story && (
          <p
            style={{
              margin: 0,
              textAlign: "center",
              fontSize: 19,
              lineHeight: 1.4,
            }}
          >
            {producer.story}
          </p>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 36 }}>
          <Stat n={String(batches.length)} label="ferments" />
          <Stat n={String(onSale.length)} label="on sale" />
          <Stat n={fmt(sharesSold)} label="shares sold" />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
          }}
        >
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 800,
              color: RED,
              letterSpacing: "-0.02em",
            }}
          >
            Your ferments
          </h2>
          <Link
            to="/produce"
            style={{
              fontWeight: 800,
              fontSize: 18,
              color: INK,
              textDecoration: "none",
            }}
          >
            + Add
          </Link>
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
          {tab("all", "All", batches.length)}
          {tab("sale", "On sale", onSale.length)}
          {tab("track", "Just tracking", tracking.length)}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {shown.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "16px 0",
                borderTop: `1.5px solid ${RULE}`,
                fontSize: 15,
                color: INK_SOFT,
              }}
            >
              Nothing here yet. Add a ferment to start a batch.
            </p>
          )}
          {shown.map((b) => {
            const o = rows[b.batchId]?.offering;
            const day = dayOf(o);
            const mature = isMature(o);
            const sale = !!o?.open;
            const elapsed = o
              ? Math.min(
                  1,
                  (Date.now() / 1000 - Number(o.filled_at)) /
                    Math.max(1, Number(o.matures_at) - Number(o.filled_at)),
                )
              : 0;
            const sold = o
              ? Number(o.sold) / Math.max(1, Number(o.total_shares))
              : 0;
            return (
              <Link
                key={b.batchId}
                to={`/batch/${b.batchId}/manage`}
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px 0",
                  borderTop: `1.5px solid ${RULE}`,
                  color: INK,
                  textDecoration: "none",
                }}
              >
                <Bottle info={b} h={60} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                  }}
                >
                  <span
                    style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.1 }}
                  >
                    {b.name}
                  </span>
                  <span style={{ fontSize: 13, color: INK_SOFT }}>
                    {b.label} ·{" "}
                    {mature
                      ? "ready"
                      : day !== undefined
                        ? `fermenting, day ${day}`
                        : "registered"}
                  </span>
                  <Bar
                    value={sale ? sold : elapsed}
                    color={sale ? RED : TEAL}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 6,
                  }}
                >
                  <span style={pill(sale ? RED : CREAM, sale ? CREAM : INK)}>
                    {sale ? "On sale" : "Tracking"}
                  </span>
                  <span
                    style={{ fontFamily: MONO, fontSize: 13, fontWeight: 700 }}
                  >
                    {sale && o
                      ? `${fmt(o.sold)}/${fmt(o.total_shares)} sold`
                      : mature
                        ? "Ready"
                        : o
                          ? `Ready ${shortDate(o.matures_at)}`
                          : "—"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <Link
          to="/producer/edit"
          style={{ ...bigButton(), height: 60, marginTop: 6 }}
        >
          <PenIcon /> Edit your page
        </Link>
      </div>
    </div>
  );
};

/* --------------------------------- Public ---------------------------------- */

const Public: React.FC<{
  producer: ProducerProfile;
  certified: boolean;
  batches: BatchInfo[];
  rows: Record<number, Live>;
  mine: boolean;
}> = ({ producer, certified, batches, rows, mine }) => {
  const sold = batches.reduce(
    (s, b) => s + Number(rows[b.batchId]?.offering?.sold ?? 0),
    0,
  );
  const redeemed = batches.reduce(
    (s, b) => s + Number(rows[b.batchId]?.offering?.redeemed ?? 0),
    0,
  );
  const onMarket = batches.filter((b) => !!rows[b.batchId]?.offering);
  const site = producer.website?.replace(/^https?:\/\//, "");
  return (
    <div
      className="batch"
      style={{ background: BG, color: INK, fontFamily: SANS }}
    >
      <div className="frame" style={{ gap: 16, padding: "18px 24px 0" }}>
        <PageHeader
          back="/market"
          backLabel="Back to the market"
          right={<ShareButton producer={producer} />}
        />

        {/* Header landscape with sun */}
        <div
          style={{
            position: "relative",
            height: 210,
            margin: "0 -24px",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", inset: 0, background: TEAL }} />
          <svg
            viewBox="0 0 390 210"
            preserveAspectRatio="none"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
            }}
            aria-hidden="true"
          >
            <path
              d="M0 150 C80 110 160 120 260 150 C320 168 360 160 390 150 L390 210 L0 210 Z"
              fill="#7CC36B"
            />
            <g fill="#2E8B57">
              {[40, 70, 100, 130].map((x, i) => (
                <circle key={x} cx={x} cy={150 - i * 3} r="5" />
              ))}
            </g>
          </svg>
          <Sun right={-60} top={-80} />
          <div
            style={{
              position: "absolute",
              left: "50%",
              bottom: -40,
              transform: "translateX(-50%)",
            }}
          >
            <Avatar
              producer={producer}
              certified={certified}
              size={128}
              background={CREAM}
              color={RED}
            />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 10,
            marginTop: 36,
            textAlign: "center",
          }}
        >
          <h1
            style={{
              margin: 0,
              fontFamily: DISPLAY,
              fontWeight: 400,
              fontSize: 40,
              lineHeight: 1,
              color: RED,
            }}
          >
            {producer.name}
          </h1>
          <span style={{ fontSize: 17 }}>
            {[
              producer.location,
              producer.kinds.map((k) => kindWord[k] ?? k).join(" and "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
          <span style={pill(certified ? TEAL : CREAM, certified ? CREAM : INK)}>
            <BadgeIcon />
            {certified
              ? "Certified producer · verified company"
              : `Amateur producer since ${producer.since}`}
          </span>
          {producer.story && (
            <p style={{ margin: "4px 0 0", fontSize: 19, lineHeight: 1.4 }}>
              {producer.story}
            </p>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "center", gap: 40 }}>
          <Stat
            n={String(batches.length)}
            label={batches.length === 1 ? "batch" : "batches"}
          />
          <Stat n={fmt(sold)} label="shares sold" />
          <Stat n={fmt(redeemed)} label="units poured" />
        </div>

        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 800,
            color: RED,
            letterSpacing: "-0.02em",
            paddingBottom: 8,
            borderBottom: `1.5px solid ${RULE}`,
          }}
        >
          Batches on the market
        </h2>
        <div
          style={{ display: "flex", flexDirection: "column", marginTop: -16 }}
        >
          {onMarket.length === 0 && (
            <p
              style={{
                margin: 0,
                padding: "14px 0",
                fontSize: 15,
                color: INK_SOFT,
              }}
            >
              Nothing on sale right now.
            </p>
          )}
          {onMarket.map((b) => {
            const o = rows[b.batchId]?.offering;
            if (!o) return null;
            const left = o.total_shares - o.sold;
            return (
              <Link
                key={b.batchId}
                to={`/batch/${b.batchId}`}
                className="market-item"
                style={{
                  display: "flex",
                  gap: 14,
                  alignItems: "center",
                  padding: "14px 0",
                  borderBottom: `1.5px solid ${RULE}`,
                  color: INK,
                  textDecoration: "none",
                }}
              >
                <Bottle info={b} h={60} />
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span
                    style={{ fontWeight: 800, fontSize: 19, lineHeight: 1.1 }}
                  >
                    {b.name}
                  </span>
                  <span style={{ fontSize: 13, color: INK_SOFT }}>
                    {b.label} · matures {shortDate(o.matures_at)}
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
                  <span
                    style={{ fontFamily: MONO, fontWeight: 700, fontSize: 17 }}
                  >
                    {money(o.price)}
                  </span>
                  <span
                    style={{ fontSize: 13, color: TEAL_DARK, fontWeight: 700 }}
                  >
                    {o.open ? `${fmt(left)} left` : "sale closed"}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        {site && (
          <a
            href={`https://${site}`}
            target="_blank"
            rel="noreferrer"
            style={{
              alignSelf: "center",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontWeight: 800,
              fontSize: 17,
              color: INK,
            }}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
            </svg>
            {site}
          </a>
        )}
        {mine && (
          <Link
            to="/producer/me"
            style={{
              alignSelf: "center",
              fontWeight: 800,
              fontSize: 15,
              color: RED,
            }}
          >
            This is your page. Manage it
          </Link>
        )}

        <Landscape />
      </div>
    </div>
  );
};

/* ---------------------------------- Icons ---------------------------------- */

const EyeIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const PenIcon: React.FC = () => (
  <svg
    width="20"
    height="20"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M4 20h4l10-10-4-4L4 16z" />
    <path d="M12 8l4 4" />
  </svg>
);
const PlusIcon: React.FC = () => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const BadgeIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M12 2l2.2 1.9 2.9-.4 1.1 2.7 2.7 1.1-.4 2.9L22 12l-1.9 2.2.4 2.9-2.7 1.1-1.1 2.7-2.9-.4L12 22l-2.2-1.9-2.9.4-1.1-2.7-2.7-1.1.4-2.9L2 12l1.9-2.2-.4-2.9 2.7-1.1 1.1-2.7 2.9.4z"
      fill={YELLOW}
    />
  </svg>
);

const ShareButton: React.FC<{ producer: ProducerProfile }> = ({ producer }) => (
  <button
    type="button"
    aria-label="Share this page"
    onClick={() => {
      const url = `${window.location.origin}/producer/${producer.slug}`;
      if (navigator.share)
        void navigator
          .share({ title: producer.name, url })
          .catch(() => undefined);
      else void navigator.clipboard?.writeText(url);
    }}
    style={{
      border: 0,
      background: "transparent",
      color: INK,
      cursor: "pointer",
      display: "flex",
      padding: 0,
    }}
  >
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M7 8l5-5 5 5" />
      <path d="M5 13v7h14v-7" />
    </svg>
  </button>
);

/* ---------------------------------- Page ----------------------------------- */

const ProducerPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const account = useAccount();
  const me = slug === "me";
  const key = me ? account.address : slug;
  const { producer, rating, loading } = useProducer(key);
  const catalogue = useCatalogue();

  const batches = React.useMemo(
    () =>
      producer
        ? catalogue.filter(
            (b) =>
              (producer.address && b.producerAddress === producer.address) ||
              b.producerSlug === producer.slug,
          )
        : [],
    [catalogue, producer],
  );
  const ids = React.useMemo(() => batches.map((b) => b.batchId), [batches]);
  const { rows } = useBatchesChain(ids);

  const mine =
    !!account.address && !!producer && producer.address === account.address;
  const certified = producer?.tier === "certified" || !!rating?.certified;

  if (me && account.status !== "loading" && !account.address) {
    return (
      <Empty title="Your producer page">
        <button
          type="button"
          onClick={() => navigate("/signin")}
          style={{ ...bigButton(), width: "100%" }}
        >
          Sign in with your passkey
        </button>
      </Empty>
    );
  }
  if (loading || (me && account.status === "loading")) {
    return <Empty title="Reading…"> </Empty>;
  }
  if (!producer) {
    return me ? (
      <Empty
        title="No page yet"
        text="Your page appears when you list a ferment, or you can write it now."
      >
        <Link to="/producer/edit" style={{ ...bigButton(), width: "100%" }}>
          Create your page
        </Link>
        <Link to="/produce" style={{ fontWeight: 800, color: RED }}>
          Add a ferment
        </Link>
      </Empty>
    ) : (
      <Empty title="Producer not found">
        <Link to="/market" style={{ fontWeight: 800, color: RED }}>
          Back to the market
        </Link>
      </Empty>
    );
  }

  if (me && certified)
    return <CertifiedOwn producer={producer} batches={batches} rows={rows} />;
  if (me)
    return <AmateurOwn producer={producer} batches={batches} rows={rows} />;
  return (
    <Public
      producer={producer}
      certified={certified}
      batches={batches}
      rows={rows}
      mine={mine}
    />
  );
};

const Empty: React.FC<{
  title: string;
  text?: string;
  children?: React.ReactNode;
}> = ({ title, text, children }) => (
  <div
    style={{
      background: BG,
      minHeight: "100dvh",
      color: INK,
      fontFamily: SANS,
    }}
  >
    <div className="frame" style={{ gap: 16, padding: "18px 24px 0" }}>
      <PageHeader back="/portfolio" />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 16,
          padding: "48px 0",
          textAlign: "center",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "-0.04em",
          }}
        >
          {title}
        </h1>
        {text && (
          <p style={{ margin: 0, fontSize: 16, color: INK_SOFT }}>{text}</p>
        )}
        {children}
      </div>
      <Landscape />
    </div>
  </div>
);

export default ProducerPage;
