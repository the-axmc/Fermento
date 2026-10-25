import React from "react";
import PageHeader from "../components/PageHeader";
import Landscape from "../components/Landscape";
import {
  CONFIDENTIAL_AUDITOR,
  CONFIDENTIAL_VERIFIER,
  confidentialConfigured,
  proveRegister,
} from "../lib/confidential";
import {
  BG,
  CREAM,
  INK,
  INK_SOFT,
  MONO,
  RED,
  SANS,
  TEAL_DARK,
  bigButton,
} from "../lib/theme";

/**
 * Can this device generate privacy proofs? Runs the registration circuit for
 * throwaway keys against a dummy wrapper address and reports the time. Also
 * the page a headless browser hits to confirm the proving stack loads.
 */
const PrivacyCheck: React.FC = () => {
  const [log, setLog] = React.useState<string[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<"ok" | "fail" | null>(null);
  const auto = new URLSearchParams(window.location.search).get("run") === "1";

  const add = (s: string) => setLog((l) => [...l, s]);

  const run = React.useCallback(async () => {
    setBusy(true);
    setResult(null);
    setLog([]);
    add(
      `cross-origin isolated: ${String(crossOriginIsolated)} (threads ${crossOriginIsolated ? "on" : "off"})`,
    );
    add(`hardware threads: ${navigator.hardwareConcurrency}`);
    try {
      const sdk = await import("stellar-confidential-token-sdk");
      // Throwaway keys bound to a dummy wrapper and account.
      const contract =
        "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD";
      const account =
        "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
      const keys = sdk.deriveKeys(
        sdk.randomScalar(),
        sdk.addressToField(contract),
        sdk.addressToField(account),
      );
      add("keys derived; loading the register circuit and the prover…");
      const t0 = performance.now();
      const { payload, ms } = await proveRegister(keys);
      add(
        `proof generated in ${(ms / 1000).toFixed(1)} s (${payload.length} bytes payload, ${((performance.now() - t0) / 1000).toFixed(1)} s with loading)`,
      );
      setResult("ok");
    } catch (e) {
      add(`failed: ${e instanceof Error ? e.message : String(e)}`);
      setResult("fail");
    } finally {
      setBusy(false);
    }
  }, []);

  // StrictMode mounts twice in development; prove once.
  const started = React.useRef(false);
  React.useEffect(() => {
    if (auto && !started.current) {
      started.current = true;
      void run();
    }
  }, [auto, run]);

  return (
    <div style={{ background: BG, color: INK, fontFamily: SANS }}>
      <div className="frame" style={{ gap: 16, padding: "18px 24px 0" }}>
        <PageHeader back="/wallet" backLabel="Back to the wallet" />
        <h1
          style={{
            margin: 0,
            fontWeight: 800,
            fontSize: 34,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          Privacy check
        </h1>
        <p
          style={{ margin: 0, fontSize: 16, lineHeight: 1.45, color: INK_SOFT }}
        >
          Private shares need this phone to generate a zero-knowledge proof.
          This runs one for real, without touching your account.
        </p>
        <div
          style={{
            fontFamily: MONO,
            fontSize: 12,
            color: INK_SOFT,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          <span>
            verifier{" "}
            {CONFIDENTIAL_VERIFIER
              ? `${CONFIDENTIAL_VERIFIER.slice(0, 6)}…`
              : "not configured"}
          </span>
          <span>
            auditor{" "}
            {CONFIDENTIAL_AUDITOR
              ? `${CONFIDENTIAL_AUDITOR.slice(0, 6)}…`
              : "not configured"}
          </span>
        </div>
        <button
          type="button"
          disabled={busy || !confidentialConfigured()}
          onClick={() => void run()}
          style={{ ...bigButton(RED), opacity: busy ? 0.6 : 1 }}
        >
          {busy ? "Proving…" : "Generate a test proof"}
        </button>
        <pre
          id="privacy-check-log"
          data-result={result ?? "pending"}
          style={{
            margin: 0,
            padding: 14,
            borderRadius: 16,
            background: CREAM,
            fontFamily: MONO,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: "pre-wrap",
            minHeight: 80,
            color: result === "fail" ? RED : result === "ok" ? TEAL_DARK : INK,
          }}
        >
          {log.length ? log.join("\n") : "Nothing run yet."}
        </pre>
        <Landscape />
      </div>
    </div>
  );
};

export default PrivacyCheck;
