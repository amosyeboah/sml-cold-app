import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Database,
  Download,
  Upload,
  CheckCircle,
  AlertTriangle,
  Info,
  FileArchive,
  RefreshCw,
  FileText,
  AlertOctagon,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { api } from '@/services/api'

type BackupStatus = 'idle' | 'pending' | 'success' | 'error'

export default function Backup() {
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [lastBackupPath, setLastBackupPath] = useState<string | null>(null)
  const [backupStatus, setBackupStatus] = useState<BackupStatus>('idle')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [countsSummary, setCountsSummary] = useState<string | null>(null)

  // Restore states
  const [restoreStatus, setRestoreStatus] = useState<'idle' | 'pending' | 'confirm' | 'success' | 'error'>('idle')
  const [restoreData, setRestoreData] = useState<any>(null)
  const [restoreFileName, setRestoreFileName] = useState<string>('')
  const [restoreFileSize, setRestoreFileSize] = useState<string>('')
  const [restoreSummary, setRestoreSummary] = useState<string>('')
  const [restoreErrorMsg, setRestoreErrorMsg] = useState<string>('')

  const apiClient = typeof window !== 'undefined' && (window as any).api ? (window as any).api : api

  const exportBackupMutation = useMutation({
    mutationFn: async () => {
      if (apiClient && typeof apiClient.exportBackup === 'function') {
        return await apiClient.exportBackup()
      }
      throw new Error('Export backup service is unavailable on this device.')
    },
    onMutate: () => {
      setBackupStatus('pending')
      setErrorMsg('')
      setCountsSummary(null)
    },
    onSuccess: (res: any) => {
      if (res && res.success) {
        setBackupStatus('success')
        const targetPath = res.path || 'Snapshot exported to your device / Downloads'
        setLastBackupPath(targetPath)
        if (res.counts) {
          setCountsSummary(`${res.counts.medicines || 0} products, ${res.counts.batches || 0} batches, ${res.counts.sales || 0} sales`)
        }
        toast.success(res.method === 'share' ? 'Backup shared successfully!' : 'Backup exported successfully!')
      } else {
        setBackupStatus('error')
        const msg = res?.message || 'Export failed or was cancelled.'
        setErrorMsg(msg)
        toast.error(msg)
      }
    },
    onError: (err: any) => {
      setBackupStatus('error')
      const msg = err?.message ?? 'Failed to export backup snapshot'
      setErrorMsg(msg)
      toast.error(msg)
    },
  })

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setRestoreFileName(file.name)
    const sizeKb = (file.size / 1024).toFixed(1)
    setRestoreFileSize(`${sizeKb} KB`)

    const reader = new FileReader()
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string
        const parsed = JSON.parse(text)
        const data = parsed.data || parsed

        if (!data || typeof data !== 'object') {
          throw new Error('The selected file does not contain a valid SML Cold Store backup.')
        }

        const medCount = Array.isArray(data.medicines) ? data.medicines.length : 0
        const batchCount = Array.isArray(data.batches) ? data.batches.length : 0
        const saleCount = Array.isArray(data.sales) ? data.sales.length : 0
        const custCount = Array.isArray(data.customers) ? data.customers.length : 0
        const supCount = Array.isArray(data.suppliers) ? data.suppliers.length : 0
        const purchaseCount = Array.isArray(data.purchases) ? data.purchases.length : 0

        setRestoreData(parsed)
        setRestoreSummary(`${medCount} products, ${batchCount} batches, ${saleCount} sales, ${custCount} customers, ${supCount} suppliers, ${purchaseCount} purchases`)
        setRestoreStatus('confirm')
      } catch (parseErr: any) {
        setRestoreStatus('error')
        setRestoreErrorMsg(parseErr.message || 'Could not parse JSON backup file. Please select a valid snapshot.')
        toast.error('Invalid backup file.')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleConfirmRestore = async () => {
    if (!restoreData) return
    setRestoreStatus('pending')
    setRestoreErrorMsg('')

    try {
      if (apiClient && typeof apiClient.restoreBackup === 'function') {
        const res = await apiClient.restoreBackup(restoreData)
        if (res && res.success) {
          setRestoreStatus('success')
          toast.success('Database backup imported and restored successfully!')
          queryClient.invalidateQueries()
        } else {
          setRestoreStatus('error')
          setRestoreErrorMsg(res?.message || 'Failed to restore backup.')
          toast.error(res?.message || 'Restore failed.')
        }
      } else {
        throw new Error('Restore service not available on this platform.')
      }
    } catch (err: any) {
      setRestoreStatus('error')
      setRestoreErrorMsg(err.message || 'Error occurred during restore.')
      toast.error(err.message || 'Error during restore.')
    }
  }

  return (
    <div className="h-full overflow-y-auto p-4 sm:p-6 font-sans bg-slate-50">
      <div
        className="relative overflow-hidden rounded-2xl border border-blue-200 p-5 sm:p-6 text-white shadow-lg shadow-blue-500/10"
        style={{ backgroundColor: '#2563eb' }}
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative space-y-4">
          <div className="flex items-start gap-4">
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl border border-white/20 bg-white/10">
              <Database className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-blue-100">System Security</p>
              <h1 className="text-xl sm:text-2xl font-bold text-white leading-tight">Backup &amp; Restore</h1>
              <p className="mt-1 max-w-lg text-xs sm:text-sm text-blue-50/90">
                Protect your cold store data with offline snapshots. Export a full copy to your tablet, Google Drive, or local storage.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-6 max-w-3xl">
        {/* ── Export Card ─────────────────────────────────────────────── */}
        <Card className="border-gray-200 shadow-sm overflow-hidden bg-white rounded-2xl">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <FileArchive className="h-4 w-4 text-blue-600" />
              <h2 className="text-sm font-bold text-gray-800">Export Database Snapshot</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Creates a secure, standalone backup copy of your entire inventory, batches, POS sales, and audit log.
            </p>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* What's included */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">Snapshot includes</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  'Products & Categories',
                  'Batch Records & Expiry',
                  'Suppliers & Customers',
                  'Sales & POS History',
                  'Purchase Orders & Costs',
                  'Audit Logs & Ledger',
                ].map((item) => (
                  <div key={item} className="flex items-center gap-1.5 text-xs text-gray-600">
                    <CheckCircle className="h-3.5 w-3.5 flex-shrink-0 text-emerald-500" />
                    {item}
                  </div>
                ))}
              </div>
            </div>

            {/* Status feedback */}
            {backupStatus === 'success' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-emerald-800">Backup exported successfully!</p>
                  {lastBackupPath && <p className="text-xs text-emerald-700 font-mono break-all">{lastBackupPath}</p>}
                  {countsSummary && <p className="text-xs text-emerald-600">Included: {countsSummary}</p>}
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
              className="w-full h-11 gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-sm shadow-sm transition-all rounded-xl cursor-pointer"
            >
              {exportBackupMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Generating Snapshot…
                </>
              ) : (
                <>
                  <Download className="h-4 w-4" />
                  Export Database Snapshot
                </>
              )}
            </Button>

            <p className="text-center text-xs text-gray-400">
              On Android, this opens the Share &amp; Save sheet (Google Drive, Downloads, Files). On desktop, a file dialog opens.
            </p>
          </CardContent>
        </Card>

        {/* ── Import & Restore Card ────────────────────────────────────── */}
        <Card className="border-gray-200 shadow-sm overflow-hidden bg-white rounded-2xl">
          <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60">
            <div className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-gray-800">Import Database Snapshot</h2>
            </div>
            <p className="mt-0.5 text-xs text-gray-500">
              Pick a previously exported backup file (<code className="font-mono text-[11px] bg-slate-100 px-1 py-0.5 rounded">.json</code>) to restore records onto this device.
            </p>
          </div>

          <CardContent className="p-5 space-y-4">
            {/* Caution Banner */}
            <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-4 flex items-start gap-3 shadow-2xs">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs space-y-1.5">
                <p className="font-bold text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                  Caution: Overwrite Warning
                </p>
                <p className="text-amber-800 leading-relaxed">
                  Importing a backup will replace and overwrite your active local database records (products, inventory batches, sales, and settings) with the contents of the chosen snapshot.
                </p>
                <p className="text-amber-900 font-semibold bg-amber-100/70 p-1.5 rounded-lg border border-amber-200">
                  ⚠️ Strongly Recommended: Export a fresh database snapshot above before importing another backup file to prevent accidental data loss.
                </p>
              </div>
            </div>

            {/* Hidden file input */}
            <input
              type="file"
              ref={fileInputRef}
              accept=".json"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* File Confirmation Panel */}
            {restoreStatus === 'confirm' && (
              <div className="rounded-xl border-2 border-rose-300 bg-rose-50/80 p-4 space-y-3.5 animate-in fade-in duration-200">
                <div className="flex items-start gap-3">
                  <AlertOctagon className="h-6 w-6 text-rose-600 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-bold text-rose-900">
                      Confirm Database Import &amp; Overwrite
                    </p>
                    <div className="flex items-center gap-2 text-xs text-slate-700 bg-white/80 p-2 rounded-lg border border-rose-200">
                      <FileText className="h-4 w-4 text-slate-500 shrink-0" />
                      <span className="font-mono font-medium truncate">{restoreFileName}</span>
                      <span className="text-slate-400">({restoreFileSize})</span>
                    </div>
                    <p className="text-xs text-slate-700 pt-1">
                      <span className="font-semibold text-slate-900">Detected Content:</span> {restoreSummary}
                    </p>
                    <p className="text-xs text-rose-700 font-semibold pt-0.5">
                      Are you sure you want to proceed? Your current records will be overwritten.
                    </p>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => { setRestoreStatus('idle'); setRestoreData(null) }}
                    className="h-8 text-xs rounded-lg border-slate-300"
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConfirmRestore}
                    className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-lg shadow-xs"
                  >
                    Yes, Import &amp; Overwrite
                  </Button>
                </div>
              </div>
            )}

            {/* Restoring State */}
            {restoreStatus === 'pending' && (
              <div className="flex items-center gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600 shrink-0" />
                <span>Importing and restoring database snapshot…</span>
              </div>
            )}

            {/* Success State */}
            {restoreStatus === 'success' && (
              <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-emerald-800">Database imported successfully!</p>
                  <p className="mt-0.5 text-xs text-emerald-600">All local inventory, batches, and sales records have been refreshed from the snapshot.</p>
                </div>
              </div>
            )}

            {/* Error State */}
            {restoreStatus === 'error' && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4">
                <AlertTriangle className="h-5 w-5 flex-shrink-0 text-red-500 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-red-700">Import failed</p>
                  <p className="mt-0.5 text-xs text-red-500">{restoreErrorMsg}</p>
                </div>
              </div>
            )}

            {/* Pick File Button */}
            {restoreStatus !== 'confirm' && restoreStatus !== 'pending' && (
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="w-full h-11 gap-2 border-emerald-600/40 bg-emerald-50/50 hover:bg-emerald-50 hover:border-emerald-600 text-emerald-800 font-semibold text-sm rounded-xl cursor-pointer transition-all"
              >
                <Upload className="h-4 w-4 text-emerald-600" />
                Pick Backup File to Import (.json)
              </Button>
            )}
          </CardContent>
        </Card>

        {/* ── Best Practices ──────────────────────────────────────────── */}
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4 sm:p-5 flex items-start gap-3.5">
          <Info className="h-5 w-5 flex-shrink-0 text-amber-500 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">Backup Best Practices</p>
            <ul className="text-xs text-amber-800 space-y-1 list-disc list-inside leading-relaxed">
              <li>Export a backup at the end of each business shift or day</li>
              <li>Save copies to Google Drive, an external flash drive, or WhatsApp backup group</li>
              <li>Before updating the app or resetting the tablet, always take a fresh export</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
