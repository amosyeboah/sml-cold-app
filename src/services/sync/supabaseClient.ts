import { createClient, SupabaseClient } from '@supabase/supabase-js'

export interface SupabaseConfig {
  url: string
  anonKey: string
  enabled: boolean
}

const STORAGE_KEY = 'sml_coldstore_supabase_config'

// Clean up any residual credentials from browser localStorage
if (typeof localStorage !== 'undefined') {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {}
}

// Credentials loaded securely from backend environment (.env / Electron backend / Vercel env)
const BACKEND_URL = (import.meta as any).env?.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co'
const BACKEND_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk'

let backendConfig: SupabaseConfig = {
  url: BACKEND_URL,
  anonKey: BACKEND_ANON_KEY,
  enabled: true,
}

let backendConfigPromise: Promise<SupabaseConfig> | null = null

export async function initBackendCloudConfig(): Promise<SupabaseConfig> {
  if (backendConfigPromise) return backendConfigPromise

  backendConfigPromise = (async () => {
    try {
      if (typeof window !== 'undefined' && (window as any).api?.getCloudCredentials) {
        const creds = await (window as any).api.getCloudCredentials()
        if (creds?.url && creds?.anonKey) {
          backendConfig = {
            url: creds.url,
            anonKey: creds.anonKey,
            enabled: true,
          }
          if (cachedUrl !== creds.url || cachedKey !== creds.anonKey) {
            cachedClient = null
            cachedUrl = null
            cachedKey = null
          }
        }
      }
    } catch (err) {
      console.warn('Could not load credentials from backend daemon:', err)
    }
    return backendConfig
  })()

  return backendConfigPromise
}

// Trigger initial backend load
if (typeof window !== 'undefined') {
  initBackendCloudConfig()
}

let cachedClient: SupabaseClient | null = null
let cachedUrl: string | null = null
let cachedKey: string | null = null

export function getSupabaseConfig(): SupabaseConfig {
  return backendConfig
}

export function saveSupabaseConfig(config: Partial<SupabaseConfig>): SupabaseConfig {
  // Credentials cannot be modified from the UI; only toggle enabled state in memory if needed
  if (typeof config.enabled === 'boolean') {
    backendConfig.enabled = config.enabled
  }
  return backendConfig
}

export function getSupabaseClient(): SupabaseClient | null {
  const config = getSupabaseConfig()
  if (!config.url || !config.anonKey) {
    return null
  }

  if (cachedClient && cachedUrl === config.url && cachedKey === config.anonKey) {
    return cachedClient
  }

  try {
    if (typeof globalThis !== 'undefined' && typeof (globalThis as any).WebSocket === 'undefined') {
      try {
        const wsModule = typeof require !== 'undefined' ? require('ws') : null
        if (wsModule) {
          (globalThis as any).WebSocket = wsModule
        }
      } catch {}
    }

    cachedClient = createClient(config.url, config.anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
    cachedUrl = config.url
    cachedKey = config.anonKey
    return cachedClient
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err)
    return null
  }
}

export interface ConnectionCheckResult {
  connected: boolean
  message: string
  latencyMs: number
}

/**
 * Fast ping check to verify live connectivity to Supabase cloud.
 */
export async function checkCloudConnection(): Promise<ConnectionCheckResult> {
  await initBackendCloudConfig()
  const config = getSupabaseConfig()
  if (!config.url || !config.anonKey) {
    return {
      connected: false,
      message: 'Supabase URL or Anon Key is not configured in backend environment',
      latencyMs: 0,
    }
  }

  const client = getSupabaseClient()
  if (!client) {
    return {
      connected: false,
      message: 'Invalid Supabase client configuration',
      latencyMs: 0,
    }
  }

  const startTime = Date.now()
  try {
    // Query stores table with 5s timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 6000)

    const { error } = await client
      .from('sml_stores')
      .select('id')
      .limit(1)
      .abortSignal(controller.signal)

    clearTimeout(timeoutId)
    const latencyMs = Date.now() - startTime

    if (error && error.code !== 'PGRST116') {
      // If table doesn't exist yet, it's still connected to Supabase
      if (error.message?.includes('relation "sml_stores" does not exist') || error.code === '42P01') {
        return {
          connected: true,
          message: 'Connected to Supabase (Tables need schema.sql migration)',
          latencyMs,
        }
      }
      return {
        connected: false,
        message: error.message || 'Supabase request returned an error',
        latencyMs,
      }
    }

    return {
      connected: true,
      message: `Online (Connected to Supabase PostgreSQL)`,
      latencyMs,
    }
  } catch (err: any) {
    const latencyMs = Date.now() - startTime
    const isOffline =
      (typeof navigator !== 'undefined' && !navigator.onLine) ||
      err.name === 'AbortError' ||
      err.message?.includes('Failed to fetch') ||
      err.message?.includes('NetworkError')

    return {
      connected: false,
      message: isOffline
        ? 'Offline (No internet connection)'
        : (err.message || 'Connection test failed'),
      latencyMs,
    }
  }
}

/**
 * Realtime subscription to cloud_sales table.
 * Automatically notifies when new sales are created, updated, or synced in Supabase.
 */
export function subscribeToCloudSales(onUpdate: (payload: any) => void): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  try {
    const channel = client
      .channel('cloud_sales_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_sales' },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 [Supabase Realtime] Connected to cloud_sales stream')
        }
      })

    return () => {
      client.removeChannel(channel)
    }
  } catch (err) {
    console.warn('📡 [Supabase Realtime] Subscription error:', err)
    return () => {}
  }
}

/**
 * Realtime subscription to cloud_products table.
 * Automatically notifies when products catalog or stock is modified in Supabase.
 */
export function subscribeToCloudProducts(onUpdate: (payload: any) => void): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  try {
    const channel = client
      .channel('cloud_products_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_products' },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 [Supabase Realtime] Connected to cloud_products stream')
        }
      })

    return () => {
      client.removeChannel(channel)
    }
  } catch (err) {
    console.warn('📡 [Supabase Realtime] Products subscription error:', err)
    return () => {}
  }
}

/**
 * Realtime subscription to cloud_batches table.
 * Automatically notifies when batches are received or modified in Supabase.
 */
export function subscribeToCloudBatches(onUpdate: (payload: any) => void): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  try {
    const channel = client
      .channel('cloud_batches_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_batches' },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 [Supabase Realtime] Connected to cloud_batches stream')
        }
      })

    return () => {
      client.removeChannel(channel)
    }
  } catch (err) {
    console.warn('📡 [Supabase Realtime] Batches subscription error:', err)
    return () => {}
  }
}

/**
 * Realtime subscription to cloud_audit_logs table.
 * Automatically notifies when audit logs or state mirrors (customers, users, settings, purchases) are modified.
 */
export function subscribeToCloudAuditLogs(onUpdate: (payload: any) => void): () => void {
  const client = getSupabaseClient()
  if (!client) return () => {}

  try {
    const channel = client
      .channel('cloud_audit_logs_realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'cloud_audit_logs' },
        (payload) => {
          onUpdate(payload)
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('📡 [Supabase Realtime] Connected to cloud_audit_logs stream')
        }
      })

    return () => {
      client.removeChannel(channel)
    }
  } catch (err) {
    console.warn('📡 [Supabase Realtime] Audit logs subscription error:', err)
    return () => {}
  }
}


