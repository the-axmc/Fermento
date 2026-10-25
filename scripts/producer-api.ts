/**
 * Producer API: everything the producer side of the app needs that a phone
 * passkey account cannot do on its own.
 *
 *   - lists a batch from the "Add a ferment" page: needs the platform's admin
 *     roles (minter, curator, issuer) and a classic account to issue the share
 *     asset. Performs the steps scripts/open-batch.sh does by hand, then names
 *     the producer on the registry and the oracle so the producer's own
 *     account can link an NFC tag and post check-ins.
 *   - keeps producer profiles (name, story, logo) and certification
 *     applications in deploy/producers.json; an admin approves an application
 *     and the producer's rating goes on chain.
 *   - runs the oracle keeper: every KEEPER_MINUTES it re-rates each producer
 *     from certification and sales traction (`set_rating`) and publishes a
 *     fresh mark for every batch so the charts move.
 *   - testnet "Add funds" from a treasury account.
 *
 *   npm run producer-api          # listens on http://localhost:8787
 *
 * Env:
 *   ADMIN_KEY       Stellar CLI identity name holding the roles (default fermento-admin)
 *   ADMIN_SECRET    S... secret, used instead of the CLI identity when set
 *   ADMIN_TOKEN     shared secret for certification review; unset = localhost only
 *   KEEPER_MINUTES  oracle keeper period, 0 disables (default 10)
 *   PORT            default 8787
 *
 * Vite proxies /api/* here in development (see vite.config.ts).
 */

import {
  createServer,
  type IncomingMessage,
  type ServerResponse,
} from "node:http";
import { execSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
const PRODUCERS_FILE = new URL("deploy/producers.json", ROOT);
const UPLOADS_DIR = new URL("deploy/uploads/", ROOT);
const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;
const PORT = Number(process.env.PORT ?? 8787);
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const KEEPER_MINUTES = Number(process.env.KEEPER_MINUTES ?? 10);
const FIRST_BATCH_ID = 100;
/** Largest logo (data URL) and document (base64) accepted, in bytes. */
const MAX_LOGO = 300_000;
const MAX_DOCUMENT = 6_000_000;

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

/* ---------------------------------- Stores --------------------------------- */

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
  /** False for ferments the producer only tracks (no share asset, no offering). */
  onSale: boolean;
  shareToken?: string;
  /** Locked issuer of the share asset (master weight 0). */
  shareIssuer?: string;
  sensorPublic: string;
  /** Kept server side only. */
  sensorSecret: string;
  listedAt: string;
  txs: Record<string, string>;
}

export type ProducerTier = "amateur" | "certified";

interface Certification {
  id: string;
  status: "pending" | "approved" | "rejected";
  legalName: string;
  vatNumber: string;
  country: string;
  website: string;
  /** Uploaded registration document, under deploy/uploads/. Server side only. */
  documentFile?: string;
  documentName?: string;
  submittedAt: string;
  reviewedAt?: string;
  note?: string;
}

interface Producer {
  /** Smart account (C...) or classic account (G...) that receives sales. */
  address: string;
  slug: string;
  name: string;
  location: string;
  story: string;
  kinds: Kind[];
  website?: string;
  /** Year the producer joined. */
  since: number;
  tier: ProducerTier;
  /** Square SVG or PNG as a data URL; certified producers only. */
  logo?: string;
  /** Last rating posted on chain by the keeper, in bps. */
  ratingBps?: number;
  certification?: Certification;
  updatedAt: string;
}

const readJson = <T>(file: URL, fallback: T): T =>
  existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
const writeJson = (file: URL, rows: unknown) =>
  writeFileSync(file, JSON.stringify(rows, null, 2) + "\n");

const loadStore = () => readJson<StoredBatch[]>(STORE_FILE, []);
const saveStore = (rows: StoredBatch[]) => writeJson(STORE_FILE, rows);
const publicBatch = ({ sensorSecret: _s, ...rest }: StoredBatch) => rest;

const loadProducers = () => readJson<Producer[]>(PRODUCERS_FILE, []);
const saveProducers = (rows: Producer[]) => writeJson(PRODUCERS_FILE, rows);
/** What the app may see of a producer: no document path, no review note. */
const publicProducer = (p: Producer) => {
  const { certification, ...rest } = p;
  return {
    ...rest,
    certification: certification && {
      id: certification.id,
      status: certification.status,
      legalName: certification.legalName,
      country: certification.country,
      website: certification.website,
      submittedAt: certification.submittedAt,
      reviewedAt: certification.reviewedAt,
      documentName: certification.documentName,
    },
  };
};

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

/** A slug nobody else holds, suffixing a number when needed. */
const uniqueSlug = (base: string, address: string, rows: Producer[]) => {
  const root = slug(base) || "producer";
  let candidate = root;
  for (
    let n = 2;
    rows.some((p) => p.slug === candidate && p.address !== address);
    n++
  ) {
    candidate = `${root}-${n}`;
  }
  return candidate;
};

/** Find or create the profile of an account, defaulting the name from a listing. */
const upsertProducer = (
  address: string,
  patch: Partial<Omit<Producer, "address" | "tier" | "certification">>,
) => {
  const rows = loadProducers();
  const existing = rows.find((p) => p.address === address);
  const now = new Date().toISOString();
  const next: Producer = existing
    ? { ...existing, ...patch, updatedAt: now }
    : {
        address,
        slug: "",
        name: patch.name ?? "New producer",
        location: patch.location ?? "",
        story: patch.story ?? "",
        kinds: patch.kinds ?? [],
        since: new Date().getFullYear(),
        tier: "amateur",
        updatedAt: now,
        ...patch,
      };
  next.slug = uniqueSlug(patch.name ?? next.name, address, rows);
  const others = rows.filter((p) => p.address !== address);
  saveProducers([...others, next]);
  return next;
};

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

/** Result of a read-only call, or undefined when it panics or fails. */
const read = async <T>(
  call: () => Promise<contract.AssembledTransaction<T>>,
): Promise<T | undefined> => {
  try {
    const tx = await call();
    if (!tx.simulation || rpc.Api.isSimulationError(tx.simulation))
      return undefined;
    return tx.result;
  } catch {
    return undefined;
  }
};

/** True when a read-only call returns a value (reads that panic throw on `.result`). */
const exists = async <T>(
  call: () => Promise<contract.AssembledTransaction<T>>,
) => {
  try {
    const tx = await call();
    // A read that panics still returns; its simulation carries the error.
    return !!tx.simulation && !rpc.Api.isSimulationError(tx.simulation);
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
  /** "sale" opens a primary offering; "track" only registers the batch. */
  listing?: "sale" | "track";
}

const listBatch = async (req: ListingRequest, origin: string) => {
  const store = loadStore();
  const batchId =
    store.reduce((m, b) => Math.max(m, b.batchId), FIRST_BATCH_ID - 1) + 1;
  const d = KIND_DEFAULTS[req.kind] ?? KIND_DEFAULTS.other;
  const caller = admin.publicKey();
  const producerAddress = req.producerAddress ?? caller;
  const onSale = req.listing !== "track";
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
          fee_per_share_day: onSale ? FEE_PER_SHARE_DAY : 0n,
          temp_min: d.temp[0],
          temp_max: d.temp[1],
          humidity_min: d.hum[0],
          humidity_max: d.hum[1],
        },
      }),
    );

  // 4. the producer's own account gets to post check-ins and link the NFC tag
  txs.oracleProducer = await send(
    await oracle.set_producer({
      batch_id: batchId,
      producer: producerAddress,
      caller,
    }),
  );
  txs.registryProducer = await send(
    await registry.set_producer({
      batch_id: batchId,
      producer: producerAddress,
      caller,
    }),
  );

  let shareToken: string | undefined;
  let shareIssuer: string | undefined;
  if (onSale) {
    // 5. share asset from a fresh, locked issuer; SAC admin is the shares contract.
    //    A retry after a failure here issues a new asset: nothing was sold yet.
    const code = `FERM${String(batchId).padStart(3, "0")}`;
    const existing = store.find((b) => b.batchId === batchId);
    const issued =
      existing?.shareToken &&
      (await sacAdmin(existing.shareToken)) === deployed.SHARES_ID
        ? { sac: existing.shareToken, issuer: existing.shareIssuer ?? "" }
        : await issueShareAsset(code);
    shareToken = issued.sac;
    shareIssuer = issued.issuer;
    txs.shareAsset = shareToken;

    // 6. primary offering
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
  }

  // The producer's page exists from the first listing on.
  const profile = upsertProducer(producerAddress, {
    ...(loadProducers().some((p) => p.address === producerAddress)
      ? {}
      : { name: req.producer, location: req.origin }),
  });
  const kinds = Array.from(new Set([...profile.kinds, req.kind]));
  upsertProducer(producerAddress, { kinds });

  const row: StoredBatch = {
    batchId,
    kind: req.kind,
    cat: d.cat,
    name: req.name,
    label: `Batch Nº ${String(batchId).padStart(3, "0")}`,
    vintage: String(new Date(req.started).getFullYear()),
    description: req.description,
    producer: profile.name,
    producerSlug: profile.slug,
    producerAddress,
    region: req.origin,
    category: `${d.cat} · ${req.kind}`,
    unit: d.unit,
    glass: d.colors[0],
    cap: d.colors[1],
    labelColor: d.colors[2],
    tile: d.colors[3],
    onSale,
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

/* ------------------------------ Certification ------------------------------ */

interface CertificationRequest {
  address: string;
  legalName: string;
  vatNumber: string;
  country: string;
  website: string;
  /** Square SVG or PNG as a data URL. */
  logo: string;
  /** Business registration, base64 without the data URL prefix. */
  document: string;
  documentName: string;
}

const applyForCertification = (req: CertificationRequest) => {
  if (!/^[GC][A-Z2-7]{55}$/.test(req.address))
    throw new Error("address must be a G or C address");
  for (const k of [
    "legalName",
    "vatNumber",
    "country",
    "logo",
    "document",
  ] as const) {
    if (!req[k]) throw new Error(`${k} is required`);
  }
  if (!/^data:image\/(svg\+xml|png);base64,/.test(req.logo))
    throw new Error("logo must be a PNG or SVG data URL");
  if (req.logo.length > MAX_LOGO) throw new Error("logo is larger than 300 KB");
  if (req.document.length > MAX_DOCUMENT)
    throw new Error("document is larger than 4 MB");

  const rows = loadProducers();
  const existing = rows.find((p) => p.address === req.address);
  if (existing?.certification?.status === "pending")
    throw new Error("an application is already under review");
  if (existing?.tier === "certified") throw new Error("already certified");

  mkdirSync(UPLOADS_DIR, { recursive: true });
  const id = randomUUID();
  const ext = /\.pdf$/i.test(req.documentName) ? "pdf" : "bin";
  const documentFile = `${id}.${ext}`;
  writeFileSync(
    new URL(documentFile, UPLOADS_DIR),
    Buffer.from(req.document, "base64"),
  );

  const certification: Certification = {
    id,
    status: "pending",
    legalName: req.legalName.trim(),
    vatNumber: req.vatNumber.trim(),
    country: req.country.trim(),
    website: req.website.trim(),
    documentFile,
    documentName: req.documentName,
    submittedAt: new Date().toISOString(),
  };
  const base = upsertProducer(req.address, {
    website: certification.website || undefined,
    logo: req.logo,
  });
  const next: Producer = { ...base, certification };
  saveProducers([
    ...loadProducers().filter((p) => p.address !== req.address),
    next,
  ]);
  return next;
};

/**
 * Approve or reject. Approval makes the producer certified and posts its
 * rating on chain, so every batch it produces is marked up at once.
 */
const reviewCertification = async (
  id: string,
  decision: "approve" | "reject",
  note?: string,
) => {
  const rows = loadProducers();
  const p = rows.find((r) => r.certification?.id === id);
  if (!p?.certification) throw new Error("application not found");
  if (p.certification.status !== "pending")
    throw new Error(`application already ${p.certification.status}`);
  const certification: Certification = {
    ...p.certification,
    status: decision === "approve" ? "approved" : "rejected",
    reviewedAt: new Date().toISOString(),
    note,
  };
  const next: Producer = {
    ...p,
    certification,
    tier: decision === "approve" ? "certified" : p.tier,
    logo: decision === "approve" ? p.logo : undefined,
    updatedAt: new Date().toISOString(),
  };
  saveProducers([...rows.filter((r) => r.address !== p.address), next]);
  if (decision === "approve") await rateProducer(next.address);
  return next;
};

/* ------------------------------ Oracle keeper ------------------------------ */
//
// The producer's rating is the "market value of the company" factor of the
// mark: 1.0 for a new amateur producer, up with certification, with shares
// actually sold, and with a track record of batches. Each batch's mark then
// multiplies it with age, cellar conditions and the producer's check-ins
// (computed on chain). Marks are published here once per period so the
// charts move even when no reading or check-in arrives.

const BPS = 10_000;
const RATING_CERTIFIED = 600;
const RATING_TRACTION_MAX = 600;
const RATING_PER_EXTRA_BATCH = 100;
const RATING_TRACK_RECORD_MAX = 300;

/** Batch ids opened by hand with scripts/open-batch.sh (BATCH_<id>_SHARE_SAC in deploy/testnet.env). */
const cliBatchIds = () =>
  Object.keys(deployed)
    .map((k) => /^BATCH_(\d+)_SHARE_SAC$/.exec(k)?.[1])
    .filter((id): id is string => !!id)
    .map(Number);

/** Every batch the keeper marks: listed through the API or opened by hand. */
const knownBatchIds = () =>
  Array.from(new Set([...loadStore().map((b) => b.batchId), ...cliBatchIds()]));

/** Every batch of a producer: listed through the API, or opened by hand with it as the offering's producer. */
const batchesOf = async (address: string) => {
  const mine = loadStore()
    .filter((b) => b.producerAddress === address)
    .map((b) => ({ batchId: b.batchId, onSale: b.onSale }));
  for (const batchId of cliBatchIds()) {
    const o = await read(() => shares.offering({ batch_id: batchId }));
    if (o?.producer === address) mine.push({ batchId, onSale: true });
  }
  return mine;
};

const computeRating = async (address: string) => {
  const p = loadProducers().find((r) => r.address === address);
  const mine = await batchesOf(address);
  let rating = BPS;
  if (p?.tier === "certified") rating += RATING_CERTIFIED;

  const offerings = (
    await Promise.all(
      mine
        .filter((b) => b.onSale)
        .map((b) => read(() => shares.offering({ batch_id: b.batchId }))),
    )
  ).filter((o) => o !== undefined);
  if (offerings.length > 0) {
    const ratio =
      offerings.reduce(
        (sum, o) => sum + Number(o.sold) / Math.max(1, Number(o.total_shares)),
        0,
      ) / offerings.length;
    rating += Math.round(RATING_TRACTION_MAX * ratio);
  }
  rating += Math.min(
    RATING_TRACK_RECORD_MAX,
    Math.max(0, mine.length - 1) * RATING_PER_EXTRA_BATCH,
  );
  return rating;
};

/** Post the rating when it differs from what the chain holds. */
const rateProducer = async (address: string) => {
  const rows = loadProducers();
  const p = rows.find((r) => r.address === address);
  const certified = p?.tier === "certified";
  const index = await computeRating(address);
  const onChain = await read(() => oracle.rating({ producer: address }));
  if (
    onChain &&
    Number(onChain.index_bps) === index &&
    onChain.certified === certified
  ) {
    return { index, changed: false };
  }
  const hash = await send(
    await oracle.set_rating({
      producer: address,
      index_bps: BigInt(index),
      certified,
      caller: admin.publicKey(),
    }),
  );
  if (p) {
    saveProducers([
      ...rows.filter((r) => r.address !== address),
      { ...p, ratingBps: index, updatedAt: new Date().toISOString() },
    ]);
  }
  console.log(
    `rated ${address} at ${index} bps (certified=${certified})`,
    hash,
  );
  return { index, changed: true, hash };
};

let keeperBusy = false;
const keeperTick = async () => {
  if (keeperBusy) return { skipped: true };
  keeperBusy = true;
  const report: Record<string, unknown> = {};
  try {
    const addresses = new Set(loadStore().map((b) => b.producerAddress));
    for (const p of loadProducers()) addresses.add(p.address);
    for (const a of addresses) {
      try {
        report[`rating:${a}`] = await rateProducer(a);
      } catch (e) {
        report[`rating:${a}`] = String(e);
      }
    }
    for (const batchId of knownBatchIds()) {
      try {
        report[`mark:${batchId}`] = await send(
          await oracle.publish_mark({ batch_id: batchId }),
        );
      } catch (e) {
        report[`mark:${batchId}`] = String(e);
      }
    }
  } finally {
    keeperBusy = false;
  }
  return report;
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

const isAddress = (s: unknown): s is string =>
  typeof s === "string" && /^[GC][A-Z2-7]{55}$/.test(s);

/** Review calls need ADMIN_TOKEN, or come from this machine when none is set. */
const isAdmin = (req: IncomingMessage) => {
  if (ADMIN_TOKEN) return req.headers["x-admin-token"] === ADMIN_TOKEN;
  const ip = req.socket.remoteAddress ?? "";
  return ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
};

/** sha256 of an NFC tag serial, the value the registry stores. */
const tagHash = (serial: string) =>
  createHash("sha256").update(serial.trim().toLowerCase()).digest("hex");

let busy = false;

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const path = url.pathname;
  const seg = path.split("/").filter(Boolean); // ["api", ...]
  try {
    // ---- batches ----
    if (req.method === "GET" && path === "/api/batches") {
      return json(res, 200, loadStore().map(publicBatch));
    }
    if (req.method === "GET" && seg[1] === "batches" && seg.length === 3) {
      const row = loadStore().find((b) => b.batchId === Number(seg[2]));
      return row
        ? json(res, 200, publicBatch(row))
        : json(res, 404, { error: "not found" });
    }
    if (req.method === "POST" && path === "/api/batches") {
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
        if (body.producerAddress && !isAddress(body.producerAddress))
          return json(res, 400, { error: "producerAddress is not an address" });
        const origin =
          req.headers["x-forwarded-origin"]?.toString() ??
          `${req.headers.origin ?? "https://fermento.app"}`;
        const row = await listBatch(body, origin);
        console.log(`listed batch ${row.batchId} "${row.name}"`, row.txs);
        return json(res, 201, publicBatch(row));
      } finally {
        busy = false;
      }
    }

    // ---- producers ----
    if (req.method === "GET" && path === "/api/producers") {
      return json(res, 200, loadProducers().map(publicProducer));
    }
    if (req.method === "GET" && seg[1] === "producers" && seg.length === 3) {
      const key = decodeURIComponent(seg[2]);
      const p = loadProducers().find(
        (r) => r.slug === key || r.address === key,
      );
      if (!p) return json(res, 404, { error: "not found" });
      return json(res, 200, {
        ...publicProducer(p),
        batches: loadStore()
          .filter((b) => b.producerAddress === p.address)
          .map(publicBatch),
      });
    }
    if (req.method === "PUT" && seg[1] === "producers" && seg.length === 3) {
      // Profile text is off chain; the address is trusted here because the
      // page only lets the signed-in account edit its own profile. Anything
      // with value (check-ins, tags, ratings) is authorized on chain.
      const address = decodeURIComponent(seg[2]);
      if (!isAddress(address))
        return json(res, 400, { error: "address must be a G or C address" });
      const body = JSON.parse(await readBody(req)) as Partial<Producer>;
      const patch: Partial<Producer> = {};
      if (typeof body.name === "string" && body.name.trim())
        patch.name = body.name.trim().slice(0, 60);
      if (typeof body.location === "string")
        patch.location = body.location.trim().slice(0, 80);
      if (typeof body.story === "string")
        patch.story = body.story.trim().slice(0, 600);
      if (Array.isArray(body.kinds))
        patch.kinds = body.kinds.filter(
          (k): k is Kind => typeof k === "string" && k in KIND_DEFAULTS,
        );
      if (typeof body.website === "string")
        patch.website = body.website.trim().slice(0, 120) || undefined;
      const p = upsertProducer(address, patch);
      // Listings carry the producer's name, keep them in step.
      saveStore(
        loadStore().map((b) =>
          b.producerAddress === address
            ? { ...b, producer: p.name, producerSlug: p.slug }
            : b,
        ),
      );
      return json(res, 200, publicProducer(p));
    }

    // ---- certification ----
    if (req.method === "POST" && path === "/api/certification") {
      const body = JSON.parse(await readBody(req)) as CertificationRequest;
      const p = applyForCertification(body);
      console.log(
        `certification requested by ${p.address} (${p.certification?.legalName})`,
      );
      return json(res, 201, publicProducer(p));
    }
    if (req.method === "GET" && path === "/api/certification") {
      if (!isAdmin(req)) return json(res, 403, { error: "admin only" });
      return json(
        res,
        200,
        loadProducers()
          .filter((p) => p.certification)
          .map((p) => ({
            address: p.address,
            name: p.name,
            ...p.certification,
          })),
      );
    }
    if (
      req.method === "POST" &&
      seg[1] === "certification" &&
      seg.length === 4 &&
      (seg[3] === "approve" || seg[3] === "reject")
    ) {
      if (!isAdmin(req)) return json(res, 403, { error: "admin only" });
      const body = (await readBody(req)) || "{}";
      const { note } = JSON.parse(body) as { note?: string };
      const p = await reviewCertification(seg[2], seg[3], note);
      console.log(`certification ${seg[2]} ${seg[3]}d for ${p.address}`);
      return json(res, 200, publicProducer(p));
    }

    // ---- oracle ----
    if (req.method === "POST" && path === "/api/oracle/tick") {
      if (!isAdmin(req)) return json(res, 403, { error: "admin only" });
      return json(res, 200, await keeperTick());
    }
    if (req.method === "GET" && path === "/api/oracle/tag") {
      // The app hashes serials itself; this is for the warehouse tooling.
      const serial = url.searchParams.get("serial") ?? "";
      if (!serial) return json(res, 400, { error: "serial is required" });
      return json(res, 200, { hash: tagHash(serial) });
    }

    // ---- treasury ----
    if (req.method === "GET" && path === "/api/treasury") {
      return json(res, 200, {
        address: treasury.publicKey(),
        max: FUND_MAX,
        assets: await treasuryBalances(),
      });
    }
    if (req.method === "POST" && path === "/api/fund") {
      const body = JSON.parse(await readBody(req)) as {
        to?: string;
        asset?: string;
        amount?: number;
      };
      if (!isAddress(body.to))
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
  if (KEEPER_MINUTES > 0) {
    console.log(`oracle keeper every ${KEEPER_MINUTES} min`);
    setInterval(
      () => keeperTick().catch((e) => console.error("keeper:", e)),
      KEEPER_MINUTES * 60_000,
    );
  }
});
