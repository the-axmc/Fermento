/**
 * Producer API: lists a batch on the market from the "Add a ferment" page.
 *
 * Listing needs the platform's admin roles (minter, curator, issuer) and a
 * classic Stellar account to issue the share asset, which a phone passkey
 * account cannot do. This small server holds the admin key and performs the
 * five steps that scripts/open-batch.sh does by hand, then stores the batch's
 * story (name, description, image) in deploy/batches.json for the app.
 *
 *   npm run producer-api          # listens on http://localhost:8787
 *
 * Env:
 *   ADMIN_KEY     Stellar CLI identity name holding the roles (default fermento-admin)
 *   ADMIN_SECRET  S... secret, used instead of the CLI identity when set
 *   PORT          default 8787
 *
 * Vite proxies /api/* here in development (see vite.config.ts).
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  Asset,
  Contract,
  Horizon,
  Keypair,
  Networks,
  Operation,
  TransactionBuilder,
  contract,
  nativeToScVal,
  rpc,
  scValToNative,
} from "@stellar/stellar-sdk";
import { Client as RegistryClient } from "batch_registry_contract";
import { Client as SharesClient } from "batch_shares_contract";
import { Client as OracleClient } from "condition_oracle_contract";

/* ---------------------------------- Config --------------------------------- */

const ROOT = new URL("..", import.meta.url);
const ENV_FILE = new URL("deploy/testnet.env", ROOT);
const STORE_FILE = new URL("deploy/batches.json", ROOT);
const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
const PORT = Number(process.env.PORT ?? 8787);
const FIRST_BATCH_ID = 100;

const deployed = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=", 2) as [string, string]),
);
for (const k of ["REGISTRY_ID", "SHARES_ID", "ORACLE_ID"]) {
  if (!deployed[k]) throw new Error(`${k} missing in deploy/testnet.env`);
}

const adminSecret =
  process.env.ADMIN_SECRET ??
  execSync(`stellar keys secret ${process.env.ADMIN_KEY ?? "fermento-admin"}`)
    .toString()
    .trim();
const admin = Keypair.fromSecret(adminSecret);
const signer = contract.basicNodeSigner(admin, PASSPHRASE);
const server = new rpc.Server(RPC_URL);

const clientOptions = (contractId: string) => ({
  contractId,
  rpcUrl: RPC_URL,
  networkPassphrase: PASSPHRASE,
  publicKey: admin.publicKey(),
  ...signer,
});
const registry = new RegistryClient(clientOptions(deployed.REGISTRY_ID));
const shares = new SharesClient(clientOptions(deployed.SHARES_ID));
const oracle = new OracleClient(clientOptions(deployed.ORACLE_ID));

/* ---------------------------------- Store ---------------------------------- */

type Kind =
  | "kombucha"
  | "kefir"
  | "cider"
  | "mead"
  | "wine"
  | "fortified"
  | "vinegar"
  | "kimchi"
  | "cheese"
  | "other";

interface StoredBatch {
  batchId: number;
  kind: Kind;
  cat: string;
  name: string;
  label: string;
  vintage: string;
  description: string;
  producer: string;
  producerSlug: string;
  producerAddress: string;
  region: string;
  category: string;
  unit: string;
  glass: string;
  cap: string;
  labelColor: string;
  tile: string;
  shareToken: string;
  /** Locked issuer of the share asset (master weight 0). */
  shareIssuer?: string;
  sensorPublic: string;
  /** Kept server side only. */
  sensorSecret: string;
  listedAt: string;
  txs: Record<string, string>;
}

const loadStore = (): StoredBatch[] =>
  existsSync(STORE_FILE)
    ? (JSON.parse(readFileSync(STORE_FILE, "utf8")) as StoredBatch[])
    : [];
const saveStore = (rows: StoredBatch[]) =>
  writeFileSync(STORE_FILE, JSON.stringify(rows, null, 2) + "\n");
const publicView = ({ sensorSecret: _s, ...rest }: StoredBatch) => rest;

/* --------------------------- Defaults per ferment -------------------------- */

/** Cellar bands in 0.01 C and bps, the unit word and label colours. */
const KIND_DEFAULTS: Record<
  Kind,
  {
    temp: [number, number];
    hum: [number, number];
    unit: string;
    cat: string;
    colors: [string, string, string, string];
  }
> = {
  kombucha: {
    temp: [2000, 2800],
    hum: [4000, 7000],
    unit: "bottle",
    cat: "Kombucha",
    colors: ["#C8341E", "#F5B82E", "#FFF4E2", "#F7A8C8"],
  },
  kefir: {
    temp: [1800, 2600],
    hum: [4000, 7000],
    unit: "bottle",
    cat: "Kefir",
    colors: ["#FFF4E2", "#F7A8C8", "#157A78", "#157A78"],
  },
  cider: {
    temp: [1000, 2000],
    hum: [5000, 8000],
    unit: "bottle",
    cat: "Cider",
    colors: ["#C8341E", "#157A78", "#F5B82E", "#F5B82E"],
  },
  mead: {
    temp: [1200, 2000],
    hum: [5000, 8000],
    unit: "bottle",
    cat: "Mead",
    colors: ["#F5B82E", "#8A4F28", "#FFF4E2", "#2B1B3D"],
  },
  wine: {
    temp: [1200, 1800],
    hum: [6000, 8000],
    unit: "bottle",
    cat: "Wine",
    colors: ["#2B1B3D", "#F5B82E", "#FFF4E2", "#FFFFFF"],
  },
  fortified: {
    temp: [1200, 1800],
    hum: [6000, 8000],
    unit: "bottle",
    cat: "Fortified",
    colors: ["#7A1B2B", "#F5B82E", "#FFF4E2", "#F07C2B"],
  },
  vinegar: {
    temp: [2000, 3000],
    hum: [4000, 7000],
    unit: "bottle",
    cat: "Vinegar",
    colors: ["#F07C2B", "#2B1B3D", "#FFF4E2", "#7FD8D6"],
  },
  kimchi: {
    temp: [0, 600],
    hum: [7000, 9500],
    unit: "jar",
    cat: "Kimchi",
    colors: ["#8A4F28", "#2B1B3D", "#F7A8C8", "#FFF4E2"],
  },
  cheese: {
    temp: [800, 1400],
    hum: [8000, 9500],
    unit: "wheel",
    cat: "Cheese",
    colors: ["#F5B82E", "#C8341E", "#F7A8C8", "#F07C2B"],
  },
  other: {
    temp: [1000, 2500],
    hum: [4000, 8000],
    unit: "unit",
    cat: "Ferment",
    colors: ["#C8341E", "#F5B82E", "#FFF4E2", "#C8341E"],
  },
};

/** +2 % a month for six months, flat, then +20 % from month 12. */
const DEFAULT_CURVE = [
  10000, 10200, 10400, 10600, 10800, 11000, 11200, 11200, 11200, 11200, 11200,
  11200, 12000,
];
const USDC = 10_000_000n;
/** 0.001 USDC per share per day. */
const FEE_PER_SHARE_DAY = 10_000n;

/* ------------------------------- Chain helpers ----------------------------- */

/** True when a read-only call returns a value (reads that panic throw on `.result`). */
const exists = async <T>(
  call: () => Promise<contract.AssembledTransaction<T>>,
) => {
  try {
    const tx = await call();
    // A read that panics still returns; its simulation carries the error.
    return !rpc.Api.isSimulationError(tx.simulation);
  } catch {
    return false;
  }
};

const send = async <T>(
  tx: contract.AssembledTransaction<T>,
): Promise<string> => {
  const sent = await tx.signAndSend();
  const hash = sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error("transaction was not sent");
  return hash;
};

/** Sign and submit a raw operation from `signer`. */
const invokeAs = async (
  signer: Keypair,
  op: ReturnType<typeof Operation.invokeHostFunction>,
) => {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(signer);
  const sent = await server.sendTransaction(prepared);
  if (sent.status !== "PENDING") {
    throw new Error(
      `send failed: ${sent.status} ${JSON.stringify(sent.errorResult)}`,
    );
  }
  // pollTransaction retries getTransaction with a bounded attempt count.
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (result.status !== "SUCCESS")
    throw new Error(`tx ${sent.hash} ${result.status}`);
  return sent.hash;
};

/** Current admin of a Stellar Asset Contract, read by simulation. */
const sacAdmin = async (sac: string): Promise<string | undefined> => {
  const account = await server.getAccount(admin.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(new Contract(sac).call("admin"))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(sim) || !sim.result) return undefined;
  return scValToNative(sim.result.retval) as string;
};

/** Sign and submit a raw operation from the admin account. */
const invoke = (op: ReturnType<typeof Operation.invokeHostFunction>) =>
  invokeAs(admin, op);

/**
 * Share asset with its own locked issuer (skills.stellar.org assets guidance):
 * a fresh account issues the classic asset, deploys its SAC, hands SAC admin
 * to the shares contract, then sets its master weight to 0. After that nobody
 * can mint outside the contract. Returns the SAC id and the issuer public key.
 */
const issueShareAsset = async (code: string) => {
  const issuer = Keypair.random();
  const asset = new Asset(code, issuer.publicKey());
  const sac = asset.contractId(PASSPHRASE);

  // 1. Fund the issuer from the admin (classic op, via Horizon).
  const adminAccount = await horizon.loadAccount(admin.publicKey());
  const createTx = new TransactionBuilder(adminAccount, {
    fee: "10000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      Operation.createAccount({
        destination: issuer.publicKey(),
        startingBalance: "3",
      }),
    )
    .setTimeout(60)
    .build();
  createTx.sign(admin);
  await horizon.submitTransaction(createTx);

  // 2. Deploy the SAC (anyone may), then set_admin and lock as the issuer.
  await invoke(Operation.createStellarAssetContract({ asset }));
  await invokeAs(
    issuer,
    new Contract(sac).call(
      "set_admin",
      nativeToScVal(deployed.SHARES_ID, { type: "address" }),
    ),
  );
  const issuerAccount = await horizon.loadAccount(issuer.publicKey());
  const lockTx = new TransactionBuilder(issuerAccount, {
    fee: "10000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.setOptions({ masterWeight: 0 }))
    .setTimeout(60)
    .build();
  lockTx.sign(issuer);
  await horizon.submitTransaction(lockTx);

  return { sac, issuer: issuer.publicKey() };
};

/* ------------------------------- The listing ------------------------------- */

interface ListingRequest {
  kind: Kind;
  name: string;
  description: string;
  origin: string;
  producer: string;
  producerAddress?: string;
  shares: number;
  priceEur: number;
  started: string;
  ready: string;
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const listBatch = async (req: ListingRequest, origin: string) => {
  const store = loadStore();
  const batchId =
    store.reduce((m, b) => Math.max(m, b.batchId), FIRST_BATCH_ID - 1) + 1;
  const d = KIND_DEFAULTS[req.kind] ?? KIND_DEFAULTS.other;
  const caller = admin.publicKey();
  const producerAddress = req.producerAddress ?? caller;
  const filledAt = BigInt(Math.floor(new Date(req.started).getTime() / 1000));
  const maturesAt = BigInt(Math.floor(new Date(req.ready).getTime() / 1000));
  const price = BigInt(Math.round(req.priceEur * 100)) * (USDC / 100n);
  const sensor = Keypair.random();
  const txs: Record<string, string> = {};

  // 1. registry token (skipped when a previous attempt already minted it)
  const minted = await exists(() => registry.owner_of({ token_id: batchId }));
  if (!minted)
    txs.register = await send(
      await registry.register_batch({
        to: caller,
        batch_id: batchId,
        uri: `${origin}/batch/${batchId}`,
        caller,
      }),
    );

  // 2. age curve for the category, once
  const hasCurve = await exists(() => oracle.curve({ category: req.kind }));
  if (!hasCurve) {
    txs.curve = await send(
      await oracle.set_curve({
        category: req.kind,
        points: DEFAULT_CURVE,
        caller,
      }),
    );
  }

  // 3. oracle entry with the sensor key
  const onOracle = await exists(() => oracle.batch({ batch_id: batchId }));
  if (onOracle) {
    // Registered by an earlier attempt whose key was never stored: rotate to ours.
    txs.sensor = await send(
      await oracle.set_sensor({
        batch_id: batchId,
        sensor: sensor.rawPublicKey(),
        caller,
      }),
    );
  } else
    txs.oracle = await send(
      await oracle.register_batch({
        caller,
        config: {
          batch_id: batchId,
          category: req.kind,
          sensor: sensor.rawPublicKey(),
          fill_price: price,
          filled_at: filledAt,
          fee_per_share_day: FEE_PER_SHARE_DAY,
          temp_min: d.temp[0],
          temp_max: d.temp[1],
          humidity_min: d.hum[0],
          humidity_max: d.hum[1],
        },
      }),
    );

  // 4. share asset from a fresh, locked issuer; SAC admin is the shares contract.
  //    A retry after a failure here issues a new asset: nothing was sold yet.
  const code = `FERM${String(batchId).padStart(3, "0")}`;
  const existing = store.find((b) => b.batchId === batchId);
  const { sac: shareToken, issuer: shareIssuer } =
    existing?.shareToken &&
    (await sacAdmin(existing.shareToken)) === deployed.SHARES_ID
      ? { sac: existing.shareToken, issuer: existing.shareIssuer ?? "" }
      : await issueShareAsset(code);
  txs.shareAsset = shareToken;

  // 5. primary offering
  const offered = await exists(() => shares.offering({ batch_id: batchId }));
  if (!offered)
    txs.offering = await send(
      await shares.open_offering({
        batch_id: batchId,
        share_token: shareToken,
        producer: producerAddress,
        price,
        total_shares: BigInt(req.shares),
        fee_per_share_day: FEE_PER_SHARE_DAY,
        shares_per_unit: 1n,
        filled_at: filledAt,
        matures_at: maturesAt,
        caller,
      }),
    );

  const row: StoredBatch = {
    batchId,
    kind: req.kind,
    cat: d.cat,
    name: req.name,
    label: `Batch Nº ${String(batchId).padStart(3, "0")}`,
    vintage: String(new Date(req.started).getFullYear()),
    description: req.description,
    producer: req.producer,
    producerSlug: slug(req.producer) || "producer",
    producerAddress,
    region: req.origin,
    category: `${d.cat} · ${req.kind}`,
    unit: d.unit,
    glass: d.colors[0],
    cap: d.colors[1],
    labelColor: d.colors[2],
    tile: d.colors[3],
    shareToken,
    shareIssuer,
    sensorPublic: sensor.publicKey(),
    sensorSecret: sensor.secret(),
    listedAt: new Date().toISOString(),
    txs,
  };
  saveStore([...store, row]);
  return row;
};

/* --------------------------------- Treasury -------------------------------- */
//
// Testnet "Add funds": sends USDC or EURC from a treasury account to a user's
// smart account. The treasury is TREASURY_SECRET when set, otherwise the admin
// key. Missing trustlines are created at startup so tokens can be sent to it.

const HORIZON_URL =
  process.env.HORIZON_URL ?? "https://horizon-testnet.stellar.org";
const treasury = process.env.TREASURY_SECRET
  ? Keypair.fromSecret(process.env.TREASURY_SECRET)
  : admin;
/** Circle's testnet issuers; override with USDC_ASSET / EURC_ASSET = CODE:ISSUER. */
const TREASURY_ASSETS: Record<string, Asset> = Object.fromEntries(
  [
    process.env.USDC_ASSET ??
      "USDC:GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
    process.env.EURC_ASSET ??
      "EURC:GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO",
  ].map((s) => {
    const [code, issuer] = s.split(":");
    return [code, new Asset(code, issuer)];
  }),
);
/** Largest single top-up, in whole tokens. */
const FUND_MAX = Number(process.env.FUND_MAX ?? 50);

const horizon = new Horizon.Server(HORIZON_URL);

const treasuryBalances = async () => {
  const account = await horizon.loadAccount(treasury.publicKey());
  return Object.fromEntries(
    Object.entries(TREASURY_ASSETS).map(([code, asset]) => {
      const line = account.balances.find(
        (b) =>
          "asset_code" in b &&
          b.asset_code === code &&
          b.asset_issuer === asset.getIssuer(),
      );
      return [
        code,
        {
          issuer: asset.getIssuer(),
          sac: asset.contractId(PASSPHRASE),
          trustline: !!line,
          balance: line ? line.balance : "0",
        },
      ];
    }),
  );
};

/** Open USDC/EURC trustlines on the treasury so tokens can be sent to it. */
const ensureTrustlines = async () => {
  const balances = await treasuryBalances();
  const missing = Object.entries(balances).filter(([, b]) => !b.trustline);
  if (missing.length === 0) return;
  const account = await horizon.loadAccount(treasury.publicKey());
  const builder = new TransactionBuilder(account, {
    fee: "10000",
    networkPassphrase: PASSPHRASE,
  });
  for (const [code] of missing) {
    builder.addOperation(
      Operation.changeTrust({ asset: TREASURY_ASSETS[code] }),
    );
  }
  const tx = builder.setTimeout(60).build();
  tx.sign(treasury);
  await horizon.submitTransaction(tx);
  console.log(
    `treasury ${treasury.publicKey()} now trusts ${missing.map(([c]) => c).join(", ")}`,
  );
};

/** Transfer `amount` whole tokens of `code` from the treasury to `to` (G or C). */
const fund = async (to: string, code: string, amount: number) => {
  const asset = TREASURY_ASSETS[code];
  if (!asset) throw new Error(`unknown asset ${code}`);
  const raw = BigInt(Math.round(amount * 10_000_000));
  const account = await server.getAccount(treasury.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(
      new Contract(asset.contractId(PASSPHRASE)).call(
        "transfer",
        nativeToScVal(treasury.publicKey(), { type: "address" }),
        nativeToScVal(to, { type: "address" }),
        nativeToScVal(raw, { type: "i128" }),
      ),
    )
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(treasury);
  const sent = await server.sendTransaction(prepared);
  if (sent.status !== "PENDING") {
    throw new Error(
      `send failed: ${sent.status} ${JSON.stringify(sent.errorResult)}`,
    );
  }
  // pollTransaction retries getTransaction with a bounded attempt count.
  const result = await server.pollTransaction(sent.hash, { attempts: 30 });
  if (result.status !== "SUCCESS")
    throw new Error(`tx ${sent.hash} ${result.status}`);
  return sent.hash;
};

/* ---------------------------------- Server --------------------------------- */

const json = (res: ServerResponse, status: number, body: unknown) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const readBody = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (c: Buffer) => (data += c.toString()));
    req.on("end", () => resolve(data));
  });

let busy = false;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  try {
    if (req.method === "GET" && url.pathname === "/api/batches") {
      return json(res, 200, loadStore().map(publicView));
    }
    if (req.method === "GET" && url.pathname.startsWith("/api/batches/")) {
      const id = Number(url.pathname.split("/").pop());
      const row = loadStore().find((b) => b.batchId === id);
      return row
        ? json(res, 200, publicView(row))
        : json(res, 404, { error: "not found" });
    }
    if (req.method === "POST" && url.pathname === "/api/batches") {
      if (busy)
        return json(res, 429, {
          error: "another listing is in progress, try again in a minute",
        });
      busy = true;
      try {
        const body = JSON.parse(await readBody(req)) as ListingRequest;
        for (const k of [
          "kind",
          "name",
          "description",
          "origin",
          "producer",
          "shares",
          "priceEur",
          "started",
          "ready",
        ] as const) {
          if (body[k] === undefined || body[k] === "")
            return json(res, 400, { error: `${k} is required` });
        }
        if (!(body.shares > 0) || !(body.priceEur > 0))
          return json(res, 400, { error: "shares and price must be positive" });
        if (new Date(body.ready) < new Date(body.started))
          return json(res, 400, { error: "ready date is before start" });
        const origin =
          req.headers["x-forwarded-origin"]?.toString() ??
          `${req.headers.origin ?? "https://fermento.app"}`;
        const row = await listBatch(body, origin);
        console.log(`listed batch ${row.batchId} "${row.name}"`, row.txs);
        return json(res, 201, publicView(row));
      } finally {
        busy = false;
      }
    }
    if (req.method === "GET" && url.pathname === "/api/treasury") {
      return json(res, 200, {
        address: treasury.publicKey(),
        max: FUND_MAX,
        assets: await treasuryBalances(),
      });
    }
    if (req.method === "POST" && url.pathname === "/api/fund") {
      const body = JSON.parse(await readBody(req)) as {
        to?: string;
        asset?: string;
        amount?: number;
      };
      if (!body.to || !/^[GC][A-Z2-7]{55}$/.test(body.to))
        return json(res, 400, { error: "to must be a G or C address" });
      if (!body.asset || !TREASURY_ASSETS[body.asset])
        return json(res, 400, { error: "asset must be USDC or EURC" });
      const amount = Number(body.amount);
      if (!(amount > 0) || amount > FUND_MAX)
        return json(res, 400, {
          error: `amount must be between 0 and ${FUND_MAX}`,
        });
      const hash = await fund(body.to, body.asset, amount);
      console.log(`funded ${body.to} with ${amount} ${body.asset}`, hash);
      return json(res, 200, { hash, asset: body.asset, amount });
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    console.error(err);
    json(res, 500, { error: err instanceof Error ? err.message : String(err) });
  }
}).listen(PORT, () => {
  console.log(
    `producer api on http://localhost:${PORT} as ${admin.publicKey()}`,
  );
  ensureTrustlines().catch((e) => console.error("trustlines:", e));
});
