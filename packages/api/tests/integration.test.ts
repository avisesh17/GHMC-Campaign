import { getTestApp, closeTestApp, makeToken, wardAdminToken, ownerToken } from './setup'
import { FastifyInstance } from 'fastify'

describe('RBAC — Role-based access control', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('volunteer cannot create a voter (403)', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'POST', url: '/api/voters',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        voter_id: 'RBAC001', full_name: 'Test Voter',
        age: 30, gender: 'M',
        booth_id: '33333333-0000-0000-0000-000000000001',
        ward_id:  '22222222-0000-0000-0000-000000000001'
      }
    })
    expect(res.statusCode).toBe(403)
  })

  it('ward admin can create a voter (201)', async () => {
    const token = wardAdminToken(app)
    const uniqueId = `RBAC_WA_${Date.now()}`
    const res = await app.inject({
      method: 'POST', url: '/api/voters',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        voter_id: uniqueId, full_name: 'Ward Admin Test Voter',
        age: 25, gender: 'F',
        booth_id: '33333333-0000-0000-0000-000000000001',
        ward_id:  '22222222-0000-0000-0000-000000000001'
      }
    })
    expect(res.statusCode).toBe(201)
  })

  it('viewer cannot create events (403)', async () => {
    const viewerToken = makeToken(app, {
      user_id: 'aaaaaaaa-0000-0000-0000-000000000007',
      role: 'viewer'
    })
    const res = await app.inject({
      method: 'POST', url: '/api/events',
      headers: { authorization: `Bearer ${viewerToken}` },
      payload: {
        title: 'Test Event', event_type: 'rally',
        campaign_id: 'eeeeeeee-0000-0000-0000-000000000001'
      }
    })
    expect(res.statusCode).toBe(403)
  })

  it('platform route blocked without correct key (403)', async () => {
    const res = await app.inject({
      method: 'GET', url: '/platform/tenants',
      headers: { 'x-platform-key': 'wrong-key' }
    })
    expect(res.statusCode).toBe(403)
  })
})

describe('Booth Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('returns booth list for ward', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/booths',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { booths } = JSON.parse(res.body)
    expect(booths.length).toBeGreaterThan(0)
  })

  it('returns voters in a booth', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/booths/33333333-0000-0000-0000-000000000001/voters',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { voters } = JSON.parse(res.body)
    expect(voters.length).toBeGreaterThan(0)
  })

  it('returns households for a booth', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/booths/33333333-0000-0000-0000-000000000001/households',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { households } = JSON.parse(res.body)
    expect(households.length).toBeGreaterThan(0)
    households.forEach((h: any) => {
      expect(h.house_number).toBeDefined()
    })
  })

  it('filters households by not visited today', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/booths/33333333-0000-0000-0000-000000000001/households?visited=false',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('Campaign & Event Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('returns campaign list', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/campaigns',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { campaigns } = JSON.parse(res.body)
    expect(campaigns.length).toBeGreaterThan(0)
    expect(campaigns[0].name).toContain('Ward 42')
  })

  it('returns campaign summary with stats', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET',
      url: '/api/campaigns/eeeeeeee-0000-0000-0000-000000000001/summary',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.stats).toHaveProperty('voters_reached')
  })

  it('returns events list', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/events',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { events } = JSON.parse(res.body)
    expect(events.length).toBeGreaterThan(0)
  })

  it('returns today events endpoint', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/events/today',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
  })

  it('ward admin can create an event', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'POST', url: '/api/events',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        campaign_id:    'eeeeeeee-0000-0000-0000-000000000001',
        title:          'Integration test booth meeting',
        event_type:     'booth_meeting',
        scheduled_at:   '2026-03-20T18:00:00+05:30',
        venue:          'Test Community Hall',
        ward_id:        '22222222-0000-0000-0000-000000000001',
        expected_count: 50
      }
    })
    expect(res.statusCode).toBe(201)
    const { event } = JSON.parse(res.body)
    expect(event.title).toBe('Integration test booth meeting')
  })
})

describe('Task Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('volunteer sees only their own tasks', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/tasks',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { tasks } = JSON.parse(res.body)
    tasks.forEach((t: any) => {
      expect(t.assigned_to).toBe('aaaaaaaa-0000-0000-0000-000000000003')
    })
  })

  it('volunteer can mark a task as done', async () => {
    const token = makeToken(app)
    const listRes = await app.inject({
      method: 'GET', url: '/api/tasks',
      headers: { authorization: `Bearer ${token}` }
    })
    const { tasks } = JSON.parse(listRes.body)
    if (tasks.length === 0) {
      console.log('  (skipped — no tasks assigned to this volunteer)')
      return
    }
    const res = await app.inject({
      method: 'PATCH', url: `/api/tasks/${tasks[0].id}/status`,
      headers: { authorization: `Bearer ${token}` },
      payload: { status: 'done' }
    })
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).task.status).toBe('done')
  })
})

describe('Report Routes', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('returns booth coverage breakdown', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/reports/coverage',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { coverage } = JSON.parse(res.body)
    expect(coverage.length).toBeGreaterThan(0)
    expect(coverage[0]).toHaveProperty('coverage_pct')
  })

  it('returns support breakdown', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/reports/support-breakdown',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { breakdown } = JSON.parse(res.body)
    expect(breakdown.length).toBeGreaterThan(0)
  })

  it('returns volunteer activity', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/reports/volunteer-activity',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { volunteers } = JSON.parse(res.body)
    expect(volunteers.length).toBeGreaterThan(0)
  })

  it('returns ward issues list', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/reports/issues',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
    const { issues } = JSON.parse(res.body)
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]).toHaveProperty('category')
    expect(issues[0]).toHaveProperty('severity')
  })

  it('returns daily progress', async () => {
    const token = wardAdminToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/reports/daily-progress',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(200)
  })
})

describe('Health Check', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('returns 200 with ok status', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.status).toBe('ok')
    expect(body.timestamp).toBeDefined()
  })
})

describe('Edge Cases & Error Handling', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await getTestApp() })
  afterAll(async () => { await closeTestApp(app) })

  it('returns 404 for unknown route', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'GET', url: '/api/nonexistent-endpoint',
      headers: { authorization: `Bearer ${token}` }
    })
    expect(res.statusCode).toBe(404)
  })

  it('handles duplicate voter_id gracefully (409)', async () => {
    const token = wardAdminToken(app)
    const uniqueId = `DUP_TEST_${Date.now()}`
    const payload = {
      voter_id: uniqueId, full_name: 'Dup Test Voter',
      age: 30, gender: 'M',
      booth_id: '33333333-0000-0000-0000-000000000001',
      ward_id:  '22222222-0000-0000-0000-000000000001'
    }
    // First insert — should succeed
    await app.inject({
      method: 'POST', url: '/api/voters',
      headers: { authorization: `Bearer ${token}` },
      payload
    })
    // Second insert with same voter_id — should return 409
    const res = await app.inject({
      method: 'POST', url: '/api/voters',
      headers: { authorization: `Bearer ${token}` },
      payload
    })
    expect(res.statusCode).toBe(409)
  })

  it('canvassing log with only required fields succeeds', async () => {
    const token = makeToken(app)
    const res = await app.inject({
      method: 'POST', url: '/api/canvassing/log',
      headers: { authorization: `Bearer ${token}` },
      payload: {
        voter_id:    'dddddddd-0000-0000-0000-000000000030',
        campaign_id: 'eeeeeeee-0000-0000-0000-000000000001',
        outcome:     'not_home'
      }
    })
    expect(res.statusCode).toBe(201)
  })
})
