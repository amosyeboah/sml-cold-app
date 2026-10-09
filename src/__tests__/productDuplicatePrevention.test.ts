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

describe('Product Duplicate Prevention Suite', () => {
  beforeEach(() => {
    storageMap.clear()
    storageMap.set('sml_coldstore_medicines', JSON.stringify([]))
  })

  it('1. Successfully creates a new unique product', async () => {
    const med = await mobileApi.createMedicine({
      name: 'Atlantic Salmon (Frozen)',
      sku: 'SKU-SALMON-001',
      price: 250,
      cost: 200,
      categoryId: 'cat_fish',
    })

    expect(med).toBeDefined()
    expect(med.name).toBe('Atlantic Salmon (Frozen)')
    expect(med.sku).toBe('SKU-SALMON-001')
  })

  it('2. Prevents creating duplicate product with identical name (case-insensitive & trimmed)', async () => {
    await mobileApi.createMedicine({
      name: 'Atlantic Salmon (Frozen)',
      sku: 'SKU-SALMON-001',
      price: 250,
      cost: 200,
    })

    // Attempt duplicate with lowercase and whitespace
    await expect(
      mobileApi.createMedicine({
        name: '  atlantic salmon (frozen)  ',
        sku: 'SKU-SALMON-002',
        price: 260,
        cost: 210,
      })
    ).rejects.toThrow(/already exists/i)
  })

  it('3. Prevents creating duplicate product with identical SKU (case-insensitive & trimmed)', async () => {
    await mobileApi.createMedicine({
      name: 'Atlantic Salmon (Frozen)',
      sku: 'SKU-SALMON-001',
      price: 250,
      cost: 200,
    })

    // Attempt duplicate SKU with different name
    await expect(
      mobileApi.createMedicine({
        name: 'Norwegian Salmon Box',
        sku: '  sku-salmon-001  ',
        price: 280,
        cost: 220,
      })
    ).rejects.toThrow(/already exists/i)
  })

  it('4. Prevents updating an existing product to conflict with another product name', async () => {
    const medA = await mobileApi.createMedicine({
      name: 'Tilapia Medium Box',
      sku: 'SKU-TILAPIA-01',
      price: 180,
      cost: 140,
    })

    const medB = await mobileApi.createMedicine({
      name: 'Mackerel Standard',
      sku: 'SKU-MACK-01',
      price: 190,
      cost: 150,
    })

    // Attempt to rename medB to match medA
    await expect(
      mobileApi.updateMedicine(medB.id, {
        name: 'tilapia medium box',
      })
    ).rejects.toThrow(/already exists/i)

    // Updating medB with its own name should succeed
    const updatedB = await mobileApi.updateMedicine(medB.id, {
      name: 'Mackerel Standard',
      price: 195,
    })
    expect(updatedB.price).toBe(195)
  })

  it('5. Prevents updating an existing product to conflict with another product SKU', async () => {
    const medA = await mobileApi.createMedicine({
      name: 'Chicken Wings 10kg',
      sku: 'SKU-WINGS-01',
      price: 210,
      cost: 170,
    })

    const medB = await mobileApi.createMedicine({
      name: 'Chicken Gizzard 10kg',
      sku: 'SKU-GIZZARD-01',
      price: 220,
      cost: 180,
    })

    // Attempt to change medB SKU to match medA
    await expect(
      mobileApi.updateMedicine(medB.id, {
        sku: 'SKU-WINGS-01',
      })
    ).rejects.toThrow(/already exists/i)
  })
})
