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

export const passkeyErrorMessage = (e: unknown): string => {
  if (e instanceof DOMException) {
    switch (e.name) {
      case "NotAllowedError":
        return "Face ID was cancelled. Try again when you're ready.";
      case "SecurityError":
        return "Passkeys need a secure connection (https or localhost).";
    }
  }
  return e instanceof Error ? e.message : "Something went wrong. Try again.";
};
