import { FastifyRequest, FastifyReply } from 'fastify'
import { db } from '../plugins/db'

declare module 'fastify' {
  interface FastifyRequest {
    tenantId:   string
    tenantSlug: string
    schema:     string
    userId:     string
    userRole:   string
  }
}

export async function tenantMiddleware(
  request: FastifyRequest,
  reply:   FastifyReply
) {
  try {
    // Verify JWT
    await request.jwtVerify()
    const payload = request.user as any

    const { tenant_id, schema, user_id, role } = payload

    if (!tenant_id || !schema) {
      return reply.status(401).send({ error: 'Invalid token: missing tenant context' })
    }

    // Validate tenant is still active
    const { rows } = await db.query(
      `SELECT id, slug, status FROM public.tenants WHERE id = $1`,
      [tenant_id]
    )

    if (!rows.length || rows[0].status !== 'active') {
      return reply.status(403).send({ error: 'Tenant account is inactive or suspended' })
    }

    // Attach to request for use in route handlers
    request.tenantId   = tenant_id
    request.tenantSlug = rows[0].slug
    request.schema     = schema
    request.userId     = user_id
    request.userRole   = role

  } catch (err: any) {
    return reply.status(401).send({ error: 'Unauthorized', message: err.message })
  }
}

// ─── Role guard helper ────────────────────────────────────────
export function requireRole(...roles: string[]) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!roles.includes(request.userRole)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `This action requires one of: ${roles.join(', ')}`
      })
    }
  }
}
