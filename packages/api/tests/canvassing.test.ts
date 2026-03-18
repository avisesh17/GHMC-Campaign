import { getTestApp, closeTestApp, makeToken, wardAdminToken } from './setup'
import { FastifyInstance } from 'fastify'

describe('Voter Routes', () => {
  let app: FastifyInstance
  let volToken: string
  let adminToken: string

  beforeAll(async () => {
    app        = await getTestApp()
    volToken   = makeToken(app)
    adminToken = wardAdminToken(app)
  })
  afterAll(async () => { await closeTestApp(app) })

  describe('GET /api/voters', () => {

    it('returns voter list for authenticated user', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body.voters)).toBe(true)
      expect(body.total).toBeGreaterThan(0)
    })

    it('volunteer only sees their booth voters', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { voters } = JSON.parse(res.body)
      voters.forEach((v: any) => {
        expect(v.booth_id).toBe('33333333-0000-0000-0000-000000000001')
      })
    })

    it('filters by support_level', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters?support=supporter',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { voters } = JSON.parse(res.body)
      voters.forEach((v: any) => {
        expect(v.support_level).toBe('supporter')
      })
    })

    it('filters by is_contacted=true', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters?contacted=true',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { voters } = JSON.parse(res.body)
      voters.forEach((v: any) => {
        expect(v.is_contacted).toBe(true)
      })
    })

    it('searches by name', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters?q=Laxmi',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { voters } = JSON.parse(res.body)
      expect(voters.length).toBeGreaterThan(0)
      expect(voters[0].full_name).toMatch(/Laxmi/i)
    })

    it('searches by voter_id', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters?q=APM0042381',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { voters } = JSON.parse(res.body)
      expect(voters.length).toBe(1)
      expect(voters[0].voter_id).toBe('APM0042381')
    })

    it('paginates correctly', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/voters?limit=5&offset=0',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.voters.length).toBeLessThanOrEqual(5)
    })
  })

  describe('GET /api/voters/:id', () => {

    it('returns voter detail with history', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/voters/dddddddd-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.voter.full_name).toBe('Laxmi Devi Krishnamurthy')
      expect(Array.isArray(body.history)).toBe(true)
    })

    it('returns 404 for non-existent voter', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/voters/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('PUT /api/voters/:id', () => {

    it('volunteer can update phone and notes', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/voters/dddddddd-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${volToken}` },
        payload: { phone: '9876543299', notes: 'Updated note' }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(body.voter.phone).toBe('9876543299')
    })

    it('rejects invalid support_level', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/voters/dddddddd-0000-0000-0000-000000000001',
        headers: { authorization: `Bearer ${volToken}` },
        payload: { support_level: 'maybe' }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 404 for unknown voter', async () => {
      const res = await app.inject({
        method: 'PUT',
        url: '/api/voters/00000000-0000-0000-0000-000000000000',
        headers: { authorization: `Bearer ${volToken}` },
        payload: { notes: 'test' }
      })
      expect(res.statusCode).toBe(404)
    })
  })

  describe('GET /api/voters/:id/household', () => {

    it('returns household with family units', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/voters/dddddddd-0000-0000-0000-000000000001/household',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const body = JSON.parse(res.body)
      expect(Array.isArray(body.family_units)).toBe(true)
    })
  })
})

describe('Canvassing Routes', () => {
  let app: FastifyInstance
  let volToken: string
  let adminToken: string

  beforeAll(async () => {
    app        = await getTestApp()
    volToken   = makeToken(app)
    adminToken = wardAdminToken(app)
  })
  afterAll(async () => { await closeTestApp(app) })

  describe('POST /api/canvassing/log', () => {

    it('logs a voter visit successfully', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          voter_id:      'dddddddd-0000-0000-0000-000000000003',
          campaign_id:   'eeeeeeee-0000-0000-0000-000000000001',
          scope:         'voter',
          outcome:       'contacted',
          support_given: 'supporter',
          notes:         'QA test visit',
          lat:            17.44138, lng: 78.49841
        }
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.log_id).toBeDefined()
      expect(body.voters_updated).toBe(1)
    })

    it('updates voter support_level after logging', async () => {
      await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          voter_id:      'dddddddd-0000-0000-0000-000000000006',
          campaign_id:   'eeeeeeee-0000-0000-0000-000000000001',
          outcome:       'contacted',
          support_given: 'neutral',
        }
      })
      const voterRes = await app.inject({
        method: 'GET',
        url: '/api/voters/dddddddd-0000-0000-0000-000000000006',
        headers: { authorization: `Bearer ${volToken}` }
      })
      const { voter } = JSON.parse(voterRes.body)
      expect(voter.support_level).toBe('neutral')
      expect(voter.is_contacted).toBe(true)
    })

    it('logs not_home without support_given', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          voter_id:    'dddddddd-0000-0000-0000-000000000007',
          campaign_id: 'eeeeeeee-0000-0000-0000-000000000001',
          outcome:     'not_home',
          notes:       'Will try again evening'
        }
      })
      expect(res.statusCode).toBe(201)
    })

    it('logs civic issues alongside visit', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          voter_id:      'dddddddd-0000-0000-0000-000000000008',
          campaign_id:   'eeeeeeee-0000-0000-0000-000000000001',
          outcome:       'contacted',
          support_given: 'unknown',
          issues: [
            { category: 'water', description: 'No water for 2 days', severity: 'high' },
            { category: 'roads', severity: 'medium' }
          ],
          lat: 17.44138, lng: 78.49841
        }
      })
      expect(res.statusCode).toBe(201)
      const body = JSON.parse(res.body)
      expect(body.issues_logged).toBe(2)
    })

    it('updates all voters in household on scope=house', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          household_id:  'bbbbbbbb-0000-0000-0000-000000000002',
          campaign_id:   'eeeeeeee-0000-0000-0000-000000000001',
          scope:         'house',
          outcome:       'contacted',
          support_given: 'supporter'
        }
      })
      expect(res.statusCode).toBe(201)
      const { voters_updated } = JSON.parse(res.body)
      expect(voters_updated).toBeGreaterThan(0)
    })

    it('returns 400 when neither voter_id nor household_id provided', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          campaign_id: 'eeeeeeee-0000-0000-0000-000000000001',
          outcome:     'contacted'
        }
      })
      expect(res.statusCode).toBe(400)
    })

    it('returns 400 for invalid outcome value', async () => {
      const res = await app.inject({
        method: 'POST', url: '/api/canvassing/log',
        headers: { authorization: `Bearer ${volToken}` },
        payload: {
          voter_id:    'dddddddd-0000-0000-0000-000000000001',
          campaign_id: 'eeeeeeee-0000-0000-0000-000000000001',
          outcome:     'maybe_contacted'
        }
      })
      expect(res.statusCode).toBe(400)
    })
  })

  describe('GET /api/canvassing/logs', () => {

    it('volunteer only sees their own logs', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/canvassing/logs',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { logs } = JSON.parse(res.body)
      logs.forEach((l: any) => {
        expect(l.canvasser_id).toBe('aaaaaaaa-0000-0000-0000-000000000003')
      })
    })

    it('ward admin sees all logs', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/canvassing/logs',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { logs } = JSON.parse(res.body)
      expect(logs.length).toBeGreaterThan(0)
    })
  })

  describe('GET /api/canvassing/summary', () => {

    it('returns ward coverage stats', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/canvassing/summary',
        headers: { authorization: `Bearer ${adminToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { summary } = JSON.parse(res.body)
      expect(Number(summary.total)).toBeGreaterThan(0)
      expect(summary).toHaveProperty('supporters')
      expect(summary).toHaveProperty('contacted')
    })
  })

  describe('GET /api/canvassing/my-stats', () => {

    it('returns personal stats for volunteer', async () => {
      const res = await app.inject({
        method: 'GET', url: '/api/canvassing/my-stats',
        headers: { authorization: `Bearer ${volToken}` }
      })
      expect(res.statusCode).toBe(200)
      const { stats } = JSON.parse(res.body)
      expect(stats).toHaveProperty('total_visits')
      expect(stats).toHaveProperty('today_visits')
    })
  })
})
