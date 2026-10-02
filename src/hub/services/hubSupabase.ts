import { createClient, SupabaseClient } from '@supabase/supabase-js'

if (typeof globalThis.WebSocket === 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const ws = require('ws')
    ;(globalThis as any).WebSocket = ws.default || ws
  } catch {
    // WebSocket is natively available in Node 18+ and Electron
  }
}

let supabaseInstance: SupabaseClient | null = null

export function getSupabaseCredentials() {
  const url =
    process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://porlaindujqtgrtiuzjz.supabase.co'

  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk'

  return { url, key }
}

export function getHubSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    const { url, key } = getSupabaseCredentials()
    if (!key) {
      throw new Error('SUPABASE_SERVICE_ROLE_KEY is required by the local hub to write the cloud mirror.')
    }
    supabaseInstance = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  }
  return supabaseInstance
}

export async function testCloudConnectivity(): Promise<{
  connected: boolean
  latencyMs: number
  error?: string
}> {
  const start = Date.now()
  try {
    const client = getHubSupabaseClient()
    const { error } = await client
      .from('sml_stores')
      .select('id')
      .limit(1)

    const latencyMs = Date.now() - start
    if (error) {
      return { connected: false, latencyMs, error: error.message }
    }
    return { connected: true, latencyMs }
  } catch (err: any) {
    return { connected: false, latencyMs: Date.now() - start, error: err.message || 'Network unreachable' }
  }
}
