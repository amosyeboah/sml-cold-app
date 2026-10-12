import { FastifyPluginAsync } from 'fastify'
import * as syncEngine from '../services/syncEngine'
import * as syncOutboxService from '../services/syncOutboxService'
import { prisma, resolveDatabasePath } from '../db/prisma'

export const syncRoutes: FastifyPluginAsync = async (fastify) => {
  // 1. Real-time Synchronization Status
  fastify.get('/api/sync/status', async () => {
    const status = await syncEngine.getSyncState()
    return {
      ...status,
      database: resolveDatabasePath(),
      mode: 'AUTHORITATIVE_LOCAL_HUB',
      timestamp: new Date().toISOString(),
    }
  })

  // 2. Manual/Triggered Outbox Flush
  fastify.post('/api/sync/flush', async (request) => {
    const { batchSize } = (request.body as any) || {}
    const result = await syncEngine.flushOutboxBatch(batchSize ? Number(batchSize) : 50)
    return result
  })

  // 3. Manual/Triggered Cloud Changes Pull
  fastify.post('/api/sync/pull', async (request) => {
    const { limit } = (request.body as any) || {}
    const result = await syncEngine.pullCloudChanges(limit ? Number(limit) : 50)
    return result
  })

  // 4. Reconciliation & Diagnostics Report
  fastify.get('/api/sync/reconcile', async () => {
    return await syncEngine.getReconciliationReport()
  })

  // 5. Inspect Outbox Items
  fastify.get('/api/sync/outbox', async (request) => {
    const { status, limit } = request.query as any
    const where: any = {}
    if (status) where.status = status

    const items = await prisma.syncOutbox.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit ? Number(limit) : 100,
    })

    const formattedItems = items.map((item) => {
      let details = ''
      try {
        const p = typeof item.payload === 'string' ? JSON.parse(item.payload) : item.payload
        if (item.entity === 'SALE') {
          details = `Invoice ${p.invoice_number || p.saleNumber || item.recordId?.slice(0, 8)} • GH₵${Number(p.total ?? p.total_amount ?? 0).toFixed(2)}`
        } else if (item.entity === 'AUDIT_LOG') {
          details = `${p.action || 'ACTIVITY'}: ${p.details || 'System log'}`
        } else if (item.entity === 'PRODUCT') {
          details = `Product: ${p.name || p.sku || item.recordId} (GH₵${Number(p.price || 0).toFixed(2)})`
        } else if (item.entity === 'BATCH') {
          details = `Batch: ${p.batchNumber || 'N/A'} • Qty: ${p.quantity ?? 0}`
        } else if (item.entity === 'PURCHASE') {
          details = `Purchase: ${p.poNumber || 'PO'} • GH₵${Number(p.total ?? 0).toFixed(2)}`
        } else if (item.entity === 'STOCK_MOVEMENT') {
          details = `Stock delta: ${p.quantityDelta > 0 ? '+' : ''}${p.quantityDelta} (${p.movementType || 'ADJUSTMENT'})`
        }
      } catch {
        details = `${item.entity} ${item.action}`
      }
      return {
        ...item,
        entityType: item.entityType || item.entity,
        operation: item.operation || item.action,
        details: details || `${item.entity} ${item.action}`,
      }
    })

    const metrics = await syncOutboxService.getOutboxMetrics()
    return { metrics, count: formattedItems.length, items: formattedItems }
  })

  // 6. Inspect Sync Sessions History
  fastify.get('/api/sync/sessions', async (request) => {
    const { limit } = request.query as any
    const sessions = await prisma.syncSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: limit ? Number(limit) : 40,
    })
    return sessions
  })

  // 7. Reset Dead-Lettered Events back to PENDING
  fastify.post('/api/sync/retry-dead-letter', async () => {
    const updated = await prisma.syncOutbox.updateMany({
      where: { status: 'DEAD_LETTER' },
      data: {
        status: 'PENDING',
        retryCount: 0,
        nextAttemptAt: null,
        errorMessage: null,
        lastError: null,
      },
    })
    return { success: true, count: updated.count }
  })

  // 8. Clear Outbox (Purge synced or all outbox records)
  fastify.post('/api/sync/clear', async () => {
    const cleared = await prisma.syncOutbox.deleteMany({})
    return { success: true, count: cleared.count }
  })
}
