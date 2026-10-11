import { describe, it, expect, beforeEach } from 'vitest'

const storageMap = new Map<string, string>()
if (typeof globalThis.localStorage === 'undefined') {
  ;(globalThis as any).localStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => { storageMap.set(key, String(value)) },
    removeItem: (key: string) => { storageMap.delete(key) },
    clear: () => { storageMap.clear() },
    key: (index: number) => Array.from(storageMap.keys())[index] ?? null,
    get length() { return storageMap.size },
  }
}

import { mobileApi } from '../services/api/mobileStorage'
import * as inventoryService from '../hub/services/inventoryService'

describe('Cashier Access Restrictions & Permissions', () => {
  beforeEach(async () => {
    storageMap.clear()
    await mobileApi.seedInitialDataIfNeeded()
  })

  it('1. Cashier is strictly blocked from editing a customer profile in mobile storage', async () => {
    const customer = await mobileApi.createCustomer({
      name: 'Cashier Edit Test Customer',
      phone: '055-111-2233',
    })

    // Attempting edit as CASHIER should reject
    await expect(
      mobileApi.updateCustomer(customer.id, { name: 'Attempted Change' }, 'CASHIER')
    ).rejects.toThrow('Cashiers are not permitted to edit customer data')

    // Customer name remains untouched
    const customers = await mobileApi.getCustomers()
    const found = customers.find((c: any) => c.id === customer.id)
    expect(found.name).toBe('Cashier Edit Test Customer')
  })

  it('2. Cashier is strictly blocked from deleting a customer in mobile storage', async () => {
    const customer = await mobileApi.createCustomer({
      name: 'Cashier Delete Test Customer',
      phone: '055-999-8877',
    })

    // Attempting delete as CASHIER should reject
    await expect(
      mobileApi.deleteCustomer(customer.id, 'CASHIER')
    ).rejects.toThrow('Cashiers are not permitted to delete customer data')

    // Customer still exists
    const customers = await mobileApi.getCustomers()
    const found = customers.find((c: any) => c.id === customer.id)
    expect(found).toBeDefined()
  })

  it('3. Admin and Manager can update and delete customers without restriction', async () => {
    const customer = await mobileApi.createCustomer({
      name: 'Admin Permission Test Customer',
      phone: '024-555-6677',
    })

    // Admin update succeeds
    const updated = await mobileApi.updateCustomer(
      customer.id,
      { name: 'Admin Updated Customer' },
      'ADMIN'
    )
    expect(updated.name).toBe('Admin Updated Customer')

    // Admin delete succeeds
    await mobileApi.deleteCustomer(customer.id, 'ADMIN')
    const customers = await mobileApi.getCustomers()
    const found = customers.find((c: any) => c.id === customer.id)
    expect(found).toBeUndefined()
  })

  it('4. Inventory service blocks customer edits and deletions when userRole is CASHIER', async () => {
    await expect(
      inventoryService.updateCustomer('cust_dummy_id', { name: 'New Name' }, { userRole: 'CASHIER' })
    ).rejects.toThrow('Cashiers are not permitted to edit customer data')

    await expect(
      inventoryService.deleteCustomer('cust_dummy_id', { userRole: 'CASHIER' })
    ).rejects.toThrow('Cashiers are not permitted to delete customer data')
  })
})
