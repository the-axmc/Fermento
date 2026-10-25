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

## License

Apache 2.0. Scaffold by [AhaLabs](https://github.com/AhaLabs/scaffold-stellar).
