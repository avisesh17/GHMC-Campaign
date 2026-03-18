import { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { tenantDb } from '../plugins/db'
import { requireRole } from '../middleware/tenant'

const voterUpdateSchema = z.object({
  phone:         z.string().optional(),
  alt_phone:     z.string().optional(),
  house_number:  z.string().optional(),
  notes:         z.string().optional(),
  support_level: z.enum(['supporter','neutral','opposition','unknown']).optional(),
  has_voted:     z.boolean().optional()
})

export async function voterRoutes(app: FastifyInstance) {

  // GET /voters — list with filters
  app.get('/', async (request, reply) => {
    const q = request.query as any
    const tdb = tenantDb(request.schema)

    const conditions: string[] = []
    const params: any[] = []
    let pi = 1

    if (q.ward_id)       { conditions.push(`v.ward_id = $${pi++}`);         params.push(q.ward_id) }
    if (q.booth_id)      { conditions.push(`v.booth_id = $${pi++}`);        params.push(q.booth_id) }
    if (q.support)       { conditions.push(`v.support_level = $${pi++}`);   params.push(q.support) }
    if (q.contacted)     { conditions.push(`v.is_contacted = $${pi++}`);    params.push(q.contacted === 'true') }
    if (q.has_voted)     { conditions.push(`v.has_voted = $${pi++}`);       params.push(q.has_voted === 'true') }
    if (q.household_id)  { conditions.push(`v.household_id = $${pi++}`);    params.push(q.household_id) }
    if (q.q) {
      conditions.push(`(
        v.full_name ILIKE $${pi} OR
        v.voter_id  ILIKE $${pi} OR
        v.phone     ILIKE $${pi} OR
        v.address   ILIKE $${pi}
      )`)
      params.push(`%${q.q}%`); pi++
    }

    // Volunteers only see their assigned booth
    if (request.userRole === 'volunteer') {
      conditions.push(`v.booth_id = $${pi++}`)
      const payload = request.user as any
      params.push(payload.assigned_booth_id)
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''
    const limit  = Math.min(Number(q.limit)  || 50, 200)
    const offset = Number(q.offset) || 0

    const { rows } = await tdb.query(
      `SELECT v.*,
              h.house_number AS h_number, h.full_address,
              fu.portion_label, fu.family_name
       FROM   voters v
       LEFT JOIN households   h  ON h.id  = v.household_id
       LEFT JOIN family_units fu ON fu.id = v.family_unit_id
       ${where}
       ORDER BY v.full_name
       LIMIT $${pi} OFFSET $${pi+1}`,
      [...params, limit, offset]
    )

    const { rows: total } = await tdb.query(
      `SELECT COUNT(*) FROM voters v
       LEFT JOIN households   h  ON h.id  = v.household_id
       LEFT JOIN family_units fu ON fu.id = v.family_unit_id
       ${where}`,
      params
    )

    return reply.send({ voters: rows, total: Number(total[0].count), limit, offset })
  })

  // GET /voters/:id — single voter with history
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as any
    const tdb = tenantDb(request.schema)

    const { rows: voters } = await tdb.query(
      `SELECT v.*,
              h.house_number, h.full_address, h.lat, h.lng,
              fu.portion_label, fu.family_name, fu.door_label
       FROM   voters v
       LEFT JOIN households   h  ON h.id  = v.household_id
       LEFT JOIN family_units fu ON fu.id = v.family_unit_id
       WHERE  v.id = $1`, [id]
    )
    if (!voters.length) return reply.status(404).send({ error: 'Voter not found' })

    const { rows: history } = await tdb.query(
      `SELECT cl.*,
              u.name AS canvasser_name
       FROM   canvassing_logs cl
       JOIN   users u ON u.id = cl.canvasser_id
       WHERE  cl.voter_id = $1
       ORDER  BY cl.visited_at DESC
       LIMIT  20`, [id]
    )

    return reply.send({ voter: voters[0], history })
  })

  // POST /voters — create single voter (ward_admin+)
  app.post('/', {
    preHandler: requireRole('tenant_owner','ward_admin')
  }, async (request, reply) => {
    const body = request.body as any
    const tdb = tenantDb(request.schema)

    const { rows } = await tdb.query(
      `INSERT INTO voters (
         voter_id, full_name, father_name, age, gender,
         phone, alt_phone, house_number, address,
         household_id, family_unit_id, booth_id, ward_id,
         support_level, religion, caste_group, notes
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       RETURNING *`,
      [
        body.voter_id, body.full_name, body.father_name,
        body.age, body.gender, body.phone, body.alt_phone,
        body.house_number, body.address, body.household_id,
        body.family_unit_id, body.booth_id, body.ward_id,
        body.support_level || 'unknown',
        body.religion, body.caste_group, body.notes
      ]
    )
    return reply.status(201).send({ voter: rows[0] })
  })

  // PUT /voters/:id — update voter
  app.put('/:id', async (request, reply) => {
    const { id } = request.params as any
    const parse = voterUpdateSchema.safeParse(request.body)
    if (!parse.success) return reply.status(400).send({ error: parse.error.flatten() })

    const tdb = tenantDb(request.schema)
    const data = parse.data
    const fields: string[] = []
    const values: any[] = []
    let pi = 1

    Object.entries(data).forEach(([k, v]) => {
      if (v !== undefined) { fields.push(`${k} = $${pi++}`); values.push(v) }
    })
    if (!fields.length) return reply.status(400).send({ error: 'Nothing to update' })

    values.push(id)
    const { rows } = await tdb.query(
      `UPDATE voters SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $${pi} RETURNING *`,
      values
    )
    if (!rows.length) return reply.status(404).send({ error: 'Voter not found' })

    // Audit log
    await tdb.query(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_value)
       VALUES ($1,'voter.update','voter',$2,$3)`,
      [request.userId, id, JSON.stringify(data)]
    )

    return reply.send({ voter: rows[0] })
  })

  // GET /voters/:id/household — all voters at same household
  app.get('/:id/household', async (request, reply) => {
    const { id } = request.params as any
    const tdb = tenantDb(request.schema)

    const { rows: voter } = await tdb.query(
      `SELECT household_id FROM voters WHERE id = $1`, [id]
    )
    if (!voter.length || !voter[0].household_id) {
      return reply.send({ family_units: [] })
    }

    const { rows } = await tdb.query(
      `SELECT fu.*, json_agg(v ORDER BY v.full_name) AS voters
       FROM   family_units fu
       JOIN   voters v ON v.family_unit_id = fu.id
       WHERE  fu.household_id = $1
       GROUP  BY fu.id
       ORDER  BY fu.floor_number, fu.portion_label`,
      [voter[0].household_id]
    )
    return reply.send({ family_units: rows })
  })
}
