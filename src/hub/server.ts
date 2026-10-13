import Fastify, { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/authRoutes'
import { deviceRoutes } from './routes/deviceRoutes'
import { productRoutes } from './routes/productRoutes'
import { batchRoutes } from './routes/batchRoutes'
import { saleRoutes } from './routes/saleRoutes'
import { purchaseRoutes } from './routes/purchaseRoutes'
import { stockMovementRoutes } from './routes/stockMovementRoutes'
import { masterDataRoutes } from './routes/masterDataRoutes'
import { auditRoutes } from './routes/auditRoutes'
import { syncRoutes } from './routes/syncRoutes'
import { reportRoutes } from './routes/reportRoutes'
import { touchDeviceHeartbeat } from './services/deviceService'

export function buildServer(options: { logger?: boolean } = {}): FastifyInstance {
  const fastify = Fastify({
    logger: options.logger ?? false,
  })

  // 1. Enable CORS for all LAN devices (Tablets, secondary POS, Mobile browsers)
  fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Device-Id', 'X-Store-Id'],
  })

  // 2. Device Tracking Hook (Touch heartbeat when X-Device-Id is sent)
  fastify.addHook('onRequest', async (request) => {
    const deviceId = request.headers['x-device-id'] as string
    if (deviceId) {
      touchDeviceHeartbeat(deviceId, request.ip).catch(() => {})
    }
  })

  // 3. Health & Status Check
  fastify.get('/api/health', async () => {
    return {
      status: 'ok',
      service: 'Sofiyem Local Depot Hub',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    }
  })

  // 4. Register All Modular Route Plugins
  fastify.register(authRoutes)
  fastify.register(deviceRoutes)
  fastify.register(productRoutes)
  fastify.register(batchRoutes)
  fastify.register(saleRoutes)
  fastify.register(purchaseRoutes)
  fastify.register(stockMovementRoutes)
  fastify.register(masterDataRoutes)
  fastify.register(auditRoutes)
  fastify.register(syncRoutes)
  fastify.register(reportRoutes)

  return fastify
}
