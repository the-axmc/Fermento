import React from "react";
import type { Checkin } from "condition_oracle_contract";
import { kindOf } from "../lib/checkins";
import { money, shortDate } from "../lib/format";
import { INK, INK_SOFT, MONO, RULE, TEAL_DARK } from "../lib/theme";

const KindIcon: React.FC<{ kind: string }> = ({ kind }) => {
  const common = {
    width: 20,
    height: 20,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: INK,
    strokeWidth: 2.2,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
  } as const;
  switch (kind) {
    case "lab":
      return (
        <svg {...common}>
          <path d="M9 3h6M10 3v6l-5 9a2 2 0 0 0 1.8 3h10.4a2 2 0 0 0 1.8-3l-5-9V3" />
          <path d="M8 15h8" />
        </svg>
      );
    case "tasting":
      return (
        <svg {...common}>
          <path d="M7 3h10l-.6 5.5a4.4 4.4 0 0 1-8.8 0z" />
          <path d="M12 13v8M8 21h8" />
        </svg>
      );
    case "photo":
      return (
        <svg {...common}>
          <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
          <circle cx="12" cy="13" r="3.5" />
        </svg>
      );
    case "racking":
      return (
        <svg {...common}>
          <path d="M6 4h12v16H6z" />
          <path d="M6 10h12M6 15h12" />
        </svg>
      );
    case "started":
      return (
        <svg {...common}>
          <path d="M12 21v-8" />
          <path d="M12 13c0-4-3-6-7-6 0 4 3 6 7 6zM12 11c0-4 3-6 7-6 0 4-3 6-7 6z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 8v5M12 16h.01" />
        </svg>
      );
  }
};

/** A batch's check-ins, newest first, as holders see them. */
const Checkins: React.FC<{
  rows: Checkin[];
  /** Fill price, shown under a `started` check-in. */
  fillPrice?: bigint;
  emptyText?: string;
}> = ({ rows, fillPrice, emptyText = "No check-ins yet." }) => {
  if (rows.length === 0) {
    return (
      <p
        style={{ margin: 0, padding: "12px 0", fontSize: 14, color: INK_SOFT }}
      >
        {emptyText}
      </p>
    );
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {rows.map((c) => {
        const k = kindOf(c.kind);
        const bonus = Number(c.bonus_bps);
        return (
          <div
            key={`${c.timestamp.toString()}-${c.kind}-${c.score}-${c.note}`}
            style={{
              display: "flex",
              gap: 14,
              padding: "14px 0",
              borderBottom: `1.5px solid ${RULE}`,
            }}
          >
            <span
              style={{
                width: 44,
                height: 44,
                flexShrink: 0,
                borderRadius: "50%",
                background: k.tile,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <KindIcon kind={c.kind} />
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 3,
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
                <span style={{ fontWeight: 800, fontSize: 17 }}>{k.label}</span>
                <span
                  style={{ fontFamily: MONO, fontSize: 12, color: INK_SOFT }}
                >
                  {shortDate(c.timestamp)}
                </span>
              </div>
              {c.note && (
                <span style={{ fontSize: 15, lineHeight: 1.4 }}>{c.note}</span>
              )}
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  color: bonus > 0 ? TEAL_DARK : INK_SOFT,
                }}
              >
                {c.kind === "started" && fillPrice !== undefined
                  ? `Listed at ${money(fillPrice)}`
                  : bonus > 0
                    ? `▲ +${(bonus / 100).toFixed(2)} % care · score ${c.score}`
                    : `score ${c.score} · no bonus today`}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default Checkins;
