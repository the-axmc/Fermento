/**
 * Card and bank top-ups through a Stellar anchor.
 *
 * The anchor (PUBLIC_ANCHOR_DOMAIN, the SDF test anchor by default) takes the
 * card or bank payment in its own hosted page and sends the stablecoin to the
 * user's smart account. Three standards are involved:
 *
 *   SEP-1   the anchor's stellar.toml says where everything is
 *   SEP-45  sign-in for contract accounts (C...): the anchor sends a challenge
 *           as Soroban authorization entries, the passkey signs ours, and the
 *           anchor answers with a session token (JWT)
 *   SEP-24  hosted deposit: the anchor returns a URL for its own payment and
 *           KYC pages; we poll the transaction until the funds arrive
 *
 * Anchors that only offer SEP-10 (sign-in for classic G accounts) cannot sign
 * in a passkey account and are reported as unsupported.
 */

import { Buffer } from "buffer";
import {
  Address,
  Keypair,
  StellarToml,
  hash,
  scValToNative,
  xdr,
} from "@stellar/stellar-sdk";
import { networkPassphrase } from "../contracts/util";
import { getKit } from "../wallet/kit";

export const ANCHOR_DOMAIN: string =
  import.meta.env.PUBLIC_ANCHOR_DOMAIN ?? "testanchor.stellar.org";

export interface Anchor {
  domain: string;
  /** The anchor's server account; it co-signs every challenge. */
  signingKey: string;
  /** SEP-45 endpoint and the contract the challenge invokes. */
  authEndpoint: string;
  authContract: string;
  /** SEP-24 transfer server. */
  transferServer: string;
}

export interface DepositLimits {
  enabled: boolean;
  min_amount?: number;
  max_amount?: number;
}

/** SEP-24 transaction, as much of it as the app shows. */
export interface AnchorTransaction {
  id: string;
  status: string;
  amount_in?: string;
  amount_out?: string;
  amount_fee?: string;
  message?: string;
  more_info_url?: string;
  stellar_transaction_id?: string;
}

/** Statuses after which the anchor will not move the deposit any further. */
export const FINAL_STATUSES = [
  "completed",
  "refunded",
  "expired",
  "error",
  "no_market",
  "too_small",
  "too_large",
];

/* ---------------------------------- SEP-1 --------------------------------- */

let anchor: Promise<Anchor> | undefined;

export const loadAnchor = (): Promise<Anchor> => {
  anchor ??= (async () => {
    const toml = (await StellarToml.Resolver.resolve(ANCHOR_DOMAIN)) as Record<
      string,
      unknown
    >;
    const str = (k: string) => (typeof toml[k] === "string" ? toml[k] : "");
    if (
      str("NETWORK_PASSPHRASE") &&
      str("NETWORK_PASSPHRASE") !== networkPassphrase
    )
      throw new Error(`${ANCHOR_DOMAIN} runs on another Stellar network.`);
    if (!str("WEB_AUTH_FOR_CONTRACTS_ENDPOINT") || !str("WEB_AUTH_CONTRACT_ID"))
      throw new Error(
        `${ANCHOR_DOMAIN} cannot sign in passkey accounts yet (it has no SEP-45).`,
      );
    if (!str("TRANSFER_SERVER_SEP0024"))
      throw new Error(`${ANCHOR_DOMAIN} offers no hosted deposits (SEP-24).`);
    return {
      domain: ANCHOR_DOMAIN,
      signingKey: str("SIGNING_KEY"),
      authEndpoint: str("WEB_AUTH_FOR_CONTRACTS_ENDPOINT"),
      authContract: str("WEB_AUTH_CONTRACT_ID"),
      transferServer: str("TRANSFER_SERVER_SEP0024"),
    };
  })().catch((err: unknown) => {
    anchor = undefined;
    throw err;
  });
  return anchor;
};

/* ---------------------------------- SEP-45 -------------------------------- */

const readJson = async <T>(res: Response): Promise<T> => {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Anchor answered ${res.status}`);
  return body;
};

/** XDR `SorobanAuthorizationEntries`: a 4-byte count, then the entries. */
export const decodeEntries = (b64: string): xdr.SorobanAuthorizationEntry[] =>
  (
    xdr as unknown as {
      SorobanAuthorizationEntries: {
        fromXDR: (s: string, f: "base64") => xdr.SorobanAuthorizationEntry[];
      };
    }
  ).SorobanAuthorizationEntries.fromXDR(b64, "base64");

export const encodeEntries = (entries: xdr.SorobanAuthorizationEntry[]) => {
  const count = Buffer.alloc(4);
  count.writeUInt32BE(entries.length);
  return Buffer.concat([count, ...entries.map((e) => e.toXDR())]).toString(
    "base64",
  );
};

/** True when `entry` carries a valid ed25519 signature by `signer` (G...). */
const signedBy = (entry: xdr.SorobanAuthorizationEntry, signer: string) => {
  const creds = entry.credentials().address();
  const digest = hash(
    xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
      new xdr.HashIdPreimageSorobanAuthorization({
        networkId: hash(Buffer.from(networkPassphrase)),
        nonce: creds.nonce(),
        signatureExpirationLedger: creds.signatureExpirationLedger(),
        invocation: entry.rootInvocation(),
      }),
    ).toXDR(),
  );
  const key = Keypair.fromPublicKey(signer);
  const sigs = (scValToNative(creds.signature()) ?? []) as {
    public_key: Uint8Array;
    signature: Uint8Array;
  }[];
  return sigs.some(
    (s) =>
      Buffer.from(s.public_key).equals(key.rawPublicKey()) &&
      key.verify(digest, Buffer.from(s.signature)),
  );
};

/**
 * Check every entry of a challenge before signing anything: it may only call
 * `web_auth_verify` on the anchor's auth contract, with our account and the
 * anchor's domains, and the anchor must have signed its own entry. Returns
 * the index of the entry our account has to sign.
 */
const checkChallenge = (
  entries: xdr.SorobanAuthorizationEntry[],
  a: Anchor,
  account: string,
) => {
  const webAuthDomain = new URL(a.authEndpoint).host;
  let nonce: string | undefined;
  let ours: number | undefined;
  let serverSigned = false;
  entries.forEach((entry, i) => {
    const invocation = entry.rootInvocation();
    if (invocation.subInvocations().length > 0)
      throw new Error("Challenge has sub-invocations");
    const fn = invocation.function().contractFn();
    if (
      Address.fromScAddress(fn.contractAddress()).toString() !== a.authContract
    )
      throw new Error("Challenge targets an unexpected contract");
    if (fn.functionName().toString() !== "web_auth_verify")
      throw new Error("Challenge calls an unexpected function");
    const args = scValToNative(fn.args()[0]) as Record<string, string>;
    if (
      args.account !== account ||
      args.home_domain !== a.domain ||
      args.web_auth_domain !== webAuthDomain ||
      args.web_auth_domain_account !== a.signingKey ||
      (nonce !== undefined && args.nonce !== nonce)
    )
      throw new Error("Challenge arguments do not match this anchor");
    nonce = args.nonce;

    const creds = entry.credentials();
    if (
      creds.switch() !== xdr.SorobanCredentialsType.sorobanCredentialsAddress()
    )
      throw new Error("Challenge entry without an address");
    const who = Address.fromScAddress(creds.address().address()).toString();
    if (who === a.signingKey) serverSigned = signedBy(entry, a.signingKey);
    else if (who === account) ours = i;
    else throw new Error("Challenge asks for an unexpected signer");
  });
  if (!serverSigned) throw new Error("Challenge is not signed by the anchor");
  if (ours === undefined) throw new Error("Challenge has no entry to sign");
  return ours;
};

const sessions = new Map<string, { token: string; exp: number }>();

const jwtExpiry = (token: string) => {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return (JSON.parse(atob(payload)) as { exp?: number }).exp ?? 0;
  } catch {
    return 0;
  }
};

/** Sign the smart account in to the anchor; one passkey prompt per session. */
export const signIn = async (account: string): Promise<string> => {
  const cached = sessions.get(account);
  if (cached && cached.exp > Date.now() / 1000 + 60) return cached.token;

  const a = await loadAnchor();
  const url = new URL(a.authEndpoint);
  url.searchParams.set("account", account);
  url.searchParams.set("home_domain", a.domain);
  // The Anchor Platform answers in camelCase; the SEP text uses snake_case.
  const challenge = await readJson<{
    authorization_entries?: string;
    authorizationEntries?: string;
    network_passphrase?: string;
    networkPassphrase?: string;
  }>(await fetch(url));
  const passphrase =
    challenge.network_passphrase ?? challenge.networkPassphrase;
  if (passphrase && passphrase !== networkPassphrase)
    throw new Error("The anchor signed a challenge for another network");
  const entries = decodeEntries(
    challenge.authorization_entries ?? challenge.authorizationEntries ?? "",
  );

  const ours = checkChallenge(entries, a, account);
  entries[ours] = await getKit().signAuthEntry(entries[ours]);

  const signed = encodeEntries(entries);
  const { token } = await readJson<{ token: string }>(
    await fetch(a.authEndpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        authorization_entries: signed,
        authorizationEntries: signed,
      }),
    }),
  );
  sessions.set(account, { token, exp: jwtExpiry(token) });
  return token;
};

/* ---------------------------------- SEP-24 -------------------------------- */

/** Which assets the anchor deposits, with their limits. */
export const depositLimits = async (): Promise<
  Record<string, DepositLimits>
> => {
  const a = await loadAnchor();
  const info = await readJson<{ deposit?: Record<string, DepositLimits> }>(
    await fetch(`${a.transferServer}/info`),
  );
  return info.deposit ?? {};
};

/** Start a hosted deposit; returns the anchor's page URL and transaction id. */
export const startDeposit = async (
  account: string,
  assetCode: string,
  amount: string,
): Promise<{ url: string; id: string }> => {
  const a = await loadAnchor();
  const token = await signIn(account);
  return readJson<{ url: string; id: string }>(
    await fetch(`${a.transferServer}/transactions/deposit/interactive`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        asset_code: assetCode,
        account,
        amount,
        lang: "en",
      }),
    }),
  );
};

export const depositStatus = async (
  account: string,
  id: string,
): Promise<AnchorTransaction> => {
  const a = await loadAnchor();
  const token = await signIn(account);
  const { transaction } = await readJson<{ transaction: AnchorTransaction }>(
    await fetch(
      `${a.transferServer}/transaction?id=${encodeURIComponent(id)}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
    ),
  );
  return transaction;
};
