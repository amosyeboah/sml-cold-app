import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Layers,
  Search,
  AlertTriangle,
  CheckCircle,
  Clock,
  Package,
  Filter,
  TrendingDown,
  Calendar,
  Hash,
  Snowflake,
  Trash2,
  Edit2,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { Batch } from '@/types'

type StatusFilter = 'all' | 'healthy' | 'expiring' | 'expired' | 'low'

function getDaysUntilExpiry(expiryDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(expiryDate)
  expiry.setHours(0, 0, 0, 0)
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function getBatchStatus(batch: any): 'expired' | 'expiring' | 'low' | 'healthy' {
  const days = getDaysUntilExpiry(batch.expiryDate)
  if (days <= 0) return 'expired'
  if (days <= 30) return 'expiring'
  if (batch.quantity <= 10) return 'low'
  return 'healthy'
}

const STATUS_CONFIG = {
  expired: {
    label: 'Expired',
    dot: 'bg-red-500',
    badge: 'bg-red-50 text-red-700 border border-red-200',
    row: 'bg-red-50/40',
  },
  expiring: {
    label: 'Expiring Soon',
    dot: 'bg-amber-400',
    badge: 'bg-amber-50 text-amber-700 border border-amber-200',
    row: 'bg-amber-50/30',
  },
  low: {
    label: 'Low Stock',
    dot: 'bg-orange-400',
    badge: 'bg-orange-50 text-orange-700 border border-orange-200',
    row: 'bg-orange-50/20',
  },
  healthy: {
    label: 'Healthy',
    dot: 'bg-emerald-500',
    badge: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    row: '',
  },
}

const ITEMS_PER_PAGE = 15

export default function BatchTracking() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [batchToDelete, setBatchToDelete] = useState<any>(null)
  
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editingBatch, setEditingBatch] = useState<any>(null)
  
  const [editBatchNumber, setEditBatchNumber] = useState('')
  const [editQuantity, setEditQuantity] = useState(0)
  const [editExpiryDate, setEditExpiryDate] = useState('')

  const { data: batches = [], isLoading } = useQuery<Batch[]>({
    queryKey: ['batches', startDate, endDate],
    queryFn: () => window.api.getBatches(startDate, endDate),
  })

  const deleteBatchMutation = useMutation({
    mutationFn: (id: string) => window.api.deleteBatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      setIsDeleteDialogOpen(false)
      setBatchToDelete(null)
    },
  })

  const openDeleteModal = (batch: any) => {
    setBatchToDelete(batch)
    setIsDeleteDialogOpen(true)
  }

  const updateBatchMutation = useMutation({
    mutationFn: (data: any) => window.api.updateBatch(editingBatch.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      setIsEditDialogOpen(false)
      setEditingBatch(null)
    },
  })

  const openEditModal = (batch: any) => {
    setEditingBatch(batch)
    setEditBatchNumber(batch.batchNumber)
    setEditQuantity(batch.quantity)
    setEditExpiryDate(new Date(batch.expiryDate).toISOString().split('T')[0])
    setIsEditDialogOpen(true)
  }

  const handleUpdateBatch = () => {
    if (!editBatchNumber || editQuantity < 0 || !editExpiryDate) return
    updateBatchMutation.mutate({
      batchNumber: editBatchNumber,
      quantity: editQuantity,
      expiryDate: editExpiryDate,
    })
  }

  const stats = useMemo(() => {
    const all = batches as any[]
    return {
      total: all.length,
      expired: all.filter((b) => getBatchStatus(b) === 'expired').length,
      expiring: all.filter((b) => getBatchStatus(b) === 'expiring').length,
      low: all.filter((b) => getBatchStatus(b) === 'low').length,
      healthy: all.filter((b) => getBatchStatus(b) === 'healthy').length,
      totalUnits: all.reduce((acc, b) => acc + b.quantity, 0),
    }
  }, [batches])

  const filtered = useMemo(() => {
    let result = batches as any[]
    if (statusFilter !== 'all') {
      result = result.filter((b) => getBatchStatus(b) === statusFilter)
    }
      if (search.trim()) {
      const q = search.toLowerCase()
      result = result.filter(
        (b) =>
          b.medicine?.name?.toLowerCase().includes(q) ||
          b.batchNumber?.toLowerCase().includes(q) ||
          b.medicine?.sku?.toLowerCase().includes(q)
      )
    }
    if (startDate || endDate) {
      result = result.filter((b) => {
        const expiry = new Date(b.expiryDate).getTime()
        const start = startDate ? new Date(startDate).getTime() : 0
        const end = endDate ? new Date(endDate).getTime() : Infinity
        return expiry >= start && expiry <= end
      })
    }
    return result
  }, [batches, statusFilter, search, startDate, endDate])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedBatches = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50">
      {/* ── Responsive Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs" style={{ backgroundColor: '#2563eb' }}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                Inventory
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                Cold storage lots
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">Cold Store Lots &amp; Batches</h2>
          </div>

          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-blue-100 font-medium">Total Lots</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{stats.total}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-blue-100 font-medium">Cartons</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{stats.totalUnits.toLocaleString()}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-red-400/20 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-red-100 font-medium">Critical</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{stats.expired + stats.expiring}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          {
            label: 'Healthy',
            value: stats.healthy,
            icon: CheckCircle,
            iconColor: 'text-emerald-600',
            bg: 'bg-emerald-100',
            accent: 'text-emerald-700',
            key: 'healthy' as StatusFilter,
          },
          {
            label: 'Expiring \u226430d',
            value: stats.expiring,
            icon: Clock,
            iconColor: 'text-amber-600',
            bg: 'bg-amber-100',
            accent: 'text-amber-700',
            key: 'expiring' as StatusFilter,
          },
          {
            label: 'Expired',
            value: stats.expired,
            icon: AlertTriangle,
            iconColor: 'text-red-600',
            bg: 'bg-red-100',
            accent: 'text-red-700',
            key: 'expired' as StatusFilter,
          },
          {
            label: 'Low Stock',
            value: stats.low,
            icon: TrendingDown,
            iconColor: 'text-orange-600',
            bg: 'bg-orange-100',
            accent: 'text-orange-700',
            key: 'low' as StatusFilter,
          },
        ].map((card) => (
          <button
            key={card.key}
            onClick={() => setStatusFilter(statusFilter === card.key ? 'all' : card.key)}
            className={`group relative overflow-hidden rounded-2xl border text-left transition-all duration-200 ${
              statusFilter === card.key
                ? 'border-blue-400 shadow-lg shadow-blue-100 ring-2 ring-blue-300/50'
                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
            } bg-white p-3.5 sm:p-5`}
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[10px] sm:text-xs font-semibold text-gray-500 uppercase tracking-wide">{card.label}</p>
                <p className={`text-xl sm:text-3xl font-bold mt-1 ${card.accent}`}>{card.value}</p>
              </div>
              <div className={`flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-xl ${card.bg}`}>
                <card.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${card.iconColor}`} />
              </div>
            </div>
            {statusFilter === card.key && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-400 to-blue-600" />
            )}
          </button>
        ))}
      </div>

      {/* ── Search & Filter Bar ── */}
      <Card className="border-gray-200 shadow-sm">
        <CardContent className="p-3.5 sm:p-4 space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input
                placeholder="Search by product name, batch number, or SKU..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 text-xs sm:text-sm border-gray-200"
              />
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
              <Filter className="h-4 w-4 flex-shrink-0 text-gray-400 hidden sm:block" />
              <div className="flex rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                {(['all', 'healthy', 'expiring', 'expired', 'low'] as StatusFilter[]).map((f) => (
                  <button
                    key={f}
                    onClick={() => setStatusFilter(f)}
                    className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium capitalize transition-all ${
                      statusFilter === f
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-500 hover:bg-gray-50'
                    } border-r last:border-r-0 border-gray-200`}
                  >
                    {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg p-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none text-xs focus:ring-0 w-[110px]"
                />
                <span className="text-gray-400 text-xs">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none text-xs focus:ring-0 w-[110px]"
                />
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[10px] h-6 px-2 text-slate-500 hover:text-slate-700 ml-auto sm:ml-0"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-400">
            Showing <span className="font-semibold text-gray-600">{filtered.length}</span> of{' '}
            <span className="font-semibold text-gray-600">{batches.length}</span> lots
          </p>
        </CardContent>
      </Card>

      {/* ── Batches List / Table ── */}
      <Card className="border-gray-200 shadow-sm overflow-hidden">
        <div className="flex items-center gap-2 px-4 sm:px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <Package className="h-4 w-4 text-blue-600" />
          <span className="text-xs sm:text-sm font-semibold text-gray-700">Cold Storage Lot Registry</span>
        </div>

        {isLoading ? (
          <div className="flex h-52 items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
          </div>
        ) : (
          <>
            {/* ── Tablet & Mobile Cards (Visible on lg:hidden) ── */}
            <div className="lg:hidden p-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-340px)] overflow-y-auto">
              {paginatedBatches.length > 0 ? (
                paginatedBatches.map((batch: any) => {
                  const status = getBatchStatus(batch)
                  const cfg = STATUS_CONFIG[status]
                  const days = getDaysUntilExpiry(batch.expiryDate)
                  return (
                    <div key={batch.id} className={`rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow ${cfg.row}`}>
                      <div className="flex items-start justify-between gap-2 mb-2.5">
                        <div className="min-w-0">
                          <p className="font-bold text-gray-800 text-sm truncate">{batch.medicine?.name ?? '--'}</p>
                          {batch.medicine?.genericName && (
                            <p className="text-xs text-gray-400 truncate">{batch.medicine.genericName}</p>
                          )}
                          <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-[11px] text-gray-700 mt-1">
                            {batch.batchNumber}
                          </span>
                        </div>
                        <div className="flex justify-end gap-1 flex-shrink-0">
                          <button onClick={() => openEditModal(batch)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button onClick={() => openDeleteModal(batch)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs border-t border-gray-100 pt-2.5">
                        <div>
                          <span className="text-gray-400">Quantity</span>
                          <p className={`font-bold ${batch.quantity <= 10 ? 'text-orange-600' : 'text-gray-800'}`}>
                            {batch.quantity} <span className="font-normal text-gray-400">units</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">Expiry Date</span>
                          <p className="text-gray-600 font-medium">
                            {new Date(batch.expiryDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400">Days Left</span>
                          <p className={`font-semibold ${days <= 0 ? 'text-red-600' : days <= 30 ? 'text-amber-600' : 'text-gray-600'}`}>
                            {days <= 0 ? 'Expired' : `${days} days`}
                          </p>
                        </div>
                        <div>
                          <span className="text-gray-400 block mb-0.5">Status</span>
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${cfg.badge}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                            {cfg.label}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full py-12 text-center text-gray-400">
                  <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                  <p className="text-sm font-medium">No batches found</p>
                </div>
              )}
            </div>

            {/* ── Desktop Table (Visible on lg:block) ── */}
            <div className="hidden lg:block max-h-[min(55vh,600px)] overflow-x-auto overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-50 hover:bg-gray-50">
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3.5 w-3.5" /> Product
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        <Hash className="h-3.5 w-3.5" /> Batch #
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Cartons</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      <span className="flex items-center gap-1.5">
                        <Calendar className="h-3.5 w-3.5" /> Best Before / Expiry
                      </span>
                    </TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Days Left</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</TableHead>
                    <TableHead className="text-xs font-semibold text-gray-500 uppercase tracking-wide text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBatches.length > 0 ? (
                    paginatedBatches.map((batch: any) => {
                      const status = getBatchStatus(batch)
                      const cfg = STATUS_CONFIG[status]
                      const days = getDaysUntilExpiry(batch.expiryDate)
                      return (
                        <TableRow key={batch.id} className={`transition-colors hover:bg-gray-50 ${cfg.row}`}>
                          <TableCell>
                            <div>
                              <p className="text-sm font-semibold text-gray-800">{batch.medicine?.name ?? '--'}</p>
                              {batch.medicine?.genericName && (
                                <p className="text-xs text-gray-400">{batch.medicine.genericName}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                              {batch.batchNumber}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-bold ${
                                batch.quantity <= 10 ? 'text-orange-600' : 'text-gray-800'
                              }`}
                            >
                              {batch.quantity}
                            </span>
                            <span className="ml-1 text-xs text-gray-400">units</span>
                          </TableCell>
                          <TableCell className="text-sm text-gray-600">
                            {new Date(batch.expiryDate).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`text-sm font-semibold ${
                                days <= 0
                                  ? 'text-red-600'
                                  : days <= 30
                                  ? 'text-amber-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {days <= 0 ? 'Expired' : `${days}d`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${cfg.badge}`}
                            >
                              <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button onClick={() => openEditModal(batch)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button onClick={() => openDeleteModal(batch)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={7} className="py-14 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Package className="h-8 w-8 text-gray-300" />
                          <p className="text-sm text-gray-400 font-medium">No batches found</p>
                          <p className="text-xs text-gray-300">
                            {search || startDate || endDate ? 'Try adjusting your search or filters' : 'No batches have been recorded yet'}
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </Card>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm text-gray-600">Are you sure you want to delete batch <strong>{batchToDelete?.batchNumber}</strong>? This action cannot be undone.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => deleteBatchMutation.mutate(batchToDelete?.id)}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Responsive Pagination Footer ── */}
      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
            Showing <span className="font-semibold text-slate-800">{filtered.length === 0 ? 0 : startIndex + 1}</span>
            {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)}</span>
            {' '}of <span className="font-semibold text-slate-800">{filtered.length}</span> batches
          </p>

          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="h-8 w-8 rounded-md p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-1 overflow-x-auto max-w-[200px] sm:max-w-none">
              {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                <Button
                  key={page}
                  variant={page === safeCurrentPage ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCurrentPage(page)}
                  className={page === safeCurrentPage ? 'h-8 min-w-8 bg-blue-600 text-white hover:bg-blue-700' : 'h-8 min-w-8'}
                >
                  {page}
                </Button>
              ))}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
              disabled={safeCurrentPage === totalPages}
              className="h-8 w-8 rounded-md p-0"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit Cold Store Lot</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase">Lot / Pallet / Batch #</label>
              <Input
                value={editBatchNumber}
                onChange={(e) => setEditBatchNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase">Cartons (Quantity)</label>
              <Input
                type="number"
                value={editQuantity}
                onChange={(e) => setEditQuantity(Number(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-600 uppercase">Best Before / Expiry Date</label>
              <Input
                type="date"
                value={editExpiryDate}
                onChange={(e) => setEditExpiryDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateBatch}>Save Lot Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

