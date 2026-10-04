import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Search, Phone, Mail, MapPin, Eye, Edit2, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Supplier } from '@/types'
import { api } from '@/services/api'

const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

const supplierSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, 'Supplier name is required'),
  contact: z.string().optional(),
  email: z.string().email('Invalid email address').or(z.literal('')),
  address: z.string().optional(),
})
type SupplierFormData = z.infer<typeof supplierSchema>

const ITEMS_PER_PAGE = 15

export default function Suppliers() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [viewingSupplier, setViewingSupplier] = useState<Supplier | null>(null)
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ['suppliers'],
    queryFn: () => apiClient.getSuppliers(),
  })

  const { data: allPurchases = [] } = useQuery<any[]>({
    queryKey: ['purchases'],
    queryFn: () => apiClient.getPurchases(),
  })

  const createSupplierMutation = useMutation({
    mutationFn: (data: SupplierFormData) => apiClient.createSupplier(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      closeModal()
    },
  })

  const updateSupplierMutation = useMutation({
    mutationFn: (data: SupplierFormData) => apiClient.updateSupplier(data.id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      closeModal()
    },
  })

  const deleteSupplierMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteSupplier(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      setIsDeleteDialogOpen(false)
      setSupplierToDelete(null)
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
  })

  const onSubmit = (data: SupplierFormData) => {
    if (editingSupplier) {
      updateSupplierMutation.mutate(data)
    } else {
      createSupplierMutation.mutate(data)
    }
  }

  const openEditModal = (supplier: Supplier) => {
    setEditingSupplier(supplier)
    setValue('id', supplier.id)
    setValue('name', supplier.name)
    setValue('contact', supplier.contact || '')
    setValue('email', supplier.email || '')
    setValue('address', supplier.address || '')
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setEditingSupplier(null)
    reset()
  }

  const openDeleteModal = (supplier: Supplier) => {
    setSupplierToDelete(supplier)
    setIsDeleteDialogOpen(true)
  }

  const filteredSuppliers = suppliers.filter((s) =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (s.email && s.email.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedSuppliers = filteredSuppliers.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const totalSuppliers = suppliers.length
  const totalPayable = suppliers.reduce((sum, s) => sum + (s.totalPayable || 0), 0)
  const thisMonthPurchases = suppliers.reduce((sum, s) => sum + (s.thisMonthPurchases || 0), 0)

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const supplierPurchases = useMemo(() => {
    if (!viewingSupplier) return []
    return allPurchases.filter(
      (p: any) =>
        p.supplierId === viewingSupplier.id ||
        p.supplier?.id === viewingSupplier.id ||
        (p.supplier?.name && p.supplier.name.toLowerCase() === viewingSupplier.name.toLowerCase()) ||
        (p.supplierName && p.supplierName.toLowerCase() === viewingSupplier.name.toLowerCase())
    ).sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [allPurchases, viewingSupplier])

  const supplierTotalPurchases = supplierPurchases.reduce((sum: number, p: any) => sum + (Number(p.total) || 0), 0) || (viewingSupplier?.totalPayable || 0)
  const supplierOrdersCount = supplierPurchases.length
  const lastPurchaseDate = supplierPurchases[0]?.date

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
      case 'overdue':
        return 'bg-red-50 text-red-700 ring-1 ring-red-200'
      case 'pending':
        return 'bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200'
      default:
        return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200'
    }
  }

  const getStatusDot = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500'
      case 'overdue':
        return 'bg-red-500'
      case 'pending':
        return 'bg-yellow-500'
      default:
        return 'bg-gray-500'
    }
  }

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50">
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs" style={{ backgroundColor: '#2563eb' }}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                Supplier network
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                Active vendors
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">Suppliers</h2>
          </div>
          <div className="grid grid-cols-3 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-blue-100 font-medium">Suppliers</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{totalSuppliers}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-emerald-400/15 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100 font-medium">Payable</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">₵{totalPayable.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-amber-400/15 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-100 font-medium">Purchases</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">₵{thisMonthPurchases.toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-xs">
        <CardContent className="p-3.5 sm:p-5">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Vendor registry</h2>
              <p className="text-sm text-slate-500">Monitor your supplier base and payment status.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search suppliers..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="border-slate-200 bg-slate-50 pl-9"
                />
              </div>
              <Button
                onClick={() => {
                  reset()
                  setEditingSupplier(null)
                  setIsOpen(true)
                }}
                className="gap-2 text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                <PlusCircle className="w-4 h-4" /> Add Supplier
              </Button>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Supplier Name</Label>
                  <Input {...register('name')} placeholder="e.g. Apex Biotech" />
                  {errors.name && <p className="text-xs text-red-500">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Contact Number</Label>
                  <Input {...register('contact')} placeholder="e.g. +1 555-0100" />
                </div>

                <div className="space-y-1.5">
                  <Label>Email Address</Label>
                  <Input {...register('email')} placeholder="e.g. info@apexbiotech.com" />
                  {errors.email && <p className="text-xs text-red-500">{errors.email.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Business Address</Label>
                  <Input {...register('address')} placeholder="e.g. 50 Pharma Road, NJ" />
                </div>

                <Button type="submit" className="mt-4 w-full text-white" style={{ backgroundColor: '#2563eb' }}>
                  {editingSupplier ? 'Update Supplier' : 'Save Supplier'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-gray-600">Are you sure you want to delete supplier <strong>{supplierToDelete?.name}</strong>? This action cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteSupplierMutation.mutate(supplierToDelete?.id as string)}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* View Supplier Details Modal */}
          <Dialog open={!!viewingSupplier} onOpenChange={(open) => !open && setViewingSupplier(null)}>
            <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
              <DialogHeader className="border-b border-slate-100 pb-3">
                <DialogTitle className="flex items-center gap-3 text-lg font-bold text-slate-900">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 text-base font-bold text-white shadow-xs">
                    {viewingSupplier ? getInitials(viewingSupplier.name) : 'S'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span>{viewingSupplier?.name}</span>
                      <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${getStatusColor(viewingSupplier?.status || 'active')}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${getStatusDot(viewingSupplier?.status || 'active')}`} />
                        {viewingSupplier?.status || 'Active'}
                      </span>
                    </div>
                    <p className="text-xs font-normal text-slate-400">
                      Vendor Code: #SUP-{viewingSupplier?.id ? String(viewingSupplier.id).slice(0, 8).toUpperCase() : ''}
                    </p>
                  </div>
                </DialogTitle>
              </DialogHeader>

              {viewingSupplier && (
                <div className="space-y-5 py-2">
                  {/* Contact Info Card */}
                  <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3">Vendor Information</p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-100 text-blue-600 flex-shrink-0">
                          <Phone className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400">Phone</p>
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {viewingSupplier.contact ? (
                              <a href={`tel:${viewingSupplier.contact}`} className="text-blue-600 hover:underline">
                                {viewingSupplier.contact}
                              </a>
                            ) : (
                              'N/A'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-100 text-purple-600 flex-shrink-0">
                          <Mail className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400">Email</p>
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {viewingSupplier.email ? (
                              <a href={`mailto:${viewingSupplier.email}`} className="text-purple-600 hover:underline">
                                {viewingSupplier.email}
                              </a>
                            ) : (
                              'N/A'
                            )}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600 flex-shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[11px] text-slate-400">Address</p>
                          <p className="text-xs font-semibold text-slate-800 truncate">
                            {viewingSupplier.address || 'N/A'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Financial & Order Statistics */}
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-medium text-slate-500">Total Purchases</p>
                      <p className="mt-1 text-base font-bold text-slate-900">₵{supplierTotalPurchases.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Total invoiced</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-medium text-slate-500">Total Orders</p>
                      <p className="mt-1 text-base font-bold text-slate-900">{supplierOrdersCount}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Purchase orders</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-medium text-slate-500">This Month</p>
                      <p className="mt-1 text-base font-bold text-slate-900">₵{(viewingSupplier.thisMonthPurchases || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Current volume</p>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-xs">
                      <p className="text-[11px] font-medium text-slate-500">Last Delivery</p>
                      <p className="mt-1 text-xs font-bold text-slate-800">
                        {lastPurchaseDate ? new Date(lastPurchaseDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'No orders yet'}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">Recent PO date</p>
                    </div>
                  </div>

                  {/* Purchase Orders History */}
                  <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-xs">
                    <div className="border-b border-slate-100 bg-slate-50/70 px-4 py-3 flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Supplied Purchase Orders ({supplierPurchases.length})</h4>
                      <span className="text-[11px] text-slate-400">Inventory delivery records</span>
                    </div>

                    {supplierPurchases.length === 0 ? (
                      <p className="py-8 text-center text-xs text-slate-400">No purchase order records found for this supplier.</p>
                    ) : (
                      <div className="max-h-56 overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="border-b border-slate-100 hover:bg-transparent">
                              <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500">PO Number</TableHead>
                              <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500">Date &amp; Time</TableHead>
                              <TableHead className="h-8 px-3 text-[11px] font-semibold text-slate-500">Status</TableHead>
                              <TableHead className="h-8 px-3 text-right text-[11px] font-semibold text-slate-500">Total Amount</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {supplierPurchases.slice(0, 15).map((po: any) => (
                              <TableRow key={po.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                <TableCell className="px-3 py-2 text-xs font-semibold text-slate-800">
                                  PO-{String(po.id).slice(0, 8).toUpperCase()}
                                </TableCell>
                                <TableCell className="px-3 py-2 text-xs text-slate-500">
                                  {new Date(po.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}{' '}
                                  {new Date(po.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                                <TableCell className="px-3 py-2 text-xs">
                                  <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    (po.status || '').toUpperCase() === 'COMPLETED'
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : 'bg-amber-50 text-amber-700'
                                  }`}>
                                    {po.status || 'COMPLETED'}
                                  </span>
                                </TableCell>
                                <TableCell className="px-3 py-2 text-right text-xs font-bold text-slate-900">
                                  ₵{(Number(po.total) || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    )}
                  </div>

                  {/* Modal Actions */}
                  <div className="flex justify-between items-center pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setViewingSupplier(null)}
                    >
                      Close
                    </Button>

                    <Button
                      onClick={() => {
                        const toEdit = viewingSupplier
                        setViewingSupplier(null)
                        openEditModal(toEdit)
                      }}
                      className="gap-2 text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                      Edit Supplier
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : (
            <div className="max-h-[min(60vh,560px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50">
                    <TableHead className="text-slate-700">Supplier</TableHead>
                    <TableHead className="text-slate-700">Phone</TableHead>
                    <TableHead className="text-slate-700">Total Payable</TableHead>
                    <TableHead className="text-slate-700">Status</TableHead>
                    <TableHead className="text-center text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSuppliers.map((sup) => (
                    <TableRow key={sup.id} className="border-b border-slate-100 bg-white transition-colors hover:bg-gradient-to-r hover:from-blue-50 hover:via-white hover:to-indigo-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-sm font-semibold text-white">
                            {getInitials(sup.name)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{sup.name}</div>
                            <div className="text-xs text-slate-500">Vendor profile</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-slate-700">{sup.contact || 'N/A'}</TableCell>
                      <TableCell className="font-semibold text-slate-800">₵{(sup.totalPayable || 0).toFixed(2)}</TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusColor(sup.status || 'active')}`}>
                          <span className={`h-2 w-2 rounded-full ${getStatusDot(sup.status || 'active')}`} />
                          {sup.status || 'Active'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
                            onClick={() => setViewingSupplier(sup)}
                            title="View Supplier Profile"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700" onClick={() => openEditModal(sup)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => openDeleteModal(sup)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedSuppliers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="py-8 text-center text-slate-500">
                        No suppliers found matching the search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredSuppliers.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span>
                {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filteredSuppliers.length)}</span>
                {' '}of <span className="font-semibold text-slate-800">{filteredSuppliers.length}</span> suppliers
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-8 w-8 rounded-md p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

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
    </div>
  )
}
