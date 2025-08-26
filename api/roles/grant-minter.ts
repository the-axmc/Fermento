import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  Address,
  Keypair,
  TransactionBuilder,
  Contract,
  xdr,
  // NOTE: The name of the RPC namespace changed between SDK versions
  // We’ll detect it at runtime below.
  // @ts-ignore – types differ across RCs
  SorobanRpc as _SorobanRpc,
  // @ts-ignore
  Soroban as _Soroban,
  // @ts-ignore
  rpc as _rpc,
} from "@stellar/stellar-sdk";

const RPC = process.env.PUBLIC_STELLAR_RPC_URL!;
const PASS = process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE!;
const CONTRACT_ID = process.env.CONTRACT_ID!;
const ADMIN_SECRET_SEED = process.env.ADMIN_SECRET_SEED!;

import { getDb } from "../_db";
import { getBearer, verifyJwt } from "../_auth";

// --- Compat: pick the right Server class regardless of SDK RC version ---
const ServerCtor =
  // v14-rc typically exports SorobanRpc
  (_SorobanRpc && _SorobanRpc.Server) ||
  // some RCs nested it under Soroban.Rpc
  (_Soroban && _Soroban.Rpc && _Soroban.Rpc.Server) ||
  // some builds export it as `rpc`
  (_rpc && _rpc.Server);

if (!ServerCtor) {
  throw new Error(
    "Could not locate Soroban RPC Server in @stellar/stellar-sdk. " +
      "Pin SDK to ^14.0.0-rc.6 (or later) or expose SorobanRpc.Server."
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") return res.status(405).end();

  const token = getBearer(req);
  const claims = token ? verifyJwt<{ sub: string; wallet: string }>(token) : null;
  if (!claims) return res.status(401).json({ error: "Unauthorized" });

  const db = await getDb();
  const user = await db
    .collection("users")
    .findOne({ username: claims.sub, wallet: claims.wallet, acceptedTos: true });
  if (!user) return res.status(403).json({ error: "User not found or not verified" });

  try {
    const server = new ServerCtor(RPC, { allowHttp: RPC.startsWith("http://") });
    const admin = Keypair.fromSecret(ADMIN_SECRET_SEED);
    const account = await server.getAccount(admin.publicKey());

    const contract = new Contract(CONTRACT_ID);

    // If your contract expects BytesN<32> role, replace with a 32-byte value.
    const role = xdr.ScVal.scvSymbol("MINTER");
    const addr = new Address(claims.wallet).toScVal();

    const op = contract.call("grant_role", role, addr);

    let tx = new TransactionBuilder(account, {
      fee: "100000",
      networkPassphrase: PASS,
    })
      .addOperation(op)
      .setTimeout(60)
      .build();

    tx = await server.prepareTransaction(tx);
    tx.sign(admin);

    const send = await server.sendTransaction(tx);
    if (send.status !== "PENDING") throw new Error(`send status ${send.status}`);

    const final = await server.getTransaction(send.hash);
    if (final.status !== "SUCCESS") throw new Error(`tx failed: ${final.status}`);

    res.json({ ok: true, hash: send.hash });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: String(e) });
  }
}
