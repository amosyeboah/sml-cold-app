import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock localStorage for test runner
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

describe('Comprehensive Calculation Rules Audit & Verification', () => {
  beforeEach(() => {
    storageMap.clear()
    vi.restoreAllMocks()
  })

  // 1. Gross Profit: Ensure Gross Profit = Net Sales − COGS
  it('1. Gross Profit: strictly calculates Gross Profit = Net Sales − COGS', async () => {
    const medicines = [
      { id: 'm-1', name: 'Frozen Salmon (Carton)', price: 300, cost: 200, stockQuantity: 50 },
    ]
    const batches = [
      { id: 'b-1', medicineId: 'm-1', batchNumber: 'SAL-01', quantity: 50, costPrice: 200, expiryDate: '2028-01-01' },
    ]
    const today = new Date().toISOString()
    const sales = [
      {
        id: 'sale-1',
        date: today,
        total: 1500, // 5 * 300
        items: [
          { id: 'item-1', batchId: 'b-1', medicineId: 'm-1', name: 'Frozen Salmon (Carton)', quantity: 5, price: 300, cost: 200 },
        ],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    const kpis = data.kpis

    // Net Sales = 1500, COGS = 5 * 200 = 1000
    expect(kpis.netSales).toBe(1500)
    expect(kpis.cogs).toBe(1000)
    // Gross Profit = Net Sales - COGS = 500
    expect(kpis.grossProfit).toBe(500)
    expect(kpis.profitEarned).toBe(500)
    expect(kpis.grossProfit).toBe(kpis.netSales - kpis.cogs)
  })

  // 2. Sales Reconciliation: Dashboard sales and itemized product revenue match with GH₵0 difference
  it('2. Sales Reconciliation: reconciles unitemized POS difference (e.g. GH₵3,700) so Dashboard sales = Itemized revenue', async () => {
    const medicines = [
      { id: 'm-1', name: 'Pork Chops (Carton)', price: 200, cost: 140, stockQuantity: 30 },
    ]
    const batches = [
      { id: 'b-1', medicineId: 'm-1', batchNumber: 'PC-01', quantity: 30, costPrice: 140, expiryDate: '2028-01-01' },
    ]
    const today = new Date().toISOString()
    const sales = [
      // Standard itemized sale: 10 * 200 = 2000
      {
        id: 'sale-1',
        date: today,
        total: 2000,
        items: [
          { id: 'it-1', batchId: 'b-1', medicineId: 'm-1', name: 'Pork Chops (Carton)', quantity: 10, price: 200, cost: 140 },
        ],
      },
      // Direct POS / Quick walk-in sales without catalog item line entries totaling GH₵3,700
      {
        id: 'sale-unitemized-1',
        date: today,
        total: 3700,
        items: [],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')

    // Dashboard total sales: 2000 + 3700 = 5700
    expect(data.kpis.totalSales).toBe(5700)

    // Sum of all itemized revenues in profitBreakdown
    const sumItemizedRevenue = (data.profitBreakdown || []).reduce((sum, p) => sum + p.revenue, 0)

    // Guaranteed to match exactly: difference = 0
    expect(sumItemizedRevenue).toBe(data.kpis.totalSales)
    expect(data.kpis.salesReconciliation.difference).toBe(0)
    expect(data.kpis.salesReconciliation.isReconciled).toBe(true)

    // Reconciliation row must exist for the unitemized GH₵3,700
    const reconRow = data.profitBreakdown?.find(p => p.id === 'unitemized-sales-reconciliation')
    expect(reconRow).toBeDefined()
    expect(reconRow?.revenue).toBe(3700)
  })

  // 3. COGS Calculation: Multi-batch sales use the actual cost of each batch consumed
  it('3. COGS Calculation: computes weighted actual batch cost when stock is sold from multiple batches', async () => {
    const medicines = [
      { id: 'm-chick', name: 'Whole Chicken (Box)', price: 100, cost: 50, stockQuantity: 20 },
    ]
    // Batch 1 has 4 units @ GH₵50 cost; Batch 2 has 10 units @ GH₵60 cost
    const batches = [
      { id: 'b-old', medicineId: 'm-chick', batchNumber: 'CH-OLD', quantity: 4, costPrice: 50, expiryDate: '2026-06-01' },
      { id: 'b-new', medicineId: 'm-chick', batchNumber: 'CH-NEW', quantity: 10, costPrice: 60, expiryDate: '2026-12-01' },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify([]))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    // Sell 10 boxes: FEFO will consume 4 boxes from b-old (@ GH₵50 = 200) and 6 boxes from b-new (@ GH₵60 = 360)
    // Total COGS = 200 + 360 = 560. Weighted actual unit cost = 560 / 10 = GH₵56.00
    const createdSale = await mobileApi.createSale({
      paymentMethod: 'CASH',
      total: 1000, // 10 * 100
      items: [
        {
          batchId: 'b-old',
          medicineId: 'm-chick',
          name: 'Whole Chicken (Box)',
          quantity: 10,
          price: 100,
        } as any,
      ],
    })

    expect(createdSale.items[0].cost).toBe(56)
    expect(createdSale.items[0].unitCost).toBe(56)

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    expect(data.kpis.cogs).toBe(560)
    expect(data.kpis.grossProfit).toBe(1000 - 560) // 440
  })

  // 4. Daily Profit: Do not use purchases as a substitute for COGS when COGS is zero
  it('4. Daily Profit: does NOT substitute purchases for COGS when daily COGS is zero', async () => {
    const medicines = [
      { id: 'm-1', name: 'Ice Cream Tub', price: 50, cost: 0, stockQuantity: 100 },
    ]
    const today = new Date().toISOString()
    // Day has GH₵1,000 in sales, 0 COGS, and GH₵5,000 in bulk restocking purchases
    const sales = [
      {
        id: 's-1',
        date: today,
        total: 1000,
        items: [
          { id: 'it-1', medicineId: 'm-1', name: 'Ice Cream Tub', quantity: 20, price: 50, cost: 0 },
        ],
      },
    ]
    const purchases = [
      {
        id: 'p-1',
        date: today,
        total: 5000,
        items: [{ medicineId: 'm-1', quantity: 100, cost: 50 }],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify([]))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify(purchases))

    const data = await mobileApi.getReportsData(today.slice(0, 10), today.slice(0, 10))
    const todayOverview = data.salesOverview[0]

    expect(todayOverview.sales).toBe(1000)
    expect(todayOverview.purchases).toBe(5000)
    expect(todayOverview.cogs).toBe(0)
    // Daily profit MUST be daySales - dayCogs = 1000 - 0 = 1000, NOT daySales - dayPurchases = -4000
    expect(todayOverview.profit).toBe(1000)
    expect(todayOverview.profit).not.toBe(-4000)
  })

  // 5. Profit Margin: Calculate correctly as (Gross Profit ÷ Net Sales) × 100
  it('5. Profit Margin: calculates correctly as (Gross Profit / Net Sales) * 100', async () => {
    const medicines = [
      { id: 'm-1', name: 'Shrimp Pack', price: 200, cost: 150, stockQuantity: 10 },
    ]
    const today = new Date().toISOString()
    const sales = [
      {
        id: 's-1',
        date: today,
        total: 1000, // 5 * 200
        items: [
          { id: 'it-1', medicineId: 'm-1', name: 'Shrimp Pack', quantity: 5, price: 200, cost: 150 },
        ],
      },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify([]))
    storageMap.set('sml_coldstore_sales', JSON.stringify(sales))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    // Net Sales = 1000, COGS = 750, Gross Profit = 250
    // Margin = (250 / 1000) * 100 = 25.0%
    expect(data.kpis.profitMargin).toBe(25)
  })

  // 6. Expected Inventory Profit: Do not force negative expected profits to zero
  it('6. Expected Inventory Profit: allows negative expected profits when cost exceeds selling price', async () => {
    // Clearance item bought at GH₵150 but selling at GH₵100 (GH₵50 loss per unit)
    const medicines = [
      { id: 'm-clearance', name: 'Mackerel Clearance (Box)', price: 100, cost: 150, stockQuantity: 10 },
    ]
    const batches = [
      { id: 'b-clearance', medicineId: 'm-clearance', batchNumber: 'CLR-01', quantity: 10, costPrice: 150, expiryDate: '2026-05-01' },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify([]))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    // Stock cost = 10 * 150 = 1500; Retail = 10 * 100 = 1000
    // Expected Profit = 1000 - 1500 = -500 (NOT 0!)
    expect(data.kpis.profitsExpected).toBe(-500)
    expect(data.kpis.profitsExpected).toBeLessThan(0)

    const item = data.profitBreakdown?.find(p => p.id === 'm-clearance')
    expect(item?.expectedProfit).toBe(-500)

    const invItem = data.inventoryReport.items.find(i => i.id === 'm-clearance')
    expect(invItem?.potentialProfit).toBe(-500)
    expect(data.inventoryReport.totalPotentialProfit).toBe(-500)
  })

  // 7. Inventory Valuation: Calculate stock value using correct batch inventory costs, not just latest purchase cost
  it('7. Inventory Valuation: accurately values stock using individual batch costs across all active batches', async () => {
    const medicines = [
      // med.cost is 120 (latest cost), but older batch cost was 80
      { id: 'm-beef', name: 'Beef Ribs (Carton)', price: 150, cost: 120, stockQuantity: 20 },
    ]
    const batches = [
      { id: 'b-1', medicineId: 'm-beef', batchNumber: 'BR-01', quantity: 10, costPrice: 80, expiryDate: '2027-01-01' },
      { id: 'b-2', medicineId: 'm-beef', batchNumber: 'BR-02', quantity: 10, costPrice: 120, expiryDate: '2028-01-01' },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify([]))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    const data = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    // True valuation: (10 * 80) + (10 * 120) = 800 + 1200 = 2000
    // (If it had used med.cost 120 for all 20 units, it would be 2400)
    expect(data.kpis.inventoryCost).toBe(2000)
    expect(data.inventoryReport.totalCostValue).toBe(2000)

    const invItem = data.inventoryReport.items.find(i => i.id === 'm-beef')
    expect(invItem?.totalCostValue).toBe(2000)
    expect(invItem?.unitCost).toBe(100) // weighted average: 2000 / 20 = 100
  })

  // 8. Refund Calculations: Ensure refunds correctly adjust sales, profit, COGS, and restore stock
  it('8. Refund Calculations: restores batch quantity, medicine catalog stock, and removes sale from reports', async () => {
    const medicines = [
      { id: 'm-duck', name: 'Duck Whole (Box)', price: 180, cost: 110, stockQuantity: 15 },
    ]
    const batches = [
      { id: 'b-duck', medicineId: 'm-duck', batchNumber: 'DK-01', quantity: 15, costPrice: 110, expiryDate: '2027-01-01' },
    ]

    storageMap.set('sml_coldstore_medicines', JSON.stringify(medicines))
    storageMap.set('sml_coldstore_batches', JSON.stringify(batches))
    storageMap.set('sml_coldstore_sales', JSON.stringify([]))
    storageMap.set('sml_coldstore_purchases', JSON.stringify([]))

    // 1. Complete sale of 5 ducks
    const sale = await mobileApi.createSale({
      paymentMethod: 'CASH',
      total: 900, // 5 * 180
      items: [
        {
          batchId: 'b-duck',
          medicineId: 'm-duck',
          name: 'Duck Whole (Box)',
          quantity: 5,
          price: 180,
        } as any,
      ],
    })

    // Verify stock is deducted to 10 on both batch and medicine catalog
    let updatedMeds = await mobileApi.getMedicines()
    let updatedBatches = await mobileApi.getBatches()
    const duckMed = updatedMeds.find(m => m.id === 'm-duck')
    const duckBatch = updatedBatches.find(b => b.id === 'b-duck')
    expect(duckMed?.stockQuantity).toBe(10)
    expect(duckBatch?.quantity).toBe(10)

    // Check report with sale present
    let rep = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    expect(rep.kpis.totalSales).toBe(900)
    expect(rep.kpis.cogs).toBe(550) // 5 * 110
    expect(rep.kpis.grossProfit).toBe(350)

    // 2. Refund the sale
    const refundResult = await mobileApi.refundSale(sale.id)
    expect(refundResult.success).toBe(true)

    // Verify stock is restored to 15 on both batch and medicine catalog
    updatedMeds = await mobileApi.getMedicines()
    updatedBatches = await mobileApi.getBatches()
    const restoredMed = updatedMeds.find(m => m.id === 'm-duck')
    const restoredBatch = updatedBatches.find(b => b.id === 'b-duck')
    expect(restoredMed?.stockQuantity).toBe(15)
    expect(restoredBatch?.quantity).toBe(15)

    // Check report post-refund: sales, COGS, and profit return to 0
    rep = await mobileApi.getReportsData('2026-01-01', '2026-12-31')
    expect(rep.kpis.totalSales).toBe(0)
    expect(rep.kpis.cogs).toBe(0)
    expect(rep.kpis.grossProfit).toBe(0)
  })
})
