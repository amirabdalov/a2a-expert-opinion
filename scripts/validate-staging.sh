#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# A2A Global — Staging vs Production Validation Script
# Run AFTER deploying to staging, BEFORE promoting to production.
# Compares row counts, user data, and credit balances across both DBs.
# Exit code 0 = all green, non-zero = discrepancy found.
# ═══════════════════════════════════════════════════════════════════

set -euo pipefail

PG_HOST="34.46.252.14"
PG_USER="postgres"
PG_PASS='A2A$ecureDB2026!'
PROD_DB="a2a_production"
STAGING_DB="a2a_staging"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

ERRORS=0
WARNINGS=0

echo "═══════════════════════════════════════════════════════════"
echo "  A2A Global — Staging Validation"
echo "  $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "═══════════════════════════════════════════════════════════"
echo ""

run_query() {
  local db=$1
  local query=$2
  PGPASSWORD="$PG_PASS" psql -h "$PG_HOST" -U "$PG_USER" -d "$db" -t -A -c "$query" 2>/dev/null
}

# ─── 1. Table row count comparison ───
echo "▸ Step 1: Row count comparison (all tables)"
echo "  ┌────────────────────────┬──────────┬──────────┬────────┐"
echo "  │ Table                  │ Prod     │ Staging  │ Status │"
echo "  ├────────────────────────┼──────────┼──────────┼────────┤"

TABLES="users experts requests credit_transactions expert_reviews messages notifications request_events wallet_transactions withdrawals invoices verification_tests legal_acceptances expert_verifications withdrawal_requests"

for tbl in $TABLES; do
  prod_count=$(run_query "$PROD_DB" "SELECT count(*) FROM $tbl" || echo "ERR")
  stg_count=$(run_query "$STAGING_DB" "SELECT count(*) FROM $tbl" || echo "ERR")
  
  if [ "$prod_count" = "$stg_count" ]; then
    status="${GREEN}  ✓  ${NC}"
  elif [ "$stg_count" -ge "$prod_count" ] 2>/dev/null; then
    # Staging has more rows = OK (new data from testing)
    status="${YELLOW}  ~  ${NC}"
    ((WARNINGS++))
  else
    status="${RED}  ✗  ${NC}"
    ((ERRORS++))
  fi
  printf "  │ %-22s │ %8s │ %8s │ %b│\n" "$tbl" "$prod_count" "$stg_count" "$status"
done
echo "  └────────────────────────┴──────────┴──────────┴────────┘"
echo ""

# ─── 2. Critical user data comparison ───
echo "▸ Step 2: Critical user data (every user — id, name, email, credits, role)"

prod_users=$(run_query "$PROD_DB" "SELECT id || '|' || name || '|' || email || '|' || credits || '|' || role || '|' || tour_completed || '|' || login_count FROM users ORDER BY id")
stg_users=$(run_query "$STAGING_DB" "SELECT id || '|' || name || '|' || email || '|' || credits || '|' || role || '|' || tour_completed || '|' || login_count FROM users ORDER BY id")

echo "  Production users:"
echo "$prod_users" | while IFS='|' read -r id name email credits role tour login; do
  printf "    [%2s] %-20s %-30s credits=%-5s role=%-7s tour=%s login=%s\n" "$id" "$name" "$email" "$credits" "$role" "$tour" "$login"
done

echo ""
echo "  Staging users:"
echo "$stg_users" | while IFS='|' read -r id name email credits role tour login; do
  printf "    [%2s] %-20s %-30s credits=%-5s role=%-7s tour=%s login=%s\n" "$id" "$name" "$email" "$credits" "$role" "$tour" "$login"
done

echo ""

# Compare user-by-user
MISSING_IN_STAGING=""
CREDIT_MISMATCH=""

while IFS='|' read -r id name email credits role tour login; do
  stg_row=$(run_query "$STAGING_DB" "SELECT credits || '|' || name FROM users WHERE id = $id")
  if [ -z "$stg_row" ]; then
    MISSING_IN_STAGING="$MISSING_IN_STAGING  ✗ User $id ($name - $email) MISSING from staging!\n"
    ((ERRORS++))
  else
    stg_credits=$(echo "$stg_row" | cut -d'|' -f1)
    if [ "$credits" != "$stg_credits" ]; then
      CREDIT_MISMATCH="$CREDIT_MISMATCH  ⚠ User $id ($name): prod=$credits staging=$stg_credits\n"
      ((WARNINGS++))
    fi
  fi
done <<< "$prod_users"

if [ -n "$MISSING_IN_STAGING" ]; then
  echo -e "${RED}  MISSING USERS:${NC}"
  echo -e "$MISSING_IN_STAGING"
fi

if [ -n "$CREDIT_MISMATCH" ]; then
  echo -e "${YELLOW}  CREDIT DIFFERENCES (may be OK if staging has test activity):${NC}"
  echo -e "$CREDIT_MISMATCH"
fi

if [ -z "$MISSING_IN_STAGING" ] && [ -z "$CREDIT_MISMATCH" ]; then
  echo -e "  ${GREEN}✓ All production users present in staging with matching credits${NC}"
fi
echo ""

# ─── 3. Schema comparison ───
echo "▸ Step 3: Schema validation (column check)"

prod_cols=$(run_query "$PROD_DB" "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position")
stg_cols=$(run_query "$STAGING_DB" "SELECT table_name || '.' || column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name, ordinal_position")

SCHEMA_DIFF=$(diff <(echo "$prod_cols") <(echo "$stg_cols") || true)
if [ -z "$SCHEMA_DIFF" ]; then
  echo -e "  ${GREEN}✓ Schemas match exactly${NC}"
else
  echo -e "  ${YELLOW}Schema differences (expected if Build 36 adds new columns):${NC}"
  echo "$SCHEMA_DIFF" | head -20
  ((WARNINGS++))
fi
echo ""

# ─── 4. Staging API health check (if staging URL provided) ───
STAGING_URL="${1:-}"
if [ -n "$STAGING_URL" ]; then
  echo "▸ Step 4: Staging API health check ($STAGING_URL)"
  HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$STAGING_URL/api/health" 2>/dev/null || echo "000")
  if [ "$HTTP_CODE" = "200" ]; then
    echo -e "  ${GREEN}✓ /api/health → 200 OK${NC}"
  else
    echo -e "  ${RED}✗ /api/health → HTTP $HTTP_CODE${NC}"
    ((ERRORS++))
  fi
  
  # Check user count via API
  USER_COUNT=$(curl -s "$STAGING_URL/api/admin/stats" 2>/dev/null | grep -o '"userCount":[0-9]*' | cut -d: -f2 || echo "?")
  echo "  User count from staging API: $USER_COUNT"
  echo ""
else
  echo "▸ Step 4: Skipped (pass staging URL as argument to enable)"
  echo "  Usage: ./validate-staging.sh https://a2a-registration-staging-xxxxx.run.app"
  echo ""
fi

# ─── Summary ───
echo "═══════════════════════════════════════════════════════════"
if [ $ERRORS -gt 0 ]; then
  echo -e "  ${RED}✗ FAILED — $ERRORS errors, $WARNINGS warnings${NC}"
  echo "  DO NOT promote to production."
  exit 1
elif [ $WARNINGS -gt 0 ]; then
  echo -e "  ${YELLOW}~ PASSED with $WARNINGS warnings${NC}"
  echo "  Review warnings above. If expected, safe to promote."
  exit 0
else
  echo -e "  ${GREEN}✓ ALL CHECKS PASSED — safe to promote to production${NC}"
  exit 0
fi
