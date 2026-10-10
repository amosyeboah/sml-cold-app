import { useEffect } from 'react'
import { RouterProvider } from 'react-router-dom'
import { router } from '@/routes'
import { Providers } from './providers'
import {
  subscribeToCloudSales,
  subscribeToCloudProducts,
  subscribeToCloudBatches,
  subscribeToCloudAuditLogs,
  subscribeToCloudCategories,
  subscribeToCloudCustomers,
  subscribeToCloudSuppliers,
  subscribeToCloudUsers
} from '@/services/sync/supabaseClient'
import { queryClient } from '@/lib/queryClient'
import {
  syncAllCloudDataIfAvailable,
  fetchCloudSalesIfAvailable,
  fetchCloudProductsIfAvailable,
  fetchCloudBatchesIfAvailable,
  fetchCloudStateMirrorsIfAvailable,
  fetchCloudCategoriesIfAvailable,
  fetchCloudCustomersIfAvailable,
  fetchCloudSuppliersIfAvailable,
  fetchCloudUsersIfAvailable
} from '@/services/api/mobileStorage'

export default function App() {
  useEffect(() => {
    // 1. Initial warm up of all cloud data (catalog, inventory, sales, state mirrors) into local storage
    syncAllCloudDataIfAvailable().then(() => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    }).catch(() => {})

    // 2. Real-time subscription to cloud_sales table
    const unsubscribeSales = subscribeToCloudSales(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud sales update:', payload.eventType)
      await fetchCloudSalesIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
    })

    // 3. Real-time subscription to cloud_products table
    const unsubscribeProducts = subscribeToCloudProducts(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud products update:', payload.eventType)
      await fetchCloudProductsIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    })

    // 4. Real-time subscription to cloud_batches table
    const unsubscribeBatches = subscribeToCloudBatches(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud batches update:', payload.eventType)
      await fetchCloudBatchesIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
    })

    // 5. Real-time subscription to cloud_audit_logs table (state snapshots & audit logs)
    const unsubscribeAudit = subscribeToCloudAuditLogs(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud state mirror update:', payload.eventType)
      await fetchCloudStateMirrorsIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      queryClient.invalidateQueries({ queryKey: ['purchases'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['audit-logs'] })
    })

    // 6. Real-time subscription to cloud_categories table
    const unsubscribeCategories = subscribeToCloudCategories(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud categories update:', payload.eventType)
      await fetchCloudCategoriesIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
    })

    // 7. Real-time subscription to cloud_customers table
    const unsubscribeCustomers = subscribeToCloudCustomers(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud customers update:', payload.eventType)
      await fetchCloudCustomersIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['customers'] })
    })

    // 8. Real-time subscription to cloud_suppliers table
    const unsubscribeSuppliers = subscribeToCloudSuppliers(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud suppliers update:', payload.eventType)
      await fetchCloudSuppliersIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    })

    // 9. Real-time subscription to cloud_users table
    const unsubscribeUsers = subscribeToCloudUsers(async (payload) => {
      console.log('📡 [Supabase Realtime] Cloud users update:', payload.eventType)
      await fetchCloudUsersIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['users'] })
    })

    // 10. Background sync interval to ensure Android tablets & Web stay in lockstep with Cloud admin controls
    const pollInterval = setInterval(() => {
      fetchCloudStateMirrorsIfAvailable().then(() => {
        queryClient.invalidateQueries({ queryKey: ['settings'] })
      }).catch(() => {})
    }, 10000)

    const onSettingsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
    window.addEventListener('settings_updated', onSettingsUpdated)

    return () => {
      clearInterval(pollInterval)
      window.removeEventListener('settings_updated', onSettingsUpdated)
      unsubscribeSales()
      unsubscribeProducts()
      unsubscribeBatches()
      unsubscribeAudit()
      unsubscribeCategories()
      unsubscribeCustomers()
      unsubscribeSuppliers()
      unsubscribeUsers()
    }
  }, [])

  return (
    <Providers>
      <RouterProvider router={router} />
    </Providers>
  )
}

