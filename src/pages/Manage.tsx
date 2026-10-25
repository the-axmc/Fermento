import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Checkins from "../components/Checkins";
import { CHECKIN_KINDS } from "../lib/checkins";
import FermentIcon from "../components/FermentIcons";
import MarkChart from "../components/MarkChart";
import PageHeader from "../components/PageHeader";
import { getOracle, getRegistry } from "../contracts/client";
import { useAccount } from "../hooks/useAccount";
import { useBatchChain } from "../hooks/useBatchChain";
import { useCatalogue } from "../hooks/useCatalogue";
import { useProducer } from "../hooks/useProducer";
import { recordActivity } from "../lib/activity";
import { money, pctChange } from "../lib/format";
import { hashSerial, isSerial, nfcSupported, writeTag } from "../lib/nfc";
import {
  BG,
  CREAM,
  DISPLAY,
  INK,
  INK_SOFT,
  MONO,
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

/* ---------------------------------- Pieces --------------------------------- */

const DAY = 86_400;

const stageText = (
  stage: string | undefined,
  filledAt: bigint | undefined,
  maturesAt: bigint | undefined,
) => {
  const now = Date.now() / 1000;
  if (maturesAt !== undefined && now >= Number(maturesAt)) return "Mature";
  const day =
    filledAt !== undefined
      ? Math.max(0, Math.floor((now - Number(filledAt)) / DAY))
      : undefined;
  const word = stage === "filled" || stage === undefined ? "Fermenting" : stage;
  return day === undefined
    ? word[0].toUpperCase() + word.slice(1)
    : `${word[0].toUpperCase() + word.slice(1)} · day ${day}`;
};

const Section: React.FC<{
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}> = ({ title, right, children }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "baseline",
        gap: 12,
      }}
    >
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 800,
          letterSpacing: "-0.02em",
          color: RED,
        }}
      >
        {title}
      </h2>
      {right}
    </div>
    {children}
  </div>
);

const Factor: React.FC<{ label: string; bps: bigint | undefined }> = ({
  label,
  bps,
}) => {
  const n = bps === undefined ? undefined : Number(bps) / 100;
  const up = n !== undefined && n > 100;
  const down = n !== undefined && n < 100;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 2,
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(255, 244, 226, 0.6)",
        minWidth: 0,
      }}
    >
      <span style={{ fontSize: 11, color: INK_SOFT, whiteSpace: "nowrap" }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: MONO,
          fontSize: 14,
          fontWeight: 700,
          color: up ? TEAL_DARK : down ? RED : INK,
        }}
      >
        {n === undefined ? "—" : `${up ? "+" : ""}${(n - 100).toFixed(1)} %`}
      </span>
    </div>
  );
};

/* ---------------------------------- Sheets --------------------------------- */

const Sheet: React.FC<{
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}> = ({ label, onClose, children }) => (
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
      aria-label={label}
      style={{
        position: "absolute",
        left: "50%",
        transform: "translateX(-50%)",
        width: "100%",
        maxWidth: "var(--frame)",
        boxSizing: "border-box",
        bottom: 0,
        maxHeight: "92dvh",
        overflowY: "auto",
        background: CREAM,
        borderRadius: "32px 32px 0 0",
        padding: "28px 24px calc(24px + env(safe-area-inset-bottom, 0px))",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        color: INK,
        fontFamily: SANS,
      }}
    >
      {children}
    </div>
  </div>
);

const h2: React.CSSProperties = {
  margin: 0,
  fontWeight: 800,
  fontSize: 28,
  lineHeight: 1,
  letterSpacing: "-0.03em",
};

const errorText: React.CSSProperties = {
  margin: 0,
  fontSize: 13,
  color: RED,
  fontWeight: 700,
};

const explorer = (hash: string) => (
  <a
    href={`https://stellar.expert/explorer/testnet/tx/${hash}`}
    target="_blank"
    rel="noreferrer"
    style={{ fontSize: 14, fontWeight: 700 }}
  >
    See it on the explorer
  </a>
);

/** Post a check-in: kind, note and a care score, signed by the producer's passkey. */
const CheckinSheet: React.FC<{
  batchId: number;
  onClose: () => void;
  onPosted: () => void;
}> = ({ batchId, onClose, onPosted }) => {
  const account = useAccount();
  const [kind, setKind] = React.useState("lab");
  const [note, setNote] = React.useState("");
  const [score, setScore] = React.useState(90);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<string | null>(null);
  const [care, setCare] = React.useState<bigint | null>(null);

  const post = async () => {
    if (!account.address) return;
    setBusy(true);
    setError(null);
    try {
      const tx = await getOracle().post_checkin({
        batch_id: batchId,
        poster: account.address,
        kind,
        note: note.trim(),
        score,
      });
      setHash(await account.submit(tx));
      setCare(tx.result);
      recordActivity(account.address, {
        kind: "checkin",
        title: `${CHECKIN_KINDS.find((k) => k.kind === kind)?.label ?? "Check-in"} · Batch ${batchId}`,
        batchId,
      });
      onPosted();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet label="Post a check-in" onClose={onClose}>
      <h2 style={h2}>{hash ? "Posted to holders" : "Post a check-in"}</h2>
      {hash ? (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
            Everyone holding a share sees it now.
            {care !== null && Number(care) > 10_000
              ? ` Care multiplier is ${(Number(care) / 100).toFixed(2)} %.`
              : ""}
          </p>
          {explorer(hash)}
          <button type="button" onClick={onClose} style={bigButton()}>
            Done
          </button>
        </>
      ) : (
        <>
          <div
            role="radiogroup"
            aria-label="Kind of check-in"
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8,
            }}
          >
            {CHECKIN_KINDS.map((k) => {
              const on = kind === k.kind;
              return (
                <button
                  key={k.kind}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setKind(k.kind)}
                  style={{
                    height: 64,
                    borderRadius: 14,
                    border: on ? `3px solid ${RED}` : "3px solid transparent",
                    background: k.tile,
                    color: INK,
                    fontFamily: SANS,
                    fontWeight: 800,
                    fontSize: 13,
                    cursor: "pointer",
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontWeight: 800, fontSize: 15, color: RED }}>
              Note{" "}
              <span style={{ fontFamily: MONO, fontSize: 11, color: INK_SOFT }}>
                {note.length}/280
              </span>
            </span>
            <textarea
              value={note}
              maxLength={280}
              rows={3}
              onChange={(e) => setNote(e.target.value)}
              placeholder={
                CHECKIN_KINDS.find((k) => k.kind === kind)?.hint ?? ""
              }
              style={{
                width: "100%",
                boxSizing: "border-box",
                border: 0,
                borderBottom: `2px solid ${INK}`,
                background: "transparent",
                fontFamily: SANS,
                fontSize: 17,
                lineHeight: 1.4,
                color: INK,
                outline: "none",
                padding: "4px 0",
                resize: "vertical",
              }}
            />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontWeight: 800,
                fontSize: 15,
                color: RED,
              }}
            >
              How is it doing?
              <span style={{ fontFamily: MONO, color: INK }}>{score}/100</span>
            </span>
            <input
              type="range"
              min={0}
              max={100}
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              style={{ width: "100%", accentColor: RED }}
            />
            <span style={{ fontSize: 12, color: INK_SOFT }}>
              Honest scores build trust. One check-in a day earns up to +2.5 %
              on the share value, scaled by this score, up to +20 % in all. Go
              quiet for two weeks and the bonus starts to fade.
            </span>
          </label>
          {error && <p style={errorText}>{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void post()}
            style={{ ...bigButton(RED), opacity: busy ? 0.6 : 1 }}
          >
            {busy ? "Signing…" : "Post to holders"}
          </button>
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: INK_SOFT,
              textAlign: "center",
            }}
          >
            Signed with your passkey and stored on chain. Fees are on us.
          </p>
        </>
      )}
    </Sheet>
  );
};

/** Bind an NFC card: write the batch URL to it, hash its serial, record it on the registry. */
const LinkCardSheet: React.FC<{
  batchId: number;
  onClose: () => void;
  onLinked: () => void;
}> = ({ batchId, onClose, onLinked }) => {
  const account = useAccount();
  const supported = nfcSupported();
  const url = `${window.location.origin}/batch/${batchId}`;
  const [serial, setSerial] = React.useState("");
  const [phase, setPhase] = React.useState<"idle" | "tap" | "sign" | "done">(
    "idle",
  );
  const [error, setError] = React.useState<string | null>(null);
  const [hash, setHash] = React.useState<string | null>(null);

  const record = async (s: string) => {
    if (!account.address) return;
    setPhase("sign");
    const tx = await getRegistry().link_tag({
      batch_id: batchId,
      producer: account.address,
      tag: await hashSerial(s),
    });
    setHash(await account.submit(tx));
    recordActivity(account.address, {
      kind: "tag",
      title: `NFC card linked · Batch ${batchId}`,
      batchId,
    });
    setPhase("done");
    onLinked();
  };

  const tap = async () => {
    setError(null);
    setPhase("tap");
    try {
      const { serial: s } = await writeTag(url);
      await record(s);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  const typed = async () => {
    setError(null);
    if (!isSerial(serial)) {
      setError(
        "That does not look like a card serial (hex pairs, e.g. 04:a3:1f:…).",
      );
      return;
    }
    try {
      await record(serial);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  };

  return (
    <Sheet label="Link an NFC card" onClose={onClose}>
      <h2 style={h2}>
        {phase === "done" ? "Card linked" : "Link an NFC card"}
      </h2>
      {phase === "done" ? (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
            Anyone who taps the card opens this batch and the chain confirms it
            belongs here. Only the card's fingerprint is stored, never its
            serial.
          </p>
          {hash && explorer(hash)}
          <button type="button" onClick={onClose} style={bigButton()}>
            Done
          </button>
        </>
      ) : (
        <>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45 }}>
            Stick a blank NFC sticker on the jar or cask. The card will carry{" "}
            <span style={{ fontFamily: MONO, fontSize: 13 }}>{url}</span>.
          </p>
          {supported ? (
            <button
              type="button"
              disabled={phase !== "idle"}
              onClick={() => void tap()}
              style={{ ...bigButton(RED), opacity: phase === "idle" ? 1 : 0.6 }}
            >
              {phase === "tap"
                ? "Hold the card to your phone…"
                : phase === "sign"
                  ? "Confirming with your passkey…"
                  : "Tap the card now"}
            </button>
          ) : (
            <>
              <p style={{ margin: 0, fontSize: 13, color: INK_SOFT }}>
                This browser cannot write NFC (iPhones and desktops). Write the
                link above with any NFC app, then type the card's serial here.
                On Android Chrome the whole thing is one tap.
              </p>
              <input
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="04:a3:1f:2b:6c:80:00"
                inputMode="text"
                autoCapitalize="none"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  height: 48,
                  border: 0,
                  borderBottom: `2px solid ${INK}`,
                  background: "transparent",
                  fontFamily: MONO,
                  fontSize: 18,
                  color: INK,
                  outline: "none",
                }}
              />
              <button
                type="button"
                disabled={phase !== "idle"}
                onClick={() => void typed()}
                style={{
                  ...bigButton(RED),
                  opacity: phase === "idle" ? 1 : 0.6,
                }}
              >
                {phase === "sign"
                  ? "Confirming with your passkey…"
                  : "Link this card"}
              </button>
            </>
          )}
          {error && <p style={errorText}>{error}</p>}
        </>
      )}
    </Sheet>
  );
};

/* ---------------------------------- Page ----------------------------------- */

const Manage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const account = useAccount();
  const catalogue = useCatalogue();
  const info = catalogue.find((b) => b.batchId === Number(id));
  const chain = useBatchChain(info?.batchId);
  const { producer } = useProducer(info?.producerAddress ?? info?.producerSlug);
  const [sheet, setSheet] = React.useState<"checkin" | "card" | null>(null);

  const offering = chain.offering;
  const fillPrice = offering?.price;
  const worth = chain.breakdown?.value ?? fillPrice;
  const change =
    fillPrice !== undefined && worth !== undefined
      ? pctChange(fillPrice, worth)
      : undefined;
  const mine = !!account.address && chain.producer === account.address;
  const certified = producer?.tier === "certified";

  if (!info) {
    return (
      <div style={{ background: BG, minHeight: "100dvh", fontFamily: SANS }}>
        <div className="frame" style={{ padding: "18px 24px 0", gap: 16 }}>
          <PageHeader back="/portfolio" />
          <h1 style={{ margin: "40px 0 0", textAlign: "center" }}>
            Batch not found
          </h1>
        </div>
      </div>
    );
  }

  return (
    <div className="batch" style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 18,
          padding: "18px 24px calc(var(--nav-clear) + 8px)",
        }}
      >
        <PageHeader
          back="/producer/me"
          backLabel="Back to your page"
          right={
            <Link
              to={`/batch/${info.batchId}`}
              aria-label="See the public page"
              style={{ color: INK, display: "flex" }}
            >
              <svg
                width="26"
                height="26"
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
            </Link>
          }
        />

        {/* Identity card */}
        <div
          style={{
            background: CREAM,
            borderRadius: 24,
            padding: 18,
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <span
            style={{
              width: 108,
              height: 108,
              flexShrink: 0,
              borderRadius: 22,
              background: info.tile,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FermentIcon kind={info.kind} size={64} />
          </span>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              minWidth: 0,
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: 12,
                fontWeight: 700,
                color: TEAL,
              }}
            >
              ID · FER-{String(info.batchId).padStart(4, "0")}
            </span>
            <span
              style={{
                fontFamily: DISPLAY,
                fontSize: 28,
                lineHeight: 1,
                color: RED,
                overflowWrap: "anywhere",
              }}
            >
              {info.name}
            </span>
            <span style={{ fontSize: 14 }}>
              {info.label} · {info.region}
            </span>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              <span style={pill(TEAL, CREAM)}>
                {stageText(
                  chain.stage,
                  offering?.filled_at,
                  offering?.matures_at,
                )}
              </span>
              <span
                style={pill(certified ? YELLOW : "rgba(43, 27, 61, 0.1)", INK)}
              >
                {certified ? "Certified" : "Amateur"}
              </span>
              {info.onSale === false && (
                <span style={pill(PINK, INK)}>Just tracking</span>
              )}
            </div>
          </div>
        </div>

        {!mine && (
          <p
            style={{
              margin: 0,
              padding: "12px 16px",
              borderRadius: 16,
              background: "rgba(255, 244, 226, 0.7)",
              fontSize: 14,
            }}
          >
            {account.address
              ? "This batch belongs to another producer, so you can see but not change it."
              : "Sign in with the producer's passkey to post check-ins and link the card."}{" "}
            {!account.address && (
              <button
                type="button"
                onClick={() => navigate("/signin")}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  fontFamily: SANS,
                  fontWeight: 800,
                  color: RED,
                  textDecoration: "underline",
                  cursor: "pointer",
                }}
              >
                Sign in
              </button>
            )}
          </p>
        )}

        {/* Share value */}
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 17 }}>
              Share value now
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: "-0.05em",
                lineHeight: 1,
              }}
            >
              {money(worth)}
            </span>
            <span style={{ fontSize: 15, color: INK_SOFT }}>
              Started at {money(fillPrice)}
              {change ? ` · ${change}` : ""}
              {offering
                ? ` · ${offering.sold.toString()} of ${offering.total_shares.toString()} sold`
                : info.onSale === false
                  ? " · not for sale"
                  : ""}
            </span>
          </div>
          <div style={{ width: 120 }}>
            <MarkChart history={chain.history} height={56} fill="transparent" />
          </div>
        </div>

        {/* What moves the price */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 6,
          }}
        >
          <Factor label="Age" bps={chain.breakdown?.age_bps} />
          <Factor label="Cellar" bps={chain.breakdown?.condition_bps} />
          <Factor label="Your care" bps={chain.breakdown?.care_bps} />
          <Factor label="Producer" bps={chain.breakdown?.producer_bps} />
        </div>

        {/* NFC card */}
        <Section title="NFC card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "12px 0",
              borderBottom: `1.5px solid ${RULE}`,
            }}
          >
            <span
              style={{
                width: 60,
                height: 60,
                flexShrink: 0,
                borderRadius: "50%",
                background: CREAM,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke={chain.tag ? TEAL : RED}
                strokeWidth="2.4"
                strokeLinecap="round"
                aria-hidden="true"
              >
                <circle cx="8" cy="12" r="1.6" fill={chain.tag ? TEAL : RED} />
                <path d="M11.5 8.5a5 5 0 0 1 0 7M14.5 6a8.5 8.5 0 0 1 0 12M17.5 3.5a12 12 0 0 1 0 17" />
              </svg>
            </span>
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 2,
              }}
            >
              <span style={{ fontWeight: 800, fontSize: 18 }}>
                {chain.tag ? "Linked" : "Not linked yet"}
              </span>
              <span style={{ fontSize: 14, color: INK_SOFT, lineHeight: 1.35 }}>
                {chain.tag ? (
                  <>
                    Fingerprint{" "}
                    <span style={{ fontFamily: MONO, fontSize: 12 }}>
                      {chain.tag.slice(0, 8)}…{chain.tag.slice(-6)}
                    </span>
                    . Tap it to verify.
                  </>
                ) : (
                  "Stick a card on the jar so anyone can tap and verify it"
                )}
              </span>
            </div>
            {mine && (
              <button
                type="button"
                onClick={() => setSheet("card")}
                style={{
                  ...pill(INK, CREAM),
                  height: 44,
                  padding: "0 18px",
                  borderRadius: 22,
                  border: 0,
                  fontSize: 15,
                  cursor: "pointer",
                }}
              >
                {chain.tag ? "Re-link" : "Link card"}
              </button>
            )}
          </div>
        </Section>

        {/* Check-ins */}
        <Section
          title="Check-ins"
          right={
            <span style={{ fontSize: 13, color: INK_SOFT }}>
              Each one is shown to holders
            </span>
          }
        >
          <Checkins
            rows={chain.checkins}
            fillPrice={fillPrice}
            emptyText={
              chain.loading
                ? "Reading the ledger…"
                : "Nothing posted yet. The first check-in tells holders the story began."
            }
          />
        </Section>

        {mine && (
          <button
            type="button"
            onClick={() => setSheet("checkin")}
            style={{ ...bigButton(RED), height: 60, marginTop: 6 }}
          >
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
            Post a check-in
          </button>
        )}

        {sheet === "checkin" && (
          <CheckinSheet
            batchId={info.batchId}
            onClose={() => setSheet(null)}
            onPosted={chain.refresh}
          />
        )}
        {sheet === "card" && (
          <LinkCardSheet
            batchId={info.batchId}
            onClose={() => setSheet(null)}
            onLinked={chain.refresh}
          />
        )}
      </div>
    </div>
  );
};

export default Manage;
