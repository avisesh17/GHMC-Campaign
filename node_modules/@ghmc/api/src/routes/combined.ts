// ─── reports.ts ───────────────────────────────────────────────
import { FastifyInstance } from 'fastify'
import { tenantDb, db } from '../plugins/db'
import { requireRole } from '../middleware/tenant'

export async function reportRoutes(app: FastifyInstance) {

  app.get('/coverage', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(`
      SELECT
        b.booth_number, b.booth_name,
        COUNT(v.id)                                           AS total,
        COUNT(v.id) FILTER (WHERE v.is_contacted)             AS contacted,
        COUNT(v.id) FILTER (WHERE v.support_level='supporter') AS supporters,
        COUNT(v.id) FILTER (WHERE v.support_level='neutral')   AS neutral,
        COUNT(v.id) FILTER (WHERE v.support_level='opposition') AS opposition,
        ROUND(COUNT(v.id) FILTER (WHERE v.is_contacted) * 100.0
              / NULLIF(COUNT(v.id),0), 1)                    AS coverage_pct
      FROM public.booths b
      LEFT JOIN voters v ON v.booth_id = b.id
      WHERE b.ward_id = $1
      GROUP BY b.id, b.booth_number, b.booth_name
      ORDER BY b.booth_number`,
      [(request.user as any).assigned_ward_id]
    )
    return reply.send({ coverage: rows })
  })

  app.get('/support-breakdown', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(`
      SELECT support_level, COUNT(*) AS count
      FROM voters GROUP BY support_level ORDER BY count DESC
    `)
    return reply.send({ breakdown: rows })
  })

  app.get('/volunteer-activity', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const q = request.query as any
    const dateFilter = q.date ? `AND cl.visited_at::date = '${q.date}'` : ''

    const { rows } = await tdb.query(`
      SELECT u.id, u.name, u.assigned_booth_id,
        COUNT(cl.id)                                            AS total_visits,
        COUNT(cl.id) FILTER (WHERE cl.support_given='supporter') AS supporters,
        COUNT(cl.id) FILTER (WHERE cl.outcome='not_home')        AS not_home,
        MAX(cl.visited_at)                                       AS last_activity
      FROM users u
      LEFT JOIN canvassing_logs cl ON cl.canvasser_id = u.id ${dateFilter}
      WHERE u.role = 'volunteer' AND u.is_active = true
      GROUP BY u.id, u.name, u.assigned_booth_id
      ORDER BY total_visits DESC
    `)
    return reply.send({ volunteers: rows })
  })

  app.get('/issues', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(`
      SELECT wi.*, u.name AS reporter_name, v.full_name AS voter_name
      FROM ward_issues wi
      LEFT JOIN users u ON u.id = wi.reported_by
      LEFT JOIN voters v ON v.id = wi.voter_id
      ORDER BY
        CASE wi.severity WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
        wi.reported_at DESC
    `)
    return reply.send({ issues: rows })
  })

  app.get('/daily-progress', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(`
      SELECT
        visited_at::date AS date,
        COUNT(*)         AS visits,
        COUNT(*) FILTER (WHERE support_given = 'supporter') AS supporters
      FROM canvassing_logs
      WHERE visited_at >= now() - INTERVAL '30 days'
      GROUP BY visited_at::date
      ORDER BY date
    `)
    return reply.send({ progress: rows })
  })
}

// ─── booths.ts ────────────────────────────────────────────────
export async function boothRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const q = request.query as any
    const tdb = tenantDb(request.schema)
    const wardId = q.ward_id || (request.user as any).assigned_ward_id

    const { rows } = await tdb.query(`
      SELECT b.*, bst.contacted, bst.supporters, bst.total AS voter_total,
        ROUND(bst.contacted * 100.0 / NULLIF(bst.total,0),1) AS coverage_pct
      FROM public.booths b
      LEFT JOIN LATERAL (
        SELECT COUNT(*)                                           AS total,
               COUNT(*) FILTER (WHERE is_contacted)              AS contacted,
               COUNT(*) FILTER (WHERE support_level='supporter') AS supporters
        FROM voters WHERE booth_id = b.id
      ) bst ON true
      WHERE b.ward_id = $1
      ORDER BY b.booth_number`, [wardId]
    )
    return reply.send({ booths: rows })
  })

  app.get('/:id/voters', async (request, reply) => {
    const { id } = request.params as any
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `SELECT * FROM voters WHERE booth_id = $1 ORDER BY full_name`, [id]
    )
    return reply.send({ voters: rows })
  })

  app.get('/:id/households', async (request, reply) => {
    const { id } = request.params as any
    const q = request.query as any
    const tdb = tenantDb(request.schema)

    const conditions = [`h.booth_id = $1`]
    const params: any[] = [id]

    if (q.visited === 'false') {
      conditions.push(`NOT EXISTS (
        SELECT 1 FROM canvassing_logs cl
        WHERE cl.household_id = h.id
        AND cl.visited_at::date = CURRENT_DATE
      )`)
    }

    const { rows } = await tdb.query(`
      SELECT h.*,
        json_agg(
          json_build_object(
            'id', fu.id, 'portion_label', fu.portion_label,
            'family_name', fu.family_name, 'door_label', fu.door_label,
            'voter_count', fu.voter_count
          ) ORDER BY fu.floor_number
        ) FILTER (WHERE fu.id IS NOT NULL) AS family_units,
        (SELECT json_agg(
           json_build_object(
             'id', v.id, 'full_name', v.full_name,
             'voter_id', v.voter_id, 'support_level', v.support_level,
             'age', v.age, 'gender', v.gender, 'is_contacted', v.is_contacted
           ) ORDER BY v.full_name
         ) FROM voters v WHERE v.household_id = h.id
        ) AS voters
      FROM households h
      LEFT JOIN family_units fu ON fu.household_id = h.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY h.id
      ORDER BY h.house_number`, params
    )
    return reply.send({ households: rows })
  })
}

// ─── campaigns.ts ─────────────────────────────────────────────
export async function campaignRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `SELECT * FROM campaigns ORDER BY created_at DESC`
    )
    return reply.send({ campaigns: rows })
  })

  app.post('/', {
    preHandler: requireRole('tenant_owner','ward_admin')
  }, async (request, reply) => {
    const b = request.body as any
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `INSERT INTO campaigns (name,description,start_date,end_date,status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [b.name, b.description, b.start_date, b.end_date, b.status||'draft', request.userId]
    )
    return reply.status(201).send({ campaign: rows[0] })
  })

  app.get('/:id/summary', async (request, reply) => {
    const { id } = request.params as any
    const tdb = tenantDb(request.schema)
    const { rows: camp } = await tdb.query(`SELECT * FROM campaigns WHERE id=$1`,[id])
    if (!camp.length) return reply.status(404).send({ error: 'Campaign not found' })

    const { rows: stats } = await tdb.query(`
      SELECT
        COUNT(DISTINCT cl.voter_id) AS voters_reached,
        COUNT(cl.id)                AS total_visits,
        COUNT(e.id)                 AS total_events
      FROM campaigns c
      LEFT JOIN canvassing_logs cl ON cl.campaign_id = c.id
      LEFT JOIN events e ON e.campaign_id = c.id
      WHERE c.id = $1`, [id]
    )
    return reply.send({ campaign: camp[0], stats: stats[0] })
  })
}

// ─── events.ts ────────────────────────────────────────────────
export async function eventRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `SELECT e.*, u.name AS created_by_name
       FROM events e LEFT JOIN users u ON u.id = e.created_by
       ORDER BY e.scheduled_at`
    )
    return reply.send({ events: rows })
  })

  app.get('/today', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `SELECT * FROM events WHERE scheduled_at::date = CURRENT_DATE ORDER BY scheduled_at`
    )
    return reply.send({ events: rows })
  })

  app.post('/', {
    preHandler: requireRole('tenant_owner','ward_admin')
  }, async (request, reply) => {
    const b = request.body as any
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `INSERT INTO events (campaign_id,title,event_type,scheduled_at,venue,lat,lng,ward_id,expected_count,notes,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [b.campaign_id,b.title,b.event_type,b.scheduled_at,b.venue,b.lat,b.lng,
       b.ward_id,b.expected_count||0,b.notes,request.userId]
    )
    return reply.status(201).send({ event: rows[0] })
  })
}

// ─── tasks.ts ─────────────────────────────────────────────────
export async function taskRoutes(app: FastifyInstance) {
  app.get('/', async (request, reply) => {
    const tdb = tenantDb(request.schema)
    const q = request.query as any
    let filter = ''
    const params: any[] = []

    if (request.userRole === 'volunteer') {
      filter = 'WHERE t.assigned_to = $1'; params.push(request.userId)
    } else if (q.assigned_to) {
      filter = 'WHERE t.assigned_to = $1'; params.push(q.assigned_to)
    }

    const { rows } = await tdb.query(
      `SELECT t.*, u.name AS assigned_to_name, ab.name AS assigned_by_name
       FROM volunteer_tasks t
       LEFT JOIN users u  ON u.id  = t.assigned_to
       LEFT JOIN users ab ON ab.id = t.assigned_by
       ${filter}
       ORDER BY t.due_date`, params
    )
    return reply.send({ tasks: rows })
  })

  app.patch('/:id/status', async (request, reply) => {
    const { id } = request.params as any
    const { status } = request.body as any
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `UPDATE volunteer_tasks SET status=$1 WHERE id=$2 RETURNING *`, [status, id]
    )
    return reply.send({ task: rows[0] })
  })

  app.post('/', {
    preHandler: requireRole('tenant_owner','ward_admin')
  }, async (request, reply) => {
    const b = request.body as any
    const tdb = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `INSERT INTO volunteer_tasks (campaign_id,assigned_to,assigned_by,title,description,due_date,ward_id,booth_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.campaign_id,b.assigned_to,request.userId,b.title,b.description,b.due_date,b.ward_id,b.booth_id]
    )
    return reply.status(201).send({ task: rows[0] })
  })
}

// packages/api/src/routes/combined.ts
// REPLACE the entire importRoutes function with this fixed version

export async function importRoutes(app: FastifyInstance) {

  // POST /api/imports/voters
  // Called by tenant_owner or permitted ward_admin with a valid JWT
  app.post('/voters', async (request, reply) => {
    const role     = request.userRole
    const tenantId = request.tenantId
    const schema   = request.schema
    const userId   = request.userId
    const tdb      = tenantDb(schema)

    // ── FIX 2: tenant_owner always allowed; ward_admin needs allow_import flag
    if (role === 'ward_admin') {
      const { rows } = await db.query(
        `SELECT allow_import FROM public.tenant_wards
         WHERE tenant_id = $1 AND ward_id = $2`,
        [tenantId, (request.user as any).assigned_ward_id]
      )
      if (!rows.length || !rows[0].allow_import) {
        return reply.status(403).send({
          error: 'Import not permitted for your account. Contact your administrator.'
        })
      }
    } else if (role !== 'tenant_owner') {
      return reply.status(403).send({
        error: 'Only tenant_owner or permitted ward_admin can import voters.'
      })
    }

    // ── Parse uploaded file
    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No file uploaded.' })

    const XLSX  = require('xlsx')
    const buffer = await data.toBuffer()
    const wb    = XLSX.read(buffer, { type: 'buffer' })
    const ws    = wb.Sheets[wb.SheetNames[0]]
    const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: null })

    if (!rows.length) {
      return reply.status(400).send({ error: 'File has no data rows.' })
    }

    // ── Get ward_id from first row (all rows have same ward in this file)
    const wardId = rows[0]['ward_id'] || rows[0]['Ward ID'] || null
    if (!wardId) {
      return reply.status(400).send({
        error: 'ward_id column is required in the Excel file.'
      })
    }

    // ── FIX 6: import_batches INSERT now includes ward_id
    const { rows: batch } = await tdb.query(
      `INSERT INTO import_batches
         (filename, uploaded_by, ward_id, total_rows, status)
       VALUES ($1, $2, $3, $4, 'processing')
       RETURNING id`,
      [data.filename, userId, wardId, rows.length]
    )
    const batchId = batch[0].id

    let success = 0
    const errors: any[] = []

    // ── FIX 5: batch insert in chunks of 100 rows
    const CHUNK = 100
    for (let start = 0; start < rows.length; start += CHUNK) {
      const chunk  = rows.slice(start, start + CHUNK)
      const values: string[] = []
      const params: any[]    = []
      let   p = 1

      for (const row of chunk) {
        // ── FIX 4: use booth_id UUID directly from Excel (no sub-SELECT)
        const boothId     = row['booth_id']      || row['Booth ID']      || null
        const voterId     = row['voter_id']      || row['Voter ID']      || null
        const fullName    = row['full_name']     || row['Full Name']     || null
        const relationTyp = row['relation_type'] || row['Relation Type'] || null
        const relationNam = row['relation_name'] || row['Relation Name'] || null
        const fatherName  = row['father_name']   || row['Father Name']  || null
        const age         = Number(row['age']    || row['Age'])          || null
        const gender      = row['gender']        || row['Gender']        || null
        const phone       = row['phone']         || row['Phone']        || null
        const houseNo     = row['house_number']  || row['House No']     || null
        const address     = row['address']       || row['Address']      || null
        const serialNo    = Number(row['serial_no'] || row['Serial No']) || null
        const rowWardId   = row['ward_id']       || row['Ward ID']      || wardId

        if (!voterId || !fullName || !age || !gender || !rowWardId) {
          errors.push({ row: start + chunk.indexOf(row) + 2,
            reason: 'Missing required field (voter_id/full_name/age/gender/ward_id)',
            voter_id: voterId })
          continue
        }

        // ── FIX 3: correct column names + new columns added
        values.push(
          `($${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++},$${p++})`
        )
        params.push(
          voterId,       // voter_id
          fullName,      // full_name
          fatherName,    // father_name
          relationTyp,   // relation_type   ← FIX 3
          relationNam,   // relation_name   ← FIX 3
          age,           // age
          gender,        // gender
          phone,         // phone
          houseNo,       // house_number
          address,       // address
          rowWardId,     // ward_id
          boothId,       // booth_id        ← FIX 4 (UUID direct)
          serialNo,      // serial_no       ← FIX 3
          batchId,       // import_batch_id ← FIX 3 (correct column name)
        )
      }

      if (!values.length) continue

      try {
        const result = await tdb.query(
          `INSERT INTO voters
             (voter_id, full_name, father_name, relation_type, relation_name,
              age, gender, phone, house_number, address,
              ward_id, booth_id, serial_no, import_batch_id)
           VALUES ${values.join(',')}
           ON CONFLICT (voter_id) DO UPDATE SET
             full_name     = EXCLUDED.full_name,
             age           = EXCLUDED.age,
             ward_id       = EXCLUDED.ward_id,
             booth_id      = EXCLUDED.booth_id,
             updated_at    = NOW()`,
          params
        )
        success += result.rowCount ?? chunk.length
      } catch (err: any) {
        errors.push({
          rows: `${start + 1}–${start + chunk.length}`,
          reason: err.message
        })
      }
    }

    // ── Update batch record with final counts
    await tdb.query(
      `UPDATE import_batches
       SET success_rows = $1,
           error_rows   = $2,
           error_log    = $3,
           status       = $4,
           completed_at = NOW()
       WHERE id = $5`,
      [
        success,
        errors.length,
        JSON.stringify(errors.slice(0, 100)),
        errors.length === rows.length ? 'failed' : 'completed',
        batchId
      ]
    )

    return reply.send({
      batch_id:      batchId,
      total:         rows.length,
      success,
      errors:        errors.length,
      error_preview: errors.slice(0, 5)
    })
  })

  // GET /api/imports/:id — poll batch status
  app.get('/:id', async (request, reply) => {
    const { id }  = request.params as any
    const tdb     = tenantDb(request.schema)
    const { rows } = await tdb.query(
      `SELECT id, filename, status, total_rows, success_rows,
              error_rows, error_log, created_at, completed_at
       FROM import_batches WHERE id = $1`,
      [id]
    )
    if (!rows.length) return reply.status(404).send({ error: 'Batch not found' })
    return reply.send({ batch: rows[0] })
  })
}


// ─── platform.ts ──────────────────────────────────────────────
export async function platformRoutes(app: FastifyInstance) {

  // Simple platform auth guard (separate secret for super admin)
  const platformAuth = async (req: any, rep: any) => {
    const key = req.headers['x-platform-key']
    if (key !== process.env.PLATFORM_ADMIN_KEY) {
      return rep.status(403).send({ error: 'Platform access denied' })
    }
  }

  app.get('/tenants', { preHandler: platformAuth }, async (request, reply) => {
    const { rows } = await db.query(
      `SELECT t.*, json_agg(tw.ward_id) AS ward_ids
       FROM public.tenants t
       LEFT JOIN public.tenant_wards tw ON tw.tenant_id = t.id
       GROUP BY t.id ORDER BY t.created_at DESC`
    )
    return reply.send({ tenants: rows })
  })

  app.post('/tenants', { preHandler: platformAuth }, async (request, reply) => {
    const b = request.body as any
    const schema = `tenant_${b.slug.replace(/-/g,'_')}`

    // Insert tenant
    const { rows } = await db.query(
      `INSERT INTO public.tenants (slug,name,party_name,corporator_name,contact_phone,contact_email,db_schema,plan)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [b.slug,b.name,b.party_name,b.corporator_name,b.contact_phone,b.contact_email,schema,b.plan||'trial']
    )
    const tenant = rows[0]

    // Assign wards
    if (b.ward_ids?.length) {
      for (const wid of b.ward_ids) {
        await db.query(
          `INSERT INTO public.tenant_wards (tenant_id,ward_id) VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [tenant.id, wid]
        )
      }
    }

    // Provision schema (in production, run tenant SQL template here)
    // For now, return instructions
    return reply.status(201).send({
      tenant,
      next_step: `Run: psql $DATABASE_URL -c "CREATE SCHEMA ${schema}" && psql $DATABASE_URL -f migrations/tenant/001_tenant_schema.sql (with search_path=${schema})`
    })
  })

  app.patch('/tenants/:id', { preHandler: platformAuth }, async (request, reply) => {
    const { id } = request.params as any
    const b = request.body as any
    const fields: string[] = [], values: any[] = []
    let pi = 1
    if (b.status) { fields.push(`status=$${pi++}`); values.push(b.status) }
    if (b.plan)   { fields.push(`plan=$${pi++}`);   values.push(b.plan) }
    if (b.can_ward_admin_import !== undefined) {
      fields.push(`can_ward_admin_import=$${pi++}`); values.push(b.can_ward_admin_import)
    }
    values.push(id)
    const { rows } = await db.query(
      `UPDATE public.tenants SET ${fields.join(',')} WHERE id=$${pi} RETURNING *`, values
    )
    return reply.send({ tenant: rows[0] })
  })

  app.patch('/tenants/:id/import-permission', { preHandler: platformAuth }, async (request, reply) => {
    const { id } = request.params as any
    const b = request.body as any
    await db.query(
      `UPDATE public.tenant_wards SET allow_import=$1
       WHERE tenant_id=$2 AND ward_id=$3`,
      [b.allow_import, id, b.ward_id]
    )
    return reply.send({ success: true })
  })

  app.get('/wards', async (_request, reply) => {
    const { rows } = await db.query(
      `SELECT w.*, c.name AS constituency_name,
              COUNT(b.id) AS booth_count
       FROM public.wards w
       LEFT JOIN public.constituencies c ON c.id = w.constituency_id
       LEFT JOIN public.booths b ON b.ward_id = w.id
       GROUP BY w.id, c.name ORDER BY w.ward_number`
    )
    return reply.send({ wards: rows })
  })
}