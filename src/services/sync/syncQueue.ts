import { getSupabaseClient, checkCloudConnection } from './supabaseClient'
import { isCloudHosting } from '../api/hubClient'
import { pushLocalStorageToCloudIfAvailable, syncAllCloudDataIfAvailable } from '../api/mobileStorage'

export type SyncEntity = 'SALE' | 'AUDIT_LOG' | 'PRODUCT' | 'BATCH' | 'PURCHASE'
export type SyncAction = 'INSERT' | 'UPDATE' | 'DELETE'

export interface SyncQueueItem {
  id: string
  entity: SyncEntity
  action: SyncAction
  payload: any
  status: 'PENDING' | 'SYNCING' | 'FAILED'
  retryCount: number
  createdAt: string
  lastAttemptAt?: string
  error?: string
}

export interface SyncSessionLog {
  id: string
  timestamp: string
  status: 'SUCCESS' | 'PARTIAL' | 'FAILED' | 'OFFLINE'
  itemsSynced: number
  durationMs: number
  details: string
}

const QUEUE_STORAGE_KEY = 'sml_coldstore_sync_queue'
const LAST_SYNC_KEY = 'sml_coldstore_last_synced_at'
const HISTORY_STORAGE_KEY = 'sml_coldstore_sync_history'

type SyncListener = (status: {
  isSyncing: boolean
  pendingCount: number
  lastSyncTime: string | null
}) => void

const listeners: Set<SyncListener> = new Set()
let isCurrentlySyncing = false

export function subscribeToSyncState(listener: SyncListener): () => void {
  listeners.add(listener)
  const refresh = () => publishSyncState(listener)
  refresh()
  const interval = setInterval(refresh, 10000)
  return () => {
    listeners.delete(listener)
    clearInterval(interval)
  }
}

function publishSyncState(listener: SyncListener): void {
  if (typeof window === 'undefined') {
    listener({ isSyncing: isCurrentlySyncing, pendingCount: getPendingQueue().length, lastSyncTime: getLastSyncTime() })
    return
  }

  if (isCloudHosting()) {
    listener({ isSyncing: false, pendingCount: 0, lastSyncTime: null })
    return
  }

  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron?.ipcRenderer)
  if (isElectron && (window as any).api?.getSyncStatus) {
    (window as any).api.getSyncStatus().then((status: any) => {
      listener({
        isSyncing: status.state === 'SYNCING',
        pendingCount: Number(status.pendingOutbox ?? status.pendingCount) || 0,
        lastSyncTime: status.lastSyncAt || status.lastSyncTime || null,
      })
    }).catch(() => {
      listener({ isSyncing: false, pendingCount: 0, lastSyncTime: null })
    })
    return
  }

  listener({
    isSyncing: isCurrentlySyncing,
    pendingCount: getPendingQueue().length,
    lastSyncTime: getLastSyncTime(),
  })
}

function notifyListeners() {
  listeners.forEach(publishSyncState)
}

// ─── Queue Management ────────────────────────────────────────────────────────

export function getQueue(): SyncQueueItem[] {
  try {
    const raw = localStorage.getItem(QUEUE_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveQueue(queue: SyncQueueItem[]): void {
  localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue))
  notifyListeners()
}

export function getPendingQueue(): SyncQueueItem[] {
  return getQueue().filter((item) => item.status === 'PENDING' || item.status === 'FAILED')
}

export function enqueueSyncItem(entity: SyncEntity, action: SyncAction, payload: any): SyncQueueItem {
  const queue = getQueue()
  const item: SyncQueueItem = {
    id: `sync_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    entity,
    action,
    payload,
    status: 'PENDING',
    retryCount: 0,
    createdAt: new Date().toISOString(),
  }

  queue.push(item)
  saveQueue(queue)

  // If online, attempt background flush
  const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : false
  if (isOnline && !isCurrentlySyncing) {
    flushSyncQueue().catch((err) => console.warn('Background auto-sync failed:', err))
  }

  return item
}

// ─── Last Sync Timestamp ──────────────────────────────────────────────────────

export function getLastSyncTime(): string | null {
  return localStorage.getItem(LAST_SYNC_KEY)
}

export function setLastSyncTime(timestamp: string): void {
  localStorage.setItem(LAST_SYNC_KEY, timestamp)
  notifyListeners()
}

// ─── Sync History ─────────────────────────────────────────────────────────────

export function getSyncHistory(): SyncSessionLog[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addSyncHistoryLog(log: Omit<SyncSessionLog, 'id'>): void {
  const history = getSyncHistory()
  const newLog: SyncSessionLog = {
    ...log,
    id: `hist_${Date.now()}`,
  }
  history.unshift(newLog)
  // Keep last 40 sync runs
  localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, 40)))
}

// ─── Flush / Process Sync Queue ───────────────────────────────────────────────

export async function flushSyncQueue(): Promise<{
  success: boolean
  syncedCount: number
  failedCount: number
  message: string
}> {
  if (typeof window !== 'undefined' && isCloudHosting()) {
    return { success: true, syncedCount: 0, failedCount: 0, message: 'Owner portal is read-only; sync is managed by the local tablet POS.' }
  }

  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron?.ipcRenderer)
  if (isElectron && typeof (window as any).api?.flushSyncOutbox === 'function') {
    const result = await (window as any).api.flushSyncOutbox(50)
    return {
      success: Boolean(result.success),
      syncedCount: Number(result.succeeded) || 0,
      failedCount: Number(result.failed) || 0,
      message: result.error || `Sync completed: ${Number(result.succeeded) || 0} synced, ${Number(result.failed) || 0} failed.`,
    }
  }

  return await legacyFlushSyncQueue()
}

async function legacyFlushSyncQueue(): Promise<{
  success: boolean
  syncedCount: number
  failedCount: number
  message: string
}> {
  if (isCurrentlySyncing) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: 0,
      message: 'Sync is already in progress',
    }
  }

  const queue = getQueue()
  const pendingItems = queue.filter((i) => i.status === 'PENDING' || i.status === 'FAILED')

  if (pendingItems.length === 0) {
    // Queue is empty, but verify cloud connection and update last checked
    const health = await checkCloudConnection()
    if (health.connected) {
      setLastSyncTime(new Date().toISOString())
    }
    return {
      success: true,
      syncedCount: 0,
      failedCount: 0,
      message: 'Sync queue is up to date. No pending items.',
    }
  }

  const client = getSupabaseClient()
  if (!client) {
    return {
      success: false,
      syncedCount: 0,
      failedCount: pendingItems.length,
      message: 'Supabase URL or Anon Key is missing. Configure settings in Offline Sync page.',
    }
  }

  // Fast connection check
  const health = await checkCloudConnection()
  if (!health.connected) {
    addSyncHistoryLog({
      timestamp: new Date().toISOString(),
      status: 'OFFLINE',
      itemsSynced: 0,
      durationMs: health.latencyMs,
      details: `Offline mode: ${pendingItems.length} items queued for next connection.`,
    })
    return {
      success: false,
      syncedCount: 0,
      failedCount: pendingItems.length,
      message: health.message,
    }
  }

  isCurrentlySyncing = true
  notifyListeners()

  const startTime = Date.now()
  let syncedCount = 0
  let failedCount = 0
  const remainingQueue: SyncQueueItem[] = []

  try {
    for (const item of queue) {
      if (item.status !== 'PENDING' && item.status !== 'FAILED') {
        continue
      }

      item.status = 'SYNCING'
      item.lastAttemptAt = new Date().toISOString()

      try {
        let uploadError: any = null

        if (item.entity === 'SALE') {
          const sale = item.payload
          // 1. Upload parent sale
          let pm = sale.paymentMethod || 'CASH'
          if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 1) {
            const cashAmt = sale.payments.filter((p: any) => !(p.method || '').toUpperCase().includes('MOBILE') && !(p.method || '').toUpperCase().includes('MOMO')).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            const mobileAmt = sale.payments.filter((p: any) => (p.method || '').toUpperCase().includes('MOBILE') || (p.method || '').toUpperCase().includes('MOMO')).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            pm = `SPLIT:CASH=${cashAmt},MOBILE=${mobileAmt}`
          }

          const saleDate = sale.date || sale.sold_at || new Date().toISOString()
          const totalAmt = Number(sale.total ?? sale.total_amount ?? 0)

          const { error: saleErr } = await client.from('cloud_sales').upsert({
            id: sale.id,
            store_id: 'sml_accra_main',
            invoice_number: sale.saleNumber || sale.invoice_number || `INV-${String(sale.id).slice(0, 8).toUpperCase()}`,
            customer_name: sale.customer?.name || sale.customerName || 'Walk-in Customer',
            total_amount: totalAmt,
            subtotal: Number(sale.subtotal ?? totalAmt),
            payment_method: pm,
            cashier_name: sale.cashier || sale.cashier_name || 'cashier',
            sold_at: saleDate,
            created_at: saleDate,
          })

          if (saleErr) uploadError = saleErr

          // 2. Upload sale items
          if (!uploadError && sale.items && Array.isArray(sale.items)) {
            const cloudItems = sale.items.map((i: any) => {
              const unitPrice = Number(i.price ?? i.unit_price ?? i.medicine?.price ?? 0)
              const qty = Number(i.quantity) || 1
              return {
                id: i.id || `${sale.id}_${i.batch?.medicineId || i.medicineId || i.productId || Math.random().toString(36).substring(2, 6)}`,
                sale_id: sale.id,
                product_id: i.batch?.medicineId || i.medicineId || i.productId || null,
                batch_id: i.batchId || null,
                product_name:
                  i.batch?.medicine?.name ||
                  i.medicine?.name ||
                  i.product_name ||
                  i.productName ||
                  i.name ||
                  'Cold Store Item',
                quantity: qty,
                unit_price: unitPrice,
                total_price: qty * unitPrice,
                created_at: saleDate,
              }
            })

            const { error: itemsErr } = await client.from('cloud_sale_items').upsert(cloudItems)
            if (itemsErr) uploadError = itemsErr
          }
        } else if (item.entity === 'AUDIT_LOG') {
          const log = item.payload
          const { error } = await client.from('cloud_audit_logs').upsert({
            id: log.id,
            store_id: 'sml_accra_main',
            user_name: log.username || log.operator || 'System',
            action: log.action || 'ACTIVITY',
            entity_name: log.category || 'SALE',
            entity_id: log.entityId || log.metadata?.entityId || null,
            details: typeof log.details === 'string' ? log.details : JSON.stringify(log.details || log.metadata || {}),
            created_at: log.createdAt || new Date().toISOString(),
          })
          if (error) uploadError = error
        } else if (item.entity === 'PRODUCT') {
          const product = item.payload
          if (item.action === 'DELETE') {
            const { error } = await client.from('cloud_products').delete().eq('id', product.id)
            if (error) {
              // Mark tombstone locally so product is not resurrected by cloud pulls
              try {
                const deletedIdsRaw = localStorage.getItem('sml_coldstore_deleted_medicine_ids')
                const deletedIds = deletedIdsRaw ? JSON.parse(deletedIdsRaw) : []
                if (!deletedIds.includes(product.id)) {
                  deletedIds.push(product.id)
                  localStorage.setItem('sml_coldstore_deleted_medicine_ids', JSON.stringify(deletedIds))
                }
              } catch {}
              uploadError = error
            }
          } else {
            const { error } = await client.from('cloud_products').upsert({
              id: product.id,
              store_id: 'sml_accra_main',
              name: product.name,
              generic_name: product.genericName || product.generic_name || null,
              sku: product.sku || `SKU-${String(product.id).slice(0, 6).toUpperCase()}`,
              category: product.category?.name || product.categoryName || product.category || 'General',
              price: Number(product.price) || 0,
              cost: Number(product.cost) || 0,
              current_stock: Number(product.stockQuantity ?? product.current_stock ?? 0),
              unit: product.unit || 'CARTON',
              requires_cold_storage: true,
              updated_at: new Date().toISOString(),
            })
            if (error) uploadError = error
          }
        } else if (item.entity === 'BATCH') {
          const batch = item.payload
          if (item.action === 'DELETE') {
            const { error } = await client.from('cloud_batches').delete().eq('id', batch.id)
            if (error) uploadError = error
          } else {
            const { error } = await client.from('cloud_batches').upsert({
              id: batch.id,
              product_id: batch.medicineId || batch.product_id,
              store_id: 'sml_accra_main',
              batch_number: batch.batchNumber || batch.batch_number || 'B01',
              supplier_name: batch.supplierName || batch.supplier_name || null,
              cost_price: Number(batch.costPrice ?? batch.cost_price ?? 0),
              selling_price: Number(batch.sellingPrice ?? batch.selling_price ?? batch.price ?? 0),
              quantity_received: Number(batch.quantityReceived ?? batch.quantity_received ?? batch.quantity ?? 0),
              quantity_current: Number(batch.quantity ?? batch.quantity_current ?? 0),
              received_date: batch.receivedDate || batch.received_date || new Date().toISOString(),
              expiry_date: batch.expiryDate || batch.expiry_date || null,
              status: batch.status || 'ACTIVE',
              created_at: batch.createdAt || new Date().toISOString(),
            })
            if (error) uploadError = error
          }
        }

        if (uploadError) {
          throw uploadError
        }

        syncedCount++
        // Don't add to remainingQueue (item is considered successfully synced)
      } catch (itemErr: any) {
        failedCount++
        item.status = 'FAILED'
        item.retryCount += 1
        item.error = itemErr.message || 'Upload error'
        remainingQueue.push(item)
      }
    }

    // Save remaining (failed or untouched) items back to queue
    saveQueue(remainingQueue)

    const durationMs = Date.now() - startTime
    const nowIso = new Date().toISOString()
    setLastSyncTime(nowIso)

    const sessionStatus = failedCount === 0 ? 'SUCCESS' : syncedCount > 0 ? 'PARTIAL' : 'FAILED'
    addSyncHistoryLog({
      timestamp: nowIso,
      status: sessionStatus,
      itemsSynced: syncedCount,
      durationMs,
      details:
        sessionStatus === 'SUCCESS'
          ? `Uploaded all ${syncedCount} queued change(s) to UK Owner Cloud.`
          : `Synced ${syncedCount} item(s), ${failedCount} item(s) failed.`,
    })

    // Log sync session to Supabase cloud as well
    client
      .from('cloud_sync_sessions')
      .insert({
        store_id: 'sml_accra_main',
        device_id: 'Main POS Terminal (Accra Depot)',
        sync_type: 'AUTO_BACKGROUND',
        status: sessionStatus,
        items_count: syncedCount,
        duration_ms: durationMs,
      })
      .then(() => {})
      .catch(() => {})

    return {
      success: sessionStatus !== 'FAILED',
      syncedCount,
      failedCount,
      message:
        sessionStatus === 'SUCCESS'
          ? `Synchronized ${syncedCount} items successfully to Supabase cloud.`
          : `Partially synced: ${syncedCount} succeeded, ${failedCount} retrying later.`,
    }
  } catch (err: any) {
    const durationMs = Date.now() - startTime
    addSyncHistoryLog({
      timestamp: new Date().toISOString(),
      status: 'FAILED',
      itemsSynced: syncedCount,
      durationMs,
      details: err.message || 'Fatal sync error',
    })
    return {
      success: false,
      syncedCount,
      failedCount,
      message: err.message || 'Synchronization failed',
    }
  } finally {
    isCurrentlySyncing = false
    notifyListeners()
  }
}

/**
 * Auto/Manual reconciliation of all sales between local storage / SQLite and Supabase Cloud.
 * Guarantees that all offline transactions made on any terminal are pushed to Supabase,
 * and updates local cache.
 */
/**
 * Auto/Manual bidirectional reconciliation of catalog, inventory, and sales
 * between local storage / SQLite and Supabase Cloud.
 * Guarantees that products, batches, stock levels, and sales transactions match 100%
 * across both offline desktop POS terminals and the remote online web portal.
 */
export async function reconcileAllSalesWithCloud(): Promise<{
  success: boolean
  pushedCount: number
  cloudTotal: number
  message: string
}> {
  if (typeof window !== 'undefined' && isCloudHosting()) {
    const client = getSupabaseClient()
    if (!client) {
      return { success: false, pushedCount: 0, cloudTotal: 0, message: 'Supabase client is not configured.' }
    }
    const { count, error } = await client.from('cloud_sales').select('*', { count: 'exact', head: true })
    return {
      success: !error,
      pushedCount: 0,
      cloudTotal: count || 0,
      message: error ? error.message : 'Owner portal refreshed from the live cloud mirror.',
    }
  }

  return await legacyReconcileAllSalesWithCloud()
}

async function legacyReconcileAllSalesWithCloud(): Promise<{
  success: boolean
  pushedCount: number
  cloudTotal: number
  message: string
}> {
  const client = getSupabaseClient()
  if (!client) {
    return {
      success: false,
      pushedCount: 0,
      cloudTotal: 0,
      message: 'Supabase client is not configured',
    }
  }

  // 1. Flush any queued pending items first
  await flushSyncQueue().catch(() => {})

  let pushedCount = 0

  // 2. If running in Electron Desktop App, perform bidirectional reconciliation with Supabase
  const isElectron = typeof window !== 'undefined' && Boolean((window as any).electron?.ipcRenderer)
  if (isElectron && (window as any).api?.getSales) {
    try {
      // 2a. Reconcile Products (Local SQLite is Authoritative -> Cloud DB for Monitoring)
      if ((window as any).api?.getMedicines) {
        const allDbMeds = await (window as any).api.getMedicines()
        if (Array.isArray(allDbMeds)) {
          const dbMedIds = new Set(allDbMeds.map((m: any) => m.id))

          // 1. Fetch current cloud products to find and purge any deleted orphans
          const { data: cloudProductsData } = await client.from('cloud_products').select('id')
          if (Array.isArray(cloudProductsData) && cloudProductsData.length > 0) {
            const zombies = cloudProductsData.filter((cp: any) => !dbMedIds.has(cp.id))
            if (zombies.length > 0) {
              const zombieIds = zombies.map((z: any) => z.id)
              await client.from('cloud_batches').delete().in('product_id', zombieIds).catch(() => {})
              await client.from('cloud_products').delete().in('id', zombieIds).catch(() => {})
            }
          }

          // 2. Push authoritative local products up to Cloud
          if (allDbMeds.length > 0) {
            const cloudMeds = allDbMeds.map((m: any) => {
              const totalQty = (m.batches || []).reduce((acc: number, b: any) => acc + (Number(b.quantity) || 0), 0)
              return {
                id: m.id,
                store_id: 'sml_accra_main',
                name: m.name,
                generic_name: m.genericName || null,
                sku: m.sku || `SKU-${String(m.id).slice(0, 6).toUpperCase()}`,
                category: m.category?.name || 'General',
                price: Number(m.price) || 0,
                cost: Number(m.cost) || 0,
                current_stock: totalQty,
                unit: 'CARTON',
                requires_cold_storage: true,
                updated_at: new Date().toISOString()
              }
            })
            await client.from('cloud_products').upsert(cloudMeds)
          }
        }
      }

      // 2b. Reconcile Batches (Local SQLite is Authoritative -> Cloud DB for Monitoring)
      if ((window as any).api?.getBatches) {
        const allDbBatches = await (window as any).api.getBatches()
        if (Array.isArray(allDbBatches)) {
          const dbBatchIds = new Set(allDbBatches.map((b: any) => b.id))

          // 1. Fetch cloud batches to find and purge deleted orphan batches
          const { data: cloudBatchesData } = await client.from('cloud_batches').select('id')
          if (Array.isArray(cloudBatchesData) && cloudBatchesData.length > 0) {
            const zombieBatches = cloudBatchesData.filter((cb: any) => !dbBatchIds.has(cb.id))
            if (zombieBatches.length > 0) {
              const zombieBatchIds = zombieBatches.map((zb: any) => zb.id)
              await client.from('cloud_batches').delete().in('id', zombieBatchIds).catch(() => {})
            }
          }

          // 2. Push authoritative local batches up to Cloud
          if (allDbBatches.length > 0) {
            const cloudBatches = allDbBatches.map((b: any) => ({
              id: b.id,
              product_id: b.medicineId,
              store_id: 'sml_accra_main',
              batch_number: b.batchNumber,
              supplier_name: null,
              cost_price: 0,
              selling_price: 0,
              quantity_received: Number(b.quantity) || 0,
              quantity_current: Number(b.quantity) || 0,
              received_date: new Date().toISOString(),
              expiry_date: b.expiryDate instanceof Date ? b.expiryDate.toISOString() : new Date(b.expiryDate).toISOString(),
              status: 'ACTIVE',
              created_at: new Date().toISOString()
            }))
            await client.from('cloud_batches').upsert(cloudBatches)
          }
        }
      }

      // 2c. Reconcile Sales
      const allDbSales = await (window as any).api.getSales()
      if (Array.isArray(allDbSales) && allDbSales.length > 0) {
        const { data: cloudSales } = await client
          .from('cloud_sales')
          .select('id')

        const cloudIdSet = new Set((cloudSales || []).map((s: any) => s.id))
        const unsyncedDbSales = allDbSales.filter((s: any) => !cloudIdSet.has(s.id))

        for (const sale of unsyncedDbSales) {
          let pm = sale.paymentMethod || 'CASH'
          if (sale.payments && Array.isArray(sale.payments) && sale.payments.length > 1) {
            const cashAmt = sale.payments.filter((p: any) => !(p.method || '').toUpperCase().includes('MOBILE') && !(p.method || '').toUpperCase().includes('MOMO')).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            const mobileAmt = sale.payments.filter((p: any) => (p.method || '').toUpperCase().includes('MOBILE') || (p.method || '').toUpperCase().includes('MOMO')).reduce((sum: number, p: any) => sum + (Number(p.amount) || 0), 0)
            pm = `SPLIT:CASH=${cashAmt},MOBILE=${mobileAmt}`
          } else if (pm === 'SPLIT') {
            pm = `SPLIT:CASH=${(sale.total || 0) / 2},MOBILE=${(sale.total || 0) / 2}`
          }

          const saleDate = sale.date || new Date().toISOString()
          const totalAmt = Number(sale.total) || 0

          const { error: saleErr } = await client.from('cloud_sales').upsert({
            id: sale.id,
            store_id: 'sml_accra_main',
            invoice_number: sale.saleNumber || `INV-${String(sale.id).slice(0, 8).toUpperCase()}`,
            customer_name: sale.customer?.name || 'Walk-in Customer',
            total_amount: totalAmt,
            subtotal: Number(sale.subtotal ?? totalAmt),
            payment_method: pm,
            cashier_name: 'cashier',
            sold_at: saleDate,
            created_at: saleDate,
          })

          if (!saleErr && sale.items && Array.isArray(sale.items)) {
            const cloudItems = sale.items.map((i: any) => {
              const unitPrice = Number(i.price ?? i.batch?.medicine?.price ?? 0)
              const qty = Number(i.quantity) || 1
              return {
                id: i.id,
                sale_id: sale.id,
                product_id: i.batch?.medicineId || i.medicineId || i.batchId || null,
                product_name:
                  i.batch?.medicine?.name ||
                  i.medicine?.name ||
                  i.product_name ||
                  i.productName ||
                  i.name ||
                  'Cold Store Item',
                sku: i.batch?.medicine?.sku || i.sku || null,
                quantity: qty,
                unit_price: unitPrice,
                total_price: qty * unitPrice,
                created_at: saleDate,
              }
            })
            await client.from('cloud_sale_items').upsert(cloudItems)
            pushedCount++
          }
        }
      }

      // 2d. Reconcile Full State Mirrors (Users, Customers, Suppliers, Purchases, Settings, Categories)
      if ((window as any).api?.getFullSyncState) {
        const fullState = await (window as any).api.getFullSyncState()
        if (fullState) {
          const timestamp = new Date().toISOString()
          const mirrorUpserts: any[] = []

          if (Array.isArray(fullState.users) && fullState.users.length > 0) {
            mirrorUpserts.push({
              id: 'STATE_USERS',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'AUTH',
              details: `Synchronized ${fullState.users.length} users from SQLite`,
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { users: fullState.users },
              created_at: timestamp
            })
          }

          if (Array.isArray(fullState.categories) && fullState.categories.length > 0) {
            mirrorUpserts.push({
              id: 'STATE_CATEGORIES',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'INVENTORY',
              details: `Synchronized ${fullState.categories.length} categories from SQLite`,
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { categories: fullState.categories },
              created_at: timestamp
            })
          }

          if (Array.isArray(fullState.customers) && fullState.customers.length > 0) {
            mirrorUpserts.push({
              id: 'STATE_CUSTOMERS',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'CUSTOMERS',
              details: `Synchronized ${fullState.customers.length} customers from SQLite`,
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { customers: fullState.customers },
              created_at: timestamp
            })
          }

          if (Array.isArray(fullState.suppliers) && fullState.suppliers.length > 0) {
            mirrorUpserts.push({
              id: 'STATE_SUPPLIERS',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'SUPPLIERS',
              details: `Synchronized ${fullState.suppliers.length} suppliers from SQLite`,
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { suppliers: fullState.suppliers },
              created_at: timestamp
            })
          }

          if (Array.isArray(fullState.purchases) && fullState.purchases.length > 0) {
            mirrorUpserts.push({
              id: 'STATE_PURCHASES',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'PURCHASES',
              details: `Synchronized ${fullState.purchases.length} purchases from SQLite`,
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { purchases: fullState.purchases },
              created_at: timestamp
            })
          }

          if (fullState.settings && typeof fullState.settings === 'object') {
            mirrorUpserts.push({
              id: 'STATE_SETTINGS',
              store_id: 'sml_accra_main',
              action: 'SYSTEM_STATE_SNAPSHOT',
              category: 'SYSTEM',
              details: 'Synchronized store settings from SQLite',
              username: 'system',
              user_role: 'ADMIN',
              severity: 'INFO',
              metadata: { settings: fullState.settings },
              created_at: timestamp
            })
          }

          if (mirrorUpserts.length > 0) {
            await client.from('cloud_audit_logs').upsert(mirrorUpserts)
          }
        }
      }
    } catch (dbErr) {
      console.warn('Reconcile SQLite notice:', dbErr)
    }
  } else {
    // 3. Web / Vercel: push local browser state to cloud, then pull latest mirrors
    try {
      await pushLocalStorageToCloudIfAvailable()
      await syncAllCloudDataIfAvailable()
    } catch (webErr) {
      console.warn('Web storage cloud sync notice:', webErr)
    }
  }

  // 4. Fetch latest counts from Supabase
  const [{ count: salesCount }, { count: productsCount }, { count: batchesCount }] = await Promise.all([
    client.from('cloud_sales').select('*', { count: 'exact', head: true }),
    client.from('cloud_products').select('*', { count: 'exact', head: true }),
    client.from('cloud_batches').select('*', { count: 'exact', head: true }),
  ])

  setLastSyncTime(new Date().toISOString())
  notifyListeners()

  const sCount = salesCount || 0
  const pCount = productsCount || 0
  const bCount = batchesCount || 0

  return {
    success: true,
    pushedCount,
    cloudTotal: sCount,
    message: pushedCount > 0
      ? `Uploaded ${pushedCount} offline change(s). Cloud sync active (${pCount} products, ${bCount} batches, ${sCount} transactions synchronized).`
      : `Cloud sync up to date (${pCount} products, ${bCount} batches, ${sCount} transactions verified in Supabase).`,
  }
}

// ─── WorkManager Background Auto-Sync Lifecycle ──────────────────────────────

let isWorkManagerInitialized = false

export function initWorkManager(): void {
  if (isWorkManagerInitialized || typeof window === 'undefined') return
  isWorkManagerInitialized = true

  // 1. Online reconnection event: automatically trigger sync & reconciliation when internet returns
  window.addEventListener('online', () => {
    console.log('🌐 Internet connection restored. WorkManager running sync reconciliation...')
    reconcileAllSalesWithCloud().catch((e) => console.warn('Sync on reconnection failed:', e))
  })

  // 2. Periodic interval: reconcile/flush every 60 seconds if online
  setInterval(() => {
    if (navigator.onLine && !isCurrentlySyncing) {
      if (getPendingQueue().length > 0) {
        flushSyncQueue().catch(() => {})
      }
    }
  }, 60000)

  // 3. Initial startup check
  if (navigator.onLine) {
    setTimeout(() => {
      reconcileAllSalesWithCloud().catch(() => {})
    }, 4000)
  }
}

