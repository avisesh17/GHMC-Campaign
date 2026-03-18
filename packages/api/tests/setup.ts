import { buildApp } from '../src/server'
import { FastifyInstance } from 'fastify'

// Each call returns a FRESH app instance — no singleton.
// Prevents "Fastify already closed" when multiple suites share one instance.
export async function getTestApp(): Promise<FastifyInstance> {
  process.env.NODE_ENV       = 'test'
  process.env.JWT_SECRET     = 'test-secret-ghmc-campaign-2026'
  process.env.DEV_OTP_BYPASS = 'true'

  if (!process.env.DATABASE_URL || process.env.DATABASE_URL.includes('YOUR_PASSWORD')) {
    throw new Error(
      '\n\nDATABASE_URL not configured.\n' +
      'Open packages/api/.env and set DATABASE_URL to your Supabase connection string.\n' +
      '(Supabase dashboard → Settings → Database → Connection string → URI)\n'
    )
  }

  const app = buildApp()
  await app.ready()
  return app
}

// Accepts the per-suite app instance — no global state.
export async function closeTestApp(app: FastifyInstance): Promise<void> {
  try {
    await app.close()
  } catch {
    // Already closed — safe to ignore
  }
}

// Generate a test JWT for a given role
export function makeToken(app: FastifyInstance, overrides: Record<string,any> = {}) {
  return app.jwt.sign({
    user_id:           'aaaaaaaa-0000-0000-0000-000000000003',
    name:              'Suresh Patil',
    role:              'volunteer',
    tenant_id:         '44444444-0000-0000-0000-000000000001',
    tenant_slug:       'bjp-ward42',
    schema:            'tenant_bjp_ward42',
    assigned_ward_id:  '22222222-0000-0000-0000-000000000001',
    assigned_booth_id: '33333333-0000-0000-0000-000000000001',
    ...overrides
  })
}

export function wardAdminToken(app: FastifyInstance) {
  return makeToken(app, {
    user_id:           'aaaaaaaa-0000-0000-0000-000000000002',
    name:              'Anita Reddy',
    role:              'ward_admin',
    assigned_booth_id: null
  })
}

export function ownerToken(app: FastifyInstance) {
  return makeToken(app, {
    user_id:           'aaaaaaaa-0000-0000-0000-000000000001',
    name:              'K. Ramesh',
    role:              'tenant_owner',
    assigned_booth_id: null
  })
}
