import { prisma } from '../db/prisma'
import { recordStockMovement } from './stockMovementService'
import { enqueueOutboxItem } from './syncOutboxService'
import { recordAudit } from './auditService'
import { flushOutboxBatch } from './syncEngine'
import { randomUUID } from 'crypto'

// ─── Products (Medicines) ───────────────────────────────────────────────────

export async function getProducts() {
  return await prisma.medicine.findMany({
    include: { category: true, batches: true },
    orderBy: { name: 'asc' },
  })
}

export async function getProductById(id: string) {
  return await prisma.medicine.findUnique({
    where: { id },
    include: { category: true, batches: true },
  })
}

export async function createProduct(data: {
  name: string
  genericName?: string
  sku: string
  categoryId: string
  price: number
  cost: number
  minStockLevel?: number
  deviceId?: string
  username?: string
  userRole?: string
}) {
  return await prisma.$transaction(async (tx) => {
    const id = randomUUID()
    const product = await tx.medicine.create({
      data: {
        id,
        name: data.name,
        genericName: data.genericName || null,
        sku: data.sku,
        categoryId: data.categoryId,
        price: Number(data.price) || 0,
        cost: Number(data.cost) || 0,
        minStockLevel: data.minStockLevel !== undefined ? Number(data.minStockLevel) : 10,
      },
      include: { category: true, batches: true },
    })

    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        action: 'PRODUCT_CREATE',
        category: 'PRICING',
        details: `New product "${product.name}" (SKU: ${product.sku}) added with price GH₵${product.price.toFixed(2)}`,
        username: data.username || 'ADMIN',
        userRole: data.userRole || 'ADMIN',
        severity: 'INFO',
        deviceId: data.deviceId || null,
        metadata: JSON.stringify({ productId: product.id, name: product.name, price: product.price, cost: product.cost }),
      },
    })

    await enqueueOutboxItem(
      tx,
      'PRODUCT',
      'INSERT',
      product.id,
      product,
      data.deviceId
    )

    return product
  })
}

export async function updateProduct(
  id: string,
  data: any,
  meta?: { deviceId?: string; username?: string; userRole?: string }
) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.medicine.findUnique({ where: { id } })
    if (!existing) throw new Error(`Product ${id} not found`)

    const updated = await tx.medicine.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        ...(data.genericName !== undefined ? { genericName: data.genericName } : {}),
        ...(data.sku !== undefined ? { sku: data.sku } : {}),
        ...(data.categoryId !== undefined ? { categoryId: data.categoryId } : {}),
        ...(data.price !== undefined ? { price: Number(data.price) } : {}),
        ...(data.cost !== undefined ? { cost: Number(data.cost) } : {}),
        ...(data.minStockLevel !== undefined ? { minStockLevel: Number(data.minStockLevel) } : {}),
      },
      include: { category: true, batches: true },
    })

    if (data.price !== undefined && Number(data.price) !== Number(existing.price)) {
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          action: 'PRICE_CHANGE',
          category: 'PRICING',
          details: `Selling price for "${existing.name}" changed from GH₵${existing.price.toFixed(2)} to GH₵${Number(data.price).toFixed(2)}`,
          username: meta?.username || 'ADMIN',
          userRole: meta?.userRole || 'ADMIN',
          severity: 'WARNING',
          deviceId: meta?.deviceId || null,
          metadata: JSON.stringify({ productId: id, name: existing.name, oldPrice: existing.price, newPrice: Number(data.price) }),
        },
      })
    }

    if (data.cost !== undefined && Number(data.cost) !== Number(existing.cost)) {
      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          action: 'COST_CHANGE',
          category: 'PRICING',
          details: `Unit purchase cost for "${existing.name}" changed from GH₵${existing.cost.toFixed(2)} to GH₵${Number(data.cost).toFixed(2)}`,
          username: meta?.username || 'ADMIN',
          userRole: meta?.userRole || 'ADMIN',
          severity: 'WARNING',
          deviceId: meta?.deviceId || null,
          metadata: JSON.stringify({ productId: id, name: existing.name, oldCost: existing.cost, newCost: Number(data.cost) }),
        },
      })
    }

    await enqueueOutboxItem(
      tx,
      'PRODUCT',
      'UPDATE',
      updated.id,
      updated,
      meta?.deviceId
    )

    return updated
  })
}

export async function deleteProduct(id: string, meta?: { deviceId?: string; username?: string }) {
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.medicine.findUnique({
      where: { id },
      include: { batches: true },
    })
    if (!existing) return null

    const batchIds = existing.batches.map((b) => b.id)
    if (batchIds.length > 0) {
      await tx.saleItem.deleteMany({ where: { batchId: { in: batchIds } } })
      await tx.stockMovement.deleteMany({ where: { productId: id } })
      await tx.batch.deleteMany({ where: { medicineId: id } })
    }
    await tx.purchaseItem.deleteMany({ where: { medicineId: id } })

    const deletedMed = await tx.medicine.delete({ where: { id } })

    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        action: 'PRODUCT_DELETE',
        category: 'INVENTORY',
        details: `Product "${existing.name}" (SKU: ${existing.sku}) was deleted`,
        username: meta?.username || 'ADMIN',
        userRole: 'ADMIN',
        severity: 'CRITICAL',
        deviceId: meta?.deviceId || null,
        metadata: JSON.stringify({ productId: id, name: existing.name }),
      },
    })

    await enqueueOutboxItem(
      tx,
      'PRODUCT',
      'DELETE',
      id,
      { id },
      meta?.deviceId
    )

    return deletedMed
  })

  if (deleted) {
    // Trigger immediate outbox flush in background
    flushOutboxBatch(50).catch(() => {})
  }

  return deleted
}

// ─── Batches ────────────────────────────────────────────────────────────────

export async function getBatches(startDate?: string, endDate?: string) {
  const where: any = {}
  if (startDate || endDate) {
    where.expiryDate = {}
    if (startDate) where.expiryDate.gte = new Date(startDate)
    if (endDate) where.expiryDate.lte = new Date(endDate)
  }

  return await prisma.batch.findMany({
    where,
    include: { medicine: true },
    orderBy: { expiryDate: 'asc' },
  })
}

export async function createBatch(data: {
  medicineId: string
  batchNumber: string
  expiryDate: string
  quantity: number
  deviceId?: string
  userId?: string
  username?: string
}) {
  return await prisma.$transaction(async (tx) => {
    const id = randomUUID()
    const expDate = new Date(data.expiryDate)
    const qty = Number(data.quantity) || 0

    const batch = await tx.batch.create({
      data: {
        id,
        medicineId: data.medicineId,
        batchNumber: data.batchNumber,
        expiryDate: expDate,
        quantity: qty,
      },
      include: { medicine: true },
    })

    if (qty > 0) {
      await recordStockMovement(tx, {
        productId: data.medicineId,
        batchId: batch.id,
        quantityDelta: qty,
        movementType: 'ADJUSTMENT_IN',
        referenceType: 'INITIAL',
        referenceId: batch.id,
        unitCost: batch.medicine?.cost,
        userId: data.userId,
        deviceId: data.deviceId,
        notes: `Initial stock for batch ${batch.batchNumber}`,
      })
    }

    await enqueueOutboxItem(
      tx,
      'BATCH',
      'INSERT',
      batch.id,
      batch,
      data.deviceId
    )

    return batch
  })
}

export async function updateBatch(
  id: string,
  data: any,
  meta?: { deviceId?: string; userId?: string; username?: string; userRole?: string; reason?: string }
) {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id },
      include: { medicine: true },
    })
    if (!existing) throw new Error(`Batch ${id} not found`)

    const updateData: any = {}
    if (data.batchNumber !== undefined) updateData.batchNumber = data.batchNumber
    if (data.expiryDate !== undefined) updateData.expiryDate = new Date(data.expiryDate)
    if (data.quantity !== undefined) updateData.quantity = Number(data.quantity)

    const updated = await tx.batch.update({
      where: { id },
      data: updateData,
      include: { medicine: true },
    })

    // If quantity changed, record StockMovement ledger entry!
    if (data.quantity !== undefined && Number(data.quantity) !== existing.quantity) {
      const delta = Number(data.quantity) - existing.quantity
      const movementType = delta > 0 ? 'ADJUSTMENT_IN' : 'ADJUSTMENT_OUT'

      await recordStockMovement(tx, {
        productId: existing.medicineId,
        batchId: existing.id,
        quantityDelta: delta,
        movementType,
        referenceType: 'ADJUSTMENT',
        referenceId: existing.id,
        unitCost: existing.medicine?.cost,
        userId: meta?.userId,
        deviceId: meta?.deviceId,
        notes: meta?.reason || `Manual inventory adjustment (${delta > 0 ? '+' : ''}${delta})`,
      })

      await tx.auditLog.create({
        data: {
          id: randomUUID(),
          action: 'STOCK_ADJUSTMENT',
          category: 'INVENTORY',
          details: `Batch "${existing.batchNumber}" (${existing.medicine.name}) stock adjusted from ${existing.quantity} to ${data.quantity} (${delta > 0 ? '+' : ''}${delta})`,
          username: meta?.username || 'ADMIN',
          userRole: meta?.userRole || 'ADMIN',
          severity: 'WARNING',
          deviceId: meta?.deviceId || null,
          metadata: JSON.stringify({ batchId: id, oldQty: existing.quantity, newQty: data.quantity, delta, reason: meta?.reason }),
        },
      })
    }

    await enqueueOutboxItem(
      tx,
      'BATCH',
      'UPDATE',
      updated.id,
      updated,
      meta?.deviceId
    )

    return updated
  })
}

export async function deleteBatch(id: string, meta?: { deviceId?: string; username?: string }) {
  const deleted = await prisma.$transaction(async (tx) => {
    const existing = await tx.batch.findUnique({
      where: { id },
      include: { medicine: true },
    })
    if (!existing) return null

    // Record stock deduction in ledger before deletion if quantity > 0
    if (existing.quantity > 0) {
      await recordStockMovement(tx, {
        productId: existing.medicineId,
        batchId: existing.id,
        quantityDelta: -existing.quantity,
        movementType: 'ADJUSTMENT_OUT',
        referenceType: 'ADJUSTMENT',
        referenceId: existing.id,
        unitCost: existing.medicine?.cost,
        deviceId: meta?.deviceId,
        notes: `Batch ${existing.batchNumber} deleted from system`,
      })
    }

    await tx.saleItem.deleteMany({ where: { batchId: id } })
    const deletedBatchRecord = await tx.batch.delete({ where: { id } })

    await tx.auditLog.create({
      data: {
        id: randomUUID(),
        action: 'BATCH_DELETE',
        category: 'INVENTORY',
        details: `Batch "${existing.batchNumber}" (${existing.medicine?.name}) was deleted (remaining stock was ${existing.quantity})`,
        username: meta?.username || 'ADMIN',
        userRole: 'ADMIN',
        severity: 'CRITICAL',
        deviceId: meta?.deviceId || null,
        metadata: JSON.stringify({ batchId: id, batchNumber: existing.batchNumber, lastStock: existing.quantity }),
      },
    })

    await enqueueOutboxItem(
      tx,
      'BATCH',
      'DELETE',
      id,
      { id, medicineId: existing.medicineId },
      meta?.deviceId
    )

    return deletedBatchRecord
  })

  if (deleted) {
    flushOutboxBatch(50).catch(() => {})
  }

  return deleted
}

// ─── Categories ─────────────────────────────────────────────────────────────

export async function getCategories() {
  return await prisma.category.findMany({
    include: { medicines: true },
    orderBy: { name: 'asc' },
  })
}

export async function createCategory(data: { name: string }) {
  return await prisma.category.create({ data })
}

export async function updateCategory(id: string, data: { name: string }) {
  return await prisma.category.update({ where: { id }, data })
}

export async function deleteCategory(id: string) {
  return await prisma.category.delete({ where: { id } })
}

// ─── Customers ──────────────────────────────────────────────────────────────

export async function getCustomers() {
  return await prisma.customer.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function createCustomer(data: { name: string; phone?: string }) {
  return await prisma.customer.create({ data })
}

export async function updateCustomer(id: string, data: { name: string; phone?: string }) {
  return await prisma.customer.update({ where: { id }, data })
}

export async function deleteCustomer(id: string) {
  return await prisma.customer.delete({ where: { id } })
}

// ─── Suppliers ──────────────────────────────────────────────────────────────

export async function getSuppliers() {
  return await prisma.supplier.findMany({
    orderBy: { name: 'asc' },
  })
}

export async function createSupplier(data: any) {
  return await prisma.supplier.create({ data })
}

export async function updateSupplier(id: string, data: any) {
  return await prisma.supplier.update({ where: { id }, data })
}

export async function deleteSupplier(id: string) {
  return await prisma.supplier.delete({ where: { id } })
}

// ─── Settings ───────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Record<string, string>> {
  const rows = await prisma.setting.findMany()
  const map: Record<string, string> = {}
  for (const r of rows) map[r.key] = r.value
  return map
}

export async function setSettings(updates: Record<string, string>) {
  return await prisma.$transaction(async (tx) => {
    for (const [key, value] of Object.entries(updates)) {
      await tx.setting.upsert({
        where: { key },
        update: { value: String(value) },
        create: { key, value: String(value) },
      })
    }
  })
}
