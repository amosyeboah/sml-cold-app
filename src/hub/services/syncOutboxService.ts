import { prisma } from '../db/prisma'
import { SyncAction, SyncEntity } from '../domain/types'
import { randomUUID } from 'crypto'

export const MAX_RETRY_ATTEMPTS = 5
export const BASE_BACKOFF_SECONDS = 5
export const MAX_BACKOFF_SECONDS = 900 // 15 minutes

export function calculateBackoff(retryCount: number): Date {
  // Exponential backoff: 5s, 10s, 20s, 40s, 80s... capped at 15 minutes
  const seconds = Math.min(MAX_BACKOFF_SECONDS, BASE_BACKOFF_SECONDS * Math.pow(2, retryCount))
  const nextAttempt = new Date()
  nextAttempt.setSeconds(nextAttempt.getSeconds() + seconds)
  return nextAttempt
}

export async function enqueueOutboxItem(
  tx: any,
  entity: SyncEntity,
  action: SyncAction,
  recordId: string,
  payload: any,
  deviceId?: string,
  storeId: string = 'sml_accra_main',
  aggregateType?: string,
  aggregateId?: string
) {
  const eventId = randomUUID()
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)

  return await tx.syncOutbox.create({
    data: {
      id: randomUUID(),
      eventId,
      storeId,
      entity,
      action,
      recordId,
      payload: payloadString,
      entityType: entity,
      entityId: recordId,
      operation: action,
      aggregateType: aggregateType || entity,
      aggregateId: aggregateId || recordId,
      status: 'PENDING',
      attempts: 0,
      retryCount: 0,
      deviceId: deviceId || null,
      createdAt: new Date(),
    },
  })
}

export async function getBatchForSync(batchSize = 50) {
  const now = new Date()
  return await prisma.syncOutbox.findMany({
    where: {
      status: { in: ['PENDING', 'FAILED'] },
      OR: [
        { nextAttemptAt: null },
        { nextAttemptAt: { lte: now } },
      ],
    },
    orderBy: { createdAt: 'asc' },
    take: batchSize,
  })
}

export async function markEventSynced(eventId: string) {
  const now = new Date()
  return await prisma.syncOutbox.update({
    where: { eventId },
    data: {
      status: 'SYNCED',
      syncedAt: now,
      processedAt: now,
      lastError: null,
      errorMessage: null,
    },
  })
}

export async function markEventsSynced(eventIds: string[]) {
  if (eventIds.length === 0) return { count: 0 }
  const now = new Date()
  return await prisma.syncOutbox.updateMany({
    where: { eventId: { in: eventIds } },
    data: {
      status: 'SYNCED',
      syncedAt: now,
      processedAt: now,
      lastError: null,
      errorMessage: null,
    },
  })
}

export async function recordEventFailure(eventId: string, error: string) {
  const existing = await prisma.syncOutbox.findUnique({ where: { eventId } })
  if (!existing) return null

  const newRetryCount = (existing.retryCount || 0) + 1
  const isDeadLetter = newRetryCount >= MAX_RETRY_ATTEMPTS
  const nextAttempt = isDeadLetter ? null : calculateBackoff(newRetryCount)
  const now = new Date()

  return await prisma.syncOutbox.update({
    where: { eventId },
    data: {
      status: isDeadLetter ? 'DEAD_LETTER' : 'FAILED',
      attempts: { increment: 1 },
      retryCount: newRetryCount,
      lastAttempt: now,
      lastAttemptAt: now,
      nextAttemptAt: nextAttempt,
      errorMessage: error,
      lastError: error,
    },
  })
}

export async function retryDeadLetterEvents(): Promise<number> {
  const result = await prisma.syncOutbox.updateMany({
    where: { status: { in: ['DEAD_LETTER', 'FAILED'] } },
    data: {
      status: 'PENDING',
      retryCount: 0,
      attempts: 0,
      nextAttemptAt: null,
      lastError: null,
      errorMessage: null,
    },
  })
  return result.count
}

export const markEventFailed = recordEventFailure

export async function getOutboxMetrics() {
  const [pending, failed, deadLetter, synced, total] = await Promise.all([
    prisma.syncOutbox.count({ where: { status: 'PENDING' } }),
    prisma.syncOutbox.count({ where: { status: 'FAILED' } }),
    prisma.syncOutbox.count({ where: { status: 'DEAD_LETTER' } }),
    prisma.syncOutbox.count({ where: { status: 'SYNCED' } }),
    prisma.syncOutbox.count(),
  ])

  return {
    pending,
    failed,
    deadLetter,
    synced,
    total,
  }
}
