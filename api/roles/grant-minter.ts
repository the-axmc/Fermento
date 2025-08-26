// /api/roles/grant-minter.ts
import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  Keypair,
  // across SDK versions the RPC server may be under `rpc.Server` or `SorobanRpc.Server`
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  rpc as _rpc,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  SorobanRpc as _SorobanRpc,
  Transaction,
} from "@stellar/stellar-sdk";
import { Client as NftClient } from "non_fungible_contract";
import { getBearer, verifyJwt } from "../_auth";

// ---- env ----
const RPC_URL = process.env.PUBLIC_STELLAR_RPC_URL!;
const PASSPHRASE = process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE!;
const CONTRACT_ID = process.env.CONTRACT_ID!;
const ADMIN_SECRET_SEED = process.env.ADMIN_SECRET_SEED!;

// ---- choose Server ctor (handles SDK variations) ----
const ServerCtor =
  (_rpc && (_rpc as any).Server) ||
  (_SorobanRpc && (_SorobanRpc as any).Server);

if (!ServerCtor) {
  throw new Error(
    "Could not find RPC Server class. Upgrade @stellar/stellar-sdk to ^14.0.0 and ensure it exposes rpc.Server or SorobanRpc.Server."
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    if (req.method !== "POST") return res.status(405).end();

    // ---- auth: must be logged in ----
    const bearer = getBearer(req);
    if (!bearer) return res.status(401).json({ error: "Missing bearer token" });

    const payload = verifyJwt<{ sub: string; wallet: string }>(bearer);
    if (!payload?.wallet) return res.status(401).json({ error: "Invalid token" });

    const account = payload.wallet; // wallet to grant MINTER to

    // ---- admin signer ----
    if (!ADMIN_SECRET_SEED) {
      return res.status(500).json({ error: "ADMIN_SECRET_SEED not configured" });
    }
    const admin = Keypair.fromSecret(ADMIN_SECRET_SEED);

    // ---- rpc server ----
    const server = new ServerCtor(RPC_URL, {
      allowHttp: RPC_URL.startsWith("http://"),
    });

    // ---- client with lightweight wallet adapter (typed as any) ----
    const client = new NftClient({
      contractId: CONTRACT_ID,
      rpcUrl: RPC_URL,
      networkPassphrase: PASSPHRASE,
      // The generated client calls wallet.sign() and wallet.submit()
      wallet: {
        async sign(tx: Transaction) {
          tx.sign(admin);
          return tx;
        },
        async submit(tx: Transaction) {
          const resp = await server.sendTransaction(tx);
          if (resp.errorResult) {
            throw new Error("submit failed");
          }
          // wait for confirmation
          await server.getTransaction(resp.hash);
          return resp.hash;
        },
      },
    } as any); // <-- cast avoids SDK typing drift (complaint about `wallet`)

    // ---- call contract: grant MINTER role ----
    const assembled = await client.grant_role({
      caller: admin.publicKey(),
      account,
      role: "MINTER",
    });

    // sign & submit using the wallet above
    const hash = await assembled.signAndSend();

    return res.status(200).json({ ok: true, tx: hash });
  } catch (e: any) {
    console.error("grant-minter error:", e);
    return res
      .status(500)
      .json({ error: e?.message || "Internal Server Error" });
  }
}
