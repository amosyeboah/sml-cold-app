import { prisma } from '../db/prisma'
import { CreatePurchaseInput } from '../domain/types'
import { recordStockMovement } from './stockMovementService'
import { enqueueOutboxItem } from './syncOutboxService'
import { randomUUID } from 'crypto'

export async function createPurchase(input: CreatePurchaseInput) {
  if (!input.items || input.items.length === 0) {
    throw new Error('Purchase must contain at least one item')
  }

  return await prisma.$transaction(async (tx) => {
    const purchaseId = input.id || randomUUID()

    // Ensure Device exists if deviceId is provided
    if (input.deviceId) {
      await tx.device.upsert({
        where: { deviceId: input.deviceId },
        update: { lastSeen: new Date() },
        create: {
          id: randomUUID(),
          deviceId: input.deviceId,
          storeId: 'sml_accra_main',
          deviceName: input.deviceId,
          deviceType: 'DESKTOP',
          lastSeen: new Date(),
          status: 'ACTIVE',
        },
      })
    }

    // 1. Create Purchase record
    const purchase = await tx.purchase.create({
      data: {
        id: purchaseId,
        supplierId: input.supplierId,
        total: Number(input.total) || 0,
        status: 'COMPLETED',
        deviceId: input.deviceId || null,
        items: {
          create: input.items.map((i) => ({
            id: i.id || randomUUID(),
            medicineId: i.medicineId,
            quantity: i.quantity,
            cost: Number(i.cost) || 0,
          })),
        },
      },
      include: {
        items: true,
        supplier: true,
      },
    })

    // 2. Process each item: create/update Batch and add StockMovement
    for (let index = 0; index < input.items.length; index++) {
      const item = input.items[index]
      const purchaseItem = purchase.items[index]
      const expDate = new Date(item.expiryDate)

      // Look for existing batch with the same medicineId and batchNumber
      let batch = await tx.batch.findFirst({
        where: {
          medicineId: item.medicineId,
          batchNumber: item.batchNumber,
        },
      })

      if (batch) {
        batch = await tx.batch.update({
          where: { id: batch.id },
          data: {
            quantity: { increment: item.quantity },
            expiryDate: expDate,
            purchaseItemId: purchaseItem.id,
          },
        })
      } else {
        batch = await tx.batch.create({
          data: {
            id: randomUUID(),
            medicineId: item.medicineId,
            batchNumber: item.batchNumber,
            expiryDate: expDate,
            quantity: item.quantity,
            purchaseItemId: purchaseItem.id,
          },
        })
      }

      // Record Stock Movement Ledger Entry
      await recordStockMovement(tx, {
        productId: item.medicineId,
        batchId: batch.id,
        quantityDelta: item.quantity,
        movementType: 'PURCHASE',
        referenceType: 'PURCHASE',
        referenceId: purchase.id,
        unitCost: item.cost,
        userId: input.userId,
        deviceId: input.deviceId,
        notes: `Received from supplier ${purchase.supplier?.name || input.supplierId} (Batch: ${item.batchNumber})`,
      })

      // Update medicine cost with latest supplier purchase cost
      if (item.cost && Number(item.cost) > 0) {
        await tx.medicine.update({
          where: { id: item.medicineId },
          data: { cost: Number(item.cost) },
        }).catch(() => {})
      }
    }

    // 3. Record Audit Log
    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        action: 'BATCH_RECEIVE',
        category: 'PURCHASES',
        details: `Restocked ${input.items.length} items from supplier (Total: GH₵${input.total.toFixed(2)})`,
        username: input.username || 'MANAGER',
        userRole: input.userRole || 'MANAGER',
        severity: 'INFO',
        deviceId: input.deviceId || null,
        metadata: JSON.stringify({
          purchaseId: purchase.id,
          supplierId: input.supplierId,
          total: input.total,
          itemCount: input.items.length,
        }),
      },
    })

    // 4. Enqueue Sync Outbox Event
    await enqueueOutboxItem(
      tx,
      'PURCHASE',
      'INSERT',
      purchase.id,
      {
        id: purchase.id,
        supplierId: purchase.supplierId,
        total: purchase.total,
        status: purchase.status,
        date: purchase.date,
        deviceId: purchase.deviceId,
        items: input.items,
      },
      input.deviceId
    )

    return purchase
  })
}

export async function getPurchases() {
  return await prisma.purchase.findMany({
    orderBy: { date: 'desc' },
    include: {
      supplier: true,
      items: {
        include: {
          batches: true,
        },
      },
    },
  })
}

export async function deletePurchase(id: string) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({
      where: { id },
      include: { items: { include: { batches: true } } },
    })
    if (!existing) return null

    // Delete purchase items first
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })
    const deleted = await tx.purchase.delete({ where: { id } })
    await enqueueOutboxItem(tx, 'PURCHASE', 'DELETE', id, { id }, existing.deviceId || undefined)

    return deleted
  })
}
