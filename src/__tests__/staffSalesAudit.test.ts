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

describe('Staff Sales Audit & Activity Details Suite', () => {
  beforeEach(async () => {
    storageMap.clear()
    storageMap.set('sml_coldstore_medicines', JSON.stringify([
      { id: 'med-audit-1', name: 'Tilapia Medium Box', sku: 'SKU-TIL-01', price: 120, cost: 90 }
    ]))
    storageMap.set('sml_coldstore_batches', JSON.stringify([
      { id: 'batch-audit-1', medicineId: 'med-audit-1', batchNumber: 'LOT-TIL-01', quantity: 100, expiryDate: '2028-06-01' }
    ]))
  })

  it('1. Successfully records sale with specific staff cashier attribution', async () => {
    const sale = await mobileApi.createSale({
      paymentMethod: 'CASH',
      total: 240,
      cashier: 'kwame',
      items: [
        { batchId: 'batch-audit-1', quantity: 2, price: 120 }
      ]
    })

    expect(sale).toBeDefined()
    expect(sale.cashier).toBe('kwame')
    expect(sale.total).toBe(240)

    const salesList = await mobileApi.getSales()
    const found = salesList.find((s: any) => s.id === sale.id)
    expect(found).toBeDefined()
    expect(found.cashier).toBe('kwame')
  })

  it('2. Automatically creates friendly audit log entry with cashier identity', async () => {
    await mobileApi.createSale({
      paymentMethod: 'MOBILE',
      total: 600,
      cashier: 'ama_cashier',
      items: [
        { batchId: 'batch-audit-1', quantity: 5, price: 120 }
      ]
    })

    const logs = await mobileApi.getAuditLogs()
    const saleLog = logs.find((l) => l.action === 'HIGH_VALUE_SALE' && l.username === 'ama_cashier')

    expect(saleLog).toBeDefined()
    expect(saleLog?.username).toBe('ama_cashier')
    expect(saleLog?.details).toContain('ama_cashier')
    expect(saleLog?.details).toContain('GH₵600.00')

    const meta = JSON.parse(saleLog?.metadata || '{}')
    expect(meta.cashier).toBe('ama_cashier')
    expect(meta.total).toBe(600)
    expect(meta.paymentMethod).toBe('MOBILE')
  })

  it('3. Differentiates sales across multiple staff members for till audit', async () => {
    // Sale by Kwesi
    await mobileApi.createSale({
      paymentMethod: 'CASH',
      total: 120,
      cashier: 'kwesi',
      items: [{ batchId: 'batch-audit-1', quantity: 1, price: 120 }]
    })

    // Sale by Ama
    await mobileApi.createSale({
      paymentMethod: 'MOBILE',
      total: 360,
      cashier: 'ama',
      items: [{ batchId: 'batch-audit-1', quantity: 3, price: 120 }]
    })

    const allSales = await mobileApi.getSales()
    const kwesiSales = allSales.filter((s: any) => s.cashier === 'kwesi')
    const amaSales = allSales.filter((s: any) => s.cashier === 'ama')

    expect(kwesiSales.length).toBe(1)
    expect(kwesiSales[0].total).toBe(120)

    expect(amaSales.length).toBe(1)
    expect(amaSales[0].total).toBe(360)
  })
})
