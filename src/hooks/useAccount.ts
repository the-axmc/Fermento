import { use } from "react";
import { AccountContext } from "../wallet/AccountProvider";

/** The signed-in passkey smart account. */
export const useAccount = () => {
  const ctx = use(AccountContext);
  if (!ctx) {
    throw new Error("useAccount must be used within an AccountProvider");
  }
  return ctx;
};
