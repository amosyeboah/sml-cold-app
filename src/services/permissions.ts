/**
 * Permission Definition & Access Control Engine for SOFIYEM Cold Store
 * Allows Store Owner / Admin to grant or revoke granular permissions per user or role.
 */

export type RiskLevel = 'low' | 'medium' | 'high'

export interface PermissionDefinition {
  id: string
  name: string
  description: string
  category: 'pos' | 'sales' | 'inventory' | 'purchases' | 'customers' | 'reports' | 'system'
  categoryName: string
  riskLevel: RiskLevel
}

export const PERMISSION_CATEGORIES: { id: PermissionDefinition['category']; name: string; description: string }[] = [
  {
    id: 'pos',
    name: 'Point of Sale & Register',
    description: 'Checkout counter, line-item discounts, and cashier functions',
  },
  {
    id: 'sales',
    name: 'Sales History & Records',
    description: 'Past sales ledger, refunds, voiding, and receipt reprinting',
  },
  {
    id: 'inventory',
    name: 'Products & Cold Room Inventory',
    description: 'Product catalog, carton pricing, stock recounts, and batch tracking',
  },
  {
    id: 'purchases',
    name: 'Purchases & Suppliers',
    description: 'Restock purchase orders, supplier management, and receiving goods',
  },
  {
    id: 'customers',
    name: 'Customers & Debts',
    description: 'Customer directory, credit tracking, and contact profiles',
  },
  {
    id: 'reports',
    name: 'Financial Reports & Audit',
    description: 'Profit & Loss, revenue summaries, and operator audit trail',
  },
  {
    id: 'system',
    name: 'Cloud Sync, Backup & Settings',
    description: 'Offline sync engine, database backup/restore, and system settings',
  },
]

export const ALL_PERMISSIONS: PermissionDefinition[] = [
  // ── POS ─────────────────────────────────────────────────────────────
  {
    id: 'pos.access',
    name: 'Access POS Register',
    description: 'Open the checkout screen and ring up customer sales transactions.',
    category: 'pos',
    categoryName: 'Point of Sale & Register',
    riskLevel: 'low',
  },
  {
    id: 'pos.discount',
    name: 'Apply Cart Discounts',
    description: 'Apply percentage or flat amount discounts to cart items or order total.',
    category: 'pos',
    categoryName: 'Point of Sale & Register',
    riskLevel: 'medium',
  },
  {
    id: 'pos.refund',
    name: 'Process Refunds & Returns',
    description: 'Issue refunds on previous sales and return cartons back into stock.',
    category: 'pos',
    categoryName: 'Point of Sale & Register',
    riskLevel: 'high',
  },
  {
    id: 'pos.price_override',
    name: 'Override Unit Price',
    description: 'Change the selling price of a product during an active checkout sale.',
    category: 'pos',
    categoryName: 'Point of Sale & Register',
    riskLevel: 'high',
  },

  // ── Sales ───────────────────────────────────────────────────────────
  {
    id: 'sales_history.view',
    name: 'View Sales History',
    description: 'Browse previous customer transactions, daily totals, and receipt numbers.',
    category: 'sales',
    categoryName: 'Sales History & Records',
    riskLevel: 'low',
  },
  {
    id: 'sales_history.reprint',
    name: 'Reprint Past Receipts',
    description: 'Reprint thermal or PDF customer receipts from the sales history ledger.',
    category: 'sales',
    categoryName: 'Sales History & Records',
    riskLevel: 'low',
  },
  {
    id: 'sales_history.export',
    name: 'Export Sales to CSV / Excel',
    description: 'Download historical transactions and sales records to spreadsheets.',
    category: 'sales',
    categoryName: 'Sales History & Records',
    riskLevel: 'medium',
  },
  {
    id: 'sales_history.delete',
    name: 'Void / Delete Sales Records',
    description: 'Permanently remove or cancel completed sales records from the database.',
    category: 'sales',
    categoryName: 'Sales History & Records',
    riskLevel: 'high',
  },

  // ── Inventory ───────────────────────────────────────────────────────
  {
    id: 'products.view',
    name: 'View Products Catalog',
    description: 'Browse cold store product list, inventory carton balances, and prices.',
    category: 'inventory',
    categoryName: 'Products & Cold Room Inventory',
    riskLevel: 'low',
  },
  {
    id: 'products.create_edit',
    name: 'Add & Edit Products',
    description: 'Create new cold store items, modify cost/selling prices, and update SKUs.',
    category: 'inventory',
    categoryName: 'Products & Cold Room Inventory',
    riskLevel: 'medium',
  },
  {
    id: 'products.delete',
    name: 'Delete Products from Catalog',
    description: 'Permanently remove products and their associated SKUs from the catalog.',
    category: 'inventory',
    categoryName: 'Products & Cold Room Inventory',
    riskLevel: 'high',
  },
  {
    id: 'inventory.adjust',
    name: 'Adjust Cold Store Stock',
    description: 'Perform stock adjustments for defrosting, shrinkage, damages, or recounts.',
    category: 'inventory',
    categoryName: 'Products & Cold Room Inventory',
    riskLevel: 'high',
  },
  {
    id: 'batches.view',
    name: 'Batch Tracking & Expiry',
    description: 'Track incoming lot numbers, cold store expiry dates, and batch quantities.',
    category: 'inventory',
    categoryName: 'Products & Cold Room Inventory',
    riskLevel: 'low',
  },

  // ── Purchases ───────────────────────────────────────────────────────
  {
    id: 'purchases.view',
    name: 'View Purchase Orders',
    description: 'View restock purchase history, supplier invoices, and total purchase costs.',
    category: 'purchases',
    categoryName: 'Purchases & Suppliers',
    riskLevel: 'low',
  },
  {
    id: 'purchases.create',
    name: 'Create Restock Purchases',
    description: 'Record new stock purchases from cold food importers and suppliers.',
    category: 'purchases',
    categoryName: 'Purchases & Suppliers',
    riskLevel: 'medium',
  },
  {
    id: 'purchases.delete',
    name: 'Delete / Void Purchases',
    description: 'Delete purchase orders and roll back received carton quantities.',
    category: 'purchases',
    categoryName: 'Purchases & Suppliers',
    riskLevel: 'high',
  },
  {
    id: 'suppliers.manage',
    name: 'Manage Supplier Accounts',
    description: 'Add, update contact info, or delete wholesale frozen food suppliers.',
    category: 'purchases',
    categoryName: 'Purchases & Suppliers',
    riskLevel: 'medium',
  },

  // ── Customers ───────────────────────────────────────────────────────
  {
    id: 'customers.view',
    name: 'View Customer Profiles',
    description: 'View customer directory, contact numbers, and purchase totals.',
    category: 'customers',
    categoryName: 'Customers & Debts',
    riskLevel: 'low',
  },
  {
    id: 'customers.manage',
    name: 'Create & Edit Customers',
    description: 'Add new customer accounts, update phone numbers, and record details.',
    category: 'customers',
    categoryName: 'Customers & Debts',
    riskLevel: 'low',
  },

  // ── Reports ─────────────────────────────────────────────────────────
  {
    id: 'reports.view',
    name: 'Access Financial Reports',
    description: 'View Profit & Loss, sales summaries, category revenue, and margins.',
    category: 'reports',
    categoryName: 'Financial Reports & Audit',
    riskLevel: 'medium',
  },
  {
    id: 'audit.view',
    name: 'View Security Audit Trail',
    description: 'Inspect user action history, price change logs, and security alerts.',
    category: 'reports',
    categoryName: 'Financial Reports & Audit',
    riskLevel: 'medium',
  },

  // ── System ──────────────────────────────────────────────────────────
  {
    id: 'sync.access',
    name: 'Access Offline Cloud Sync',
    description: 'View offline outbox events, session logs, and trigger cloud sync.',
    category: 'system',
    categoryName: 'Cloud Sync, Backup & Settings',
    riskLevel: 'medium',
  },
  {
    id: 'backup.manage',
    name: 'Database Backup & Restore',
    description: 'Export database backup files and restore previous snapshots.',
    category: 'system',
    categoryName: 'Cloud Sync, Backup & Settings',
    riskLevel: 'high',
  },
  {
    id: 'settings.edit',
    name: 'Manage Store Settings',
    description: 'Configure store profile, thermal receipt design, and hardware peripherals.',
    category: 'system',
    categoryName: 'Cloud Sync, Backup & Settings',
    riskLevel: 'high',
  },
  {
    id: 'users.manage',
    name: 'Manage Staff User Accounts',
    description: 'Create new cashier/manager logins, reset passwords, and edit roles.',
    category: 'system',
    categoryName: 'Cloud Sync, Backup & Settings',
    riskLevel: 'high',
  },
]

/**
 * Default permission sets by role
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  ADMIN: ALL_PERMISSIONS.map((p) => p.id),

  MANAGER: [
    'pos.access',
    'pos.discount',
    'pos.refund',
    'sales_history.view',
    'sales_history.reprint',
    'sales_history.export',
    'products.view',
    'products.create_edit',
    'inventory.adjust',
    'batches.view',
    'purchases.view',
    'purchases.create',
    'suppliers.manage',
    'customers.view',
    'customers.manage',
    'reports.view',
    'audit.view',
    'sync.access',
  ],

  CASHIER: [
    'pos.access',
    'sales_history.view',
    'sales_history.reprint',
    'customers.view',
    'customers.manage',
  ],
}

export const SETTINGS_KEY_USER_PERMISSIONS = 'user_permissions'

/**
 * Helper to safely parse user permissions map from settings string or object
 */
export function parsePermissionsMap(raw: unknown): Record<string, string[]> {
  if (!raw) return {}
  if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
    return raw as Record<string, string[]>
  }
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw)
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed as Record<string, string[]>
      }
    } catch {
      return {}
    }
  }
  return {}
}

/**
 * Resolves the effective permissions for a user
 */
export function resolveUserPermissions(
  user: { id?: string; username?: string; role?: string } | null | undefined,
  settings?: Record<string, string>
): string[] {
  if (!user) return []

  const role = (user.role || 'CASHIER').toUpperCase()

  // Admin / Owner always has all permissions
  if (role === 'ADMIN') {
    return ALL_PERMISSIONS.map((p) => p.id)
  }

  const permissionsMap = parsePermissionsMap(settings?.[SETTINGS_KEY_USER_PERMISSIONS])

  // Check if permissions customized for this specific user ID or username
  const userKey = user.id && permissionsMap[user.id] ? user.id : user.username ? user.username : null

  if (userKey && Array.isArray(permissionsMap[userKey])) {
    return permissionsMap[userKey]
  }

  // Fall back to default role permissions
  return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.CASHIER
}

/**
 * Checks if a user has a specific permission
 */
export function checkUserPermission(
  user: { id?: string; username?: string; role?: string } | null | undefined,
  permissionId: string,
  settings?: Record<string, string>
): boolean {
  if (!user) return false
  const role = (user.role || 'CASHIER').toUpperCase()
  if (role === 'ADMIN') return true

  const userPerms = resolveUserPermissions(user, settings)
  return userPerms.includes(permissionId)
}
