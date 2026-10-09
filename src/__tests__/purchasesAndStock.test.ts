import { describe, it, expect, beforeEach, beforeAll } from 'vitest'

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

describe('Purchases & Stock Receiving Workflow', () => {
  beforeEach(async () => {
    storageMap.clear()
    await mobileApi.seedInitialDataIfNeeded()
    storageMap.set('sml_coldstore_suppliers', JSON.stringify([
      { id: 'sup-test-1', name: 'Test Cold Supplier Ltd', contact: '0241234567' }
    ]))
    storageMap.set('sml_coldstore_medicines', JSON.stringify([
      { id: 'prod-test-1', name: 'Test Whole Chicken', sku: 'TST-CHK-01', price: 85, cost: 58, minStockLevel: 10 }
    ]))
    storageMap.set('sml_coldstore_batches', JSON.stringify([]))
  })

  it('1. Successfully retrieves seeded suppliers and products', async () => {
    const suppliers = await mobileApi.getSuppliers()
    expect(suppliers.length).toBeGreaterThanOrEqual(1)

    const medicines = await mobileApi.getMedicines()
    expect(medicines.length).toBeGreaterThanOrEqual(1)
  })

  it('2. Records supplier purchases cost and updates batch stock when goods are received', async () => {
    const medicines = await mobileApi.getMedicines()
    const targetMed = medicines[0]

    const initialBatches = await mobileApi.getBatches()
    const initialBatchCount = initialBatches
      .filter(b => b.medicineId === targetMed.id)
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)

    const suppliers = await mobileApi.getSuppliers()
    const targetSup = suppliers[0]

    // Create purchase order for 25 cartons at cost ₵75.50
    const purchaseData = {
      supplierId: targetSup.id,
      total: 25 * 75.50,
      items: [
        {
          medicineId: targetMed.id,
          quantity: 25,
          cost: 75.50,
          batchNumber: 'TEST-PURCHASE-BATCH-01',
          expiryDate: '2028-12-31T00:00:00.000Z',
        }
      ]
    }

    const createdPurchase = await mobileApi.createPurchase(purchaseData)
    expect(createdPurchase).toBeDefined()
    expect(createdPurchase.status).toBe('RECEIVED')
    expect(createdPurchase.total).toBe(25 * 75.50)

    // Check that batch stock was created and incremented
    const updatedBatches = await mobileApi.getBatches()
    const newBatch = updatedBatches.find(b => b.medicineId === targetMed.id && b.batchNumber === 'TEST-PURCHASE-BATCH-01')
    expect(newBatch).toBeDefined()
    expect(newBatch?.quantity).toBe(25)
    expect(newBatch?.cost).toBe(75.50)

    // Check that total stock for the medicine increased by 25
    const updatedBatchCount = updatedBatches
      .filter(b => b.medicineId === targetMed.id)
      .reduce((sum, b) => sum + (Number(b.quantity) || 0), 0)
    expect(updatedBatchCount).toBe(initialBatchCount + 25)

    // Check that medicine cost in catalogue was updated with latest supplier purchase cost
    const updatedMeds = await mobileApi.getMedicines()
    const updatedTargetMed = updatedMeds.find(m => m.id === targetMed.id)
    expect(updatedTargetMed?.cost).toBe(75.50)
  })

  it('3. Increments existing batch quantity when receiving more of the same lot/batch', async () => {
    const medicines = await mobileApi.getMedicines()
    const targetMed = medicines[0]
    const suppliers = await mobileApi.getSuppliers()

    // Receive first shipment: 10 cartons
    await mobileApi.createPurchase({
      supplierId: suppliers[0].id,
      items: [
        {
          medicineId: targetMed.id,
          quantity: 10,
          cost: 60.00,
          batchNumber: 'MULTI-RECEIPT-LOT',
          expiryDate: '2028-10-15T00:00:00.000Z',
        }
      ]
    })

    // Receive second shipment of the same lot: 15 cartons
    await mobileApi.createPurchase({
      supplierId: suppliers[0].id,
      items: [
        {
          medicineId: targetMed.id,
          quantity: 15,
          cost: 60.00,
          batchNumber: 'MULTI-RECEIPT-LOT',
          expiryDate: '2028-10-15T00:00:00.000Z',
        }
      ]
    })

    const batches = await mobileApi.getBatches()
    const batch = batches.find(b => b.medicineId === targetMed.id && b.batchNumber === 'MULTI-RECEIPT-LOT')
    expect(batch).toBeDefined()
    expect(batch?.quantity).toBe(25) // 10 + 15
  })

  it('4. Reverts received stock when a purchase order is deleted', async () => {
    const medicines = await mobileApi.getMedicines()
    const targetMed = medicines[0]
    const suppliers = await mobileApi.getSuppliers()

    const purchase = await mobileApi.createPurchase({
      supplierId: suppliers[0].id,
      items: [
        {
          medicineId: targetMed.id,
          quantity: 50,
          cost: 45.00,
          batchNumber: 'TEMP-LOT-TO-DELETE',
          expiryDate: '2028-05-01T00:00:00.000Z',
        }
      ]
    })

    let batches = await mobileApi.getBatches()
    let batch = batches.find(b => b.batchNumber === 'TEMP-LOT-TO-DELETE')
    expect(batch?.quantity).toBe(50)

    // Delete purchase
    await mobileApi.deletePurchase(purchase.id)

    batches = await mobileApi.getBatches()
    batch = batches.find(b => b.batchNumber === 'TEMP-LOT-TO-DELETE')
    expect(batch?.quantity).toBe(0)

    const purchases = await mobileApi.getPurchases()
    expect(purchases.some(p => p.id === purchase.id)).toBe(false)
  })
})
