import React from "react";
import { useNavigate } from "react-router-dom";
import { useAccount } from "../hooks/useAccount";
import { isPasskeySupported, passkeyErrorMessage } from "../util/passkey";
import "./SignIn.css";

/* ---------------------------------- Theme --------------------------------- */

const INK = "#2B1B3D";
const CREAM = "#FFF4E2";
const RED = "#C8341E";
const GOLD = "#F5B82E";
const BG = "#7FD8D6";

const DISPLAY = "'Shrikhand', Georgia, serif";
const SANS = "'Bricolage Grotesque', 'Helvetica Neue', Arial, sans-serif";

/** Where a signed-in user lands. */
const HOME_ROUTE = "/market";

/* ------------------------------- Illustrations ----------------------------- */

const arc = (r: number) => `M${195 - r} 192 A${r} ${r} 0 0 1 ${195 + r} 192`;

const KeyRainbow: React.FC = () => (
  <svg
    viewBox="0 0 390 196"
    style={{ display: "block", width: "calc(100% + 48px)", margin: "0 -24px" }}
    aria-hidden="true"
  >
    <g fill={CREAM}>
      <circle cx="64" cy="82" r="4" />
      <circle cx="342" cy="118" r="3.5" />
      <path d="M324 56 Q326 68 338 70 Q326 72 324 84 Q322 72 310 70 Q322 68 324 56 Z" />
    </g>
    <g fill="none" strokeWidth="18">
      <path d={arc(129)} stroke={RED} />
      <path d={arc(111)} stroke="#F07C2B" />
      <path d={arc(93)} stroke="#F7A8C8" />
      <path d={arc(75)} stroke="#157A78" />
    </g>
    <path d={`${arc(66)} Z`} fill={CREAM} />
    <g
      transform="translate(156 164) rotate(-16)"
      stroke={INK}
      strokeWidth="3"
      strokeLinejoin="round"
    >
      <path d="M20 -6 H104 V16 H95 V8 H88 V16 H79 V6 H20 Z" fill={GOLD} />
      <circle r="25" fill={GOLD} />
      <circle r="15" fill={CREAM} strokeWidth="2.5" />
      <text
        y="3.5"
        textAnchor="middle"
        fontFamily={DISPLAY}
        fontSize="10"
        fill={RED}
        stroke="none"
      >
        N&amp;R
      </text>
    </g>
  </svg>
);

const Landscape: React.FC = () => (
  <div
    style={{
      position: "relative",
      flexShrink: 0,
      width: "calc(100% + 48px)",
      margin: "auto -24px 0",
    }}
  >
    <svg
      viewBox="0 0 390 150"
      style={{ display: "block", width: "100%", height: "auto" }}
      aria-hidden="true"
    >
      <path
        d="M0 38 C50 14 110 0 180 6 C240 12 300 30 390 2 L390 150 L0 150 Z"
        fill={GOLD}
      />
      <g fill="none" stroke="#E0951F" strokeWidth="2.5" strokeLinecap="round">
        <path d="M20 46 C70 26 120 20 180 28" />
        <path d="M30 60 C80 40 130 34 190 42" />
        <path d="M210 36 C260 44 310 30 380 14" />
        <path d="M214 50 C264 58 314 44 384 28" />
      </g>
      <path
        d="M0 84 C80 66 170 62 250 70 C310 76 350 60 390 54 L390 150 L0 150 Z"
        fill="#7CC36B"
      />
      <g fill="#5BA650">
        <circle cx="40" cy="86" r="3" />
        <circle cx="64" cy="82" r="3" />
        <circle cx="88" cy="79" r="3" />
        <circle cx="112" cy="78" r="3" />
        <circle cx="136" cy="79" r="3" />
        <circle cx="50" cy="98" r="3" />
        <circle cx="76" cy="94" r="3" />
        <circle cx="102" cy="91" r="3" />
        <circle cx="128" cy="91" r="3" />
        <circle cx="154" cy="93" r="3" />
      </g>
      <g fill="#1F5E3A">
        <path d="M262 82 C256 60 260 40 266 26 C272 40 276 60 270 82 Z" />
        <path d="M281 76 C276 58 279 44 284 32 C289 44 292 58 287 76 Z" />
        <path d="M351 66 C346 48 349 32 354 20 C359 32 362 48 357 66 Z" />
      </g>
      <g>
        <rect x="300" y="56" width="34" height="22" fill={CREAM} />
        <path d="M296 58 L317 42 L338 58 Z" fill={RED} />
        <rect x="313" y="66" width="8" height="12" fill={INK} />
      </g>
      <path
        d="M0 106 C80 94 170 98 250 108 C310 116 350 106 390 98 L390 150 L0 150 Z"
        fill="#2E8B57"
      />
      <path
        d="M20 138 C90 124 170 128 240 140 M260 142 C300 146 340 138 380 132"
        fill="none"
        stroke="#24744A"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
    <p
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 14,
        margin: 0,
        textAlign: "center",
        fontSize: 13,
        fontWeight: 700,
        color: CREAM,
      }}
    >
      Your keys stay on this device.
    </p>
  </div>
);

/* ---------------------------------- Icons ---------------------------------- */

const iconProps = {
  width: 22,
  height: 22,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: RED,
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
} as const;

const NoSeedIcon = () => (
  <svg {...iconProps}>
    <rect x="4" y="3" width="16" height="18" rx="1.5" />
    <path d="M8 8h8M8 12h8M8 16h4M3 2l18 20" />
  </svg>
);

const LockIcon = () => (
  <svg {...iconProps}>
    <rect x="5" y="11" width="14" height="10" rx="2.5" />
    <path d="M8 11V8a4 4 0 0 1 8 0v3" />
  </svg>
);

const CheckIcon = () => (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="9.5" />
    <path d="M8 12.5l2.7 2.7L16 9.8" />
  </svg>
);

const FaceIdIcon = () => (
  <svg {...iconProps} width={26} height={26} stroke={CREAM} strokeWidth={1.8}>
    <path d="M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3" />
    <path d="M9 9v1.5M15 9v1.5M12 9v4h-1M9 16c1.6 1.3 4.4 1.3 6 0" />
  </svg>
);

const features: { icon: React.ReactNode; text: string }[] = [
  { icon: <NoSeedIcon />, text: "No seed phrase to write down" },
  { icon: <LockIcon />, text: "No password. Your face is the key" },
  { icon: <CheckIcon />, text: "Network fees handled for you" },
];

/* ---------------------------------- Page ---------------------------------- */

type Busy = "create" | "signin" | null;

const SignIn: React.FC = () => {
  const navigate = useNavigate();
  const account = useAccount();
  const nameRef = React.useRef<HTMLInputElement>(null);
  const [name, setName] = React.useState("");
  const [busy, setBusy] = React.useState<Busy>(null);
  const [error, setError] = React.useState<string | null>(
    !isPasskeySupported()
      ? "This browser doesn't support passkeys. Try Safari or Chrome on your phone."
      : !account.configured
        ? "Accounts are not configured: set PUBLIC_ACCOUNT_WASM_HASH and PUBLIC_WEBAUTHN_VERIFIER_ID."
        : null,
  );

  // Already signed in on this device: skip the page.
  React.useEffect(() => {
    if (account.status === "connected") navigate(HOME_ROUTE, { replace: true });
  }, [account.status, navigate]);

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Add your name so we can put it on your claims.");
      nameRef.current?.focus();
      return;
    }
    setBusy("create");
    setError(null);
    try {
      // Creates the passkey, deploys the smart account through the relayer.
      await account.create(trimmed);
      navigate(HOME_ROUTE);
    } catch (err) {
      setError(passkeyErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const signInWithPasskey = async () => {
    setBusy("signin");
    setError(null);
    try {
      await account.signIn();
      navigate(HOME_ROUTE);
    } catch (err) {
      setError(passkeyErrorMessage(err));
    } finally {
      setBusy(null);
    }
  };

  const disabled =
    busy !== null || !isPasskeySupported() || !account.configured;

  return (
    <div className="signin" style={{ background: BG }}>
      <div
        className="frame"
        style={{
          color: INK,
          fontFamily: SANS,
          padding: "10px 24px 0",
        }}
      >
        <KeyRainbow />

        <div
          style={{
            marginTop: 18,
            fontFamily: DISPLAY,
            fontSize: 21,
            lineHeight: 1,
            color: RED,
            textAlign: "center",
          }}
        >
          Fermentos
          <br />
          Norberto <span style={{ color: INK }}>&amp;</span> Raimunda
        </div>

        <h1
          style={{
            margin: "22px 0 0",
            fontSize: 35,
            lineHeight: 1.05,
            fontWeight: 800,
            letterSpacing: "-0.035em",
            textAlign: "center",
          }}
        >
          Your cellar key
        </h1>
        <p
          style={{
            margin: "12px auto 0",
            maxWidth: 320,
            fontSize: 16,
            lineHeight: 1.4,
            textAlign: "center",
          }}
        >
          Sign in with Face ID and we'll create your private wallet in seconds.
        </p>

        <form
          onSubmit={(e) => void createAccount(e)}
          noValidate
          style={{ display: "flex", flexDirection: "column", marginTop: 16 }}
        >
          <label
            htmlFor="signin-name"
            style={{ fontSize: 16, fontWeight: 800, color: RED }}
          >
            Your name
          </label>
          <input
            id="signin-name"
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="As it should appear on your claims"
            autoComplete="name"
            aria-invalid={!!error && !name.trim()}
            aria-describedby={error ? "signin-error" : undefined}
            style={{
              marginTop: 6,
              padding: "12px 0",
              width: "100%",
              boxSizing: "border-box",
              border: 0,
              borderBottom: `2px solid ${INK}`,
              borderRadius: 0,
              background: "transparent",
              outline: "none",
              color: INK,
              fontFamily: SANS,
              fontSize: 18,
            }}
          />

          <ul
            style={{
              listStyle: "none",
              margin: "20px 0 0",
              padding: 0,
              display: "flex",
              flexDirection: "column",
              gap: 10,
            }}
          >
            {features.map((f) => (
              <li
                key={f.text}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  fontSize: 16,
                }}
              >
                {f.icon}
                {f.text}
              </li>
            ))}
          </ul>

          {error && (
            <p
              id="signin-error"
              role="alert"
              style={{
                margin: "20px 0 0",
                fontSize: 14,
                fontWeight: 700,
                color: RED,
              }}
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            className="signin-primary"
            disabled={disabled}
            style={{
              marginTop: 18,
              height: 56,
              borderRadius: 28,
              border: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 12,
              background: INK,
              color: CREAM,
              fontFamily: SANS,
              fontSize: 18,
              fontWeight: 800,
              cursor: disabled ? "default" : "pointer",
              opacity: disabled ? 0.7 : 1,
            }}
          >
            <FaceIdIcon />
            {busy === "create" ? "Creating your key…" : "Continue with Face ID"}
          </button>
        </form>

        <button
          type="button"
          className="signin-link"
          onClick={() => void signInWithPasskey()}
          disabled={disabled}
          style={{
            alignSelf: "center",
            marginTop: 12,
            padding: 4,
            border: 0,
            background: "transparent",
            color: INK,
            fontFamily: SANS,
            fontSize: 15,
            fontWeight: 800,
            textDecoration: "underline",
            textUnderlineOffset: 3,
            cursor: disabled ? "default" : "pointer",
          }}
        >
          {busy === "signin"
            ? "Checking your passkey…"
            : "I already have a passkey"}
        </button>

        <Landscape />
      </div>
    </div>
  );
};

export default SignIn;
