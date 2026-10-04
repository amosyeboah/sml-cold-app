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

describe('Inventory Report System', () => {
  beforeEach(() => {
    storageMap.clear()
    vi.restoreAllMocks()
  })

  it('generates a complete inventory report with valuations, health status, and category breakdown', async () => {
    const medicines = [
      {
        id: 'med-fish-1',
        name: 'Whole Tilapia (20kg Box)',
        sku: 'SML-FSH-001',
        categoryName: 'Fish & Seafood',
        price: 250,
        cost: 180,
        minStockLevel: 15,
        stockQuantity: 40,
      },
      {
        id: 'med-poultry-1',
        name: 'Frozen Chicken Drumsticks (10kg)',
        sku: 'SML-PTR-001',
        categoryName: 'Poultry',
        price: 180,
        cost: 130,
        minStockLevel: 25,
        stockQuantity: 10, // low stock (< 25)
      },
      {
        id: 'med-beef-1',
        name: 'Boneless Beef Chuck (15kg Box)',
        sku: 'SML-BEF-001',
        categoryName: 'Beef & Mutton',
        price: 320,
        cost: 240,
        minStockLevel: 10,
        stockQuantity: 0, // out of stock
      },
    ]

    const batches = [
      {
        id: 'batch-fish-a',
        medicineId: 'med-fish-1',
        batchNumber: 'LOT-TIL-01',
        quantity: 25,
        expiryDate: new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString(),
      },
      {
        id: 'batch-fish-b',
        medicineId: 'med-fish-1',
        batchNumber: 'LOT-TIL-02',
        quantity: 15,
        expiryDate: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000).toISOString(), // expiring soon
      },
      {
        id: 'batch-poul-a',
        medicineId: 'med-poultry-1',
        batchNumber: 'LOT-CHK-01',
        quantity: 10,
        expiryDate: new Date(Date.now() + 200 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify([]))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const startDate = '2026-10-01'
    const endDate = '2026-10-31'

    const reportsData = await mobileApi.getReportsData(startDate, endDate)
    const inv = reportsData.inventoryReport

    expect(inv).toBeDefined()
    expect(inv?.totalProducts).toBe(3)
    // 40 tilapia + 10 chicken + 0 beef = 50 cartons
    expect(inv?.totalCartons).toBe(50)

    // Tilapia: 40 * 180 = 7,200 cost; 40 * 250 = 10,000 retail; profit = 2,800
    // Chicken: 10 * 130 = 1,300 cost; 10 * 180 = 1,800 retail; profit = 500
    // Beef: 0 cost, 0 retail
    // Total cost = 7200 + 1300 = 8500
    // Total retail = 10000 + 1800 = 11800
    // Total profit = 3300
    expect(inv?.totalCostValue).toBe(8500)
    expect(inv?.totalRetailValue).toBe(11800)
    expect(inv?.totalPotentialProfit).toBe(3300)

    // Health counts
    expect(inv?.healthyCount).toBe(1) // Tilapia (40 > 15)
    expect(inv?.lowStockCount).toBe(1) // Chicken (10 <= 25)
    expect(inv?.outOfStockCount).toBe(1) // Beef (0)

    // KPIs reflect inventory numbers
    expect(reportsData.kpis.inventoryCost).toBe(8500)
    expect(reportsData.kpis.expectedInventoryRevenue).toBe(11800)
    expect(reportsData.kpis.profitsExpected).toBe(3300)
    expect(reportsData.kpis.inventoryCartons).toBe(50)
    expect(reportsData.kpis.inventoryHealthyCount).toBe(1)
    expect(reportsData.kpis.inventoryLowStockCount).toBe(1)
    expect(reportsData.kpis.inventoryOutOfStockCount).toBe(1)

    // Items details
    const tilapia = inv?.items.find((i) => i.id === 'med-fish-1')
    expect(tilapia).toBeDefined()
    expect(tilapia?.currentStock).toBe(40)
    expect(tilapia?.totalCostValue).toBe(7200)
    expect(tilapia?.totalRetailValue).toBe(10000)
    expect(tilapia?.potentialProfit).toBe(2800)
    expect(tilapia?.status).toBe('IN_STOCK')
    expect(tilapia?.batchCount).toBe(2)
    expect(tilapia?.batches.length).toBe(2)

    const chicken = inv?.items.find((i) => i.id === 'med-poultry-1')
    expect(chicken).toBeDefined()
    expect(chicken?.status).toBe('LOW_STOCK')

    const beef = inv?.items.find((i) => i.id === 'med-beef-1')
    expect(beef).toBeDefined()
    expect(beef?.status).toBe('OUT_OF_STOCK')

    // Categories breakdown
    expect(inv?.categories.length).toBe(3)
    const fishCat = inv?.categories.find((c) => c.category === 'Fish & Seafood')
    expect(fishCat?.totalStock).toBe(40)
    expect(fishCat?.totalCostValue).toBe(7200)
  })
})
