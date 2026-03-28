#!/usr/bin/env bash
set -euo pipefail

API=${API_URL:-http://localhost:5000/api}
TMP=/tmp/eh_test
mkdir -p "$TMP"

jqf() { jq -r "$1" "$2"; }

echo "Looking up available seats across events..."
curl -s "$API/events?admin=true" -o $TMP/events.json

HAVE_JQ=0
if command -v jq >/dev/null 2>&1; then HAVE_JQ=1; fi

echo "\nEvents summary (id | title | organizerId | availableSeats | complimentaryLimit):"
if [ $HAVE_JQ -eq 1 ]; then
  jq -r '.[] | [.id, (.title // "(no title)"), (.organizerId // "-"), ((.seats // []) | map(select(.status=="AVAILABLE") ) | length), (.complimentaryLimit // "null")] | @tsv' $TMP/events.json | column -t -s $'\t' | sed 's/^/  /'
else
  # fallback to python for summary when jq is not installed
  python3 - <<PY
import json,sys
evs=json.load(open('$TMP/events.json'))
for e in evs:
    available=len([s for s in (e.get('seats') or []) if s.get('status')=='AVAILABLE'])
    print('  {id} {title} {org} {avail} {lim}'.format(id=e.get('id'), title=(e.get('title') or '(no title)'), org=(e.get('organizerId') or '-'), avail=available, lim=(e.get('complimentaryLimit') if e.get('complimentaryLimit') is not None else 'null')))
PY
fi
if [ -n "${SELECT_EVENT1:-}" ] && [ -n "${SELECT_SEAT1:-}" ]; then
  event1="$SELECT_EVENT1"
  seat1="$SELECT_SEAT1"
  echo "Using override SELECT_EVENT1=$event1 SELECT_SEAT1=$seat1"
else
  echo "Auto-selecting first event+available seat..."
fi

# Build list of available seats (eventId, seatId)
# (will populate below depending on jq availability)

event1=""
seat1=""
org1=""
event2=""
seat2=""
org2=""

if [ $HAVE_JQ -eq 1 ]; then
  mapfile -t AVAILABLE < <(jq -c '.[] | {eventId: .id, organizerId: .organizerId, seats: (.seats // [])} | .seats[]? | select(.status=="AVAILABLE") | {eventId, seatId: .id, rowLabel: .rowLabel, seatNumber: .seatNumber, organizerId} ' $TMP/events.json)
  if [ ${#AVAILABLE[@]} -eq 0 ]; then
    echo "No available seats found. Aborting."; exit 1
  fi
  echo "Found ${#AVAILABLE[@]} available seat entries. Using first entries for tests."
  first=$(echo "${AVAILABLE[0]}" | jq -c '.')
  event1=$(echo "$first" | jq -r '.eventId')
  seat1=$(echo "$first" | jq -r '.seatId')
  org1=$(echo "$first" | jq -r '.organizerId')
  second_entry_index=1
  if [ ${#AVAILABLE[@]} -le $second_entry_index ]; then
    second_entry_index=0
  fi
  second=$(echo "${AVAILABLE[$second_entry_index]}" | jq -c '.')
  event2=$(echo "$second" | jq -r '.eventId')
  seat2=$(echo "$second" | jq -r '.seatId')
  org2=$(echo "$second" | jq -r '.organizerId')
else
  # Python fallback to pick first and second available seats
  read event1 seat1 org1 event2 seat2 org2 < <(python3 - <<PY
import sys,json
evs=json.load(open('$TMP/events.json'))
first=None
second=None
for e in evs:
  for s in e.get('seats') or []:
    if s.get('status')=='AVAILABLE':
      first=(e.get('id'), s.get('id'), e.get('organizerId'))
      break
  if first: break
for e in evs:
  for s in e.get('seats') or []:
    if s.get('status')=='AVAILABLE' and (first is None or (e.get('id')!=first[0] or s.get('id')!=first[1])):
      second=(e.get('id'), s.get('id'), e.get('organizerId'))
      break
  if second: break
if not first:
  sys.exit(1)
out=[first[0], first[1], first[2] if first[2] is not None else 'null', second[0] if second else '', second[1] if second else '', second[2] if second and second[2] is not None else '']
print(' '.join(out))
PY
)
  if [ -z "$event1" ]; then echo "No available seats found. Aborting."; exit 1; fi
fi

echo "Event1=$event1 Seat1=$seat1 Organizer1=$org1"
echo "Event2=$event2 Seat2=$seat2 Organizer2=$org2"

ok_count=0
fail_count=0

do_patch() {
  url="$1"
  body="$2"
  echo "PATCH $url -> $body"
  curl -s -X PATCH "$url" -H 'Content-Type: application/json' -d "$body"
}

do_post() {
  url="$1"
  body="$2"
  echo "POST $url -> $body"
  # write body to tmp file to avoid escaping issues
  printf '%s' "$body" > $TMP/payload.json
  http_code=$(curl -s -o $TMP/resp.json -w "%{http_code}" -X POST "$url" -H 'Content-Type: application/json' --data-binary @$TMP/payload.json)
  echo "$http_code" > $TMP/last_code
  cat $TMP/resp.json
  return 0
}

assert_json_field() {
  file=$1; jq_expr=$2; expected=$3; desc=$4
  if [ $HAVE_JQ -eq 1 ]; then
    actual=$(jq -r "$jq_expr // \"__MISSING__\"" "$file" 2>/dev/null || echo "__ERR__")
  else
    # simple dot-path fallback (supports top-level keys like .complimentary or .totalAmount)
    key=$(echo "$jq_expr" | sed 's/^\.//; s/\[.*\]//g')
    actual=$(python3 - <<PY
import json,sys
f='$file'
key='$key'
try:
  obj=json.load(open(f))
  v=None
  if isinstance(obj, dict):
    v=obj.get(key)
  else:
    # if file contains a bare value like true/false/0, obj is that value
    v=obj
  if v is None:
    print('null')
  elif isinstance(v, bool):
    print('true' if v else 'false')
  else:
    # print raw value (numbers or strings)
    print(v)
except Exception:
  print('__ERR__')
PY
)
  fi
  if [ "$actual" = "$expected" ]; then
    echo "PASS: $desc"
    ok_count=$((ok_count+1))
  else
    echo "FAIL: $desc - expected '$expected' got '$actual'"
    fail_count=$((fail_count+1))
  fi
}

echo "\n=== Test A: Event-level complimentary limit enforcement ==="
echo "Setting event-level complimentaryLimit=1 for event $event1"
# Determine current complimentary usage for this event and set limit = used + 1
curl -s "$API/orders?eventId=$event1" -o $TMP/orders_event.json || true
if [ $HAVE_JQ -eq 1 ]; then
  used_event_count=$(jq '[.[] | select(.complimentary==true) | .tickets[]?] | length' $TMP/orders_event.json || echo 0)
else
  used_event_count=$(python3 - <<PY
import json
try:
  o=json.load(open('$TMP/orders_event.json'))
  cnt=0
  for ord in o:
    if ord.get('complimentary'):
      cnt += len(ord.get('tickets') or [])
  print(cnt)
except Exception:
  print(0)
PY
)
fi
limit_event=$((used_event_count+1))
echo "Detected $used_event_count existing complimentary tickets for event; setting complimentaryLimit=$limit_event"
do_patch "$API/events/$event1/complimentary-limit" "{\"complimentaryLimit\":$limit_event}" > $TMP/patch_event.json

echo "Attempting first complimentary booking (should succeed)"
do_post "$API/orders/payment-pending" "{\"eventId\":\"$event1\",\"seatIds\":[\"$seat1\"],\"customer\":{\"name\":\"Tester A\",\"email\":\"a@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}"
code1=$(cat $TMP/last_code)
if [ "$code1" = "200" ] || [ "$code1" = "201" ]; then
  echo "First complimentary booking created (HTTP $code1)"
  ok_count=$((ok_count+1))
  # verify order fields
  assert_json_field $TMP/resp.json '.complimentary' 'true' 'Order marked complimentary'
  assert_json_field $TMP/resp.json '.totalAmount' '0' 'Order totalAmount is zero'
else
  echo "Unexpected status for first complimentary booking: $code1"; fail_count=$((fail_count+1))
fi

echo "Attempting second complimentary booking for same event on a different available seat (should fail due to limit)"
# find another available seat in the same event
other_seat=""
if [ $HAVE_JQ -eq 1 ]; then
  other_seat=$(jq -r --arg e "$event1" '.[] | select(.id==$e) | .seats[]? | select(.status=="AVAILABLE") | .id' $TMP/events.json | grep -v "^$seat1$" | head -n1 || true)
else
  other_seat=$(python3 - <<PY
import json,sys
e='$event1'
evs=json.load(open('$TMP/events.json'))
out=''
for ev in evs:
  if str(ev.get('id'))==e:
    for s in ev.get('seats') or []:
      if s.get('status')=='AVAILABLE' and s.get('id')!='$seat1':
        out=s.get('id')
        break
  if out: break
print(out)
PY
)
fi
if [ -z "$other_seat" ]; then
  echo "No alternate seat available in event to test limit; skipping second booking check";
else
  do_post "$API/orders/payment-pending" "{\"eventId\":\"$event1\",\"seatIds\":[\"$other_seat\"],\"customer\":{\"name\":\"Tester B\",\"email\":\"b@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}"
  code2=$(cat $TMP/last_code)
  if [ "$code2" = "400" ] || [ "$code2" = "409" ]; then
    echo "Second booking correctly failed (HTTP $code2)"
    ok_count=$((ok_count+1))
  else
    echo "Unexpected status for second booking: $code2"; fail_count=$((fail_count+1))
  fi
fi

echo "Clearing event-level limit"
do_patch "$API/events/$event1/complimentary-limit" '{"complimentaryLimit":null}' > $TMP/patch_event_clear.json || true

echo "\n=== Test B: Direct POST /orders complimentary path ==="
echo "Using event2=$event2 seat2=$seat2"
# Ensure organizer limit won't block this direct POST: set organizer limit = used+1 temporarily
if [ -n "$org2" ] && [ "$org2" != "null" ]; then
  curl -s "$API/events?admin=true&organizerId=$org2" -o $TMP/org2_events.json || true
  used_org2=0
  for eid in $(python3 - <<PY
import json
evs=json.load(open('$TMP/org2_events.json'))
print('\n'.join([str(e.get('id')) for e in evs]))
PY
); do
    if [ -z "$eid" ]; then continue; fi
    curl -s "$API/orders?eventId=$eid" -o $TMP/orders_tmp2.json || true
    if [ $HAVE_JQ -eq 1 ]; then
      c=$(jq '[.[] | select(.complimentary==true) | .tickets[]?] | length' $TMP/orders_tmp2.json 2>/dev/null || echo 0)
    else
      c=$(python3 - <<PY
import json
try:
  o=json.load(open('$TMP/orders_tmp2.json'))
  cnt=0
  for ord in o:
    if ord.get('complimentary'):
      cnt += len(ord.get('tickets') or [])
  print(cnt)
except Exception:
  print(0)
PY
)
    fi
    used_org2=$((used_org2 + c))
  done
  limit_org2=$((used_org2+1))
  echo "Temporarily setting organizer $org2 complimentaryLimit=$limit_org2 for Test B"
  do_patch "$API/users/$org2/complimentary-limit" "{\"complimentaryLimit\":$limit_org2}" > $TMP/patch_org2.json || true
fi
do_post "$API/orders" "{\"customer\":{\"name\":\"DirectTester\",\"email\":\"direct@example.com\"},\"event\":{\"id\":\"$event2\",\"title\":\"DirectEvent\"},\"seats\":[{\"id\":\"$seat2\",\"price\":0}],\"serviceFee\":0,\"paymentMode\":\"COMPLIMENTARY\"}"
code3=$(cat $TMP/last_code)
if [ "$code3" = "200" ] || [ "$code3" = "201" ]; then
  echo "Direct complimentary order created (HTTP $code3)"; ok_count=$((ok_count+1))
  assert_json_field $TMP/resp.json '.complimentary' 'true' 'Direct order marked complimentary'
  assert_json_field $TMP/resp.json '.totalAmount' '0' 'Direct order totalAmount is zero'
else
  echo "Direct POST /orders failed with $code3"; fail_count=$((fail_count+1))
fi

echo "Verifying seat $seat2 marked SOLD in event $event2"
# fetch events list (admin) and inspect seat status for the event
curl -s "$API/events?admin=true" -o $TMP/events_full.json
python3 - <<PY > $TMP/event2.json
import json,sys
evs=json.load(open('$TMP/events_full.json'))
out=None
for e in evs:
  if str(e.get('id'))==str('$event2'):
    out=e
    break
print(json.dumps(out) if out else '')
PY
if [ -n "$org2" ] && [ "$org2" != "null" ]; then
  do_patch "$API/users/$org2/complimentary-limit" '{"complimentaryLimit":null}' > $TMP/patch_org2_clear.json || true
fi
  if [ $HAVE_JQ -eq 1 ]; then
    status2=$(jq -r --arg s "$seat2" '.seats[] | select(.id==$s) | .status' $TMP/event2.json || echo "MISSING")
  else
  status2=$(python3 - <<PY
import json,sys
data=json.load(open('$TMP/event2.json'))
if not isinstance(data, dict):
  print('MISSING')
  sys.exit(0)
for s in data.get('seats',[]):
  if s.get('id')=='$seat2':
    print(s.get('status'))
    sys.exit(0)
print('MISSING')
PY
)
fi
if [ "$status2" = "SOLD" ]; then echo "PASS: seat $seat2 is SOLD"; ok_count=$((ok_count+1)); else echo "FAIL: seat $seat2 status is $status2"; fail_count=$((fail_count+1)); fi

echo "\n=== Test C: Booking a SOLD seat should return conflict ==="
do_post "$API/orders" "{\"customer\":{\"name\":\"ConflictTester\",\"email\":\"conflict@example.com\"},\"event\":{\"id\":\"$event2\",\"title\":\"DirectEvent\"},\"seats\":[{\"id\":\"$seat2\",\"price\":0}],\"serviceFee\":0,\"paymentMode\":\"COMPLIMENTARY\"}"
code4=$(cat $TMP/last_code)
if [ "$code4" = "409" ] || [ "$code4" = "400" ]; then echo "PASS: booking SOLD seat was rejected (HTTP $code4)"; ok_count=$((ok_count+1)); else echo "FAIL: booking SOLD seat returned $code4"; fail_count=$((fail_count+1)); fi

echo "\n=== Test D: Concurrency test (two simultaneous complimentary requests for same available seat) ==="
# Find a fresh available seat if possible
if [ $HAVE_JQ -eq 1 ]; then
  fresh=$(jq -c '.[] | {eventId: .id} as $e | .seats[]? | select(.status=="AVAILABLE") | {eventId: $e.eventId, seatId: .id}' $TMP/events.json | head -n1 || true)
else
  fresh=$(python3 - <<PY
import json,sys
evs=json.load(open('$TMP/events.json'))
found=None
for e in evs:
  for s in e.get('seats') or []:
    if s.get('status')=='AVAILABLE':
      found={'eventId': e.get('id'), 'seatId': s.get('id')}
      break
  if found:
    break
import json
print(json.dumps(found) if found else '')
PY
)
fi

if [ -z "$fresh" ]; then
  echo "No fresh seat found for concurrency test; skipping";
else
  if [ $HAVE_JQ -eq 1 ]; then
    if [ $HAVE_JQ -eq 1 ]; then
      fevent=$(echo "$fresh" | jq -r '.eventId'); fseat=$(echo "$fresh" | jq -r '.seatId')
    else
      fevent=$(python3 - <<PY
import json,sys
obj=json.loads('$fresh') if '$fresh' else None
print(obj.get('eventId') if obj else '')
PY
)
      fseat=$(python3 - <<PY
import json,sys
obj=json.loads('$fresh') if '$fresh' else None
print(obj.get('seatId') if obj else '')
PY
)
    fi
  else
    fevent=$(python3 - <<PY
import json,sys
obj=json.loads('$fresh')
print(obj.get('eventId'))
PY
)
    fseat=$(python3 - <<PY
import json,sys
obj=json.loads('$fresh')
print(obj.get('seatId'))
PY
)
  fi
  echo "Concurrency target: event=$fevent seat=$fseat"
  # Launch two parallel requests
  (curl -s -X POST "$API/orders/payment-pending" -H 'Content-Type: application/json' -d "{\"eventId\":\"$fevent\",\"seatIds\":[\"$fseat\"],\"customer\":{\"name\":\"Race1\",\"email\":\"r1@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}" -o $TMP/race1.json -w "%{http_code}" ) > $TMP/race1_code.txt &
  (curl -s -X POST "$API/orders/payment-pending" -H 'Content-Type: application/json' -d "{\"eventId\":\"$fevent\",\"seatIds\":[\"$fseat\"],\"customer\":{\"name\":\"Race2\",\"email\":\"r2@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}" -o $TMP/race2.json -w "%{http_code}" ) > $TMP/race2_code.txt &
  wait
  codea=$(cat $TMP/race1_code.txt || echo "")
  codeb=$(cat $TMP/race2_code.txt || echo "")
  echo "Race responses: $codea and $codeb"
  if { [ "$codea" = "200" ] && [ "$codeb" = "409" ]; } || { [ "$codeb" = "200" ] && [ "$codea" = "409" ]; } || { [ "$codea" = "201" ] && [ "$codeb" = "409" ]; } || { [ "$codeb" = "201" ] && [ "$codea" = "409" ]; } || { [ "$codea" = "409" ] && [ "$codeb" = "409" ]; }; then
    echo "PASS: concurrency handled (one success, one conflict, or both lost)"; ok_count=$((ok_count+1));
  else
    echo "WARNING: concurrency result unexpected"; fail_count=$((fail_count+1));
  fi
fi

echo "\n=== Test E: Organizer-level complimentary limit enforcement ==="
if [ -z "$org1" ] || [ "$org1" = "null" ]; then
  echo "No organizer id available; skipping organizer-level test";
else
  echo "Determining current complimentary usage for organizer $org1"
  # fetch organizer's events and count complimentary tickets across them
  curl -s "$API/events?admin=true&organizerId=$org1" -o $TMP/org_events.json || true
  used_org_count=0
  for eid in $(python3 - <<PY
import json
evs=json.load(open('$TMP/org_events.json'))
print('\n'.join([str(e.get('id')) for e in evs]))
PY
); do
    if [ -z "$eid" ]; then continue; fi
    curl -s "$API/orders?eventId=$eid" -o $TMP/orders_tmp.json || true
    if [ $HAVE_JQ -eq 1 ]; then
      c=$(jq '[.[] | select(.complimentary==true) | .tickets[]?] | length' $TMP/orders_tmp.json 2>/dev/null || echo 0)
    else
      c=$(python3 - <<PY
import json
try:
  o=json.load(open('$TMP/orders_tmp.json'))
  cnt=0
  for ord in o:
    if ord.get('complimentary'):
      cnt += len(ord.get('tickets') or [])
  print(cnt)
except Exception:
  print(0)
PY
)
    fi
    used_org_count=$((used_org_count + c))
  done
  limit_org=$((used_org_count+1))
  echo "Detected $used_org_count existing complimentary tickets for organizer; setting complimentaryLimit=$limit_org"
  do_patch "$API/users/$org1/complimentary-limit" "{\"complimentaryLimit\":$limit_org}" > $TMP/patch_org.json || true

  # Find two available seats across this organizer's events
  # Refresh events snapshot to reflect seats sold by earlier tests
  curl -s "$API/events?admin=true" -o $TMP/events.json
  if [ $HAVE_JQ -eq 1 ]; then
    seats_org=( $(jq -r --arg org "$org1" '.[] | select(.organizerId==$org) | .seats[]? | select(.status=="AVAILABLE") | .id' $TMP/events.json) )
  else
    # python fallback to get available seat ids for organizer
    mapfile -t seats_org < <(python3 - <<PY
import json,sys
org='$org1'
evs=json.load(open('$TMP/events.json'))
out=[]
for e in evs:
  if str(e.get('organizerId'))==str(org):
    for s in e.get('seats') or []:
      if s.get('status')=='AVAILABLE':
        out.append(s.get('id'))
print('\n'.join([str(x) for x in out]))
PY
)
  fi
  if [ ${#seats_org[@]} -lt 1 ]; then
    echo "No available seats for organizer $org1; skipping organizer-level test";
  else
    s1=${seats_org[0]}
    # Attempt first complimentary booking
    # discover event id for this seat
    if [ $HAVE_JQ -eq 1 ]; then
      e1=$(jq -r --arg s "$s1" '.[] | select(.seats[]? | select(.id==$s)) | .id' $TMP/events.json)
    else
      e1=$(python3 - <<PY
import json,sys
s='$s1'
evs=json.load(open('$TMP/events.json'))
for e in evs:
  for seat in e.get('seats') or []:
    if seat.get('id')==s:
      print(e.get('id'))
      sys.exit(0)
print('')
PY
)
    fi
    do_post "$API/orders/payment-pending" "{\"eventId\":\"$e1\",\"seatIds\":[\"$s1\"],\"customer\":{\"name\":\"OrgTester1\",\"email\":\"o1@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}"
    c1=$(cat $TMP/last_code)
    if [ "$c1" = "200" ] || [ "$c1" = "201" ]; then echo "PASS: organizer first complimentary booking succeeded"; ok_count=$((ok_count+1)); else echo "FAIL: organizer first booking failed ($c1)"; fail_count=$((fail_count+1)); fi

    # Attempt second complimentary booking across organizer (choose another seat if exists)
    if [ ${#seats_org[@]} -ge 2 ]; then
      s2=${seats_org[1]}
      if [ $HAVE_JQ -eq 1 ]; then
        e2=$(jq -r --arg s "$s2" '.[] | select(.seats[]? | select(.id==$s)) | .id' $TMP/events.json)
      else
        e2=$(python3 - <<PY
import json,sys
s='$s2'
evs=json.load(open('$TMP/events.json'))
out=''
for e in evs:
  for seat in e.get('seats') or []:
    if seat.get('id')==s:
      out=e.get('id')
      break
  if out: break
print(out)
PY
)
      fi
      do_post "$API/orders/payment-pending" "{\"eventId\":\"$e2\",\"seatIds\":[\"$s2\"],\"customer\":{\"name\":\"OrgTester2\",\"email\":\"o2@example.com\"},\"paymentMode\":\"COMPLIMENTARY\"}"
      c2=$(cat $TMP/last_code)
      if [ "$c2" = "400" ] || [ "$c2" = "409" ]; then echo "PASS: organizer second booking blocked ($c2)"; ok_count=$((ok_count+1)); else echo "FAIL: organizer second booking unexpected ($c2)"; fail_count=$((fail_count+1)); fi
    else
      echo "Only one available seat for organizer; cannot complete second booking test. Skipping second check.";
    fi
  fi
fi

echo "\n=== Summary ==="
echo "Passes: $ok_count  Failures: $fail_count"
if [ $fail_count -gt 0 ]; then exit 2; else exit 0; fi
