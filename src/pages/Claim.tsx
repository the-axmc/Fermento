import React from "react";
import { Link, useParams } from "react-router-dom";
import type { UnitClaim } from "batch_registry_contract";
import type { ClaimEscrow } from "batch_shares_contract";
import {
  REGISTRY_ID,
  SHARES_ID,
  getRegistry,
  getShares,
} from "../contracts/client";
import { useAccount } from "../hooks/useAccount";
import { useCatalogue } from "../hooks/useCatalogue";
import { recordActivity } from "../lib/activity";
import { money, shortAddress } from "../lib/format";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const INK_SOFT = "#3F2F4A";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const TEAL = "#157A78";
const BG = "#7FD8D6";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";
const MONO = "'Space Mono', monospace";

/**
 * Warehouse page: the QR code on a unit points here. Reads the claim from the
 * registry and shows who may collect what. The holder confirms the handover
 * here, which pays the producer what the contract still held for the claim;
 * if the batch failed inspection instead, the holder takes that money back.
 */
const Claim: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const claimId = Number(id);
  const [claim, setClaim] = React.useState<UnitClaim | null | undefined>();
  const [held, setHeld] = React.useState<ClaimEscrow | undefined>();
  const [failed, setFailed] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tick, setTick] = React.useState(0);
  const account = useAccount();

  React.useEffect(() => {
    if (!REGISTRY_ID || !Number.isInteger(claimId)) {
      setClaim(null);
      return;
    }
    getRegistry()
      .get_claim({ claim_id: claimId })
      .then((tx) => setClaim(tx.result))
      .catch(() => setClaim(null));
    if (!SHARES_ID) return;
    // Claims made before escrow existed hold nothing.
    getShares()
      .claim_escrow({ claim_id: claimId })
      .then((tx) => setHeld(tx.result ?? undefined))
      .catch(() => setHeld(undefined));
  }, [claimId, tick]);

  React.useEffect(() => {
    if (!SHARES_ID || !claim) return;
    getShares()
      .escrow({ batch_id: claim.batch_id })
      .then((tx) => setFailed(!!tx.result?.defaulted))
      .catch(() => setFailed(false));
  }, [claim, tick]);

  const catalogue = useCatalogue();
  const info = claim
    ? catalogue.find((b) => b.batchId === claim.batch_id)
    : undefined;
  const valid = !!claim;
  const holder = !!claim && account.address === claim.claimer;
  const open = !!held && !held.settled;

  /** Holder: confirm the handover, or take the money back after a failure. */
  const settle = async () => {
    if (!account.address || !claim || !held) return;
    setBusy(true);
    setError(null);
    try {
      const tx = failed
        ? await getShares().refund_claim({ claim_id: claimId })
        : await getShares().confirm_collection({
            claim_id: claimId,
            caller: account.address,
          });
      await account.submit(tx);
      recordActivity(account.address, {
        kind: "redeem",
        title: failed
          ? `Refund · claim Nº ${claimId}`
          : `Collected · claim Nº ${claimId}`,
        batchId: claim.batch_id,
        amount: failed ? held.amount : 0n,
      });
      setTick((t) => t + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const row: React.CSSProperties = {
    display: "flex",
    justifyContent: "space-between",
    gap: 16,
    padding: "10px 0",
    borderBottom: "1.5px solid rgba(43, 27, 61, 0.22)",
    fontSize: 15,
  };

  return (
    <div style={{ background: BG, minHeight: "100dvh" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 390,
          margin: "0 auto",
          boxSizing: "border-box",
          padding: "32px 24px",
          color: INK,
          fontFamily: SANS,
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <span
          style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em" }}
        >
          FERMENTO · CLAIM Nº {Number.isInteger(claimId) ? claimId : "?"}
        </span>

        {claim === undefined && (
          <p style={{ margin: 0 }}>Checking the registry…</p>
        )}

        {claim !== undefined && (
          <div
            style={{
              borderRadius: 24,
              background: valid ? TEAL : RED,
              color: CREAM,
              padding: "22px 20px",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            <span
              style={{
                fontSize: 13,
                textTransform: "uppercase",
                fontFamily: MONO,
              }}
            >
              {valid ? "Valid claim" : "Not found"}
            </span>
            <span style={{ fontWeight: 800, fontSize: 30, lineHeight: 1 }}>
              {valid
                ? `${claim.units} ${info?.unit ?? "unit"}${claim.units === 1 ? "" : "s"}`
                : "No such claim"}
            </span>
            {valid && (
              <span style={{ fontSize: 15 }}>
                {info?.name ?? `Batch ${claim.batch_id}`} · {info?.label ?? ""}
              </span>
            )}
          </div>
        )}

        {claim && (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={row}>
              <span style={{ color: INK_SOFT }}>Batch</span>
              <span style={{ fontWeight: 700 }}>{claim.batch_id}</span>
            </div>
            <div style={row}>
              <span style={{ color: INK_SOFT }}>Claimed by</span>
              <span style={{ fontFamily: MONO }} title={claim.claimer}>
                {shortAddress(claim.claimer, 6)}
              </span>
            </div>
            <div style={row}>
              <span style={{ color: INK_SOFT }}>Recorded at ledger</span>
              <span style={{ fontFamily: MONO }}>{claim.ledger}</span>
            </div>
            {held && (
              <div style={row}>
                <span style={{ color: INK_SOFT }}>
                  {failed ? "Held for the holder" : "Held for the producer"}
                </span>
                <span style={{ fontWeight: 700 }}>
                  {held.settled
                    ? `${money(held.amount)} · settled`
                    : `${money(held.amount)} · until collected`}
                </span>
              </div>
            )}
            {open && holder && (
              <button
                type="button"
                disabled={busy}
                onClick={() => void settle()}
                style={{
                  marginTop: 14,
                  height: 52,
                  border: 0,
                  borderRadius: 26,
                  background: failed ? RED : INK,
                  color: CREAM,
                  fontFamily: SANS,
                  fontSize: 16,
                  fontWeight: 800,
                  cursor: busy ? "default" : "pointer",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy
                  ? "Signing…"
                  : failed
                    ? `Take back ${money(held.amount)}`
                    : `I have my ${info?.unit ?? "unit"} · pay the producer`}
              </button>
            )}
            {open && !holder && !failed && (
              <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.4 }}>
                The producer receives the last {money(held.amount)} once the
                holder confirms the handover on this page.
              </p>
            )}
            {error && (
              <p style={{ margin: "10px 0 0", fontSize: 14, color: RED }}>
                {error}
              </p>
            )}
            <a
              href={`https://stellar.expert/explorer/testnet/contract/${REGISTRY_ID}`}
              target="_blank"
              rel="noreferrer"
              style={{
                marginTop: 12,
                fontSize: 14,
                fontWeight: 700,
                color: INK,
              }}
            >
              Registry contract on the explorer
            </a>
          </div>
        )}

        <Link
          to="/market"
          style={{ fontSize: 14, fontWeight: 700, color: INK }}
        >
          Back to the market
        </Link>
      </div>
    </div>
  );
};

export default Claim;
