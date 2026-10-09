import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import {
  Database,
  Download,
  CheckCircle,
  Shield,
  HardDrive,
  AlertTriangle,
  Info,
  FileArchive,
  RefreshCw,
  Clock,
  Lock,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

type BackupStatus = 'idle' | 'pending' | 'success' | 'error'

export default function Backup() {
  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')

  const exportBackupMutation = useMutation({
    mutationFn: () => window.api.exportBackup(),
    onMutate: () => {
      setBackupStatus('pending')
      setErrorMsg('')
    },
    onSuccess: (res) => {
      if (res.success) {
        setBackupStatus('success')
        setLastBackupPath(res.path)
      } else {
        setBackupStatus('idle')
      }
    },
    onError: (err: any) => {
      setBackupStatus('error')
      setErrorMsg(err.message ?? 'Unknown error')
    },
  })

  return (
    <div className="h-full overflow-y-auto p-6 font-sans">
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 p-6 text-white shadow-lg shadow-blue-500/10" style={{ backgroundColor: '#2563eb' }}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5" />

        <div className="relative space-y-5">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-100">System</p>
              <h1 className="text-2xl font-bold text-white leading-tight">Backup &amp; Restore</h1>
              <p className="mt-1 max-w-lg text-sm text-blue-50/90">
                Protect your cold store data with offline snapshots. Export a full copy of your data to any location you choose.
              </p>
            </div>
          </div>

        </div>
      </div>

      <div className="mt-6 space-y-5 max-w-3xl">
        {/* ── Export Card ─────────────────────────────────────────────── */}
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-800">Export Database Snapshot</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Creates a complete copy of your cold store database — products, batches, sales, purchases, suppliers and more.
            </p>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* What's included */}
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Snapshot includes</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  'Products & Categories',
                  'Batch Records',
                  'Suppliers',
                  'Customers',
                  'Sales & POS History',
                  'Purchase Orders',
                  'Invoices & Ledger',
                  'Users & Settings',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Status feedback */}
            {backupStatus === 'success' && lastBackupPath && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Backup exported successfully!</p>
                  <p className="mt-0.5 text-xs text-emerald-600 break-all">{lastBackupPath}</p>
                </div>
              </div>
            )}

            {backupStatus === 'error' && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Export failed</p>
                  <p className="mt-0.5 text-xs text-red-500">{errorMsg}</p>
                </div>
              </div>
            )}

            {/* Export button */}
            <Button
              id="export-backup-btn"
              onClick={() => exportBackupMutation.mutate()}
              disabled={exportBackupMutation.isPending}
              className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all"
            >
              {exportBackupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Exporting…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Database Snapshot
                </>
              )}
            </Button>

            <p className="text-center text-xs text-gray-400">
              A save dialog will open — choose where to store your <code className="font-mono bg-gray-100 px-1 rounded">.db</code> file.
            </p>
          </CardContent>
        </Card>

        {/* ── Restore Guide ───────────────────────────────────────────── */}
        <Card className="border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <RefreshCw className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-800">How to Restore a Backup</h2>
            </div>
          </div>
          <CardContent className="p-5">
            <div className="space-y-3">
              {[
                {
                  step: '1',
                  title: 'Locate the .db backup file',
                  desc: 'Find the exported cold store backup file (e.g. sml-coldstore-backup-2026-07-27.db) on your local storage.',
                },
                {
                  step: '2',
                  title: 'Close the application',
                  desc: 'Quit the SOFIYEM Legacy Cold Store app completely before replacing the database file to avoid corruption.',
                },
                {
                  step: '3',
                  title: 'Replace the active database',
                  desc: 'Navigate to the app data folder and replace the database file with your backup file.',
                },
                {
                  step: '4',
                  title: 'Relaunch the app',
                  desc: 'Start the application again — it will automatically load data from the restored database.',
                },
              ].map((item) => (
                <div key={item.step} className="flex gap-3">
                  <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-600">
                    {item.step}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{item.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Tips ────────────────────────────────────────────────────── */}
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <Info className="h-4 w-4 flex-shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-semibold text-amber-800">Backup Best Practices</p>
            <ul className="text-xs text-amber-700 space-y-0.5 list-disc list-inside">
              <li>Export a backup at the end of every business day</li>
              <li>Store copies in at least two separate physical locations</li>
              <li>Label files with the date (e.g. <code className="font-mono">sml-coldstore-backup-2026-07-27.db</code>)</li>
              <li>Test your backup by restoring to a test environment periodically</li>
            </ul>
          </div>
        </div>

        {/* ── Schedule reminder info ──────────────────────────────────── */}
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 flex-shrink-0 text-blue-600 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Recommended Schedule</p>
              <p className="text-xs text-gray-500 mt-0.5">
                For a busy cold store, we recommend taking a snapshot <strong>daily</strong> after closing. For lower-traffic operations, a <strong>weekly</strong> backup is the minimum suggested cadence.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
