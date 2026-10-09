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

describe('Profit and Loss Report Calculations', () => {
  beforeEach(() => {
    storageMap.clear()
    vi.restoreAllMocks()
  })

  it('calculates COGS, Profit Earned, and Profits Expected accurately', async () => {
    // 1. Setup sample medicines
    const medicines = [
      {
        id: 'med-1',
        name: 'Fish Tilapia (Box)',
        categoryName: 'Frozen Fish',
        price: 150, // Selling price
        cost: 100,  // Purchase cost
        stockQuantity: 20,
      },
      {
        id: 'med-2',
        name: 'Chicken Thighs (Carton)',
        categoryName: 'Frozen Poultry',
        price: 220,
        cost: 160,
        stockQuantity: 10,
      },
    ]

    // 2. Setup active batches in cold store
    const batches = [
      {
        id: 'batch-1',
        medicineId: 'med-1',
        batchNumber: 'B-TIL-01',
        quantity: 20,
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'batch-2',
        medicineId: 'med-2',
        batchNumber: 'B-CHK-01',
        quantity: 10,
        expiryDate: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    // 3. Setup sales in current period
    const today = new Date().toISOString()
    const sales = [
      {
        id: 'sale-1',
        date: today,
        total: 750, // 5 boxes * 150
        paymentMethod: 'CASH',
        items: [
          {
            id: 'item-1',
            batchId: 'batch-1',
            medicineId: 'med-1',
            name: 'Fish Tilapia (Box)',
            quantity: 5,
            price: 150,
            cost: 100,
          },
        ],
      },
      {
        id: 'sale-2',
        date: today,
        total: 660, // 3 cartons * 220
        paymentMethod: 'MOBILE',
        items: [
          {
            id: 'item-2',
            batchId: 'batch-2',
            medicineId: 'med-2',
            name: 'Chicken Thighs (Carton)',
            quantity: 3,
            price: 220,
            cost: 160,
          },
        ],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const reportsData = await mobileApi.getReportsData(startDate, endDate)
    const kpis = reportsData.kpis

    // Verify Sales Revenue: 750 + 660 = 1410
    expect(kpis.totalSales).toBe(1410)

    // Verify COGS: (5 * 100) + (3 * 160) = 500 + 480 = 980
    expect(kpis.cogs).toBe(980)

    // Verify Profit Earned (Realized Gross Profit): 1410 - 980 = 430
    expect(kpis.profitEarned).toBe(430)

    // Verify Profit Margin: (430 / 1410) * 100 ~ 30.5%
    expect(kpis.profitMargin).toBeCloseTo(30.5, 1)

    // Verify Cold Store Stock Cost: (20 * 100) + (10 * 160) = 2000 + 1600 = 3600
    expect(kpis.inventoryCost).toBe(3600)

    // Verify Expected Inventory Revenue: (20 * 150) + (10 * 220) = 3000 + 2200 = 5200
    expect(kpis.expectedInventoryRevenue).toBe(5200)

    // Verify Profits Expected on remaining stock: 5200 - 3600 = 1600
    expect(kpis.profitsExpected).toBe(1600)

    // Verify Product Profit Breakdown itemization
    expect(reportsData.profitBreakdown).toBeDefined()
    const tilapia = reportsData.profitBreakdown?.find(p => p.id === 'med-1')
    expect(tilapia).toBeDefined()
    expect(tilapia?.quantitySold).toBe(5)
    expect(tilapia?.revenue).toBe(750)
    expect(tilapia?.cogs).toBe(500)
    expect(tilapia?.profitEarned).toBe(250)
    expect(tilapia?.currentStock).toBe(20)
    expect(tilapia?.stockCost).toBe(2000)
    expect(tilapia?.expectedProfit).toBe(1000) // 20 * (150 - 100)

    const chicken = reportsData.profitBreakdown?.find(p => p.id === 'med-2')
    expect(chicken).toBeDefined()
    expect(chicken?.quantitySold).toBe(3)
    expect(chicken?.revenue).toBe(660)
    expect(chicken?.cogs).toBe(480)
    expect(chicken?.profitEarned).toBe(180)
    expect(chicken?.currentStock).toBe(10)
    expect(chicken?.stockCost).toBe(1600)
    expect(chicken?.expectedProfit).toBe(600) // 10 * (220 - 160)
  })

  it('calculates getDashboardStats gross profit accurately without deducting inventory bulk purchases', async () => {
    const medicines = [
      { id: 'm-1', name: 'Tilapia Fish', price: 95, cost: 62, stockQuantity: 50 },
    ]
    const batches = [
      { id: 'b-1', medicineId: 'm-1', batchNumber: 'T-01', quantity: 50, expiryDate: '2028-01-01' },
    ]
    const today = new Date().toISOString()
    // Sale of 10 items @ 95 = 950 revenue. COGS is 10 * 62 = 620. Gross profit earned = 950 - 620 = 330.
    const sales = [
      {
        id: 's-1',
        date: today,
        total: 950,
        items: [
          { id: 'item-1', batchId: 'b-1', medicineId: 'm-1', name: 'Tilapia Fish', quantity: 10, price: 95, cost: 62 },
        ],
      },
    ]
    // A large restocking purchase order of 20,000 to stock cold store freezers
    const purchases = [
      {
        id: 'p-1',
        date: today,
        total: 20000,
        items: [{ name: 'Tilapia Fish Bulk', quantity: 200, unitCost: 100, totalCost: 20000 }],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify(purchases))

    const stats = await mobileApi.getDashboardStats()

    // Revenue MTD should be 950
    expect(stats.mtdRevenue).toBe(950)
    // Gross Profit must be positive earned profit (950 - 620 = 330), NOT negative (950 - 20000 = -19050)
    expect(stats.mtdGrossProfit).toBe(330)
    expect(stats.mtdGrossProfit).toBeGreaterThan(0)
  })

  it('flushes outbox without Maximum call stack size exceeded recursion', async () => {
    (globalThis as any).window = globalThis
    ;(globalThis as any).window.api = mobileApi

    const res = await mobileApi.flushSyncOutbox(50)
    expect(res).toBeDefined()
    expect(typeof res.success).toBe('boolean')
    expect(res.attempted).toBeGreaterThanOrEqual(0)
  })
})
