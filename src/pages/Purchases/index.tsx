import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusCircle,
  ShoppingBag,
  Plus,
  Trash2,
  Calendar,
  Edit2,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Eye,
  TrendingUp,
  Users,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ClipboardList,
  Hash,
  Package,
} from 'lucide-react'
import type { Supplier, Medicine } from '@/types'
import { api } from '@/services/api'

const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

interface PurchaseItemInput {
  medicineId: string
  quantity: number
  cost: number
  batchNumber: string
  expiryDate: string
}

interface Toast {
  id: number
  type: 'success' | 'error'
  message: string
}

const ITEMS_PER_PAGE = 12
let toastId = 0

// ─── Toast ────────────────────────────────────────────────────────────────────
function ToastContainer({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  if (!toasts.length) return null
  return (
    <div className="fixed bottom-5 right-5 z-[9999] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 rounded-xl border px-4 py-3 shadow-lg ${
            t.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
              : 'border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {t.type === 'success' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-600" />
          )}
          <p className="flex-1 text-sm font-medium">{t.message}</p>
          <button onClick={() => onDismiss(t.id)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────────────────────
function PurchaseDetailModal({ purchase, onClose }: { purchase: any; onClose: () => void }) {
  if (!purchase) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50">
              <ClipboardList className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">Purchase Order Detail</p>
              <p className="text-xs text-slate-500">
                {new Date(purchase.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="grid grid-cols-3 gap-3 border-b border-slate-100 px-6 py-4">
          <div className="rounded-lg bg-violet-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-violet-500">Supplier</p>
            <p className="mt-0.5 text-sm font-bold text-violet-800">{purchase.supplier?.name || '—'}</p>
          </div>
          <div className="rounded-lg bg-emerald-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">Total Cost</p>
            <p className="mt-0.5 text-sm font-bold text-emerald-800">₵{Number(purchase.total).toFixed(2)}</p>
          </div>
          <div className="rounded-lg bg-blue-50 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-blue-500">Status</p>
            <p className="mt-0.5 text-sm font-bold text-blue-800">{purchase.status}</p>
          </div>
        </div>

        <div className="px-6 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">Line Items</p>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  {['Product', 'Batch #', 'Expiry', 'Qty', 'Unit Cost', 'Subtotal'].map((h) => (
                    <th key={h} className={`px-4 py-2.5 text-xs font-semibold text-slate-600 ${['Qty','Unit Cost','Subtotal'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {purchase.items?.map((item: any, idx: number) => {
                  const batch = item.batches?.[0]
                  return (
                    <tr key={idx} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{item.medicine?.name || '—'}</td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-600">{batch?.batchNumber || '—'}</td>
                      <td className="px-4 py-2.5 text-xs text-slate-600">
                        {batch?.expiryDate ? new Date(batch.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">₵{Number(item.cost).toFixed(2)}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800">₵{(Number(item.cost) * item.quantity).toFixed(2)}</td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 bg-slate-50">
                  <td colSpan={5} className="px-4 py-2.5 text-right text-sm font-bold text-slate-700">Total</td>
                  <td className="px-4 py-2.5 text-right text-sm font-bold text-emerald-700">₵{Number(purchase.total).toFixed(2)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="border-t border-slate-100 px-6 py-4">
          <button onClick={onClose} className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Close</button>
        </div>
      </div>
    </div>
  )
}

// ─── Form Modal ───────────────────────────────────────────────────────────────
function PurchaseFormModal({
  isOpen, editingPurchase, suppliers, medicines, onSave, onClose, isSaving,
}: {
  isOpen: boolean; editingPurchase: any; suppliers: Supplier[]; medicines: Medicine[];
  onSave: (payload: any) => void; onClose: () => void; isSaving: boolean;
}) {
  const [supplierId, setSupplierId] = useState<string>(editingPurchase?.supplierId || '')
  const [items, setItems] = useState<PurchaseItemInput[]>(() => {
    if (!editingPurchase) return []
    return editingPurchase.items.map((pi: any) => ({
      medicineId: pi.medicineId,
      quantity: pi.quantity,
      cost: pi.cost,
      batchNumber: pi.batches?.[0]?.batchNumber || '',
      expiryDate: pi.batches?.[0]?.expiryDate ? new Date(pi.batches[0].expiryDate).toISOString().split('T')[0] : '',
    }))
  })
  const [rowMedicineId, setRowMedicineId] = useState('')
  const [rowBatchNumber, setRowBatchNumber] = useState('')
  const [rowQuantity, setRowQuantity] = useState('')
  const [rowCost, setRowCost] = useState('')
  const [rowExpiryDate, setRowExpiryDate] = useState('')
  const [rowError, setRowError] = useState('')
  const [supplierError, setSupplierError] = useState('')

  const subtotal = items.reduce((a, i) => a + i.cost * i.quantity, 0)

  const addItem = () => {
    setRowError('')
    if (!rowMedicineId) return setRowError('Select a product.')
    if (!rowBatchNumber.trim()) return setRowError('Batch number is required.')
    const qty = Number(rowQuantity); const cost = Number(rowCost)
    if (!qty || qty <= 0) return setRowError('Enter a valid quantity.')
    if (!cost || cost <= 0) return setRowError('Enter a valid unit cost.')
    if (!rowExpiryDate) return setRowError('Expiry date is required.')
    const today = new Date(); today.setHours(0,0,0,0)
    if (new Date(rowExpiryDate) <= today) return setRowError('Expiry date must be in the future.')
    setItems((p) => [...p, { medicineId: rowMedicineId, quantity: qty, cost, batchNumber: rowBatchNumber.trim().toUpperCase(), expiryDate: rowExpiryDate }])
    setRowMedicineId(''); setRowBatchNumber(''); setRowQuantity(''); setRowCost(''); setRowExpiryDate('')
  }

  const handleSave = () => {
    setSupplierError('')
    if (!supplierId) { setSupplierError('Select a supplier.'); return }
    if (items.length === 0) { setRowError('Add at least one item.'); return }
    onSave({ supplierId, total: subtotal, items })
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 pt-8 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-slate-200 bg-white shadow-2xl mb-8" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-800">{editingPurchase ? 'Edit Purchase Order' : 'New Purchase Order'}</p>
              <p className="text-xs text-slate-500">{editingPurchase ? 'Update supplier and line items' : 'Record a new restock from a supplier'}</p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"><X className="h-4 w-4" /></button>
        </div>

        <div className="space-y-5 px-6 py-5">
          {/* Supplier */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-700">Supplier *</label>
            <select
              value={supplierId}
              onChange={(e) => { setSupplierId(e.target.value); setSupplierError('') }}
              className={`h-10 w-full rounded-xl border bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${supplierError ? 'border-red-400' : 'border-slate-200'}`}
            >
              <option value="">— Select Supplier —</option>
              {suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {supplierError && <p className="mt-1 text-xs text-red-500">{supplierError}</p>}
          </div>

          {/* Row adder */}
          <div className="rounded-xl border border-dashed border-blue-200 bg-blue-50/40 p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-600">
              <Plus className="h-3.5 w-3.5" /> Add Line Item
            </p>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              <div className="md:col-span-3">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Product *</label>
                <select
                  value={rowMedicineId}
                  onChange={(e) => {
                    const id = e.target.value
                    setRowMedicineId(id)
                    const med = medicines.find((m) => m.id === id)
                    if (med?.cost && !rowCost) {
                      setRowCost(String(med.cost))
                    }
                  }}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">— Select Product —</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} {m.cost ? `(Current Cost: ₵${Number(m.cost).toFixed(2)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Lot / Pallet / Batch # *</label>
                <input value={rowBatchNumber} onChange={(e) => setRowBatchNumber(e.target.value)} placeholder="e.g. LOT-2024A"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs uppercase focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Cartons / Qty *</label>
                <input type="number" min="1" value={rowQuantity} onChange={(e) => setRowQuantity(e.target.value)} placeholder="0"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Cost per Carton (₵) *</label>
                <input type="number" min="0.01" step="0.01" value={rowCost} onChange={(e) => setRowCost(e.target.value)} placeholder="0.00"
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-[11px] font-semibold text-slate-600">Best Before / Expiry Date *</label>
                <input type="date" value={rowExpiryDate} onChange={(e) => setRowExpiryDate(e.target.value)}
                  className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            {rowError && <p className="mt-2 flex items-center gap-1.5 text-xs text-red-600"><AlertCircle className="h-3.5 w-3.5" /> {rowError}</p>}
            <button onClick={addItem} className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">
              <Plus className="h-3.5 w-3.5" /> Add to Order
            </button>
          </div>

          {/* Items table */}
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-left">
                  {['Product','Lot / Batch','Best Before','Cartons','Carton ₵','Total',''].map((h,i) => (
                    <th key={i} className={`px-3 py-2.5 font-semibold text-slate-600 ${['Cartons','Carton ₵','Total'].includes(h) ? 'text-right' : ''}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length > 0 ? items.map((item, i) => {
                  const med = medicines.find((m) => m.id === item.medicineId)
                  return (
                    <tr key={i} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-semibold text-slate-800">{med?.name || '—'}</td>
                      <td className="px-3 py-2.5 font-mono text-slate-600">{item.batchNumber}</td>
                      <td className="px-3 py-2.5 text-slate-600">{new Date(item.expiryDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">{item.quantity}</td>
                      <td className="px-3 py-2.5 text-right text-slate-700">₵{item.cost.toFixed(2)}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-800">₵{(item.cost * item.quantity).toFixed(2)}</td>
                      <td className="px-3 py-2.5">
                        <button onClick={() => setItems((p) => p.filter((_, j) => j !== i))} className="rounded-md p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  )
                }) : (
                  <tr><td colSpan={7} className="py-8 text-center text-slate-400">No items yet — add line items above.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs text-slate-500">Order Total</p>
            <p className="text-xl font-bold text-slate-800">₵{subtotal.toFixed(2)}</p>
            {items.length > 0 && <p className="text-[11px] text-slate-400">{items.length} line item{items.length !== 1 ? 's' : ''}</p>}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
            <button onClick={handleSave} disabled={isSaving || !supplierId || items.length === 0}
              className="flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
              {isSaving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : editingPurchase ? 'Update Order' : 'Save Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirmModal({ purchase, isDeleting, onConfirm, onClose }: { purchase: any; isDeleting: boolean; onConfirm: () => void; onClose: () => void }) {
  if (!purchase) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="p-6">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50"><Trash2 className="h-6 w-6 text-red-500" /></div>
          <h3 className="text-base font-bold text-slate-800">Delete Purchase Order?</h3>
          <p className="mt-1.5 text-sm text-slate-500">This permanently deletes the order and removes all associated batch stock. This cannot be undone.</p>
        </div>
        <div className="flex gap-3 border-t border-slate-100 px-6 pb-6">
          <button onClick={onClose} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50">Cancel</button>
          <button onClick={onConfirm} disabled={isDeleting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-red-500 py-2.5 text-sm font-semibold text-white hover:bg-red-600 disabled:opacity-60">
            {isDeleting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isDeleting ? 'Deleting…' : 'Yes, Delete'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Purchases() {
  const queryClient = useQueryClient()
  const [currentPage, setCurrentPage] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingPurchase, setEditingPurchase] = useState<any>(null)
  const [purchaseToDelete, setPurchaseToDelete] = useState<any>(null)
  const [viewingPurchase, setViewingPurchase] = useState<any>(null)
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = (type: 'success' | 'error', message: string) => {
    const id = ++toastId
    setToasts((p) => [...p, { id, type, message }])
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000)
  }

  const { data: purchases = [], isLoading } = useQuery<any[]>({
    queryKey: ['purchases'],
    queryFn: () => apiClient.getPurchases(),
  })
  const { data: suppliers = [] } = useQuery<Supplier[]>({ queryKey: ['suppliers'], queryFn: () => apiClient.getSuppliers() })
  const { data: medicines = [] } = useQuery<Medicine[]>({ queryKey: ['medicines'], queryFn: () => apiClient.getMedicines() })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['purchases'] })
    queryClient.invalidateQueries({ queryKey: ['batches'] })
    queryClient.invalidateQueries({ queryKey: ['medicines'] })
    queryClient.invalidateQueries({ queryKey: ['inventory'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
  }

  const createMutation = useMutation({
    mutationFn: (d: any) => apiClient.createPurchase(d),
    onSuccess: () => { invalidate(); setIsFormOpen(false); setEditingPurchase(null); addToast('success', 'Purchase order saved and stock updated.') },
    onError: (e: any) => addToast('error', e?.message || 'Failed to save purchase.'),
  })
  const updateMutation = useMutation({
    mutationFn: (d: any) => apiClient.updatePurchase(editingPurchase?.id, d),
    onSuccess: () => { invalidate(); setIsFormOpen(false); setEditingPurchase(null); addToast('success', 'Purchase order updated.') },
    onError: (e: any) => addToast('error', e?.message || 'Failed to update purchase.'),
  })
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiClient.deletePurchase(id),
    onSuccess: () => { invalidate(); setPurchaseToDelete(null); addToast('success', 'Purchase order deleted.') },
    onError: (e: any) => addToast('error', e?.message || 'Failed to delete purchase.'),
  })

  const totalSpend = purchases.reduce((s, p) => s + Number(p.total || 0), 0)
  const activeSuppliers = new Set(purchases.map((p) => p.supplier?.name).filter(Boolean)).size
  const thisMonth = useMemo(() => {
    const now = new Date()
    return purchases.filter((p) => { const d = new Date(p.date); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() }).length
  }, [purchases])

  const filtered = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return purchases
    return purchases.filter((p) =>
      p.supplier?.name?.toLowerCase().includes(q) ||
      p.status?.toLowerCase().includes(q) ||
      p.items?.some((i: any) => i.medicine?.name?.toLowerCase().includes(q))
    )
  }, [purchases, searchQuery])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(currentPage, totalPages)
  const start = (safePage - 1) * ITEMS_PER_PAGE
  const paginated = filtered.slice(start, start + ITEMS_PER_PAGE)
  const isSaving = createMutation.isPending || updateMutation.isPending

  return (
    <div className="h-full overflow-y-auto bg-[#f8f9fb] font-sans">
      <ToastContainer toasts={toasts} onDismiss={(id) => setToasts((p) => p.filter((t) => t.id !== id))} />

      {isFormOpen && (
        <PurchaseFormModal
          isOpen={isFormOpen}
          editingPurchase={editingPurchase}
          suppliers={suppliers}
          medicines={medicines}
          onSave={(payload) => editingPurchase ? updateMutation.mutate(payload) : createMutation.mutate(payload)}
          onClose={() => { setIsFormOpen(false); setEditingPurchase(null) }}
          isSaving={isSaving}
        />
      )}
      <DeleteConfirmModal
        purchase={purchaseToDelete}
        isDeleting={deleteMutation.isPending}
        onConfirm={() => deleteMutation.mutate(purchaseToDelete?.id)}
        onClose={() => setPurchaseToDelete(null)}
      />
      <PurchaseDetailModal purchase={viewingPurchase} onClose={() => setViewingPurchase(null)} />

      <div className="space-y-4 p-3.5 sm:p-5">
        {/* Banner */}
        <div
          className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs"
          style={{ backgroundColor: '#2563eb' }}
        >
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
          <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />
          <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                  Procurement
                </span>
                <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                  Stock Received
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-bold leading-tight">Purchase Orders</h1>
            </div>
            <div className="grid grid-cols-3 gap-2 flex-shrink-0">
              <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-sky-100">
                  <ClipboardList className="h-3 w-3" /> Orders
                </div>
                <p className="mt-0.5 text-base sm:text-lg font-bold">{purchases.length}</p>
                <p className="text-[9px] text-sky-200">{thisMonth} this month</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-amber-400/15 px-2.5 py-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-100">
                  <TrendingUp className="h-3 w-3" /> Spend
                </div>
                <p className="mt-0.5 text-base sm:text-lg font-bold">₵{totalSpend.toLocaleString('en-GH', { minimumFractionDigits: 2 })}</p>
                <p className="text-[9px] text-amber-200">Cumulative</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-emerald-400/15 px-2.5 py-1.5 backdrop-blur-sm">
                <div className="flex items-center gap-1 text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100">
                  <Users className="h-3 w-3" /> Suppliers
                </div>
                <p className="mt-0.5 text-base sm:text-lg font-bold">{activeSuppliers}</p>
                <p className="text-[9px] text-emerald-200">Active</p>
              </div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative flex-1 min-w-[220px] max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1) }}
              placeholder="Search supplier, product, status…"
              className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <button onClick={() => { setEditingPurchase(null); setIsFormOpen(true) }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:scale-[0.98]">
            <PlusCircle className="h-4 w-4" /> New Purchase Order
          </button>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50/40 to-indigo-50/40 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-blue-600" />
              <span className="text-sm font-semibold text-slate-800">Procurement Ledger</span>
              {searchQuery && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold text-blue-700">{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>}
            </div>
            <span className="text-xs text-slate-400">{purchases.length} total orders</span>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center gap-3 text-slate-500">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <span className="text-sm">Loading purchase orders…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center text-slate-400">
              <ShoppingBag className="mb-3 h-10 w-10 text-slate-300" />
              <p className="text-sm font-medium">{searchQuery ? 'No matching orders found.' : 'No purchase orders yet.'}</p>
              {!searchQuery && (
                <button onClick={() => { setEditingPurchase(null); setIsFormOpen(true) }}
                  className="mt-3 flex items-center gap-1.5 text-sm font-semibold text-blue-600 hover:underline">
                  <Plus className="h-3.5 w-3.5" /> Record your first purchase
                </button>
              )}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                  <th className="px-5 py-3">#</th>
                  <th className="px-5 py-3">Date</th>
                  <th className="px-5 py-3">Supplier</th>
                  <th className="px-5 py-3">Items</th>
                  <th className="px-5 py-3 text-right">Total Cost</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((pur, idx) => (
                  <tr key={pur.id} className="border-b border-slate-100 last:border-0 transition-colors hover:bg-blue-50/40">
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Hash className="h-3 w-3" />{start + idx + 1}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5 text-slate-600">
                        <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                        <div>
                          <p className="text-xs font-medium">{new Date(pur.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="text-[10px] text-slate-400">{new Date(pur.date).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="inline-flex items-center rounded-full border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-700">{pur.supplier?.name || '—'}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-slate-400" /><span className="text-xs text-slate-600">{pur.items?.length ?? 0} line{pur.items?.length !== 1 ? 's' : ''}</span></div>
                    </td>
                    <td className="px-5 py-3.5 text-right"><span className="font-bold text-emerald-600">₵{Number(pur.total).toFixed(2)}</span></td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${pur.status === 'COMPLETED' || pur.status === 'RECEIVED' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : pur.status === 'PENDING' ? 'bg-amber-50 text-amber-700 ring-amber-200' : 'bg-slate-100 text-slate-600 ring-slate-200'}`}>
                        {pur.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button onClick={() => setViewingPurchase(pur)} title="View" className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Eye className="h-3.5 w-3.5" /></button>
                        <button onClick={() => { setEditingPurchase(pur); setIsFormOpen(true) }} title="Edit" className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-blue-50 hover:text-blue-600"><Edit2 className="h-3.5 w-3.5" /></button>
                        <button onClick={() => setPurchaseToDelete(pur)} title="Delete" className="rounded-lg bg-slate-50 p-2 text-slate-500 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <p className="text-sm text-slate-600">
              Showing <span className="font-semibold text-slate-800">{start + 1}</span>–<span className="font-semibold text-slate-800">{Math.min(start + ITEMS_PER_PAGE, filtered.length)}</span> of <span className="font-semibold text-slate-800">{filtered.length}</span> orders
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={safePage === 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button key={p} onClick={() => setCurrentPage(p)}
                  className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${p === safePage ? 'bg-blue-600 text-white shadow-sm' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                  {p}
                </button>
              ))}
              <button onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={safePage === totalPages}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
