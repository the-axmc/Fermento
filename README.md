# Fermento

Own a share of a cask of Port, Madeira or Moscatel while it ages, from your phone.
Producers get paid the day the cask is filled. Buyers watch their share grow with
every month in the cellar, sell whenever they like, or redeem bottles at maturity.
Built on Stellar, with no wallet to install and no crypto to understand.

See [BUILD_PLAN.md](BUILD_PLAN.md) for the HackMeridian scope and architecture.

## State of the repo

- Tag `pre-hackmeridian` is the baseline before the hackathon: a Scaffold Stellar
  batch tracker with an OpenZeppelin NFT contract (`contracts/non_fungible`),
  wallet connection through Stellar Wallets Kit, and a Home page that mints a
  token per fermentation batch.
- Everything after that tag is HackMeridian work.

## Layout

```
contracts/non_fungible/      Soroban NFT contract (cask registry)
packages/non_fungible_contract  Generated TypeScript client, committed
src/                          React + Vite frontend
  components/                 Wallet connect, fund, network pill
  contracts/                  Env parsing and contract client
  hooks/, providers/, util/   Wallet state, notifications, Horizon helpers
  pages/Home.tsx              Batch registry UI
environments.toml             Network and contract IDs per environment
```

## Requirements

Rust with the `wasm32v1-none` target, Node 22+, the Stellar CLI and the
Scaffold Stellar plugin. Installation links are in the
[Soroban setup guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup).

## Run

```bash
npm install
cp .env.example .env     # set PUBLIC_STELLAR_* for testnet
npm run dev              # scaffold watch + vite
```

Contract tests:

```bash
cargo test
```

## Deploy the contract to testnet

Testnet resets periodically and wipes deployed contracts. After a reset,
redeploy and update the ID in `environments.toml`, `packages/non_fungible_contract/src/index.ts`
and `.env`.

```bash
stellar contract build
stellar contract deploy \
  --wasm target/wasm32v1-none/release/non_fungible_contract.wasm \
  --source <admin-key> --network testnet \
  -- --admin <G...> --pauser <G...> --upgrader <G...> --minter <G...>
```

## Producer side

A producer is any passkey account that lists or registers a batch. Two tiers:

- **Amateur**: the default. A page with a monogram, a story and the batches.
- **Certified**: a registered company. Applies in the app (`/certify`) with
  legal name, VAT number, logo and registration document; an admin approves
  and the producer's rating goes on chain. Certified producers get the badge,
  their logo on every product and a higher rating.

Pages:

| Route                | Who          | What                                                                        |
| -------------------- | ------------ | --------------------------------------------------------------------------- |
| `/producer/me`       | the producer | Own page: batches, stats, "Get certified", edit. Certified: dashboard view. |
| `/producer/<slug>`   | anyone       | Public page with the badge, story, batches on the market, website.          |
| `/producer/edit`     | the producer | Name, place, story, what they make.                                         |
| `/certify`           | the producer | Certification application and its status.                                   |
| `/batch/<id>/manage` | the producer | Per-batch page: share value and its factors, NFC card link, check-ins.      |
| `/produce`           | the producer | Add a ferment: put it on sale, or just register and track it.               |

What the producer signs with its passkey (fee-sponsored, on chain):

- `condition_oracle.post_checkin` — a lab reading, tasting note, photo or
  racking with a 0-100 care score. Kept on chain for holders.
- `batch_registry.link_tag` — binds an NFC card to the batch. The app writes
  the batch URL to the card with Web NFC (Android Chrome) and stores
  `sha256(serial)` on chain; iPhones type the serial after writing with any NFC
  app. Anyone tapping the card lands on the batch page, which shows it is linked.

### How the oracle prices a share

```
mark = fill_price
     × age_curve[category](months)        seeded per category
     × condition(readings in range)       cellar sensor, 0.7 … 1.0
     × care(check-ins)                    1.0 … 1.2
     × producer_rating                    0.5 … 2.0, "market value of the company"
     − storage fee accrued per share
```

- **Care**: one rewarded check-in per day earns up to +2.5 % scaled by the
  score, capped at +20 %. Two weeks of silence and the bonus decays 0.25 % a day.
- **Producer rating**: posted by the keeper in `scripts/producer-api.ts` from
  certification (+6 %), average shares sold across the producer's offerings
  (up to +6 %) and track record (+1 % per extra batch, up to +3 %). Stored on
  chain with the certified flag, so the badge is verifiable.
- `breakdown(batch_id)` returns every factor; `mark(batch_id)` the value.

### Producer API

```bash
npm run producer-api        # http://localhost:8787, Vite proxies /api
```

| Method and path                                     | Purpose                                                  |
| --------------------------------------------------- | -------------------------------------------------------- |
| `POST /api/batches`                                 | List (`listing: "sale"`) or register (`"track"`) a batch |
| `GET /api/producers/<slug or addr>`                 | Profile plus its batches                                 |
| `PUT /api/producers/<addr>`                         | Edit the profile                                         |
| `POST /api/certification`                           | Apply (logo data URL, document base64)                   |
| `GET /api/certification`                            | Pending applications (admin)                             |
| `POST /api/certification/<id>/approve` or `/reject` | Review; approval posts the rating on chain               |
| `POST /api/oracle/tick`                             | Run the keeper now (admin)                               |

Admin calls need the `X-Admin-Token` header matching `ADMIN_TOKEN`, or come
from localhost when it is unset. The keeper runs every `KEEPER_MINUTES`
(default 10): rates every producer and publishes a mark for every batch.
Profiles and applications live in `deploy/producers.json` and
`deploy/uploads/` (git-ignored).

### Upgrading on testnet

`scripts/upgrade-testnet.sh <admin> [registry|oracle|shares]` uploads only the
contracts whose wasm changed. Uploading 35 KB of code costs thousands of XLM
in rent on testnet at the moment, so top the admin up first by merging
Friendbot-funded accounts into it.

## License

Apache 2.0. Scaffold by [AhaLabs](https://github.com/AhaLabs/scaffold-stellar).
