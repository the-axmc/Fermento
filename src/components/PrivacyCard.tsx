import React from "react";
import { useAccount } from "../hooks/useAccount";
import { useConfidential, type Phase } from "../hooks/useConfidential";
import { exportRoot, hasRoot, importRoot } from "../lib/confidential";
import {
  CREAM,
  INK,
  INK_SOFT,
  MONO,
  RED,
  RULE,
  SANS,
  TEAL,
  TEAL_DARK,
  YELLOW,
  bigButton,
  pill,
} from "../lib/theme";

type SheetKind = "hide" | "send" | "reveal" | "backup";

const phaseText: Record<Phase, string> = {
  idle: "",
  proving: "Generating the proof on this phone. A few seconds…",
  signing: "Confirm with your passkey.",
  waiting: "Waiting for the ledger…",
  syncing: "Reading your private balance back…",
};

const Lock: React.FC<{ open?: boolean; color?: string }> = ({
  open,
  color = INK,
}) => (
  <svg
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2.2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="4" y="10" width="16" height="11" rx="3" />
    {open ? (
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    ) : (
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    )}
    <circle cx="12" cy="15.5" r="1.4" fill={color} />
  </svg>
);

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

const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  height: 52,
  border: 0,
  borderBottom: `2px solid ${INK}`,
  background: "transparent",
  fontFamily: SANS,
  fontSize: 24,
  fontWeight: 700,
  color: INK,
  outline: "none",
};

/**
 * A holder's private position on a batch: how many shares are public, how
 * many are hidden in the wrapper, and the buttons that move them.
 */
const PrivacyCard: React.FC<{
  token: string;
  batchId: number;
  label: string;
  /** Shares held publicly, from the share token. */
  publicShares: bigint | undefined;
  onChanged?: () => void;
}> = ({ token, batchId, label, publicShares, onChanged }) => {
  const account = useAccount();
  const c = useConfidential(token, batchId);
  const [sheet, setSheet] = React.useState<SheetKind | null>(null);
  const [qty, setQty] = React.useState("1");
  const [to, setTo] = React.useState("");
  const [backup, setBackup] = React.useState("");
  const [done, setDone] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);

  const amount = BigInt(qty.replace(/\D/g, "") || "0");
  const privateTotal = c.spendable + c.receiving;

  const act = async (work: () => Promise<void>, message: string) => {
    setBusy(true);
    setDone(null);
    try {
      await work();
      setDone(message);
      onChanged?.();
    } catch {
      /* the hook keeps the error */
    } finally {
      setBusy(false);
    }
  };

  const close = () => {
    setSheet(null);
    setDone(null);
  };

  if (!c.available || !account.address) return null;

  return (
    <div
      style={{
        borderRadius: 20,
        background: INK,
        color: CREAM,
        padding: "16px 16px 14px",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <Lock color={YELLOW} />
        <span style={{ fontWeight: 800, fontSize: 16, flex: 1 }}>
          Private shares
        </span>
        <span style={pill("rgba(255, 244, 226, 0.14)", CREAM)}>
          {c.loading
            ? "reading…"
            : c.registered
              ? c.verified
                ? "verified"
                : "out of sync"
              : "not set up"}
        </span>
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Public</span>
          <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700 }}>
            {publicShares === undefined ? "—" : publicShares.toString()}
          </span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 12, opacity: 0.75 }}>Private</span>
          <span
            style={{
              fontFamily: MONO,
              fontSize: 22,
              fontWeight: 700,
              color: YELLOW,
            }}
          >
            {c.loading ? "…" : privateTotal.toString()}
          </span>
        </div>
        {c.receiving > 0n && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 12, opacity: 0.75 }}>Received</span>
            <span style={{ fontFamily: MONO, fontSize: 22, fontWeight: 700 }}>
              {c.receiving.toString()}
            </span>
          </div>
        )}
      </div>

      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.4, opacity: 0.85 }}>
        Private shares sit in a confidential wrapper: the chain sees that you
        hold some, never how many. Amounts are decrypted on this phone only.
        Fermento, as auditor, can read them for compliance.
      </p>

      {c.phase !== "idle" && (
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: YELLOW }}>
          {phaseText[c.phase]}
        </p>
      )}
      {c.error && !sheet && (
        <p style={{ margin: 0, fontSize: 13, color: "#F7A8C8" }}>{c.error}</p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button
          type="button"
          disabled={busy || !publicShares}
          onClick={() => {
            setQty(publicShares && publicShares > 0n ? "1" : "0");
            setSheet("hide");
          }}
          style={{
            ...pill(YELLOW, INK),
            height: 40,
            borderRadius: 20,
            border: 0,
            cursor: "pointer",
            fontSize: 14,
            opacity: publicShares ? 1 : 0.5,
          }}
        >
          <Lock /> Keep private
        </button>
        {c.receiving > 0n && (
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              void act(c.merge, "Merged into your spendable balance.")
            }
            style={{
              ...pill(CREAM, INK),
              height: 40,
              borderRadius: 20,
              border: 0,
              cursor: "pointer",
              fontSize: 14,
            }}
          >
            Merge received
          </button>
        )}
        {c.spendable > 0n && (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setQty("1");
                setSheet("send");
              }}
              style={{
                ...pill(CREAM, INK),
                height: 40,
                borderRadius: 20,
                border: 0,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              Send privately
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setQty("1");
                setSheet("reveal");
              }}
              style={{
                ...pill("transparent", CREAM),
                height: 40,
                borderRadius: 20,
                border: `1.5px solid ${CREAM}`,
                cursor: "pointer",
                fontSize: 14,
              }}
            >
              <Lock open color={CREAM} /> Make public
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => {
            setBackup("");
            setSheet("backup");
          }}
          style={{
            marginLeft: "auto",
            border: 0,
            background: "transparent",
            color: CREAM,
            fontFamily: SANS,
            fontWeight: 700,
            fontSize: 13,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          Privacy key
        </button>
      </div>

      {sheet === "hide" && (
        <Sheet label="Keep shares private" onClose={close}>
          <h2 style={h2}>{done ? "Hidden" : `Keep ${label} shares private`}</h2>
          {done ? (
            <>
              <p style={{ margin: 0, fontSize: 15 }}>{done}</p>
              <button type="button" onClick={close} style={bigButton()}>
                Done
              </button>
            </>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: INK_SOFT,
                }}
              >
                {c.registered
                  ? "The deposit amount is public; everything after it is not."
                  : "First time on this batch: your phone generates a registration proof, then deposits. Three passkey confirmations."}
              </p>
              <label
                style={{ display: "flex", alignItems: "baseline", gap: 8 }}
              >
                <input
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                  aria-label="Shares to hide"
                  style={input}
                />
                <span style={{ fontSize: 16 }}>
                  of {publicShares?.toString() ?? "0"}
                </span>
              </label>
              <Status c={c} />
              <button
                type="button"
                disabled={
                  busy ||
                  amount === 0n ||
                  (publicShares !== undefined && amount > publicShares)
                }
                onClick={() =>
                  void act(
                    () => c.hide(amount),
                    `${amount.toString()} shares are now private.`,
                  )
                }
                style={{
                  ...bigButton(RED),
                  opacity: busy || amount === 0n ? 0.6 : 1,
                }}
              >
                {busy
                  ? "Working…"
                  : c.registered
                    ? "Hide shares"
                    : "Set up and hide"}
              </button>
            </>
          )}
        </Sheet>
      )}

      {sheet === "send" && (
        <Sheet label="Send private shares" onClose={close}>
          <h2 style={h2}>{done ? "Sent" : "Send privately"}</h2>
          {done ? (
            <>
              <p style={{ margin: 0, fontSize: 15 }}>{done}</p>
              <button type="button" onClick={close} style={bigButton()}>
                Done
              </button>
            </>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: INK_SOFT,
                }}
              >
                The recipient must have set up privacy on this batch. Only the
                two of you, and the auditor, learn the amount.
              </p>
              <label
                style={{ display: "flex", flexDirection: "column", gap: 4 }}
              >
                <span style={{ fontWeight: 800, fontSize: 14, color: RED }}>
                  To (account address)
                </span>
                <input
                  value={to}
                  onChange={(e) => setTo(e.target.value.trim())}
                  placeholder="C… or G…"
                  autoCapitalize="none"
                  style={{ ...input, fontFamily: MONO, fontSize: 15 }}
                />
              </label>
              <label
                style={{ display: "flex", alignItems: "baseline", gap: 8 }}
              >
                <input
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                  aria-label="Shares to send"
                  style={input}
                />
                <span style={{ fontSize: 16 }}>
                  of {c.spendable.toString()} private
                </span>
              </label>
              <Status c={c} />
              <button
                type="button"
                disabled={
                  busy ||
                  amount === 0n ||
                  amount > c.spendable ||
                  !/^[GC][A-Z2-7]{55}$/.test(to)
                }
                onClick={() =>
                  void act(
                    () => c.send(to, amount),
                    `${amount.toString()} shares sent privately.`,
                  )
                }
                style={{ ...bigButton(RED), opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Working…" : "Send"}
              </button>
            </>
          )}
        </Sheet>
      )}

      {sheet === "reveal" && (
        <Sheet label="Make shares public" onClose={close}>
          <h2 style={h2}>{done ? "Public again" : "Make shares public"}</h2>
          {done ? (
            <>
              <p style={{ margin: 0, fontSize: 15 }}>{done}</p>
              <button type="button" onClick={close} style={bigButton()}>
                Done
              </button>
            </>
          ) : (
            <>
              <p
                style={{
                  margin: 0,
                  fontSize: 15,
                  lineHeight: 1.45,
                  color: INK_SOFT,
                }}
              >
                Needed before redeeming or selling on the market. The withdrawn
                amount becomes visible.
              </p>
              <label
                style={{ display: "flex", alignItems: "baseline", gap: 8 }}
              >
                <input
                  inputMode="numeric"
                  value={qty}
                  onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))}
                  aria-label="Shares to reveal"
                  style={input}
                />
                <span style={{ fontSize: 16 }}>
                  of {c.spendable.toString()} private
                </span>
              </label>
              <Status c={c} />
              <button
                type="button"
                disabled={busy || amount === 0n || amount > c.spendable}
                onClick={() =>
                  void act(
                    () => c.reveal(amount),
                    `${amount.toString()} shares are public again.`,
                  )
                }
                style={{ ...bigButton(), opacity: busy ? 0.6 : 1 }}
              >
                {busy ? "Working…" : "Make public"}
              </button>
            </>
          )}
        </Sheet>
      )}

      {sheet === "backup" && account.address && (
        <Sheet label="Privacy key" onClose={close}>
          <h2 style={h2}>Your privacy key</h2>
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.45,
              color: INK_SOFT,
            }}
          >
            Private balances can only be read and spent with this key. It lives
            in this browser. Copy it somewhere safe, or paste one from another
            device.
          </p>
          <code
            style={{
              display: "block",
              padding: 12,
              borderRadius: 12,
              background: "rgba(43, 27, 61, 0.08)",
              fontFamily: MONO,
              fontSize: 12,
              wordBreak: "break-all",
            }}
          >
            {hasRoot(account.address)
              ? exportRoot(account.address)
              : "No key yet. One is created when you first keep shares private."}
          </code>
          <button
            type="button"
            onClick={() =>
              void navigator.clipboard?.writeText(exportRoot(account.address!))
            }
            style={{
              ...pill(TEAL, CREAM),
              alignSelf: "flex-start",
              height: 40,
              borderRadius: 20,
              border: 0,
              cursor: "pointer",
            }}
          >
            Copy key
          </button>
          <label
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 4,
              marginTop: 8,
              paddingTop: 12,
              borderTop: `1.5px solid ${RULE}`,
            }}
          >
            <span style={{ fontWeight: 800, fontSize: 14, color: RED }}>
              Restore from a backup
            </span>
            <input
              value={backup}
              onChange={(e) => setBackup(e.target.value)}
              placeholder="64 hexadecimal characters"
              autoCapitalize="none"
              style={{ ...input, fontFamily: MONO, fontSize: 14 }}
            />
          </label>
          {done && (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                color: TEAL_DARK,
                fontWeight: 700,
              }}
            >
              {done}
            </p>
          )}
          <button
            type="button"
            disabled={backup.trim().length !== 64}
            onClick={() => {
              try {
                importRoot(account.address!, backup);
                setDone("Key restored. Reading balances…");
                c.refresh();
              } catch (e) {
                setDone(e instanceof Error ? e.message : String(e));
              }
            }}
            style={{
              ...bigButton(),
              opacity: backup.trim().length === 64 ? 1 : 0.5,
            }}
          >
            Restore
          </button>
        </Sheet>
      )}
    </div>
  );
};

const Status: React.FC<{ c: ReturnType<typeof useConfidential> }> = ({ c }) => (
  <>
    {c.phase !== "idle" && (
      <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: TEAL_DARK }}>
        {phaseText[c.phase]}
      </p>
    )}
    {c.lastProofMs !== undefined && c.phase === "idle" && (
      <p style={{ margin: 0, fontSize: 12, color: INK_SOFT }}>
        Last proof took {(c.lastProofMs / 1000).toFixed(1)} s on this device.
      </p>
    )}
    {c.error && (
      <p style={{ margin: 0, fontSize: 13, color: RED, fontWeight: 700 }}>
        {c.error}
      </p>
    )}
  </>
);

export default PrivacyCard;
