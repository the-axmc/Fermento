import type { VercelRequest, VercelResponse } from "@vercel/node";
import {
  Address,
  Keypair,
  TransactionBuilder,
  Contract,
  xdr,
  // Both names appear across SDK RCs; we’ll probe both.
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  SorobanRpc as _SorobanRpc,
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore
  rpc as _rpc,
} from "@stellar/stellar-sdk";

const RPC = process.env.PUBLIC_STELLAR_RPC_URL!;
const PASS = process.env.PUBLIC_STELLAR_NETWORK_PASSPHRASE!;
const CONTRACT_ID = process.env.CONTRACT_ID!;
const ADMIN_SECRET_SEED = process.env.ADMIN_SECRET_SEED!;

import { getDb } from "../_db";
import { getBearer, verifyJwt } from "../_auth";

/** Pick whichever namespace this SDK exposes */
const ServerCtor =
  (_SorobanRpc && (_SorobanRpc as any).Server) ||
  (_rpc && (_rpc as any).Server);

if (!ServerCtor) {
  throw new Error(
    "Could not find RPC Server class. Try upgrading @stellar/stellar-sdk to ^14.0.0 or use a version exposing `SorobanRpc.Server` or `rpc.Server`."
  );
}
