import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trash2, Edit2 } from 'lucide-react'
import type { Batch } from '@/types'
import { Input } from '@/components/ui/input'

const ITEMS_PER_PAGE = 15

export default function Expiry() {
  const queryClient = useQueryClient()
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

  const handleQuarantineBatch = (batch: any) => {
    updateBatchMutation.mutate({
      batchNumber: batch.batchNumber,
      expiryDate: new Date(batch.expiryDate).toISOString().split('T')[0],
      quantity: 0,
    })
  }

  const handleUpdateBatch = () => {
    if (!editBatchNumber || editQuantity < 0 || !editExpiryDate) return
    updateBatchMutation.mutate({
      batchNumber: editBatchNumber,
      quantity: editQuantity,
      expiryDate: editExpiryDate,
    })
  }

  const today = new Date()

  const filteredBatches = batches.filter((b: any) => {
    if (!startDate && !endDate) return true
    const expiry = new Date(b.expiryDate).getTime()
    const start = startDate ? new Date(startDate).getTime() : 0
    const end = endDate ? new Date(endDate).getTime() : Infinity
    return expiry >= start && expiry <= end
  })

  const expiredBatches = filteredBatches.filter((b: any) => new Date(b.expiryDate) < today)
  const expiringSoonBatches = filteredBatches.filter((b: any) => {
    const expiry = new Date(b.expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 0 && diffDays <= 30
  })
  const healthyBatches = filteredBatches.filter((b: any) => {
    const expiry = new Date(b.expiryDate)
    const diffTime = expiry.getTime() - today.getTime()
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays > 30
  })

  const priorityBatches = [...expiredBatches, ...expiringSoonBatches]
  const totalPages = Math.max(1, Math.ceil(priorityBatches.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedBatches = priorityBatches.slice(startIndex, startIndex + ITEMS_PER_PAGE)

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
                Product safety
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                Batch oversight
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">Expiry Management</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-rose-400/15 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-rose-100 font-medium">Expired</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{expiredBatches.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-amber-400/15 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-100 font-medium">Soon</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{expiringSoonBatches.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-emerald-400/15 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100 font-medium">Healthy</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{healthyBatches.length}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4 sm:p-6">
          {/* ── Filters & Controls ── */}
          <div className="mb-4 sm:mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Batch expiry log</h2>
              <p className="text-xs sm:text-sm text-slate-500">Focus on urgent stock and products nearing expiry.</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-1.5 w-full sm:w-auto">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-[115px] sm:w-[125px] border-none bg-transparent text-xs sm:text-sm focus:ring-0"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-[115px] sm:w-[125px] border-none bg-transparent text-xs sm:text-sm focus:ring-0"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setStartDate('')
                    setEndDate('')
                  }}
                  className="h-7 text-xs text-slate-500 hover:text-slate-700 ml-auto sm:ml-0"
                >
                  Clear
                </Button>
              </div>
            </div>
          </div>

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

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : (
            <>
              {/* ── Tablet & Mobile Card Grid (Visible on lg:hidden screens) ── */}
              <div className="lg:hidden grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-0.5">
                {paginatedBatches.length > 0 ? (
                  paginatedBatches.map((batch: any) => {
                    const expired = new Date(batch.expiryDate) < today
                    const daysLeft = expired ? 0 : Math.ceil((new Date(batch.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                    return (
                      <div key={batch.id} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm hover:shadow-md transition-shadow">
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-sm truncate">{batch.medicine?.name || 'Unnamed Product'}</p>
                            <span className="inline-flex mt-1 rounded-md border border-blue-200 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                              {batch.batchNumber}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {expired && batch.quantity > 0 && (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-8 px-2 border-red-200 bg-red-50 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                                onClick={() => handleQuarantineBatch(batch)}
                                title="Quarantine & Write Off Expired Stock"
                              >
                                Write Off
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100" onClick={() => openEditModal(batch)}>
                              <Edit2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-red-50 text-red-600 hover:bg-red-100" onClick={() => openDeleteModal(batch)}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs border-t border-slate-100 pt-2.5">
                          <div>
                            <span className="text-slate-400">Quantity</span>
                            <p className="font-semibold text-slate-700">{batch.quantity} units</p>
                          </div>
                          <div>
                            <span className="text-slate-400">Expiry Date</span>
                            <p className="font-medium text-slate-600">{new Date(batch.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</p>
                          </div>
                          <div className="col-span-2">
                            <span className="text-slate-400 block mb-0.5">Status</span>
                            {expired ? (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                                <span className="h-2 w-2 rounded-full bg-red-500" />
                                Expired
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                <span className="h-2 w-2 rounded-full bg-amber-500" />
                                {daysLeft} days remaining
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <div className="col-span-full py-12 text-center text-slate-500 text-sm">
                    No expiry concerns in the current filter.
                  </div>
                )}
              </div>

              {/* ── Desktop Table (Visible on lg:block screens) ── */}
              <div className="hidden lg:block max-h-[min(60vh,560px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50">
                      <TableHead className="text-slate-700">Product</TableHead>
                      <TableHead className="text-slate-700">Batch Code</TableHead>
                      <TableHead className="text-slate-700">Quantity</TableHead>
                      <TableHead className="text-slate-700">Expiry Date</TableHead>
                      <TableHead className="text-slate-700">Status</TableHead>
                      <TableHead className="text-center text-slate-700">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedBatches.length > 0 ? (
                      paginatedBatches.map((batch: any) => {
                        const expired = new Date(batch.expiryDate) < today
                        const daysLeft = expired ? 0 : Math.ceil((new Date(batch.expiryDate).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

                        return (
                          <TableRow key={batch.id} className="border-b border-slate-100 bg-white transition-colors hover:bg-gradient-to-r hover:from-blue-50 hover:via-white hover:to-indigo-50">
                            <TableCell className="font-semibold text-slate-800">{batch.medicine?.name}</TableCell>
                            <TableCell>
                              <span className="inline-flex rounded-md border border-blue-200 bg-blue-50 px-2 py-1 font-mono text-[11px] font-semibold text-blue-700">
                                {batch.batchNumber}
                              </span>
                            </TableCell>
                            <TableCell className="text-slate-700">{batch.quantity} units</TableCell>
                            <TableCell className="text-slate-600">{new Date(batch.expiryDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}</TableCell>
                            <TableCell>
                              {expired ? (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-red-200">
                                  <span className="h-2 w-2 rounded-full bg-red-500" />
                                  Expired
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                                  {daysLeft} days
                                </span>
                              )}
                            </TableCell>
                            <TableCell>
                              <div className="flex justify-center gap-1.5">
                                {expired && batch.quantity > 0 && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-8 border-red-200 bg-red-50 text-[11px] font-semibold text-red-700 hover:bg-red-100"
                                    onClick={() => handleQuarantineBatch(batch)}
                                    title="Quarantine & Write Off Expired Stock"
                                  >
                                    Write Off
                                  </Button>
                                )}
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700" onClick={() => openEditModal(batch)}>
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => openDeleteModal(batch)}>
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )
                      })
                    ) : (
                      <TableRow>
                        <TableCell colSpan={6} className="py-12 text-center text-slate-500">
                          No expiry concerns in the current filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </>
          )}

          {/* ── Responsive Pagination ── */}
          {priorityBatches.length > 0 && (
            <div className="mt-4 sm:mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-3 sm:px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs sm:text-sm text-slate-600 text-center sm:text-left">
                Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span>
                {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, priorityBatches.length)}</span>
                {' '}of <span className="font-semibold text-slate-800">{priorityBatches.length}</span> priority batches
              </p>

              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-8 w-8 rounded-md p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
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
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Edit Modal ── */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-md w-[95vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Edit Batch</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Batch Number</label>
              <Input value={editBatchNumber} onChange={(e) => setEditBatchNumber(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Quantity</label>
              <Input type="number" value={editQuantity} onChange={(e) => setEditQuantity(Number(e.target.value))} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600">Expiry Date</label>
              <Input type="date" value={editExpiryDate} onChange={(e) => setEditExpiryDate(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateBatch} className="text-white" style={{ backgroundColor: '#2563eb' }}>Save Changes</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
