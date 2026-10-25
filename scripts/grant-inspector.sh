#!/usr/bin/env bash
# Give an account the `inspector` role on the registry, oracle and shares
# contracts: it may attest batches, confirm inspections and collections,
# post scored visits and declare a batch failed.
#
# Run after a fresh deploy (deploy-testnet.sh calls it) and once after
# upgrading contracts that predate the role (upgrade-testnet.sh).
#
#   scripts/grant-inspector.sh <admin-key-name> <inspector-address>
#
# The inspector should be someone other than the platform and the producers.
# For the testnet demo the admin may pass its own address.

set -euo pipefail
ADMIN="${1:?usage: scripts/grant-inspector.sh <admin-key-name> <inspector-address>}"
INSPECTOR="${2:?inspector G... address}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/testnet.env"
NETWORK="${NETWORK:-testnet}"
ADMIN_PK="$(stellar keys public-key "$ADMIN")"

for id in "$REGISTRY_ID" "$ORACLE_ID" "$SHARES_ID"; do
  if stellar contract invoke --id "$id" --source "$ADMIN" --network "$NETWORK" \
    -- has_role --account "$INSPECTOR" --role inspector 2>/dev/null | grep -qv '^null$'; then
    echo "$id: already inspector"
    continue
  fi
  stellar contract invoke --id "$id" --source "$ADMIN" --network "$NETWORK" \
    -- grant_role --account "$INSPECTOR" --role inspector --caller "$ADMIN_PK" >/dev/null
  echo "$id: inspector granted"
done
