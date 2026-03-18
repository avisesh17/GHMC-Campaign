import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tenantDb } from '../plugins/db'

const logSchema = z.object({
  voter_id:       z.string().uuid().optional(),
  household_id:   z.string().uuid().optional(),
  campaign_id:    z.string().uuid(),
  scope:          z.enum(['voter','family','house']).default('voter'),
  visited_at:     z.string().datetime().optional(),
  outcome:        z.enum(['contacted','not_home','refused','not_found']),
  support_given:  z.enum(['supporter','neutral','opposition','unknown']).optional(),
  contact_method: z.enum(['door_to_door','phone','event']).default('door_to_door'),
  follow_up_date: z.string().optional(),
  notes:          z.string().optional(),
  lat:            z.number().optional(),
  lng:            z.number().optional(),
  issues:         z.array(z.object({
    category:    z.enum(['roads','water','drainage','parking','streetlights',
                         'parks','garbage','civic','admin','encroachment',
                         'transport','other']),
    description: z.string().optional(),
    severity:    z.enum(['high','medium','low']).default('medium')
  })).optional()
})

// Batch sync schema for offline logs
const batchSyncSchema = z.object({
  logs: z.array(logSchema.extend({
    local_id: z.string() // client-side UUID for idempotency
  }))
})

export async function canvassingRoutes(app: FastifyInstance) {

  // POST /canvassing/log — submit a single visit
  app.post('/log', async (request, reply) => {
    const parse = logSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })

    const data = parse.data
    if (!data.voter_id && !data.household_id) {
      return reply.status(400).send({ error: 'Either voter_id or household_id is required' })
    }

    const tdb = tenantDb(request.schema)

    return tdb.transaction(async (client) => {
      // Determine which voter IDs to update
      let voterIds: string[] = []

      if (data.scope === 'voter' && data.voter_id) {
        voterIds = [data.voter_id]
      } else if ((data.scope === 'family' || data.scope === 'house') && data.household_id) {
        const q = data.scope === 'family'
          ? `SELECT id FROM voters WHERE family_unit_id = (
               SELECT family_unit_id FROM voters WHERE id = $1 LIMIT 1)`
          : `SELECT id FROM voters WHERE household_id = $1`
        const arg = data.scope === 'family' ? data.voter_id || data.household_id : data.household_id
        const { rows } = await client.query(q, [arg])
        voterIds = rows.map((r: any) => r.id)
      }

      // Insert main log
      const { rows: logs } = await client.query(
        `INSERT INTO canvassing_logs (
           voter_id, household_id, canvasser_id, campaign_id,
           scope, visited_at, outcome, support_given,
           contact_method, follow_up_date, notes, lat, lng
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         RETURNING id`,
        [
          data.voter_id || null,
          data.household_id || null,
          request.userId,
          data.campaign_id,
          data.scope,
          data.visited_at || new Date().toISOString(),
          data.outcome,
          data.support_given || null,
          data.contact_method,
          data.follow_up_date || null,
          data.notes || null,
          data.lat || null,
          data.lng || null
        ]
      )
      const logId = logs[0].id

      // Update voters
      if (data.support_given && voterIds.length > 0) {
        await client.query(
          `UPDATE voters
           SET support_level     = $1,
               is_contacted      = true,
               last_contacted_at = now(),
               updated_at        = now()
           WHERE id = ANY($2::uuid[])`,
          [data.support_given, voterIds]
        )
      } else if (data.outcome !== 'contacted' && voterIds.length > 0) {
        // Still mark as contacted attempt even if not home
        await client.query(
          `UPDATE voters SET is_contacted = true, last_contacted_at = now()
           WHERE id = ANY($1::uuid[])`,
          [voterIds]
        )
      }

      // Insert ward issues
      if (data.issues?.length) {
        for (const issue of data.issues) {
          await client.query(
            `INSERT INTO ward_issues (
               canvassing_log_id, voter_id, household_id, ward_id,
               reported_by, category, description, severity, lat, lng
             ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [
              logId,
              data.voter_id || null,
              data.household_id || null,
              (request.user as any).assigned_ward_id,
              request.userId,
              issue.category,
              issue.description || null,
              issue.severity,
              data.lat || null,
              data.lng || null
            ]
          )
        }
      }

      return reply.status(201).send({
        log_id:        logId,
        voters_updated: voterIds.length,
        issues_logged:  (data.issues || []).length
      })
    })
  })

  // POST /canvassing/sync — batch sync offline logs
  app.post('/sync', async (request, reply) => {
    const parse = batchSyncSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })

    const results = []
    for (const log of parse.data.logs) {
      try {
        const { local_id, ...logData } = log
        // Re-use single log logic
        await (app as any).inject({
          method: 'POST',
          url: '/canvassing/log',
          headers: { authorization: request.headers.authorization },
          payload: logData
        })
        results.push({ local_id, status: 'synced' })
      } catch (err: any) {
        results.push({ local_id: log.local_id, status: 'error', message: err.message })
      }
    }

    return reply.send({ results, synced: results.filter(r => r.status === 'synced').length })
  })

  // GET /canvassing/logs — activity feed
  app.get('/logs', async (request, reply) => {
    const q = request.query as any
    const tdb = tenantDb(request.schema)

    const conditions = ['1=1']
    const params: any[] = []
    let pi = 1

    if (q.date) {
      conditions.push(`cl.visited_at::date = $${pi++}`)
      params.push(q.date)
    }
    if (q.canvasser_id) {
      conditions.push(`cl.canvasser_id = $${pi++}`)
      params.push(q.canvasser_id)
    }
    // Volunteers only see their own logs
    if (request.userRole === 'volunteer') {
      conditions.push(`cl.canvasser_id = $${pi++}`)
      params.push(request.userId)
    }

    const { rows } = await tdb.query(
      `SELECT cl.*,
              v.full_name, v.voter_id,
              u.name AS canvasser_name,
              h.house_number, h.full_address
       FROM   canvassing_logs cl
       LEFT JOIN voters     v ON v.id = cl.voter_id
       JOIN  users          u ON u.id = cl.canvasser_id
       LEFT JOIN households h ON h.id = cl.household_id
       WHERE  ${conditions.join(' AND ')}
       ORDER  BY cl.visited_at DESC
       LIMIT  100`,
      params
    )

    return reply.send({ logs: rows })
  })

  // GET /canvassing/summary — coverage stats
  app.get('/summary', async (request, reply) => {
    const q = request.query as any
    const tdb = tenantDb(request.schema)

    const wardFilter = q.ward_id ? `AND ward_id = '${q.ward_id}'` : ''
    const boothFilter = q.booth_id ? `AND booth_id = '${q.booth_id}'` : ''

    const { rows } = await tdb.query(`
      SELECT
        COUNT(*)                                               AS total,
        COUNT(*) FILTER (WHERE is_contacted)                  AS contacted,
        COUNT(*) FILTER (WHERE support_level = 'supporter')   AS supporters,
        COUNT(*) FILTER (WHERE support_level = 'neutral')     AS neutral,
        COUNT(*) FILTER (WHERE support_level = 'opposition')  AS opposition,
        COUNT(*) FILTER (WHERE support_level = 'unknown')     AS unknown,
        COUNT(*) FILTER (WHERE has_voted)                     AS voted
      FROM voters WHERE 1=1 ${wardFilter} ${boothFilter}
    `)

    return reply.send({ summary: rows[0] })
  })

  // GET /canvassing/my-stats — volunteer personal stats
  app.get('/my-stats', async (request, reply) => {
    const tdb = tenantDb(request.schema)

    const { rows } = await tdb.query(
      `SELECT
         COUNT(*)                                            AS total_visits,
         COUNT(*) FILTER (WHERE visited_at::date = CURRENT_DATE) AS today_visits,
         COUNT(*) FILTER (WHERE support_given = 'supporter') AS supporters_found,
         COUNT(*) FILTER (WHERE outcome = 'not_home')        AS not_home
       FROM canvassing_logs
       WHERE canvasser_id = $1`,
      [request.userId]
    )

    return reply.send({ stats: rows[0] })
  })
}
