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

describe('Authentication & Password Security Verification', () => {
  beforeEach(async () => {
    storageMap.clear()
    await mobileApi.seedInitialDataIfNeeded()
  })

  it('rejects login when wrong password is provided for admin', async () => {
    // 1. Totally incorrect password
    await expect(mobileApi.login('admin', 'wrongpassword')).rejects.toThrow('Invalid username or password')

    // 2. Entering username as password (common mistake / insecure fallback)
    await expect(mobileApi.login('admin', 'admin')).rejects.toThrow('Invalid username or password')

    // 3. Entering PIN as password
    await expect(mobileApi.login('admin', '1111')).rejects.toThrow('Invalid username or password')

    // 4. Entering another user role's password (e.g., cashier's password for admin)
    await expect(mobileApi.login('admin', 'cashier123')).rejects.toThrow('Invalid username or password')
  }, 45000)

  it('rejects login when wrong password is provided for cashier or manager', async () => {
    await expect(mobileApi.login('cashier', 'cashier')).rejects.toThrow('Invalid username or password')
    await expect(mobileApi.login('cashier', '1234')).rejects.toThrow('Invalid username or password')
    await expect(mobileApi.login('cashier', 'admin1234')).rejects.toThrow('Invalid username or password')

    await expect(mobileApi.login('manager', 'manager')).rejects.toThrow('Invalid username or password')
    await expect(mobileApi.login('manager', '2222')).rejects.toThrow('Invalid username or password')
    await expect(mobileApi.login('manager', 'admin1234')).rejects.toThrow('Invalid username or password')
  }, 45000)

  it('allows login only with exact, correct password', async () => {
    const admin = await mobileApi.login('admin', 'admin1234')
    expect(admin).toBeDefined()
    expect(admin.role).toBe('ADMIN')

    const cashier = await mobileApi.login('cashier', 'cashier123')
    expect(cashier).toBeDefined()
    expect(cashier.role).toBe('CASHIER')

    const manager = await mobileApi.login('manager', 'manager123')
    expect(manager).toBeDefined()
    expect(manager.role).toBe('MANAGER')
  }, 45000)

  it('strictly validates PIN codes and rejects invalid PINs even when role chip is selected', async () => {
    // Cashier role selected, but invalid PIN entered
    await expect(mobileApi.loginWithPin('9999', 'CASHIER')).rejects.toThrow('Invalid PIN code')
    await expect(mobileApi.loginWithPin('0000', 'CASHIER')).rejects.toThrow('Invalid PIN code')
    await expect(mobileApi.loginWithPin('1111', 'CASHIER')).rejects.toThrow('Invalid PIN code')

    // Admin role selected, but invalid PIN entered
    await expect(mobileApi.loginWithPin('1234', 'ADMIN')).rejects.toThrow('Invalid PIN code')
    await expect(mobileApi.loginWithPin('0000', 'ADMIN')).rejects.toThrow('Invalid PIN code')

    // Manager role selected, but invalid PIN entered
    await expect(mobileApi.loginWithPin('1234', 'MANAGER')).rejects.toThrow('Invalid PIN code')

    // Valid PIN codes
    const admin = await mobileApi.loginWithPin('1111', 'ADMIN')
    expect(admin.role).toBe('ADMIN')

    const cashier = await mobileApi.loginWithPin('1234', 'CASHIER')
    expect(cashier.role).toBe('CASHIER')

    const manager = await mobileApi.loginWithPin('2222', 'MANAGER')
    expect(manager.role).toBe('MANAGER')
  }, 25000)

  it('revokes old default PIN immediately when a user updates their PIN code', async () => {
    const users = await mobileApi.getUsers()
    const adminUser = users.find((u: any) => u.username === 'admin')
    expect(adminUser).toBeDefined()

    // 1. Initial PIN 1111 works
    const initialLogin = await mobileApi.loginWithPin('1111', 'ADMIN')
    expect(initialLogin.role).toBe('ADMIN')

    // 2. Admin changes their PIN to 7890
    await mobileApi.updateUser(adminUser.id, { pin: '7890' })

    // 3. New PIN 7890 works
    const newPinLogin = await mobileApi.loginWithPin('7890', 'ADMIN')
    expect(newPinLogin.role).toBe('ADMIN')

    // 4. Old default PIN 1111 MUST be rejected both with and without role filter
    await expect(mobileApi.loginWithPin('1111', 'ADMIN')).rejects.toThrow('Invalid PIN code')
    await expect(mobileApi.loginWithPin('1111')).rejects.toThrow('Invalid PIN code')
  }, 25000)
})
