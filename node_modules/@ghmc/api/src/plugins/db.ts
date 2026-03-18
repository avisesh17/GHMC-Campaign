import { Pool, PoolClient } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
})

pool.on('error', (err) => {
  console.error('Unexpected PG pool error', err)
})

export const db = {
  query: (text: string, params?: any[]) => pool.query(text, params),
  getClient: () => pool.connect()
}

export const tenantDb = (schema: string) => ({
  query: async (text: string, params?: any[]) => {
    const client = await pool.connect()
    try {
      await client.query(`SET search_path TO ${schema}, public`)
      return await client.query(text, params)
    } finally {
      client.release()
    }
  },
  transaction: async (fn: (client: PoolClient) => Promise<any>) => {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`SET search_path TO ${schema}, public`)
      const result = await fn(client)
      await client.query('COMMIT')
      return result
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    } finally {
      client.release()
    }
  }
})

export default pool
