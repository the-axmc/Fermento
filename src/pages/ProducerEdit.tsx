import React from "react";
import { useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import type { Kind } from "../data/batches";
import { monogram } from "../data/producers";
import { useAccount } from "../hooks/useAccount";
import { saveProfile, useProducer } from "../hooks/useProducer";
import {
  BG,
  CREAM,
  INK,
  INK_SOFT,
  RED,
  SANS,
  bigButton,
  fieldInput,
  fieldLabel,
} from "../lib/theme";

const KINDS: { kind: Kind; label: string }[] = [
  { kind: "kombucha", label: "Kombucha" },
  { kind: "kefir", label: "Kefir" },
  { kind: "wine", label: "Wine" },
  { kind: "cider", label: "Cider" },
  { kind: "mead", label: "Mead" },
  { kind: "vinegar", label: "Vinegar" },
  { kind: "fortified", label: "Fortified" },
  { kind: "kimchi", label: "Kimchi" },
  { kind: "cheese", label: "Cheese" },
  { kind: "other", label: "Other" },
];

const Field: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <span style={fieldLabel}>{title}</span>
    {children}
  </div>
);

/** The sheet where a producer writes its page. Creates the page on first save. */
const ProducerEdit: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { producer, loading } = useProducer(account.address);
  const [name, setName] = React.useState("");
  const [location, setLocation] = React.useState("");
  const [story, setStory] = React.useState("");
  const [website, setWebsite] = React.useState("");
  const [kinds, setKinds] = React.useState<Kind[]>([]);
  const [seeded, setSeeded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (seeded || loading) return;
    if (producer && producer.address === account.address) {
      setName(producer.name);
      setLocation(producer.location);
      setStory(producer.story);
      setWebsite(producer.website ?? "");
      setKinds(producer.kinds);
    }
    setSeeded(true);
  }, [producer, loading, seeded, account.address]);

  const toggle = (k: Kind) =>
    setKinds((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));

  const save = async () => {
    if (!account.address) {
      navigate("/signin");
      return;
    }
    if (!name.trim()) {
      setError("Give your page a name.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await saveProfile(account.address, {
        name,
        location,
        story,
        website,
        kinds,
      });
      navigate("/producer/me");
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes("Failed to fetch")
          ? "The producer service is not running. Start it with: npm run producer-api"
          : err instanceof Error
            ? err.message
            : String(err),
      );
    } finally {
      setBusy(false);
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
        <div style={{ padding: "18px 24px 0" }}>
          <PageHeader back="/producer/me" backLabel="Back to your page" />
        </div>

        <div
          style={{
            position: "relative",
            marginTop: 64,
            background: CREAM,
            borderRadius: "32px 32px 0 0",
            padding: "0 24px calc(var(--nav-clear) + 8px)",
            display: "flex",
            flexDirection: "column",
            gap: 18,
          }}
        >
          <span
            style={{
              position: "relative",
              width: 112,
              height: 112,
              marginTop: -56,
              alignSelf: "center",
              borderRadius: "50%",
              background: INK,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "'Shrikhand', Georgia, serif",
              fontSize: 48,
              color: "#F5B82E",
              overflow: "visible",
            }}
          >
            {producer?.logo ? (
              <img
                src={producer.logo}
                alt=""
                style={{ width: 112, height: 112, borderRadius: "50%" }}
              />
            ) : (
              monogram(name || "A")
            )}
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -2,
                bottom: 4,
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: RED,
                border: `3px solid ${CREAM}`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke={CREAM}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </span>
          </span>

          <h1
            style={{
              margin: "-6px 0 0",
              textAlign: "center",
              fontWeight: 800,
              fontSize: 34,
              lineHeight: 1,
              letterSpacing: "-0.04em",
            }}
          >
            {producer ? "Edit your page" : "Create your page"}
          </h1>
          <p
            style={{
              margin: "-8px 0 0",
              textAlign: "center",
              fontSize: 13,
              color: INK_SOFT,
            }}
          >
            {producer?.tier === "certified"
              ? "Your logo comes from your certification."
              : "A logo appears once you are certified as a company."}
          </p>

          <Field title="Producer name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Andrea's Ferments"
              maxLength={60}
              style={fieldInput}
            />
          </Field>
          <Field title="Where you ferment">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Town, country"
              maxLength={80}
              style={fieldInput}
            />
          </Field>
          <Field title="Your story">
            <textarea
              value={story}
              onChange={(e) => setStory(e.target.value)}
              rows={4}
              maxLength={600}
              placeholder="What you make, how, and why people should hold a share of it."
              style={{
                ...fieldInput,
                height: "auto",
                padding: "6px 0",
                fontSize: 17,
                fontWeight: 500,
                lineHeight: 1.4,
                resize: "vertical",
              }}
            />
          </Field>
          <Field title="Website (optional)">
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="your-ferments.pt"
              maxLength={120}
              inputMode="url"
              autoCapitalize="none"
              style={fieldInput}
            />
          </Field>
          <Field title="What you make">
            <div
              role="group"
              aria-label="What you make"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 8,
                marginTop: 4,
              }}
            >
              {KINDS.map((k) => {
                const on = kinds.includes(k.kind);
                return (
                  <button
                    key={k.kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(k.kind)}
                    style={{
                      height: 40,
                      padding: "0 16px",
                      borderRadius: 20,
                      border: `2px solid ${on ? RED : INK}`,
                      background: on ? RED : "transparent",
                      color: on ? CREAM : INK,
                      fontFamily: SANS,
                      fontWeight: 700,
                      fontSize: 14,
                      cursor: "pointer",
                    }}
                  >
                    {k.label}
                  </button>
                );
              })}
            </div>
          </Field>

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
            disabled={busy}
            onClick={() => void save()}
            style={{ ...bigButton(), height: 60, opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Saving…" : "Save and publish"}
          </button>
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              marginTop: -8,
              border: 0,
              background: "transparent",
              fontFamily: SANS,
              fontWeight: 800,
              fontSize: 16,
              color: INK,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProducerEdit;
