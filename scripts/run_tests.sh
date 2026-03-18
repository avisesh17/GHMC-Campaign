#!/bin/bash
# ============================================================
# GHMC Campaign — QA Test Runner
# Run from packages/api: bash ../../scripts/run_tests.sh
# ============================================================

set -e

GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
PASS=0; FAIL=0

log()  { echo -e "${GREEN}✓${NC} $1"; PASS=$((PASS+1)); }
fail() { echo -e "${RED}✗${NC} $1"; FAIL=$((FAIL+1)); }
info() { echo -e "${YELLOW}→${NC} $1"; }

API=${API_URL:-http://localhost:3001}
TOKEN=""
ADMIN_TOKEN=""

echo ""
echo "════════════════════════════════════════"
echo "  GHMC Campaign — Automated QA Suite"
echo "  Target: $API"
echo "════════════════════════════════════════"
echo ""

# ─── 1. Health check ─────────────────────────────────────────
info "1. Health check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$API/health")
[ "$STATUS" = "200" ] && log "Health endpoint returns 200" || fail "Health endpoint failed: $STATUS"

# ─── 2. Auth flow ────────────────────────────────────────────
info "2. Auth — request OTP"
RES=$(curl -s -X POST "$API/auth/request-otp" \
  -H "Content-Type: application/json" \
  -d '{"phone":"9922334455","tenantSlug":"bjp-ward42"}')
echo "$RES" | grep -q "OTP sent" && log "OTP request succeeds" || fail "OTP request failed: $RES"
OTP=$(echo "$RES" | grep -o '"devOtp":"[0-9]*"' | grep -o '[0-9]*')

info "2b. Auth — verify OTP"
if [ -n "$OTP" ]; then
  VRES=$(curl -s -X POST "$API/auth/verify-otp" \
    -H "Content-Type: application/json" \
    -d "{\"phone\":\"9922334455\",\"otp\":\"$OTP\",\"tenantSlug\":\"bjp-ward42\"}")
  echo "$VRES" | grep -q '"token"' && log "OTP verification returns JWT" || fail "OTP verification failed: $VRES"
  TOKEN=$(echo "$VRES" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
else
  fail "Could not extract OTP from response (DEV_OTP_BYPASS may be false)"
fi

info "2c. Auth — ward admin login"
if [ -n "$OTP" ]; then
  ARES=$(curl -s -X POST "$API/auth/request-otp" \
    -H "Content-Type: application/json" \
    -d '{"phone":"9811223344","tenantSlug":"bjp-ward42"}')
  AOTP=$(echo "$ARES" | grep -o '"devOtp":"[0-9]*"' | grep -o '[0-9]*')
  if [ -n "$AOTP" ]; then
    AVRES=$(curl -s -X POST "$API/auth/verify-otp" \
      -H "Content-Type: application/json" \
      -d "{\"phone\":\"9811223344\",\"otp\":\"$AOTP\",\"tenantSlug\":\"bjp-ward42\"}")
    ADMIN_TOKEN=$(echo "$AVRES" | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
    [ -n "$ADMIN_TOKEN" ] && log "Ward admin login succeeds" || fail "Ward admin login failed"
  fi
fi

# ─── 3. Voters ───────────────────────────────────────────────
info "3. Voter routes"
if [ -n "$TOKEN" ]; then
  VLIST=$(curl -s "$API/api/voters" -H "Authorization: Bearer $TOKEN")
  echo "$VLIST" | grep -q '"voters"' && log "Voter list returns data" || fail "Voter list failed: $VLIST"

  # Test search
  VSEARCH=$(curl -s "$API/api/voters?q=Laxmi" -H "Authorization: Bearer $TOKEN")
  echo "$VSEARCH" | grep -q "Laxmi" && log "Voter search by name works" || fail "Voter search failed"

  # Test support filter
  VSUPP=$(curl -s "$API/api/voters?support=supporter" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$VSUPP" | grep -q "supporter" && log "Voter filter by support works" || fail "Voter support filter failed"

  # Test voter detail
  VDET=$(curl -s "$API/api/voters/dddddddd-0000-0000-0000-000000000001" -H "Authorization: Bearer $TOKEN")
  echo "$VDET" | grep -q "Laxmi" && log "Voter detail returns correct voter" || fail "Voter detail failed"
fi

# ─── 4. Canvassing ───────────────────────────────────────────
info "4. Canvassing routes"
if [ -n "$TOKEN" ]; then
  LOG_RES=$(curl -s -X POST "$API/api/canvassing/log" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "voter_id": "dddddddd-0000-0000-0000-000000000003",
      "campaign_id": "eeeeeeee-0000-0000-0000-000000000001",
      "outcome": "contacted",
      "support_given": "supporter",
      "notes": "QA test visit",
      "lat": 17.4413, "lng": 78.4984
    }')
  echo "$LOG_RES" | grep -q '"log_id"' && log "Canvassing log submission works" || fail "Canvassing log failed: $LOG_RES"

  # Verify voter support_level updated
  UPDATED=$(curl -s "$API/api/voters/dddddddd-0000-0000-0000-000000000003" -H "Authorization: Bearer $TOKEN")
  echo "$UPDATED" | grep -q '"supporter"' && log "Voter support_level updated after log" || fail "Support level not updated"

  # Log with issues
  ISSUE_RES=$(curl -s -X POST "$API/api/canvassing/log" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "voter_id": "dddddddd-0000-0000-0000-000000000008",
      "campaign_id": "eeeeeeee-0000-0000-0000-000000000001",
      "outcome": "contacted",
      "support_given": "neutral",
      "issues": [{"category":"roads","severity":"high"},{"category":"water","severity":"medium"}]
    }')
  echo "$ISSUE_RES" | grep -q '"issues_logged":2' && log "Civic issues logged with visit" || fail "Issue logging failed: $ISSUE_RES"

  # Summary
  SUMM=$(curl -s "$API/api/canvassing/summary" -H "Authorization: Bearer $TOKEN")
  echo "$SUMM" | grep -q '"total"' && log "Canvassing summary returns stats" || fail "Summary failed"
fi

# ─── 5. RBAC checks ──────────────────────────────────────────
info "5. RBAC checks"
if [ -n "$TOKEN" ]; then
  # Volunteer cannot create voter
  RBAC1=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/voters" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"voter_id":"RBAC001","full_name":"Test","age":25,"gender":"M","booth_id":"33333333-0000-0000-0000-000000000001","ward_id":"22222222-0000-0000-0000-000000000001"}')
  [ "$RBAC1" = "403" ] && log "Volunteer blocked from creating voter (403)" || fail "RBAC: volunteer should not create voter (got $RBAC1)"

  # No token = 401
  RBAC2=$(curl -s -o /dev/null -w "%{http_code}" "$API/api/voters")
  [ "$RBAC2" = "401" ] && log "No token returns 401" || fail "No token should return 401 (got $RBAC2)"

  # Ward admin can create voter
  if [ -n "$ADMIN_TOKEN" ]; then
    RBAC3=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$API/api/voters" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d '{"voter_id":"RBAC002","full_name":"Ward Admin Test","age":30,"gender":"F","booth_id":"33333333-0000-0000-0000-000000000001","ward_id":"22222222-0000-0000-0000-000000000001"}')
    [ "$RBAC3" = "201" ] && log "Ward admin can create voter (201)" || fail "Ward admin should create voter (got $RBAC3)"
  fi
fi

# ─── 6. Reports ───────────────────────────────────────────────
info "6. Reports"
if [ -n "$ADMIN_TOKEN" ]; then
  CVRG=$(curl -s "$API/api/reports/coverage" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$CVRG" | grep -q '"coverage"' && log "Coverage report returns data" || fail "Coverage report failed"

  ISSUES=$(curl -s "$API/api/reports/issues" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$ISSUES" | grep -q '"issues"' && log "Issues report returns data" || fail "Issues report failed"

  VOLACT=$(curl -s "$API/api/reports/volunteer-activity" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$VOLACT" | grep -q '"volunteers"' && log "Volunteer activity returns data" || fail "Volunteer activity failed"
fi

# ─── 7. Booths & households ───────────────────────────────────
info "7. Booths and households"
if [ -n "$TOKEN" ]; then
  BOOTHS=$(curl -s "$API/api/booths" -H "Authorization: Bearer $ADMIN_TOKEN")
  echo "$BOOTHS" | grep -q '"booths"' && log "Booth list returns data" || fail "Booth list failed"

  HH=$(curl -s "$API/api/booths/33333333-0000-0000-0000-000000000001/households" \
    -H "Authorization: Bearer $TOKEN")
  echo "$HH" | grep -q '"households"' && log "Household list returns data" || fail "Household list failed"
fi

# ─── Summary ─────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════"
echo -e "  Results: ${GREEN}$PASS passed${NC} | ${RED}$FAIL failed${NC}"
echo "════════════════════════════════════════"
echo ""

if [ "$FAIL" -gt 0 ]; then
  echo -e "${RED}Some tests failed. Check API logs for details.${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed! Your API is working correctly.${NC}"
fi
