import React from "react";
import { Link, useNavigate } from "react-router-dom";
import FermentIcon from "../components/FermentIcons";
import type { Kind } from "../data/batches";
import { useAccount } from "../hooks/useAccount";
import { useProducer } from "../hooks/useProducer";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL = "#157A78";
const RULE = "rgba(43, 27, 61, 0.9)";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";

const DRAFT_KEY = "fermento.draft";
const MAX_DESCRIPTION = 280;

/* ---------------------------------- Picker --------------------------------- */

const KINDS: { kind: Kind; label: string; tile: string; text?: string }[] = [
  { kind: "kombucha", label: "Kombucha", tile: "#F7A8C8" },
  { kind: "kefir", label: "Kefir", tile: "#157A78", text: CREAM },
  { kind: "cider", label: "Cider", tile: "#F5B82E" },
  { kind: "mead", label: "Mead", tile: "#2B1B3D", text: CREAM },
  { kind: "wine", label: "Wine", tile: "#FFFFFF" },
  { kind: "fortified", label: "Fortified", tile: "#F07C2B" },
  { kind: "vinegar", label: "Vinegar", tile: "#7FD8D6" },
  { kind: "kimchi", label: "Kimchi", tile: CREAM },
  { kind: "other", label: "Other", tile: "#C8341E", text: CREAM },
];

/* ---------------------------------- Form ----------------------------------- */

interface Draft {
  kind: Kind;
  /** "sale" opens a primary offering; "track" only registers the batch. */
  listing: "sale" | "track";
  name: string;
  description: string;
  producer: string;
  origin: string;
  shares: string;
  price: string;
  started: string;
  ready: string;
}

const empty: Draft = {
  kind: "kombucha",
  listing: "sale",
  name: "",
  description: "",
  producer: "",
  origin: "",
  shares: "40",
  price: "4.00",
  started: "",
  ready: "",
};

const loadDraft = (): Draft => {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? { ...empty, ...(JSON.parse(raw) as Partial<Draft>) } : empty;
  } catch {
    return empty;
  }
};

const label: React.CSSProperties = {
  fontWeight: 800,
  fontSize: 19,
  color: RED,
  letterSpacing: "-0.01em",
};

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 48,
  padding: 0,
  border: 0,
  borderBottom: `2px solid ${RULE}`,
  borderRadius: 0,
  background: "transparent",
  fontFamily: SANS,
  fontSize: 22,
  fontWeight: 600,
  color: INK,
  outline: "none",
};

const hint: React.CSSProperties = {
  fontSize: 13,
  color: INK_SOFT,
  marginTop: 8,
};

const Field: React.FC<{
  title: string;
  right?: React.ReactNode;
  hintText?: string;
  children: React.ReactNode;
}> = ({ title, right, hintText, children }) => (
  <div style={{ display: "flex", flexDirection: "column" }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        marginBottom: 6,
      }}
    >
      <span style={label}>{title}</span>
      {right}
    </div>
    {children}
    {hintText && <span style={hint}>{hintText}</span>}
  </div>
);

/* ---------------------------------- Page ----------------------------------- */

const AddFerment: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const [d, setD] = React.useState<Draft>(loadDraft);
  const { producer } = useProducer(account.address);
  // A producer with a page lists under that name.
  React.useEffect(() => {
    if (producer && producer.address === account.address) {
      setD((p) => (p.producer ? p : { ...p, producer: producer.name }));
    }
  }, [producer, account.address]);
  const [busy, setBusy] = React.useState<"locate" | "list" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [saved, setSaved] = React.useState(false);

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) =>
    setD((p) => ({ ...p, [k]: v }));

  const saveDraft = () => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(d));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setError("Location is not available in this browser.");
      return;
    }
    setBusy("locate");
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        void (async () => {
          try {
            const r = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&zoom=10&lat=${coords.latitude}&lon=${coords.longitude}`,
              { headers: { Accept: "application/json" } },
            );
            const j = (await r.json()) as { address?: Record<string, string> };
            const a = j.address ?? {};
            const place =
              a.village || a.town || a.city || a.municipality || a.county || "";
            const region = a.state || a.region || "";
            set(
              "origin",
              [place, region, a.country].filter(Boolean).join(", "),
            );
          } catch {
            set(
              "origin",
              `${coords.latitude.toFixed(3)}, ${coords.longitude.toFixed(3)}`,
            );
          } finally {
            setBusy(null);
          }
        })();
      },
      () => {
        setError("Could not get your location.");
        setBusy(null);
      },
      { timeout: 10_000 },
    );
  };

  const problems = (): string | null => {
    if (!d.name.trim()) return "Give the batch a name.";
    if (!d.producer.trim()) return "Who makes it? Add the producer.";
    if (!d.origin.trim()) return "Where is it from?";
    if (!(Number(d.shares) > 0)) return "How many shares?";
    if (!(Number(d.price) > 0)) return "Set a starting price.";
    if (!d.started || !d.ready) return "Add the start and ready dates.";
    if (new Date(d.ready) < new Date(d.started))
      return "Ready date is before the start.";
    return null;
  };

  const list = async () => {
    const p = problems();
    if (p) {
      setError(p);
      return;
    }
    setBusy("list");
    setError(null);
    try {
      const r = await fetch("/api/batches", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Forwarded-Origin": window.location.origin,
        },
        body: JSON.stringify({
          kind: d.kind,
          listing: d.listing,
          name: d.name.trim(),
          description: d.description.trim(),
          origin: d.origin.trim(),
          producer: d.producer.trim(),
          producerAddress: account.address,
          shares: Number(d.shares),
          priceEur: Number(d.price),
          started: d.started,
          ready: d.ready,
        }),
      });
      const body = (await r.json()) as { batchId?: number; error?: string };
      if (!r.ok || body.batchId === undefined) {
        throw new Error(body.error ?? `Listing failed (${r.status})`);
      }
      localStorage.removeItem(DRAFT_KEY);
      // Straight to the producer's own page for the batch: link the card, post the first check-in.
      navigate(`/batch/${body.batchId}/manage`);
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Failed to fetch")
          ? "The producer service is not running. Start it with: npm run producer-api"
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(null);
    }
  };

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
        style={{
          position: "relative",
          width: "100%",
          maxWidth: "var(--frame)",
          margin: "0 auto",
        }}
      >
        {/* Header over the sky */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "18px 24px 0",
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
              flex: 1,
              textAlign: "center",
              fontFamily: DISPLAY,
              fontSize: 20,
              lineHeight: 1,
              color: RED,
              marginRight: 32,
            }}
          >
            Fermentos
            <br />
            Norberto <span style={{ color: INK }}>&amp;</span> Raimunda
          </div>
        </div>

        {/* Rainbow */}
        <svg
          className="produce-rainbow"
          viewBox="0 0 390 150"
          preserveAspectRatio="xMidYMax slice"
          style={{ display: "block", width: "100%", marginTop: 8 }}
          aria-hidden="true"
        >
          <g fill="none" strokeWidth="26">
            <path
              d="M-40 160 A235 235 0 0 1 430 160"
              stroke="#8A4F28"
              opacity="0.7"
            />
            <path d="M-14 160 A209 209 0 0 1 404 160" stroke="#C8341E" />
            <path d="M12 160 A183 183 0 0 1 378 160" stroke="#F07C2B" />
            <path d="M38 160 A157 157 0 0 1 352 160" stroke="#F7A8C8" />
          </g>
        </svg>

        {/* Sheet */}
        <div
          style={{
            position: "relative",
            marginTop: -36,
            background: CREAM,
            borderRadius: "32px 32px 0 0",
            padding: "0 24px calc(var(--nav-clear) + 8px)",
            display: "flex",
            flexDirection: "column",
            gap: 20,
          }}
        >
          <span
            style={{
              width: 96,
              height: 96,
              marginTop: -48,
              alignSelf: "center",
              borderRadius: "50%",
              background: RED,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="44" height="54" viewBox="0 0 44 54" aria-hidden="true">
              <rect x="7" y="12" width="30" height="40" rx="6" fill={CREAM} />
              <rect x="10" y="4" width="24" height="10" rx="3" fill="#F5B82E" />
              <path
                d="M22 24v16M14 32h16"
                stroke={RED}
                strokeWidth="4.5"
                strokeLinecap="round"
              />
            </svg>
          </span>

          <div style={{ textAlign: "center", marginTop: -8 }}>
            <h1
              style={{
                margin: 0,
                fontWeight: 800,
                fontSize: 40,
                lineHeight: 1,
                letterSpacing: "-0.04em",
              }}
            >
              Add a ferment
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 17,
                lineHeight: 1.35,
                color: INK_SOFT,
              }}
            >
              A kombucha from your kitchen or a cask from your quinta. List a
              batch and let people own a share of it.
            </p>
          </div>

          <Field
            title="Pick an image"
            right={
              <span style={{ fontSize: 13, color: INK_SOFT }}>
                Shown on the market
              </span>
            }
          >
            <div
              role="radiogroup"
              aria-label="Kind of ferment"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}
            >
              {KINDS.map((k) => {
                const on = d.kind === k.kind;
                return (
                  <button
                    key={k.kind}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("kind", k.kind)}
                    style={{
                      height: 110,
                      borderRadius: 18,
                      border: on ? `3px solid ${RED}` : "3px solid transparent",
                      background: k.tile,
                      color: k.text ?? INK,
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 14,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 2,
                      cursor: "pointer",
                      boxShadow: on
                        ? "0 0 0 3px rgba(200, 52, 30, 0.25)"
                        : "none",
                    }}
                  >
                    <FermentIcon kind={k.kind} />
                    {k.label}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field title="Name">
            <input
              value={d.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="Hibiscus kombucha, Moscatel 2026…"
              style={input}
            />
          </Field>

          <Field title="Producer">
            <input
              value={d.producer}
              onChange={(e) => set("producer", e.target.value)}
              placeholder="Your quinta, dairy or kitchen"
              style={input}
            />
          </Field>

          <Field
            title="Description"
            right={
              <span
                style={{
                  fontSize: 13,
                  color: INK_SOFT,
                  fontFamily: "'Space Mono', monospace",
                }}
              >
                {d.description.length}/{MAX_DESCRIPTION}
              </span>
            }
          >
            <textarea
              value={d.description}
              maxLength={MAX_DESCRIPTION}
              onChange={(e) => set("description", e.target.value)}
              placeholder="What is it, how is it made, what will it taste like when it's ready?"
              rows={4}
              style={{
                ...input,
                height: "auto",
                padding: "8px 0",
                fontSize: 18,
                fontWeight: 500,
                lineHeight: 1.4,
                resize: "vertical",
              }}
            />
          </Field>

          <Field
            title="Origin of the batch"
            right={
              <button
                type="button"
                onClick={locate}
                disabled={busy === "locate"}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  fontFamily: SANS,
                  fontWeight: 800,
                  fontSize: 15,
                  color: TEAL,
                  cursor: "pointer",
                }}
              >
                {busy === "locate" ? "Locating…" : "Use my location"}
              </button>
            }
            hintText="Where it's brewed or aged. Shown on the batch page."
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                borderBottom: `2px solid ${RULE}`,
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke={RED}
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12z" />
                <circle cx="12" cy="10" r="2.5" />
              </svg>
              <input
                value={d.origin}
                onChange={(e) => set("origin", e.target.value)}
                placeholder="Village or region, country"
                style={{ ...input, borderBottom: 0 }}
              />
            </div>
          </Field>

          <Field
            title="What for"
            hintText={
              d.listing === "sale"
                ? "People buy shares now; you are paid at fill and they redeem units when it's ready."
                : "Just a numbered batch with an NFC card and check-ins. You can put it on sale later."
            }
          >
            <div
              role="radiogroup"
              aria-label="Sell or track"
              style={{
                display: "flex",
                padding: 4,
                borderRadius: 26,
                background: "rgba(43, 27, 61, 0.08)",
              }}
            >
              {(
                [
                  ["sale", "Put on sale"],
                  ["track", "Just track it"],
                ] as const
              ).map(([v, label]) => {
                const on = d.listing === v;
                return (
                  <button
                    key={v}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => set("listing", v)}
                    style={{
                      flex: 1,
                      height: 44,
                      borderRadius: 22,
                      border: 0,
                      background: on ? RED : "transparent",
                      color: on ? CREAM : INK,
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 15,
                      cursor: "pointer",
                    }}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </Field>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}
          >
            <Field title="Shares" hintText="Bottles or parts of the batch">
              <input
                inputMode="numeric"
                value={d.shares}
                onChange={(e) =>
                  set("shares", e.target.value.replace(/\D/g, ""))
                }
                style={input}
              />
            </Field>
            <Field
              title="Starting price"
              hintText="Per share, at fill. It rises as the ferment ages"
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  borderBottom: `2px solid ${RULE}`,
                }}
              >
                <span style={{ fontSize: 22, fontWeight: 600 }}>€</span>
                <input
                  inputMode="decimal"
                  value={d.price}
                  onChange={(e) =>
                    set(
                      "price",
                      e.target.value.replace(",", ".").replace(/[^0-9.]/g, ""),
                    )
                  }
                  style={{ ...input, borderBottom: 0 }}
                />
              </div>
            </Field>
          </div>

          <div
            style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 26 }}
          >
            <Field title="Started">
              <input
                type="date"
                value={d.started}
                onChange={(e) => set("started", e.target.value)}
                style={{ ...input, fontSize: 18 }}
              />
            </Field>
            <Field title="Ready around">
              <input
                type="date"
                value={d.ready}
                min={d.started || undefined}
                onChange={(e) => set("ready", e.target.value)}
                style={{ ...input, fontSize: 18 }}
              />
            </Field>
          </div>

          {error && (
            <p
              role="alert"
              style={{ margin: 0, fontSize: 14, color: RED, fontWeight: 700 }}
            >
              {error}
            </p>
          )}

          <button
            type="button"
            disabled={busy === "list"}
            onClick={() => void list()}
            style={{
              height: 60,
              borderRadius: 30,
              border: 0,
              background: RED,
              color: CREAM,
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 20,
              cursor: "pointer",
              opacity: busy === "list" ? 0.6 : 1,
            }}
          >
            {busy === "list"
              ? "Registering on chain…"
              : d.listing === "sale"
                ? "List on the market"
                : "Register the batch"}
          </button>
          <button
            type="button"
            onClick={saveDraft}
            style={{
              marginTop: -14,
              border: 0,
              background: "transparent",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 16,
              color: INK,
              cursor: "pointer",
            }}
          >
            {saved ? "Draft saved" : "Save as draft"}
          </button>
          <p
            style={{
              margin: "-10px 0 0",
              fontSize: 12,
              color: INK_SOFT,
              textAlign: "center",
            }}
          >
            {d.listing === "sale"
              ? "Listing mints the batch token, registers the cellar sensor, issues the share asset and opens the sale. About a minute on testnet."
              : "Registering mints the batch token and the cellar sensor, and names you as its producer. About half a minute on testnet."}
            {account.address
              ? " Your account signs the check-ins and the NFC card."
              : " Sign in first so the batch is yours."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default AddFerment;
