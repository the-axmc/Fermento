/**
 * Read token balances for any address (G or C) by simulating `balance` on the
 * token contract. Works for smart accounts, which have no Horizon account.
 */

import {
  Account,
  Contract,
  Keypair,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { networkPassphrase, rpcUrl } from "../contracts/util";

const server = new rpc.Server(rpcUrl, {
  allowHttp: rpcUrl.startsWith("http://"),
});

/** Raw token units (7 decimals for USDC and XLM, whole numbers for shares). */
export const readBalance = async (
  tokenId: string,
  holder: string,
): Promise<bigint> => {
  if (!tokenId || !holder) return 0n;
  // Any account works as a simulation source; it never signs or pays.
  const source = new Account(Keypair.random().publicKey(), "0");
  const tx = new TransactionBuilder(source, { fee: "100", networkPassphrase })
    .addOperation(
      new Contract(tokenId).call(
        "balance",
        nativeToScVal(holder, { type: "address" }),
      ),
    )
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) {
    return 0n;
  }
  return BigInt(scValToNative(sim.result.retval) as bigint | number);
};

/** 7-decimal token amount as a plain decimal string, e.g. "12.40". */
export const formatUnits = (raw: bigint, decimals = 7, places = 2): string => {
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const frac = raw % base;
  const fracStr = frac.toString().padStart(decimals, "0").slice(0, places);
  return places > 0 ? `${whole}.${fracStr}` : whole.toString();
};

/** Parse "12.4" into 7-decimal raw units. */
export const parseUnits = (value: string, decimals = 7): bigint => {
  const [whole = "0", frac = ""] = value.trim().split(".");
  const fracPadded = (frac + "0".repeat(decimals)).slice(0, decimals);
  return (
    BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt(fracPadded || "0")
  );
};
