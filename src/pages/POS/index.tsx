import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Search,
  Barcode,
  PauseCircle,
  MoreHorizontal,
  ShoppingCart,
  Trash2,
  Minus,
  Plus,
  X,
  CreditCard,
  Smartphone,
  Banknote,
  ArrowRight,
  Keyboard,
  Maximize2,
  Grid3X3,
  List,
  Package,
  Snowflake,
  Archive,
  User,
  CheckCircle2,
  AlertCircle,
  Play,
  Split,
  Printer,
  Bluetooth,
  BluetoothConnected,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import type { Category, Customer, Medicine } from '@/types'
import { cn } from '@/utils'
import { bluetoothPrinter, BluetoothPrinterStatus } from '@/services/hardware/bluetoothPrinter'
import { barcodeScanner } from '@/services/hardware/barcodeScanner'
import { api } from '@/services/api'

export interface SplitPaymentEntry {
  method: 'CASH' | 'MOBILE'
  amount: number
}

export interface PaymentConfirmedData {
  saleId: string
  total: number
  paymentMethod: 'CASH' | 'MOBILE' | 'SPLIT'
  payments: { method: string; amount: number }[]
  cashTendered?: number | ''
  changeDue: number
  customerName: string
  itemCount: number
  receiptHTML: string
  timestamp: string
}

interface CartItem {
  medicine: any
  quantity: number
  maxAvailable: number
  validBatches: any[]
  allocations: { batchId: string; batchNumber: string; expiryDate: string; quantity: number }[]
}

interface HeldSale {
  id: string
  timestamp: string
  cart: CartItem[]
  discountPercent: number
  customerId?: string
  paymentMethod: 'CASH' | 'MOBILE' | 'SPLIT'
  splitPayments?: SplitPaymentEntry[]
  cashTendered?: number | ''
}

interface ToastMessage {
  type: 'success' | 'error'
  message: string
}

const CATEGORY_ICONS: Record<string, string> = {
  poultry: '🍗',
  chicken: '🍗',
  fish: '🐟',
  seafood: '🦐',
  meat: '🥩',
  beef: '🥩',
  turkey: '🦃',
  pork: '🥓',
  sausage: '🌭',
  french: '🍟',
  fries: '🍟',
  ice: '🍦',
  dairy: '🧀',
  vegetable: '🥦',
}

const CARD_GRADIENTS = [
  'from-sky-100 to-blue-50',
  'from-cyan-100 to-teal-50',
  'from-blue-100 to-indigo-50',
  'from-indigo-100 to-slate-50',
  'from-amber-100 to-orange-50',
  'from-emerald-100 to-green-50',
  'from-violet-100 to-purple-50',
  'from-rose-100 to-pink-50',
]

function getCategoryIcon(name: string) {
  const key = name.toLowerCase()
  for (const [k, icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(k)) return icon
  }
  return '📦'
}

function getCardGradient(id?: string) {
  if (!id) return CARD_GRADIENTS[0]
  let hash = 0
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i)
  return CARD_GRADIENTS[hash % CARD_GRADIENTS.length]
}

function allocateFEFO(validBatches: any[], requestedQty: number) {
  const allocations: { batchId: string; batchNumber: string; expiryDate: string; quantity: number }[] = []
  let needed = requestedQty
  for (const b of validBatches) {
    if (needed <= 0) break
    const take = Math.min(b.quantity, needed)
    allocations.push({
      batchId: b.id,
      batchNumber: b.batchNumber,
      expiryDate: b.expiryDate,
      quantity: take,
    })
    needed -= take
  }
  return allocations
}

function MedicineCard({ product, onAdd }: { product: any; onAdd: () => void }) {
  const med = product?.medicine || {}
  const inStock = (product?.totalStock || 0) > 0

  return (
    <div
      onClick={inStock ? onAdd : undefined}
      title={med.name || 'Product'}
      className={cn(
        'group flex flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-2xs transition-all select-none',
        inStock
          ? 'cursor-pointer hover:border-blue-400 hover:shadow-md hover:-translate-y-0.5'
          : 'opacity-60 cursor-not-allowed'
      )}
    >
      {/* Compact Header Visual Banner */}
      <div className={cn('relative flex h-[50px] sm:h-[56px] items-center justify-center bg-gradient-to-br', getCardGradient(med.id))}>
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/80 shadow-2xs backdrop-blur-xs group-hover:scale-105 transition-transform">
          <Package className="h-4 w-4 text-sky-600/90" />
        </div>
        {inStock && (
          <span className="absolute top-1 right-1 rounded-full bg-white/95 px-1.5 py-0.5 text-[9px] font-bold text-slate-700 shadow-2xs">
            {product.totalStock} ctn
          </span>
        )}
      </div>

      {/* Content Body */}
      <div className="flex flex-1 flex-col justify-between p-2 gap-1.5">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold leading-tight text-slate-800 group-hover:text-blue-600 transition-colors">
            {med.name || 'Unnamed Product'}
          </p>
          <p className="mt-0.5 truncate text-[10px] text-slate-400">
            {med.genericName || med.category?.name || `${product?.batchCount || 0} lot(s)`}
          </p>
        </div>

        <div className="flex items-center justify-between gap-1 pt-1 border-t border-slate-100">
          <div className="min-w-0">
            <p className="text-xs sm:text-sm font-extrabold text-slate-900 leading-none">
              ₵{typeof med.price === 'number' ? med.price.toFixed(2) : '0.00'}
            </p>
            <p className={cn('text-[9px] font-semibold mt-0.5', inStock ? 'text-emerald-600' : 'text-rose-500')}>
              {inStock ? 'In Stock' : 'Out of stock'}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (inStock) onAdd()
            }}
            disabled={!inStock}
            className={cn(
              'flex h-6 w-6 sm:h-6.5 sm:w-6.5 flex-shrink-0 items-center justify-center rounded-full transition-all',
              inStock
                ? 'bg-blue-600 text-white shadow-xs hover:bg-blue-700 active:scale-90 group-hover:bg-blue-700'
                : 'cursor-not-allowed bg-slate-100 text-slate-300'
            )}
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}

const PAGE_SIZE = 24

function CartPanelContent({
  cart,
  clearCart,
  selectedCustomerId,
  setSelectedCustomerId,
  customers,
  removeFromCart,
  updateQty,
  enableDiscount,
  discountPercent,
  setDiscountPercent,
  subtotal,
  discountAmt,
  enableTax,
  taxRate,
  tax,
  total,
  currencySymbol,
  paymentMethod,
  setPaymentMethod,
  splitPayments,
  setSplitPayments,
  cashTendered,
  setCashTendered,
  handleCheckout,
  createSaleMutation,
  setToast,
  onClose,
}: any) {
  const [isTrayCollapsed, setIsTrayCollapsed] = useState(false)
  const allocatedTotal = paymentMethod === 'SPLIT'
    ? splitPayments.reduce((acc: number, p: any) => acc + (Number(p.amount) || 0), 0)
    : total
  const remainingToAllocate = Math.max(0, Math.round((total - allocatedTotal) * 100) / 100)
  const overAllocated = Math.max(0, Math.round((allocatedTotal - total) * 100) / 100)
  const isSplitBalanced = Math.abs(allocatedTotal - total) < 0.01

  const cashSplitEntry = splitPayments?.find((p: any) => p.method === 'CASH')
  const cashAmount = cashSplitEntry ? Number(cashSplitEntry.amount) || 0 : 0
  const changeDue = (typeof cashTendered === 'number' && cashTendered > cashAmount)
    ? Math.round((cashTendered - cashAmount) * 100) / 100
    : 0

  const handleSplit5050 = () => {
    const half = Math.round((total / 2) * 100) / 100
    const otherHalf = Math.round((total - half) * 100) / 100
    setSplitPayments([
      { method: 'CASH', amount: half },
      { method: 'MOBILE', amount: otherHalf },
    ])
  }

  const handleResetSplit = () => {
    setSplitPayments([
      { method: 'CASH', amount: total },
      { method: 'MOBILE', amount: 0 },
    ])
  }

  const handleFillRow = (index: number) => {
    const otherAllocated = splitPayments.reduce((acc: number, p: any, idx: number) => {
      return idx === index ? acc : acc + (Number(p.amount) || 0)
    }, 0)
    const needed = Math.max(0, Math.round((total - otherAllocated) * 100) / 100)
    setSplitPayments((prev: any[]) =>
      prev.map((item, idx) => (idx === index ? { ...item, amount: needed } : item))
    )
  }

  const handleUpdateSplitAmount = (index: number, val: number) => {
    setSplitPayments((prev: any[]) =>
      prev.map((item, idx) => (idx === index ? { ...item, amount: isNaN(val) ? 0 : Math.max(0, val) } : item))
    )
  }

  const handleUpdateSplitMethod = (index: number, method: any) => {
    setSplitPayments((prev: any[]) =>
      prev.map((item, idx) => (idx === index ? { ...item, method } : item))
    )
  }

  const handleAddSplitMethod = () => {
    if (splitPayments.length >= 2) return
    const usedMethods = new Set(splitPayments.map((p: any) => p.method))
    const nextMethod = usedMethods.has('CASH') ? 'MOBILE' : 'CASH'
    const needed = Math.max(0, Math.round((total - allocatedTotal) * 100) / 100)
    setSplitPayments((prev: any[]) => [...prev, { method: nextMethod, amount: needed }])
  }

  const handleAddRemainder = (targetMethod: 'CASH' | 'MOBILE') => {
    const remaining = Math.max(0, Math.round((total - allocatedTotal) * 100) / 100)
    if (remaining <= 0) return
    setSplitPayments((prev: any[]) => {
      const idx = prev.findIndex((p: any) => p.method === targetMethod)
      if (idx !== -1) {
        return prev.map((item: any, i: number) =>
          i === idx ? { ...item, amount: Math.round(((item.amount || 0) + remaining) * 100) / 100 } : item
        )
      } else {
        return [...prev, { method: targetMethod, amount: remaining }]
      }
    })
  }

  const handleRemoveSplitRow = (index: number) => {
    if (splitPayments.length <= 1) return
    setSplitPayments((prev: any[]) => prev.filter((_: any, idx: number) => idx !== index))
  }
  return (
    <div className="flex flex-1 flex-col overflow-hidden bg-[#fafbfc]">
      <div className="flex items-center justify-between border-b border-slate-200/80 bg-white px-4 py-3.5">
        <h3 className="text-sm font-bold text-slate-800">Current Sale</h3>
        <div className="flex items-center gap-1">
          <button
            onClick={clearCart}
            disabled={cart.length === 0}
            className="rounded-lg p-1.5 text-red-400 transition-colors hover:bg-red-50 hover:text-red-500 disabled:opacity-30"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Customer selection */}
      <div className="border-b border-slate-200/80 bg-white px-4 py-2.5">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-1.5">
          <User className="h-3.5 w-3.5 text-slate-400" />
          <select
            value={selectedCustomerId}
            onChange={(e) => setSelectedCustomerId(e.target.value)}
            className="w-full bg-transparent text-xs font-medium text-slate-700 outline-none"
          >
            <option value="">Walk-in Customer</option>
            {customers.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.phone || 'No phone'})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-slate-300">
            <ShoppingCart className="mb-2 h-10 w-10" />
            <p className="text-xs font-medium text-slate-400">Cart is empty</p>
            <p className="mt-1 text-[11px] text-slate-300">Select frozen products to start checkout</p>
          </div>
        ) : (
          cart.map((item: any) => (
            <div
              key={item.medicine.id}
              className="flex flex-col gap-1.5 rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
            >
              <div className="flex items-start gap-2.5">
                <div
                  className={cn(
                    'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br',
                    getCardGradient(item.medicine.id)
                  )}
                >
                  <Snowflake className="h-4 w-4 text-sky-500/80" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold leading-tight text-slate-800">
                    {item.medicine.name}
                  </p>
                  <p className="truncate text-[10px] text-slate-400">
                    {currencySymbol}{item.medicine.price.toFixed(2)} each
                  </p>
                </div>
                <div className="flex flex-shrink-0 flex-col items-end">
                  <p className="text-xs font-bold text-slate-800">
                    {currencySymbol}{(item.medicine.price * item.quantity).toFixed(2)}
                  </p>
                  <button
                    onClick={() => removeFromCart(item.medicine.id)}
                    className="mt-1 text-slate-300 transition-colors hover:text-red-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-slate-500">Qty:</span>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => updateQty(item.medicine.id, -1)}
                    className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95"
                  >
                    <Minus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </button>
                  <span className="w-6 text-center text-xs font-bold text-slate-800">{item.quantity}</span>
                  <button
                    onClick={() => updateQty(item.medicine.id, 1)}
                    disabled={item.quantity >= item.maxAvailable}
                    className="flex h-7 w-7 sm:h-6 sm:w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50 active:scale-95 disabled:opacity-30"
                  >
                    <Plus className="h-3.5 w-3.5 sm:h-3 sm:w-3" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* ── Summary & Checkout Tray ── */}
      <div className="border-t border-slate-200/90 bg-white shadow-lg transition-all duration-300">
        {/* Tray Toggle Bar (Down/Up arrow header) */}
        <div
          onClick={() => setIsTrayCollapsed(!isTrayCollapsed)}
          className="flex cursor-pointer items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-blue-50/40 px-3.5 py-2 hover:bg-slate-100/90 transition-colors select-none group"
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              id="pos-tray-toggle-btn"
              onClick={(e) => {
                e.stopPropagation()
                setIsTrayCollapsed(!isTrayCollapsed)
              }}
              title={isTrayCollapsed ? "Push up to view checkout summary" : "Push down to view selected items"}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 shadow-xs transition-all group-hover:border-blue-300 group-hover:text-blue-600 active:scale-95"
            >
              {isTrayCollapsed ? (
                <ChevronUp className="h-4 w-4 text-blue-600 transition-transform" />
              ) : (
                <ChevronDown className="h-4 w-4 text-slate-600 group-hover:text-blue-600 transition-transform" />
              )}
            </button>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                Totals & Checkout
                <span className="rounded-full bg-blue-100 px-1.5 py-0.2 text-[10px] font-extrabold text-blue-700">
                  {cart.reduce((sum: number, item: any) => sum + item.quantity, 0)} items
                </span>
              </span>
              <span className="text-[10px] text-slate-400">
                {isTrayCollapsed ? 'Click up arrow to view payment & complete sale' : 'Click down arrow to view selected items'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Total</p>
              <p className="text-sm font-black text-blue-600">{currencySymbol}{total.toFixed(2)}</p>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                setIsTrayCollapsed(!isTrayCollapsed)
              }}
              className="p-1 text-slate-400 group-hover:text-blue-600 transition-colors"
            >
              {isTrayCollapsed ? (
                <ChevronUp className="h-4 w-4 text-blue-600" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Collapsible Tray Content */}
        {!isTrayCollapsed && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
            {enableDiscount && (
        <div className="border-t border-slate-200/80 bg-white px-4 py-3">
          <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="flex-shrink-0 text-[11px] font-medium text-slate-500">% Discount</span>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              value={discountPercent || ''}
              onChange={(e) => setDiscountPercent(Math.min(100, Number(e.target.value) || 0))}
              placeholder="0.00"
              className="w-full bg-transparent text-right text-xs font-semibold text-slate-700 outline-none"
            />
          </div>
        </div>
      )}

      <div className="space-y-2 border-t border-slate-200/80 bg-white px-4 py-3">
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>Subtotal</span>
          <span className="font-medium text-slate-700">{currencySymbol}{subtotal.toFixed(2)}</span>
        </div>
        {enableDiscount && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Discount ({discountPercent}%)</span>
            <span className="font-medium text-slate-700">-{currencySymbol}{discountAmt.toFixed(2)}</span>
          </div>
        )}
        {enableTax && (
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Tax (VAT {taxRate}%)</span>
            <span className="font-medium text-slate-700">{currencySymbol}{tax.toFixed(2)}</span>
          </div>
        )}
        <div className="flex items-center justify-between border-t border-slate-100 pt-2">
          <span className="text-sm font-bold text-slate-800">Total</span>
          <span className="text-lg font-bold text-blue-600">{currencySymbol}{total.toFixed(2)}</span>
        </div>
      </div>

      <div className="bg-white px-4 pb-3">
        {/* Payment Method Selector (3 options: Cash, Mobile, Split) */}
        <div className="mb-2.5 grid grid-cols-3 gap-1.5 sm:gap-2">
          <button
            type="button"
            onClick={() => setPaymentMethod('CASH')}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-white transition-all active:scale-95 shadow-xs',
              paymentMethod === 'CASH' ? 'ring-2 ring-emerald-400 ring-offset-1 scale-[1.02]' : 'opacity-85 hover:opacity-100'
            )}
            style={{ background: 'linear-gradient(135deg, #22c55e, #16a34a)' }}
          >
            <Banknote className="h-4 w-4" />
            Cash
          </button>
          <button
            type="button"
            onClick={() => setPaymentMethod('MOBILE')}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-white transition-all active:scale-95 shadow-xs',
              paymentMethod === 'MOBILE' ? 'ring-2 ring-amber-400 ring-offset-1 scale-[1.02]' : 'opacity-85 hover:opacity-100'
            )}
            style={{ background: 'linear-gradient(135deg, #f59e0b, #ea580c)' }}
          >
            <Smartphone className="h-4 w-4" />
            Mobile
          </button>
          <button
            type="button"
            onClick={() => {
              setPaymentMethod('SPLIT')
              if (splitPayments.every((p: any) => (Number(p.amount) || 0) === 0)) {
                const half = Math.round((total / 2) * 100) / 100
                setSplitPayments([
                  { method: 'CASH', amount: half },
                  { method: 'MOBILE', amount: Math.round((total - half) * 100) / 100 },
                ])
              }
            }}
            className={cn(
              'flex flex-col items-center gap-1 rounded-xl py-2 sm:py-2.5 text-[10px] sm:text-[11px] font-bold text-white transition-all active:scale-95 shadow-xs',
              paymentMethod === 'SPLIT' ? 'ring-2 ring-purple-400 ring-offset-1 scale-[1.02]' : 'opacity-85 hover:opacity-100'
            )}
            style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}
          >
            <Split className="h-4 w-4" />
            Split
          </button>
        </div>

        {/* Cash Tendered & Change Input */}
        {paymentMethod === 'CASH' && (
          <div className="mb-3 space-y-2 rounded-xl border border-emerald-200 bg-emerald-50/60 p-2.5 sm:p-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between text-xs font-bold text-emerald-900">
              <span className="flex items-center gap-1.5">
                <Banknote className="h-4 w-4 text-emerald-600" />
                Cash Tendered / Received
              </span>
              <button
                type="button"
                onClick={() => setCashTendered(total)}
                className="rounded-md bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 hover:bg-emerald-200 transition-colors"
              >
                Exact ({currencySymbol}{total.toFixed(2)})
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-2.5 top-1.5 text-xs font-bold text-slate-400">{currencySymbol}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder={total.toFixed(2)}
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-6 pr-2.5 text-right text-sm font-bold text-slate-800 outline-none focus:border-emerald-400"
              />
            </div>
            {typeof cashTendered === 'number' && cashTendered > total && (
              <div className="flex items-center justify-between rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-xs font-bold shadow-xs">
                <span>Change to Return:</span>
                <span className="text-sm font-black">{currencySymbol}{(cashTendered - total).toFixed(2)}</span>
              </div>
            )}
          </div>
        )}

        {/* Mobile Payment Confirmation Banner */}
        {paymentMethod === 'MOBILE' && (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 sm:p-3 animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
              <span className="flex items-center gap-1.5">
                <Smartphone className="h-4 w-4 text-amber-600" />
                Mobile Money (MoMo)
              </span>
              <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-bold">Direct MoMo</span>
            </div>
            <p className="text-[11px] text-amber-700/90 leading-tight">
              Collect <strong>{currencySymbol}{total.toFixed(2)}</strong> via MoMo prompt, merchant pay, or USSD transfer.
            </p>
          </div>
        )}

        {/* Split Payment Breakdown Panel */}
        {paymentMethod === 'SPLIT' && (
          <div className="mb-3 space-y-2 rounded-xl border border-purple-200 bg-purple-50/60 p-2.5 sm:p-3 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                <Split className="h-3.5 w-3.5 text-purple-600" />
                Split Allocation
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handleSplit5050}
                  className="rounded-md bg-purple-100 px-2 py-0.5 text-[10px] font-semibold text-purple-700 hover:bg-purple-200 transition-colors"
                >
                  50 / 50
                </button>
                <button
                  type="button"
                  onClick={handleResetSplit}
                  className="rounded-md bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700 hover:bg-slate-300 transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>

            {/* Payment Method Rows */}
            <div className="space-y-1.5">
              {splitPayments.map((p: any, idx: number) => (
                <div key={idx} className="flex items-center gap-1.5 bg-white/95 p-1.5 rounded-lg border border-purple-100 shadow-2xs">
                  <select
                    value={p.method}
                    onChange={(e) => handleUpdateSplitMethod(idx, e.target.value)}
                    className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] font-semibold text-slate-700 outline-none focus:border-purple-400"
                  >
                    <option value="CASH">Cash</option>
                    <option value="MOBILE">Mobile Money</option>
                  </select>

                  <div className="relative flex-1 min-w-0">
                    <span className="absolute left-2 top-1 text-[11px] font-bold text-slate-400">{currencySymbol}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.amount === 0 ? '' : p.amount}
                      onChange={(e) => handleUpdateSplitAmount(idx, parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="w-full rounded border border-slate-200 bg-white py-1 pl-5 pr-1.5 text-right text-xs font-bold text-slate-800 outline-none focus:border-purple-400"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => handleFillRow(idx)}
                    title="Fill remaining balance into this method"
                    className="rounded bg-purple-100 px-2 py-1 text-[10px] font-bold text-purple-700 hover:bg-purple-200 active:scale-95 transition-colors"
                  >
                    Fill
                  </button>

                  {splitPayments.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveSplitRow(idx)}
                      className="p-1 text-slate-300 hover:text-red-500 rounded transition-colors"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {splitPayments.length < 2 && (
              <button
                type="button"
                onClick={handleAddSplitMethod}
                className="w-full text-center py-1 rounded-lg border border-dashed border-purple-300 text-[11px] font-semibold text-purple-700 hover:bg-purple-100/60 transition-colors"
              >
                + Add Mobile / Cash Split
              </button>
            )}

            {/* Split Status Bar */}
            <div className="pt-1.5 border-t border-purple-200/60 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-slate-500">Allocated / Total:</span>
                <span className="font-bold text-slate-700">{currencySymbol}{allocatedTotal.toFixed(2)} / {currencySymbol}{total.toFixed(2)}</span>
              </div>

              {!isSplitBalanced && remainingToAllocate > 0 && (
                <div className="rounded-md bg-amber-50 p-2 space-y-1.5 border border-amber-200">
                  <div className="flex items-center justify-between text-[11px] font-bold text-amber-900">
                    <span>Remaining to Allocate:</span>
                    <span className="text-amber-800 font-extrabold">{currencySymbol}{remainingToAllocate.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => handleAddRemainder('CASH')}
                      className="flex-1 py-1 px-1.5 rounded-md bg-emerald-600 text-white font-bold text-[10px] hover:bg-emerald-700 active:scale-95 transition-all text-center shadow-xs"
                    >
                      + Add to Cash
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAddRemainder('MOBILE')}
                      className="flex-1 py-1 px-1.5 rounded-md bg-amber-500 text-white font-bold text-[10px] hover:bg-amber-600 active:scale-95 transition-all text-center shadow-xs"
                    >
                      + Add to Mobile
                    </button>
                  </div>
                </div>
              )}

              {!isSplitBalanced && overAllocated > 0 && (
                <div className="flex items-center justify-between rounded-md bg-red-100/80 px-2 py-1 text-[11px] font-bold text-red-800">
                  <span>Over-allocated by:</span>
                  <span>{currencySymbol}{overAllocated.toFixed(2)}</span>
                </div>
              )}

              {isSplitBalanced && (
                <div className="flex items-center justify-between rounded-md bg-emerald-100/80 px-2 py-1 text-[11px] font-bold text-emerald-800">
                  <span>Split Status:</span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                    100% Balanced
                  </span>
                </div>
              )}

              {/* Cash Portion Change Calculation (if cash is part of split) */}
              {cashAmount > 0 && (
                <div className="mt-2 pt-2 border-t border-purple-200/60">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] text-slate-600">Cash Handed / Tendered:</span>
                    <div className="relative w-24">
                      <span className="absolute left-2 top-1 text-[10px] font-bold text-slate-400">{currencySymbol}</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder={cashAmount.toFixed(2)}
                        value={cashTendered}
                        onChange={(e) => setCashTendered(e.target.value === '' ? '' : Number(e.target.value))}
                        className="w-full rounded border border-slate-200 bg-white py-0.5 pl-4 pr-1 text-right text-xs font-bold text-slate-800 outline-none focus:border-purple-400"
                      />
                    </div>
                  </div>
                  {changeDue > 0 && (
                    <div className="mt-1 flex items-center justify-between rounded bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-800">
                      <span>Change to Return:</span>
                      <span className="text-emerald-700">{currencySymbol}{changeDue.toFixed(2)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Checkout Button */}
        {(() => {
          const isSplitInvalid = paymentMethod === 'SPLIT' && !isSplitBalanced
          return (
            <button
              onClick={() => {
                handleCheckout()
                if (onClose) onClose()
              }}
              disabled={cart.length === 0 || createSaleMutation.isPending || isSplitInvalid}
              className={cn(
                'flex w-full items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-bold text-white shadow-md transition-all',
                isSplitInvalid
                  ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                  : 'hover:opacity-95 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50'
              )}
              style={
                isSplitInvalid
                  ? undefined
                  : paymentMethod === 'SPLIT'
                    ? { background: 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)' }
                    : { background: 'linear-gradient(135deg, #1d4ed8 0%, #4f46e5 100%)' }
              }
            >
              {createSaleMutation.isPending
                ? 'Processing...'
                : isSplitInvalid
                  ? remainingToAllocate > 0
                    ? `Allocate ${currencySymbol}${remainingToAllocate.toFixed(2)} more`
                    : `Reduce by ${currencySymbol}${overAllocated.toFixed(2)}`
                  : paymentMethod === 'SPLIT'
                    ? `Complete Split Sale (${currencySymbol}${total.toFixed(2)})`
                    : `Checkout (${currencySymbol}${total.toFixed(2)})`}
              {!createSaleMutation.isPending && !isSplitInvalid && <ArrowRight className="h-4 w-4" />}
            </button>
          )
        })()}
      </div>

      <div className="grid grid-cols-2 gap-2 bg-white px-4 pb-4">
        <button
          onClick={async () => {
            try {
              const result = await api.openCashDrawer()
              if (result?.success) {
                setToast({ type: 'success', message: 'Cash drawer opened' })
              } else {
                setToast({ type: 'error', message: result?.reason || result?.error || 'Failed to open cash drawer' })
              }
            } catch (err: any) {
              setToast({ type: 'error', message: err?.message || 'Cash drawer not available' })
            }
          }}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 active:scale-95"
        >
          <Archive className="h-3.5 w-3.5" />
          Open Drawer
        </button>
        <button
          onClick={clearCart}
          disabled={cart.length === 0}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 py-2 text-xs font-medium text-red-500 transition-colors hover:bg-red-50 active:scale-95 disabled:opacity-40"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Clear Cart
        </button>
      </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function POS() {
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState('all')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [page, setPage] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [discountPercent, setDiscountPercent] = useState<number>(0)
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'MOBILE' | 'SPLIT'>('CASH')
  const [splitPayments, setSplitPayments] = useState<SplitPaymentEntry[]>([
    { method: 'CASH', amount: 0 },
    { method: 'MOBILE', amount: 0 },
  ])
  const [cashTendered, setCashTendered] = useState<number | ''>('')
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('')
  const [heldSales, setHeldSales] = useState<HeldSale[]>([])
  const [isHeldModalOpen, setIsHeldModalOpen] = useState(false)
  const [isCartDrawerOpen, setIsCartDrawerOpen] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [confirmedPayment, setConfirmedPayment] = useState<PaymentConfirmedData | null>(null)
  const [btStatus, setBtStatus] = useState<BluetoothPrinterStatus>(bluetoothPrinter.getStatus())
  const searchRef = useRef<HTMLInputElement>(null)

  // Track Bluetooth printer state
  useEffect(() => {
    return bluetoothPrinter.subscribe((status) => {
      setBtStatus(status)
    })
  }, [])

  const handleQuickConnectBt = async () => {
    if (btStatus.isConnected) {
      const res = await bluetoothPrinter.testPrint()
      if (res.success) {
        setToast({ type: 'success', message: 'Bluetooth test receipt sent!' })
      } else {
        setToast({ type: 'error', message: res.error || 'Test print failed' })
      }
    } else {
      try {
        const res = await bluetoothPrinter.connect()
        if (res.success) {
          setToast({ type: 'success', message: `Connected to ${res.deviceName || 'Bluetooth Printer'}!` })
        } else if (res.error) {
          setToast({ type: 'error', message: res.error })
        }
      } catch (e: any) {
        setToast({ type: 'error', message: e?.message || 'Connection failed' })
      }
    }
  }

  // Auto-dismiss toasts
  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3500)
    return () => clearTimeout(timer)
  }, [toast])

  const { data: batches = [] } = useQuery<any[]>({
    queryKey: ['batches'],
    queryFn: () => window.api.getBatches(),
  })

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.api.getMedicines(),
  })

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => window.api.getCategories(),
  })

  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ['customers'],
    queryFn: () => window.api.getCustomers(),
  })

  const { data: storedSettings = {} } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => window.api.getSettings(),
    refetchInterval: 5000
  })

  const enableDiscount = storedSettings['pos.enableDiscount'] === 'true'
  const enableTax = storedSettings['pos.enableTax'] === 'true'
  const taxRate = enableTax ? (Number(storedSettings['pos.taxRate']) || 0) : 0
  const currencySymbol = storedSettings['biz.currencySymbol'] || '₵'

  // Group valid non-expired batches by Medicine for POS display & auto FEFO allocation
  const productsList = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // 1. Group valid non-expired batches by medicine ID
    const batchMap = new Map<string, { validBatches: any[]; totalStock: number; medicine?: any }>()

    for (const b of (batches || [])) {
      if (!b || b.quantity <= 0) continue
      const exp = new Date(b.expiryDate)
      exp.setHours(0, 0, 0, 0)
      if (exp < today) continue // Exclude expired batches strictly

      const medId = b.medicine?.id || b.medicineId
      if (!medId) continue

      if (!batchMap.has(medId)) {
        batchMap.set(medId, { validBatches: [], totalStock: 0, medicine: b.medicine })
      }
      const entry = batchMap.get(medId)!
      if (!entry.medicine && b.medicine) {
        entry.medicine = b.medicine
      }
      entry.validBatches.push(b)
      entry.totalStock += Number(b.quantity) || 0
    }

    const products: any[] = []
    const processedMedIds = new Set<string>()

    // 2. Iterate through all active catalogue medicines
    for (const m of (medicines || [])) {
      if (!m || !m.id || m.name === 'Historical Item (Deleted)') continue
      processedMedIds.add(m.id)

      const batchInfo = batchMap.get(m.id)
      let validBatches: any[] = []
      let totalStock = 0

      if (batchInfo && batchInfo.validBatches.length > 0) {
        validBatches = [...batchInfo.validBatches]
        validBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())
        totalStock = batchInfo.totalStock
      } else {
        totalStock = Number(m.stockQuantity) || 0
      }

      products.push({
        id: m.id,
        medicine: m,
        totalStock,
        validBatches,
        earliestExpiry: validBatches[0]?.expiryDate,
        batchCount: validBatches.length,
      })
    }

    // 3. Include any batch whose medicine wasn't in the medicines array
    for (const [medId, batchInfo] of batchMap.entries()) {
      if (processedMedIds.has(medId)) continue
      if (!batchInfo.medicine || !batchInfo.medicine.id) continue
      processedMedIds.add(medId)

      const validBatches = [...batchInfo.validBatches]
      validBatches.sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime())

      products.push({
        id: medId,
        medicine: batchInfo.medicine,
        totalStock: batchInfo.totalStock,
        validBatches,
        earliestExpiry: validBatches[0]?.expiryDate,
        batchCount: validBatches.length,
      })
    }

    return products
  }, [batches, medicines])

  const subtotal = cart.reduce((acc, i) => acc + (i.medicine?.price || 0) * i.quantity, 0)
  const discountAmt = enableDiscount ? (subtotal * discountPercent) / 100 : 0
  const tax = enableTax ? ((subtotal - discountAmt) * taxRate) / 100 : 0
  const total = Math.max(0, subtotal - discountAmt + tax)

  const createSaleMutation = useMutation({
    mutationFn: (data: any) => window.api.createSale(data),
    onSuccess: async (sale) => {
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard'] })
      const storeName = storedSettings['biz.name'] || 'SOFIYEM LEGACY LIMITED'
      const tagline = storedSettings['biz.tagline'] || 'Quality Frozen Foods & Cold Storage'
      const phone = storedSettings['biz.phone'] || '+233 54 386 4610'
      const ownerPhone = storedSettings['biz.ownerPhone'] || '+447999007775'
      const email = storedSettings['biz.email'] || 'sorphygold@yahoo.com'
      const footer = storedSettings['receipt.footerText'] || 'Thank you for choosing SOFIYEM Legacy! Keep frozen at -18°C.'
      const discountLine = enableDiscount && discountAmt > 0 ? `<tr><td style="padding:2px 0;">Discount (${discountPercent}%):</td><td colspan="2" style="text-align:right;">-${currencySymbol}${discountAmt.toFixed(2)}</td></tr>` : ''
      const taxLine = enableTax && tax > 0 ? `<tr><td style="padding:2px 0;">Tax (${taxRate}%):</td><td colspan="2" style="text-align:right;">${currencySymbol}${tax.toFixed(2)}</td></tr>` : ''
      const subtotalLine = (enableDiscount && discountAmt > 0) || (enableTax && tax > 0) ? `<tr><td style="padding:2px 0;">Subtotal:</td><td colspan="2" style="text-align:right;">${currencySymbol}${subtotal.toFixed(2)}</td></tr>` : ''

      const isSplit = paymentMethod === 'SPLIT' && splitPayments.some((p) => p.amount > 0)
      const activePayments = isSplit
        ? splitPayments.filter((p) => p.amount > 0)
        : [{ method: paymentMethod, amount: total }]

      let paymentSectionHTML = `<p style="margin:2px 0;font-size:11px;">Payment: ${paymentMethod === 'MOBILE' ? 'MOBILE MONEY' : paymentMethod}</p>`
      if (isSplit) {
        paymentSectionHTML = `
          <div style="margin:4px 0 2px 0;">
            <p style="margin:0 0 2px 0;font-size:11px;font-weight:bold;">Payment: SPLIT PAYMENT</p>
            <table style="width:100%;font-size:10px;border-collapse:collapse;">
              ${activePayments.map((p) => `
                <tr>
                  <td style="padding:1px 0;color:#222;">• ${p.method === 'MOBILE' ? 'Mobile Money' : p.method === 'BANK TRANSFER' ? 'Bank Transfer' : p.method}:</td>
                  <td style="text-align:right;padding:1px 0;font-weight:bold;">${currencySymbol}${p.amount.toFixed(2)}</td>
                </tr>
              `).join('')}
              ${typeof cashTendered === 'number' && cashTendered > (activePayments.find((p) => p.method === 'CASH')?.amount || 0) ? `
                <tr>
                  <td style="padding:1px 0;color:#555;">Cash Tendered:</td>
                  <td style="text-align:right;padding:1px 0;">${currencySymbol}${cashTendered.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding:1px 0;font-weight:bold;color:#16a34a;">Change Returned:</td>
                  <td style="text-align:right;padding:1px 0;font-weight:bold;color:#16a34a;">${currencySymbol}${(cashTendered - (activePayments.find((p) => p.method === 'CASH')?.amount || 0)).toFixed(2)}</td>
                </tr>
              ` : ''}
            </table>
          </div>
        `
      }

      const receiptHTML = `
        <div style="font-family:'Courier New',Courier,monospace;width:100%;padding:4px 0;margin:0;color:#000;font-size:11px;">
          <h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;font-weight:bold;">${storeName.toUpperCase()}</h2>
          <p style="text-align:center;margin:2px 0 0 0;font-size:10px;">Store Tel: ${phone}</p>
          <hr style="border-top:1px dashed #000;margin:8px 0;"/>
          <p style="margin:2px 0;font-size:11px;">Date: ${new Date().toLocaleString('en-GB')}</p>
          <p style="margin:2px 0;font-size:11px;">Receipt: INV-${sale.id.slice(0, 8).toUpperCase()}</p>
          ${paymentSectionHTML}
          <hr style="border-top:1px dashed #000;margin:8px 0;"/>
          <table style="width:100%;font-size:10px;border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #000;text-align:left;">
                <th style="padding:2px 0;">Item</th>
                <th style="text-align:center;padding:2px 0;">Qty</th>
                <th style="text-align:right;padding:2px 0;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${cart.map((item) => `
                <tr>
                  <td style="padding:3px 0;max-width:90px;word-break:break-word;">${item.medicine.name}</td>
                  <td style="text-align:center;vertical-align:top;padding:3px 0;">${item.quantity}</td>
                  <td style="text-align:right;vertical-align:top;padding:3px 0;">${currencySymbol}${(item.medicine.price * item.quantity).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <hr style="border-top:1px dashed #000;margin:8px 0;"/>
          <table style="width:100%;font-size:10px;">
            ${subtotalLine}
            ${discountLine}
            ${taxLine}
            <tr>
              <td style="padding:4px 0;font-weight:bold;font-size:13px;">GRAND TOTAL:</td>
              <td colspan="2" style="text-align:right;font-weight:bold;font-size:14px;">${currencySymbol}${total.toFixed(2)}</td>
            </tr>
          </table>
          <hr style="border-top:1px dashed #000;margin:8px 0;"/>
          <p style="text-align:center;margin:6px 0 2px 0;font-size:11px;font-weight:bold;">${footer}</p>
          <p style="text-align:center;margin:0;font-size:9px;color:#333;">Goods sold in good condition are not returnable once defrosted.</p>
          <hr style="border-top:1px dashed #000;margin:8px 0;"/>
          <p style="text-align:center;margin:0;font-size:9px;color:#555;">Software developed by Paylite<br/>www.mypaylite.com | 0207131415</p>
        </div>`
      try {
        const pRes = await api.printReceipt(receiptHTML)
        if (pRes && pRes.success === false && pRes.error) {
          console.warn('Bluetooth receipt print issue:', pRes.error)
        }
      } catch (printErr) {
        console.warn('Receipt print failed:', printErr)
      }

      // Auto-open cash drawer for cash payments
      const hasCashPayment = paymentMethod === 'CASH' || (isSplit && activePayments.some((p) => p.method === 'CASH' && p.amount > 0))
      if (hasCashPayment) {
        try {
          await api.openCashDrawer()
        } catch { /* drawer may not be enabled */ }
      }

      const finalChangeDue = typeof cashTendered === 'number'
        ? Math.max(0, cashTendered - (isSplit ? (activePayments.find((p) => p.method === 'CASH')?.amount || 0) : (paymentMethod === 'CASH' ? total : 0)))
        : 0

      const custName = customers.find((c) => c.id === selectedCustomerId)?.name || 'Walk-in Customer'
      const totalCartons = cart.reduce((sum, item) => sum + item.quantity, 0)

      setConfirmedPayment({
        saleId: sale.id,
        total,
        paymentMethod,
        payments: activePayments,
        cashTendered: typeof cashTendered === 'number' && cashTendered > 0 ? cashTendered : undefined,
        changeDue: finalChangeDue,
        customerName: custName,
        itemCount: totalCartons,
        receiptHTML,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      })

      setCart([])
      setDiscountPercent(0)
      setSelectedCustomerId('')
      setCashTendered('')
      setPaymentMethod('CASH')
      setSplitPayments([
        { method: 'CASH', amount: 0 },
        { method: 'MOBILE', amount: 0 },
      ])
      setIsCartDrawerOpen(false)
      setToast({ type: 'success', message: 'Payment confirmed & receipt processed!' })
    },
    onError: (err: any) => {
      setToast({ type: 'error', message: err?.message || 'Sale checkout failed' })
    },
  })

  const categoryList = useMemo(
    () => [
      { id: 'all', label: 'All Products', icon: '❄️' },
      ...(categories || [])
        .filter((c): c is Category => Boolean(c && c.id))
        .map((c) => ({ id: c.id, label: c.name || 'Unnamed', icon: getCategoryIcon(c.name || '') })),
      { id: 'other', label: 'Others', icon: '···' },
    ],
    [categories]
  )

  const activeCategoryLabel = categoryList.find((c) => c.id === activeCategory)?.label ?? 'All Products'

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    return productsList.filter((p) => {
      if (!p || !p.medicine) return false
      const name = p.medicine.name || ''
      const genericName = p.medicine.genericName || ''
      const sku = p.medicine.sku || ''
      const matchSearch =
        !q ||
        name.toLowerCase().includes(q) ||
        genericName.toLowerCase().includes(q) ||
        sku.toLowerCase().includes(q)
      const matchCategory =
        activeCategory === 'all' ||
        (activeCategory === 'other'
          ? !(categories || []).some((c) => c && c.id === p.medicine.categoryId)
          : p.medicine.categoryId === activeCategory)
      return matchSearch && matchCategory
    })
  }, [productsList, searchQuery, activeCategory, categories])

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / PAGE_SIZE))
  const pageProducts = filteredProducts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => {
    setPage(1)
  }, [searchQuery, activeCategory])

  const addToCart = (product: any) => {
    if (!product || !product.medicine) return
    setCart((prev) => {
      const existing = prev.find((i) => i.medicine?.id === product.id)
      const currentQty = existing ? existing.quantity : 0
      const newQty = currentQty + 1
      if (newQty > product.totalStock) {
        setToast({ type: 'error', message: `Cannot add more ${product.medicine?.name || 'item'}. Max available stock is ${product.totalStock}.` })
        return prev
      }

      const newAllocations = allocateFEFO(product.validBatches, newQty)

      if (existing) {
        return prev.map((i) =>
          i.medicine?.id === product.id ? { ...i, quantity: newQty, allocations: newAllocations } : i
        )
      }

      return [
        ...prev,
        {
          medicine: product.medicine,
          quantity: 1,
          maxAvailable: product.totalStock,
          validBatches: product.validBatches,
          allocations: newAllocations,
        },
      ]
    })
  }

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (!searchQuery.trim()) return
      const q = searchQuery.toLowerCase().trim()
      const exactMatch = filteredProducts.find((p) => {
        const sku = p.medicine.sku?.toLowerCase()?.trim()
        const name = p.medicine.name?.toLowerCase()?.trim()
        const matchBatch = p.validBatches?.some((b: any) => b.batchNumber?.toLowerCase()?.trim() === q)
        return sku === q || name === q || matchBatch
      })
      const target = exactMatch || (filteredProducts.length === 1 ? filteredProducts[0] : null)
      if (target) {
        if (target.totalStock > 0) {
          addToCart(target)
          barcodeScanner.playFeedbackSound(true)
          setSearchQuery('')
          setToast({ type: 'success', message: `Added ${target.medicine.name} to cart` })
        } else {
          barcodeScanner.playFeedbackSound(false)
          setToast({ type: 'error', message: `${target.medicine.name} is out of stock` })
        }
      } else if (filteredProducts.length > 1) {
        barcodeScanner.playFeedbackSound(false)
        setToast({ type: 'error', message: `Multiple matches (${filteredProducts.length}). Select product from list.` })
      } else {
        barcodeScanner.playFeedbackSound(false)
        setToast({ type: 'error', message: 'No matching product found.' })
      }
    }
  }

  const updateQty = (medicineId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.medicine.id !== medicineId) return item
          const newQty = item.quantity + delta
          if (newQty <= 0) return { ...item, quantity: 0 }
          if (newQty > item.maxAvailable) {
            setToast({ type: 'error', message: `Maximum stock for ${item.medicine.name} is ${item.maxAvailable}` })
            return item
          }
          const newAllocations = allocateFEFO(item.validBatches, newQty)
          return { ...item, quantity: newQty, allocations: newAllocations }
        })
        .filter((item) => item.quantity > 0)
    )
  }

  const removeFromCart = (medicineId: string) => setCart((prev) => prev.filter((i) => i.medicine.id !== medicineId))
  const clearCart = () => setCart([])

  const handleHoldSale = () => {
    if (cart.length === 0) {
      setToast({ type: 'error', message: 'Cart is empty! Nothing to hold.' })
      return
    }
    const newHold: HeldSale = {
      id: Date.now().toString(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      cart: [...cart],
      discountPercent,
      customerId: selectedCustomerId,
      paymentMethod,
      splitPayments: paymentMethod === 'SPLIT' ? [...splitPayments] : undefined,
      cashTendered: typeof cashTendered === 'number' ? cashTendered : undefined,
    }
    setHeldSales((prev) => [newHold, ...prev])
    setCart([])
    setDiscountPercent(0)
    setSelectedCustomerId('')
    setCashTendered('')
    setPaymentMethod('CASH')
    setSplitPayments([
      { method: 'CASH', amount: 0 },
      { method: 'MOBILE', amount: 0 },
    ])
    setIsCartDrawerOpen(false)
    setToast({ type: 'success', message: 'Sale held successfully.' })
  }

  const handleResumeSale = (held: HeldSale) => {
    setCart(held.cart)
    setDiscountPercent(held.discountPercent)
    if (held.customerId) setSelectedCustomerId(held.customerId)
    if (held.paymentMethod) setPaymentMethod(held.paymentMethod)
    if (held.splitPayments) setSplitPayments(held.splitPayments)
    if (held.cashTendered !== undefined) setCashTendered(held.cashTendered)
    setHeldSales((prev) => prev.filter((h) => h.id !== held.id))
    setIsHeldModalOpen(false)
    setToast({ type: 'success', message: 'Held sale resumed.' })
  }

  const handleDeleteHeldSale = (id: string) => {
    setHeldSales((prev) => prev.filter((h) => h.id !== id))
  }

  // ─── POS Hotkeys (F1, F2, F4, Ctrl+K) ────────────────────────────────────
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // 1. Hotkeys: F1 (Clear Cart), F2 (Hold Sale), F4 / Ctrl+K (Focus Search)
      if (e.key === 'F1') {
        e.preventDefault()
        clearCart()
        setToast({ type: 'success', message: 'Cart cleared' })
        return
      }
      if (e.key === 'F2') {
        e.preventDefault()
        handleHoldSale()
        return
      }
      if (e.key === 'F4' || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
        e.preventDefault()
        searchRef.current?.focus()
        searchRef.current?.select()
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [clearCart, handleHoldSale])

  // ─── Bluetooth & USB Hardware Barcode Scanner Listener ───────────────────
  useEffect(() => {
    const unsubscribe = barcodeScanner.subscribe((event) => {
      const code = event.barcode.toLowerCase().trim()
      if (!code) return

      // Match in active product catalog by SKU, name, or batch number
      const matched = productsList.find((p) => {
        const sku = p.medicine?.sku?.toLowerCase()?.trim()
        const name = p.medicine?.name?.toLowerCase()?.trim()
        const matchSku = sku && sku === code
        const matchName = name && name === code
        const matchBatch = p.validBatches?.some((b: any) => b.batchNumber?.toLowerCase()?.trim() === code)
        return matchSku || matchName || matchBatch
      })

      if (matched) {
        if (matched.totalStock > 0) {
          addToCart(matched)
          barcodeScanner.playFeedbackSound(true)
          setToast({ type: 'success', message: `Scanned: ${matched.medicine.name} (₵${matched.medicine.price.toFixed(2)})` })
          setSearchQuery('')
        } else {
          barcodeScanner.playFeedbackSound(false)
          setToast({ type: 'error', message: `${matched.medicine.name} is out of stock!` })
        }
      } else {
        // Fallback: search query match
        const partial = productsList.find((p) => {
          const sku = p.medicine?.sku?.toLowerCase()?.trim()
          const name = p.medicine?.name?.toLowerCase()?.trim()
          return (sku && sku.includes(code)) || (name && name.includes(code))
        })
        if (partial && partial.totalStock > 0) {
          addToCart(partial)
          barcodeScanner.playFeedbackSound(true)
          setToast({ type: 'success', message: `Scanned: ${partial.medicine.name}` })
          setSearchQuery('')
        } else {
          barcodeScanner.playFeedbackSound(false)
          setToast({ type: 'error', message: `Barcode "${event.barcode}" not found in stock` })
        }
      }
    })

    return () => unsubscribe()
  }, [productsList, addToCart])

  const handleCheckout = () => {
    if (cart.length === 0) return

    if (paymentMethod === 'SPLIT') {
      const allocated = splitPayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0)
      if (Math.abs(allocated - total) > 0.01) {
        setToast({
          type: 'error',
          message: allocated < total
            ? `Please allocate the remaining ${currencySymbol}${(total - allocated).toFixed(2)} to complete split payment.`
            : `Split amounts exceed total by ${currencySymbol}${(allocated - total).toFixed(2)}. Please balance amounts.`,
        })
        return
      }
    }

    const items = cart.flatMap((c) => {
      if (c.allocations && c.allocations.length > 0) {
        return c.allocations.map((a) => ({
          batchId: a.batchId,
          medicineId: c.medicine.id,
          name: c.medicine.name,
          quantity: a.quantity,
          price: c.medicine.price,
        }))
      }
      return [{
        batchId: c.validBatches?.[0]?.id || c.batches?.[0]?.id || null,
        medicineId: c.medicine.id,
        name: c.medicine.name,
        quantity: c.quantity,
        price: c.medicine.price,
      }]
    })

    const activePayments = paymentMethod === 'SPLIT'
      ? splitPayments.filter((p) => p.amount > 0).map((p) => ({
        method:
          (p.method || '').toUpperCase().includes('MOBILE') ||
            (p.method || '').toUpperCase().includes('MOMO')
            ? ('MOBILE' as const)
            : ('CASH' as const),
        amount: Number(p.amount) || 0,
      }))
      : [{ method: paymentMethod === 'MOBILE' ? ('MOBILE' as const) : ('CASH' as const), amount: total }]

    const cashAmt = activePayments.filter((p) => p.method === 'CASH').reduce((sum, p) => sum + p.amount, 0)
    const mobileAmt = activePayments.filter((p) => p.method === 'MOBILE').reduce((sum, p) => sum + p.amount, 0)
    const finalMethod = paymentMethod === 'SPLIT' ? `SPLIT:CASH=${cashAmt},MOBILE=${mobileAmt}` : paymentMethod

    createSaleMutation.mutate({
      paymentMethod: finalMethod,
      payments: activePayments,
      total,
      items,
      customerId: selectedCustomerId || undefined,
    })
  }

  const paginationPages = useMemo(() => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages: (number | 'ellipsis')[] = [1]
    if (page > 3) pages.push('ellipsis')
    for (let p = Math.max(2, page - 1); p <= Math.min(totalPages - 1, page + 1); p++) pages.push(p)
    if (page < totalPages - 2) pages.push('ellipsis')
    pages.push(totalPages)
    return pages
  }, [page, totalPages])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (confirmedPayment) {
        if (e.key === 'Enter' || e.key === 'Escape') {
          e.preventDefault()
          setConfirmedPayment(null)
          return
        }
        if (e.key === 'p' || e.key === 'P') {
          e.preventDefault()
          api.printReceipt(confirmedPayment.receiptHTML)
          setToast({ type: 'success', message: 'Receipt print sent' })
          return
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
      if (e.key === 'F1') {
        e.preventDefault()
        clearCart()
      }
      if (e.key === 'F2') {
        e.preventDefault()
        handleHoldSale()
      }
      if (e.key === 'F4') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [cart, confirmedPayment])

  return (
    <div className="flex h-full flex-col bg-[#f8f9fb] font-sans">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-4 right-4 z-50 flex items-center gap-2 rounded-xl border px-4 py-3 shadow-lg backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200">
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          ) : (
            <AlertCircle className="h-5 w-5 text-red-500" />
          )}
          <span className={cn('text-xs font-semibold', toast.type === 'success' ? 'text-emerald-800' : 'text-red-800')}>
            {toast.message}
          </span>
          <button onClick={() => setToast(null)} className="ml-2 text-slate-400 hover:text-slate-600">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* ── High-Visibility Payment Confirmation Modal ── */}
      {confirmedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md animate-in fade-in duration-150">
          <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl border border-slate-100 animate-in zoom-in-95 duration-150">
            {/* Top decorative banner with close button */}
            <div className="relative bg-gradient-to-br from-emerald-500 via-teal-500 to-emerald-600 px-6 pt-8 pb-10 text-center text-white">
              <button
                type="button"
                onClick={() => setConfirmedPayment(null)}
                className="absolute right-4 top-4 rounded-full bg-white/20 p-1.5 text-white hover:bg-white/30 transition-colors"
                title="Close (Esc)"
              >
                <X className="h-5 w-5" />
              </button>

              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-white text-emerald-600 shadow-xl ring-8 ring-white/30 animate-bounce duration-700">
                <CheckCircle2 className="h-12 w-12 text-emerald-600 stroke-[2.5]" />
              </div>

              <h2 className="text-2xl font-black tracking-tight text-white sm:text-3xl">Payment Confirmed!</h2>
              <p className="mt-1 text-xs font-semibold text-emerald-100">
                Sale completed successfully • INV-{confirmedPayment.saleId.slice(0, 8).toUpperCase()}
              </p>
            </div>

            {/* Content area */}
            <div className="p-6 space-y-4">
              {/* Grand Total Paid Box */}
              <div className="rounded-2xl bg-slate-50 border border-slate-200/80 p-4 text-center">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Total Amount Paid</p>
                <p className="text-3xl sm:text-4xl font-black text-slate-900 mt-0.5 tracking-tight">
                  {currencySymbol}{confirmedPayment.total.toFixed(2)}
                </p>
              </div>

              {/* High-visibility Change Due Banner */}
              {confirmedPayment.changeDue > 0 && (
                <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 shadow-lg shadow-emerald-600/20 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-200">Change Due to Customer</p>
                    <p className="text-2xl sm:text-3xl font-black tracking-tight mt-0.5">
                      {currencySymbol}{confirmedPayment.changeDue.toFixed(2)}
                    </p>
                  </div>
                  <div className="rounded-xl bg-white/20 p-2.5 backdrop-blur-xs">
                    <Banknote className="h-8 w-8 text-white" />
                  </div>
                </div>
              )}

              {/* Transaction details card */}
              <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-medium">Payment Mode</span>
                  {confirmedPayment.paymentMethod === 'CASH' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-800 text-[11px]">
                      <Banknote className="h-3.5 w-3.5" /> Cash
                    </span>
                  )}
                  {confirmedPayment.paymentMethod === 'MOBILE' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-800 text-[11px]">
                      <Smartphone className="h-3.5 w-3.5" /> Mobile Money
                    </span>
                  )}
                  {confirmedPayment.paymentMethod === 'SPLIT' && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-2.5 py-0.5 font-bold text-purple-800 text-[11px]">
                      <Split className="h-3.5 w-3.5" /> Split (Cash + Mobile)
                    </span>
                  )}
                </div>

                {confirmedPayment.paymentMethod === 'SPLIT' && (
                  <div className="pl-3 border-l-2 border-purple-300 space-y-1 text-[11px] text-slate-600 py-0.5">
                    {confirmedPayment.payments.map((p, i) => (
                      <div key={i} className="flex justify-between">
                        <span>• {p.method === 'MOBILE' ? 'Mobile Money' : 'Cash'}:</span>
                        <span className="font-bold text-slate-800">{currencySymbol}{p.amount.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {typeof confirmedPayment.cashTendered === 'number' && confirmedPayment.cashTendered > 0 && (
                  <div className="flex items-center justify-between text-slate-600">
                    <span className="text-slate-500 font-medium">Cash Tendered</span>
                    <span className="font-bold text-slate-800">{currencySymbol}{confirmedPayment.cashTendered.toFixed(2)}</span>
                  </div>
                )}

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500 font-medium">Customer</span>
                  <span className="font-semibold text-slate-800">{confirmedPayment.customerName}</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500 font-medium">Quantity Sold</span>
                  <span className="font-semibold text-slate-800">{confirmedPayment.itemCount} carton(s)</span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span className="text-slate-500 font-medium">Time Completed</span>
                  <span className="font-semibold text-slate-800">{confirmedPayment.timestamp}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const res = await api.printReceipt(confirmedPayment.receiptHTML)
                    if (res?.success === false && res?.error) {
                      setToast({ type: 'error', message: res.error })
                    } else {
                      setToast({
                        type: 'success',
                        message: btStatus.isConnected ? 'Receipt sent to Bluetooth printer!' : 'Receipt print sent',
                      })
                    }
                  }}
                  className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white py-3.5 text-xs sm:text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95 transition-all"
                >
                  {btStatus.isConnected ? (
                    <>
                      <BluetoothConnected className="h-4 w-4 text-emerald-600" />
                      <span>Print Receipt (BT)</span>
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4 text-slate-600" />
                      <span>Print Receipt</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmedPayment(null)}
                  className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3.5 text-xs sm:text-sm font-bold text-white shadow-lg shadow-emerald-600/30 hover:opacity-95 active:scale-95 transition-all"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Next Sale (Enter)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Held Sales Modal */}
      {isHeldModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-blue-600" />
                <h3 className="text-base font-bold text-slate-800">Held Sales ({heldSales.length})</h3>
              </div>
              <button onClick={() => setIsHeldModalOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="my-4 flex-1 space-y-3 overflow-y-auto pr-1">
              {heldSales.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-400">No held sales stored.</p>
              ) : (
                heldSales.map((h) => {
                  const heldTotal = h.cart.reduce((s, i) => s + i.medicine.price * i.quantity, 0)
                  return (
                    <div key={h.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Hold at {h.timestamp}</p>
                        <p className="text-[11px] text-slate-500">
                          {h.cart.length} item(s) • Total: {currencySymbol}{heldTotal.toFixed(2)} • <span className={cn('font-semibold', h.paymentMethod === 'SPLIT' ? 'text-purple-600' : 'text-slate-700')}>{h.paymentMethod}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleResumeSale(h)}
                          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 active:scale-95"
                        >
                          <Play className="h-3 w-3" /> Resume
                        </button>
                        <button
                          onClick={() => handleDeleteHeldSale(h.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 active:scale-95"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
            <button
              onClick={() => setIsHeldModalOpen(false)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Mobile / Tablet Slide-Over Cart Drawer */}
      {isCartDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs lg:hidden">
          <div className="h-full w-full max-w-[340px] sm:max-w-[380px] bg-white flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
            <CartPanelContent
              cart={cart}
              clearCart={clearCart}
              selectedCustomerId={selectedCustomerId}
              setSelectedCustomerId={setSelectedCustomerId}
              customers={customers}
              removeFromCart={removeFromCart}
              updateQty={updateQty}
              enableDiscount={enableDiscount}
              discountPercent={discountPercent}
              setDiscountPercent={setDiscountPercent}
              subtotal={subtotal}
              discountAmt={discountAmt}
              enableTax={enableTax}
              taxRate={taxRate}
              tax={tax}
              total={total}
              currencySymbol={currencySymbol}
              paymentMethod={paymentMethod}
              setPaymentMethod={setPaymentMethod}
              splitPayments={splitPayments}
              setSplitPayments={setSplitPayments}
              cashTendered={cashTendered}
              setCashTendered={setCashTendered}
              handleCheckout={handleCheckout}
              createSaleMutation={createSaleMutation}
              setToast={setToast}
              onClose={() => setIsCartDrawerOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Top bar */}
      <div className="flex flex-wrap lg:flex-nowrap flex-shrink-0 items-center justify-between gap-2.5 sm:gap-3 border-b border-slate-200/80 bg-white px-3 sm:px-5 py-2.5 sm:py-3 shadow-sm">
        <div className="flex-1 min-w-[200px] max-w-full lg:max-w-[680px] flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 sm:px-4 py-2 transition-all focus-within:border-blue-300 focus-within:bg-white focus-within:shadow-sm">
          <Search className="h-4 w-4 flex-shrink-0 text-slate-400" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search frozen product or scan barcode..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            className="min-w-0 flex-1 bg-transparent text-xs sm:text-sm text-slate-700 outline-none placeholder:text-slate-400"
          />
          <span className="hidden md:inline-flex flex-shrink-0 rounded bg-slate-200/80 px-1.5 py-0.5 font-mono text-[10px] text-slate-500">
            Ctrl + K
          </span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => searchRef.current?.focus()}
            className="hidden sm:flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <Barcode className="h-4 w-4 text-blue-600" />
            <span>Scan Barcode</span>
          </button>

          <button
            onClick={handleQuickConnectBt}
            title={
              btStatus.isConnected
                ? `Bluetooth Printer: ${btStatus.deviceName || 'Connected'}. Click to test print.`
                : 'Click to scan & connect Bluetooth receipt printer'
            }
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-medium transition-all active:scale-95',
              btStatus.isConnected
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 shadow-xs'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            {btStatus.isConnected ? (
              <>
                <BluetoothConnected className="h-4 w-4 text-emerald-600" />
                <span className="hidden sm:inline font-semibold">{btStatus.deviceName || 'BT Printer'}</span>
              </>
            ) : (
              <>
                <Bluetooth className="h-4 w-4 text-blue-600" />
                <span className="hidden sm:inline">BT Printer</span>
              </>
            )}
          </button>

          <button
            onClick={handleHoldSale}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 active:scale-95"
          >
            <PauseCircle className="h-4 w-4 text-amber-500" />
            <span>Hold</span>
            {heldSales.length > 0 && (
              <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                {heldSales.length}
              </span>
            )}
          </button>

          {heldSales.length > 0 && (
            <button
              onClick={() => setIsHeldModalOpen(true)}
              className="flex items-center gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 border border-amber-200 hover:bg-amber-100 active:scale-95"
            >
              <Play className="h-3.5 w-3.5" /> Resume ({heldSales.length})
            </button>
          )}

          <button
            onClick={() => setIsCartDrawerOpen(!isCartDrawerOpen)}
            className="flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm transition-all hover:opacity-95 active:scale-95 flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Current Sale</span>
            <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-bold text-blue-600">
              {cart.reduce((n, i) => n + i.quantity, 0)} ({currencySymbol}{total.toFixed(2)})
            </span>
          </button>
        </div>
      </div>

      {/* Horizontal Category bar for tablet / mobile view (< lg:) */}
      <div className="lg:hidden flex-shrink-0 border-b border-slate-200/80 bg-white px-3 py-2 overflow-x-auto scrollbar-none flex items-center gap-1.5">
        {categoryList.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              'flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0 active:scale-95',
              activeCategory === cat.id
                ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            )}
          >
            <span>{cat.icon === '···' ? '···' : cat.icon}</span>
            <span>{cat.label}</span>
          </button>
        ))}
      </div>

      {/* Main body */}
      <div className="flex flex-1 overflow-hidden">
        {/* Vertical Categories (Desktop >= lg:) */}
        <div className="hidden lg:flex w-[190px] flex-shrink-0 flex-col overflow-y-auto border-r border-slate-200/80 bg-white">
          <div className="px-3 pb-2 pt-4">
            <p className="mb-2.5 px-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">Categories</p>
            <div className="space-y-1">
              {categoryList.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2.5 text-left text-xs font-medium transition-all',
                    activeCategory === cat.id
                      ? 'border-blue-200 bg-blue-50 text-blue-700 shadow-sm'
                      : 'border-transparent text-slate-600 hover:border-slate-100 hover:bg-slate-50'
                  )}
                >
                  <span className="w-5 flex-shrink-0 text-center text-base leading-none">
                    {cat.icon === '···' ? <MoreHorizontal className="mx-auto h-3.5 w-3.5 text-slate-400" /> : cat.icon}
                  </span>
                  <span className="truncate">{cat.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto border-t border-slate-100 p-3">
            <Link
              to="/products"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-blue-700 active:scale-95"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Item
            </Link>
          </div>
        </div>

        {/* Product grid */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div className="flex flex-shrink-0 items-center justify-between border-b border-slate-200/60 bg-[#f8f9fb] px-4 sm:px-5 py-2.5 sm:py-3">
            <p className="text-xs sm:text-sm font-bold text-slate-800">
              {activeCategoryLabel}{' '}
              <span className="font-normal text-slate-400">({filteredProducts.length})</span>
            </p>
            <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <button
                onClick={() => setViewMode('grid')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold transition-all',
                  viewMode === 'grid' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <Grid3X3 className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={cn(
                  'flex items-center gap-1.5 rounded-lg px-2.5 py-1 sm:px-3 sm:py-1.5 text-xs font-semibold transition-all',
                  viewMode === 'list' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                )}
              >
                <List className="h-3.5 w-3.5" /> List
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {pageProducts.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center text-slate-400 py-12">
                <Package className="mb-3 h-12 w-12 opacity-30 text-sky-500" />
                <p className="text-sm font-medium">No active frozen products found</p>
                <p className="mt-1 text-xs">All cartons or batches may be out of stock or past freezer shelf life</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5">
                {pageProducts.map((prod: any) => (
                  <MedicineCard key={prod.id} product={prod} onAdd={() => addToCart(prod)} />
                ))}
              </div>
            ) : (
              <div className="space-y-1.5">
                {pageProducts.map((prod: any) => (
                  <div
                    key={prod.id}
                    className="flex items-center gap-2.5 sm:gap-3 rounded-xl border border-slate-200/80 bg-white p-2 sm:p-2.5 shadow-2xs transition-all hover:border-blue-300"
                  >
                    <div
                      className={cn(
                        'flex h-8 w-8 sm:h-9 sm:w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br',
                        getCardGradient(prod.medicine.id)
                      )}
                    >
                      <Package className="h-4 w-4 text-sky-600/90" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs sm:text-sm font-bold text-slate-800">{prod.medicine.name}</p>
                      <p className="truncate text-[10px] text-slate-400">
                        {prod.medicine.genericName || prod.medicine.category?.name} • {prod.batchCount} lot(s)
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p className="text-xs sm:text-sm font-extrabold text-slate-900">{currencySymbol}{prod.medicine.price.toFixed(2)}</p>
                      <p className={cn('text-[10px] font-medium', prod.totalStock > 0 ? 'text-slate-500' : 'text-rose-500')}>
                        {prod.totalStock > 0 ? `Stock: ${prod.totalStock}` : 'Out of Stock'}
                      </p>
                    </div>
                    <button
                      onClick={() => addToCart(prod)}
                      disabled={prod.totalStock <= 0}
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 active:scale-95 disabled:opacity-30 cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-shrink-0 items-center justify-center gap-1.5 border-t border-slate-200/60 bg-[#f8f9fb] px-4 sm:px-5 py-2.5 sm:py-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-40"
              >
                Prev
              </button>
              {paginationPages.map((p, idx) =>
                p === 'ellipsis' ? (
                  <span key={`e-${idx}`} className="px-1 text-xs text-slate-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'min-w-[28px] sm:min-w-[32px] rounded-lg px-2 py-1.5 text-xs font-semibold transition-all',
                      page === p
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    )}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 bg-white px-2.5 sm:px-3 py-1.5 text-xs font-medium text-slate-600 transition-all hover:bg-slate-50 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>

        {/* Cart Sidebar (Desktop >= lg:) */}
        <div className="hidden lg:flex w-[310px] flex-shrink-0 flex-col border-l border-slate-200/80 bg-[#fafbfc] shadow-[-4px_0_24px_rgba(15,23,42,0.04)]">
          <CartPanelContent
            cart={cart}
            clearCart={clearCart}
            selectedCustomerId={selectedCustomerId}
            setSelectedCustomerId={setSelectedCustomerId}
            customers={customers}
            removeFromCart={removeFromCart}
            updateQty={updateQty}
            enableDiscount={enableDiscount}
            discountPercent={discountPercent}
            setDiscountPercent={setDiscountPercent}
            subtotal={subtotal}
            discountAmt={discountAmt}
            enableTax={enableTax}
            taxRate={taxRate}
            tax={tax}
            total={total}
            currencySymbol={currencySymbol}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            splitPayments={splitPayments}
            setSplitPayments={setSplitPayments}
            cashTendered={cashTendered}
            setCashTendered={setCashTendered}
            handleCheckout={handleCheckout}
            createSaleMutation={createSaleMutation}
            setToast={setToast}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="hidden sm:flex flex-shrink-0 items-center justify-between border-t border-slate-200/80 bg-white px-4 sm:px-5 py-2">
        <div className="flex flex-wrap items-center gap-3 sm:gap-4">
          {[
            { key: 'F1', label: 'Clear Cart' },
            { key: 'F2', label: 'Hold Sale' },
            { key: 'Ctrl+K', label: 'Search' },
            { key: 'F4', label: 'Focus Search' },
          ].map((sc) => (
            <div key={sc.key} className="flex items-center gap-1.5">
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-bold text-slate-500">
                {sc.key}
              </span>
              <span className="text-[11px] text-slate-500">{sc.label}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors hover:text-slate-600">
            <Keyboard className="h-3.5 w-3.5" />
            Keyboard
          </button>
          <button
            onClick={() => document.documentElement.requestFullscreen?.()}
            className="flex items-center gap-1.5 text-[11px] text-slate-400 transition-colors hover:text-slate-600"
          >
            <Maximize2 className="h-3.5 w-3.5" />
            Full Screen
          </button>
        </div>
      </div>
    </div>
  )
}


