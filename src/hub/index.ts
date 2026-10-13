import { buildServer } from './server'
import { FastifyInstance } from 'fastify'
import { startPeriodicSyncWorker, stopPeriodicSyncWorker } from './services/syncEngine'

let activeServer: FastifyInstance | null = null

export async function startHubServer(
  port = Number(process.env.HUB_PORT) || 4821,
  host = process.env.HUB_HOST || '0.0.0.0'
): Promise<{ server: FastifyInstance; port: number; host: string; address: string }> {
  if (activeServer) {
    return {
      server: activeServer,
      port,
      host,
      address: `http://${host}:${port}`,
    }
  }

  const server = buildServer({ logger: true })
  activeServer = server

  try {
    const address = await server.listen({ port, host })
    console.log(`🚀 [Sofiyem Local Depot Hub] Running at ${address}`)
    console.log(`📡 [Sofiyem Local Depot Hub] Authoritative SQLite Database active`)
    // Start background sync worker (non-blocking)
    try {
      startPeriodicSyncWorker()
      console.log(`🔄 [Sofiyem Local Depot Hub] Background Sync Worker started`)
    } catch (syncErr) {
      console.warn('⚠️ Could not start background sync worker:', syncErr)
    }
    return { server, port, host, address }
  } catch (err) {
    console.error('❌ Failed to start Sofiyem Local Depot Hub:', err)
    activeServer = null
    throw err
  }
}

export async function stopHubServer(): Promise<void> {
  try {
    stopPeriodicSyncWorker()
  } catch {}

  if (activeServer) {
    await activeServer.close()
    activeServer = null
  }
}

// Auto-start if run directly as entry script
if (require.main === module) {
  startHubServer().catch((err) => {
    console.error(err)
    process.exit(1)
  })
}
