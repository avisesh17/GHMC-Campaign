import { getTestApp, closeTestApp, makeToken } from './setup'
import { FastifyInstance } from 'fastify'

describe('Auth Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  describe('POST /auth/request-otp', () => {

    it('returns 400 if phone is missing', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 if tenantSlug is missing', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455' }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown tenant slug', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455', tenantSlug: 'nonexistent-slug-xyz' }
      })
      expect(res.statusCode).toBe(404)
      expect(JSON.parse(res.body).error).toMatch(/not found/i)
    })

    it('returns 404 for unregistered phone number', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9999999999', tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(404)
    })

    it('succeeds for valid phone + tenant, returns devOtp in dev mode', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455', tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.message).toBe('OTP sent')
      expect(body.devOtp).toMatch(/^\d{6}$/)
    })
  })

  describe('POST /auth/verify-otp', () => {

    it('returns 400 when no OTP was requested', async () => {
      const res = await app.inject({
        method: 'POST', url: '/auth/verify-otp',
        payload: { phone: '9800000000', otp: '123456', tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toBeDefined()
    })

    it('returns 400 for wrong OTP', async () => {
      await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455', tenantSlug: 'bjp-ward42' }
      })
      const res = await app.inject({
        method: 'POST', url: '/auth/verify-otp',
        payload: { phone: '9922334455', otp: '000000', tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(400)
      expect(JSON.parse(res.body).error).toBeDefined()
    })

    it('returns JWT token on correct OTP', async () => {
      const otpRes = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455', tenantSlug: 'bjp-ward42' }
      })
      expect(otpRes.statusCode).toBe(200)
      const { devOtp } = JSON.parse(otpRes.body)

      const res = await app.inject({
        method: 'POST', url: '/auth/verify-otp',
        payload: { phone: '9922334455', otp: devOtp, tenantSlug: 'bjp-ward42' }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.token).toBeDefined()
      expect(body.user.role).toBe('volunteer')
      expect(body.user.tenantSlug).toBe('bjp-ward42')
    })

    it('token contains correct schema in JWT payload', async () => {
      const otpRes = await app.inject({
        method: 'POST', url: '/auth/request-otp',
        payload: { phone: '9922334455', tenantSlug: 'bjp-ward42' }
      })
      const { devOtp } = JSON.parse(otpRes.body)
      const verifyRes = await app.inject({
        method: 'POST', url: '/auth/verify-otp',
        payload: { phone: '9922334455', otp: devOtp, tenantSlug: 'bjp-ward42' }
      })
      const { token } = JSON.parse(verifyRes.body)
      expect(token).toBeDefined()
      const decoded = app.jwt.decode(token) as any
      expect(decoded.schema).toBe('tenant_bjp_ward42')
      expect(decoded.role).toBe('volunteer')
    })
  })

  describe('JWT guard on protected routes', () => {

    it('returns 401 when no token provided', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/voters' })
      expect(res.statusCode).toBe(401)
    })

    it('returns 401 for malformed token', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters',
        headers: { authorization: 'Bearer invalid.token.here' }
      })
      expect(res.statusCode).toBe(401)
    })

    it('returns 200 with valid token', async () => {
      const token = makeToken(app)
      const res = await app.inject({
        method: 'GET', url: '/api/voters',
        headers: { authorization: `Bearer ${token}` }
      })
      expect(res.statusCode).toBe(200)
    })
  })
})
