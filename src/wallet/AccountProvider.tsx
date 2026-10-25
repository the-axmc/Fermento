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
import { APP_NAME, NATIVE_TOKEN_ID, getKit, isAccountConfigured } from "./kit";

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
    const result = await kit.createWallet(APP_NAME, name, {
      autoSubmit: true,
      autoFund: NATIVE_TOKEN_ID !== "",
      nativeTokenContract: NATIVE_TOKEN_ID || undefined,
      authenticatorSelection: { residentKey: "required" },
    });
    setAddress(result.contractId);
    setStatus("connected");
    return result.contractId;
  }, []);

  const signIn = useCallback(async () => {
    const kit = getKit();
    const connected = await kit.connectWallet({ prompt: true, fresh: true });
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
      unwrap(await getKit().signAndSubmit(tx)),
    [],
  );

  const value = useMemo<AccountContextType>(
    () => ({ status, address, configured, create, signIn, signOut, submit }),
    [status, address, configured, create, signIn, signOut, submit],
  );

  return <AccountContext value={value}>{children}</AccountContext>;
};
