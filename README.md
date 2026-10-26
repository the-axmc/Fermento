# Fermento

**Reserve units of a batch while it ages.** A cask of Moscatel, a wheel of Serra
da Estrela, a vat of kombucha, a jar of kimchi. The producer is paid when the
batch is filled instead of years later when it is ready. Buyers follow its
condition from the cellar, resell their tokens to other buyers, and collect
their units at maturity. One token is one unit.

Built on Stellar for HackMeridian 2026 (track Stellar Composed, builder track
Scale). Accounts are passkey smart accounts: no wallet to install, no seed
phrase, no XLM. Live on testnet.

- Demo walkthrough with a receipt for every real transaction: see the
  submission page.
- Baseline before the hackathon: git tag `pre-hackmeridian` (a Scaffold Stellar
  batch tracker with one NFT contract). Everything after it was built during
  the event.

## The problem

Anything that ages ties up money for years. A Port, Madeira or Moscatel
producer fills a cask today and sells it in five to twenty years; a cheesemaker
waits months per wheel. Banks price that badly, so small producers underproduce
or sell young.

Buyers who would gladly pay early have no safe way to do it. Every platform
that let the seller vouch for the goods has ended in fraud: Bordeaux Cellars,
Oeno, Cask Spirits Global, Nant Whisky selling the same barrels several times.
The platforms that work all rely on an independent custodian whose ledger
holds title. Our research on this is in [`reports/`](reports/).

Fermento gives the producer most of the money at fill, and gives the buyer the
protections that today exist only behind bonded warehouses.

## What it does

**For buyers.** Sign up with Face ID in under twenty seconds. Top up by card or
bank through a Stellar anchor. Reserve units of a batch in USDC or EURC and
watch its value mark move with the cellar. Resell to other buyers at your own
price. Redeem at maturity for the real thing. Optionally keep your balance
private.

**For producers.** Add a ferment from the phone: kind, origin, dates, sell it
or just track it. Stick an NFC card on the cask so anyone can tap it and land
on its record. Post check-ins for your holders. Certified companies apply with
their VAT number and documents and get a badge and a higher on-chain rating.

**For everyone else.** An independent inspector attests how many units exist
before a single one is sold, visits during ageing, and can declare a failed
batch so holders are refunded. The record outlives the app: every batch,
attestation, reading, trade and claim is on chain and readable without us.

### Buyer protection, in the contracts

- A sale opens only after an inspector has attested the batch, and never for
  more units than attested.
- Each payment splits 70 / 15 / 15: 70 % to the producer at once, 15 % when
  the inspector confirms the batch during ageing, 15 % per unit when the buyer
  collects it. A failed batch refunds what is still held.
- Readings are ed25519-signed by the batch's sensor over the oracle's contract
  id, the batch, the time and the values, so they cannot be forged or replayed.
- A producer cannot raise its own mark: check-ins only pause the decay of the
  care bonus, which only an inspector's visit can raise.

### The value mark

```
mark = fill_price
     × age_curve[category](months)        seeded per category
     × condition(readings in range)       cellar sensor, 0.7 … 1.0
     × care(inspections)                  1.0 … 1.2
     × producer_rating                    0.8 … 1.2
     − storage fee accrued per token
```

The keeper publishes a mark at most every ten minutes; the chart in the app is
read straight from the contract's history, and `breakdown(batch_id)` returns
every factor.

## What is in the box

| Area               | What                                                                                                                                   |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Four contracts     | Batch registry (NFT), batch shares (sale, escrow, resale, redemption), condition oracle, confidential token wrapper. Rust, Soroban.    |
| Web app            | Market, batch page with live chart, portfolio, Sell and buy-from-holders, redeem and claim, wallet, producer pages, inspector console. |
| Accounts           | OpenZeppelin smart accounts with passkeys through Smart Account Kit; fees paid by a relayer, so the user never holds XLM.             |
| Payments           | USDC and EURC. Card and bank top-ups through a Stellar anchor (SEP-45 passkey sign-in, SEP-24 hosted deposit).                        |
| Privacy            | One OpenZeppelin confidential token per batch; Noir circuits proved in the browser with bb.js; auditor key held for compliance.        |
| Physical link      | NFC card per batch written with Web NFC; `sha256(serial)` bound on chain; locked once attested.                                        |
| Producer API       | Issues share assets, SEP-45-style sessions, oracle keeper, certification review, testnet faucet, fee relay.                            |
| Scripts            | Deploy, in-place upgrade, TTL keep-alive, open a batch end to end, sensor simulator.                                                   |
| Tests              | 95 contract tests beside the contracts (`cargo test`); confidential wrapper smoke test on testnet.                                     |

## How it is built

```
┌──────────────┐  passkey   ┌──────────────────────┐  {func, auth}  ┌─────────────────┐
│  Fermento    │ ─────────▶ │ OpenZeppelin smart   │ ─────────────▶ │ Fee relayer     │
│  web app     │            │ account (per user)   │                │ (via /api/relay)│
└──────┬───────┘            └──────────────────────┘                └────────┬────────┘
       │ reads marks, balances, listings                                     │ submits, pays
       ▼                                                                     ▼
┌──────────────┐   ┌──────────────┐   ┌──────────────┐   ┌──────────────┐  Stellar
│ batch        │◀─▶│ batch        │◀─▶│ condition    │   │ confidential │  testnet
│ registry NFT │   │ shares + SAC │   │ oracle       │   │ wrapper      │
└──────▲───────┘   └──────────────┘   └──────▲───────┘   └──────────────┘
       │ attest, visit, declare failed       │ signed readings
   Inspector console                    Cellar sensor (simulator)
```

### Contracts (`contracts/`)

All four build on OpenZeppelin Stellar Contracts 0.8.0: `AccessControl` roles,
every contract upgradeable by the `upgrader` role, registry and sale pausable.

| Contract                       | Package                       | Role                                                                                                                         |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `contracts/non_fungible`       | `batch_registry_contract`     | One NFT per physical batch: stage, NFC tag, the inspector's attestation of how many units exist, unit claims.                |
| `contracts/batch_shares`       | `batch_shares_contract`       | Primary sale of each batch's tokens (a classic asset and its SAC) in USDC, 70/15/15 escrow, storage fees, resale, redemption. |
| `contracts/condition_oracle`   | `condition_oracle_contract`   | Signed cellar readings, age curves, check-ins, inspector visits, producer ratings and the published mark.                     |
| `contracts/confidential_token` | `confidential_token_contract` | OpenZeppelin confidential token wasm, one wrapper per batch (developer preview, see below).                                   |

Design points worth knowing:

- **Share assets are classic Stellar assets.** Each batch gets a fresh issuer
  whose SAC admin is handed to `batch_shares` and whose master key is then
  locked, so only the sale contract can ever mint. Classic accounts need a
  trustline; passkey smart accounts, being contracts, do not.
- **Resale** keeps up to 40 open listings per batch; when full, a cheaper
  listing evicts the dearest and returns its tokens to the seller. 1 % of each
  resale goes to the treasury.
- **Storage fee** accrues daily per token from purchase and is settled at
  redemption. The checkpoint travels with tokens sold on the resale market;
  tokens received any other way pay from the fill date.
- **Care bonus**: an inspector's visit earns up to +5 % scaled by its score,
  capped at +20 %. After two weeks without a visit or check-in it decays
  0.25 % a day. A producer check-in restarts the clock but adds nothing.

### App (`src/`)

React 19, Vite, TypeScript, generated contract clients in `packages/*`.

```
src/pages/      Market, Batch, Portfolio, Wallet, Producer, ProducerEdit,
                AddFerment, Manage, Certify, Inspect, Claim, PrivacyCheck, SignIn
src/hooks/      Chain reads (useBatchChain), account, holdings, producer, confidential
src/lib/        Anchor top-ups, API sign-in, confidential balances, NFC
src/wallet/     Smart Account Kit setup and the account provider
src/components/ Mark chart, check-ins, privacy card, bottom nav, landscape
src/data/       Story and artwork per batch id
```

Passkeys need HTTPS on a phone: reach the dev server through a tunnel (allowed
hosts are in `vite.config.ts`).

### Accounts and fees

Smart accounts come from OpenZeppelin `stellar-accounts` through Smart Account
Kit 0.8.0, with a passkey signer. Transactions are submitted as `{func, auth}`
to a fee-sponsoring relayer, so the account never needs XLM. The SDF relayer
proxy refuses requests from browser origins, so the app posts to the producer
API's `/api/relay`, which forwards the body server-side.

### Confidential shares (developer preview)

Every batch listed for sale also gets a confidential wrapper over its share
asset. From the batch page a holder can move shares into it ("Keep private"),
send them privately and withdraw before redeeming. On chain the wrapper holds
Pedersen commitments; amounts are decrypted only on the holder's phone. Sender
and recipient addresses stay public. Fermento holds the auditor key.

- Wrappers are deployed from the confidential-token wasm already on testnet,
  one per batch, by the producer API at listing. The shared UltraHonk verifier
  and Fermento's auditor registry are in `deploy/testnet.env`.
- Client: `stellar-confidential-token-sdk`; proofs are Noir circuits
  (`public/circuits/`) run by bb.js in the browser. `/privacy-check` measures a
  device's proving time.
- Passkey accounts have no ed25519 signer, so each account gets a random
  32-byte privacy root in localStorage, exportable from the privacy card.

Known limits, stated in the app: the verifier does not yet accept
zero-knowledge proofs, so amounts are hidden from casual observers but not from
a determined analyst; the RPC keeps about a week of events, so a device that
never synced an older balance needs the backup from one that did.

### Producer API (`scripts/producer-api.ts`)

Does what a passkey account cannot: listing needs the platform's admin roles
and a classic account to issue the share asset. It also keeps producer
profiles, runs the oracle keeper, the certification review, the testnet faucet
and the fee relay.

| Method and path                                                                   | Who          | Purpose                                                      |
| --------------------------------------------------------------------------------- | ------------ | ------------------------------------------------------------ |
| `GET /api/auth?account=&home_domain=`, `POST /api/auth`                           | anyone       | Sign in: SEP-45 challenge, answered with a session token     |
| `GET /api/batches`, `GET /api/producers/<slug or addr>`                           | anyone       | Listed batches, a profile and its batches                    |
| `POST /api/batches`                                                               | signed in    | List (`listing: "sale"`) or register (`"track"`) a batch     |
| `PUT /api/producers/<addr>`                                                       | that account | Edit the profile                                             |
| `POST /api/certification`                                                         | that account | Apply (logo data URL, document base64)                       |
| `GET /api/certification`, `POST /api/certification/<id>/approve` or `/reject`     | admin        | Review; approval posts the rating on chain                   |
| `GET /api/inspections`, `POST /api/inspections/<id>/attest`, `/visit`, `/default` | admin        | The inspector's queue and actions                            |
| `POST /api/oracle/tick`                                                           | admin        | Run the keeper now                                           |
| `GET /api/treasury`, `POST /api/fund`                                             | anyone       | Testnet USDC or EURC, once an hour per account               |
| `POST /api/relay`                                                                 | anyone       | Fee relay: forwards `{func, auth}` or `{xdr}` to the relayer |

- **Sign-in** works like SEP-45: the API sends a `web_auth_verify` call as
  Soroban authorization entries, the passkey signs the account's entry, and the
  API replays the call in an enforcing simulation, which runs the account's own
  signature check, then answers with a token valid for an hour
  (`src/lib/apiAuth.ts`).
- **Admin** calls need the `X-Admin-Token` header. Set `ADMIN_TOKEN`, or copy
  the one the API prints at start into the Inspect page.
- **Keeper** runs every `KEEPER_MINUTES` (default 10): rates every producer
  from certification (+6 %), sell-through (up to +3 %) and track record (up to
  +3 %), and publishes a mark for every batch.
- `RELAYER_UPSTREAM` changes the relayer the fee relay forwards to.
- Profiles and applications live in `deploy/producers.json` and
  `deploy/uploads/`, listed batches in `deploy/batches.json` (git-ignored).

### NFC cards

The producer writes the batch URL to a card with Web NFC (Android Chrome) and
the registry stores `sha256(serial)`; iPhones type the serial after writing
with any NFC app. Anyone tapping the card lands on the batch page, which shows
it is linked. Once the batch is attested only the inspector can re-link it.
Tamper-evident NTAG 424 DNA tags are the next step (see `reports/`).

## Run it

Requirements: Rust with the `wasm32v1-none` target (pinned in
`rust-toolchain.toml`), Node 22+, the Stellar CLI
([setup guide](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup)).

```bash
npm install
cp .env.example .env        # contract IDs from deploy/testnet.env
npm run producer-api        # http://localhost:8787, prints the admin token
npm run dev                 # http://localhost:5173, proxies /api
```

The producer API must be running for sign-in: without it the fee relay is
missing and account creation fails with "Account deployment failed [3004]".

```bash
cargo test                          # contract tests
npm run build                       # clients, typecheck, Vite build
node scripts/confidential-e2e.mjs   # confidential wrapper smoke test on testnet
```

After changing a contract: `stellar contract build && npm run bindings`.

## Testnet

Contract IDs are in `deploy/testnet.env`, written by
`scripts/deploy-testnet.sh`. Testnet resets wipe them; after a reset, deploy
again and copy the IDs into `.env`.

- `scripts/open-batch.sh <admin> <batch-id> <category>` registers a batch end
  to end: registry token, oracle terms and sensor, share asset, attestation and
  the sale. Producers do the same from the app (`/produce`) through the API.
- `scripts/upgrade-testnet.sh <admin> [registry|oracle|shares]` uploads only
  the contracts whose wasm changed and upgrades them in place. Rent on testnet
  has swung from thousands of XLM per upload to a few; check the admin balance
  before and after.
- `scripts/grant-inspector.sh <admin> <address>` gives an account the inspector
  role on all three contracts.
- `scripts/extend-ttl.sh` keeps contract instances and code alive.
- `npm run sensor -- <batch-id>` signs and posts a cellar reading.

Batches on testnet today: 14 (opened before escrow existed, pays the producer in
full), 21 (Moscatel Roxo, the demo's full lifecycle: attested, sold, inspected,
resold, redeemed and collected) and 22 (a tracked kimchi jar).

## Producer side

A producer is any passkey account that lists or registers a batch.

- **Amateur**: the default. A page with a monogram, a story and the batches.
- **Certified**: a registered company. Applies in the app (`/certify`) with
  legal name, VAT number, logo and registration document; an admin approves
  and the producer's rating goes on chain with the certified flag, so the
  badge is verifiable.

| Route                | Who           | What                                                                        |
| -------------------- | ------------- | --------------------------------------------------------------------------- |
| `/producer/me`       | the producer  | Own page: batches, stats, "Get certified", edit. Certified: dashboard view. |
| `/producer/<slug>`   | anyone        | Public page with the badge, story, batches on the market, website.          |
| `/producer/edit`     | the producer  | Name, place, story, what they make.                                         |
| `/certify`           | the producer  | Certification application and its status.                                   |
| `/batch/<id>/manage` | the producer  | Per-batch page: value mark and its factors, NFC card link, check-ins.       |
| `/produce`           | the producer  | Add a batch: put it on sale, or just register and track it.                 |
| `/inspect`           | the inspector | Attest batches, record visits, declare a failed batch (admin token).        |

## What is next

- Pilot with one Setúbal Moscatel producer and the regional commission; bind
  the attested unit cap to official stock accounts and numbered seals.
- Tamper-evident NFC tags and a Fermento-provisioned sensor with a secure
  element, verified on chain with `secp256r1_verify`.
- Reference sample and lab hash at listing, compared at redemption.
- Challenge-based releases: milestones pay out unless disputed within seven
  days; holders can post a deposit to call an inspection; timelock on admin
  actions.
- Mainnet path once the confidential verifier accepts ZK proofs, plus a legal
  review of the pre-order structure in Portugal.

## License

Apache 2.0. Scaffold by [AhaLabs](https://github.com/AhaLabs/scaffold-stellar).
