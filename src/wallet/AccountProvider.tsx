/**
 * Passkey smart-account session for the whole app.
 *
 * `status` moves from "loading" (silent restore on page load) to either
 * "anonymous" or "connected". Write calls go through `submit`, which signs the
 * contract client's AssembledTransaction with the passkey and sends it via the
 * fee-sponsoring relayer.
 */

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { contract } from "@stellar/stellar-sdk";
import type { TransactionResult } from "smart-account-kit";
import {
  isPasskeyError,
  isUndeployedPasskey,
  passkeyErrorMessage,
  undeployedCredentialId,
  type PasskeyStep,
} from "../util/passkey";
import { APP_NAME, getKit, isAccountConfigured } from "./kit";

export type AccountStatus = "loading" | "anonymous" | "connected";

export interface AccountContextType {
  status: AccountStatus;
  /** Smart account contract address (C...), the user's identity on chain. */
  address?: string;
  /** False when the env lacks the kit's contract addresses. */
  configured: boolean;
  /** Create a passkey and deploy a new smart account. Takes 10-20 s on testnet. */
  create: (name: string) => Promise<string>;
  /** Prompt for an existing passkey and reconnect its account. */
  signIn: () => Promise<string>;
  signOut: () => Promise<void>;
  /** Sign with the passkey and submit through the relayer. Throws on failure. */
  submit: <T>(tx: contract.AssembledTransaction<T>) => Promise<string>;
}

export const AccountContext = // eslint-disable-line react-refresh/only-export-components
  createContext<AccountContextType | null>(null);

const unwrap = (result: TransactionResult): string => {
  if (!result.success) {
    throw new Error(`[${result.error.code}] ${result.error.message}`);
  }
  return result.hash;
};

/** The passkey prompt currently open, if any. Browsers allow one at a time. */
let pendingPrompt: Promise<unknown> | null = null;

/**
 * Run one passkey interaction. Prompts are serialised: a second request while
 * one is open is rejected by the browser with the same opaque NotAllowedError
 * as a cancelled prompt, so a double tap would otherwise look like a failure.
 * Kit errors are rethrown with a message people can act on; the original
 * stays in `cause` for the console.
 */
const withPasskeyPrompt = async <T,>(
  step: PasskeyStep,
  run: () => Promise<T>,
): Promise<T> => {
  if (pendingPrompt) {
    throw new Error("A passkey prompt is already open. Finish it first.");
  }
  const promise = run();
  pendingPrompt = promise;
  try {
    return await promise;
  } catch (e) {
    if (isPasskeyError(e)) {
      const friendly = new Error(passkeyErrorMessage(e, step));
      (friendly as { cause?: unknown }).cause = e;
      throw friendly;
    }
    throw e;
  } finally {
    if (pendingPrompt === promise) pendingPrompt = null;
  }
};

export const AccountProvider = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const configured = isAccountConfigured();
  const [status, setStatus] = useState<AccountStatus>(
    configured ? "loading" : "anonymous",
  );
  const [address, setAddress] = useState<string | undefined>();

  // Silent restore from the stored session on first load.
  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    getKit()
      .connectWallet()
      .then((restored) => {
        if (cancelled) return;
        if (restored && getKit().contractId) {
          setAddress(getKit().contractId);
          setStatus("connected");
        } else {
          setStatus("anonymous");
        }
      })
      .catch(() => {
        if (!cancelled) setStatus("anonymous");
      });
    return () => {
      cancelled = true;
    };
  }, [configured]);

  const create = useCallback(async (name: string) => {
    const kit = getKit();
    // No autoFund: the relayer pays every fee, so the account never needs XLM,
    // and Friendbot funding of a fresh account is the flakiest step on testnet.
    const result = await withPasskeyPrompt("create", () =>
      kit.createWallet(APP_NAME, name, {
        autoSubmit: true,
        authenticatorSelection: { residentKey: "required" },
      }),
    );
    // createWallet reports a failed deployment in submitResult instead of throwing.
    if (result.submitResult && !result.submitResult.success) {
      const e = result.submitResult.error;
      throw new Error(`Account deployment failed [${e.code}]: ${e.message}`);
    }
    setAddress(result.contractId);
    setStatus("connected");
    return result.contractId;
  }, []);

  const signIn = useCallback(async () => {
    const kit = getKit();
    let connected: Awaited<ReturnType<typeof kit.connectWallet>>;
    try {
      connected = await withPasskeyPrompt("signin", () =>
        kit.connectWallet({ prompt: true, fresh: true }),
      );
    } catch (e) {
      // A passkey whose deployment failed earlier: forget our local record so
      // the kit stops offering it, then explain what to do.
      if (isUndeployedPasskey(e)) {
        const id = undeployedCredentialId(e);
        if (id) await kit.credentials.delete(id).catch(() => undefined);
        const friendly = new Error(passkeyErrorMessage(e, "signin"));
        (friendly as { cause?: unknown }).cause = e;
        throw friendly;
      }
      throw e;
    }
    const id = connected ? kit.contractId : undefined;
    if (!id) throw new Error("No account found for that passkey.");
    setAddress(id);
    setStatus("connected");
    return id;
  }, []);

  const signOut = useCallback(async () => {
    await getKit().disconnect();
    setAddress(undefined);
    setStatus("anonymous");
  }, []);

  const submit = useCallback(
    async <T,>(tx: contract.AssembledTransaction<T>) =>
      unwrap(await withPasskeyPrompt("sign", () => getKit().signAndSubmit(tx))),
    [],
  );

  const value = useMemo<AccountContextType>(
    () => ({ status, address, configured, create, signIn, signOut, submit }),
    [status, address, configured, create, signIn, signOut, submit],
  );

  return <AccountContext value={value}>{children}</AccountContext>;
};
