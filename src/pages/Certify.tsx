import React from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "../components/PageHeader";
import type { Certification } from "../data/producers";
import { useAccount } from "../hooks/useAccount";
import { applyForCertification, useProducer } from "../hooks/useProducer";
import {
  BG,
  CREAM,
  INK,
  INK_SOFT,
  RED,
  SANS,
  TEAL,
  YELLOW,
  bigButton,
  fieldInput,
  fieldLabel,
} from "../lib/theme";

const MAX_LOGO = 300_000;
const MAX_DOC = 4 * 1024 * 1024;

const readAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(typeof r.result === "string" ? r.result : "");
    r.onerror = () => reject(new Error("Could not read the file."));
    r.readAsDataURL(file);
  });

const Field: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div
    style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 0 }}
  >
    <span style={fieldLabel}>{title}</span>
    {children}
  </div>
);

const Badge: React.FC = () => (
  <span
    style={{
      position: "relative",
      width: 128,
      height: 128,
      marginTop: -64,
      alignSelf: "center",
      borderRadius: "50%",
      background: TEAL,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden="true">
      <path
        d="M32 4l6 5 8-1 3 7 7 3-1 8 5 6-5 6 1 8-7 3-3 7-8-1-6 5-6-5-8 1-3-7-7-3 1-8-5-6 5-6-1-8 7-3 3-7 8 1z"
        fill={YELLOW}
        stroke={INK}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        d="M21 33l8 8 15-16"
        fill="none"
        stroke={INK}
        strokeWidth="5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

/** Rainbow arcs behind the badge, as on the "Add a ferment" page. */
const Arcs: React.FC = () => (
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
      <path d="M-14 160 A209 209 0 0 1 404 160" stroke="#B8A26A" />
      <path d="M12 160 A183 183 0 0 1 378 160" stroke="#C9C3C8" />
    </g>
  </svg>
);

const Step: React.FC<{
  state: "done" | "now" | "later";
  title: string;
  text: string;
}> = ({ state, title, text }) => (
  <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
    <span
      style={{
        width: 40,
        height: 40,
        flexShrink: 0,
        borderRadius: "50%",
        background:
          state === "done" ? TEAL : state === "now" ? YELLOW : "transparent",
        border: state === "later" ? `2px dashed ${INK_SOFT}` : 0,
        boxSizing: "border-box",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {state === "done" && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={CREAM}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M5 12l5 5 9-10" />
        </svg>
      )}
      {state === "now" && (
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke={INK}
          strokeWidth="2.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l3 2" />
        </svg>
      )}
    </span>
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      <span style={{ fontWeight: 800, fontSize: 18 }}>{title}</span>
      <span style={{ fontSize: 14, color: INK_SOFT, lineHeight: 1.35 }}>
        {text}
      </span>
    </div>
  </div>
);

const Status: React.FC<{
  certification: Certification;
  certified: boolean;
}> = ({ certification, certified }) => {
  const rejected = certification.status === "rejected";
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 22,
        marginTop: 8,
      }}
    >
      <Step
        state="done"
        title="Application sent"
        text={new Date(certification.submittedAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}
      />
      <Step
        state={certified || rejected ? "done" : "now"}
        title={
          rejected ? "We could not verify the company" : "We check your company"
        }
        text={
          rejected
            ? "Something in the application did not match a registered business. Apply again with the official extract."
            : certified
              ? "Verified as a registered company."
              : "Usually a few working days. We may email you for more documents."
        }
      />
      <Step
        state={certified ? "done" : "later"}
        title="Certified"
        text={
          certified
            ? "Your logo and badge are live on your page and products, and your rating on chain lifts every batch you produce."
            : "Your logo and badge go live on your page and products"
        }
      />
    </div>
  );
};

/* ---------------------------------- Page ----------------------------------- */

const Certify: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const { producer, rating, loading, refresh } = useProducer(account.address);
  const [legalName, setLegalName] = React.useState("");
  const [vat, setVat] = React.useState("");
  const [country, setCountry] = React.useState("Portugal");
  const [website, setWebsite] = React.useState("");
  const [logo, setLogo] = React.useState<string | null>(null);
  const [doc, setDoc] = React.useState<{ name: string; base64: string } | null>(
    null,
  );
  const [agree, setAgree] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [sent, setSent] = React.useState(false);

  const certified = producer?.tier === "certified" || !!rating?.certified;
  const certification = producer?.certification;
  const showStatus =
    sent || certified || (certification && certification.status !== "rejected");

  const pickLogo = async (file: File | undefined) => {
    if (!file) return;
    if (!["image/png", "image/svg+xml"].includes(file.type)) {
      setError("The logo must be a PNG or SVG.");
      return;
    }
    if (file.size > MAX_LOGO) {
      setError("The logo must be under 300 KB.");
      return;
    }
    setError(null);
    setLogo(await readAsDataUrl(file));
  };

  const pickDoc = async (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("The registration must be a PDF.");
      return;
    }
    if (file.size > MAX_DOC) {
      setError("The document must be under 4 MB.");
      return;
    }
    setError(null);
    const url = await readAsDataUrl(file);
    setDoc({ name: file.name, base64: url.split(",")[1] ?? "" });
  };

  const ready =
    legalName.trim() && vat.trim() && country.trim() && logo && doc && agree;

  const submit = async () => {
    if (!account.address) {
      navigate("/signin");
      return;
    }
    if (!ready || !logo || !doc) return;
    setBusy(true);
    setError(null);
    try {
      await applyForCertification({
        address: account.address,
        legalName,
        vatNumber: vat,
        country,
        website,
        logo,
        document: doc.base64,
        documentName: doc.name,
      });
      setSent(true);
      refresh();
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
        <Arcs />
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
          <Badge />
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
              Become a certified producer
            </h1>
            <p
              style={{
                margin: "10px 0 0",
                fontSize: 17,
                lineHeight: 1.35,
                color: INK_SOFT,
              }}
            >
              For wineries, breweries and other registered companies. We check
              that you're a real business before you get the badge.
            </p>
          </div>

          {!account.address && !loading && (
            <p style={{ margin: 0, textAlign: "center", fontSize: 15 }}>
              <Link to="/signin" style={{ color: RED, fontWeight: 800 }}>
                Sign in
              </Link>{" "}
              with your passkey first. The badge is tied to your account.
            </p>
          )}

          {showStatus && certification ? (
            <>
              <Status certification={certification} certified={certified} />
              <Link
                to="/producer/me"
                style={{ ...bigButton(), height: 60, marginTop: 8 }}
              >
                Back to your page
              </Link>
            </>
          ) : showStatus && sent ? (
            <>
              <Status
                certification={{
                  id: "",
                  status: "pending",
                  legalName,
                  country,
                  submittedAt: new Date().toISOString(),
                }}
                certified={false}
              />
              <Link
                to="/producer/me"
                style={{ ...bigButton(), height: 60, marginTop: 8 }}
              >
                Back to your page
              </Link>
            </>
          ) : (
            <>
              <Field title="Company legal name">
                <input
                  value={legalName}
                  onChange={(e) => setLegalName(e.target.value)}
                  placeholder="As on your registration"
                  style={fieldInput}
                />
              </Field>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 24,
                }}
              >
                <Field title="VAT / company Nº">
                  <input
                    value={vat}
                    onChange={(e) => setVat(e.target.value)}
                    placeholder="PT 123 456 789"
                    style={{
                      ...fieldInput,
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 17,
                    }}
                  />
                </Field>
                <Field title="Country">
                  <input
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    placeholder="Portugal"
                    style={fieldInput}
                  />
                </Field>
              </div>
              <Field title="Website">
                <input
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                  placeholder="quinta-exemplo.pt"
                  inputMode="url"
                  autoCapitalize="none"
                  style={fieldInput}
                />
              </Field>

              <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
                <label
                  style={{
                    width: 140,
                    height: 140,
                    flexShrink: 0,
                    borderRadius: "50%",
                    border: `2px dashed ${RED}`,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    color: RED,
                    fontWeight: 800,
                    fontSize: 15,
                    cursor: "pointer",
                    overflow: "hidden",
                  }}
                >
                  {logo ? (
                    <img
                      src={logo}
                      alt="Your logo"
                      style={{ width: 136, height: 136, objectFit: "cover" }}
                    />
                  ) : (
                    <>
                      <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={RED}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M12 16V4M6 10l6-6 6 6M4 20h16" />
                      </svg>
                      Your logo
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/png,image/svg+xml"
                    onChange={(e) => void pickLogo(e.target.files?.[0])}
                    style={{ display: "none" }}
                  />
                </label>
                <div
                  style={{ display: "flex", flexDirection: "column", gap: 4 }}
                >
                  <span style={fieldLabel}>Logo</span>
                  <span
                    style={{ fontSize: 15, lineHeight: 1.4, color: INK_SOFT }}
                  >
                    Square SVG or PNG. Shown on your page and every product once
                    you're certified.
                  </span>
                </div>
              </div>

              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 0",
                  borderTop: `1.5px solid rgba(43, 27, 61, 0.22)`,
                  borderBottom: `1.5px solid rgba(43, 27, 61, 0.22)`,
                  cursor: "pointer",
                }}
              >
                <svg
                  width="30"
                  height="30"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={RED}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M6 2h8l5 5v15H6z" />
                  <path d="M14 2v5h5M9 13h6M9 17h6" />
                </svg>
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: 2,
                  }}
                >
                  <span style={{ fontWeight: 800, fontSize: 18 }}>
                    Business registration
                  </span>
                  <span style={{ fontSize: 13, color: INK_SOFT }}>
                    {doc ? doc.name : "Certificate or official extract, PDF"}
                  </span>
                </div>
                <span style={{ color: RED, fontWeight: 800, fontSize: 17 }}>
                  {doc ? "Change" : "Upload"}
                </span>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => void pickDoc(e.target.files?.[0])}
                  style={{ display: "none" }}
                />
              </label>

              <label
                style={{
                  display: "flex",
                  gap: 12,
                  alignItems: "flex-start",
                  fontSize: 15,
                  lineHeight: 1.4,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={agree}
                  onChange={(e) => setAgree(e.target.checked)}
                  style={{
                    width: 24,
                    height: 24,
                    marginTop: 2,
                    accentColor: INK,
                  }}
                />
                I represent this company and can share its documents for review.
              </label>

              {error && (
                <p
                  role="alert"
                  style={{
                    margin: 0,
                    fontSize: 14,
                    color: RED,
                    fontWeight: 700,
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="button"
                disabled={!ready || busy}
                onClick={() => void submit()}
                style={{
                  ...bigButton(
                    ready ? INK : "rgba(43, 27, 61, 0.22)",
                    ready ? CREAM : INK,
                  ),
                  height: 60,
                  cursor: ready ? "pointer" : "default",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? "Sending…" : "Send application"}
              </button>
              <Link
                to="/producer/me"
                style={{
                  marginTop: -8,
                  textAlign: "center",
                  fontWeight: 800,
                  fontSize: 16,
                  color: INK,
                  textDecoration: "none",
                }}
              >
                Stay amateur for now
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Certify;
