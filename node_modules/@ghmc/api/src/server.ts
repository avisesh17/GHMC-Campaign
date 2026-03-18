import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import multipart from '@fastify/multipart'
import dotenv from 'dotenv'

dotenv.config()

import { authRoutes }        from './routes/auth'
import { voterRoutes }       from './routes/voters'
import { canvassingRoutes }  from './routes/canvassing'
import {
  boothRoutes,
  campaignRoutes,
  eventRoutes,
  taskRoutes,
  importRoutes,
  reportRoutes,
  platformRoutes,
} from './routes/combined'
import { tenantMiddleware }  from './middleware/tenant'
import { errorHandler }      from './middleware/errors'

export const buildApp = () => {
  const app = Fastify({ logger: process.env.NODE_ENV !== 'test' })

  // ─── Plugins ────────────────────────────────────────────────
  app.register(cors, {
    origin: [
      'http://localhost:3000',
      'https://*.vercel.app',
      process.env.API_BASE_URL || ''
    ],
    credentials: true
  })

  app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-in-production'
  })

  app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }) // 10MB

  // ─── Health check ────────────────────────────────────────────
  app.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }))

  // ─── Platform routes (super admin, no tenant context) ────────
  app.register(authRoutes,     { prefix: '/auth' })
  app.register(platformRoutes, { prefix: '/platform' })

  // ─── Tenant-scoped routes (inject tenant schema) ─────────────
  app.register(async (tenantApp) => {
    tenantApp.addHook('preHandler', tenantMiddleware)
    tenantApp.register(voterRoutes,      { prefix: '/voters' })
    tenantApp.register(canvassingRoutes, { prefix: '/canvassing' })
    tenantApp.register(boothRoutes,      { prefix: '/booths' })
    tenantApp.register(campaignRoutes,   { prefix: '/campaigns' })
    tenantApp.register(eventRoutes,      { prefix: '/events' })
    tenantApp.register(taskRoutes,       { prefix: '/tasks' })
    tenantApp.register(importRoutes,     { prefix: '/imports' })
    tenantApp.register(reportRoutes,     { prefix: '/reports' })
  }, { prefix: '/api' })

  // ─── Error handler ───────────────────────────────────────────
  app.setErrorHandler(errorHandler)

  return app
}

// Only start server when not in test mode
if (require.main === module) {
  const app = buildApp()
  const PORT = Number(process.env.PORT) || 3001
  app.listen({ port: PORT, host: '0.0.0.0' }, (err) => {
    if (err) { console.error(err); process.exit(1) }
    console.log(`GHMC API running on port ${PORT}`)
  })
}
