#!/usr/bin/env bash
set -euo pipefail

API=${API_URL:-http://localhost:5000/api}
EVENT_ID=${EVENT_ID:-}
SEAT_IDS=${SEAT_IDS:-}
LIMIT=${LIMIT:-2}

if [ -z "$EVENT_ID" ] || [ -z "$SEAT_IDS" ]; then
  echo "Usage: EVENT_ID=<eventId> SEAT_IDS='[\"seat1\",\"seat2\"]' ./scripts/test_complimentary.sh"
  exit 1
fi

echo "Setting complimentary limit for event $EVENT_ID to $LIMIT"
curl -s -X PATCH "$API/events/$EVENT_ID/complimentary-limit" \
  -H 'Content-Type: application/json' \
  -d "{\"complimentaryLimit\": $LIMIT}" | jq .

echo
echo "Attempting complimentary booking for seats: $SEAT_IDS"
RESP=$(curl -s -X POST "$API/orders/payment-pending" \
  -H 'Content-Type: application/json' \
  -d "{\"eventId\": \"$EVENT_ID\", \"seatIds\": $SEAT_IDS, \"customer\": {\"name\": \"Test User\", \"email\": \"test@example.com\"}, \"paymentMode\": \"COMPLIMENTARY\"}")

echo "$RESP" | jq .

# Try booking again to exceed limit
echo
echo "Attempting another complimentary booking (should fail if limit reached)"
RESP2=$(curl -s -X POST "$API/orders/payment-pending" \
  -H 'Content-Type: application/json' \
  -d "{\"eventId\": \"$EVENT_ID\", \"seatIds\": $SEAT_IDS, \"customer\": {\"name\": \"Test User\", \"email\": \"test2@example.com\"}, \"paymentMode\": \"COMPLIMENTARY\"}")

echo "$RESP2" | jq .
