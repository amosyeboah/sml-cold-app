import { describe, it, expect, beforeEach } from 'vitest'

// Mock browser localStorage for node test runner
const storageMap = new Map<string, string>()
const mockLocalStorage = {
  getItem: (k: string) => storageMap.get(k) || null,
  setItem: (k: string, v: string) => storageMap.set(k, String(v)),
  removeItem: (k: string) => storageMap.delete(k),
  clear: () => storageMap.clear(),
  length: 0,
  key: () => null,
}

if (typeof globalThis.localStorage === 'undefined') {
  Object.defineProperty(globalThis, 'localStorage', {
    value: mockLocalStorage,
    writable: true,
  })
}

import { mobileApi } from '../services/api/mobileStorage'

describe('Audit Trail Recording for Deletions, Edits, and Major Activities', () => {
  beforeEach(async () => {
    storageMap.clear()
    await mobileApi.seedInitialDataIfNeeded()
  })

  it('1. Records audit logs for Customer creation, edit, and deletion', async () => {
    // Create customer
    const newCust = await mobileApi.createCustomer({
      name: 'Audit Test Customer',
      phone: '0241234567',
    })
    expect(newCust.id).toBeDefined()

    let logs = await mobileApi.getAuditLogs()
    const createLog = logs.find(l => l.action === 'CUSTOMER_CREATE' && l.details.includes('Audit Test Customer'))
    expect(createLog).toBeDefined()
    expect(createLog?.category).toBe('SALES')

    // Update customer
    await mobileApi.updateCustomer(newCust.id, {
      name: 'Updated Test Customer',
      phone: '0249999999',
    })

    logs = await mobileApi.getAuditLogs()
    const updateLog = logs.find(l => l.action === 'CUSTOMER_UPDATE' && l.details.includes('Audit Test Customer'))
    expect(updateLog).toBeDefined()

    // Delete customer
    await mobileApi.deleteCustomer(newCust.id)

    logs = await mobileApi.getAuditLogs()
    const deleteLog = logs.find(l => l.action === 'CUSTOMER_DELETE' && l.details.includes('Updated Test Customer'))
    expect(deleteLog).toBeDefined()
    expect(deleteLog?.severity).toBe('WARNING')
  })

  it('2. Records audit logs for Supplier creation, edit, and deletion', async () => {
    // Create supplier
    const newSup = await mobileApi.createSupplier({
      name: 'Audit Test Supplier Ltd',
      contact: 'Mr. Test',
      email: 'vendor@audit.com',
    })
    expect(newSup.id).toBeDefined()

    let logs = await mobileApi.getAuditLogs()
    const createLog = logs.find(l => l.action === 'SUPPLIER_CREATE' && l.details.includes('Audit Test Supplier Ltd'))
    expect(createLog).toBeDefined()
    expect(createLog?.category).toBe('PURCHASES')

    // Update supplier
    await mobileApi.updateSupplier(newSup.id, {
      name: 'Updated Supplier Ltd',
      contact: 'Mrs. Updated',
    })

    logs = await mobileApi.getAuditLogs()
    const updateLog = logs.find(l => l.action === 'SUPPLIER_UPDATE' && l.details.includes('Audit Test Supplier Ltd'))
    expect(updateLog).toBeDefined()

    // Delete supplier
    await mobileApi.deleteSupplier(newSup.id)

    logs = await mobileApi.getAuditLogs()
    const deleteLog = logs.find(l => l.action === 'SUPPLIER_DELETE' && l.details.includes('Updated Supplier Ltd'))
    expect(deleteLog).toBeDefined()
    expect(deleteLog?.severity).toBe('WARNING')
  })

  it('3. Records audit logs for Product creation, price changes, and deletion', async () => {
    // Create product
    const newMed = await mobileApi.createMedicine({
      name: 'Audit Cold Fish Box',
      sku: 'AUDIT-FISH-01',
      price: 150,
      cost: 110,
    })
    expect(newMed.id).toBeDefined()

    let logs = await mobileApi.getAuditLogs()
    const createLog = logs.find(l => l.action === 'PRODUCT_CREATE' && l.details.includes('Audit Cold Fish Box'))
    expect(createLog).toBeDefined()

    // Update product price
    await mobileApi.updateMedicine(newMed.id, {
      price: 175,
    })

    logs = await mobileApi.getAuditLogs()
    const priceLog = logs.find(l => l.action === 'PRICE_CHANGE' && l.details.includes('150') && l.details.includes('175'))
    expect(priceLog).toBeDefined()

    // Delete product
    await mobileApi.deleteMedicine(newMed.id)

    logs = await mobileApi.getAuditLogs()
    const deleteLog = logs.find(l => l.action === 'PRODUCT_DELETE' && l.details.includes('Audit Cold Fish Box'))
    expect(deleteLog).toBeDefined()
    expect(deleteLog?.severity).toBe('CRITICAL')
  })

  it('4. Records audit logs for Purchase orders (restock, update, deletion)', async () => {
    const suppliers = await mobileApi.getSuppliers()
    const medicines = await mobileApi.getMedicines()

    const purchase = await mobileApi.createPurchase({
      supplierId: suppliers[0].id,
      total: 1200,
      items: [
        {
          medicineId: medicines[0].id,
          quantity: 20,
          cost: 60,
          batchNumber: 'AUDIT-PO-01',
          expiryDate: '2028-06-30T00:00:00.000Z',
        },
      ],
    })

    let logs = await mobileApi.getAuditLogs()
    const receiveLog = logs.find(l => l.action === 'BATCH_RECEIVE' && l.details.includes('1200.00'))
    expect(receiveLog).toBeDefined()
    expect(receiveLog?.category).toBe('PURCHASES')

    // Update purchase
    await mobileApi.updatePurchase(purchase.id, {
      total: 1300,
    })

    logs = await mobileApi.getAuditLogs()
    const updateLog = logs.find(l => l.action === 'PURCHASE_UPDATE' && l.details.includes(purchase.id.slice(0, 8)))
    expect(updateLog).toBeDefined()

    // Delete purchase
    await mobileApi.deletePurchase(purchase.id)

    logs = await mobileApi.getAuditLogs()
    const deleteLog = logs.find(l => l.action === 'PURCHASE_DELETE' && l.details.includes(purchase.id.slice(0, 8)))
    expect(deleteLog).toBeDefined()
  })

  it('5. Records audit logs for POS sales and refunds', async () => {
    const batches = await mobileApi.getBatches()
    const validBatch = batches.find(b => b.quantity > 5) || batches[0]

    const sale = await mobileApi.createSale({
      paymentMethod: 'CASH',
      items: [{ batchId: validBatch.id, quantity: 2, price: 50 }],
      total: 100,
    })

    let logs = await mobileApi.getAuditLogs()
    const saleLog = logs.find(l => (l.action === 'POS_SALE' || l.action === 'HIGH_VALUE_SALE') && l.details.includes('100.00'))
    expect(saleLog).toBeDefined()

    // Refund sale
    await mobileApi.refundSale(sale.id)

    logs = await mobileApi.getAuditLogs()
    const refundLog = logs.find(l => l.action === 'SALE_REFUND' && l.details.includes(sale.id.slice(0, 8)))
    expect(refundLog).toBeDefined()
  })

  it('6. Records audit logs for Staff User creations, updates, and deletions', async () => {
    const newUser = await mobileApi.createUser({
      username: 'audit_operator',
      password: 'password123',
      role: 'CASHIER',
    })

    let logs = await mobileApi.getAuditLogs()
    const createLog = logs.find(l => l.action === 'USER_CREATE' && l.details.includes('audit_operator'))
    expect(createLog).toBeDefined()

    await mobileApi.updateUser(newUser.id, {
      role: 'MANAGER',
    })

    logs = await mobileApi.getAuditLogs()
    const updateLog = logs.find(l => l.action === 'USER_UPDATE' && l.details.includes('audit_operator'))
    expect(updateLog).toBeDefined()

    await mobileApi.deleteUser(newUser.id)

    logs = await mobileApi.getAuditLogs()
    const deleteLog = logs.find(l => l.action === 'USER_DELETE' && l.details.includes('audit_operator'))
    expect(deleteLog).toBeDefined()
    expect(deleteLog?.severity).toBe('CRITICAL')
  })
})
