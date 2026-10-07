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

describe('Purchase Report History System', () => {
  beforeEach(async () => {
    storageMap.clear()
    await mobileApi.seedInitialDataIfNeeded()
  })

  it('1. Generates purchase history within getReportsData with full line item details', async () => {
    const medicines = await mobileApi.getMedicines()
    const suppliers = await mobileApi.getSuppliers()

    expect(medicines.length).toBeGreaterThan(0)
    expect(suppliers.length).toBeGreaterThan(0)

    const med1 = medicines[0]
    const sup1 = suppliers[0]

    // Create a purchase record
    const createdPurchase = await mobileApi.createPurchase({
      supplierId: sup1.id,
      total: 30 * 45,
      items: [
        {
          medicineId: med1.id,
          quantity: 30,
          cost: 45,
          batchNumber: 'LOT-REP-001',
          expiryDate: '2028-11-30T00:00:00.000Z',
        },
      ],
    })

    expect(createdPurchase).toBeDefined()
    expect(createdPurchase.id).toBeDefined()

    // Fetch reports data for wide range covering today
    const reportData = await mobileApi.getReportsData('2020-01-01', '2030-12-31')

    expect(reportData).toBeDefined()
    expect(reportData.kpis.totalPurchases).toBeGreaterThanOrEqual(1350)

    // Verify purchases history in report
    const purchaseInReport = reportData.purchases.find((p) => p.id === createdPurchase.id)
    expect(purchaseInReport).toBeDefined()
    expect(purchaseInReport?.supplier).toBe(sup1.name)
    expect(purchaseInReport?.total).toBe(1350)
    expect(purchaseInReport?.itemsCount).toBe(1)
    expect(purchaseInReport?.totalQuantity).toBe(30)
    expect(purchaseInReport?.items?.[0].medicineName).toBe(med1.name)
    expect(purchaseInReport?.items?.[0].batchNumber).toBe('LOT-REP-001')
    expect(purchaseInReport?.items?.[0].quantity).toBe(30)
    expect(purchaseInReport?.items?.[0].cost).toBe(45)
  })

  it('2. Correctly accumulates multiple purchase orders in the report summary', async () => {
    const medicines = await mobileApi.getMedicines()
    const suppliers = await mobileApi.getSuppliers()

    const med = medicines[0]
    const sup = suppliers[0]

    await mobileApi.createPurchase({
      supplierId: sup.id,
      total: 10 * 50,
      items: [
        {
          medicineId: med.id,
          quantity: 10,
          cost: 50,
          batchNumber: 'BATCH-A',
          expiryDate: '2028-06-01T00:00:00.000Z',
        },
      ],
    })

    await mobileApi.createPurchase({
      supplierId: sup.id,
      total: 20 * 60,
      items: [
        {
          medicineId: med.id,
          quantity: 20,
          cost: 60,
          batchNumber: 'BATCH-B',
          expiryDate: '2028-08-01T00:00:00.000Z',
        },
      ],
    })

    const reportData = await mobileApi.getReportsData('2020-01-01', '2030-12-31')
    expect(reportData.purchases.length).toBeGreaterThanOrEqual(2)

    const totalReportSpend = reportData.purchases.reduce((s, p) => s + (p.total || 0), 0)
    expect(totalReportSpend).toBeGreaterThanOrEqual(500 + 1200)

    const totalReportUnits = reportData.purchases.reduce((s, p) => s + (p.totalQuantity || 0), 0)
    expect(totalReportUnits).toBeGreaterThanOrEqual(30)
  })
})
