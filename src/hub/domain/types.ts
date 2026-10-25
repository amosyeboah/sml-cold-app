/**
 * Domain types and enumerations for the authoritative Local Depot Hub.
 */

export type StockMovementType =
  | 'PURCHASE'
  | 'SALE'
  | 'RETURN'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'DAMAGE'
  | 'EXPIRED'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'

export type StockReferenceType =
  | 'SALE'
  | 'PURCHASE'
  | 'ADJUSTMENT'
  | 'INITIAL'
  | 'MANUAL'
  | 'SALE_REFUND'
  | 'RETURN'

export type DeviceType = 'DESKTOP' | 'TABLET' | 'MOBILE' | 'WEB'

export type DeviceStatus = 'ACTIVE' | 'REVOKED' | 'OFFLINE'

export type SyncEntity =
  | 'SALE'
  | 'PRODUCT'
  | 'BATCH'
  | 'PURCHASE'
  | 'STOCK_MOVEMENT'
  | 'AUDIT_LOG'
  | 'CUSTOMER'
  | 'SUPPLIER'

export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE'

export type SyncOutboxStatus = 'PENDING' | 'SYNCED' | 'FAILED'

export interface DeviceInfo {
  deviceId: string
  storeId?: string
  deviceName: string
  deviceType: DeviceType
  appVersion?: string
  ipAddress?: string
}

export interface SalePaymentInput {
  method: string
  amount: number
}

export interface SaleItemInput {
  id?: string
  batchId: string
  quantity: number
  price: number
}

export interface PrescriptionInput {
  doctorName: string
  notes?: string
}

export interface CreateSaleInput {
  id?: string // Idempotency key (UUID)
  customerId?: string
  paymentMethod: string
  total: number
  items: SaleItemInput[]
  payments?: SalePaymentInput[]
  prescription?: PrescriptionInput
  deviceId?: string
  userId?: string
  username?: string
  userRole?: string
  channel?: string
  isRemoteWeb?: boolean
  notes?: string
}

export interface PurchaseItemInput {
  id?: string
  medicineId: string
  quantity: number
  cost: number
  batchNumber: string
  expiryDate: string
}

export interface CreatePurchaseInput {
  id?: string
  supplierId: string
  total: number
  items: PurchaseItemInput[]
  deviceId?: string
  userId?: string
  username?: string
  userRole?: string
}

export interface StockAdjustmentInput {
  productId: string
  batchId?: string
  quantityDelta: number
  movementType: StockMovementType
  reason: string
  unitCost?: number
  userId?: string
  username?: string
  userRole?: string
  deviceId?: string
}

export interface AuditLogInput {
  action: string
  category: string
  details: string
  username?: string
  userRole?: string
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  deviceId?: string
  metadata?: any
}
