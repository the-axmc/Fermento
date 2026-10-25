#!/usr/bin/env bash
# Keep the three contract instances (and their code) alive.
#
# Contract writes extend only the small persistent entries they touch, so the
# platform bumps the instance/code TTL itself. Run this from cron, or by hand
# before the TTL runs out. Anyone can extend a TTL; the admin key pays.
#
# Usage: scripts/extend-ttl.sh <admin-key-name> [ledgers]   (default 30 days)

set -euo pipefail
ADMIN="${1:?usage: scripts/extend-ttl.sh <admin-key-name> [ledgers]}"
LEDGERS="${2:-518400}"   # 30 days at ~5 s per ledger
NETWORK="${NETWORK:-testnet}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/testnet.env"

for id in "$REGISTRY_ID" "$ORACLE_ID" "$SHARES_ID"; do
  echo "== extend $id by $LEDGERS ledgers"
  stellar contract extend --id "$id" --ledgers-to-extend "$LEDGERS" \
    --source "$ADMIN" --network "$NETWORK" >/dev/null
done
echo "done"
