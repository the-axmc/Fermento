#!/usr/bin/env bash
# Register one batch end to end on testnet:
#   1. mint the registry token with its metadata URI
#   2. seed the category age curve on the oracle (idempotent)
#   3. register the batch and its sensor key on the oracle
#   4. issue the share asset, hand its SAC admin to batch_shares
#   5. open the primary offering
#
# Usage:
#   scripts/open-batch.sh <admin-key-name> <batch-id> <category> [sensor-key-name]
#
# Terms are demo defaults; override with env vars:
#   PRICE (share price, 7dp)       default 120000000 = 12 USDC
#   TOTAL_SHARES                   default 1000
#   FEE_PER_SHARE_DAY (7dp)        default 100000 = 0.01 USDC
#   SHARES_PER_UNIT                default 10
#   MATURES_IN_DAYS                default 365
#   URI                            default https://fermento.app/batch/<id>
#   TEMP_MIN TEMP_MAX (0.01 C)     default 1200 1800
#   HUM_MIN HUM_MAX (bps)          default 6000 8000

set -euo pipefail

ADMIN="${1:?usage: scripts/open-batch.sh <admin-key-name> <batch-id> <category> [sensor-key-name]}"
BATCH="${2:?batch id}"
CATEGORY="${3:?category symbol, e.g. moscatel}"
SENSOR="${4:-sensor-$BATCH}"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT/deploy/testnet.env"

PRICE="${PRICE:-120000000}"
TOTAL_SHARES="${TOTAL_SHARES:-1000}"
FEE_PER_SHARE_DAY="${FEE_PER_SHARE_DAY:-100000}"
SHARES_PER_UNIT="${SHARES_PER_UNIT:-10}"
MATURES_IN_DAYS="${MATURES_IN_DAYS:-365}"
URI="${URI:-https://fermento.app/batch/$BATCH}"
TEMP_MIN="${TEMP_MIN:-1200}"; TEMP_MAX="${TEMP_MAX:-1800}"
HUM_MIN="${HUM_MIN:-6000}";  HUM_MAX="${HUM_MAX:-8000}"

ADMIN_PK="$(stellar keys public-key "$ADMIN")"
NOW="$(date +%s)"
MATURES_AT=$((NOW + MATURES_IN_DAYS * 86400))

# Sensor key: a plain ed25519 keypair kept as a CLI identity. The oracle wants
# its raw 32-byte public key as hex.
if ! stellar keys public-key "$SENSOR" >/dev/null 2>&1; then
  stellar keys generate "$SENSOR" >/dev/null
fi
SENSOR_PK="$(stellar keys public-key "$SENSOR")"
SENSOR_HEX="$(node -e "const {StrKey}=require('@stellar/stellar-sdk');process.stdout.write(StrKey.decodeEd25519PublicKey(process.argv[1]).toString('hex'))" "$SENSOR_PK")"
echo "sensor $SENSOR: $SENSOR_PK ($SENSOR_HEX)"

inv() { stellar contract invoke --source "$ADMIN" --network "$NETWORK" "$@"; }

echo "== 1. registry: register_batch $BATCH"
inv --id "$REGISTRY_ID" -- register_batch --to "$ADMIN_PK" --batch_id "$BATCH" --uri "$URI" --caller "$ADMIN_PK" >/dev/null

echo "== 2. oracle: age curve for $CATEGORY"
# Monthly multipliers in bps: 1.00 at fill, +2 %/month for 6 months, flat, 1.20 from month 12.
CURVE='[10000,10200,10400,10600,10800,11000,11200,11200,11200,11200,11200,11200,12000]'
inv --id "$ORACLE_ID" -- set_curve --category "$CATEGORY" --points "$CURVE" --caller "$ADMIN_PK" >/dev/null

echo "== 3. oracle: register_batch"
inv --id "$ORACLE_ID" -- register_batch --caller "$ADMIN_PK" --config "{
  \"batch_id\": $BATCH, \"category\": \"$CATEGORY\", \"sensor\": \"$SENSOR_HEX\",
  \"fill_price\": \"$PRICE\", \"filled_at\": $NOW, \"fee_per_share_day\": \"$FEE_PER_SHARE_DAY\",
  \"temp_min\": $TEMP_MIN, \"temp_max\": $TEMP_MAX,
  \"humidity_min\": $HUM_MIN, \"humidity_max\": $HUM_MAX }" >/dev/null

echo "== 4. share asset from a fresh issuer, SAC admin handed to batch_shares, issuer locked"
CODE="$(printf 'FERM%03d' "$BATCH")"
ISSUER="issuer-$BATCH"
if ! stellar keys public-key "$ISSUER" >/dev/null 2>&1; then
  stellar keys generate "$ISSUER" >/dev/null
fi
ISSUER_PK="$(stellar keys public-key "$ISSUER")"
# Fund the issuer from the admin (3 XLM covers the account and one trustline-free asset).
stellar tx new create-account --source "$ADMIN" --network "$NETWORK" \
  --destination "$ISSUER_PK" --starting-balance 30000000 >/dev/null 2>&1 || true
SHARE_SAC="$(stellar contract asset deploy --asset "$CODE:$ISSUER_PK" --source "$ADMIN" --network "$NETWORK" 2>/dev/null \
  || stellar contract id asset --asset "$CODE:$ISSUER_PK" --network "$NETWORK")"
echo "share asset $CODE: $SHARE_SAC (issuer $ISSUER_PK)"
stellar contract invoke --source "$ISSUER" --network "$NETWORK" --id "$SHARE_SAC" -- set_admin --new_admin "$SHARES_ID" >/dev/null
# Lock the issuer: after set_admin only the shares contract can mint.
stellar tx new set-options --source "$ISSUER" --network "$NETWORK" --master-weight 0 >/dev/null

echo "== 5. shares: open_offering"
inv --id "$SHARES_ID" -- open_offering --batch_id "$BATCH" --share_token "$SHARE_SAC" \
  --producer "$ADMIN_PK" --price "$PRICE" --total_shares "$TOTAL_SHARES" \
  --fee_per_share_day "$FEE_PER_SHARE_DAY" --shares_per_unit "$SHARES_PER_UNIT" \
  --filled_at "$NOW" --matures_at "$MATURES_AT" --caller "$ADMIN_PK" >/dev/null

cat >> "$ROOT/deploy/testnet.env" <<EOF
BATCH_${BATCH}_SHARE_SAC=$SHARE_SAC
BATCH_${BATCH}_SHARE_ISSUER=$ISSUER_PK
BATCH_${BATCH}_SENSOR=$SENSOR
EOF

echo
echo "batch $BATCH is live. Post readings with:"
echo "  SENSOR_SECRET=\$(stellar keys secret $SENSOR) node --experimental-strip-types scripts/sensor-sim.ts $BATCH"
