import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, ChevronLeft, ChevronRight, Printer, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { format, startOfDay, startOfWeek, startOfMonth } from 'date-fns'
import toast from 'react-hot-toast'
import { api } from '@/services/api'

const ITEMS_PER_PAGE = 15

function getPaymentMethodColor(method: string) {
  const m = (method || '').toLowerCase()
  if (m.includes('split')) {
    return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
  }
  if (m.includes('mobile') || m.includes('momo')) {
    return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
  }
  return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
}

export interface SalePaymentBreakdown {
  cash: number
  momo: number
  other: number
  isSplit: boolean
  displayLabel: string
}

export function getSaleBreakdown(sale: any): SalePaymentBreakdown {
  const total = Number(sale?.total) || 0

  // 1. If explicit payments array exists with items
  if (sale?.payments && Array.isArray(sale.payments) && sale.payments.length > 0) {
    let cash = 0
    let momo = 0
    let other = 0
    for (const p of sale.payments) {
      const method = (p.method || '').toUpperCase()
      const amt = Number(p.amount) || 0
      if (method.includes('MOBILE') || method.includes('MOMO')) {
        momo += amt
      } else if (method.includes('CASH')) {
        cash += amt
      } else {
        other += amt
      }
    }

    const isSplit =
      (sale.payments.length > 1 && ((cash > 0 && momo > 0) || (cash > 0 && other > 0) || (momo > 0 && other > 0))) ||
      (sale.paymentMethod || '').toUpperCase().includes('SPLIT')

    let displayLabel = 'CASH'
    if (isSplit) {
      displayLabel = `SPLIT (Cash ₵${cash.toFixed(2)} + MoMo ₵${momo.toFixed(2)}${other > 0 ? ` + Other ₵${other.toFixed(2)}` : ''})`
    } else if (momo > 0 && cash === 0) {
      displayLabel = 'MOMO'
    } else if (other > 0 && cash === 0 && momo === 0) {
      displayLabel = (sale.payments[0]?.method || 'OTHER').toUpperCase()
    }

    return { cash, momo, other, isSplit, displayLabel }
  }

  // 2. Parse paymentMethod string if encoded, e.g. "SPLIT:CASH=2700,MOBILE=300"
  const pm = (sale?.paymentMethod || 'CASH').toUpperCase()
  if (pm.startsWith('SPLIT:') || pm.includes('SPLIT')) {
    const cashMatch = pm.match(/CASH[=:]\s*([0-9.]+)/i)
    const mobileMatch = pm.match(/MOBILE[=:]\s*([0-9.]+)/i) || pm.match(/MOMO[=:]\s*([0-9.]+)/i)
    const c = cashMatch ? parseFloat(cashMatch[1]) : 0
    const m = mobileMatch ? parseFloat(mobileMatch[1]) : 0

    if (c > 0 || m > 0) {
      const remaining = Math.max(0, total - c - m)
      return {
        cash: c,
        momo: m,
        other: remaining,
        isSplit: true,
        displayLabel: `SPLIT (Cash ₵${c.toFixed(2)} + MoMo ₵${m.toFixed(2)}${remaining > 0 ? ` + Other ₵${remaining.toFixed(2)}` : ''})`,
      }
    }

    // SPLIT without specific numbers: split 50/50
    const half = Math.round((total / 2) * 100) / 100
    const otherHalf = Math.round((total - half) * 100) / 100
    return {
      cash: half,
      momo: otherHalf,
      other: 0,
      isSplit: true,
      displayLabel: `SPLIT (Cash ₵${half.toFixed(2)} + MoMo ₵${otherHalf.toFixed(2)})`,
    }
  }

  // 3. Direct Mobile / MoMo
  if (pm.includes('MOBILE') || pm.includes('MOMO')) {
    return { cash: 0, momo: total, other: 0, isSplit: false, displayLabel: 'MOMO' }
  }

  // 4. Other payment methods (Card / Bank)
  if (pm.includes('CARD') || pm.includes('BANK')) {
    return { cash: 0, momo: 0, other: total, isSplit: false, displayLabel: pm }
  }

  // 5. Default: Cash
  return { cash: total, momo: 0, other: 0, isSplit: false, displayLabel: 'CASH' }
}

export interface ReceiptOptions {
  storeName?: string
  phone?: string
  footer?: string
  currencySymbol?: string
  isDuplicate?: boolean
  resolveItemName?: (item: any) => string
}

export function buildSaleReceiptHtml(targetSale: any, options: ReceiptOptions = {}): string {
  const storeName = options.storeName || 'SOFIYEM LEGACY LIMITED'
  const phone = options.phone || '+233 54 386 4610'
  const footer = options.footer || 'Thank you for choosing SOFIYEM Legacy! Keep frozen at -18°C.'
  const currencySymbol = options.currencySymbol || '₵'
  const isDuplicate = options.isDuplicate ?? true
  const resolveName = options.resolveItemName || ((item: any) => item?.product_name || item?.name || 'Cold Store Item')

  const invoiceId = `INV-${(targetSale.id || '').slice(0, 8).toUpperCase()}`
  const rawDate = targetSale.date || targetSale.created_at || targetSale.createdAt
  const formattedDate = format(new Date(rawDate || Date.now()), 'dd MMM yyyy, HH:mm')
  const customerName = targetSale.customer?.name || targetSale.customerName || 'Walk-in Customer'

  const bd = getSaleBreakdown(targetSale)
  let paymentSectionHTML = `<p style="margin:2px 0;font-size:11px;">Payment: ${bd.displayLabel}</p>`
  if (bd.isSplit || (targetSale.payments && targetSale.payments.length > 1)) {
    const paymentEntries =
      targetSale.payments && targetSale.payments.length > 0
        ? targetSale.payments.filter((p: any) => Number(p.amount) > 0)
        : [
          ...(bd.cash > 0 ? [{ method: 'CASH', amount: bd.cash }] : []),
          ...(bd.momo > 0 ? [{ method: 'MOBILE', amount: bd.momo }] : []),
          ...(bd.other > 0 ? [{ method: 'OTHER', amount: bd.other }] : []),
        ]

    paymentSectionHTML = `
      <div style="margin:4px 0 2px 0;">
        <p style="margin:0 0 2px 0;font-size:11px;font-weight:bold;">Payment: SPLIT PAYMENT</p>
        <table style="width:100%;font-size:10px;border-collapse:collapse;">
          ${paymentEntries.map((p: any) => {
      const mUpper = (p.method || '').toUpperCase()
      const isCash = mUpper.includes('CASH')
      const isMob = mUpper.includes('MOBILE') || mUpper.includes('MOMO')
      const label = isMob ? 'Mobile Money' : isCash ? 'Cash' : p.method
      return `
              <tr>
                <td style="padding:1px 0;color:#222;">• ${label}:</td>
                <td style="text-align:right;padding:1px 0;font-weight:bold;">${currencySymbol}${Number(p.amount).toFixed(2)}</td>
              </tr>
            `
    }).join('')}
        </table>
      </div>
    `
  }

  const items = targetSale.items || []
  const itemsHTML = items.map((item: any) => {
    const name = resolveName(item)
    const qty = Number(item.quantity) || 1
    const price = Number(item.price ?? item.unit_price ?? item.medicine?.price ?? 0)
    const subtotal = Number(item.subtotal ?? (price * qty))
    return `
      <tr>
        <td style="padding:3px 0;max-width:90px;word-break:break-word;">${name}</td>
        <td style="text-align:center;vertical-align:top;padding:3px 0;">${qty}</td>
        <td style="text-align:right;vertical-align:top;padding:3px 0;">${currencySymbol}${subtotal.toFixed(2)}</td>
      </tr>
    `
  }).join('')

  return `
    <div style="font-family:'Courier New',Courier,monospace;width:100%;padding:4px 0;margin:0;color:#000;font-size:11px;">
      <h2 style="text-align:center;margin:0 0 4px 0;font-size:14px;font-weight:bold;">${storeName.toUpperCase()}</h2>
      <p style="text-align:center;margin:2px 0 0 0;font-size:10px;">Store Tel: ${phone}</p>
      <hr style="border-top:1px dashed #000;margin:8px 0;"/>
      <p style="margin:2px 0;font-size:11px;">Date: ${formattedDate}</p>
      <p style="margin:2px 0;font-size:11px;">Receipt: ${invoiceId}</p>
      <p style="margin:2px 0;font-size:11px;">Customer: ${customerName}</p>
      ${isDuplicate ? `<p style="margin:3px 0;font-size:10px;color:#444;font-weight:bold;text-align:center;background:#f1f5f9;padding:2px;border:1px dashed #94a3b8;">[ DUPLICATE RECEIPT ]</p>` : ''}
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
          ${itemsHTML || `<tr><td colspan="3" style="text-align:center;padding:4px 0;">Cold Store Products</td></tr>`}
        </tbody>
      </table>
      <hr style="border-top:1px dashed #000;margin:8px 0;"/>
      <table style="width:100%;font-size:10px;">
        <tr>
          <td style="padding:4px 0;font-weight:bold;font-size:13px;">GRAND TOTAL:</td>
          <td colspan="2" style="text-align:right;font-weight:bold;font-size:14px;">${currencySymbol}${Number(targetSale.total).toFixed(2)}</td>
        </tr>
      </table>
      <hr style="border-top:1px dashed #000;margin:8px 0;"/>
      <p style="text-align:center;margin:6px 0 2px 0;font-size:11px;font-weight:bold;">${footer}</p>
      <p style="text-align:center;margin:0;font-size:9px;color:#333;">Goods sold in good condition are not returnable once defrosted.</p>
      <hr style="border-top:1px dashed #000;margin:8px 0;"/>
      <p style="text-align:center;margin:0;font-size:9px;color:#555;">Software developed by Paylite<br/>www.mypaylite.com | 0207131415</p>
    </div>`
}

export default function SalesHistory() {
  const [searchTerm, setSearchTerm] = useState('')
  const [paymentFilter, setPaymentFilter] = useState('ALL')
  const [dateFilter, setDateFilter] = useState('WEEK')
  const [customStartDate, setCustomStartDate] = useState('')
  const [customEndDate, setCustomEndDate] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [selectedSale, setSelectedSale] = useState<any>(null)
  const queryClient = useQueryClient()

  const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

  const { data: sales = [], isLoading } = useQuery<any[]>({
    queryKey: ['sales'],
    queryFn: () => apiClient.getSales(),
  })

  const { data: medicines = [] } = useQuery<any[]>({
    queryKey: ['medicines'],
    queryFn: () => apiClient.getMedicines(),
  })

  const { data: storedSettings = {} } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => apiClient.getSettings(),
    refetchInterval: 5000
  })

  const enableRefund = storedSettings['pos.enableRefund'] !== 'false'

  useEffect(() => {
    const handleSettingsUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    }
    window.addEventListener('settings_updated', handleSettingsUpdated)
    return () => window.removeEventListener('settings_updated', handleSettingsUpdated)
  }, [queryClient])

  const resolveItemName = (item: any) => {
    // 1. Direct relations and properties
    const direct =
      item?.batch?.medicine?.name ||
      item?.medicine?.name ||
      item?.product_name ||
      item?.productName ||
      item?.name

    if (direct && direct !== 'Cold Store Item' && direct !== 'Unknown Item') {
      return direct
    }

    // 2. Lookup in medicines catalogue by product/medicine/batch ID
    const medId = item?.medicineId || item?.medicine_id || item?.productId || item?.product_id || item?.batchId
    if (medId && Array.isArray(medicines)) {
      const match = medicines.find((m: any) => m.id === medId || m.sku === item?.sku)
      if (match?.name) return match.name
    }

    // 3. Lookup in medicines catalogue by unit price if unique
    const price = Number(item?.price ?? item?.unit_price ?? item?.medicine?.price ?? 0)
    if (price > 0 && Array.isArray(medicines)) {
      const priceMatches = medicines.filter((m: any) => Math.abs(Number(m.price) - price) < 0.01)
      if (priceMatches.length === 1) {
        return priceMatches[0].name
      }
    }

    return direct || 'Cold Store Item'
  }

  const refundMutation = useMutation({
    mutationFn: async (id: string) => {
      if (typeof window !== 'undefined' && (window as any).api?.refundSale) {
        return await (window as any).api.refundSale(id)
      }
      if (typeof window !== 'undefined' && (window as any).electron?.ipcRenderer?.invoke) {
        try {
          return await (window as any).electron.ipcRenderer.invoke('sales:refund', id)
        } catch {
          // fallback to api
        }
      }
      return await api.refundSale(id)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      toast.success('Transaction refunded successfully. Stock has been returned.')
      setSelectedSale(null)
    },
    onError: (error: any) => {
      toast.error(error?.message || 'Failed to refund transaction')
    }
  })

  const [isPrinting, setIsPrinting] = useState(false)

  const handlePrintSaleReceipt = async (saleToPrint?: any) => {
    const targetSale = saleToPrint || selectedSale
    if (!targetSale) return

    setIsPrinting(true)
    try {
      const invoiceId = `INV-${(targetSale.id || '').slice(0, 8).toUpperCase()}`
      const receiptHTML = buildSaleReceiptHtml(targetSale, {
        storeName: storedSettings['biz.name'],
        phone: storedSettings['biz.phone'],
        footer: storedSettings['receipt.footerText'],
        currencySymbol: storedSettings['biz.currencySymbol'],
        isDuplicate: true,
        resolveItemName,
      })

      const res = await apiClient.printReceipt(receiptHTML)
      if (res && res.success === false && res.error) {
        toast.error(`Printer warning: ${res.error}`)
      } else {
        toast.success(`Receipt printed for ${invoiceId}`)
      }
    } catch (err: any) {
      console.error('Failed to print receipt:', err)
      toast.error(err?.message || 'Failed to print receipt')
    } finally {
      setIsPrinting(false)
    }
  }

  const filteredSales = sales.filter((s: any) => {
    const term = searchTerm.toLowerCase()
    const invoiceId = `INV-${(s.id || '').slice(0, 8).toUpperCase()}`
    const customerName = s.customer?.name || s.customerName || 'Walk-in Customer'
    const matchesSearch = invoiceId.toLowerCase().includes(term) || customerName.toLowerCase().includes(term)

    const breakdown = getSaleBreakdown(s)
    let matchesFilter = true
    if (paymentFilter === 'CASH') {
      matchesFilter = breakdown.cash > 0
    } else if (paymentFilter === 'MOBILE') {
      matchesFilter = breakdown.momo > 0
    }

    let matchesDate = true
    const rawDate = s.date || s.created_at || s.createdAt
    const saleDate = rawDate ? new Date(rawDate) : new Date()
    const today = new Date()
    if (dateFilter === 'TODAY') {
      matchesDate = saleDate >= startOfDay(today)
    } else if (dateFilter === 'WEEK') {
      matchesDate = saleDate >= startOfWeek(today, { weekStartsOn: 1 })
    } else if (dateFilter === 'MONTH') {
      matchesDate = saleDate >= startOfMonth(today)
    } else if (dateFilter === 'CUSTOM') {
      if (customStartDate) matchesDate = matchesDate && saleDate >= new Date(customStartDate)
      if (customEndDate) {
        const endDate = new Date(customEndDate)
        endDate.setHours(23, 59, 59, 999)
        matchesDate = matchesDate && saleDate <= endDate
      }
    }

    return matchesSearch && matchesFilter && matchesDate
  })

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedSales = filteredSales.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const totalRevenue = filteredSales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
  const cashRevenue = filteredSales.reduce((sum, s) => sum + getSaleBreakdown(s).cash, 0)
  const momoRevenue = filteredSales.reduce((sum, s) => sum + getSaleBreakdown(s).momo, 0)
  const otherRevenue = filteredSales.reduce((sum, s) => sum + getSaleBreakdown(s).other, 0)

  const getVisiblePages = (current: number, total: number) => {
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }
    const pages: (number | string)[] = [1]
    if (current > 3) pages.push('ellipsis-start')
    const start = Math.max(2, current - 1)
    const end = Math.min(total - 1, current + 1)
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    if (current < total - 2) pages.push('ellipsis-end')
    pages.push(total)
    return pages
  }

  return (
    <div className="h-full overflow-y-auto overflow-x-hidden p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50 max-w-full">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs" style={{ backgroundColor: '#2563eb' }}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl" />

        <div className="relative flex flex-col gap-2.5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-1">

            <h2 className="text-lg sm:text-xl font-bold">Sales History</h2>
          </div>
          <div className={`grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 ${otherRevenue > 0 ? 'xl:grid-cols-5' : 'xl:grid-cols-4'} gap-1.5 sm:gap-2 flex-1 xl:max-w-3xl`}>
            <div className="rounded-xl border border-white/10 bg-gradient-to-br from-white/20 to-white/5 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur shadow-2xs">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-sky-100 font-medium">Transactions</p>
              <p className="text-base sm:text-lg font-bold text-white mt-0.5">{filteredSales.length}</p>
            </div>
            <div className="rounded-xl border border-emerald-400/20 bg-gradient-to-br from-emerald-500/30 to-emerald-400/10 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur shadow-2xs">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100 font-medium">Total Sales</p>
              <p className="text-base sm:text-lg font-bold text-emerald-50 mt-0.5">₵{totalRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/30 to-amber-400/10 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur shadow-2xs">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-100 font-medium">Cash Sales</p>
              <p className="text-base sm:text-lg font-bold text-amber-50 mt-0.5">₵{cashRevenue.toFixed(2)}</p>
            </div>
            <div className="rounded-xl border border-sky-400/20 bg-gradient-to-br from-sky-500/30 to-sky-400/10 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur shadow-2xs">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-sky-100 font-medium">MoMo Sales</p>
              <p className="text-base sm:text-lg font-bold text-sky-50 mt-0.5">₵{momoRevenue.toFixed(2)}</p>
            </div>
            {otherRevenue > 0 && (
              <div className="rounded-xl border border-purple-400/20 bg-gradient-to-br from-purple-500/30 to-purple-400/10 px-2.5 py-1.5 sm:px-3 sm:py-2 backdrop-blur shadow-2xs">
                <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-purple-100 font-medium">Other Sales</p>
                <p className="text-base sm:text-lg font-bold text-purple-50 mt-0.5">₵{otherRevenue.toFixed(2)}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-2xs overflow-hidden">
        <CardContent className="p-3.5 sm:p-5">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">Transactions</h2>
              <p className="text-xs text-slate-500">Search and review past sales.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2 max-w-full">
              {/* Date Filters */}
              <div className="flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {dateFilter === 'CUSTOM' ? (
                  <div className="flex items-center gap-1">
                    <Input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="h-7 text-xs px-1.5 w-28 border-slate-200"
                    />
                    <span className="text-slate-400 text-xs">-</span>
                    <Input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="h-7 text-xs px-1.5 w-28 border-slate-200"
                    />
                    <Button variant="ghost" size="sm" onClick={() => { setDateFilter('WEEK'); setCustomStartDate(''); setCustomEndDate(''); }} className="text-red-500 hover:text-red-700 h-7 px-1.5 font-bold">✕</Button>
                  </div>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { setDateFilter('CUSTOM'); setCurrentPage(1); }}
                    className="h-7 px-2 text-xs text-slate-600 hover:bg-slate-200"
                  >
                    Custom Date
                  </Button>
                )}
                <Button
                  variant={dateFilter === 'TODAY' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setDateFilter('TODAY'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${dateFilter === 'TODAY' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  Today
                </Button>
                <Button
                  variant={dateFilter === 'WEEK' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setDateFilter('WEEK'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${dateFilter === 'WEEK' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  This Week
                </Button>
                <Button
                  variant={dateFilter === 'MONTH' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setDateFilter('MONTH'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${dateFilter === 'MONTH' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  This Month
                </Button>
              </div>

              {/* Payment Method Filters */}
              <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                <Button
                  variant={paymentFilter === 'ALL' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setPaymentFilter('ALL'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${paymentFilter === 'ALL' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  All Methods
                </Button>
                <Button
                  variant={paymentFilter === 'CASH' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setPaymentFilter('CASH'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${paymentFilter === 'CASH' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  Cash
                </Button>
                <Button
                  variant={paymentFilter === 'MOBILE' ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => { setPaymentFilter('MOBILE'); setCurrentPage(1); }}
                  className={`h-7 px-2 text-xs ${paymentFilter === 'MOBILE' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'text-slate-600'}`}
                >
                  Mobile
                </Button>
              </div>

              {/* Search Box */}
              <div className="relative flex-1 sm:flex-initial sm:w-56 md:w-64 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <Input
                  placeholder="Search invoice or customer..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="h-8 text-xs border-slate-200 bg-slate-50 pl-8 rounded-lg"
                />
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
            </div>
          ) : (
            <div className="w-full max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <Table className="w-full text-xs">
                <TableHeader>
                  <TableRow className="bg-slate-50 border-b border-slate-200">
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[110px]">Invoice</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[130px]">Date & Time</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[120px]">Customer</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[80px]">Items</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[80px]">Total</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 min-w-[120px]">Payment</TableHead>
                    <TableHead className="text-slate-700 font-semibold py-2.5 px-3 text-right min-w-[60px]">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedSales.map((sale) => (
                    <TableRow
                      key={sale.id}
                      className="border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/50 cursor-pointer"
                      onClick={() => setSelectedSale(sale)}
                    >
                      <TableCell className="font-semibold text-slate-800 py-2 px-3 whitespace-nowrap">
                        INV-{sale.id.slice(0, 8).toUpperCase()}
                      </TableCell>
                      <TableCell className="text-slate-600 py-2 px-3 whitespace-nowrap">
                        {format(new Date(sale.date), 'dd MMM yyyy HH:mm')}
                      </TableCell>
                      <TableCell className="font-medium text-slate-700 py-2 px-3 whitespace-nowrap">
                        {sale.customer?.name || 'Walk-in Customer'}
                      </TableCell>
                      <TableCell className="text-slate-600 py-2 px-3 whitespace-nowrap">
                        {sale.items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0) || 0} units
                      </TableCell>
                      <TableCell className="font-bold text-slate-900 py-2 px-3 whitespace-nowrap">
                        ₵{Number(sale.total).toFixed(2)}
                      </TableCell>
                      <TableCell className="py-2 px-3 whitespace-nowrap">
                        {(() => {
                          const bd = getSaleBreakdown(sale)
                          return (
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ${getPaymentMethodColor(sale.paymentMethod)}`}
                              title={bd.displayLabel}
                            >
                              {bd.isSplit ? (
                                <span>SPLIT (₵{bd.cash.toFixed(0)}C / ₵{bd.momo.toFixed(0)}M)</span>
                              ) : (
                                bd.displayLabel
                              )}
                            </span>
                          )
                        })()}
                      </TableCell>
                      <TableCell className="py-2 px-3 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                          title="Reprint Receipt"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePrintSaleReceipt(sale)
                          }}
                          disabled={isPrinting}
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedSales.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={7} className="py-8 text-center text-slate-500">
                        No transactions found matching the search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredSales.length > 0 && (
            <div className="mt-4 flex flex-col gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-2xs sm:flex-row sm:items-center sm:justify-between text-xs">
              <p className="text-slate-600">
                Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span>
                {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filteredSales.length)}</span>
                {' '}of <span className="font-semibold text-slate-800">{filteredSales.length}</span> transactions
              </p>

              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-7 w-7 rounded-md p-0"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </Button>

                {getVisiblePages(safeCurrentPage, totalPages).map((p) => {
                  if (typeof p === 'string') {
                    return (
                      <span key={p} className="px-1 text-slate-400">
                        ...
                      </span>
                    )
                  }
                  return (
                    <Button
                      key={p}
                      variant={p === safeCurrentPage ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(p)}
                      className={
                        p === safeCurrentPage
                          ? 'h-7 min-w-7 px-2 bg-blue-600 text-white hover:bg-blue-700 text-xs'
                          : 'h-7 min-w-7 px-2 text-slate-600 text-xs'
                      }
                    >
                      {p}
                    </Button>
                  )
                })}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="h-7 w-7 rounded-md p-0"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)}>
        <DialogContent className="max-w-3xl font-sans">
          <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <DialogTitle className="text-xl text-slate-800">Transaction Details</DialogTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePrintSaleReceipt(selectedSale)}
              disabled={isPrinting}
              className="h-8 gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium"
            >
              {isPrinting ? <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-600" /> : <Printer className="h-3.5 w-3.5 text-blue-600" />}
              {isPrinting ? 'Printing...' : 'Reprint Receipt'}
            </Button>
          </DialogHeader>
          {selectedSale && (
            <div className="space-y-6 mt-2">
              <div className="grid grid-cols-2 gap-4 text-sm bg-slate-50 p-4 rounded-xl border border-slate-100">
                <div>
                  <p className="text-slate-500 mb-1">Invoice ID</p>
                  <p className="font-bold text-indigo-700">INV-{selectedSale.id.slice(0, 8).toUpperCase()}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Date & Time</p>
                  <p className="font-semibold text-slate-800">{format(new Date(selectedSale.date), 'dd MMM yyyy HH:mm')}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Customer</p>
                  <p className="font-semibold text-slate-800">{selectedSale.customer?.name || 'Walk-in Customer'}</p>
                </div>
                <div>
                  <p className="text-slate-500 mb-1">Payment Method</p>
                  <p className="font-semibold text-slate-800">
                    {(() => {
                      const bd = getSaleBreakdown(selectedSale)
                      return (
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${getPaymentMethodColor(selectedSale.paymentMethod)}`}>
                          {bd.isSplit ? 'SPLIT' : bd.displayLabel}
                        </span>
                      )
                    })()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-slate-800 mb-3 border-b pb-2">Items Purchased</h3>
                <div className="max-h-[250px] overflow-y-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-50">
                        <TableHead className="text-slate-700">Item</TableHead>
                        <TableHead className="text-center text-slate-700">Qty</TableHead>
                        <TableHead className="text-right text-slate-700">Price</TableHead>
                        <TableHead className="text-right text-slate-700">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedSale.items && selectedSale.items.length > 0 ? (
                        selectedSale.items.map((item: any, i: number) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium text-slate-800">
                              {resolveItemName(item)}
                            </TableCell>
                            <TableCell className="text-center text-slate-600">{item.quantity || 1}</TableCell>
                            <TableCell className="text-right text-slate-600">
                              ₵{Number(item.price ?? item.unit_price ?? item.medicine?.price ?? 0).toFixed(2)}
                            </TableCell>
                            <TableCell className="text-right font-semibold text-slate-800">
                              ₵{(Number(item.subtotal ?? ((item.price ?? item.unit_price ?? item.medicine?.price ?? 0) * (item.quantity || 1)))).toFixed(2)}
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={4} className="py-6 text-center text-slate-500">
                            No item breakdown recorded for this transaction.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="flex justify-end border-t pt-4">
                <div className="w-72 space-y-3">
                  <div className="flex justify-between text-xl font-bold text-slate-800">
                    <span>Total:</span>
                    <span className="text-indigo-600">₵{Number(selectedSale.total).toFixed(2)}</span>
                  </div>
                  {(() => {
                    const bd = getSaleBreakdown(selectedSale)
                    if (!bd.isSplit && (!selectedSale.payments || selectedSale.payments.length <= 1)) return null

                    const paymentEntries =
                      selectedSale.payments && selectedSale.payments.length > 0
                        ? selectedSale.payments.filter((p: any) => Number(p.amount) > 0)
                        : [
                          ...(bd.cash > 0 ? [{ method: 'CASH', amount: bd.cash }] : []),
                          ...(bd.momo > 0 ? [{ method: 'MOBILE', amount: bd.momo }] : []),
                          ...(bd.other > 0 ? [{ method: 'OTHER', amount: bd.other }] : []),
                        ]

                    return (
                      <div className="mt-4 text-sm text-slate-600 border-t pt-3 space-y-2">
                        <p className="font-medium text-slate-800 mb-1 uppercase tracking-wider text-xs">Split Breakdown</p>
                        {paymentEntries.map((p: any, i: number) => {
                          const mUpper = (p.method || '').toUpperCase()
                          const isCash = mUpper.includes('CASH')
                          const isMob = mUpper.includes('MOBILE') || mUpper.includes('MOMO')
                          const label = isMob ? 'Mobile Money (MoMo)' : isCash ? 'Cash' : p.method
                          return (
                            <div key={i} className="flex justify-between items-center">
                              <span className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isCash ? 'bg-emerald-500' : isMob ? 'bg-amber-500' : 'bg-slate-500'}`}></span>
                                {label}
                              </span>
                              <span className="font-bold text-slate-800">₵{Number(p.amount).toFixed(2)}</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  })()}
                </div>
              </div>

              <DialogFooter className="border-t pt-4 flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-2">
                {enableRefund ? (
                  <Button
                    variant="destructive"
                    onClick={() => {
                      if (confirm('Are you sure you want to refund this transaction? This will return items to stock and delete the transaction.')) {
                        refundMutation.mutate(selectedSale.id)
                      }
                    }}
                    disabled={refundMutation.isPending}
                  >
                    {refundMutation.isPending ? 'Refunding...' : 'Refund Transaction'}
                  </Button>
                ) : (
                  <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 font-medium text-center">
                    Refunds are disabled in POS Settings
                  </span>
                )}
                <div className="flex items-center gap-2 justify-end">
                  <Button
                    variant="outline"
                    onClick={() => handlePrintSaleReceipt(selectedSale)}
                    disabled={isPrinting}
                    className="gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50 font-medium"
                  >
                    {isPrinting ? <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> : <Printer className="h-4 w-4 text-blue-600" />}
                    {isPrinting ? 'Printing...' : 'Print Receipt'}
                  </Button>
                  <Button variant="outline" onClick={() => setSelectedSale(null)}>Close</Button>
                </div>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
