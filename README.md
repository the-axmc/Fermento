# Fermento

Reserve units of a batch while it ages: a cask of Moscatel, a wheel of Serra da
Estrela, a vat of kombucha. Producers are paid when the batch is filled instead
of when it is ready. Buyers follow its condition from the cellar, resell their
tokens to other buyers, and collect their units at maturity. Built on Stellar,
with passkey accounts: no wallet to install, no seed phrase, no XLM.

See [BUILD_PLAN.md](BUILD_PLAN.md) for the HackMeridian scope.

## State of the repo

- Tag `pre-hackmeridian` is the baseline before the hackathon: a Scaffold
  Stellar batch tracker with one OpenZeppelin NFT contract.
- Everything after that tag is HackMeridian work: the token sale with escrow,
  the condition oracle, resale, confidential balances, producer pages and
  card or bank top-ups.

## How it works

| Contract                       | Package                       | Role                                                                                                                         |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `contracts/non_fungible`       | `batch_registry_contract`     | Batch registry: one NFT per physical batch, its stage, NFC tag, the inspector's attestation of how many units exist, claims. |
| `contracts/batch_shares`       | `batch_shares_contract`       | Primary sale of each batch's tokens (a classic asset and its SAC), escrow, storage fees, resale listings, redemption.        |
| `contracts/condition_oracle`   | `condition_oracle_contract`   | Signed cellar readings, age curves, check-ins, producer ratings and the value mark.                                          |
| `contracts/confidential_token` | `confidential_token_contract` | OpenZeppelin confidential token wasm, one wrapper per batch (developer preview, see below).                                  |

Roles are OpenZeppelin `AccessControl`; every contract is upgradeable by the
`upgrader` role and the registry and sale are pausable.

**Buyer protection.** A sale only opens once an independent inspector has
attested the batch, and never for more units than attested. Each payment is
split: 70 % goes to the producer at once, 15 % is released when the inspector
confirms the batch while it ages, and 15 % per claim once the buyer collects
the units. If the inspector declares the batch failed, sales and redemption
stop and holders take back what is still held. Batches opened before escrow
existed (batch 14 on testnet) pay the producer in full and have none of this.

**Resale.** Holders list tokens at their own price and others buy them in
whole or in part; 1 % goes to the treasury. Up to 40 listings per batch are
open at once; when they are all taken, a cheaper listing replaces the dearest
one and its tokens go back to their seller.

**Storage fee.** Each token accrues a daily fee from the day it was bought,
paid when it is redeemed. The checkpoint moves with tokens sold on the resale
market; tokens received any other way pay from the fill date.

## Layout

```
contracts/                    Soroban contracts (table above), tests beside each
packages/*_contract           Generated TypeScript clients, committed
src/                          React + Vite app
  pages/                      Market, batch, portfolio, producer, inspect, wallet
  hooks/                      Chain reads (useBatchChain), account, holdings, producer
  lib/                        Anchor top-ups, API sign-in, confidential balances, NFC
  wallet/                     Smart Account Kit and relayer
  data/                       Story and artwork per batch id
scripts/                      Deploy, upgrade, open a batch, producer API, sensor
deploy/testnet.env            Deployed contract IDs (secrets live in git-ignored files)
```

## Requirements

Rust with the `wasm32v1-none` target (the toolchain is pinned in
`rust-toolchain.toml`), Node 22+ and the Stellar CLI. Installation links are in
the [Soroban setup guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup).

## Run

```bash
npm install
cp .env.example .env        # contract IDs from deploy/testnet.env
npm run producer-api        # http://localhost:8787, prints the admin token
npm run dev                 # http://localhost:5173, proxies /api
```

Passkeys need HTTPS on a phone: reach the dev server through a tunnel (the
allowed hosts are in `vite.config.ts`).

Tests and builds:

```bash
cargo test                  # contract tests
npm run build               # clients, typecheck, Vite build
node scripts/confidential-e2e.mjs   # confidential wrapper smoke test on testnet
```

## Testnet

Contract IDs are in `deploy/testnet.env`, written by
`scripts/deploy-testnet.sh`. Testnet resets wipe them; after a reset, deploy
again and copy the IDs into `.env`.

- `scripts/open-batch.sh <admin> <batch-id> <category>` registers a batch end to
  end: registry token, oracle terms and sensor, share asset, attestation and
  the sale. Producers can do the same from the app (`/produce`) through the
  producer API.
- `scripts/upgrade-testnet.sh <admin> [registry|oracle|shares]` uploads only
  the contracts whose wasm changed. Uploading 35 KB of code costs thousands of
  XLM in rent on testnet at the moment, so top the admin up first by merging
  Friendbot-funded accounts into it.
- `scripts/extend-ttl.sh` keeps contract instances and code alive.
- `npm run sensor -- <batch-id>` signs and posts a cellar reading.

After changing a contract: `stellar contract build && npm run bindings`.

## Producer side

A producer is any passkey account that lists or registers a batch. Two tiers:

- **Amateur**: the default. A page with a monogram, a story and the batches.
- **Certified**: a registered company. Applies in the app (`/certify`) with
  legal name, VAT number, logo and registration document; an admin approves
  and the producer's rating goes on chain. Certified producers get the badge,
  their logo on every product and a higher rating.

Pages:

| Route                | Who           | What                                                                        |
| -------------------- | ------------- | --------------------------------------------------------------------------- |
| `/producer/me`       | the producer  | Own page: batches, stats, "Get certified", edit. Certified: dashboard view. |
| `/producer/<slug>`   | anyone        | Public page with the badge, story, batches on the market, website.          |
| `/producer/edit`     | the producer  | Name, place, story, what they make.                                         |
| `/certify`           | the producer  | Certification application and its status.                                   |
| `/batch/<id>/manage` | the producer  | Per-batch page: value mark and its factors, NFC card link, check-ins.       |
| `/produce`           | the producer  | Add a batch: put it on sale, or just register and track it.                 |
| `/inspect`           | the inspector | Attest batches, record visits, declare a failed batch (admin token).        |

What the producer signs with its passkey (fee-sponsored, on chain):

- `condition_oracle.post_checkin`: a lab reading, tasting note, photo or
  racking with a 0-100 score. Kept on chain for holders.
- `batch_registry.link_tag`: binds an NFC card to the batch. The app writes
  the batch URL to the card with Web NFC (Android Chrome) and stores
  `sha256(serial)` on chain; iPhones type the serial after writing with any NFC
  app. Anyone tapping the card lands on the batch page, which shows it is linked.
  Once the batch is attested, only the inspector can re-link it.

### The value mark

```
mark = fill_price
     × age_curve[category](months)        seeded per category
     × condition(readings in range)       cellar sensor, 0.7 … 1.0
     × care(inspections)                  1.0 … 1.2
     × producer_rating                    0.8 … 1.2
     − storage fee accrued per token
```

- **Condition**: readings are ed25519-signed by the batch's sensor over the
  oracle's contract id, the batch, the time and the values, so they cannot be
  replayed on another deployment.
- **Care**: an inspector's visit earns up to +5 % scaled by its score, capped
  at +20 %. After two weeks without a visit or check-in the bonus decays 0.25 %
  a day. A producer check-in restarts the two weeks but adds nothing and never
  brings back what has decayed: a producer cannot raise its own mark.
- **Producer rating**: posted by the keeper in `scripts/producer-api.ts` from
  certification (+6 %), the average share of each offering sold (up to +3 %)
  and track record (+1 % per extra batch, up to +3 %). Stored on chain with the
  certified flag, so the badge is verifiable.
- `breakdown(batch_id)` returns every factor, `mark(batch_id)` the value.
  `publish_mark` adds to the chart history at most once every 10 minutes.

### Producer API

`scripts/producer-api.ts` does what a passkey account cannot do on its own:
listing needs the platform's admin roles and a classic account to issue the
token asset. It also keeps producer profiles, runs the oracle keeper and the
testnet faucet.

| Method and path                                                                   | Who          | Purpose                                                  |
| --------------------------------------------------------------------------------- | ------------ | -------------------------------------------------------- |
| `GET /api/auth?account=&home_domain=`, `POST /api/auth`                           | anyone       | Sign in: SEP-45 challenge, answered with a session token |
| `GET /api/batches`, `GET /api/producers/<slug or addr>`                           | anyone       | Listed batches, a profile and its batches                |
| `POST /api/batches`                                                               | signed in    | List (`listing: "sale"`) or register (`"track"`) a batch |
| `PUT /api/producers/<addr>`                                                       | that account | Edit the profile                                         |
| `POST /api/certification`                                                         | that account | Apply (logo data URL, document base64)                   |
| `GET /api/certification`, `POST /api/certification/<id>/approve` or `/reject`     | admin        | Review; approval posts the rating on chain               |
| `GET /api/inspections`, `POST /api/inspections/<id>/attest`, `/visit`, `/default` | admin        | The inspector's queue and actions                        |
| `POST /api/oracle/tick`                                                           | admin        | Run the keeper now                                       |
| `GET /api/treasury`, `POST /api/fund`                                             | anyone       | Testnet USDC or EURC, once an hour per account           |

- **Sign-in** works like SEP-45: the API sends a `web_auth_verify` call as
  Soroban authorization entries, the passkey signs the account's entry, and the
  API replays the call in an enforcing simulation, which runs the account's own
  signature check, then answers with a token valid for an hour. The app does
  this on the first call that needs it (`src/lib/apiAuth.ts`).
- **Admin** calls need the `X-Admin-Token` header. Set `ADMIN_TOKEN`, or copy
  the one the API prints at start into the Inspect page.
- The keeper runs every `KEEPER_MINUTES` (default 10): rates every producer
  and publishes a mark for every batch.
- Profiles and applications live in `deploy/producers.json` and
  `deploy/uploads/`, listed batches in `deploy/batches.json` (all git-ignored).

### Card and bank top-ups

The wallet page tops up through a Stellar anchor (`PUBLIC_ANCHOR_DOMAIN`, the
SDF test anchor by default): SEP-45 signs the smart account in, SEP-24 opens
the anchor's own payment page, and the stablecoin arrives in the account.
Anchors that only offer SEP-10 cannot sign in a passkey account and are shown
as unsupported. Code: `src/lib/anchor.ts`.

### Private shares (confidential tokens, developer preview)

Every batch listed for sale also gets a **confidential wrapper**: an
OpenZeppelin confidential token over the batch's share asset. A holder can
move shares into it from the batch page ("Keep private"), send them to another
holder privately, and withdraw them before redeeming. On chain the wrapper
holds Pedersen commitments; the amounts are decrypted only on the holder's
phone. Sender and recipient addresses stay public. Fermento holds the auditor
key and can read amounts for compliance.

How it is wired:

- Code: the wrapper instances are deployed from the confidential-token wasm
  already on testnet (`CONFIDENTIAL_TOKEN_WASM` in `deploy/testnet.env`,
  kept in `contracts/confidential_token/`), one per batch, by the producer
  API at listing. The shared UltraHonk verifier is `CONFIDENTIAL_VERIFIER`;
  Fermento's auditor registry is `CONFIDENTIAL_AUDITOR` with the key generated
  by `scripts/confidential-auditor.ts` (secret in the git-ignored
  `deploy/auditor.local.env`).
- Client: `stellar-confidential-token-sdk` (community client for the
  OpenZeppelin protocol). Proofs are Noir circuits (`public/circuits/`) run
  by bb.js in the browser; the smart account signs; the relayer pays.
  `src/lib/confidential.ts` holds keys, proving and local state;
  `src/hooks/useConfidential.ts` the actions; `src/components/PrivacyCard.tsx`
  the UI. `/privacy-check` generates a test proof to see how long a device takes.
- Keys: passkey accounts have no ed25519 signer, so each account gets a random
  32-byte privacy root in localStorage, exportable from the card. Losing it
  loses access to the private balance.

Known limits, stated in the app: OpenZeppelin's verifier does not yet accept
zero-knowledge proofs, so amounts are hidden from casual observers but not
from a determined analyst; the contract is a testnet developer preview; the
RPC keeps about a week of events, so a device that has never synced a balance
older than that needs the backup state from the device that has.

## License

Apache 2.0. Scaffold by [AhaLabs](https://github.com/AhaLabs/scaffold-stellar).
