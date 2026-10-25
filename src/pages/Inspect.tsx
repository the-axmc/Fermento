import React from "react";
import PageHeader from "../components/PageHeader";
import { money } from "../lib/format";
import {
  BG,
  CREAM,
  INK,
  INK_SOFT,
  MONO,
  PINK,
  RED,
  RULE,
  SANS,
  TEAL_DARK,
  YELLOW,
  bigButton,
  pill,
} from "../lib/theme";

/**
 * Inspector's desk. Every batch must be attested by an independent inspector
 * before its sale opens; visits while it ages release part of the escrow to
 * the producer; a failed batch opens refunds. Calls go to the producer API,
 * which signs them with the inspector's key (INSPECTOR_SECRET). Allowed from
 * this machine, or with the API's ADMIN_TOKEN.
 */

interface Row {
  batchId: number;
  name: string;
  producer?: string;
  unit: string;
  status: "tracking" | "awaiting-inspection" | "open";
  requestedUnits?: number;
  attestation?: { units: number; inspector: string; at: string };
  escrow?: { inspected: boolean; defaulted: boolean; held: string };
  sold?: number;
}

interface Queue {
  inspector: string;
  independent: boolean;
  batches: Row[];
}

const TOKEN_KEY = "fermento.adminToken";

const readToken = () => {
  try {
    return sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
};

const call = async <T,>(
  path: string,
  token: string,
  body?: unknown,
): Promise<T> => {
  const res = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-admin-token": token } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data;
};

const input: React.CSSProperties = {
  boxSizing: "border-box",
  width: "100%",
  height: 44,
  padding: "0 12px",
  borderRadius: 12,
  border: `1.5px solid ${RULE}`,
  background: "#fff",
  fontFamily: SANS,
  fontSize: 15,
  color: INK,
};

const small = (background: string, color = CREAM): React.CSSProperties => ({
  height: 40,
  padding: "0 16px",
  borderRadius: 20,
  border: 0,
  background,
  color,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 14,
  cursor: "pointer",
});

const statusPill = (r: Row) => {
  if (r.escrow?.defaulted) return { text: "Failed", bg: RED, fg: CREAM };
  if (r.status === "awaiting-inspection")
    return { text: "Awaiting attestation", bg: YELLOW, fg: INK };
  if (r.escrow?.inspected)
    return { text: "Inspected", bg: TEAL_DARK, fg: CREAM };
  if (r.attestation) return { text: "Attested", bg: TEAL_DARK, fg: CREAM };
  if (r.status === "tracking")
    return { text: "Tracking only", bg: CREAM, fg: INK };
  return { text: "Not attested", bg: PINK, fg: INK };
};

const BatchCard: React.FC<{
  row: Row;
  token: string;
  onDone: () => void;
}> = ({ row, token, onDone }) => {
  const [units, setUnits] = React.useState(
    String(row.attestation?.units ?? row.requestedUnits ?? ""),
  );
  const [report, setReport] = React.useState("");
  const [score, setScore] = React.useState("90");
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const failed = !!row.escrow?.defaulted;
  const p = statusPill(row);

  const act = async (kind: "attest" | "visit" | "default", body: unknown) => {
    if (
      kind === "default" &&
      !window.confirm(
        `Declare ${row.name} failed? Sales stop and holders get refunds.`,
      )
    )
      return;
    setBusy(kind);
    setError(null);
    try {
      await call(`/api/inspections/${row.batchId}/${kind}`, token, body);
      setReport("");
      setNote("");
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      style={{
        borderRadius: 20,
        background: CREAM,
        padding: "16px 16px 18px",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 17 }}>{row.name}</div>
          <div style={{ fontSize: 13, color: INK_SOFT }}>
            Nº {row.batchId}
            {row.producer ? ` · ${row.producer}` : ""}
            {row.sold !== undefined ? ` · ${row.sold} sold` : ""}
          </div>
        </div>
        <span style={pill(p.bg, p.fg)}>{p.text}</span>
      </div>

      {row.attestation && (
        <div style={{ fontSize: 13, color: INK_SOFT }}>
          Last attested{" "}
          {new Date(row.attestation.at).toLocaleDateString("en-GB")} ·{" "}
          {row.attestation.units} {row.unit}s
          {row.escrow ? ` · ${money(BigInt(row.escrow.held))} held` : ""}
        </div>
      )}

      {!failed && row.status !== "tracking" && (
        <>
          <span style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>
            {row.attestation ? "Re-attest (regauging)" : "Attest after a visit"}
          </span>
          <input
            inputMode="numeric"
            placeholder={`${row.unit}s you counted`}
            value={units}
            onChange={(e) => setUnits(e.target.value.replace(/\D/g, ""))}
            style={input}
          />
          <textarea
            placeholder="Report: what you checked, seals and certificate numbers, reference sample id. Only its fingerprint goes on chain."
            value={report}
            onChange={(e) => setReport(e.target.value)}
            rows={3}
            style={{
              ...input,
              height: "auto",
              padding: 12,
              resize: "vertical",
            }}
          />
          <button
            type="button"
            disabled={!!busy || !units || !report.trim()}
            onClick={() => void act("attest", { units: Number(units), report })}
            style={{
              ...small(INK),
              opacity: busy || !units || !report.trim() ? 0.5 : 1,
            }}
          >
            {busy === "attest"
              ? "Signing…"
              : row.status === "awaiting-inspection"
                ? "Attest and open the sale"
                : "Attest"}
          </button>
        </>
      )}

      {!failed && row.attestation && (
        <>
          <span style={{ fontWeight: 800, fontSize: 14, marginTop: 6 }}>
            Visit while ageing
          </span>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              inputMode="numeric"
              aria-label="Score 0 to 100"
              value={score}
              onChange={(e) => setScore(e.target.value.replace(/\D/g, ""))}
              style={{ ...input, width: 80, flexShrink: 0 }}
            />
            <input
              placeholder="Note shown to holders (280 bytes)"
              value={note}
              maxLength={280}
              onChange={(e) => setNote(e.target.value)}
              style={input}
            />
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              disabled={!!busy || !score}
              onClick={() =>
                void act("visit", {
                  score: Number(score),
                  note,
                  release: false,
                })
              }
              style={small("transparent", INK)}
            >
              {busy === "visit" ? "Signing…" : "Record visit"}
            </button>
            {row.escrow && !row.escrow.inspected && (
              <button
                type="button"
                disabled={!!busy || !score}
                onClick={() =>
                  void act("visit", {
                    score: Number(score),
                    note,
                    release: true,
                  })
                }
                style={small(TEAL_DARK)}
              >
                Visit · in good order, release 15 %
              </button>
            )}
            <button
              type="button"
              disabled={!!busy || !note.trim()}
              onClick={() => void act("default", { note })}
              style={{ ...small(RED), opacity: busy || !note.trim() ? 0.5 : 1 }}
              title="Write in the note what you found"
            >
              {busy === "default" ? "Signing…" : "Declare failed"}
            </button>
          </div>
        </>
      )}

      {error && <p style={{ margin: 0, fontSize: 13, color: RED }}>{error}</p>}
    </div>
  );
};

const Inspect: React.FC = () => {
  const [token, setToken] = React.useState(readToken);
  const [queue, setQueue] = React.useState<Queue | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    call<Queue>("/api/inspections", token)
      .then((q) => {
        if (active) {
          setQueue(q);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (active) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      active = false;
    };
  }, [token, tick]);

  const saveToken = (value: string) => {
    setToken(value);
    try {
      sessionStorage.setItem(TOKEN_KEY, value);
    } catch {
      /* private mode: kept for this page only */
    }
  };

  const pending = queue?.batches.filter(
    (b) => b.status === "awaiting-inspection",
  );
  const rest = queue?.batches.filter((b) => b.status !== "awaiting-inspection");

  return (
    <div style={{ background: BG, minHeight: "100dvh" }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 16,
          padding: "18px 24px 120px",
        }}
      >
        <PageHeader back="/market" backLabel="Back to the market" />
        <h1
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 34,
            lineHeight: 1,
            letterSpacing: "-0.04em",
          }}
        >
          Inspector's desk
        </h1>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
          No batch goes on sale until you have seen it. Your attestation caps
          how many units can be sold; your visits release part of the money held
          for buyers; a failed batch lets them take it back.
        </p>

        {queue && !queue.independent && (
          <p
            style={{
              margin: 0,
              padding: "10px 14px",
              borderRadius: 14,
              background: YELLOW,
              fontSize: 13,
              lineHeight: 1.4,
            }}
          >
            Demo mode: the platform key is acting as inspector. Set
            INSPECTOR_SECRET on the producer API to an independent inspector's
            key.
          </p>
        )}

        {error && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <p style={{ margin: 0, fontSize: 14, color: RED }}>{error}</p>
            <input
              type="password"
              placeholder="Admin token"
              value={token}
              onChange={(e) => saveToken(e.target.value)}
              style={input}
            />
          </div>
        )}

        {queue && (
          <span style={{ fontFamily: MONO, fontSize: 12, color: INK_SOFT }}>
            Signing as {queue.inspector.slice(0, 6)}…{queue.inspector.slice(-4)}
          </span>
        )}

        {pending && pending.length > 0 && (
          <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>
            Waiting for you
          </h2>
        )}
        {pending?.map((r) => (
          <BatchCard
            key={r.batchId}
            row={r}
            token={token}
            onDone={() => setTick((t) => t + 1)}
          />
        ))}

        {rest && rest.length > 0 && (
          <h2 style={{ margin: "8px 0 0", fontSize: 20, fontWeight: 800 }}>
            Ageing
          </h2>
        )}
        {rest?.map((r) => (
          <BatchCard
            key={r.batchId}
            row={r}
            token={token}
            onDone={() => setTick((t) => t + 1)}
          />
        ))}

        <button
          type="button"
          onClick={() => setTick((t) => t + 1)}
          style={bigButton(CREAM, INK)}
        >
          Refresh
        </button>
      </div>
    </div>
  );
};

export default Inspect;
