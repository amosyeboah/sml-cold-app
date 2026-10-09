import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '../hub/db/prisma'
import { completeSale, getSaleById } from '../hub/services/saleService'
import {
  enqueueOutboxEvent,
  fetchPendingOutbox,
  markEventSynced,
  markEventFailed,
  calculateBackoff,
  retryDeadLetterEvents,
} from '../hub/services/syncOutboxService'
import {
  recordStockMovement,
  getStockBalanceFromLedger,
} from '../hub/services/stockMovementService'
import {
  getReconciliationReport,
  getSyncState,
  flushOutboxBatch,
} from '../hub/services/syncEngine'
import { deleteProduct } from '../hub/services/inventoryService'
import { randomUUID } from 'crypto'

describe('Phase 2: Sync Engine, Outbox Pattern, Idempotency & Reconciliation', () => {
  let testProductId: string
  let testBatchId: string
  let testCategoryId: string

  beforeAll(async () => {
    // Setup test product and batch
    let cat = await prisma.category.findFirst()
    if (!cat) {
      cat = await prisma.category.create({ data: { name: 'Sync Test Category ' + Date.now() } })
    }
    testCategoryId = cat.id

    const prod = await prisma.medicine.create({
      data: {
        id: randomUUID(),
        name: 'Sync Test Item ' + Date.now(),
        sku: 'SYNC-' + Date.now(),
        categoryId: testCategoryId,
        price: 80.0,
        cost: 45.0,
        minStockLevel: 5,
      },
    })
    testProductId = prod.id

    const futureDate = new Date()
    futureDate.setDate(futureDate.getDate() + 180)

    const batch = await prisma.batch.create({
      data: {
        id: randomUUID(),
        medicineId: testProductId,
        batchNumber: 'LOT-SYNC-200',
        expiryDate: futureDate,
        quantity: 200,
      },
    })
    testBatchId = batch.id
  })

  afterAll(async () => {
    try {
      await prisma.syncOutbox.deleteMany({ where: { aggregateId: testProductId } })
      await prisma.syncInbox.deleteMany({ where: { entityId: testProductId } })
      await prisma.stockMovement.deleteMany({ where: { productId: testProductId } })
      await prisma.saleItem.deleteMany({ where: { batchId: testBatchId } })
      await prisma.batch.deleteMany({ where: { id: testBatchId } })
      await prisma.medicine.deleteMany({ where: { id: testProductId } })
    } catch {
      // ignore cleanup
    }
  })

  // 1. Transactional Outbox: Sale atomically commits Outbox event
  it('1. Atomically commits Outbox event along with Sale and StockMovement in SQLite', async () => {
    const saleId = randomUUID()
    const sale = await completeSale({
      id: saleId,
      total: 160.0,
      paymentMethod: 'CASH',
      items: [
        {
          medicineId: testProductId,
          batchId: testBatchId,
          quantity: 2,
          unitPrice: 80.0,
          totalPrice: 160.0,
        },
      ],
    })

    expect(sale).toBeDefined()
    expect(sale.id).toBe(saleId)

    // Check that an Outbox record was created atomically
    const outboxEvent = await prisma.syncOutbox.findFirst({
      where: {
        aggregateId: saleId,
        entityType: 'SALE',
      },
    })

    expect(outboxEvent).toBeDefined()
    expect(['INSERT', 'CREATE']).toContain(outboxEvent?.operation)
    expect(outboxEvent?.status).toBe('PENDING')
    expect(outboxEvent?.retryCount).toBe(0)

    const payload = JSON.parse(outboxEvent!.payload)
    expect(payload.id).toBe(saleId)
    expect(payload.total).toBe(160.0)
    expect(payload.items).toHaveLength(1)
  })

  // 2. Exponential Backoff Calculation
  it('2. Calculates exponential backoff with jitter correctly across retry attempts', () => {
    const now = Date.now()
    const b0 = calculateBackoff(0).getTime() - now
    expect(b0).toBeGreaterThanOrEqual(4000)
    expect(b0).toBeLessThanOrEqual(6000)

    const b1 = calculateBackoff(1).getTime() - now
    expect(b1).toBeGreaterThanOrEqual(9000)
    expect(b1).toBeLessThanOrEqual(11000)

    const b2 = calculateBackoff(2).getTime() - now
    expect(b2).toBeGreaterThanOrEqual(19000)
    expect(b2).toBeLessThanOrEqual(21000)

    const b5 = calculateBackoff(5).getTime() - now
    expect(b5).toBeGreaterThanOrEqual(159000)
    expect(b5).toBeLessThanOrEqual(162000)

    // Caps at maximum backoff (900 seconds = 15 minutes)
    const b10 = calculateBackoff(10).getTime() - now
    expect(b10).toBeLessThanOrEqual(905000)
  })

  // 3. Retry and Dead-letter Transition
  it('3. Moves repeatedly failing event to DEAD_LETTER after 5 attempts without deleting', async () => {
    const eventId = randomUUID()
    const outboxRecord = await prisma.syncOutbox.create({
      data: {
        id: randomUUID(),
        eventId,
        entity: 'TEST_ENTITY',
        entityType: 'TEST_ENTITY',
        recordId: 'test-id-1',
        entityId: 'test-id-1',
        action: 'UPDATE',
        operation: 'UPDATE',
        payload: JSON.stringify({ test: true }),
        status: 'PENDING',
        retryCount: 0,
      },
    })

    // Simulate 4 failures
    for (let i = 1; i <= 4; i++) {
      const updated = await markEventFailed(eventId, `Network timeout attempt ${i}`)
      expect(updated?.status).toBe('FAILED')
      expect(updated?.retryCount).toBe(i)
    }

    // 5th failure exceeds threshold -> DEAD_LETTER
    const deadLetter = await markEventFailed(eventId, 'Fatal 500 error from cloud')
    expect(deadLetter?.status).toBe('DEAD_LETTER')
    expect(deadLetter?.retryCount).toBe(5)
    expect(deadLetter?.lastError).toContain('Fatal 500 error')

    // Clean up
    await prisma.syncOutbox.delete({ where: { eventId } })
  })

  // 4. Dead-Letter Recovery / Re-queue
  it('4. Successfully re-queues DEAD_LETTER events to PENDING with reset counters', async () => {
    const eventId = randomUUID()
    await prisma.syncOutbox.create({
      data: {
        id: randomUUID(),
        eventId,
        entity: 'TEST_ENTITY',
        entityType: 'TEST_ENTITY',
        recordId: 'test-id-dead',
        entityId: 'test-id-dead',
        action: 'UPDATE',
        operation: 'UPDATE',
        payload: JSON.stringify({ recover: true }),
        status: 'DEAD_LETTER',
        retryCount: 5,
        lastError: 'Exhausted retry attempts',
      },
    })

    const count = await retryDeadLetterEvents()
    expect(count).toBeGreaterThanOrEqual(1)

    const recovered = await prisma.syncOutbox.findUnique({ where: { eventId } })
    expect(recovered?.status).toBe('PENDING')
    expect(recovered?.retryCount).toBe(0)
    expect(recovered?.lastError).toBeNull()

    // Clean up
    await prisma.syncOutbox.delete({ where: { eventId } })
  })

  // 5. Explicit Acknowledgement (ACK)
  it('5. Marks event as SYNCED only upon explicit server acknowledgement', async () => {
    const eventId = randomUUID()
    await prisma.syncOutbox.create({
      data: {
        id: randomUUID(),
        eventId,
        entity: 'SALE',
        entityType: 'SALE',
        recordId: 'test-sale-ack',
        entityId: 'test-sale-ack',
        action: 'CREATE',
        operation: 'CREATE',
        payload: JSON.stringify({ saleId: 'test-sale-ack' }),
        status: 'PROCESSING',
      },
    })

    const synced = await markEventSynced(eventId)
    expect(synced.status).toBe('SYNCED')
    expect(synced.processedAt).toBeDefined()
    expect(synced.lastError).toBeNull()

    // Clean up
    await prisma.syncOutbox.delete({ where: { eventId } })
  })

  // 6. Append-Only Stock Movements vs Static Stock Overwrite
  it('6. Uses append-only delta movements rather than static stock overwrites', async () => {
    const initialBalance = await getStockBalanceFromLedger(testProductId)

    // Purchase +50
    await recordStockMovement({
      productId: testProductId,
      batchId: testBatchId,
      movementType: 'PURCHASE',
      quantityDelta: 50,
      reason: 'Bulk stock arrival',
    })

    // Sale -10
    await recordStockMovement({
      productId: testProductId,
      batchId: testBatchId,
      movementType: 'SALE',
      quantityDelta: -10,
      reason: 'Dispensed at POS 1',
    })

    // Damage -2
    await recordStockMovement({
      productId: testProductId,
      batchId: testBatchId,
      movementType: 'DAMAGE',
      quantityDelta: -2,
      reason: 'Vial broken during shelving',
    })

    // Return +1
    await recordStockMovement({
      productId: testProductId,
      batchId: testBatchId,
      movementType: 'RETURN',
      quantityDelta: 1,
      reason: 'Customer return unopened',
    })

    const updatedBalance = await getStockBalanceFromLedger(testProductId)
    const expected = initialBalance + 50 - 10 - 2 + 1
    expect(updatedBalance).toBe(expected)

    // Verify outbox was populated for each movement
    const movementsOutbox = await prisma.syncOutbox.findMany({
      where: {
        entityType: 'STOCK_MOVEMENT',
        aggregateId: testProductId,
      },
    })
    expect(movementsOutbox.length).toBeGreaterThanOrEqual(4)
  })

  // 7. Immutable Sales: Corrections handled by reversal movements
  it('7. Enforces immutability: Original sale totals are not overwritten; returns create reversal movements', async () => {
    const saleId = randomUUID()
    const sale = await completeSale({
      id: saleId,
      total: 240.0,
      paymentMethod: 'MOMO',
      items: [
        {
          medicineId: testProductId,
          batchId: testBatchId,
          quantity: 3,
          unitPrice: 80.0,
          totalPrice: 240.0,
        },
      ],
    })

    // Sale is committed
    expect(sale.total).toBe(240.0)

    // A return of 1 item is processed via StockMovement (REVERSAL / RETURN)
    const returnMovement = await recordStockMovement({
      productId: testProductId,
      batchId: testBatchId,
      movementType: 'RETURN',
      quantityDelta: 1,
      referenceType: 'SALE_RETURN',
      referenceId: saleId,
      reason: 'Customer returned 1 unit with receipt',
    })

    expect(returnMovement.quantityDelta).toBe(1)
    expect(returnMovement.referenceId).toBe(saleId)

    // Original sale record remains strictly untouched and immutable
    const verifiedSale = await getSaleById(saleId)
    expect(verifiedSale?.total).toBe(240.0)
    expect(verifiedSale?.items[0].quantity).toBe(3)
  })

  // 8. Inbound Sync Cursor and SyncInbox deduplication
  it('8. SyncInbox deduplicates inbound events and rejects replay of identical eventId', async () => {
    const inboundEventId = 'cloud-event-' + randomUUID()

    // 1st delivery
    const inboxEntry = await prisma.syncInbox.create({
      data: {
        eventId: inboundEventId,
        entityType: 'PRODUCT',
        entityId: testProductId,
        operation: 'UPDATE',
        payload: JSON.stringify({ name: 'Updated Cold Item', price: 90.0 }),
        receivedAt: new Date(),
        status: 'APPLIED',
        appliedAt: new Date(),
      },
    })

    expect(inboxEntry.id).toBeDefined()
    expect(inboxEntry.eventId).toBe(inboundEventId)

    // 2nd delivery with identical eventId must fail unique constraint
    await expect(
      prisma.syncInbox.create({
        data: {
          eventId: inboundEventId,
          entityType: 'PRODUCT',
          entityId: testProductId,
          operation: 'UPDATE',
          payload: JSON.stringify({ name: 'Duplicate event' }),
          receivedAt: new Date(),
          status: 'PENDING',
        },
      })
    ).rejects.toThrow()

    // Clean up
    await prisma.syncInbox.delete({ where: { eventId: inboundEventId } })
  })

  // 9. Reconciliation Audit Engine
  it('9. Generates accurate reconciliation report comparing local sales, revenue, and stock movements', async () => {
    const report = await getReconciliationReport()

    expect(report).toBeDefined()
    expect(report.timestamp).toBeDefined()
    expect(report.local.salesCount).toBeGreaterThanOrEqual(1)
    expect(report.local.salesTotalRevenue).toBeGreaterThanOrEqual(0)
    expect(report.local.stockMovementsCount).toBeGreaterThanOrEqual(1)
    expect(['IN_SYNC', 'DISCREPANCY_DETECTED', 'CLOUD_UNAVAILABLE']).toContain(report.status)
    expect(Array.isArray(report.discrepancies)).toBe(true)
    expect(Array.isArray(report.recommendations)).toBe(true)
  }, 15000)

  // 10. Sync Engine State Observability
  it('10. Exposes complete synchronization observability states (pending, failed, dead-letter, latency)', async () => {
    const state = await getSyncState()

    expect(state).toBeDefined()
    expect(['ONLINE', 'OFFLINE', 'SYNCING', 'SYNC_ERROR']).toContain(state.state)
    expect(typeof state.pendingCount).toBe('number')
    expect(typeof state.failedCount).toBe('number')
    expect(typeof state.deadLetterCount).toBe('number')
    expect(typeof state.inboundCursor).toBe('number')
    expect(state.depotId).toBeDefined()
  }, 15000)

  // 11. Historical Database Integrity Verification
  it('11. Database migration preserved all existing medicines, batches, users, and audit logs', async () => {
    const usersCount = await prisma.user.count()
    const medicinesCount = await prisma.medicine.count()
    const batchesCount = await prisma.batch.count()
    const auditLogsCount = await prisma.auditLog.count()

    expect(usersCount).toBeGreaterThanOrEqual(3)
    expect(medicinesCount).toBeGreaterThanOrEqual(18)
    expect(batchesCount).toBeGreaterThanOrEqual(20)
    expect(auditLogsCount).toBeGreaterThanOrEqual(1)
  })

  // 12. Deletion Permanence Verification
  it('12. Deleting a product removes it permanently from SQLite and queues outbox DELETE event', async () => {
    // Create a temporary product
    const tempProd = await prisma.medicine.create({
      data: {
        id: randomUUID(),
        name: 'Temp Deletion Test Item ' + Date.now(),
        sku: 'TEMP-DEL-' + Date.now(),
        categoryId: testCategoryId,
        price: 99.0,
        cost: 50.0,
        minStockLevel: 5,
      },
    })

    const foundBefore = await prisma.medicine.findUnique({ where: { id: tempProd.id } })
    expect(foundBefore).toBeDefined()

    // Delete via inventoryService
    await deleteProduct(tempProd.id, { deviceId: 'test-unit-device' })

    // Verify it is completely gone from SQLite
    const foundAfter = await prisma.medicine.findUnique({ where: { id: tempProd.id } })
    expect(foundAfter).toBeNull()

    // Verify outbox entry exists with DELETE action
    const outboxItem = await prisma.syncOutbox.findFirst({
      where: {
        entity: 'PRODUCT',
        action: 'DELETE',
        recordId: tempProd.id,
      },
    })
    expect(outboxItem).toBeDefined()
    expect(outboxItem?.recordId).toBe(tempProd.id)
  }, 15000)
})
