import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db, tenantDb } from '../plugins/db'

const requestOtpSchema = z.object({
  phone:      z.string().min(10).max(15),
  tenantSlug: z.string().min(3).max(50)
})

const verifyOtpSchema = z.object({
  phone:      z.string(),
  otp:        z.string().length(6),
  tenantSlug: z.string()
})

function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

export async function authRoutes(app: FastifyInstance) {

  // POST /auth/request-otp
  app.post('/request-otp', async (request, reply) => {
    const parse = requestOtpSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })
    const { phone, tenantSlug } = parse.data

    // 1. Verify tenant exists and is active
    const { rows: tenants } = await db.query(
      `SELECT id, slug, name, db_schema, status FROM public.tenants WHERE slug = $1`,
      [tenantSlug]
    )
    if (!tenants.length)
      return reply.status(404).send({ error: 'Campaign not found. Check your slug.' })
    if (tenants[0].status !== 'active')
      return reply.status(403).send({ error: 'Campaign is not active.' })

    const tenant = tenants[0]
    const tdb    = tenantDb(tenant.db_schema)

    // 2. Verify user exists in tenant schema
    const { rows: users } = await tdb.query(
      `SELECT id, name, role, is_active FROM users WHERE phone = $1`,
      [phone]
    )
    if (!users.length)
      return reply.status(404).send({ error: 'Phone number not registered for this campaign.' })
    if (!users[0].is_active)
      return reply.status(403).send({ error: 'Your account has been deactivated.' })

    // 3. Generate OTP and store in DB (not in-memory — survives server restarts)
    const otp       = generateOtp()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000) // 10 minutes

    await tdb.query(
      `UPDATE users SET otp_code = $1, otp_expires_at = $2 WHERE id = $3`,
      [otp, expiresAt, users[0].id]
    )

    // 4. Log OTP in dev mode (replace with SMS in production)
    if (process.env.DEV_OTP_BYPASS === 'true') {
      console.log(`[DEV OTP] Phone: ${phone} | OTP: ${otp}`)
    } else {
      // TODO: send real SMS via MSG91 / Twilio
    }

    return reply.send({
      message:    'OTP sent successfully',
      tenantName: tenant.name,
      ...(process.env.DEV_OTP_BYPASS === 'true' && { devOtp: otp })
    })
  })

  // POST /auth/verify-otp
  app.post('/verify-otp', async (request, reply) => {
    const parse = verifyOtpSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })
    const { phone, otp, tenantSlug } = parse.data

    // 1. Get tenant
    const { rows: tenants } = await db.query(
      `SELECT id, slug, name, db_schema FROM public.tenants WHERE slug = $1 AND status = 'active'`,
      [tenantSlug]
    )
    if (!tenants.length)
      return reply.status(404).send({ error: 'Campaign not found.' })

    const tenant = tenants[0]
    const tdb    = tenantDb(tenant.db_schema)

    // 2. Get user and validate OTP from DB
    const { rows: users } = await tdb.query(
      `SELECT id, name, role, assigned_ward_id, assigned_booth_id,
              otp_code, otp_expires_at
       FROM users
       WHERE phone = $1 AND is_active = true`,
      [phone]
    )

    if (!users.length)
      return reply.status(404).send({ error: 'Phone number not registered.' })

    const user = users[0]

    // 3. Validate OTP
    if (!user.otp_code)
      return reply.status(400).send({ error: 'No OTP requested. Please request a new OTP.' })

    if (new Date() > new Date(user.otp_expires_at))
      return reply.status(400).send({ error: 'OTP has expired. Please request a new one.' })

    if (user.otp_code !== otp)
      return reply.status(400).send({ error: 'Invalid OTP. Please try again.' })

    // 4. Clear OTP and update last login
    await tdb.query(
      `UPDATE users
       SET otp_code = NULL, otp_expires_at = NULL, last_login_at = NOW()
       WHERE id = $1`,
      [user.id]
    )

    // 5. Sign JWT
    const token = app.jwt.sign({
      user_id:           user.id,
      name:              user.name,
      role:              user.role,
      tenant_id:         tenant.id,
      tenant_slug:       tenant.slug,
      schema:            tenant.db_schema,
      assigned_ward_id:  user.assigned_ward_id,
      assigned_booth_id: user.assigned_booth_id
    }, { expiresIn: process.env.JWT_EXPIRY || '7d' })

    return reply.send({
      token,
      user: {
        id:         user.id,
        name:       user.name,
        role:       user.role,
        tenantName: tenant.name,
        tenantSlug: tenant.slug
      }
    })
  })

  // POST /auth/refresh
  app.post('/refresh', {
    preHandler: [async (req, rep) => {
      try { await req.jwtVerify() }
      catch { rep.status(401).send({ error: 'Invalid token' }) }
    }]
  }, async (request, reply) => {
    const payload = request.user as any
    const token   = app.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRY || '7d' })
    return reply.send({ token })
  })
}