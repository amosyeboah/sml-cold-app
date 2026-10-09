import { useState, useEffect, useCallback } from 'react'
import {
  Cloud,
  CloudOff,
  RefreshCw,
  Clock,
  Database,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  ShieldCheck,
  Server,
  Zap,
  RotateCcw,
  Check,
  AlertCircle,
  Activity,
  Layers,
  FileCheck2,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api } from '@/services/api'
import { queryClient } from '@/lib/queryClient'

interface SyncEngineStatus {
  online: boolean
  state: 'ONLINE' | 'OFFLINE' | 'SYNCING' | 'SYNC_ERROR'
  lastSyncTime: string | null
  pendingCount: number
  failedCount: number
  deadLetterCount: number
  lastError: string | null
  inboundCursor: number
  depotId: string
  cloudConfigured: boolean
  latencyMs: number
}

interface OutboxItem {
  id: string
  eventId: string
  entityType: string
  entityId: string
  operation: string
  aggregateType?: string | null
  retryCount: number
  status: string
  lastError?: string | null
  createdAt: string
  processedAt?: string | null
}

interface ReconciliationReport {
  timestamp: string
  status: 'IN_SYNC' | 'DISCREPANCY_DETECTED' | 'CLOUD_UNAVAILABLE'
  local: {
    salesCount: number
    salesTotalRevenue: number
    stockMovementsCount: number
    purchasesCount: number
    pendingOutboxCount: number
    deadLetterCount: number
  }
  cloud: {
    salesCount: number
    salesTotalRevenue: number
    stockMovementsCount: number
    purchasesCount: number
  } | null
  discrepancies: Array<{
    metric: string
    localValue: number
    cloudValue: number
    difference: number
    description: string
  }>
  recommendations: string[]
}

interface SyncSessionItem {
  id: string
  sessionId: string
  startedAt: string
  completedAt?: string | null
  eventsAttempted: number
  eventsSucceeded: number
  eventsFailed: number
  latencyMs: number
  status: string
  errorSummary?: string | null
}

export default function SyncPage() {
  const [status, setStatus] = useState<SyncEngineStatus>({
    online: false,
    state: 'OFFLINE',
    lastSyncTime: null,
    pendingCount: 0,
    failedCount: 0,
    deadLetterCount: 0,
    lastError: null,
    inboundCursor: 0,
    depotId: 'depot-main',
    cloudConfigured: false,
    latencyMs: 0,
  })

  const [outboxItems, setOutboxItems] = useState<OutboxItem[]>([])
  const [sessions, setSessions] = useState<SyncSessionItem[]>([])
  const [reconciliation, setReconciliation] = useState<ReconciliationReport | null>(null)
  const [isFlushing, setIsFlushing] = useState(false)
  const [isReconciling, setIsReconciling] = useState(false)
  const [isRetryingDeadLetter, setIsRetryingDeadLetter] = useState(false)
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null)
  const [outboxFilter, setOutboxFilter] = useState<string>('ALL')

  const refreshData = useCallback(async () => {
    try {
      const syncStatus = await api.getSyncStatus()
      if (syncStatus) {
        setStatus(syncStatus)
      }
      const outbox = await api.getSyncOutbox(undefined, 50)
      if (Array.isArray(outbox)) {
        setOutboxItems(outbox)
      }
      const sessionLogs = await api.getSyncSessions(20)
      if (Array.isArray(sessionLogs)) {
        setSessions(sessionLogs)
      }
    } catch (err: any) {
      console.warn('Failed to refresh sync status from Local Hub:', err)
    }
  }, [])

  useEffect(() => {
    refreshData()
    // Poll sync status every 10 seconds for real-time observability
    const interval = setInterval(refreshData, 10000)
    return () => clearInterval(interval)
  }, [refreshData])

  const handleFlushOutbox = async () => {
    setIsFlushing(true)
    setFeedback(null)
    try {
      const res = await api.flushSyncOutbox(50)
      const errorDetail = res.error || (res.failed > 0 && res.message ? res.message : null)
      setFeedback({
        type: res.success ? 'success' : 'error',
        message: errorDetail
          ? `Outbox flush completed: ${res.succeeded || 0} succeeded, ${res.failed || 0} failed (${errorDetail}).`
          : `Outbox flush completed: ${res.succeeded || 0} succeeded, ${res.failed || 0} failed.`,
      })
      await refreshData()
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Flush error: ${err.message || 'Network failure'}`,
      })
    } finally {
      setIsFlushing(false)
    }
  }

  const isDesktop = typeof window !== 'undefined' && Boolean((window as any).electron?.ipcRenderer)
  const storageName = isDesktop ? 'Local SQLite' : 'Tablet Storage'

  const handleRunReconciliation = async () => {
    setIsReconciling(true)
    setFeedback(null)
    try {
      const report = await api.getReconciliationReport()
      setReconciliation(report)
      if (report.status === 'IN_SYNC') {
        setFeedback({
          type: 'success',
          message: `Reconciliation verified: ${storageName} and Supabase are in 100% agreement.`,
        })
      } else if (report.status === 'DISCREPANCY_DETECTED') {
        setFeedback({
          type: 'error',
          message: `Reconciliation audit found ${report.discrepancies.length} discrepancy item(s). See audit tab below.`,
        })
      } else {
        setFeedback({
          type: 'info',
          message: 'Cloud is currently unreachable. Local transaction audit values displayed.',
        })
      }
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Reconciliation failed: ${err.message || 'Internal error'}`,
      })
    } finally {
      setIsReconciling(false)
    }
  }

  const handleRetryDeadLetter = async () => {
    setIsRetryingDeadLetter(true)
    try {
      const res = await api.retryDeadLetterEvents()
      setFeedback({
        type: 'success',
        message: `Re-queued ${res.count} dead-letter events for retry.`,
      })
      await refreshData()
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: `Failed to retry dead-letter events: ${err.message}`,
      })
    } finally {
      setIsRetryingDeadLetter(false)
    }
  }

  const formatTimestamp = (ts: string | null | undefined) => {
    if (!ts) return 'Never'
    try {
      const d = new Date(ts)
      return `${d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
    } catch {
      return ts
    }
  }

  const filteredOutbox = outboxItems.filter((item) => {
    if (outboxFilter === 'ALL') return true
    return item.status === outboxFilter
  })

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50">
      {/* ── Top Header Banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs"
        style={{ backgroundColor: '#2563eb' }}
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-sky-100">
                {isDesktop ? 'Authoritative SQLite ↔ Supabase' : 'Tablet Storage ↔ Supabase'}
              </span>
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-mono text-white">
                Depot: {status.depotId}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold flex items-center gap-2 tracking-tight">
              <Cloud className="w-5 h-5 text-cyan-200 shrink-0" />
              Depot Cloud Synchronization
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
            <Button
              onClick={handleFlushOutbox}
              disabled={isFlushing}
              className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs h-8 px-3 rounded-lg text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFlushing ? 'animate-spin' : ''}`} />
              {isFlushing ? 'Flushing...' : 'Push Outbox'}
            </Button>

            <Button
              onClick={handleRunReconciliation}
              disabled={isReconciling}
              variant="outline"
              className="gap-1.5 border-white/20 bg-white/10 hover:bg-white/20 text-white font-semibold h-8 px-3 rounded-lg text-xs"
            >
              <FileCheck2 className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
              {isReconciling ? 'Auditing...' : 'Reconcile'}
            </Button>
          </div>
        </div>
      </div>

      {/* ── Status Feedback Alert ────────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-sm font-medium flex items-center justify-between gap-3 border shadow-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : feedback.type === 'error'
              ? 'bg-rose-50 text-rose-800 border-rose-200'
              : 'bg-blue-50 text-blue-800 border-blue-200'
          }`}
        >
          <div className="flex items-center gap-3">
            {feedback.type === 'success' && <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />}
            {feedback.type === 'error' && <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />}
            {feedback.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 shrink-0" />}
            <span>{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-xs uppercase font-bold tracking-wider opacity-60 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Status KPI Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Cloud Connection State */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Sync Engine State</p>
              <div className="flex items-center gap-2">
                <span
                  className={`h-3 w-3 rounded-full ${
                    status.state === 'ONLINE'
                      ? 'bg-emerald-500 animate-pulse'
                      : status.state === 'SYNCING'
                      ? 'bg-blue-500 animate-spin'
                      : status.state === 'SYNC_ERROR'
                      ? 'bg-rose-500'
                      : 'bg-amber-500'
                  }`}
                />
                <h3 className="font-bold text-slate-800 text-base sm:text-lg">{status.state}</h3>
              </div>
              <p className="text-xs text-slate-500">
                {status.online
                  ? `${status.latencyMs}ms cloud latency`
                  : status.lastError || 'Hub running local-only'}
              </p>
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                status.online ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
              }`}
            >
              {status.online ? <Cloud className="w-5 h-5" /> : <CloudOff className="w-5 h-5" />}
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Pending Outbox */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Pending Outbox</p>
              <div className="flex items-baseline gap-2">
                <h3 className="font-bold text-slate-800 text-2xl">{status.pendingCount}</h3>
                {status.failedCount > 0 && (
                  <span className="text-xs font-semibold text-rose-600">({status.failedCount} retrying)</span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                {status.pendingCount === 0 ? 'All local events synced' : 'Batches queued for upload'}
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600">
              <Database className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Dead Letter Queue */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Dead-Letter Events</p>
              <div className="flex items-baseline gap-2">
                <h3 className={`font-bold text-2xl ${status.deadLetterCount > 0 ? 'text-rose-600' : 'text-slate-800'}`}>
                  {status.deadLetterCount}
                </h3>
              </div>
              {status.deadLetterCount > 0 ? (
                <button
                  onClick={handleRetryDeadLetter}
                  disabled={isRetryingDeadLetter}
                  className="text-xs font-semibold text-rose-600 hover:text-rose-700 underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> Re-queue all
                </button>
              ) : (
                <p className="text-xs text-slate-500">0 unrecoverable events</p>
              )}
            </div>
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                status.deadLetterCount > 0 ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-400'
              }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Last Sync & Inbound Cursor */}
        <Card className="border-slate-200 shadow-sm hover:shadow transition-shadow">
          <CardContent className="p-5 flex items-start justify-between">
            <div className="space-y-1.5">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Last Synced / Cursor</p>
              <h3 className="font-bold text-slate-800 text-sm">
                {status.lastSyncTime ? formatTimestamp(status.lastSyncTime) : 'Never Synced'}
              </h3>
              <p className="text-xs text-slate-500">
                Inbound Cursor: <span className="font-mono font-semibold text-slate-700">#{status.inboundCursor}</span>
              </p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center text-purple-600">
              <Clock className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Main Tabbed Content ──────────────────────────────────────── */}
      <Tabs defaultValue="outbox" className="space-y-4">
        <TabsList className="bg-slate-100 p-1 border border-slate-200">
          <TabsTrigger value="outbox" className="text-xs font-semibold gap-2">
            <Database className="w-3.5 h-3.5" />
            Transactional Outbox ({outboxItems.length})
          </TabsTrigger>
          <TabsTrigger value="reconcile" className="text-xs font-semibold gap-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            Reconciliation &amp; Audit
          </TabsTrigger>
          <TabsTrigger value="sessions" className="text-xs font-semibold gap-2">
            <Clock className="w-3.5 h-3.5" />
            Sync Session Logs ({sessions.length})
          </TabsTrigger>
        </TabsList>

        {/* ── TAB 1: Outbox Queue ────────────────────────────────────── */}
        <TabsContent value="outbox">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" />
                  Local Transactional Outbox ({isDesktop ? 'Atomically Committed in SQLite' : 'Committed in Tablet Storage'})
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  {isDesktop
                    ? 'Events are committed inside the local SQLite business transaction and sent to Supabase with idempotent keys.'
                    : 'Events are saved in tablet offline storage and flushed to Supabase when connected.'}
                </CardDescription>
              </div>

              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
                {['ALL', 'PENDING', 'SYNCED', 'FAILED', 'DEAD_LETTER'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setOutboxFilter(f)}
                    className={`px-2.5 py-1 rounded-md font-semibold transition-all ${
                      outboxFilter === f
                        ? 'bg-white text-slate-800 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            </CardHeader>

            <CardContent>
              {filteredOutbox.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No events matching filter &ldquo;{outboxFilter}&rdquo;</p>
                  <p className="text-xs text-slate-400 mt-1">Local outbox transactions will appear here automatically.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 text-xs">
                        <TableHead>Event ID</TableHead>
                        <TableHead>Entity</TableHead>
                        <TableHead>Operation</TableHead>
                        <TableHead>Created</TableHead>
                        <TableHead>Retries</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Last Error / Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOutbox.map((item) => (
                        <TableRow key={item.id} className="text-xs border-b border-slate-100">
                          <TableCell className="font-mono text-[11px] text-slate-600">
                            {item.eventId?.slice(0, 16) || 'N/A'}...
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">
                            {item.entityType}
                          </TableCell>
                          <TableCell>
                            <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded font-semibold text-slate-700">
                              {item.operation}
                            </span>
                          </TableCell>
                          <TableCell className="text-slate-500">
                            {new Date(item.createdAt).toLocaleTimeString()}
                          </TableCell>
                          <TableCell className="font-mono text-slate-600">
                            {item.retryCount}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                item.status === 'SYNCED'
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                  : item.status === 'PENDING'
                                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                  : item.status === 'FAILED'
                                  ? 'bg-orange-50 text-orange-700 ring-1 ring-orange-200'
                                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              }`}
                            >
                              {item.status}
                            </span>
                          </TableCell>
                          <TableCell className="max-w-xs truncate text-[11px] text-slate-500">
                            {item.lastError || (item.processedAt ? `Synced at ${new Date(item.processedAt).toLocaleTimeString()}` : 'Queued')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 2: Reconciliation & Audit ─────────────────────────── */}
        <TabsContent value="reconcile">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-600" />
                  Diagnostic Reconciliation: {storageName} vs. Supabase Cloud
                </CardTitle>
                <CardDescription className="text-xs text-slate-500 mt-1">
                  Non-destructive audit comparing transactional counts, revenue, and stock movements. No data is silently modified.
                </CardDescription>
              </div>

              <Button
                onClick={handleRunReconciliation}
                disabled={isReconciling}
                size="sm"
                className="gap-2 bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isReconciling ? 'animate-spin' : ''}`} />
                {isReconciling ? 'Running Diagnostic...' : 'Re-Run Diagnostic'}
              </Button>
            </CardHeader>

            <CardContent className="space-y-6">
              {!reconciliation ? (
                <div className="p-12 text-center text-slate-400">
                  <FileCheck2 className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No reconciliation report generated yet</p>
                  <p className="text-xs text-slate-400 mt-1">Click &ldquo;Re-Run Diagnostic&rdquo; to compare local depot data with Supabase.</p>
                </div>
              ) : (
                <>
                  {/* Status Banner */}
                  <div
                    className={`p-4 rounded-xl border flex items-center justify-between ${
                      reconciliation.status === 'IN_SYNC'
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : reconciliation.status === 'DISCREPANCY_DETECTED'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {reconciliation.status === 'IN_SYNC' ? (
                        <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0" />
                      ) : (
                        <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
                      )}
                      <div>
                        <h4 className="font-bold text-sm">
                          {reconciliation.status === 'IN_SYNC'
                            ? 'Local & Cloud Data In Exact Sync'
                            : reconciliation.status === 'DISCREPANCY_DETECTED'
                            ? 'Discrepancies Identified Between Local & Cloud'
                            : 'Cloud Currently Unreachable for Audit'}
                        </h4>
                        <p className="text-xs opacity-80 mt-0.5">
                          Audit Timestamp: {new Date(reconciliation.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant="outline"
                      className={`font-mono text-xs ${
                        reconciliation.status === 'IN_SYNC'
                          ? 'border-emerald-300 bg-emerald-100 text-emerald-800'
                          : 'border-amber-300 bg-amber-100 text-amber-800'
                      }`}
                    >
                      {reconciliation.status}
                    </Badge>
                  </div>

                  {/* Side-by-side metric comparison */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Local SQLite */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Server className="w-3.5 h-3.5 text-blue-600" /> {isDesktop ? 'Local Depot SQLite (Authoritative)' : 'Tablet Storage (Authoritative)'}
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">Live Database</span>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Sales Count</span>
                          <span className="text-lg font-bold text-slate-800">{reconciliation.local.salesCount}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Revenue</span>
                          <span className="text-lg font-bold text-slate-800">
                            GHS {reconciliation.local.salesTotalRevenue.toFixed(2)}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stock Movements</span>
                          <span className="text-lg font-bold text-slate-800">{reconciliation.local.stockMovementsCount}</span>
                        </div>
                        <div className="bg-white p-3 rounded-lg border border-slate-200">
                          <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purchases</span>
                          <span className="text-lg font-bold text-slate-800">{reconciliation.local.purchasesCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Supabase Cloud */}
                    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                      <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                        <span className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                          <Cloud className="w-3.5 h-3.5 text-cyan-600" /> Supabase Cloud Replica
                        </span>
                        <span className="text-[11px] font-mono text-slate-500">Cloud PostgreSQL</span>
                      </div>
                      {reconciliation.cloud ? (
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Cloud Sales Count</span>
                            <span className="text-lg font-bold text-slate-800">{reconciliation.cloud.salesCount}</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Revenue</span>
                            <span className="text-lg font-bold text-slate-800">
                              GHS {reconciliation.cloud.salesTotalRevenue.toFixed(2)}
                            </span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Stock Movements</span>
                            <span className="text-lg font-bold text-slate-800">{reconciliation.cloud.stockMovementsCount}</span>
                          </div>
                          <div className="bg-white p-3 rounded-lg border border-slate-200">
                            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Purchases</span>
                            <span className="text-lg font-bold text-slate-800">{reconciliation.cloud.purchasesCount}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-400">
                          <CloudOff className="w-6 h-6 mx-auto mb-1 text-slate-300" />
                          <p className="text-xs">Cloud replica unavailable for query</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Discrepancies Table */}
                  {reconciliation.discrepancies.length > 0 && (
                    <div className="space-y-2">
                      <h5 className="font-bold text-xs uppercase tracking-wider text-rose-700 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-rose-600" /> Detailed Discrepancies
                      </h5>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-slate-50 text-xs">
                              <TableHead>Metric</TableHead>
                              <TableHead>Local Value</TableHead>
                              <TableHead>Cloud Value</TableHead>
                              <TableHead>Variance</TableHead>
                              <TableHead>Explanation</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {reconciliation.discrepancies.map((d, i) => (
                              <TableRow key={i} className="text-xs border-b border-slate-100">
                                <TableCell className="font-semibold text-slate-700">{d.metric}</TableCell>
                                <TableCell className="font-mono">{d.localValue}</TableCell>
                                <TableCell className="font-mono">{d.cloudValue}</TableCell>
                                <TableCell className="font-mono font-bold text-rose-600">{d.difference}</TableCell>
                                <TableCell className="text-slate-500">{d.description}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {reconciliation.recommendations.length > 0 && (
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                      <span className="font-bold uppercase tracking-wider text-slate-600 block">
                        Reconciliation Action Recommendations:
                      </span>
                      <ul className="list-disc list-inside space-y-1 text-slate-600">
                        {reconciliation.recommendations.map((rec, i) => (
                          <li key={i}>{rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── TAB 3: Sync Sessions History ───────────────────────────── */}
        <TabsContent value="sessions">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold text-slate-800 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                Historical Sync Sessions
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Detailed telemetry for every cloud upload and download session, including network latency and event outcomes.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {sessions.length === 0 ? (
                <div className="p-12 text-center text-slate-400">
                  <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-sm font-semibold text-slate-700">No sync session records yet</p>
                  <p className="text-xs text-slate-400 mt-1">Sessions are logged automatically whenever the background worker or manual sync executes.</p>
                </div>
              ) : (
                <div className="max-h-96 overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50 text-xs">
                        <TableHead>Session ID</TableHead>
                        <TableHead>Started</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Attempted</TableHead>
                        <TableHead>Succeeded</TableHead>
                        <TableHead>Failed</TableHead>
                        <TableHead>Latency</TableHead>
                        <TableHead>Error Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sessions.map((log) => (
                        <TableRow key={log.id} className="text-xs border-b border-slate-100">
                          <TableCell className="font-mono text-[11px] text-slate-600">
                            {log.sessionId?.slice(0, 16) || 'N/A'}...
                          </TableCell>
                          <TableCell className="text-slate-600">
                            {new Date(log.startedAt).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                log.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
                                  : log.status === 'PARTIAL'
                                  ? 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                                  : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200'
                              }`}
                            >
                              {log.status}
                            </span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">{log.eventsAttempted}</TableCell>
                          <TableCell className="font-semibold text-emerald-600">{log.eventsSucceeded}</TableCell>
                          <TableCell className="font-semibold text-rose-600">{log.eventsFailed}</TableCell>
                          <TableCell className="text-slate-500 font-mono">{log.latencyMs}ms</TableCell>
                          <TableCell className="max-w-xs truncate text-[11px] text-slate-500">
                            {log.errorSummary || 'Clean run'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
