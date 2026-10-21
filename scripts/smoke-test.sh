#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3100}"
: "${APP_PASSCODE:?APP_PASSCODE is required}"

JAR="$(mktemp)"
BODY="$(mktemp)"
HEADERS="$(mktemp)"
trap 'rm -f "$JAR" "$BODY" "$HEADERS"' EXIT

passed=0
failed=0

check() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  if [ "$expected" = "$actual" ]; then
    echo "PASS $label ($actual)"
    passed=$((passed + 1))
  else
    echo "FAIL $label (expected $expected, got $actual)"
    failed=$((failed + 1))
  fi
}

check_contains() {
  local label="$1"
  local needle="$2"
  local file="$3"
  if grep -qi -- "$needle" "$file"; then
    echo "PASS $label"
    passed=$((passed + 1))
  else
    echo "FAIL $label (missing: $needle)"
    failed=$((failed + 1))
  fi
}

echo "== health =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' "$BASE_URL/api/health")"
check "GET /api/health" 200 "$status"
check_contains "health ok:true" '"ok":true' "$BODY"

echo "== unauthenticated =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' "$BASE_URL/api/records")"
check "GET /api/records without cookie" 401 "$status"

echo "== wrong passcode =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -X POST \
  -H 'Content-Type: application/json' \
  --data '{"passcode":"definitely-wrong"}' \
  "$BASE_URL/api/auth")"
check "POST /api/auth wrong passcode" 401 "$status"

echo "== login =="
status="$(curl -sS -D "$HEADERS" -o "$BODY" -w '%{http_code}' -c "$JAR" -X POST \
  -H 'Content-Type: application/json' \
  --data "{\"passcode\":\"$APP_PASSCODE\"}" \
  "$BASE_URL/api/auth")"
check "POST /api/auth correct passcode" 204 "$status"
check_contains "cookie HttpOnly" 'HttpOnly' "$HEADERS"
if [[ "$BASE_URL" == https://* ]]; then
  check_contains "cookie Secure" 'Secure' "$HEADERS"
else
  echo "SKIP cookie Secure (local HTTP; production must use COOKIE_SECURE=true behind HTTPS)"
fi
check_contains "cookie SameSite=Lax" 'SameSite=Lax' "$HEADERS"
check_contains "cookie Max-Age=2592000" 'Max-Age=2592000' "$HEADERS"

echo "== authenticated read =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" "$BASE_URL/api/records")"
check "GET /api/records with cookie" 200 "$status"

echo "== create =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" -c "$JAR" -X POST \
  -H 'Content-Type: application/json' \
  --data '{"date":"2026-10-21","players":[{"name":"SmokeA","score":10},{"name":"SmokeB","score":-10},{"name":"SmokeC","score":0},{"name":"SmokeD","score":0}]}' \
  "$BASE_URL/api/records")"
check "POST /api/records" 201 "$status"
RECORD_ID="$(node -e "const fs=require('fs');const body=JSON.parse(fs.readFileSync(process.argv[1],'utf8'));process.stdout.write(body.id)" "$BODY")"
echo "record id: $RECORD_ID"

echo "== read one =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" "$BASE_URL/api/records")"
check "GET /api/records after create" 200 "$status"

echo "== patch =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" -c "$JAR" -X PATCH \
  -H 'Content-Type: application/json' \
  --data '{"date":"2026-10-22"}' \
  "$BASE_URL/api/records/$RECORD_ID")"
check "PATCH /api/records/:id" 200 "$status"

echo "== players / stats / ranking =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" "$BASE_URL/api/players")"
check "GET /api/players" 200 "$status"
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" "$BASE_URL/api/stats?player=SmokeA&year=2026")"
check "GET /api/stats" 200 "$status"
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" "$BASE_URL/api/ranking")"
check "GET /api/ranking" 200 "$status"

echo "== delete =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" -c "$JAR" -X DELETE \
  "$BASE_URL/api/records/$RECORD_ID")"
check "DELETE /api/records/:id" 204 "$status"

echo "== logout =="
status="$(curl -sS -o "$BODY" -w '%{http_code}' -b "$JAR" -c "$JAR" -X POST "$BASE_URL/api/auth/logout")"
check "POST /api/auth/logout" 204 "$status"
status="$(curl -sS -o "$BODY" -w '%{http_code}' "$BASE_URL/api/records")"
check "GET /api/records after logout" 401 "$status"

echo
echo "smoke: $passed passed, $failed failed"
if [ "$failed" -ne 0 ]; then
  exit 1
fi
