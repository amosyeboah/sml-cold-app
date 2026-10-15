import { describe, it, expect } from 'vitest'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
  checkUserPermission,
  parsePermissionsMap,
  SETTINGS_KEY_USER_PERMISSIONS,
} from '@/services/permissions'

describe('User Permissions & Granular Access Control', () => {
  it('1. Admin / Store Owner has unrestricted master access to all permissions', () => {
    const adminUser = { id: 'admin-1', username: 'admin', role: 'ADMIN' }
    const perms = resolveUserPermissions(adminUser, {})

    expect(perms.length).toBe(ALL_PERMISSIONS.length)
    expect(checkUserPermission(adminUser, 'pos.refund', {})).toBe(true)
    expect(checkUserPermission(adminUser, 'reports.view', {})).toBe(true)
    expect(checkUserPermission(adminUser, 'settings.edit', {})).toBe(true)
    expect(checkUserPermission(adminUser, 'backup.manage', {})).toBe(true)
  })

  it('2. Manager and Cashier default to their respective baseline role permissions', () => {
    const managerUser = { id: 'mgr-1', username: 'k.manager', role: 'MANAGER' }
    const cashierUser = { id: 'csh-1', username: 'j.cashier', role: 'CASHIER' }

    // Manager default access
    expect(checkUserPermission(managerUser, 'pos.access', {})).toBe(true)
    expect(checkUserPermission(managerUser, 'reports.view', {})).toBe(true)
    expect(checkUserPermission(managerUser, 'products.create_edit', {})).toBe(true)
    // Sensitive admin-only defaults are restricted
    expect(checkUserPermission(managerUser, 'backup.manage', {})).toBe(false)
    expect(checkUserPermission(managerUser, 'settings.edit', {})).toBe(false)

    // Cashier default access
    expect(checkUserPermission(cashierUser, 'pos.access', {})).toBe(true)
    expect(checkUserPermission(cashierUser, 'sales_history.view', {})).toBe(true)
    // By default, sensitive cashier operations are not permitted until granted
    expect(checkUserPermission(cashierUser, 'pos.refund', {})).toBe(false)
    expect(checkUserPermission(cashierUser, 'pos.discount', {})).toBe(false)
    expect(checkUserPermission(cashierUser, 'reports.view', {})).toBe(false)
  })

  it('3. Owner / Admin can grant specific permissions to a Cashier', () => {
    const cashierUser = { id: 'csh-10', username: 'ama.cashier', role: 'CASHIER' }

    // Admin grants "pos.discount", "pos.refund", and "reports.view" to ama.cashier
    const customPermissionsMap = {
      'csh-10': [
        'pos.access',
        'sales_history.view',
        'pos.discount',
        'pos.refund',
        'reports.view',
      ],
    }

    const settings = {
      [SETTINGS_KEY_USER_PERMISSIONS]: JSON.stringify(customPermissionsMap),
    }

    expect(checkUserPermission(cashierUser, 'pos.access', settings)).toBe(true)
    expect(checkUserPermission(cashierUser, 'pos.discount', settings)).toBe(true)
    expect(checkUserPermission(cashierUser, 'pos.refund', settings)).toBe(true)
    expect(checkUserPermission(cashierUser, 'reports.view', settings)).toBe(true)
    // Other permissions remain revoked
    expect(checkUserPermission(cashierUser, 'products.create_edit', settings)).toBe(false)
    expect(checkUserPermission(cashierUser, 'backup.manage', settings)).toBe(false)
  })

  it('4. Owner / Admin can revoke specific permissions from a Manager', () => {
    const managerUser = { id: 'mgr-20', username: 'kwame.manager', role: 'MANAGER' }

    // Admin revokes "reports.view" and "purchases.create" from kwame.manager
    const defaultManagerPerms = DEFAULT_ROLE_PERMISSIONS.MANAGER
    const restrictedPerms = defaultManagerPerms.filter(
      (p) => p !== 'reports.view' && p !== 'purchases.create'
    )

    const customPermissionsMap = {
      'mgr-20': restrictedPerms,
    }

    const settings = {
      [SETTINGS_KEY_USER_PERMISSIONS]: JSON.stringify(customPermissionsMap),
    }

    expect(checkUserPermission(managerUser, 'pos.access', settings)).toBe(true)
    expect(checkUserPermission(managerUser, 'products.create_edit', settings)).toBe(true)
    // Revoked permissions are now false
    expect(checkUserPermission(managerUser, 'reports.view', settings)).toBe(false)
    expect(checkUserPermission(managerUser, 'purchases.create', settings)).toBe(false)
  })

  it('5. Safe JSON parsing of corrupt or missing user_permissions setting', () => {
    expect(parsePermissionsMap(null)).toEqual({})
    expect(parsePermissionsMap(undefined)).toEqual({})
    expect(parsePermissionsMap('invalid-json')).toEqual({})
    expect(parsePermissionsMap({ 'user-1': ['pos.access'] })).toEqual({ 'user-1': ['pos.access'] })
    expect(parsePermissionsMap(JSON.stringify({ 'user-2': ['reports.view'] }))).toEqual({
      'user-2': ['reports.view'],
    })
  })
})
