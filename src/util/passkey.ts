/**
 * Passkey (WebAuthn) helpers for the sign-in page.
 *
 * These only create and assert the device credential. Deploying the
 * OpenZeppelin smart account the passkey controls belongs to
 * packages/embedded-wallet (BUILD_PLAN.md, block 1).
 */

const RP_NAME = "Fermentos Norberto & Raimunda";
/** ES256 = secp256r1, the curve the Stellar passkey verifier checks. */
const ES256 = -7;

export interface Passkey {
  id: string;
  /** SPKI public key, base64url. Only known when the passkey is created here. */
  publicKey?: string;
  name?: string;
}

const randomBytes = (n: number) => crypto.getRandomValues(new Uint8Array(n));

const toBase64Url = (buf: ArrayBuffer): string =>
  btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export const isPasskeySupported = () =>
  typeof window !== "undefined" && !!window.PublicKeyCredential;

/**
 * True when the page runs inside another page (an iframe or an in-app
 * preview). Browsers refuse WebAuthn there unless the parent delegates the
 * `publickey-credentials-*` permissions, which previews never do.
 */
export const isEmbedded = () => {
  if (typeof window === "undefined") return false;
  try {
    return window.top !== window.self;
  } catch {
    return true; // Cross-origin parent: definitely framed.
  }
};

export const createPasskey = async (name: string): Promise<Passkey> => {
  const credential = await navigator.credentials.create({
    publicKey: {
      rp: { name: RP_NAME, id: window.location.hostname },
      user: { id: randomBytes(16), name, displayName: name },
      challenge: randomBytes(32),
      pubKeyCredParams: [{ type: "public-key", alg: ES256 }],
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
      },
      attestation: "none",
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("No passkey was created.");
  }

  const response = credential.response as AuthenticatorAttestationResponse;
  const publicKey = response.getPublicKey();
  return {
    id: credential.id,
    publicKey: publicKey ? toBase64Url(publicKey) : undefined,
    name,
  };
};

export const getPasskey = async (): Promise<Passkey> => {
  const credential = await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      rpId: window.location.hostname,
      userVerification: "required",
    },
  });
  if (!(credential instanceof PublicKeyCredential)) {
    throw new Error("No passkey was selected.");
  }
  return { id: credential.id };
};

/* ------------------------------ Error mapping ------------------------------ */

/** The DOMException names navigator.credentials.create/get can reject with. */
const WEBAUTHN_ERROR_NAMES = new Set([
  "AbortError",
  "ConstraintError",
  "InvalidStateError",
  "NotAllowedError",
  "NotSupportedError",
  "SecurityError",
  "UnknownError",
]);

/**
 * The WebAuthn error name behind `e`, or undefined when `e` is not a passkey
 * error. smart-account-kit (via @simplewebauthn/browser) rethrows the
 * browser's DOMException as a plain `WebAuthnError` that copies the name and
 * keeps the original in `cause`, so an `instanceof DOMException` check never
 * matches; look at the name on the error and on its cause instead.
 */
export const webAuthnErrorName = (e: unknown): string | undefined => {
  let current: unknown = e;
  for (let depth = 0; depth < 4 && current instanceof Error; depth++) {
    if (WEBAUTHN_ERROR_NAMES.has(current.name)) return current.name;
    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
};

export const isPasskeyError = (e: unknown) =>
  webAuthnErrorName(e) !== undefined;

/** What the user did when the prompt was for. */
export type PasskeyStep = "create" | "signin" | "sign";

/**
 * A short, actionable message for a passkey failure. NotAllowedError is the
 * browser's catch-all: it covers a dismissed prompt, the 60 s timeout, a
 * prompt in a page without focus, a second prompt while one is open, and a
 * passkey that isn't on this device. Chrome's text for all of them is "The
 * request is not allowed by the user agent or the platform in the current
 * context, possibly because the user denied permission", which helps nobody.
 */
export const passkeyErrorMessage = (
  e: unknown,
  step: PasskeyStep = "signin",
): string => {
  switch (webAuthnErrorName(e)) {
    case "NotAllowedError":
    case "AbortError":
      if (isEmbedded()) {
        return "Passkeys can't run inside an embedded preview. Open the site in Safari or Chrome and try again.";
      }
      if (step === "sign") {
        return "The passkey prompt was closed before it finished. Try again and approve it. If this passkey lives on another device, sign out and sign in again with a passkey from this one.";
      }
      if (step === "create") {
        return "The passkey wasn't created: the prompt was closed, timed out, or this device has no Face ID, Touch ID or screen lock set up. Try again, or use a phone.";
      }
      return "The passkey prompt was closed before it finished. Try again, or create a new account if you have no passkey on this device.";
    case "SecurityError":
      return "Passkeys need a secure connection (https or localhost).";
    case "InvalidStateError":
      return "This device already has a passkey for this site. Tap “I already have a passkey” instead.";
    case "NotSupportedError":
    case "ConstraintError":
      return "This device can't create the kind of passkey we need. Try Safari or Chrome on your phone.";
    case "UnknownError":
      return "The passkey prompt failed on this device. Try again in a moment.";
  }
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
};
