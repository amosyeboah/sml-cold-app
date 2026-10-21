import { describe, it, expect } from 'vitest'
import {
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
  checkUserPermission,
  parsePermissionsMap,
  SETTINGS_KEY_USER_PERMISSIONS,
  CATEGORY_CONFIG,
  canUserAlterPermissions,
  canUserChangeRole,
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

  it('6. Permission categories have distinct color schemes and configurations', () => {
    const categories = ['pos', 'sales', 'inventory', 'purchases', 'customers', 'reports', 'system'] as const
    for (const cat of categories) {
      const config = CATEGORY_CONFIG[cat]
      expect(config).toBeDefined()
      expect(config.color).toBeTruthy()
      expect(config.accentColor).toMatch(/^#/)
      expect(config.badgeBg).toBeTruthy()
      expect(config.badgeText).toBeTruthy()
      expect(config.switchBg).toBeTruthy()
      expect(config.tabActive).toBeTruthy()
      expect(config.iconName).toBeTruthy()
    }

    // Verify distinct colors for POS (emerald) vs Sales (indigo)
    expect(CATEGORY_CONFIG.pos.color).toBe('emerald')
    expect(CATEGORY_CONFIG.sales.color).toBe('indigo')
    expect(CATEGORY_CONFIG.pos.accentColor).not.toBe(CATEGORY_CONFIG.sales.accentColor)
  })

  it('7. Cashier or Manager cannot alter their own permissions to become Admin (Self-alteration blocked)', () => {
    const cashierActor = { id: 'csh-1', username: 'john.cashier', role: 'CASHIER' }
    const managerActor = { id: 'mgr-1', username: 'mary.manager', role: 'MANAGER' }

    // Cashier attempting to alter their own permissions
    const cashierSelfCheck = canUserAlterPermissions(cashierActor, cashierActor)
    expect(cashierSelfCheck.allowed).toBe(false)
    expect(cashierSelfCheck.reason).toContain('Cashiers and Managers cannot alter their own permissions to become Admin')

    // Manager attempting to alter their own permissions
    const managerSelfCheck = canUserAlterPermissions(managerActor, managerActor)
    expect(managerSelfCheck.allowed).toBe(false)
    expect(managerSelfCheck.reason).toContain('Cashiers and Managers cannot alter their own permissions to become Admin')

    // Admin CAN alter their own or any permissions
    const adminActor = { id: 'admin-1', username: 'admin', role: 'ADMIN' }
    const adminSelfCheck = canUserAlterPermissions(adminActor, adminActor)
    expect(adminSelfCheck.allowed).toBe(true)
  })

  it('8. Cashier or Manager cannot alter an Administrator account or grant Admin-only permissions', () => {
    const managerActor = { id: 'mgr-1', username: 'mary.manager', role: 'MANAGER' }
    const adminTarget = { id: 'admin-1', username: 'admin', role: 'ADMIN' }
    const cashierTarget = { id: 'csh-2', username: 'other.cashier', role: 'CASHIER' }

    // Manager attempting to modify an Admin user
    const adminModCheck = canUserAlterPermissions(managerActor, adminTarget)
    expect(adminModCheck.allowed).toBe(false)
    expect(adminModCheck.reason).toContain('Only an Administrator can modify Administrator permissions')

    // Manager attempting to grant admin-only permissions (e.g. settings.edit) to another cashier
    const escalateCheck = canUserAlterPermissions(managerActor, cashierTarget, ['pos.access', 'settings.edit'])
    expect(escalateCheck.allowed).toBe(false)
    expect(escalateCheck.reason).toContain('Cashiers and Managers cannot grant administrative privileges or become Admin')

    // Admin can grant admin-only permissions
    const adminActor = { id: 'admin-1', username: 'admin', role: 'ADMIN' }
    const adminGrantCheck = canUserAlterPermissions(adminActor, cashierTarget, ['settings.edit'])
    expect(adminGrantCheck.allowed).toBe(true)
  })

  it('9. Cashier or Manager cannot change user role to Admin', () => {
    const managerActor = { id: 'mgr-1', username: 'mary.manager', role: 'MANAGER' }
    const cashierActor = { id: 'csh-1', username: 'john.cashier', role: 'CASHIER' }
    const otherTarget = { id: 'csh-2', username: 'other.cashier', role: 'CASHIER' }

    // Cashier attempting to promote themselves to ADMIN
    const selfPromoteCheck = canUserChangeRole(cashierActor, cashierActor, 'ADMIN')
    expect(selfPromoteCheck.allowed).toBe(false)
    expect(selfPromoteCheck.reason).toContain('Cashiers and Managers cannot alter their own role to become Admin')

    // Manager attempting to promote someone else to ADMIN
    const promoteCheck = canUserChangeRole(managerActor, otherTarget, 'ADMIN')
    expect(promoteCheck.allowed).toBe(false)
    expect(promoteCheck.reason).toContain('Cashiers and Managers cannot assign the Admin role')

    // Admin CAN assign ADMIN role
    const adminActor = { id: 'admin-1', username: 'admin', role: 'ADMIN' }
    const adminAssignCheck = canUserChangeRole(adminActor, otherTarget, 'ADMIN')
    expect(adminAssignCheck.allowed).toBe(true)
  })
})
