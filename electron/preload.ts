import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

export const api = {
  // Auth
  login: (username: string, password: string) =>
    ipcRenderer.invoke('auth:login', username, password),
  loginWithPin: (pin: string, selectedRole?: string) =>
    ipcRenderer.invoke('auth:loginWithPin', pin, selectedRole),

  // Dashboard
  getDashboardStats: () => ipcRenderer.invoke('dashboard:stats'),

  // Categories
  getCategories: () => ipcRenderer.invoke('categories:getAll'),
  createCategory: (data: { name: string }) => ipcRenderer.invoke('categories:create', data),
  updateCategory: (id: string, data: { name: string }) => ipcRenderer.invoke('categories:update', id, data),
  deleteCategory: (id: string) => ipcRenderer.invoke('categories:delete', id),

  // Medicines
  getMedicines: () => ipcRenderer.invoke('medicines:getAll'),
  createMedicine: (data: any) => ipcRenderer.invoke('medicines:create', data),
  updateMedicine: (id: string, data: any) => ipcRenderer.invoke('medicines:update', id, data),
  deleteMedicine: (id: string) => ipcRenderer.invoke('medicines:delete', id),

  // Batches
  getBatches: (startDate?: string, endDate?: string) => ipcRenderer.invoke('batches:getAll', startDate, endDate),
  createBatch: (data: any) => ipcRenderer.invoke('batches:create', data),
  updateBatch: (id: string, data: any) => ipcRenderer.invoke('batches:update', id, data),
  deleteBatch: (id: string) => ipcRenderer.invoke('batches:delete', id),

  // Suppliers
  getSuppliers: () => ipcRenderer.invoke('suppliers:getAll'),
  createSupplier: (data: any) => ipcRenderer.invoke('suppliers:create', data),
  updateSupplier: (id: string, data: any) => ipcRenderer.invoke('suppliers:update', id, data),
  deleteSupplier: (id: string) => ipcRenderer.invoke('suppliers:delete', id),

  // Customers
  getCustomers: () => ipcRenderer.invoke('customers:getAll'),
  createCustomer: (data: any) => ipcRenderer.invoke('customers:create', data),
  updateCustomer: (id: string, data: any) => ipcRenderer.invoke('customers:update', id, data),
  deleteCustomer: (id: string) => ipcRenderer.invoke('customers:delete', id),

  // Sales (POS)
  createSale: (data: any) => ipcRenderer.invoke('sales:create', data),
  getSales: () => ipcRenderer.invoke('sales:getAll'),
  refundSale: (id: string) => ipcRenderer.invoke('sales:refund', id),

  // Prescriptions
  getPrescriptions: () => ipcRenderer.invoke('prescriptions:getAll'),

  // Purchases
  getPurchases: () => ipcRenderer.invoke('purchases:getAll'),
  createPurchase: (data: any) => ipcRenderer.invoke('purchases:create', data),
  updatePurchase: (id: string, data: any) => ipcRenderer.invoke('purchases:update', id, data),
  deletePurchase: (id: string) => ipcRenderer.invoke('purchases:delete', id),

  // Users
  getUsers: () => ipcRenderer.invoke('users:getAll'),
  createUser: (data: any) => ipcRenderer.invoke('users:create', data),
  updateUser: (id: string, data: any) => ipcRenderer.invoke('users:update', id, data),
  deleteUser: (id: string) => ipcRenderer.invoke('users:delete', id),

  // Reports
  getReportsData: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('reports:getData', startDate, endDate),
  exportReportsExcel: (startDate: string, endDate: string) =>
    ipcRenderer.invoke('reports:exportExcel', startDate, endDate),

  // Backup
  exportBackup: () => ipcRenderer.invoke('backup:export'),
  freshResetDatabase: () => ipcRenderer.invoke('database:freshReset'),

  // Printing & Hardware
  printReceipt: (html: string) => ipcRenderer.invoke('print:receipt', html),
  getPrinters: () => ipcRenderer.invoke('system:getPrinters'),
  openCashDrawer: () => ipcRenderer.invoke('cash-drawer:open'),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  setSetting: (updates: Record<string, string>) => ipcRenderer.invoke('settings:set', updates),

  // Audit Logs (Important Activities Only)
  getAuditLogs: (filters?: { category?: string; severity?: string; startDate?: string; endDate?: string }) =>
    ipcRenderer.invoke('audit:getAll', filters),
  createAuditLog: (data: { action: string; category: string; details: string; username?: string; userRole?: string; severity?: string; metadata?: any }) =>
    ipcRenderer.invoke('audit:log', data),

  // Full State Synchronization
  getFullSyncState: () => ipcRenderer.invoke('sync:getFullState'),
  getSyncStatus: () => ipcRenderer.invoke('sync:getStatus'),
  flushSyncOutbox: (batchSize?: number) => ipcRenderer.invoke('sync:flush', batchSize),
  pullSyncChanges: (limit?: number) => ipcRenderer.invoke('sync:pull', limit),
  getReconciliationReport: () => ipcRenderer.invoke('sync:reconcile'),
  getSyncOutbox: (status?: string, limit?: number) => ipcRenderer.invoke('sync:getOutbox', status, limit),
  getSyncSessions: (limit?: number) => ipcRenderer.invoke('sync:getSessions', limit),
  retryDeadLetterEvents: () => ipcRenderer.invoke('sync:retryDeadLetter'),
  reconcileCloudProducts: (cloudProducts: any[]) => ipcRenderer.invoke('sync:reconcileCloudProducts', cloudProducts),
  reconcileCloudBatches: (cloudBatches: any[]) => ipcRenderer.invoke('sync:reconcileCloudBatches', cloudBatches),

  // Cloud Sync Credentials (Backend Managed)
  getCloudCredentials: () => ipcRenderer.invoke('cloud:getCredentials'),
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
