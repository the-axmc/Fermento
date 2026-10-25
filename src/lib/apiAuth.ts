/**
 * Sign-in to the producer API (scripts/producer-api.ts) for a passkey account.
 *
 * Profile edits, certification and listings act for an account, so the API
 * asks for proof the caller holds it, the SEP-45 way: it sends a challenge as
 * Soroban authorization entries for `web_auth_verify`, the passkey signs ours,
 * and the API answers with a session token. One passkey prompt per session.
 */

import { Address, scValToNative, xdr } from "@stellar/stellar-sdk";
import { networkPassphrase } from "../contracts/util";
import { getKit } from "../wallet/kit";
import { decodeEntries, encodeEntries } from "./anchor";

const sessions = new Map<string, { token: string; exp: number }>();

const readJson = async <T>(res: Response): Promise<T> => {
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(body.error ?? `Sign-in failed (${res.status})`);
  return body;
};

/**
 * Only ever sign a plain `web_auth_verify` call on the contract the API
 * named, for this account and this site. Returns the index of our entry.
 */
const checkChallenge = (
  entries: xdr.SorobanAuthorizationEntry[],
  contract: string,
  account: string,
) => {
  let ours: number | undefined;
  entries.forEach((entry, i) => {
    const invocation = entry.rootInvocation();
    if (invocation.subInvocations().length > 0)
      throw new Error("Challenge has sub-invocations");
    const fn = invocation.function().contractFn();
    if (
      Address.fromScAddress(fn.contractAddress()).toString() !== contract ||
      fn.functionName().toString() !== "web_auth_verify"
    )
      throw new Error("Challenge calls an unexpected function");
    const args = scValToNative(fn.args()[0]) as Record<string, string>;
    if (args.account !== account || args.home_domain !== window.location.host)
      throw new Error("Challenge is for another account or site");
    const creds = entry.credentials();
    if (
      creds.switch() ===
        xdr.SorobanCredentialsType.sorobanCredentialsAddress() &&
      Address.fromScAddress(creds.address().address()).toString() === account
    )
      ours = i;
  });
  if (ours === undefined) throw new Error("Challenge has no entry to sign");
  return ours;
};

const signIn = async (account: string): Promise<string> => {
  const cached = sessions.get(account);
  if (cached && cached.exp > Date.now() / 1000 + 60) return cached.token;

  const params = new URLSearchParams({
    account,
    home_domain: window.location.host,
  });
  const challenge = await readJson<{
    authorization_entries: string;
    network_passphrase: string;
    web_auth_contract: string;
  }>(await fetch(`/api/auth?${params}`));
  if (challenge.network_passphrase !== networkPassphrase)
    throw new Error("The API signs in on another network");
  const entries = decodeEntries(challenge.authorization_entries);
  const ours = checkChallenge(entries, challenge.web_auth_contract, account);
  entries[ours] = await getKit().signAuthEntry(entries[ours]);

  const session = await readJson<{ token: string; exp: number }>(
    await fetch("/api/auth", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ authorization_entries: encodeEntries(entries) }),
    }),
  );
  sessions.set(account, session);
  return session.token;
};

/**
 * `fetch` to the producer API as `account`. Signs in first when there is no
 * live session, and once more if the API forgot it (it restarted).
 */
export const fetchAs = async (
  account: string,
  path: string,
  init: RequestInit = {},
): Promise<Response> => {
  const send = async () =>
    fetch(path, {
      ...init,
      headers: {
        ...init.headers,
        authorization: `Bearer ${await signIn(account)}`,
      },
    });
  const res = await send();
  if (res.status !== 401) return res;
  sessions.delete(account);
  return send();
};
