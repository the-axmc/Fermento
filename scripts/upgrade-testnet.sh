#!/usr/bin/env bash
# Upgrade the three deployed contracts in place (IDs and data stay the same).
#
# Uploads the freshly built wasm and calls each contract's `upgrade`, which is
# gated by the `upgrader` role held by the admin. Rebuild first:
#   stellar contract build && scripts/upgrade-testnet.sh <admin-key-name>

set -euo pipefail
ADMIN="${1:?usage: scripts/upgrade-testnet.sh <admin-key-name>}"
NETWORK="${NETWORK:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/target/wasm32v1-none/release"
# shellcheck disable=SC1091
source "$ROOT/deploy/testnet.env"
ADMIN_PK="$(stellar keys public-key "$ADMIN")"

upgrade() { # <contract id> <wasm basename>
  local id="$1" wasm="$WASM/$2.wasm"
  echo "== $2 -> $id"
  local hash
  hash="$(stellar contract upload --wasm "$wasm" --source "$ADMIN" --network "$NETWORK" 2>/dev/null)"
  echo "   wasm hash $hash"
  stellar contract invoke --id "$id" --source "$ADMIN" --network "$NETWORK" \
    -- upgrade --new_wasm_hash "$hash" --operator "$ADMIN_PK" >/dev/null
  echo "   upgraded"
}

upgrade "$REGISTRY_ID" non_fungible_contract
upgrade "$ORACLE_ID" condition_oracle_contract
upgrade "$SHARES_ID" batch_shares_contract
echo "done"
