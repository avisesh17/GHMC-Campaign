import { FastifyRequest, FastifyReply } from 'fastify'

export function errorHandler(
  error: any,
  request: FastifyRequest,
  reply: FastifyReply
) {
  // Zod validation errors
  if (error.statusCode === 400 || error.name === 'ZodError') {
    return reply.status(400).send({ error: 'Validation failed', details: error.message })
  }

  // JWT errors
  if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
    return reply.status(401).send({ error: 'Invalid or expired token' })
  }

  // Postgres unique violation
  if (error.code === '23505') {
    return reply.status(409).send({ error: 'Duplicate entry', detail: error.detail })
  }

  // Postgres foreign key violation
  if (error.code === '23503') {
    return reply.status(400).send({ error: 'Referenced record not found', detail: error.detail })
  }

  // Default
  console.error('Unhandled error:', error)
  return reply.status(500).send({
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { message: error.message })
  })
}
