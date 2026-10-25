import { useEffect, useState } from "react";
import { readBalance } from "../wallet/balances";

/**
 * Live token balance of `holder` on `tokenId`, refreshed every `intervalMs`.
 * Returns undefined until the first read completes.
 */
export const useBalance = (
  tokenId: string,
  holder: string | undefined,
  intervalMs = 10_000,
) => {
  const [balance, setBalance] = useState<bigint | undefined>();

  useEffect(() => {
    if (!tokenId || !holder) {
      setBalance(undefined);
      return;
    }
    let active = true;
    const tick = () =>
      readBalance(tokenId, holder)
        .then((b) => {
          if (active) setBalance(b);
        })
        .catch(() => {
          if (active) setBalance(undefined);
        });
    void tick();
    const timer = setInterval(() => void tick(), intervalMs);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [tokenId, holder, intervalMs]);

  return balance;
};
