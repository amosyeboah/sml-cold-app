import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ShieldAlert,
  ShieldCheck,
  Search,
  Filter,
  DollarSign,
  Package,
  Download,
  RefreshCw,
  AlertTriangle,
  Info,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Trash2,
  Edit2,
  ClipboardList,
  UserCheck,
  User,
  Users,
  Receipt,
  Smartphone,
  Banknote,
  Eye,
  CheckCircle2,
  ArrowRight,
  Printer,
  ShoppingBag,
  Clock,
  Sparkles,
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { cn } from '@/utils'
import { api } from '@/services/api'
import { getSaleBreakdown } from '@/pages/SalesHistory'
import type { AuditLog, AuditSeverity } from '@/types'

const ITEMS_PER_PAGE = 15

// ─── Format details text with highlighted amounts and entities ────────────────
function formatDetailsText(text: string) {
  if (!text) return null
  const parts = text.split(/(GH₵\s*[0-9,]+(?:\.[0-9]{2})?|₵\s*[0-9,]+(?:\.[0-9]{2})?|"[^"]+")/g)
  return parts.map((part, i) => {
    if (part.startsWith('GH₵') || part.startsWith('₵')) {
      return (
        <span key={i} className="font-semibold text-emerald-700 font-mono">
          {part}
        </span>
      )
    }
    if (part.startsWith('"') && part.endsWith('"')) {
      return (
        <span key={i} className="font-semibold text-slate-900 bg-slate-100/80 px-1 py-0.5 rounded text-[11px]">
          {part.replace(/"/g, '')}
        </span>
      )
    }
    return <span key={i}>{part}</span>
  })
}

// ─── Friendly Activity Details Cell ──────────────────────────────────────────
function FriendlyActivityDetails({
  log,
  onAuditSale,
}: {
  log: AuditLog
  onAuditSale?: (saleNumberOrId: string) => void
}) {
  const [showRawJson, setShowRawJson] = useState(false)

  const meta = useMemo(() => {
    if (!log.metadata) return null
    if (typeof log.metadata === 'object') return log.metadata
    try {
      return JSON.parse(log.metadata)
    } catch {
      return null
    }
  }, [log.metadata])

  const isSale = log.category === 'SALES' || log.action.includes('SALE')
  const isPricing = log.category === 'PRICING' || log.action.includes('PRICE') || log.action.includes('COST')
  const isBatch = log.action.includes('BATCH') || log.category === 'INVENTORY'

  // Sale metadata resolution
  const saleId = meta?.saleId || meta?.id
  const saleNumber = meta?.saleNumber || (saleId ? `INV-${String(saleId).slice(0, 8).toUpperCase()}` : null)
  const customerName = meta?.customer || meta?.customerName
  const paymentMethod = meta?.paymentMethod
  const cashierAttributed = meta?.cashier || log.username

  // Price comparison resolution
  const oldPrice = meta?.oldPrice !== undefined ? Number(meta.oldPrice) : null
  const newPrice = meta?.newPrice !== undefined ? Number(meta.newPrice) : null
  const oldCost = meta?.oldCost !== undefined ? Number(meta.oldCost) : null
  const newCost = meta?.newCost !== undefined ? Number(meta.newCost) : null

  return (
    <div className="space-y-1.5 text-xs">
      {/* Primary readable narrative */}
      <div className="text-slate-800 font-medium leading-relaxed">
        {formatDetailsText(log.details)}
      </div>

      {/* Structured executive chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
        {isSale && (
          <>
            {saleNumber && (
              <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700 ring-1 ring-inset ring-blue-200">
                <Receipt className="h-3 w-3 text-blue-500" />
                {saleNumber}
              </span>
            )}
            {customerName && (
              <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
                <User className="h-3 w-3 text-slate-400" />
                {customerName}
              </span>
            )}
            {paymentMethod && (
              <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
                {String(paymentMethod).toUpperCase().includes('MOBILE') || String(paymentMethod).toUpperCase().includes('MOMO') ? (
                  <Smartphone className="h-3 w-3 text-emerald-600" />
                ) : (
                  <Banknote className="h-3 w-3 text-emerald-600" />
                )}
                {paymentMethod}
              </span>
            )}
            {meta?.itemsCount !== undefined && (
              <span className="inline-flex items-center gap-1 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 ring-1 ring-inset ring-indigo-200">
                <Package className="h-3 w-3 text-indigo-500" />
                {meta.itemsCount} {meta.itemsCount === 1 ? 'item' : 'items'}
              </span>
            )}
            {cashierAttributed && (
              <span className="inline-flex items-center gap-1 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-medium text-sky-700">
                <UserCheck className="h-3 w-3 text-sky-500" />
                Cashier: {cashierAttributed}
              </span>
            )}
            {onAuditSale && (saleNumber || saleId) && (
              <button
                type="button"
                onClick={() => onAuditSale(saleNumber || saleId)}
                className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-2 py-0.5 text-[10px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs ml-1"
              >
                <Eye className="h-2.5 w-2.5" />
                Audit Sale
              </button>
            )}
          </>
        )}

        {isPricing && (oldPrice !== null || newPrice !== null) && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-200">
            <span>GH₵{oldPrice?.toFixed(2)}</span>
            <ArrowRight className="h-3 w-3 text-amber-600" />
            <span className="text-emerald-700 font-bold">GH₵{newPrice?.toFixed(2)}</span>
          </span>
        )}

        {isPricing && (oldCost !== null || newCost !== null) && (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200">
            <span>Cost: GH₵{oldCost?.toFixed(2)}</span>
            <ArrowRight className="h-3 w-3 text-sky-600" />
            <span className="text-sky-900 font-bold">GH₵{newCost?.toFixed(2)}</span>
          </span>
        )}

        {meta?.batchNumber && (
          <span className="inline-flex items-center gap-1 rounded-md bg-cyan-50 px-2 py-0.5 font-mono text-[11px] text-cyan-800 ring-1 ring-inset ring-cyan-200">
            <Layers className="h-3 w-3 text-cyan-600" />
            Lot #{meta.batchNumber}
          </span>
        )}

        {meta?.quantity !== undefined && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 font-medium">
            <Package className="h-3 w-3 text-slate-500" />
            {meta.quantity} cartons
          </span>
        )}

        {meta?.phone && (
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            📞 {meta.phone}
          </span>
        )}

        {/* Clean expandable JSON toggle */}
        {meta && (
          <button
            type="button"
            onClick={() => setShowRawJson(!showRawJson)}
            className="text-[10px] font-mono text-slate-400 hover:text-slate-700 hover:underline ml-1"
          >
            {showRawJson ? 'Hide Raw JSON' : '{ JSON }'}
          </button>
        )}
      </div>

      {/* Expandable technical payload */}
      {showRawJson && meta && (
        <pre className="mt-2 p-2.5 rounded-lg bg-slate-900 text-slate-200 text-[10px] font-mono overflow-x-auto max-w-xl border border-slate-800">
          {JSON.stringify(meta, null, 2)}
        </pre>
      )}
    </div>
  )
}

export default function AuditTrail() {
  const [activeTab, setActiveTab] = useState<'audit' | 'staff-sales'>('audit')

  // Compliance Audit Tab State
  const [searchTerm, setSearchTerm] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [activityTypeFilter, setActivityTypeFilter] = useState('all')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [currentPage, setCurrentPage] = useState(1)

  // Staff Sales Audit Tab State
  const [selectedStaff, setSelectedStaff] = useState<string>('all')
  const [salesSearch, setSalesSearch] = useState<string>('')
  const [salesDatePreset, setSalesDatePreset] = useState<'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom'>('all')
  const [customStartDate, setCustomStartDate] = useState<string>('')
  const [customEndDate, setCustomEndDate] = useState<string>('')
  const [salesPaymentFilter, setSalesPaymentFilter] = useState<string>('all')
  const [salesPage, setSalesPage] = useState<number>(1)
  const [inspectedSale, setInspectedSale] = useState<any | null>(null)

  const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

  // 1. Fetch Audit Logs
  const { data: logs = [], isLoading: logsLoading, isFetching: logsFetching, refetch: refetchLogs } = useQuery<AuditLog[]>({
    queryKey: ['audit-logs', categoryFilter, severityFilter],
    queryFn: () => apiClient.getAuditLogs({
      category: categoryFilter,
      severity: severityFilter,
    }),
  })

  // 2. Fetch Sales Data
  const { data: sales = [], isLoading: salesLoading, isFetching: salesFetching, refetch: refetchSales } = useQuery<any[]>({
    queryKey: ['sales'],
    queryFn: () => apiClient.getSales(),
  })

  // 3. Fetch Users
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => (apiClient.getUsers ? apiClient.getUsers() : []),
  })

  // ─── Filter Compliance Logs ────────────────────────────────────────────────
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (activityTypeFilter === 'deletions' && !log.action.includes('DELETE')) return false
      if (
        activityTypeFilter === 'edits' &&
        !log.action.includes('UPDATE') &&
        !log.action.includes('CHANGE') &&
        !log.action.includes('ADJUSTMENT') &&
        !log.action.includes('SETTING')
      )
        return false
      if (
        activityTypeFilter === 'creations' &&
        !log.action.includes('CREATE') &&
        !log.action.includes('RECEIVE') &&
        !log.action.includes('SALE')
      )
        return false
      if (activityTypeFilter === 'critical' && log.severity !== 'CRITICAL' && log.severity !== 'WARNING')
        return false

      const term = searchTerm.toLowerCase().trim()
      if (!term) return true

      return (
        log.action.toLowerCase().includes(term) ||
        log.details.toLowerCase().includes(term) ||
        (log.username && log.username.toLowerCase().includes(term)) ||
        (log.userRole && log.userRole.toLowerCase().includes(term))
      )
    })
  }, [logs, searchTerm, activityTypeFilter])

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  // ─── Staff Sales Aggregations ─────────────────────────────────────────────
  const staffMembers = useMemo(() => {
    const staffMap = new Map<string, {
      username: string
      role: string
      salesCount: number
      totalRevenue: number
      cashTotal: number
      momoTotal: number
    }>()

    // 1. Prepopulate with registered users
    users.forEach((u: any) => {
      const uname = (u.username || 'System').trim()
      staffMap.set(uname.toLowerCase(), {
        username: uname,
        role: u.role || 'STAFF',
        salesCount: 0,
        totalRevenue: 0,
        cashTotal: 0,
        momoTotal: 0,
      })
    })

    // 2. Aggregate sales
    sales.forEach((s: any) => {
      const cashierName = (s.cashier || 'cashier').trim()
      const key = cashierName.toLowerCase()
      if (!staffMap.has(key)) {
        staffMap.set(key, {
          username: cashierName,
          role: s.userRole || 'CASHIER',
          salesCount: 0,
          totalRevenue: 0,
          cashTotal: 0,
          momoTotal: 0,
        })
      }
      const entry = staffMap.get(key)!
      entry.salesCount += 1
      const total = Number(s.total) || 0
      entry.totalRevenue += total

      const breakdown = getSaleBreakdown(s)
      entry.cashTotal += breakdown.cash
      entry.momoTotal += breakdown.momo
    })

    return Array.from(staffMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue)
  }, [sales, users])

  // ─── Filter Staff Sales ───────────────────────────────────────────────────
  const filteredSales = useMemo(() => {
    return sales.filter((s: any) => {
      // 1. Staff filter
      const cashier = (s.cashier || 'cashier').trim().toLowerCase()
      if (selectedStaff !== 'all' && cashier !== selectedStaff.toLowerCase()) {
        return false
      }

      // 2. Date preset filter
      const saleDate = new Date(s.date)
      const now = new Date()
      if (salesDatePreset === 'today') {
        const isToday =
          saleDate.getFullYear() === now.getFullYear() &&
          saleDate.getMonth() === now.getMonth() &&
          saleDate.getDate() === now.getDate()
        if (!isToday) return false
      } else if (salesDatePreset === 'yesterday') {
        const yest = new Date()
        yest.setDate(now.getDate() - 1)
        const isYest =
          saleDate.getFullYear() === yest.getFullYear() &&
          saleDate.getMonth() === yest.getMonth() &&
          saleDate.getDate() === yest.getDate()
        if (!isYest) return false
      } else if (salesDatePreset === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        if (saleDate < weekAgo) return false
      } else if (salesDatePreset === 'month') {
        const isThisMonth =
          saleDate.getFullYear() === now.getFullYear() && saleDate.getMonth() === now.getMonth()
        if (!isThisMonth) return false
      } else if (salesDatePreset === 'custom') {
        if (customStartDate && saleDate < new Date(`${customStartDate}T00:00:00`)) return false
        if (customEndDate && saleDate > new Date(`${customEndDate}T23:59:59`)) return false
      }

      // 3. Payment filter
      if (salesPaymentFilter !== 'all') {
        const breakdown = getSaleBreakdown(s)
        if (salesPaymentFilter === 'CASH' && breakdown.cash <= 0) return false
        if (salesPaymentFilter === 'MOBILE' && breakdown.momo <= 0) return false
        if (salesPaymentFilter === 'SPLIT' && !breakdown.isSplit) return false
      }

      // 4. Search query
      const term = salesSearch.toLowerCase().trim()
      if (!term) return true

      const saleNumber = (s.saleNumber || `INV-${String(s.id).slice(0, 8)}`).toLowerCase()
      const customer = (s.customerName || 'Walk-in Customer').toLowerCase()
      const staffName = cashier
      const itemsMatch = (s.items || []).some((item: any) =>
        (item.name || item.product_name || '').toLowerCase().includes(term)
      )

      return saleNumber.includes(term) || customer.includes(term) || staffName.includes(term) || itemsMatch
    })
  }, [sales, selectedStaff, salesDatePreset, customStartDate, customEndDate, salesPaymentFilter, salesSearch])

  const totalSalesPages = Math.max(1, Math.ceil(filteredSales.length / ITEMS_PER_PAGE))
  const safeSalesPage = Math.min(salesPage, totalSalesPages)
  const salesStartIndex = (safeSalesPage - 1) * ITEMS_PER_PAGE
  const paginatedSales = filteredSales.slice(salesStartIndex, salesStartIndex + ITEMS_PER_PAGE)

  // ─── Staff Sales Metrics ──────────────────────────────────────────────────
  const staffSalesMetrics = useMemo(() => {
    let count = filteredSales.length
    let revenue = 0
    let cash = 0
    let momo = 0

    filteredSales.forEach((s) => {
      const tot = Number(s.total) || 0
      revenue += tot
      const bd = getSaleBreakdown(s)
      cash += bd.cash
      momo += bd.momo
    })

    const avg = count > 0 ? revenue / count : 0
    return { count, revenue, cash, momo, avg }
  }, [filteredSales])

  // KPI calculations for Audit
  const totalCount = logs.length
  const deletionsCount = logs.filter((l) => l.action.includes('DELETE')).length
  const editsCount = logs.filter((l) =>
    l.action.includes('UPDATE') ||
    l.action.includes('CHANGE') ||
    l.action.includes('ADJUSTMENT') ||
    l.action.includes('SETTING')
  ).length
  const majorActivitiesCount = logs.filter((l) =>
    l.action.includes('CREATE') ||
    l.action.includes('RECEIVE') ||
    l.action.includes('SALE') ||
    l.action.includes('LOGIN')
  ).length

  // Helper badges
  const getSeverityBadge = (severity: AuditSeverity) => {
    switch (severity) {
      case 'CRITICAL':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-bold text-rose-700 ring-1 ring-inset ring-rose-200">
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
            CRITICAL
          </span>
        )
      case 'WARNING':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 ring-1 ring-inset ring-amber-200">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            WARNING
          </span>
        )
      case 'INFO':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-200">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
            INFO
          </span>
        )
    }
  }

  const getRoleBadge = (role?: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return <span className="rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-bold text-purple-700">Admin</span>
      case 'MANAGER':
        return <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Manager</span>
      case 'CASHIER':
        return <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-700">Cashier</span>
      default:
        return <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">Staff</span>
    }
  }

  const getActionTag = (action: string, category: string) => {
    let color = 'bg-slate-100 text-slate-700 border-slate-200'

    if (action.includes('DELETE')) {
      color = 'bg-rose-50 text-rose-800 border-rose-200 font-bold'
    } else if (
      action.includes('UPDATE') ||
      action.includes('CHANGE') ||
      action.includes('ADJUSTMENT') ||
      action.includes('SETTING')
    ) {
      color = 'bg-amber-50 text-amber-800 border-amber-200 font-semibold'
    } else if (action.includes('CREATE') || action.includes('RECEIVE') || action.includes('SALE')) {
      color = 'bg-emerald-50 text-emerald-800 border-emerald-200 font-semibold'
    } else if (category === 'PRICING') {
      color = 'bg-amber-50 text-amber-800 border-amber-200'
    } else if (category === 'AUTH') {
      color = 'bg-purple-50 text-purple-800 border-purple-200'
    } else if (category === 'SALES') {
      color = 'bg-emerald-50 text-emerald-800 border-emerald-200'
    } else if (category === 'PURCHASES') {
      color = 'bg-sky-50 text-sky-800 border-sky-200'
    } else if (category === 'INVENTORY') {
      color = 'bg-cyan-50 text-cyan-800 border-cyan-200'
    } else if (category === 'SYSTEM') {
      color = 'bg-indigo-50 text-indigo-800 border-indigo-200'
    }

    return (
      <span className={`inline-block font-mono text-[11px] font-semibold px-2 py-0.5 rounded border ${color}`}>
        {action}
      </span>
    )
  }

  // Jump from audit log directly to sale audit
  const handleJumpToSaleAudit = (saleNumberOrId: string) => {
    setActiveTab('staff-sales')
    setSalesSearch(saleNumberOrId)
    setSalesPage(1)

    // Check if the sale exists in loaded sales list and open details
    const target = sales.find(
      (s: any) =>
        s.id === saleNumberOrId ||
        (s.saleNumber && s.saleNumber.toLowerCase() === saleNumberOrId.toLowerCase()) ||
        `INV-${String(s.id).slice(0, 8).toUpperCase()}` === saleNumberOrId.toUpperCase()
    )
    if (target) {
      setInspectedSale(target)
    }
  }

  // Export audit events
  const exportAuditCSV = () => {
    const headers = ['Timestamp', 'Action', 'Category', 'Severity', 'Operator', 'Role', 'Details']
    const rows = filteredLogs.map((l) => [
      `"${new Date(l.createdAt).toLocaleString()}"`,
      `"${l.action}"`,
      `"${l.category}"`,
      `"${l.severity}"`,
      `"${l.username || 'System'}"`,
      `"${l.userRole || 'SYSTEM'}"`,
      `"${l.details.replace(/"/g, '""')}"`,
    ])

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sml_coldstore_audit_trail_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Export staff sales
  const exportStaffSalesCSV = () => {
    const headers = ['Invoice Number', 'Date & Time', 'Staff Operator', 'Staff Role', 'Customer', 'Items Count', 'Payment Method', 'Cash Tender (GH₵)', 'MoMo Tender (GH₵)', 'Total Amount (GH₵)']
    const rows = filteredSales.map((s) => {
      const bd = getSaleBreakdown(s)
      return [
        `"${s.saleNumber || `INV-${String(s.id).slice(0, 8)}`}"`,
        `"${new Date(s.date).toLocaleString()}"`,
        `"${s.cashier || 'cashier'}"`,
        `"${s.userRole || 'CASHIER'}"`,
        `"${s.customerName || 'Walk-in Customer'}"`,
        (s.items || []).length,
        `"${s.paymentMethod || 'CASH'}"`,
        bd.cash.toFixed(2),
        bd.momo.toFixed(2),
        Number(s.total || 0).toFixed(2),
      ]
    })

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `sml_staff_sales_audit_${selectedStaff}_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50">
      {/* ── Top Header Banner ── */}
      <div
        className="relative overflow-hidden rounded-2xl border border-blue-200 p-3.5 sm:p-4 text-white shadow-xs"
        style={{ backgroundColor: '#2563eb' }}
      >
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                SOFIYEM Legacy Limited • Security &amp; Loss Prevention
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                Staff Attribution Enabled
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-sky-100" />
              Store Audit Trail &amp; Staff Sales Ledger
            </h1>
            <p className="text-xs text-sky-100/90 max-w-2xl">
              Track real-time administrative actions, inventory movements, price edits, and identify exact staff operators responsible for every customer transaction.
            </p>
          </div>

          {/* Quick Metrics Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-sky-100 font-medium">
                <Layers className="h-3 w-3" /> Audit Events
              </div>
              <p className="text-base sm:text-lg font-bold mt-0.5">{totalCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-emerald-400/20 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-emerald-100 font-medium">
                <ShoppingBag className="h-3 w-3" /> Total Sales
              </div>
              <p className="text-base sm:text-lg font-bold mt-0.5">{sales.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-amber-400/20 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-amber-100 font-medium">
                <Edit2 className="h-3 w-3" /> Edits / Changes
              </div>
              <p className="text-base sm:text-lg font-bold mt-0.5">{editsCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-rose-400/20 px-3 py-2 backdrop-blur-sm">
              <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-rose-100 font-medium">
                <Trash2 className="h-3 w-3" /> Deletions
              </div>
              <p className="text-base sm:text-lg font-bold mt-0.5">{deletionsCount}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Tab Navigation Bar ── */}
      <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 rounded-xl shadow-xs">
        <button
          type="button"
          onClick={() => setActiveTab('audit')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all",
            activeTab === 'audit'
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <ClipboardList className="h-4 w-4" />
          <span>Compliance &amp; Activity Log</span>
          <span className={cn(
            "ml-1 px-2 py-0.5 text-[11px] rounded-full font-bold",
            activeTab === 'audit' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
          )}>
            {logs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('staff-sales')}
          className={cn(
            "flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all",
            activeTab === 'staff-sales'
              ? "bg-blue-600 text-white shadow-xs"
              : "text-slate-600 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          <UserCheck className="h-4 w-4" />
          <span>Staff Sales Audit</span>
          <span className={cn(
            "ml-1 px-2 py-0.5 text-[11px] rounded-full font-bold",
            activeTab === 'staff-sales' ? "bg-white/20 text-white" : "bg-slate-200 text-slate-700"
          )}>
            {sales.length}
          </span>
        </button>
      </div>

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: COMPLIANCE & ACTIVITY LOGS (FRIENDLY DETAILS)                     */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'audit' && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="p-4 sm:p-6 space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search Input */}
              <div className="relative w-full lg:w-80">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search actions, items, staff..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="border-slate-200 bg-slate-50 pl-9 text-sm"
                />
              </div>

              {/* Filters */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Activity Type Filter */}
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-600">Activity:</span>
                  <select
                    value={activityTypeFilter}
                    onChange={(e) => {
                      setActivityTypeFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Activities</option>
                    <option value="deletions">🗑️ Deletions Only</option>
                    <option value="edits">✏️ Edits &amp; Updates</option>
                    <option value="creations">📋 Additions &amp; Restocks</option>
                    <option value="critical">⚠️ Warnings &amp; Critical</option>
                  </select>
                </div>

                {/* Category Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Category:</span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => {
                      setCategoryFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Categories</option>
                    <option value="SALES">Sales &amp; POS Receipts</option>
                    <option value="PRICING">Pricing &amp; Cost</option>
                    <option value="INVENTORY">Inventory &amp; Batches</option>
                    <option value="PURCHASES">Procurement &amp; Purchases</option>
                    <option value="AUTH">Staff &amp; Authentication</option>
                    <option value="SYSTEM">System &amp; Settings</option>
                  </select>
                </div>

                {/* Severity Filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-600">Severity:</span>
                  <select
                    value={severityFilter}
                    onChange={(e) => {
                      setSeverityFilter(e.target.value)
                      setCurrentPage(1)
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Severities</option>
                    <option value="INFO">Info</option>
                    <option value="WARNING">Warning</option>
                    <option value="CRITICAL">Critical</option>
                  </select>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchLogs()}
                  disabled={logsFetching}
                  className="gap-1.5 h-9 text-xs border-slate-200"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${logsFetching ? 'animate-spin' : ''}`} /> Refresh
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportAuditCSV}
                  className="gap-1.5 h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                >
                  <Download className="w-3.5 h-3.5" /> Export CSV
                </Button>
              </div>
            </div>

            {/* Table Container */}
            {logsLoading ? (
              <div className="flex h-56 items-center justify-center">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
              </div>
            ) : (
              <div className="max-h-[calc(100vh-340px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50">
                      <TableHead className="w-40 text-slate-700">Timestamp</TableHead>
                      <TableHead className="w-28 text-slate-700">Severity</TableHead>
                      <TableHead className="w-44 text-slate-700">Action / Type</TableHead>
                      <TableHead className="w-40 text-slate-700">Staff Operator</TableHead>
                      <TableHead className="text-slate-700">Activity Details (Executive)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedLogs.map((log) => (
                      <TableRow
                        key={log.id}
                        className="border-b border-slate-100 bg-white transition-colors hover:bg-gradient-to-r hover:from-blue-50/50 hover:via-white hover:to-indigo-50/50"
                      >
                        {/* Timestamp */}
                        <TableCell className="text-xs text-slate-600 font-mono py-3">
                          <div className="font-semibold text-slate-800">{new Date(log.createdAt).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Clock className="h-3 w-3" />
                            {new Date(log.createdAt).toLocaleTimeString()}
                          </div>
                        </TableCell>

                        {/* Severity */}
                        <TableCell className="py-3">
                          {getSeverityBadge(log.severity)}
                        </TableCell>

                        {/* Action */}
                        <TableCell className="py-3 space-y-1">
                          <div>{getActionTag(log.action, log.category)}</div>
                          <div className="text-[10px] uppercase font-semibold text-slate-400">{log.category}</div>
                        </TableCell>

                        {/* Operator */}
                        <TableCell className="py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-xs text-slate-800 flex items-center gap-1">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              {log.username || 'System'}
                            </span>
                            {getRoleBadge(log.userRole)}
                          </div>
                        </TableCell>

                        {/* Friendly Activity Details */}
                        <TableCell className="py-3">
                          <FriendlyActivityDetails log={log} onAuditSale={handleJumpToSaleAudit} />
                        </TableCell>
                      </TableRow>
                    ))}

                    {paginatedLogs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="py-12 text-center text-slate-500">
                          <ShieldAlert className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="font-semibold text-slate-700">No audit events match your filters</p>
                          <p className="text-xs text-slate-400 mt-1">Try clearing search filters or selecting &ldquo;All Categories&rdquo;.</p>
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Pagination */}
            {filteredLogs.length > 0 && (
              <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs sm:text-sm text-slate-600">
                  Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span>
                  {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filteredLogs.length)}</span>
                  {' '}of <span className="font-semibold text-slate-800">{filteredLogs.length}</span> audit logs
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

                  {Array.from({ length: totalPages }, (_, index) => index + 1).slice(
                    Math.max(0, safeCurrentPage - 3),
                    Math.min(totalPages, safeCurrentPage + 2)
                  ).map((page) => (
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
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: DEDICATED STAFF SALES AUDIT                                       */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      {activeTab === 'staff-sales' && (
        <div className="space-y-4">
          {/* ── Staff Sales KPI Summary Cards ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-slate-500 flex items-center gap-1">
                  <Receipt className="h-3.5 w-3.5 text-blue-500" />
                  Sales Processed
                </span>
                <p className="text-xl sm:text-2xl font-bold text-slate-800">
                  {staffSalesMetrics.count}
                </p>
                <p className="text-[11px] text-slate-400">
                  {selectedStaff === 'all' ? 'All staff operators' : `By @${selectedStaff}`}
                </p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-emerald-600 flex items-center gap-1">
                  <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
                  Total Revenue
                </span>
                <p className="text-xl sm:text-2xl font-bold text-emerald-700 font-mono">
                  GH₵{staffSalesMetrics.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400">Total gross receipts</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-sky-600 flex items-center gap-1">
                  <Banknote className="h-3.5 w-3.5 text-sky-500" />
                  Cash in Till
                </span>
                <p className="text-xl sm:text-2xl font-bold text-sky-700 font-mono">
                  GH₵{staffSalesMetrics.cash.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400">Drawer reconciliation</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-amber-600 flex items-center gap-1">
                  <Smartphone className="h-3.5 w-3.5 text-amber-500" />
                  Mobile Money
                </span>
                <p className="text-xl sm:text-2xl font-bold text-amber-700 font-mono">
                  GH₵{staffSalesMetrics.momo.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                <p className="text-[11px] text-slate-400">Verified MoMo receipts</p>
              </CardContent>
            </Card>

            <Card className="border-slate-200 shadow-xs bg-white col-span-2 lg:col-span-1">
              <CardContent className="p-3.5 space-y-1">
                <span className="text-[10px] uppercase tracking-wider font-semibold text-indigo-600 flex items-center gap-1">
                  <TrendingUp className="h-3.5 w-3.5 text-indigo-500" />
                  Avg. Ticket
                </span>
                <p className="text-xl sm:text-2xl font-bold text-indigo-700 font-mono">
                  GH₵{staffSalesMetrics.avg.toFixed(2)}
                </p>
                <p className="text-[11px] text-slate-400">Per customer sale</p>
              </CardContent>
            </Card>
          </div>

          {/* ── Staff Leaderboard Overview (when All Staff is chosen) ── */}
          {selectedStaff === 'all' && staffMembers.length > 0 && (
            <Card className="border-slate-200 shadow-xs bg-white">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="h-4 w-4 text-blue-600" />
                    Staff Performance Breakdown &amp; Cashier Reconciliation
                  </h3>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click any staff member to filter their sales
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
                  {staffMembers.map((staff) => (
                    <div
                      key={staff.username}
                      onClick={() => {
                        setSelectedStaff(staff.username)
                        setSalesPage(1)
                      }}
                      className="group cursor-pointer rounded-xl border border-slate-200 hover:border-blue-400 p-3 bg-slate-50/50 hover:bg-blue-50/40 transition-all shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="h-8 w-8 rounded-full bg-blue-600 text-white font-bold text-xs flex items-center justify-center uppercase shadow-xs">
                            {staff.username.slice(0, 2)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                              {staff.username}
                            </p>
                            <p className="text-[10px] text-slate-500">{getRoleBadge(staff.role)}</p>
                          </div>
                        </div>
                        <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700">
                          {staff.salesCount} sales
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-1.5 pt-2 border-t border-slate-200/80 text-[11px]">
                        <div>
                          <span className="text-[10px] text-slate-400 block">Revenue</span>
                          <span className="font-bold font-mono text-emerald-700">GH₵{staff.totalRevenue.toFixed(2)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 block">Till Cash</span>
                          <span className="font-semibold font-mono text-sky-700">GH₵{staff.cashTotal.toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Staff Sales Toolbar & Filters ── */}
          <Card className="border-slate-200 shadow-sm">
            <CardContent className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                {/* Staff Dropdown & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full lg:w-auto">
                  {/* Dedicated Staff Selector */}
                  <div className="relative min-w-[220px]">
                    <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                      <UserCheck className="h-4 w-4" />
                    </div>
                    <select
                      value={selectedStaff}
                      onChange={(e) => {
                        setSelectedStaff(e.target.value)
                        setSalesPage(1)
                      }}
                      className="h-9 w-full rounded-md border border-slate-200 bg-white pl-8 pr-3 text-xs font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">👥 All Staff Operators ({sales.length} Sales)</option>
                      {staffMembers.map((sm) => (
                        <option key={sm.username} value={sm.username}>
                          👤 {sm.username} [{sm.role}] — {sm.salesCount} sales (GH₵{sm.totalRevenue.toFixed(0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Search by Invoice, Customer, or Product */}
                  <div className="relative w-full sm:w-72">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input
                      placeholder="Invoice #, customer, or product..."
                      value={salesSearch}
                      onChange={(e) => {
                        setSalesSearch(e.target.value)
                        setSalesPage(1)
                      }}
                      className="border-slate-200 bg-slate-50 pl-9 text-xs sm:text-sm h-9"
                    />
                  </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2">
                  {/* Date Presets */}
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    <select
                      value={salesDatePreset}
                      onChange={(e: any) => {
                        setSalesDatePreset(e.target.value)
                        setSalesPage(1)
                      }}
                      className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">📅 All Time</option>
                      <option value="today">Today</option>
                      <option value="yesterday">Yesterday</option>
                      <option value="week">Past 7 Days</option>
                      <option value="month">This Month</option>
                      <option value="custom">Custom Date Range...</option>
                    </select>
                  </div>

                  {/* Custom Date Pickers */}
                  {salesDatePreset === 'custom' && (
                    <div className="flex items-center gap-1">
                      <Input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => {
                          setCustomStartDate(e.target.value)
                          setSalesPage(1)
                        }}
                        className="h-9 text-xs w-32 border-slate-200"
                      />
                      <span className="text-xs text-slate-400">to</span>
                      <Input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => {
                          setCustomEndDate(e.target.value)
                          setSalesPage(1)
                        }}
                        className="h-9 text-xs w-32 border-slate-200"
                      />
                    </div>
                  )}

                  {/* Payment Filter */}
                  <select
                    value={salesPaymentFilter}
                    onChange={(e) => {
                      setSalesPaymentFilter(e.target.value)
                      setSalesPage(1)
                    }}
                    className="h-9 rounded-md border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">All Payment Tenders</option>
                    <option value="CASH">Cash Only</option>
                    <option value="MOBILE">Mobile Money Only</option>
                    <option value="SPLIT">Split Payments</option>
                  </select>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => refetchSales()}
                    disabled={salesFetching}
                    className="gap-1.5 h-9 text-xs border-slate-200"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${salesFetching ? 'animate-spin' : ''}`} /> Refresh
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={exportStaffSalesCSV}
                    className="gap-1.5 h-9 text-xs border-blue-200 text-blue-700 hover:bg-blue-50"
                  >
                    <Download className="w-3.5 h-3.5" /> Export Sales
                  </Button>
                </div>
              </div>

              {/* Staff Filter Indicator Alert */}
              {selectedStaff !== 'all' && (
                <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3.5 py-2 border border-blue-200 text-xs text-blue-800">
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-blue-600" />
                    <span>
                      Filtering sales specifically created by staff operator <strong>@{selectedStaff}</strong>.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedStaff('all')}
                    className="text-blue-700 font-bold hover:underline text-[11px]"
                  >
                    Clear Filter (View All Staff)
                  </button>
                </div>
              )}

              {/* ── Staff Sales Table ── */}
              {salesLoading ? (
                <div className="flex h-56 items-center justify-center">
                  <div className="h-7 w-7 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                </div>
              ) : (
                <div className="max-h-[calc(100vh-340px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50">
                        <TableHead className="w-36 text-slate-700">Invoice / Ref</TableHead>
                        <TableHead className="w-40 text-slate-700">Date &amp; Time</TableHead>
                        <TableHead className="w-44 text-slate-700">Staff Operator (Cashier)</TableHead>
                        <TableHead className="w-44 text-slate-700">Customer</TableHead>
                        <TableHead className="text-slate-700">Items Sold</TableHead>
                        <TableHead className="w-40 text-slate-700">Payment Tender</TableHead>
                        <TableHead className="w-32 text-right text-slate-700">Amount (GH₵)</TableHead>
                        <TableHead className="w-28 text-center text-slate-700">Audit Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedSales.map((sale: any) => {
                        const breakdown = getSaleBreakdown(sale)
                        const cashier = sale.cashier || 'cashier'
                        const saleNum = sale.saleNumber || `INV-${String(sale.id).slice(0, 8).toUpperCase()}`
                        const total = Number(sale.total) || 0

                        return (
                          <TableRow
                            key={sale.id}
                            className="border-b border-slate-100 bg-white transition-colors hover:bg-blue-50/40"
                          >
                            {/* Invoice Number */}
                            <TableCell className="font-mono text-xs font-bold text-blue-700 py-3">
                              <span className="rounded bg-blue-50 px-2 py-1 border border-blue-200">
                                {saleNum}
                              </span>
                            </TableCell>

                            {/* Date */}
                            <TableCell className="text-xs text-slate-600 font-mono py-3">
                              <div className="font-medium text-slate-800">{new Date(sale.date).toLocaleDateString()}</div>
                              <div className="text-[11px] text-slate-400">{new Date(sale.date).toLocaleTimeString()}</div>
                            </TableCell>

                            {/* Staff Operator */}
                            <TableCell className="py-3">
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-full bg-slate-800 text-white text-[10px] font-bold flex items-center justify-center uppercase">
                                  {cashier.slice(0, 2)}
                                </div>
                                <div>
                                  <span className="font-semibold text-xs text-slate-900 block leading-tight">
                                    {cashier}
                                  </span>
                                  {getRoleBadge(sale.userRole)}
                                </div>
                              </div>
                            </TableCell>

                            {/* Customer */}
                            <TableCell className="text-xs text-slate-800 py-3 font-medium">
                              <div className="flex items-center gap-1.5">
                                <User className="h-3.5 w-3.5 text-slate-400" />
                                {sale.customerName || 'Walk-in Customer'}
                              </div>
                            </TableCell>

                            {/* Items Preview */}
                            <TableCell className="text-xs text-slate-700 py-3">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                                  <Package className="h-3 w-3 text-slate-500" />
                                  {(sale.items || []).reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)} Cartons
                                </span>
                                <span className="text-[11px] text-slate-500 truncate max-w-xs">
                                  {(sale.items || []).map((it: any) => `${it.quantity}x ${it.name || it.product_name || 'Item'}`).join(', ')}
                                </span>
                              </div>
                            </TableCell>

                            {/* Payment Breakdown */}
                            <TableCell className="py-3 text-xs">
                              {breakdown.isSplit ? (
                                <div className="space-y-0.5 text-[11px]">
                                  <span className="inline-block rounded bg-purple-50 px-1.5 py-0.5 font-bold text-purple-700 border border-purple-200">
                                    Split Payment
                                  </span>
                                  <div className="text-slate-500 font-mono text-[10px]">
                                    Cash: ₵{breakdown.cash.toFixed(2)} | MoMo: ₵{breakdown.momo.toFixed(2)}
                                  </div>
                                </div>
                              ) : breakdown.momo > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded bg-amber-50 px-2 py-0.5 font-medium text-amber-800 border border-amber-200">
                                  <Smartphone className="h-3 w-3 text-amber-600" />
                                  Mobile Money
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 font-medium text-emerald-800 border border-emerald-200">
                                  <Banknote className="h-3 w-3 text-emerald-600" />
                                  Cash
                                </span>
                              )}
                            </TableCell>

                            {/* Total Amount */}
                            <TableCell className="text-right font-mono font-bold text-sm text-emerald-700 py-3">
                              GH₵{total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>

                            {/* Audit Button */}
                            <TableCell className="text-center py-3">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setInspectedSale(sale)}
                                className="h-7 px-2.5 text-[11px] gap-1 border-blue-200 text-blue-700 hover:bg-blue-50"
                              >
                                <Eye className="h-3 w-3" />
                                Audit
                              </Button>
                            </TableCell>
                          </TableRow>
                        )
                      })}

                      {paginatedSales.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={8} className="py-12 text-center text-slate-500">
                            <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                            <p className="font-semibold text-slate-700">No sales match your staff or filter criteria</p>
                            <p className="text-xs text-slate-400 mt-1">Try selecting &ldquo;All Staff Operators&rdquo; or clearing the search bar.</p>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Staff Sales Pagination */}
              {filteredSales.length > 0 && (
                <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs sm:text-sm text-slate-600">
                    Showing <span className="font-semibold text-slate-800">{salesStartIndex + 1}</span>
                    {' '}-<span className="font-semibold text-slate-800">{Math.min(salesStartIndex + ITEMS_PER_PAGE, filteredSales.length)}</span>
                    {' '}of <span className="font-semibold text-slate-800">{filteredSales.length}</span> staff sales
                  </p>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesPage((prev) => Math.max(prev - 1, 1))}
                      disabled={safeSalesPage === 1}
                      className="h-8 w-8 rounded-md p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    {Array.from({ length: totalSalesPages }, (_, index) => index + 1).slice(
                      Math.max(0, safeSalesPage - 3),
                      Math.min(totalSalesPages, safeSalesPage + 2)
                    ).map((page) => (
                      <Button
                        key={page}
                        variant={page === safeSalesPage ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setSalesPage(page)}
                        className={page === safeSalesPage ? 'h-8 min-w-8 bg-blue-600 text-white hover:bg-blue-700' : 'h-8 min-w-8'}
                      >
                        {page}
                      </Button>
                    ))}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSalesPage((prev) => Math.min(prev + 1, totalSalesPages))}
                      disabled={safeSalesPage === totalSalesPages}
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
      )}

      {/* ──────────────────────────────────────────────────────────────────────── */}
      {/* SALE AUDIT DETAIL MODAL                                                  */}
      {/* ──────────────────────────────────────────────────────────────────────── */}
      <Dialog open={!!inspectedSale} onOpenChange={(open) => !open && setInspectedSale(null)}>
        <DialogContent className="max-w-2xl w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
          {inspectedSale && (() => {
            const saleNum = inspectedSale.saleNumber || `INV-${String(inspectedSale.id).slice(0, 8).toUpperCase()}`
            const breakdown = getSaleBreakdown(inspectedSale)
            const cashier = inspectedSale.cashier || 'cashier'
            const total = Number(inspectedSale.total) || 0
            const items = inspectedSale.items || []

            // Related audit log lookup
            const relatedLog = logs.find(
              (l) => l.metadata && (l.metadata.includes(inspectedSale.id) || (inspectedSale.saleNumber && l.metadata.includes(inspectedSale.saleNumber)))
            )

            return (
              <div className="space-y-4">
                <DialogHeader className="border-b border-slate-100 pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <DialogTitle className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-blue-600" />
                        Sale Audit &amp; Receipt Verification
                      </DialogTitle>
                      <p className="text-xs text-slate-500 mt-0.5 font-mono">
                        Invoice Reference: <span className="font-bold text-blue-700">{saleNum}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      Verified Transaction
                    </span>
                  </div>
                </DialogHeader>

                {/* Operator Attribution Alert Box */}
                <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-sky-50 p-3.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-blue-600 text-white font-bold text-sm flex items-center justify-center uppercase shadow-xs">
                        {cashier.slice(0, 2)}
                      </div>
                      <div>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Staff Operator:</span>
                          <span className="text-sm font-bold text-slate-900">@{cashier}</span>
                          {getRoleBadge(inspectedSale.userRole)}
                        </div>
                        <p className="text-xs text-slate-600 mt-0.5">
                          Logged transaction on {new Date(inspectedSale.date).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block uppercase">Customer</span>
                      <span className="text-xs font-bold text-slate-800">
                        {inspectedSale.customerName || 'Walk-in Customer'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Itemized Line Items Table */}
                <div className="rounded-xl border border-slate-200 overflow-hidden">
                  <Table>
                    <TableHeader className="bg-slate-50">
                      <TableRow>
                        <TableHead className="text-xs text-slate-700">Product / Item</TableHead>
                        <TableHead className="text-xs text-right text-slate-700">Unit Price</TableHead>
                        <TableHead className="text-xs text-center text-slate-700">Cartons / Qty</TableHead>
                        <TableHead className="text-xs text-right text-slate-700">Subtotal</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((it: any, idx: number) => {
                        const qty = Number(it.quantity) || 1
                        const price = Number(it.price) || 0
                        const lineTotal = qty * price
                        const name = it.name || it.product_name || 'Cold Store Item'
                        return (
                          <TableRow key={it.id || idx} className="text-xs border-b border-slate-100">
                            <TableCell className="font-medium text-slate-800 py-2.5">
                              <div>{name}</div>
                              {it.batchNumber && (
                                <div className="text-[10px] text-slate-400 font-mono">Lot: #{it.batchNumber}</div>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-600 py-2.5">
                              GH₵{price.toFixed(2)}
                            </TableCell>
                            <TableCell className="text-center font-bold text-slate-800 py-2.5">
                              {qty}
                            </TableCell>
                            <TableCell className="text-right font-mono font-bold text-slate-900 py-2.5">
                              GH₵{lineTotal.toFixed(2)}
                            </TableCell>
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>

                  {/* Summary Totals */}
                  <div className="bg-slate-50 p-3 border-t border-slate-200 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600">
                      <span>Total Cartons / Items:</span>
                      <span className="font-bold text-slate-800">
                        {items.reduce((acc: number, it: any) => acc + (Number(it.quantity) || 1), 0)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-600">
                      <span>Payment Tender:</span>
                      <span className="font-semibold text-slate-800">{breakdown.displayLabel}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold text-slate-900 pt-2 border-t border-slate-200">
                      <span>Grand Total:</span>
                      <span className="font-mono text-emerald-700 text-lg">GH₵{total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                {/* Audit Cross-Reference */}
                {relatedLog && (
                  <div className="rounded-lg bg-emerald-50 p-3 border border-emerald-200 text-xs text-emerald-800 flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">Ledger Cross-Check Verified:</span>
                      <p className="text-[11px] mt-0.5 text-emerald-700">
                        {relatedLog.details} (Event: {relatedLog.action} at {new Date(relatedLog.createdAt).toLocaleTimeString()})
                      </p>
                    </div>
                  </div>
                )}

                <DialogFooter className="flex items-center justify-between sm:justify-between border-t border-slate-100 pt-3">
                  <Button
                    variant="outline"
                    onClick={() => setInspectedSale(null)}
                    className="text-xs"
                  >
                    Close Audit
                  </Button>
                  <Button
                    onClick={() => {
                      // Generate and print receipt if requested
                      const receiptContent = `
                        <div style="font-family: monospace; padding: 10px; width: 280px; text-align: center;">
                          <h3>SOFIYEM LEGACY LIMITED</h3>
                          <p>Cold Store Division</p>
                          <hr/>
                          <p>Invoice: ${saleNum}</p>
                          <p>Cashier: ${cashier}</p>
                          <p>Date: ${new Date(inspectedSale.date).toLocaleString()}</p>
                          <hr/>
                          ${items.map((i: any) => `<div style="display:flex; justify-content:space-between;"><span>${i.quantity}x ${i.name || 'Item'}</span><span>₵${(Number(i.price || 0) * Number(i.quantity || 1)).toFixed(2)}</span></div>`).join('')}
                          <hr/>
                          <h4>TOTAL: GH₵${total.toFixed(2)}</h4>
                          <p>Payment: ${breakdown.displayLabel}</p>
                          <p>Thank you for your business!</p>
                        </div>
                      `
                      apiClient.printReceipt(receiptContent)
                    }}
                    className="gap-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Receipt Copy
                  </Button>
                </DialogFooter>
              </div>
            )
          })()}
        </DialogContent>
      </Dialog>
    </div>
  )
}
