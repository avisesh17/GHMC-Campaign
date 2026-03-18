import axios, { AxiosInstance, AxiosError } from 'axios'
import * as SecureStore from 'expo-secure-store'
import * as SQLite from 'expo-sqlite'

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001'

// ─── SQLite offline queue ─────────────────────────────────────
const db = SQLite.openDatabaseSync('ghmc_offline.db')

db.execSync(`
  CREATE TABLE IF NOT EXISTS offline_queue (
    id          TEXT PRIMARY KEY,
    endpoint    TEXT NOT NULL,
    method      TEXT NOT NULL,
    payload     TEXT NOT NULL,
    created_at  INTEGER NOT NULL,
    attempts    INTEGER DEFAULT 0,
    synced      INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS voter_cache (
    id          TEXT PRIMARY KEY,
    data        TEXT NOT NULL,
    booth_id    TEXT,
    cached_at   INTEGER NOT NULL
  );
`)

// ─── Axios instance ───────────────────────────────────────────
const createApiClient = (token: string | null): AxiosInstance => {
  const client = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    }
  })

  client.interceptors.response.use(
    res => res,
    async (error: AxiosError) => {
      if (error.response?.status === 401) {
        await SecureStore.deleteItemAsync('ghmc_token')
      }
      return Promise.reject(error)
    }
  )

  return client
}

// ─── Token management ─────────────────────────────────────────
export const tokenStore = {
  get:    ()           => SecureStore.getItemAsync('ghmc_token'),
  set:    (t: string)  => SecureStore.setItemAsync('ghmc_token', t),
  clear:  ()           => SecureStore.deleteItemAsync('ghmc_token'),
}

// ─── API methods ──────────────────────────────────────────────
export const api = {

  // Auth
  requestOtp: async (phone: string, tenantSlug: string) => {
    const client = createApiClient(null)
    const { data } = await client.post('/auth/request-otp', { phone, tenantSlug })
    return data
  },

  verifyOtp: async (phone: string, otp: string, tenantSlug: string) => {
    const client = createApiClient(null)
    const { data } = await client.post('/auth/verify-otp', { phone, otp, tenantSlug })
    if (data.token) await tokenStore.set(data.token)
    return data
  },

  logout: async () => {
    await tokenStore.clear()
    clearVoterCache()
  },

  // Voters
  getVoters: async (params: Record<string, any> = {}) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/voters', { params })
    return data
  },

  getVoter: async (id: string) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get(`/api/voters/${id}`)
    return data
  },

  getVoterHousehold: async (id: string) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get(`/api/voters/${id}/household`)
    return data
  },

  updateVoter: async (id: string, payload: any) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.put(`/api/voters/${id}`, payload)
    return data
  },

  // Households / Booths
  getHouseholds: async (boothId: string, visited?: boolean) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const params: any = {}
    if (visited !== undefined) params.visited = visited
    const { data } = await client.get(`/api/booths/${boothId}/households`, { params })
    // Cache for offline
    cacheVoters(boothId, data.households)
    return data
  },

  // Canvassing
  logVisit: async (payload: any) => {
    const token = await tokenStore.get()
    try {
      const client = createApiClient(token)
      const { data } = await client.post('/api/canvassing/log', payload)
      return { ...data, offline: false }
    } catch (err: any) {
      if (!err.response) {
        // Network error — queue offline
        const localId = `offline_${Date.now()}_${Math.random().toString(36).slice(2)}`
        queueOffline(localId, '/api/canvassing/log', 'POST', payload)
        return { log_id: localId, voters_updated: 0, offline: true }
      }
      throw err
    }
  },

  syncOfflineLogs: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const pending = db.getAllSync(
      `SELECT * FROM offline_queue WHERE synced=0 ORDER BY created_at`
    ) as any[]

    const results = []
    for (const item of pending) {
      try {
        await client.post(item.endpoint, JSON.parse(item.payload))
        db.runSync(`UPDATE offline_queue SET synced=1 WHERE id=?`, [item.id])
        results.push({ id: item.id, status: 'synced' })
      } catch {
        db.runSync(`UPDATE offline_queue SET attempts=attempts+1 WHERE id=?`, [item.id])
        results.push({ id: item.id, status: 'failed' })
      }
    }
    return { results, synced: results.filter(r => r.status === 'synced').length }
  },

  getPendingCount: (): number => {
    const row = db.getFirstSync(
      `SELECT COUNT(*) as count FROM offline_queue WHERE synced=0`
    ) as any
    return row?.count ?? 0
  },

  getCanvassingLogs: async (params?: any) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/canvassing/logs', { params })
    return data
  },

  getMyStats: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/canvassing/my-stats')
    return data
  },

  getSummary: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/canvassing/summary')
    return data
  },

  // Tasks
  getTasks: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/tasks')
    return data
  },

  updateTaskStatus: async (id: string, status: string) => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.patch(`/api/tasks/${id}/status`, { status })
    return data
  },

  // Events
  getEvents: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/events')
    return data
  },

  getTodayEvents: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/events/today')
    return data
  },

  // Reports
  getCoverage: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/reports/coverage')
    return data
  },

  getIssues: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/reports/issues')
    return data
  },

  // Ward admin
  getVolunteerActivity: async () => {
    const token = await tokenStore.get()
    const client = createApiClient(token)
    const { data } = await client.get('/api/reports/volunteer-activity')
    return data
  },
}

// ─── Offline helpers ──────────────────────────────────────────
function queueOffline(id: string, endpoint: string, method: string, payload: any) {
  db.runSync(
    `INSERT INTO offline_queue (id, endpoint, method, payload, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [id, endpoint, method, JSON.stringify(payload), Date.now()]
  )
}

function cacheVoters(boothId: string, households: any[]) {
  db.runSync(`DELETE FROM voter_cache WHERE booth_id=?`, [boothId])
  for (const h of households) {
    db.runSync(
      `INSERT OR REPLACE INTO voter_cache (id, data, booth_id, cached_at) VALUES (?,?,?,?)`,
      [h.id, JSON.stringify(h), boothId, Date.now()]
    )
  }
}

function clearVoterCache() {
  db.runSync(`DELETE FROM voter_cache`)
  db.runSync(`DELETE FROM offline_queue WHERE synced=1`)
}

export function getCachedHouseholds(boothId: string): any[] {
  const rows = db.getAllSync(
    `SELECT data FROM voter_cache WHERE booth_id=? ORDER BY cached_at DESC`,
    [boothId]
  ) as any[]
  return rows.map(r => JSON.parse(r.data))
}
