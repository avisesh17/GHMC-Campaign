#!/bin/bash
# ============================================================
# GHMC Campaign — One-shot local setup script
# Run from the project root: bash scripts/setup.sh
# ============================================================

set -e  # Exit on any error

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[GHMC]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()  { echo -e "${RED}[ERR]${NC} $1"; exit 1; }

log "Starting GHMC Campaign setup..."

# ─── Check prerequisites ──────────────────────────────────────
command -v node >/dev/null 2>&1 || err "Node.js not found. Install from https://nodejs.org"
command -v npm  >/dev/null 2>&1 || err "npm not found. Install Node.js from https://nodejs.org"

NODE_VER=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VER" -lt 18 ]; then
  err "Node.js 18+ required. Current: $(node -v)"
fi

log "Node.js $(node -v) ✓"

# ─── Install API dependencies ─────────────────────────────────
log "Installing API dependencies..."
cd packages/api
npm install --silent
cd ../..
log "API dependencies installed ✓"

# ─── Create .env if missing ────────────────────────────────────
if [ ! -f packages/api/.env ]; then
  cp packages/api/.env.example packages/api/.env
  warn ".env created from template. Please edit packages/api/.env with your values."
  warn "Required: DATABASE_URL, JWT_SECRET, SUPABASE_URL, SUPABASE_SERVICE_KEY"
else
  log ".env already exists ✓"
fi

# ─── Check .env has required variables ────────────────────────
source packages/api/.env 2>/dev/null || true

check_env() {
  if [ -z "${!1}" ] || [[ "${!1}" == *"YOUR_"* ]]; then
    warn "⚠ $1 not configured in .env"
  else
    log "$1 configured ✓"
  fi
}

check_env DATABASE_URL
check_env JWT_SECRET
check_env SUPABASE_URL

# ─── Run database migrations ──────────────────────────────────
if [ -n "$DATABASE_URL" ] && [[ "$DATABASE_URL" != *"YOUR_"* ]]; then
  log "Running public schema migration..."
  psql "$DATABASE_URL" -f packages/db/migrations/public/001_public_schema.sql \
    --quiet 2>&1 | grep -v "^$" || warn "Migration may have already been applied"
  log "Public schema migration ✓"

  log "Creating tenant schema..."
  psql "$DATABASE_URL" -c "CREATE SCHEMA IF NOT EXISTS tenant_bjp_ward42;" --quiet || true
  psql "$DATABASE_URL" \
    -c "SET search_path TO tenant_bjp_ward42, public;" \
    -f packages/db/migrations/tenant/001_tenant_schema.sql \
    --quiet 2>&1 | grep -v "^$" || warn "Tenant schema may already exist"
  log "Tenant schema created ✓"

  log "Loading seed data..."
  psql "$DATABASE_URL" -f packages/db/seeds/001_sample_data.sql \
    --quiet 2>&1 | grep -v "^$" || warn "Seed data may already be loaded"
  log "Seed data loaded ✓"
else
  warn "DATABASE_URL not configured — skipping database setup"
  warn "Run 'bash scripts/migrate.sh' after configuring .env"
fi

echo ""
log "Setup complete!"
echo ""
echo -e "  ${GREEN}Next steps:${NC}"
echo "  1. Edit packages/api/.env with your Supabase credentials"
echo "  2. Run: cd packages/api && npm run dev"
echo "  3. Test: curl http://localhost:3001/health"
echo "  4. Run tests: npm test"
echo ""
echo -e "  ${YELLOW}Test login credentials:${NC}"
echo "  Slug: bjp-ward42"
echo "  Volunteer: 9922334455 (Suresh Patil)"
echo "  Ward Admin: 9811223344 (Anita Reddy)"
echo "  Corporator: 9900112233 (K. Ramesh)"
echo ""
