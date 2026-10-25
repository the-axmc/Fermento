/**
 * Cellar sensor simulator.
 *
 * Signs a reading with the batch's sensor key and posts it to the condition
 * oracle, then publishes a fresh mark so the app chart moves. Run it once per
 * tick from cron, or let it loop with INTERVAL_SECONDS.
 *
 *   SENSOR_SECRET=S... RELAYER_SECRET=S... \
 *   node --experimental-strip-types scripts/sensor-sim.ts <batch-id>
 *
 * Env:
 *   SENSOR_SECRET     ed25519 secret of the sensor registered on the oracle (S...)
 *   RELAYER_SECRET    funded testnet account that pays the fee; defaults to SENSOR_SECRET
 *   ORACLE_ID         defaults to deploy/testnet.env
 *   RPC_URL           defaults to https://soroban-testnet.stellar.org
 *   INTERVAL_SECONDS  loop when set; one shot otherwise
 *   TEMP_C, HUMIDITY  fixed reading (0.01 C and bps); random walk otherwise
 *   DRIFT             "warm" pushes the random walk out of range, for the demo
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import {
  Contract,
  Keypair,
  Networks,
  TransactionBuilder,
  nativeToScVal,
  rpc,
  xdr,
} from "@stellar/stellar-sdk";

const RPC_URL = process.env.RPC_URL ?? "https://soroban-testnet.stellar.org";
const PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? Networks.TESTNET;

function envFile(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(new URL("../deploy/testnet.env", import.meta.url), "utf8")
        .split("\n")
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => l.split("=", 2) as [string, string]),
    );
  } catch {
    return {};
  }
}

const batchId = Number(process.argv[2]);
if (!Number.isInteger(batchId)) {
  console.error("usage: sensor-sim.ts <batch-id>");
  process.exit(1);
}
const deployed = envFile();
const ORACLE_ID = process.env.ORACLE_ID ?? deployed.ORACLE_ID;
if (!ORACLE_ID)
  throw new Error("ORACLE_ID missing (run scripts/deploy-testnet.sh)");
// Sensor key: SENSOR_SECRET, or the key the producer API generated for this batch.
const storedSensor = (() => {
  try {
    const rows = JSON.parse(
      readFileSync(new URL("../deploy/batches.json", import.meta.url), "utf8"),
    ) as { batchId: number; sensorSecret?: string }[];
    return rows.find((b) => b.batchId === batchId)?.sensorSecret;
  } catch {
    return undefined;
  }
})();
/** Batches opened with scripts/open-batch.sh record a CLI key name in deploy/testnet.env. */
const cliSensor = (() => {
  const name = deployed[`BATCH_${batchId}_SENSOR`];
  if (!name) return undefined;
  try {
    return execSync(`stellar keys secret ${name}`).toString().trim();
  } catch {
    return undefined;
  }
})();
const sensorSecret = process.env.SENSOR_SECRET ?? storedSensor ?? cliSensor;
if (!sensorSecret) {
  throw new Error(
    "SENSOR_SECRET missing; batch not in deploy/batches.json or deploy/testnet.env",
  );
}
const sensor = Keypair.fromSecret(sensorSecret);
const relayer = process.env.RELAYER_SECRET
  ? Keypair.fromSecret(process.env.RELAYER_SECRET)
  : sensor;

const server = new rpc.Server(RPC_URL);
const oracle = new Contract(ORACLE_ID);

/** 20-byte big-endian payload: batch_id u32 | timestamp u64 | temp_c i32 | humidity u32 */
function payload(r: {
  timestamp: bigint;
  tempC: number;
  humidity: number;
}): Buffer {
  const b = Buffer.alloc(20);
  b.writeUInt32BE(batchId, 0);
  b.writeBigUInt64BE(r.timestamp, 4);
  b.writeInt32BE(r.tempC, 12);
  b.writeUInt32BE(r.humidity, 16);
  return b;
}

/** Random walk around 15 C / 70 % RH; "warm" drifts up ~1 C per tick. */
let tempC = Number(process.env.TEMP_C ?? 1500);
let humidity = Number(process.env.HUMIDITY ?? 7000);
function nextReading() {
  if (process.env.TEMP_C === undefined) {
    tempC +=
      Math.round((Math.random() - 0.5) * 60) +
      (process.env.DRIFT === "warm" ? 100 : 0);
  }
  if (process.env.HUMIDITY === undefined) {
    humidity = Math.max(
      0,
      Math.min(10_000, humidity + Math.round((Math.random() - 0.5) * 200)),
    );
  }
  return { timestamp: BigInt(Math.floor(Date.now() / 1000)), tempC, humidity };
}

async function invoke(op: xdr.Operation) {
  const account = await server.getAccount(relayer.publicKey());
  const tx = new TransactionBuilder(account, {
    fee: "100000",
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(op)
    .setTimeout(60)
    .build();
  const prepared = await server.prepareTransaction(tx);
  prepared.sign(relayer);
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
  return { hash: sent.hash, returnValue: result.returnValue };
}

async function tick() {
  const r = nextReading();
  const signature = sensor.sign(payload(r));

  const reading = nativeToScVal(
    {
      batch_id: batchId,
      timestamp: r.timestamp,
      temp_c: r.tempC,
      humidity: r.humidity,
    },
    {
      type: {
        batch_id: ["symbol", "u32"],
        timestamp: ["symbol", "u64"],
        temp_c: ["symbol", "i32"],
        humidity: ["symbol", "u32"],
      },
    },
  );

  const posted = await invoke(
    oracle.call(
      "post_reading",
      nativeToScVal(batchId, { type: "u32" }),
      reading,
      nativeToScVal(signature, { type: "bytes" }),
    ),
  );
  const inRange = posted.returnValue ? posted.returnValue.value() : undefined;
  console.log(
    `[${new Date().toISOString()}] batch ${batchId} ${(r.tempC / 100).toFixed(2)} C ` +
      `${(r.humidity / 100).toFixed(0)} % RH in_range=${String(inRange)} tx=${posted.hash}`,
  );

  const mark = await invoke(
    oracle.call("publish_mark", nativeToScVal(batchId, { type: "u32" })),
  );
  console.log(`  mark published tx=${mark.hash}`);
}

const interval = Number(process.env.INTERVAL_SECONDS ?? 0);
await tick();
if (interval > 0) {
  setInterval(() => tick().catch((e) => console.error(e)), interval * 1000);
}
