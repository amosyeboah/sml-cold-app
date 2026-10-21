import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  pushLocalStorageToCloudIfAvailable,
  fetchCloudSalesIfAvailable
} from '../services/api/mobileStorage'
import * as supabaseClientModule from '../services/sync/supabaseClient'

describe('Self-Healing Cloud Sync & Safety Net', () => {
  const mockStorage: Record<string, string> = {}

  beforeEach(() => {
    // Reset virtual localStorage
    for (const k in mockStorage) delete mockStorage[k]

    vi.stubGlobal('localStorage', {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => { mockStorage[key] = val },
      removeItem: (key: string) => { delete mockStorage[key] },
      clear: () => { for (const k in mockStorage) delete mockStorage[k] },
    })
    ;(globalThis as any).__TEST_ONLINE__ = true
  })

  afterEach(() => {
    delete (globalThis as any).__TEST_ONLINE__
  })

  it('correctly registers synced sale IDs and pushes local-only sales', async () => {
    const localSales = [
      { id: 'sale-1', total: 80, paymentMethod: 'CASH', items: [] },
      { id: 'sale-2', total: 100, paymentMethod: 'CASH', items: [] },
      { id: 'sale-3', total: 160, paymentMethod: 'MOBILE', items: [] },
      { id: 'sale-4', total: 130, paymentMethod: 'CASH', items: [] }, // The 4th local sale
    ]
    mockStorage['sofiyem_coldstore_sales'] = JSON.stringify(localSales)

    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'cloud_sales') {
          return {
            select: vi.fn().mockResolvedValue({
              data: [{ id: 'sale-1' }, { id: 'sale-2' }, { id: 'sale-3' }],
              error: null,
            }),
            upsert: upsertMock,
          }
        }
        if (table === 'cloud_sale_items') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) }
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }),
    }

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    const res = await pushLocalStorageToCloudIfAvailable()

    // It should have identified sale-4 as missing in cloud and pushed it!
    expect(res.pushedSales).toBe(1)
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'sale-4',
        total_amount: 130,
        payment_method: 'CASH',
      })
    )

    // Synced sale IDs should now contain sale-4
    const synced = JSON.parse(mockStorage['sofiyem_coldstore_synced_sale_ids'] || '[]')
    expect(synced).toContain('sale-4')
  })

  it('automatically triggers background push when localOnlySales are found during fetchCloudSalesIfAvailable', async () => {
    const localSales = [
      { id: 'sale-cloud-1', total: 100, paymentMethod: 'CASH', date: new Date().toISOString() },
      { id: 'sale-local-missing', total: 130, paymentMethod: 'CASH', date: new Date().toISOString() },
    ]
    mockStorage['sofiyem_coldstore_sales'] = JSON.stringify(localSales)

    const upsertMock = vi.fn().mockResolvedValue({ error: null })
    const mockClient = {
      from: vi.fn((table: string) => {
        if (table === 'cloud_sales') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: [{ id: 'sale-cloud-1', total_amount: 100, payment_method: 'CASH' }],
                error: null,
              }),
            }),
            upsert: upsertMock,
          }
        }
        if (table === 'cloud_sale_items') {
          return {
            select: vi.fn().mockResolvedValue({ data: [], error: null }),
            upsert: vi.fn().mockResolvedValue({ error: null }),
          }
        }
        return { select: vi.fn().mockResolvedValue({ data: [], error: null }) }
      }),
    }

    vi.spyOn(supabaseClientModule, 'getSupabaseClient').mockReturnValue(mockClient as any)

    const result = await fetchCloudSalesIfAvailable()
    expect(result.length).toBe(2)
    expect(result.some((s) => s.id === 'sale-local-missing')).toBe(true)
  })
})
