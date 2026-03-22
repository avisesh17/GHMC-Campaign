import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { db } from '../plugins/db'
import { tenantDb } from '../plugins/db'

// In-memory OTP store (use Redis in production)
const otpStore = new Map<string, { otp: string; expires: number; tenantSlug: string }>()

const requestOtpSchema = z.object({
  phone:       z.string().min(10).max(15),
  tenantSlug:  z.string().min(3).max(50)
})

const verifyOtpSchema = z.object({
  phone:      z.string(),
  otp:        z.string().length(6),
  tenantSlug: z.string()
})

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

async function sendSms(phone: string, otp: string) {
  if (process.env.DEV_OTP_BYPASS === 'true') {
    console.log(`[DEV OTP] Phone: ${phone} | OTP: ${otp}`)
    return
  }
  // Production: use Twilio or similar
  // const client = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  // await client.messages.create({ body: `Your GHMC Campaign OTP: ${otp}`, from: process.env.TWILIO_PHONE_NUMBER, to: `+91${phone}` })
}

export async function authRoutes(app: FastifyInstance) {

  // POST /auth/request-otp
  app.post('/request-otp', async (request, reply) => {
    const parse = requestOtpSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })
    const { phone, tenantSlug } = parse.data

    // Verify tenant exists and is active
    const { rows: tenants } = await db.query(
      `SELECT id, slug, name, db_schema, status FROM public.tenants WHERE slug = $1`,
      [tenantSlug]
    )
    if (!tenants.length)        return reply.status(404).send({ error: 'Campaign not found. Check your slug.' })
    if (tenants[0].status !== 'active') return reply.status(403).send({ error: 'Campaign is not active.' })

    const tenant = tenants[0]

    // Verify user exists in tenant schema
    const tdb = tenantDb(tenant.db_schema)
    const { rows: users } = await tdb.query(
      `SELECT id, name, role, is_active FROM users WHERE phone = $1`,
      [phone]
    )
    if (!users.length)       return reply.status(404).send({ error: 'Phone number not registered for this campaign.' })
    if (!users[0].is_active) return reply.status(403).send({ error: 'Your account has been deactivated.' })

    // Generate and store OTP
    const otp = generateOtp()
    otpStore.set(phone, { otp, expires: Date.now() + 10 * 60 * 1000, tenantSlug })
    await sendSms(phone, otp)

    return reply.send({
      message: 'OTP sent',
      tenantName: tenant.name,
      // Only include in dev
      ...(process.env.DEV_OTP_BYPASS === 'true' && { devOtp: otp })
    })
  })

  // POST /auth/verify-otp
  app.post('/verify-otp', async (request, reply) => {
    const parse = verifyOtpSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })
    const { phone, otp, tenantSlug } = parse.data

    const stored = otpStore.get(phone)
    if (!stored)                           return reply.status(400).send({ error: 'No OTP requested for this number.' })
    if (stored.tenantSlug !== tenantSlug)  return reply.status(400).send({ error: 'OTP does not match this campaign.' })
    if (Date.now() > stored.expires)       return reply.status(400).send({ error: 'OTP has expired. Please request a new one.' })
    if (stored.otp !== otp)                return reply.status(400).send({ error: 'Invalid OTP.' })

    otpStore.delete(phone)

    // Get tenant + user details
    const { rows: tenants } = await db.query(
      `SELECT id, slug, name, db_schema FROM public.tenants WHERE slug = $1`,
      [tenantSlug]
    )
    const tenant = tenants[0]
    const tdb = tenantDb(tenant.db_schema)
    const { rows: users } = await tdb.query(
      `SELECT id, name, role, assigned_ward_id, assigned_booth_id FROM users WHERE phone = $1`,
      [phone]
    )
    const user = users[0]

    // Update last_login
    await tdb.query(`UPDATE users SET last_login_at = now() WHERE id = $1`, [user.id])

    // Sign JWT with tenant context
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

    return reply.send({ token, user: { ...user, tenantName: tenant.name, tenantSlug: tenant.slug } })
  })

  // POST /auth/refresh — re-issue token
  app.post('/refresh', {
    preHandler: [async (req, rep) => { try { await req.jwtVerify() } catch { rep.status(401).send({ error: 'Invalid token' }) } }]
  }, async (request, reply) => {
    const payload = request.user as any
    const token = app.jwt.sign(payload, { expiresIn: process.env.JWT_EXPIRY || '7d' })
    return reply.send({ token })
  })
}