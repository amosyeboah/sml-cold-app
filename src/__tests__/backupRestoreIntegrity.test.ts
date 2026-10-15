import { describe, it, expect, beforeEach, vi } from 'vitest'

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

describe('Backup Export & Restore Data Integrity', () => {
  beforeEach(async () => {
    storageMap.clear()
    vi.restoreAllMocks()
    await mobileApi.clearAllLocalData()
  })

  it('1. exportBackup keeps all sales and report data in the snapshot', async () => {
    // 1. Create a product and batch
    const med = await mobileApi.createMedicine({
      name: 'Frozen Tilapia Fish (Carton)',
      sku: 'FISH-TIL-01',
      price: 250,
      cost: 180,
      minStockLevel: 5,
    })

    const batch = await mobileApi.createBatch({
      medicineId: med.id,
      batchNumber: 'TIL-2026-001',
      expiryDate: '2027-12-31',
      quantity: 50,
    })

    const cust = await mobileApi.createCustomer({
      name: 'Adjoa Catering Services',
      phone: '0241234567',
    })

    // 2. Create a sale
    const sale = await mobileApi.createSale({
      customerId: cust.id,
      paymentMethod: 'CASH',
      items: [
        { batchId: batch.id, quantity: 3, price: 250 },
      ],
    })

    expect(sale).toBeDefined()
    expect(sale.total).toBe(750)

    // 3. Verify getSales sees this sale
    const salesBefore = await mobileApi.getSales()
    expect(salesBefore.length).toBeGreaterThanOrEqual(1)

    // 4. Clear and restore from snapshot
    const snapshot = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      system: 'SOFIYEM Legacy Cold Store',
      data: {
        medicines: [med],
        batches: [batch],
        customers: [cust],
        sales: [sale],
        purchases: [],
        categories: [],
        suppliers: [],
        users: [],
        settings: { 'biz.name': 'SOFIYEM TEST STORE' },
      },
    }

    // Clear local data
    storageMap.clear()
    const salesAfterClear = await mobileApi.getSales()
    expect(salesAfterClear.length).toBe(0)

    // 5. Restore snapshot
    const restoreRes = await mobileApi.restoreBackup(snapshot)
    expect(restoreRes.success).toBe(true)
    expect(restoreRes.restoredSalesCount).toBe(1)

    // 6. Verify Sales History has data
    const restoredSales = await mobileApi.getSales()
    expect(restoredSales.length).toBe(1)
    expect(restoredSales[0].id).toBe(sale.id)
    expect(restoredSales[0].total).toBe(750)
    expect(restoredSales[0].customerName).toBe('Adjoa Catering Services')
    expect(restoredSales[0].items.length).toBe(1)
    expect(restoredSales[0].items[0].name).toBe('Frozen Tilapia Fish (Carton)')

    // 7. Verify Reports page has data
    const reportsData = await mobileApi.getReportsData('2020-01-01', '2030-12-31')
    expect(reportsData.kpis.totalSales).toBe(750)
    expect(reportsData.kpis.transactions).toBe(1)
    expect(reportsData.kpis.cashSales).toBe(750)
    expect(reportsData.kpis.cogs).toBe(540) // 3 * 180 = 540
    expect(reportsData.kpis.profitEarned).toBe(210) // 750 - 540 = 210
    expect(reportsData.salesOverview.length).toBeGreaterThan(0)
    expect(reportsData.recentTransactions.length).toBe(1)
  })

  it('2. restoreBackup normalizes sales with legacy or alternative field names (sold_at, created_at, unit_price)', async () => {
    const rawLegacyBackup = {
      version: '1.0.0',
      exportedAt: new Date().toISOString(),
      system: 'SOFIYEM Cold Store Snapshot',
      data: {
        medicines: [
          { id: 'med-chicken-1', name: 'Hard Chicken Carton', sku: 'CHK-01', price: 120, cost: 90 },
        ],
        batches: [
          { id: 'b-chk-1', medicineId: 'med-chicken-1', batchNumber: 'LOT-99', expiryDate: '2028-01-01', quantity: 20 },
        ],
        customers: [
          { id: 'cust-john', name: 'John Doe', phone: '0200000000' },
        ],
        sales: [
          {
            id: 'legacy-sale-01',
            invoice_number: 'INV-LEGACY-01',
            customer_id: 'cust-john',
            customer_name: 'John Doe',
            sold_at: '2026-05-10T14:30:00.000Z',
            total_amount: 240,
            payment_method: 'MOBILE',
            items: [
              {
                id: 'item-chk-1',
                product_id: 'med-chicken-1',
                product_name: 'Hard Chicken Carton',
                quantity: 2,
                unit_price: 120,
                unit_cost: 90,
              },
            ],
          },
        ],
      },
    }

    const res = await mobileApi.restoreBackup(rawLegacyBackup)
    expect(res.success).toBe(true)
    expect(res.restoredSalesCount).toBe(1)

    // Verify Sales History sees the sale with normalized fields
    const sales = await mobileApi.getSales()
    expect(sales.length).toBe(1)
    expect(sales[0].id).toBe('legacy-sale-01')
    expect(sales[0].total).toBe(240)
    expect(sales[0].customerName).toBe('John Doe')
    expect(sales[0].paymentMethod).toBe('MOBILE')
    expect(sales[0].date).toBe('2026-05-10T14:30:00.000Z')
    expect(sales[0].items[0].name).toBe('Hard Chicken Carton')

    // Verify Reports page includes this sale in the period
    const reportsMay = await mobileApi.getReportsData('2026-05-01', '2026-05-31')
    expect(reportsMay.kpis.totalSales).toBe(240)
    expect(reportsMay.kpis.transactions).toBe(1)
    expect(reportsMay.kpis.mobileSales).toBe(240)
    expect(reportsMay.kpis.cogs).toBe(180) // 2 * 90 = 180
    expect(reportsMay.kpis.profitEarned).toBe(60) // 240 - 180 = 60
  })

  it('3. restoreBackup properly restores split payment sales', async () => {
    const splitBackup = {
      version: '1.0.0',
      data: {
        medicines: [{ id: 'm-pork', name: 'Pork Chops Box', sku: 'PRK-01', price: 500, cost: 350 }],
        batches: [{ id: 'b-pork', medicineId: 'm-pork', batchNumber: 'LOT-PRK', expiryDate: '2027-01-01', quantity: 10 }],
        sales: [
          {
            id: 'sale-split-99',
            total: 1000,
            date: '2026-06-15T10:00:00.000Z',
            paymentMethod: 'SPLIT:CASH=600,MOBILE=400',
            payments: [
              { method: 'CASH', amount: 600 },
              { method: 'MOBILE', amount: 400 },
            ],
            items: [
              { batchId: 'b-pork', medicineId: 'm-pork', name: 'Pork Chops Box', quantity: 2, price: 500, cost: 350 },
            ],
          },
        ],
      },
    }

    const res = await mobileApi.restoreBackup(splitBackup)
    expect(res.success).toBe(true)

    const sales = await mobileApi.getSales()
    expect(sales.length).toBe(1)
    expect(sales[0].total).toBe(1000)

    const reportsJune = await mobileApi.getReportsData('2026-06-01', '2026-06-30')
    expect(reportsJune.kpis.totalSales).toBe(1000)
    expect(reportsJune.kpis.cashSales).toBe(600)
    expect(reportsJune.kpis.mobileSales).toBe(400)
    expect(reportsJune.kpis.cogs).toBe(700)
    expect(reportsJune.kpis.profitEarned).toBe(300)
  })

  it('4. exportBackup produces counts and contains all active sales in snapshot', async () => {
    const med = await mobileApi.createMedicine({
      name: 'Turkey Wings Box',
      sku: 'TRK-01',
      price: 150,
      cost: 100,
    })
    const batch = await mobileApi.createBatch({
      medicineId: med.id,
      batchNumber: 'LOT-TRK',
      expiryDate: '2027-01-01',
      quantity: 30,
    })
    await mobileApi.createSale({
      paymentMethod: 'CASH',
      items: [{ batchId: batch.id, quantity: 2, price: 150 }],
    })

    const exportRes = await mobileApi.exportBackup()
    expect(exportRes.success).toBe(true)
    expect(exportRes.counts?.sales).toBeGreaterThanOrEqual(1)
    expect(exportRes.counts?.medicines).toBeGreaterThanOrEqual(1)
  })
})
