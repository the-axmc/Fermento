import React from "react";
import { Link } from "react-router-dom";
import Landscape from "../components/Landscape";
import { useNavigate } from "react-router-dom";
import Holdings from "../components/Holdings";
import { USDC_ID } from "../contracts/client";
import { useAccount } from "../hooks/useAccount";
import { useBalance } from "../hooks/useBalance";
import { requestFunds, useTreasury } from "../hooks/useTreasury";
import { money, shortAddress } from "../lib/format";
import "./Wallet.css";

/* ---------------------------------- Types --------------------------------- */

type Currency = "EUR" | "USD";
type Method = "card" | "bank" | "wallet";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL_DARK = "#08403E";
const RULE_SOFT = "rgba(43, 27, 61, 0.18)";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

const PRESETS = [25, 50, 100, 250];
const MIN_AMOUNT = 10;

/* ------------------------------- Illustrations ----------------------------- */

const SunArcs: React.FC = () => (
  <svg
    width="200"
    height="130"
    viewBox="0 0 200 130"
    style={{ position: "absolute", right: 181, top: 239 }}
    aria-hidden="true"
  >
    <g fill="none" strokeWidth="14">
      <path d="M20 140 A80 80 0 0 1 180 140" stroke="#C8341E" />
      <path d="M34 140 A66 66 0 0 1 166 140" stroke="#F07C2B" />
      <path d="M48 140 A52 52 0 0 1 152 140" stroke="#F5B82E" />
      <path d="M62 140 A38 38 0 0 1 138 140" stroke="#FFF4E2" />
    </g>
    <circle cx="100" cy="140" r="31" fill="#157A78" />
  </svg>
);

const PlusIcon: React.FC<{ size: number; stroke: string; width: number }> = ({
  size,
  stroke,
  width,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={stroke}
    strokeWidth={width}
    strokeLinecap="round"
    aria-hidden="true"
  >
    <path d="M12 5v14M5 12h14" />
  </svg>
);

/* ---------------------------------- Pieces --------------------------------- */

const mono: React.CSSProperties = {
  fontFamily: MONO,
  fontWeight: 700,
};

const sectionTitle: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 800,
  color: RED,
};

const visuallyHidden: React.CSSProperties = {
  position: "absolute",
  width: 1,
  height: 1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
};

const primaryButton = (enabled: boolean): React.CSSProperties => ({
  height: 56,
  minHeight: 56,
  flexShrink: 0,
  borderRadius: 28,
  border: 0,
  fontFamily: SANS,
  fontWeight: 700,
  fontSize: 18,
  background: enabled ? INK : "rgba(43, 27, 61, 0.25)",
  color: enabled ? CREAM : INK,
  cursor: enabled ? "pointer" : "not-allowed",
});

const segmentStyle = (active: boolean): React.CSSProperties => ({
  height: 40,
  padding: "0 14px",
  borderRadius: 20,
  border: 0,
  cursor: "pointer",
  fontFamily: SANS,
  fontSize: 14,
  fontWeight: 800,
  background: active ? RED : "transparent",
  color: active ? CREAM : INK,
});

const presetStyle = (active: boolean): React.CSSProperties => ({
  height: 44,
  borderRadius: 22,
  border: 0,
  cursor: "pointer",
  fontFamily: SANS,
  fontSize: 16,
  fontWeight: 800,
  background: active ? RED : BG,
  color: active ? CREAM : INK,
});

const radioStyle = (active: boolean): React.CSSProperties => ({
  width: 22,
  height: 22,
  boxSizing: "border-box",
  borderRadius: "50%",
  border: active ? `7px solid ${RED}` : `2px solid ${INK}`,
  background: active ? CREAM : "transparent",
  flexShrink: 0,
});

/** Keeps digits and one decimal point, with at most two decimals. */
const sanitizeAmount = (value: string): string => {
  const raw = value
    .replace(",", ".")
    .replace(/[^0-9.]/g, "")
    .replace(/(\..*)\./g, "$1");
  const [whole, decimals] = raw.split(".");
  return decimals === undefined ? raw : `${whole}.${decimals.slice(0, 2)}`;
};

/* --------------------------------- Component ------------------------------- */

const Wallet: React.FC = () => {
  const [cur, setCur] = React.useState<Currency>("EUR");
  const [modal, setModal] = React.useState(false);
  const [amount, setAmount] = React.useState("50");
  const [method, setMethod] = React.useState<Method>("card");
  const account = useAccount();
  const navigate = useNavigate();
  const address = account.address;
  const { treasury, refresh: refreshTreasury } = useTreasury();
  const usdc = useBalance(USDC_ID, address);
  const eurc = useBalance(treasury?.assets.EURC?.sac ?? "", address);
  const [funding, setFunding] = React.useState(false);
  const [fundError, setFundError] = React.useState<string | null>(null);
  const [fundHash, setFundHash] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  const isEUR = cur === "EUR";
  const sym = isEUR ? "€" : "$";
  const coin = isEUR ? "EURC" : "USDC";
  const value = Number(amount) || 0;
  const amountFixed = value.toFixed(2);
  const tooLow = value < MIN_AMOUNT;

  const copyAddress = () => {
    if (!address) return;
    void navigator.clipboard?.writeText(address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const methods = [
    {
      id: "card" as const,
      label: "Card",
      note: "Visa, Mastercard, Apple Pay",
    },
    {
      id: "bank" as const,
      label: "Bank transfer",
      note: isEUR
        ? "SEPA, from your own bank account"
        : "From your own bank account",
    },
    {
      id: "wallet" as const,
      label: "Fermento treasury (testnet)",
      note: !address
        ? "Sign in first"
        : treasury
          ? `${Number(treasury.assets[coin]?.balance ?? 0).toFixed(2)} ${coin} available · sent to ${shortAddress(address)}`
          : "Producer service is not running",
    },
  ];

  const openModal = () => setModal(true);
  const closeModal = () => {
    setModal(false);
    setFundHash(null);
    setFundError(null);
  };

  const addFunds = async () => {
    if (method !== "wallet") {
      closeModal();
      return;
    }
    if (!address) {
      navigate("/signin");
      return;
    }
    setFunding(true);
    setFundError(null);
    try {
      setFundHash(await requestFunds(address, coin, value));
      refreshTreasury();
    } catch (err) {
      setFundError(err instanceof Error ? err.message : String(err));
    } finally {
      setFunding(false);
    }
  };

  React.useEffect(() => {
    if (!modal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModal(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modal]);

  return (
    <div className="wallet" style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          gap: 16,
          padding: "18px 24px 0",
        }}
      >
        <SunArcs />

        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
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

        <h1
          style={{
            position: "relative",
            margin: 0,
            fontWeight: 800,
            fontSize: 44,
            lineHeight: 0.95,
            letterSpacing: "-0.04em",
            textAlign: "center",
          }}
        >
          Wallet
        </h1>

        <div
          style={{
            position: "relative",
            textAlign: "center",
            fontSize: 56,
            fontWeight: 700,
            letterSpacing: "-0.04em",
          }}
        >
          {address ? money(isEUR ? eurc : usdc, sym) : `${sym}0.00`}
        </div>
        <div
          style={{
            position: "relative",
            marginTop: -10,
            textAlign: "center",
            fontSize: 13,
            color: INK_SOFT,
          }}
        >
          {address ? (
            <>
              {coin} in your account ·{" "}
              <button
                type="button"
                onClick={copyAddress}
                title={address}
                style={{
                  border: 0,
                  padding: 0,
                  background: "transparent",
                  fontFamily: MONO,
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                }}
              >
                {copied ? "copied" : shortAddress(address, 6)}
              </button>
            </>
          ) : account.status === "loading" ? (
            "Restoring your account…"
          ) : (
            <button
              type="button"
              onClick={() => navigate("/signin")}
              style={{
                border: 0,
                padding: 0,
                background: "transparent",
                fontFamily: SANS,
                fontSize: 14,
                fontWeight: 700,
                color: RED,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Sign in with your passkey
            </button>
          )}
        </div>

        <button type="button" onClick={openModal} style={primaryButton(true)}>
          Add funds
        </button>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 12,
          }}
        >
          <div
            role="group"
            aria-label="Display currency"
            style={{
              display: "flex",
              padding: 4,
              borderRadius: 26,
              background: CREAM,
            }}
          >
            {(["EUR", "USD"] as const).map((c) => (
              <button
                key={c}
                type="button"
                aria-pressed={cur === c}
                onClick={() => setCur(c)}
                style={segmentStyle(cur === c)}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <Holdings />

        {address && (
          <button
            type="button"
            onClick={() =>
              void account.signOut().then(() => navigate("/signin"))
            }
            style={{
              alignSelf: "flex-end",
              padding: 0,
              border: 0,
              background: "transparent",
              fontFamily: SANS,
              fontSize: 13,
              fontWeight: 700,
              color: RED,
              textDecoration: "underline",
              textUnderlineOffset: 3,
              cursor: "pointer",
            }}
          >
            Sign out on this device
          </button>
        )}

        <Landscape />

        {modal && (
          <div style={{ position: "fixed", inset: 0, zIndex: 30 }}>
            <button
              type="button"
              aria-label="Close"
              onClick={closeModal}
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
              aria-label="Add funds"
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
                padding: "0 24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <span
                style={{
                  width: 84,
                  height: 84,
                  marginTop: -42,
                  alignSelf: "center",
                  borderRadius: "50%",
                  background: RED,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <PlusIcon size={36} stroke={CREAM} width={2.6} />
              </span>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 2,
                  textAlign: "center",
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontWeight: 800,
                    fontSize: 30,
                    lineHeight: 1,
                    letterSpacing: "-0.03em",
                  }}
                >
                  Add funds
                </h2>
                <label
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "center",
                    gap: 2,
                    padding: "0 8px 4px",
                    borderBottom: "3px dashed rgba(200, 52, 30, 0.5)",
                    color: RED,
                    fontWeight: 800,
                    fontSize: 56,
                    lineHeight: 1.05,
                    letterSpacing: "-0.05em",
                  }}
                >
                  <span aria-hidden="true">{sym}</span>
                  <span style={visuallyHidden}>Amount to add</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    value={amount}
                    onChange={(e) => setAmount(sanitizeAmount(e.target.value))}
                    placeholder="0"
                    style={{
                      width: `${Math.max(amount.length, 1) + 0.4}ch`,
                      minWidth: "1.4ch",
                      border: 0,
                      padding: 0,
                      background: "transparent",
                      color: RED,
                      fontFamily: SANS,
                      fontWeight: 800,
                      fontSize: 56,
                      letterSpacing: "-0.05em",
                      textAlign: "left",
                      outline: "none",
                    }}
                  />
                </label>
              </div>

              <div
                role="group"
                aria-label="Amount"
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  gap: 8,
                }}
              >
                {PRESETS.map((p) => {
                  const on = value === p;
                  return (
                    <button
                      key={p}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setAmount(String(p))}
                      style={presetStyle(on)}
                    >
                      {sym}
                      {p}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ ...sectionTitle, fontSize: 15 }}>Pay with</span>
                {methods.map((m) => {
                  const on = m.id === method;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setMethod(m.id)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 14,
                        minHeight: 54,
                        padding: 0,
                        background: "transparent",
                        border: 0,
                        borderBottom: `1.5px solid ${RULE_SOFT}`,
                        fontFamily: SANS,
                        color: INK,
                        textAlign: "left",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={INK}
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        {m.id === "card" && (
                          <>
                            <rect x="2.5" y="5" width="19" height="14" rx="3" />
                            <path d="M2.5 10h19M6 15h4" />
                          </>
                        )}
                        {m.id === "bank" && (
                          <path d="M3 9.5 12 4l9 5.5M5 10v8M9.5 10v8M14.5 10v8M19 10v8M3 20h18" />
                        )}
                        {m.id === "wallet" && (
                          <>
                            <path d="M10 14a4.5 4.5 0 0 0 6.4 0l3-3a4.5 4.5 0 0 0-6.4-6.4l-1 1" />
                            <path d="M14 10a4.5 4.5 0 0 0-6.4 0l-3 3a4.5 4.5 0 0 0 6.4 6.4l1-1" />
                          </>
                        )}
                      </svg>
                      <span
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          gap: 1,
                        }}
                      >
                        <span style={{ fontSize: 15, fontWeight: 700 }}>
                          {m.label}
                        </span>
                        <span style={{ fontSize: 12, color: INK_SOFT }}>
                          {m.note}
                        </span>
                      </span>
                      <span style={radioStyle(on)} />
                    </button>
                  );
                })}
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  fontSize: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ color: INK_SOFT }}>Payment fee</span>
                  <span style={mono}>[FEE]</span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <span style={{ fontWeight: 700 }}>You receive</span>
                  <span style={{ ...mono, color: TEAL_DARK }}>
                    {amountFixed} {coin}
                  </span>
                </div>
              </div>

              {fundError && (
                <p
                  style={{
                    margin: 0,
                    fontSize: 13,
                    color: RED,
                    fontWeight: 700,
                  }}
                >
                  {fundError}
                </p>
              )}
              {fundHash ? (
                <>
                  <p style={{ margin: 0, fontSize: 14 }}>
                    {amountFixed} {coin} landed in your account.{" "}
                    <a
                      href={`https://stellar.expert/explorer/testnet/tx/${fundHash}`}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: RED, fontWeight: 700 }}
                    >
                      Explorer
                    </a>
                  </p>
                  <button
                    type="button"
                    onClick={closeModal}
                    style={{ ...primaryButton(true), marginTop: 4 }}
                  >
                    Done
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  disabled={tooLow || funding}
                  onClick={() => void addFunds()}
                  style={{
                    ...primaryButton(!tooLow && !funding),
                    marginTop: 4,
                  }}
                >
                  {funding ? "Sending…" : `Add ${sym}${amountFixed}`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Wallet;
