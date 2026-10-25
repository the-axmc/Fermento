#!/usr/bin/env bash
# Upgrade the deployed contracts in place (IDs and data stay the same).
#
# Uploads the optimized wasm and calls each contract's `upgrade`, which is
# gated by the `upgrader` role held by the admin. Contracts whose wasm already
# matches what is deployed are skipped: on testnet a 35 KB upload costs
# thousands of XLM in code rent (October 2026), so top the admin up first
# (merge Friendbot accounts into it) and never upload what has not changed.
#
#   stellar contract build && scripts/upgrade-testnet.sh <admin-key-name> [contract...]
#
# With no contract names, all three are considered: registry oracle shares.

set -euo pipefail
ADMIN="${1:?usage: scripts/upgrade-testnet.sh <admin-key-name> [registry|oracle|shares ...]}"
shift
NETWORK="${NETWORK:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WASM="$ROOT/target/wasm32v1-none/release"
# shellcheck disable=SC1091
source "$ROOT/deploy/testnet.env"
ADMIN_PK="$(stellar keys public-key "$ADMIN")"

upgrade() { # <contract id> <wasm basename>
  local id="$1" wasm="$WASM/$2.wasm" optimized="$WASM/$2.optimized.wasm"
  echo "== $2 -> $id"
  stellar contract optimize --wasm "$wasm" >/dev/null
  local local_hash deployed_hash tmp
  tmp="$(mktemp)"
  local_hash="$(shasum -a 256 "$optimized" | cut -d' ' -f1)"
  # The deployed code, fetched and hashed; empty when the fetch fails.
  deployed_hash="$(stellar contract fetch --id "$id" --network "$NETWORK" --out-file "$tmp" >/dev/null 2>&1 \
    && shasum -a 256 "$tmp" | cut -d' ' -f1 || true)"
  rm -f "$tmp"
  if [[ -n "$deployed_hash" && "$deployed_hash" == "$local_hash" ]]; then
    echo "   unchanged, skipped"
    return
  fi
  local hash
  hash="$(stellar contract upload --wasm "$optimized" --source "$ADMIN" --network "$NETWORK" 2>/dev/null)"
  echo "   wasm hash $hash"
  stellar contract invoke --id "$id" --source "$ADMIN" --network "$NETWORK" \
    -- upgrade --new_wasm_hash "$hash" --operator "$ADMIN_PK" >/dev/null
  echo "   upgraded"
}

targets=("$@")
[[ ${#targets[@]} -eq 0 ]] && targets=(registry oracle shares)
for t in "${targets[@]}"; do
  case "$t" in
    registry) upgrade "$REGISTRY_ID" non_fungible_contract ;;
    oracle) upgrade "$ORACLE_ID" condition_oracle_contract ;;
    shares) upgrade "$SHARES_ID" batch_shares_contract ;;
    *) echo "unknown contract $t" >&2; exit 1 ;;
  esac
done
echo "done"
