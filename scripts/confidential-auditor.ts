/**
 * Fermento's confidential-token auditor key.
 *
 * Generates a Grumpkin key pair, registers the public point under auditor id 0
 * on Fermento's auditor registry and appends the secret to deploy/testnet.env.
 * The auditor can decrypt the amounts of every confidential transfer and
 * withdrawal made under this id (compliance), nothing else.
 *
 *   CONFIDENTIAL_AUDITOR=C... node --experimental-strip-types scripts/confidential-auditor.ts
 */
import { execSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { pointToBytes, randomScalar } from "stellar-confidential-token-sdk";
import { auditorPublicKey } from "stellar-confidential-token-sdk/chain";

const ENV_FILE = new URL("../deploy/testnet.env", import.meta.url);
/** Git-ignored: holds the auditor secret. */
const SECRET_FILE = new URL("../deploy/auditor.local.env", import.meta.url);
const env = Object.fromEntries(
  readFileSync(ENV_FILE, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#"))
    .map((l) => l.split("=", 2) as [string, string]),
);
const registry = process.env.CONFIDENTIAL_AUDITOR ?? env.CONFIDENTIAL_AUDITOR;
if (!registry) throw new Error("CONFIDENTIAL_AUDITOR missing");
if (env.AUDITOR_SECRET)
  throw new Error("AUDITOR_SECRET already set in deploy/testnet.env");
const adminKey = process.env.ADMIN_KEY ?? "fermento-admin";
const adminPk = execSync(`stellar keys public-key ${adminKey}`)
  .toString()
  .trim();

const k = randomScalar();
const point = Buffer.from(pointToBytes(auditorPublicKey(k))).toString("hex");
execSync(
  `stellar contract invoke --id ${registry} --source ${adminKey} --network testnet -- register_key --auditor_id 0 --point ${point} --operator ${adminPk}`,
  { stdio: "inherit" },
);
appendFileSync(ENV_FILE, `AUDITOR_ID=0\nAUDITOR_PUBLIC=${point}\n`);
writeFileSync(
  SECRET_FILE,
  `# Fermento auditor key (Grumpkin scalar). Decrypts the audit channel of every confidential transfer. Never commit.\nAUDITOR_SECRET=0x${k.toString(16)}\n`,
);
console.log(`auditor key 0 registered on ${registry}: ${point.slice(0, 16)}…`);
