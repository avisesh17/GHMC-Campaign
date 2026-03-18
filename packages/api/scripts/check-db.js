/**
 * GHMC Campaign — Database Connection Diagnostics
 * Run from packages/api folder:
 *   node scripts/check-db.js
 */

// Must be set BEFORE any pg import
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'

const path = require('path')
const fs   = require('fs')

const envPath = path.join(__dirname, '..', '.env')

if (!fs.existsSync(envPath)) {
  console.log('\n❌  .env file NOT FOUND at:', envPath)
  console.log('   Fix: copy .env.example .env  then edit it\n')
  process.exit(1)
}
console.log('✅  .env file found at:', envPath)

// Parse .env
const envVars = {}
fs.readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const eq = trimmed.indexOf('=')
  if (eq === -1) return
  envVars[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim()
})

console.log('\n── Checking .env variables ──────────────────────────\n')

const url = envVars.DATABASE_URL || ''
if (!url || url.includes('YOUR_PASSWORD') || url.includes('YOUR_PROJECT_REF')) {
  console.log('❌  DATABASE_URL still has placeholder text')
  console.log('   Fix: Replace with your real Supabase connection string\n')
  process.exit(1)
}
const masked = url.replace(/:([^:@]+)@/, ':***@')
console.log('✅  DATABASE_URL =', masked)
console.log('✅  JWT_SECRET   =', envVars.JWT_SECRET ? 'set' : '❌ MISSING')
console.log('✅  DEV_OTP_BYPASS =', envVars.DEV_OTP_BYPASS || 'not set')

console.log('\n── Testing database connection ──────────────────────\n')
console.log('   URL:', masked)

const { Pool } = require('pg')
const pool = new Pool({
  connectionString: url,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
})

async function run() {
  let client
  try {
    client = await pool.connect()
    console.log('✅  Connected!\n')

    console.log('── Checking tables ──────────────────────────────────\n')
    const checks = [
      ['public',             'tenants'],
      ['public',             'wards'],
      ['public',             'booths'],
      ['tenant_bjp_ward42',  'users'],
      ['tenant_bjp_ward42',  'voters'],
      ['tenant_bjp_ward42',  'campaigns'],
      ['tenant_bjp_ward42',  'canvassing_logs'],
      ['tenant_bjp_ward42',  'ward_issues'],
    ]
    let allTablesOk = true
    for (const [schema, table] of checks) {
      try {
        const r = await client.query(`SELECT COUNT(*) FROM ${schema}.${table}`)
        console.log(`✅  ${schema}.${table} — ${r.rows[0].count} row(s)`)
      } catch {
        console.log(`❌  ${schema}.${table} — NOT FOUND`)
        allTablesOk = false
      }
    }

    if (!allTablesOk) {
      console.log('\n── Missing tables — run these in Supabase SQL Editor ─\n')
      console.log('1. Run: packages/db/migrations/public/001_public_schema.sql')
      console.log('2. Run in SQL editor:')
      console.log('     CREATE SCHEMA IF NOT EXISTS tenant_bjp_ward42;')
      console.log('     SET search_path TO tenant_bjp_ward42, public;')
      console.log('   Then paste: packages/db/migrations/tenant/001_tenant_schema.sql')
      console.log('3. Run: packages/db/seeds/001_sample_data.sql')
    } else {
      console.log('\n🎉  All tables present. Run: npm test\n')
    }

  } catch (err) {
    console.log('❌  Connection failed:', err.message, '\n')
    if (err.message.includes('Tenant or user not found')) {
      console.log('   The username format is wrong for the Supabase pooler.')
      console.log('   Your username should be: postgres.qeacpqlhluzebxkdemqr')
      console.log('   (your project ref appended after postgres.)\n')
    } else if (err.message.includes('password authentication')) {
      console.log('   Wrong password. Reset it in:')
      console.log('   Supabase → Settings → Database → Reset database password\n')
    } else if (err.message.includes('ENOTFOUND')) {
      console.log('   Cannot reach the host. Check your internet connection.')
      console.log('   Also try the pooler URL (port 6543) instead of direct (port 5432)\n')
    }
  } finally {
    if (client) client.release()
    await pool.end()
  }
}

run()
