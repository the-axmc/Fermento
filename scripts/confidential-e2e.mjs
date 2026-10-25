/**
 * Smoke test of a batch's confidential wrapper from Node, with the admin's
 * classic account: buy shares, register, deposit, merge, replay the local
 * state from events, verify it against the chain, withdraw one share.
 *
 *   node scripts/confidential-e2e.mjs
 *
 * Uses BATCH_14_* and CONFIDENTIAL_* from deploy/testnet.env. Costs a few
 * USDC from the admin on the first run (it buys 3 shares).
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import {
  Keypair,
  Networks,
  Address,
  nativeToScVal,
  xdr,
  Contract,
  TransactionBuilder,
  rpc,
} from "@stellar/stellar-sdk";
import {
  deriveSk,
  deriveKeys,
  addressToField,
  StateEngine,
  pointToBytes,
} from "stellar-confidential-token-sdk";
import {
  proveRegister,
  proveWithdraw,
} from "stellar-confidential-token-sdk/node";
import {
  ChainClient,
  keypairSigner,
  hybridFetchEvents,
} from "stellar-confidential-token-sdk/chain";

const env = Object.fromEntries(
  readFileSync("deploy/testnet.env", "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=", 2)),
);
const admin = Keypair.fromSecret(
  execSync("stellar keys secret fermento-admin").toString().trim(),
);
const signer = keypairSigner(admin.secret(), Networks.TESTNET);
const CONTRACTS = {
  token: env.BATCH_14_CONFIDENTIAL,
  verifier: env.CONFIDENTIAL_VERIFIER,
  auditor: env.CONFIDENTIAL_AUDITOR,
};
const client = new ChainClient({
  rpcUrl: "https://soroban-testnet.stellar.org",
  networkPassphrase: Networks.TESTNET,
  contracts: CONTRACTS,
});
// The SDK gives up on the first network error, even while polling a
// transaction it already sent. Retry the read-only RPC calls; never the send,
// which could submit twice.
for (const method of ["getTransaction", "simulateTransaction", "getAccount"]) {
  const call = client.server[method].bind(client.server);
  client.server[method] = async (...args) => {
    for (let attempt = 1; ; attempt++) {
      try {
        return await call(...args);
      } catch (err) {
        if (attempt === 5) throw err;
        console.log(t(), `${method} failed (${err.message}), retrying`);
        await new Promise((r) => setTimeout(r, 2_000 * attempt));
      }
    }
  };
}
const addr = (a) => new Address(a).toScVal();
const i128 = (v) => nativeToScVal(v, { type: "i128" });
const bytes = (b) => xdr.ScVal.scvBytes(Buffer.from(b));
const me = admin.publicKey();
const t = () => new Date().toISOString().slice(11, 19);

// 0. classic accounts need a trustline to the share asset (smart accounts do not)
import("@stellar/stellar-sdk").then(() => {});
{
  const { Horizon, Asset, Operation } = await import("@stellar/stellar-sdk");
  const horizon = new Horizon.Server("https://horizon-testnet.stellar.org");
  const acc = await horizon.loadAccount(me);
  const asset = new Asset("FERM014", env.BATCH_14_SHARE_ISSUER);
  if (
    !acc.balances.some(
      (b) =>
        b.asset_code === "FERM014" &&
        b.asset_issuer === env.BATCH_14_SHARE_ISSUER,
    )
  ) {
    const tx = new TransactionBuilder(acc, {
      fee: "10000",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.changeTrust({ asset }))
      .setTimeout(60)
      .build();
    tx.sign(admin);
    await horizon.submitTransaction(tx);
    console.log(t(), "trustline FERM014 added");
  }
}
// 0. shares held
const bal = async () => {
  const r = await client.simulate(env.BATCH_14_SHARE_SAC, "balance", [
    addr(me),
  ]);
  return BigInt(r.i128().lo().toString());
};
let shares = await bal();
console.log(t(), "admin holds", shares, "shares of batch 14");
if (shares < 2n) {
  console.log(t(), "buying 3 shares…");
  await client.invoke(
    env.SHARES_ID,
    "buy",
    [xdr.ScVal.scvU32(14), addr(me), i128(3n)],
    signer,
  );
  shares = await bal();
  console.log(t(), "now holds", shares);
}

// 1. keys: a raw 32-byte root (what a passkey account will use), here derived from the admin signature for determinism
const root = new Uint8Array(
  admin.sign(Buffer.from("fermento-confidential-e2e-root")),
);
const { sk, addrF } = deriveSk(root, CONTRACTS.token, me);
const keys = deriveKeys(sk, addrF, addressToField(me));
console.log(t(), "addr_f ok, vk", keys.vk.toString(16).slice(0, 12));

// 2. register
if (!(await client.isRegistered(me))) {
  const t0 = Date.now();
  const { payload } = await proveRegister(keys);
  console.log(
    t(),
    `register proof in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${payload.length} bytes`,
  );
  const r = await client.invoke(
    CONTRACTS.token,
    "register",
    [addr(me), xdr.ScVal.scvU32(Number(env.AUDITOR_ID)), bytes(payload)],
    signer,
  );
  console.log(t(), "registered", r.hash);
} else console.log(t(), "already registered");

// 3. deposit 2 shares + merge
const dep = await client.invoke(
  CONTRACTS.token,
  "deposit",
  [addr(me), addr(me), i128(2n)],
  signer,
);
console.log(t(), "deposited 2", dep.hash);
const mg = await client.invoke(CONTRACTS.token, "merge", [addr(me)], signer);
console.log(t(), "merged", mg.hash);

// 4. replay
const engine = new StateEngine({ address: me, keys });
const { events } = await hybridFetchEvents(client, undefined, {
  fromLedger: 0,
});
engine.ingestEvents(
  events.filter((ev) => ev.account === me || ev.from === me || ev.to === me),
);
const st = engine.state();
console.log(
  t(),
  "local spendable",
  st.spendable.v,
  "receiving",
  st.receiving.v,
  "events",
  events.length,
);
const on = await client.confidentialBalance(me);
console.log(
  t(),
  "chain check",
  JSON.stringify(
    engine.verifyAgainstChain({
      spendableC: pointToBytes(on.spendableBalance),
      receivingC: pointToBytes(on.receivingBalance),
    }),
  ),
);

// 5. withdraw 1 share back
const kAud = await client.auditorKey(Number(env.AUDITOR_ID));
const t1 = Date.now();
const w = await proveWithdraw({
  keys,
  v: st.spendable.v,
  r: st.spendable.r,
  amount: 1n,
  kAudS: kAud,
});
console.log(t(), `withdraw proof in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
const wd = await client.invoke(
  CONTRACTS.token,
  "withdraw",
  [addr(me), addr(me), i128(1n), bytes(w.payload)],
  signer,
);
console.log(t(), "withdrew 1", wd.hash);
console.log(t(), "public shares now", await bal());
