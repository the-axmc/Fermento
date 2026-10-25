import React from "react";
import { Link, useParams } from "react-router-dom";
import type { UnitClaim } from "batch_registry_contract";
import { REGISTRY_ID, getRegistry } from "../contracts/client";
import { findBatch } from "../data/batches";
import { shortAddress } from "../lib/format";

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
 * registry and shows who may collect what.
 */
const Claim: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const claimId = Number(id);
  const [claim, setClaim] = React.useState<UnitClaim | null | undefined>();

  React.useEffect(() => {
    if (!REGISTRY_ID || !Number.isInteger(claimId)) {
      setClaim(null);
      return;
    }
    getRegistry()
      .get_claim({ claim_id: claimId })
      .then((tx) => setClaim(tx.result))
      .catch(() => setClaim(null));
  }, [claimId]);

  const info = claim ? findBatch(claim.batch_id) : undefined;
  const valid = !!claim;

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
