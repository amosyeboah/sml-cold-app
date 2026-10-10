/**
 * HTTP Client connecting POS terminals (Android Tablets, secondary PCs, Web)
 * to the Authoritative Local Depot Hub.
 */
import { getDeviceProfile } from './deviceIdentity'
import { bluetoothPrinter } from '../hardware/bluetoothPrinter'

export function isLocalOrLanHostname(hostname: string): boolean {
  if (!hostname) return false
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') {
    return true
  }
  // Private LAN IP addresses: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(h)) return true
  return false
}

export function isCloudHosting(): boolean {
  if (typeof window === 'undefined' || !window.location || !window.location.hostname) return false
  const host = window.location.hostname.toLowerCase()
  const custom = typeof localStorage !== 'undefined' ? localStorage.getItem('sml_depot_hub_url') : null
  if (custom && (custom.includes('vercel.app') || custom.includes(':4820'))) {
    try {
      localStorage.removeItem('sml_depot_hub_url')
    } catch {}
  }
  if (custom && !custom.includes('vercel.app') && !custom.includes(':4820')) {
    return false
  }
  return host.includes('vercel.app') || !isLocalOrLanHostname(host)
}

export function getHubBaseUrl(): string {
  if (typeof localStorage !== 'undefined') {
    const custom = localStorage.getItem('sml_depot_hub_url')
    if (custom) {
      const cleanCustom = custom.replace(/\/+$/, '')
      // Discard accidental vercel.app hub entries or obsolete 4820 port
      if (cleanCustom.includes('vercel.app') || cleanCustom.includes(':4820')) {
        try {
          localStorage.removeItem('sml_depot_hub_url')
        } catch {}
      } else {
        return cleanCustom
      }
    }
  }

  const envUrl = (import.meta as any).env?.VITE_HUB_URL
  if (envUrl && !envUrl.includes('vercel.app') && !envUrl.includes(':4820')) return envUrl.replace(/\/+$/, '')

  if (typeof window !== 'undefined' && window.location && window.location.hostname) {
    const hostname = window.location.hostname
    // Only infer hub on local dev machine or LAN IP
    if (isLocalOrLanHostname(hostname)) {
      return `http://${hostname}:4821`
    }
  }

  return 'http://localhost:4821'
}

export function setHubBaseUrl(url: string) {
  if (typeof localStorage !== 'undefined') {
    if (!url || url.trim() === '' || url.includes('vercel.app') || url.includes(':4820')) {
      try {
        localStorage.removeItem('sml_depot_hub_url')
      } catch {}
    } else {
      try {
        localStorage.setItem('sml_depot_hub_url', url.replace(/\/+$/, ''))
      } catch {}
    }
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getHubBaseUrl()
  const profile = getDeviceProfile()

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Device-Id': profile.deviceId,
    'X-Store-Id': profile.storeId,
    ...(options.headers as any),
  }

  const url = `${baseUrl}${endpoint}`

  let res: Response
  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch (err: any) {
    throw new Error(
      `Cannot connect to Local Depot Hub at ${baseUrl}. Ensure your tablet is connected to the depot Wi-Fi network.`
    )
  }

  if (!res.ok) {
    let errorMsg = `Server error (${res.status})`
    try {
      const errorJson = await res.json()
      if (errorJson.error) errorMsg = errorJson.error
    } catch {}
    throw new Error(errorMsg)
  }

  return (await res.json()) as T
}

export const hubClient = {
  // Auth
  login: async (username: string, password: string) => {
    const res = await request<{ success: boolean; user: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
    return res.user
  },

  loginWithPin: async (pin: string, selectedRole?: string) => {
    const res = await request<{ success: boolean; user: any }>('/api/auth/pin', {
      method: 'POST',
      body: JSON.stringify({ pin, selectedRole }),
    })
    return res.user
  },

  // Dashboard
  getDashboardStats: async () => {
    return await request<any>('/api/reports/dashboard')
  },

  // Categories
  getCategories: async () => {
    return await request<any[]>('/api/categories')
  },

  createCategory: async (data: { name: string }) => {
    return await request<any>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateCategory: async (id: string, data: { name: string }) => {
    return await request<any>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteCategory: async (id: string) => {
    return await request<any>(`/api/categories/${id}`, {
      method: 'DELETE',
    })
  },

  // Products (Medicines)
  getMedicines: async () => {
    return await request<any[]>('/api/products')
  },

  createMedicine: async (data: any) => {
    return await request<any>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateMedicine: async (id: string, data: any) => {
    return await request<any>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteMedicine: async (id: string) => {
    return await request<any>(`/api/products/${id}`, {
      method: 'DELETE',
    })
  },

  // Batches
  getBatches: async (startDate?: string, endDate?: string) => {
    const query = new URLSearchParams()
    if (startDate) query.set('startDate', startDate)
    if (endDate) query.set('endDate', endDate)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return await request<any[]>(`/api/batches${qs}`)
  },

  createBatch: async (data: any) => {
    return await request<any>('/api/batches', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateBatch: async (id: string, data: any) => {
    return await request<any>(`/api/batches/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteBatch: async (id: string) => {
    return await request<any>(`/api/batches/${id}`, {
      method: 'DELETE',
    })
  },

  // Suppliers
  getSuppliers: async () => {
    return await request<any[]>('/api/suppliers')
  },

  createSupplier: async (data: any) => {
    return await request<any>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateSupplier: async (id: string, data: any) => {
    return await request<any>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteSupplier: async (id: string) => {
    return await request<any>(`/api/suppliers/${id}`, {
      method: 'DELETE',
    })
  },

  // Customers
  getCustomers: async () => {
    return await request<any[]>('/api/customers')
  },

  createCustomer: async (data: any) => {
    return await request<any>('/api/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateCustomer: async (id: string, data: any) => {
    return await request<any>(`/api/customers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteCustomer: async (id: string) => {
    return await request<any>(`/api/customers/${id}`, {
      method: 'DELETE',
    })
  },

  // Sales (POS) - AUTHORITATIVE ATOMIC TRANSACTION
  createSale: async (data: any) => {
    const profile = getDeviceProfile()
    const res = await request<{ success: boolean; sale: any }>('/api/sales', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        deviceId: profile.deviceId,
      }),
    })
    return res.sale
  },

  getSales: async () => {
    return await request<any[]>('/api/sales')
  },

  refundSale: async (id: string, username?: string, userRole?: string) => {
    return await request<{ success: boolean; message: string }>(`/api/sales/${id}/refund`, {
      method: 'POST',
      body: JSON.stringify({ username, userRole })
    })
  },

  getPrescriptions: async () => {
    return await request<any[]>('/api/prescriptions').catch(() => [])
  },

  // Purchases
  getPurchases: async () => {
    return await request<any[]>('/api/purchases')
  },

  createPurchase: async (data: any) => {
    const profile = getDeviceProfile()
    const res = await request<{ success: boolean; purchase: any }>('/api/purchases', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        deviceId: profile.deviceId,
      }),
    })
    return res.purchase
  },

  deletePurchase: async (id: string) => {
    return await request<any>(`/api/purchases/${id}`, {
      method: 'DELETE',
    })
  },

  // Users
  getUsers: async () => {
    return await request<any[]>('/api/users')
  },

  createUser: async (data: any) => {
    const res = await request<{ success: boolean; user: any }>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    })
    return res.user
  },

  updateUser: async (id: string, data: any) => {
    return await request<any>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    })
  },

  deleteUser: async (id: string) => {
    return await request<any>(`/api/users/${id}`, {
      method: 'DELETE',
    })
  },

  // Reports
  getReportsData: async (startDate: string, endDate: string) => {
    return await request<any>(`/api/reports/data?startDate=${startDate}&endDate=${endDate}`)
  },

  exportReportsExcel: async (_startDate: string, _endDate: string) => {
    return { success: false, message: 'Excel export available on main desktop' }
  },

  // Backup
  exportBackup: async () => {
    try {
      const [medicines, batches, categories, customers, suppliers, sales, purchases, settings] = await Promise.all([
        hubClient.getMedicines().catch(() => []),
        hubClient.getBatches().catch(() => []),
        hubClient.getCategories().catch(() => []),
        hubClient.getCustomers().catch(() => []),
        hubClient.getSuppliers().catch(() => []),
        hubClient.getSales().catch(() => []),
        hubClient.getPurchases().catch(() => []),
        hubClient.getSettings().catch(() => ({})),
      ])

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      const fileName = `sml_hub_backup_${timestamp}.json`
      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        system: 'SOFIYEM Legacy Cold Store (Hub Snapshot)',
        data: {
          medicines,
          batches,
          categories,
          customers,
          suppliers,
          sales,
          purchases,
          settings,
        }
      }

      const jsonString = JSON.stringify(backupData, null, 2)

      if (typeof navigator !== 'undefined' && typeof File !== 'undefined' && typeof (navigator as any).canShare === 'function') {
        try {
          const file = new File([jsonString], fileName, { type: 'application/json' })
          if ((navigator as any).canShare({ files: [file] })) {
            await navigator.share({
              title: 'SML Cold Store Backup',
              text: `Hub Database snapshot (${fileName})`,
              files: [file],
            })
            return { success: true, path: fileName }
          }
        } catch (shareErr: any) {
          if (shareErr.name === 'AbortError') return { success: true, path: fileName }
        }
      }

      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        const blob = new Blob([jsonString], { type: 'application/json;charset=utf-8' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = fileName
        document.body.appendChild(a)
        a.click()
        setTimeout(() => {
          try {
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
          } catch {}
        }, 60000)
      }

      return { success: true, path: fileName }
    } catch (err: any) {
      return { success: false, message: err.message || 'Failed to export backup from hub' }
    }
  },

  // Printing & Hardware
  printReceipt: async (html: string) => {
    // If Bluetooth printer is connected, route print job directly to Bluetooth ESC/POS printer
    if (bluetoothPrinter.getStatus().isConnected) {
      const res = await bluetoothPrinter.printReceipt(html)
      if (res.success) return { success: true }
      console.warn('Bluetooth print failed, falling back to window print:', res.error)
    }

    if (typeof window !== 'undefined') {
      const printWindow = window.open('', '_blank', 'width=350,height=600')
      if (printWindow) {
        printWindow.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8">
<style>
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  html, body { margin:0; padding:0; width:80mm; font-family:'Courier New',Courier,monospace; font-size:12px; color:#000; background:#fff; }
  body { padding: 2mm; }
  table { border-collapse:collapse; width:100%; }
  hr { border:none; border-top:1px dashed #000; margin:4px 0; }
</style>
</head><body>${html}</body></html>`)
        printWindow.document.close()
        printWindow.focus()
        setTimeout(() => { printWindow.print(); setTimeout(() => printWindow.close(), 1000) }, 300)
        return { success: true }
      }
    }
    return { success: false }
  },

  // Bluetooth Printer Controls
  connectBluetoothPrinter: async (address?: string) => bluetoothPrinter.connect(address),
  disconnectBluetoothPrinter: async () => bluetoothPrinter.disconnect(),
  getBluetoothPrinterStatus: () => bluetoothPrinter.getStatus(),
  listBluetoothPrinters: async () => bluetoothPrinter.listPairedDevices(),
  testBluetoothPrinter: async () => bluetoothPrinter.testPrint(),
  setBluetoothPaperWidth: (width: '58mm' | '80mm') => bluetoothPrinter.setPaperWidth(width),

  getPrinters: async () => {
    const list: any[] = []
    const btStatus = bluetoothPrinter.getStatus()
    if (btStatus.isConnected && btStatus.deviceName) {
      list.push({ name: `Bluetooth: ${btStatus.deviceName}`, isDefault: true })
    }
    return list
  },

  openCashDrawer: async () => {
    // If Bluetooth printer is connected, trigger ESC/POS pulse
    if (bluetoothPrinter.getStatus().isConnected) {
      const res = await bluetoothPrinter.openCashDrawer()
      if (res.success) return { success: true }
      return { success: false, reason: res.error || 'Failed to trigger drawer on Bluetooth printer' }
    }
    return { success: false, reason: 'Cash drawer not available via hub' }
  },

  // Settings
  getSettings: async () => {
    return await request<Record<string, string>>('/api/settings')
  },

  setSetting: async (updates: Record<string, string>) => {
    return await request<{ success: boolean }>('/api/settings', {
      method: 'POST',
      body: JSON.stringify(updates),
    })
  },

  // Audit Logs
  getAuditLogs: async (filters?: any) => {
    const query = new URLSearchParams()
    if (filters?.category) query.set('category', filters.category)
    if (filters?.severity) query.set('severity', filters.severity)
    if (filters?.startDate) query.set('startDate', filters.startDate)
    if (filters?.endDate) query.set('endDate', filters.endDate)
    const qs = query.toString() ? `?${query.toString()}` : ''
    return await request<any[]>(`/api/audit${qs}`)
  },

  createAuditLog: async (data: any) => {
    const profile = getDeviceProfile()
    return await request<any>('/api/audit', {
      method: 'POST',
      body: JSON.stringify({
        ...data,
        deviceId: profile.deviceId,
      }),
    })
  },

  // Synchronization status & control
  getFullSyncState: async () => {
    return await request<any>('/api/sync/status')
  },

  getSyncStatus: async () => {
    return await request<any>('/api/sync/status')
  },

  flushSyncOutbox: async (batchSize?: number) => {
    return await request<any>('/api/sync/flush', {
      method: 'POST',
      body: JSON.stringify({ batchSize: batchSize || 50 }),
    })
  },

  pullSyncChanges: async (limit?: number) => {
    return await request<any>('/api/sync/pull', {
      method: 'POST',
      body: JSON.stringify({ limit: limit || 50 }),
    })
  },

  getReconciliationReport: async () => {
    return await request<any>('/api/sync/reconcile')
  },

  getSyncOutbox: async (status?: string, limit?: number) => {
    const qs = new URLSearchParams()
    if (status) qs.set('status', status)
    if (limit) qs.set('limit', String(limit))
    return await request<any>(`/api/sync/outbox?${qs.toString()}`)
  },

  getSyncSessions: async (limit?: number) => {
    return await request<any[]>(`/api/sync/sessions?limit=${limit || 40}`)
  },

  retryDeadLetterEvents: async () => {
    return await request<{ success: boolean; count: number }>('/api/sync/retry-dead-letter', {
      method: 'POST',
    })
  },

  getCloudCredentials: async () => {
    return {
      url: (import.meta as any).env?.VITE_SUPABASE_URL || '',
      anonKey: (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || '',
    }
  },

  // Device registration helper
  registerDeviceWithHub: async () => {
    const profile = getDeviceProfile()
    try {
      await request('/api/devices/register', {
        method: 'POST',
        body: JSON.stringify(profile),
      })
    } catch {}
  },
}
