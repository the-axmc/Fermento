#!/usr/bin/env bash
# Regenerate the TypeScript clients in packages/ from the built wasm files.
# Run after changing a contract: `stellar contract build && npm run bindings`.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/target/wasm32v1-none/release"

gen() { # <wasm basename> <package name>
  stellar contract bindings typescript --wasm "$WASM/$1.wasm" \
    --output-dir "$ROOT/packages/$2" --overwrite --quiet
  # The generator names the package after the crate; keep our package names.
  sed -i '' "s/\"name\": \"$1\"/\"name\": \"$2\"/" "$ROOT/packages/$2/package.json"
}

gen non_fungible_contract batch_registry_contract
gen batch_shares_contract batch_shares_contract
gen condition_oracle_contract condition_oracle_contract

echo "clients regenerated; run npm run build:clients"
