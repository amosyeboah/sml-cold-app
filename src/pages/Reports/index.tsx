import { useMemo, useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  startOfMonth,
  startOfWeek,
  startOfYear,
} from 'date-fns'
import {
  Filter,
  Download,
  ShoppingCart,
  DollarSign,
  Zap,
  Activity,
  ChevronRight,
  AlertCircle,
  Calendar,
  BarChart3,
  ShoppingBag,
  Package,
  TrendingUp,
  Receipt,
  Clock,
  CreditCard,
  Users,
  Loader2,
  Banknote,
  Smartphone,
  Search,
  CheckCircle2,
  AlertTriangle,
  Eye,
  ArrowUpDown,
  Layers,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/utils'
import { reportsService } from '@/services/reports'
import type { ReportsData, InventoryReportItem } from '@/types'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts'

const reportTypes = [
  { id: 'sales', label: 'Sales Report', icon: BarChart3 },
  { id: 'purchase', label: 'Purchase Report', icon: ShoppingBag },
  { id: 'inventory', label: 'Inventory Report', icon: Package },
  { id: 'profit', label: 'Profit & Loss', icon: TrendingUp },
  { id: 'tax', label: 'Tax Report', icon: Receipt },
  { id: 'expiry', label: 'Expiry Report', icon: Clock },
  { id: 'top-selling', label: 'Top Selling', icon: Package },
  { id: 'payment', label: 'Payment Report', icon: CreditCard },
  { id: 'customer', label: 'Customer Report', icon: Users },
]

const shortcuts = ['Today', 'This Week', 'This Month', 'This Year', 'Custom Range']

const MED_COLORS = [
  'from-blue-400 to-blue-600',
  'from-emerald-400 to-emerald-600',
  'from-purple-400 to-purple-600',
  'from-orange-400 to-orange-600',
  'from-cyan-400 to-cyan-600',
]

function getShortcutRange(shortcut: string): { start: string; end: string } {
  const today = new Date()
  switch (shortcut) {
    case 'Today':
      return { start: format(today, 'yyyy-MM-dd'), end: format(today, 'yyyy-MM-dd') }
    case 'This Week':
      return {
        start: format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
        end: format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd'),
      }
    case 'This Month':
      return {
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      }
    case 'This Year':
      return {
        start: format(startOfYear(today), 'yyyy-MM-dd'),
        end: format(endOfYear(today), 'yyyy-MM-dd'),
      }
    default:
      return {
        start: format(startOfMonth(today), 'yyyy-MM-dd'),
        end: format(endOfMonth(today), 'yyyy-MM-dd'),
      }
  }
}

function formatCurrency(value: number) {
  return `₵${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatTrend(value: number) {
  const sign = value >= 0 ? '↑' : '↓'
  return `${sign} ${Math.abs(value).toFixed(1)}%`
}

function formatDateRangeLabel(start: string, end: string) {
  const startDate = new Date(start)
  const endDate = new Date(end)
  return `${format(startDate, 'dd MMM yyyy')} - ${format(endDate, 'dd MMM yyyy')}`
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  if (chartData.length === 0) {
    return <div className="h-9" />
  }
  return (
    <ResponsiveContainer width="100%" height={36}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  )
}

function SalesOverviewTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (active && payload?.length) {
    return (
      <div className="rounded-lg bg-slate-800 px-3 py-2 text-xs text-white shadow-xl">
        <p className="text-slate-300">{label}</p>
        <p className="font-bold">{formatCurrency(payload[0].value)}</p>
      </div>
    )
  }
  return null
}

function getPaymentMethodColor(method: string) {
  const m = (method || '').toLowerCase()
  if (m.includes('split')) {
    return 'bg-purple-50 text-purple-700 border border-purple-200'
  }
  if (m.includes('mobile') || m.includes('momo')) {
    return 'bg-amber-50 text-amber-700 border border-amber-200'
  }
  return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
}

function buildKpiCards(data?: ReportsData | null, activeReport = 'sales') {
  const kpis = data?.kpis
  if (!kpis) return []

  if (activeReport === 'inventory') {
    const inv = data?.inventoryReport
    const totalCartons = inv?.totalCartons ?? kpis.inventoryCartons ?? 0
    const invCost = inv?.totalCostValue ?? kpis.inventoryCost ?? 0
    const invRetail = inv?.totalRetailValue ?? kpis.expectedInventoryRevenue ?? 0
    const invExpectedProfit = inv?.totalPotentialProfit ?? kpis.profitsExpected ?? Math.max(0, invRetail - invCost)
    const marginPct = invRetail > 0 ? (invExpectedProfit / invRetail) * 100 : 0
    const healthyCount = inv?.healthyCount ?? kpis.inventoryHealthyCount ?? 0
    const lowStockCount = inv?.lowStockCount ?? kpis.inventoryLowStockCount ?? 0
    const outOfStockCount = inv?.outOfStockCount ?? kpis.inventoryOutOfStockCount ?? 0

    return [
      {
        title: 'Total Stock Cartons',
        value: totalCartons.toLocaleString(),
        trend: `${inv?.totalProducts ?? kpis.inventoryItemsCount ?? 0} active cold store products`,
        icon: Package,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        sparkColor: '#3b82f6',
        sparkData: [],
      },
      {
        title: 'Stock Valuation (Cost)',
        value: formatCurrency(invCost),
        trend: 'Capital tied in stock',
        icon: ShoppingBag,
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600',
        sparkColor: '#0284c7',
        sparkData: [],
      },
      {
        title: 'Stock Valuation (Retail)',
        value: formatCurrency(invRetail),
        trend: 'Anticipated revenue',
        icon: DollarSign,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        sparkColor: '#10b981',
        sparkData: [],
      },
      {
        title: 'Profits Expected',
        value: formatCurrency(invExpectedProfit),
        trend: `${marginPct.toFixed(1)}% unrealized margin`,
        icon: TrendingUp,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        sparkColor: '#f59e0b',
        sparkData: [],
      },
      {
        title: 'Healthy Stock Items',
        value: healthyCount.toLocaleString(),
        trend: 'Above reorder minimum',
        icon: CheckCircle2,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        sparkColor: '#22c55e',
        sparkData: [],
      },
      {
        title: 'Low Stock Reorder Alerts',
        value: lowStockCount.toLocaleString(),
        trend: lowStockCount > 0 ? 'Urgent replenishment needed' : 'All stocks adequate',
        icon: AlertTriangle,
        iconBg: lowStockCount > 0 ? 'bg-amber-100' : 'bg-slate-100',
        iconColor: lowStockCount > 0 ? 'text-amber-600' : 'text-slate-500',
        sparkColor: '#f59e0b',
        sparkData: [],
      },
      {
        title: 'Out of Stock Items',
        value: outOfStockCount.toLocaleString(),
        trend: outOfStockCount > 0 ? 'Zero cartons available' : 'None out of stock',
        icon: AlertCircle,
        iconBg: outOfStockCount > 0 ? 'bg-rose-100' : 'bg-slate-100',
        iconColor: outOfStockCount > 0 ? 'text-rose-600' : 'text-slate-500',
        sparkColor: '#f43f5e',
        sparkData: [],
      },
    ]
  }

  if (activeReport === 'profit') {
    const profitEarnedVal = kpis.profitEarned ?? kpis.grossProfit ?? 0
    const profitMarginVal = kpis.profitMargin ?? (kpis.totalSales > 0 ? (profitEarnedVal / kpis.totalSales) * 100 : 0)

    return [
      {
        title: 'Total Sales (Revenue)',
        value: formatCurrency(kpis.totalSales ?? 0),
        trend: formatTrend(kpis.salesTrend ?? 0),
        icon: ShoppingCart,
        iconBg: 'bg-blue-100',
        iconColor: 'text-blue-600',
        sparkColor: '#3b82f6',
        sparkData: kpis.salesSparkline ?? [],
      },
      {
        title: 'Cost of Goods Sold (COGS)',
        value: formatCurrency(kpis.cogs ?? 0),
        trend: kpis.cogsTrend !== undefined ? formatTrend(kpis.cogsTrend) : 'Cost of sold inventory',
        icon: ShoppingBag,
        iconBg: 'bg-rose-100',
        iconColor: 'text-rose-600',
        sparkColor: '#f43f5e',
        sparkData: kpis.cogsSparkline ?? [],
      },
      {
        title: 'Profit Earned (Realized)',
        value: formatCurrency(profitEarnedVal),
        trend: `${profitMarginVal.toFixed(1)}% gross margin`,
        icon: DollarSign,
        iconBg: 'bg-emerald-100',
        iconColor: 'text-emerald-600',
        sparkColor: '#10b981',
        sparkData: kpis.profitSparkline ?? [],
      },
      {
        title: 'Profit Margin',
        value: `${profitMarginVal.toFixed(1)}%`,
        trend: 'Sales minus COGS margin',
        icon: Activity,
        iconBg: 'bg-purple-100',
        iconColor: 'text-purple-600',
        sparkColor: '#a855f7',
        sparkData: [],
      },
      {
        title: 'Cold Store Stock Cost',
        value: formatCurrency(kpis.inventoryCost ?? 0),
        trend: 'Current stock holding cost',
        icon: Package,
        iconBg: 'bg-sky-100',
        iconColor: 'text-sky-600',
        sparkColor: '#0284c7',
        sparkData: [],
      },
      {
        title: 'Profits Expected',
        value: formatCurrency(kpis.profitsExpected ?? 0),
        trend: 'Unrealized on stock',
        icon: TrendingUp,
        iconBg: 'bg-amber-100',
        iconColor: 'text-amber-600',
        sparkColor: '#f59e0b',
        sparkData: [],
      },
      {
        title: 'Total Purchases',
        value: formatCurrency(kpis.totalPurchases ?? 0),
        trend: formatTrend(kpis.purchasesTrend ?? 0),
        icon: Receipt,
        iconBg: 'bg-teal-100',
        iconColor: 'text-teal-600',
        sparkColor: '#14b8a6',
        sparkData: kpis.purchasesSparkline ?? [],
      },
    ]
  }

  const cashSalesVal = kpis.cashSales ?? (data?.paymentBreakdown?.find(p => p.name.toLowerCase().includes('cash'))?.value ?? 0)
  const mobileSalesVal = kpis.mobileSales ?? (data?.paymentBreakdown?.find(p => p.name.toLowerCase().includes('mobile'))?.value ?? 0)

  return [
    {
      title: 'Total Sales',
      value: formatCurrency(kpis.totalSales ?? 0),
      trend: formatTrend(kpis.salesTrend ?? 0),
      icon: ShoppingCart,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      sparkColor: '#3b82f6',
      sparkData: kpis.salesSparkline ?? [],
    },
    {
      title: 'Cash Sales',
      value: formatCurrency(cashSalesVal),
      trend: `${kpis.totalSales > 0 ? ((cashSalesVal / kpis.totalSales) * 100).toFixed(1) : '0'}% of sales`,
      icon: Banknote,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
      sparkColor: '#22c55e',
      sparkData: [],
    },
    {
      title: 'Mobile Money',
      value: formatCurrency(mobileSalesVal),
      trend: `${kpis.totalSales > 0 ? ((mobileSalesVal / kpis.totalSales) * 100).toFixed(1) : '0'}% of sales`,
      icon: Smartphone,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      sparkColor: '#f59e0b',
      sparkData: [],
    },
    {
      title: 'Total Purchases',
      value: formatCurrency(kpis.totalPurchases ?? 0),
      trend: formatTrend(kpis.purchasesTrend ?? 0),
      icon: ShoppingBag,
      iconBg: 'bg-teal-100',
      iconColor: 'text-teal-600',
      sparkColor: '#14b8a6',
      sparkData: kpis.purchasesSparkline ?? [],
    },
    {
      title: 'Gross Profit',
      value: formatCurrency(kpis.profitEarned ?? kpis.grossProfit ?? 0),
      trend: formatTrend(kpis.profitTrend ?? 0),
      icon: DollarSign,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      sparkColor: '#f59e0b',
      sparkData: kpis.profitSparkline ?? [],
    },
    {
      title: 'Transactions',
      value: String(kpis.transactions ?? 0),
      trend: formatTrend(kpis.transactionsTrend ?? 0),
      icon: Zap,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      sparkColor: '#a855f7',
      sparkData: kpis.transactionsSparkline ?? [],
    },
    {
      title: 'Avg. Daily Sales',
      value: formatCurrency(kpis.avgDailySales ?? 0),
      trend: formatTrend(kpis.avgDailyTrend ?? 0),
      icon: Activity,
      iconBg: 'bg-cyan-100',
      iconColor: 'text-cyan-600',
      sparkColor: '#06b6d4',
      sparkData: kpis.avgDailySparkline ?? [],
    },
  ]
}

function getChartConfig(activeReport: string) {
  switch (activeReport) {
    case 'purchase':
      return { key: 'purchases' as const, label: 'Purchases Overview', color: '#22c55e', gradientId: 'reportsPurchasesGradient' }
    case 'profit':
      return { key: 'profit' as const, label: 'Profit Earned Overview (Daily)', color: '#10b981', gradientId: 'reportsProfitGradient' }
    case 'tax':
      return { key: 'profit' as const, label: 'Profit Overview', color: '#f59e0b', gradientId: 'reportsProfitGradient' }
    default:
      return { key: 'sales' as const, label: 'Sales Overview', color: '#6366f1', gradientId: 'reportsSalesGradient' }
  }
}

function shouldShowSection(activeReport: string, section: string) {
  if (activeReport === 'sales') return true
  const map: Record<string, string[]> = {
    purchase: ['kpis', 'chart', 'purchases', 'payment'],
    inventory: ['kpis', 'inventoryOverview', 'inventoryTable', 'expiry'],
    profit: ['kpis', 'profitStatement', 'chart', 'profitBreakdown'],
    tax: ['kpis', 'chart'],
    expiry: ['expiry'],
    'top-selling': ['topMedicines'],
    payment: ['kpis', 'payment'],
    customer: ['transactions'],
  }
  return map[activeReport]?.includes(section) ?? true
}

export default function Reports() {
  const defaultRange = getShortcutRange('This Month')
  const [activeReport, setActiveReport] = useState('sales')
  const [activeShortcut, setActiveShortcut] = useState('This Month')
  const [startDate, setStartDate] = useState(defaultRange.start)
  const [endDate, setEndDate] = useState(defaultRange.end)
  const [customOpen, setCustomOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(startDate)
  const [draftEnd, setDraftEnd] = useState(endDate)
  const [profitSearch, setProfitSearch] = useState('')
  const [inventorySearch, setInventorySearch] = useState('')
  const [inventoryCategory, setInventoryCategory] = useState('ALL')
  const [inventoryStatusFilter, setInventoryStatusFilter] = useState<'ALL' | 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL')
  const [inventorySortBy, setInventorySortBy] = useState<'cost_desc' | 'retail_desc' | 'stock_desc' | 'profit_desc' | 'name_asc' | 'urgent_low'>('cost_desc')
  const [selectedItemForBatches, setSelectedItemForBatches] = useState<InventoryReportItem | null>(null)
  const [batchModalOpen, setBatchModalOpen] = useState(false)

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['reports', startDate, endDate],
    queryFn: () => reportsService.getData(startDate, endDate),
  })

  const exportMutation = useMutation({
    mutationFn: () => reportsService.exportExcel(startDate, endDate),
    onSuccess: (result) => {
      if (!result?.success) return
      alert(`Report exported to ${result.path || 'Downloads'}`)
    },
    onError: () => alert('Failed to export report.'),
  })

  const kpiCards = useMemo(() => buildKpiCards(data, activeReport), [data, activeReport])
  const filteredProfitBreakdown = useMemo(() => {
    const list = data?.profitBreakdown || []
    if (!profitSearch.trim()) return list
    const q = profitSearch.toLowerCase()
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    )
  }, [data?.profitBreakdown, profitSearch])

  const inventoryData = useMemo(() => {
    if (data?.inventoryReport) {
      return data.inventoryReport
    }
    const items = (data?.profitBreakdown || []).map((p) => {
      const costVal = p.stockCost || 0
      const expProfit = p.expectedProfit || 0
      const retailVal = costVal + expProfit
      const status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' =
        p.currentStock === 0 ? 'OUT_OF_STOCK' : p.currentStock <= 10 ? 'LOW_STOCK' : 'IN_STOCK'
      return {
        id: p.id,
        name: p.name,
        sku: 'N/A',
        category: p.category || 'General',
        currentStock: p.currentStock,
        minStockLevel: 10,
        unitCost: p.currentStock > 0 ? costVal / p.currentStock : 0,
        unitPrice: p.currentStock > 0 ? retailVal / p.currentStock : 0,
        totalCostValue: costVal,
        totalRetailValue: retailVal,
        potentialProfit: expProfit,
        marginPercent: retailVal > 0 ? (expProfit / retailVal) * 100 : 0,
        status,
        batchCount: 0,
        batches: [],
      }
    })
    return {
      totalProducts: items.length,
      totalCartons: items.reduce((s, i) => s + i.currentStock, 0),
      totalCostValue: items.reduce((s, i) => s + i.totalCostValue, 0),
      totalRetailValue: items.reduce((s, i) => s + i.totalRetailValue, 0),
      totalPotentialProfit: items.reduce((s, i) => s + i.potentialProfit, 0),
      potentialMarginPercent: 0,
      healthyCount: items.filter((i) => i.status === 'IN_STOCK').length,
      lowStockCount: items.filter((i) => i.status === 'LOW_STOCK').length,
      outOfStockCount: items.filter((i) => i.status === 'OUT_OF_STOCK').length,
      expiringBatchesCount: (data?.expiringBatches || []).length,
      expiredBatchesCount: 0,
      categories: [],
      items,
    }
  }, [data])

  const availableCategories = useMemo(() => {
    const cats = new Set<string>()
    inventoryData.items.forEach((item) => {
      if (item.category) cats.add(item.category)
    })
    return Array.from(cats).sort()
  }, [inventoryData.items])

  const filteredInventoryItems = useMemo(() => {
    let list = [...inventoryData.items]

    if (inventoryCategory !== 'ALL') {
      list = list.filter((i) => i.category === inventoryCategory)
    }

    if (inventoryStatusFilter !== 'ALL') {
      list = list.filter((i) => i.status === inventoryStatusFilter)
    }

    if (inventorySearch.trim()) {
      const q = inventorySearch.toLowerCase()
      list = list.filter(
        (i) =>
          i.name.toLowerCase().includes(q) ||
          i.sku.toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q)
      )
    }

    list.sort((a, b) => {
      switch (inventorySortBy) {
        case 'stock_desc':
          return b.currentStock - a.currentStock
        case 'cost_desc':
          return b.totalCostValue - a.totalCostValue
        case 'retail_desc':
          return b.totalRetailValue - a.totalRetailValue
        case 'profit_desc':
          return b.potentialProfit - a.potentialProfit
        case 'urgent_low':
          return a.currentStock - b.currentStock
        case 'name_asc':
        default:
          return a.name.localeCompare(b.name)
      }
    })

    return list
  }, [inventoryData.items, inventoryCategory, inventoryStatusFilter, inventorySearch, inventorySortBy])

  const chartConfig = getChartConfig(activeReport)
  const dateRangeLabel = formatDateRangeLabel(startDate, endDate)
  const totalPayment = (data?.paymentBreakdown ?? []).reduce((sum, item) => sum + item.value, 0)

  const applyShortcut = (shortcut: string) => {
    if (shortcut === 'Custom Range') {
      setDraftStart(startDate)
      setDraftEnd(endDate)
      setCustomOpen(true)
      return
    }
    const range = getShortcutRange(shortcut)
    setActiveShortcut(shortcut)
    setStartDate(range.start)
    setEndDate(range.end)
  }

  const applyCustomRange = () => {
    if (!draftStart || !draftEnd || draftStart > draftEnd) return
    setStartDate(draftStart)
    setEndDate(draftEnd)
    setActiveShortcut('Custom Range')
    setCustomOpen(false)
  }

  return (
    <div className="flex h-full overflow-hidden bg-[#f4f6fb]">
      <aside className="flex w-[220px] flex-shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex-1 overflow-y-auto px-4 py-5">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Reports</p>
          <nav className="space-y-0.5">
            {reportTypes.map((item) => {
              const Icon = item.icon
              const isActive = activeReport === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveReport(item.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                    isActive ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-800'
                  )}
                >
                  <Icon className={cn('h-4 w-4 flex-shrink-0', isActive ? 'text-indigo-600' : 'text-slate-400')} />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          <p className="mb-3 mt-6 text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-400">Shortcuts</p>
          <div className="space-y-1">
            {shortcuts.map((shortcut) => (
              <button
                key={shortcut}
                onClick={() => applyShortcut(shortcut)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors',
                  activeShortcut === shortcut
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                )}
              >
                <Calendar className="h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
                {shortcut}
              </button>
            ))}
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <div className="space-y-5 p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Reports</h1>
              <p className="mt-0.5 text-sm text-slate-500">
                Dashboard <span className="text-slate-400">&gt;</span> Reports
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                <Calendar className="h-4 w-4 text-slate-400" />
                {dateRangeLabel}
                {isFetching && <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-500" />}
              </div>
              <Button variant="outline" className="gap-2 border-slate-200 bg-white text-slate-700" onClick={() => refetch()}>
                <Filter className="h-4 w-4" />
                Refresh
              </Button>
              <Button
                className="gap-2 text-white"
                style={{ background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)' }}
                onClick={() => exportMutation.mutate()}
                disabled={exportMutation.isPending || !data}
              >
                {exportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Export Report
              </Button>
            </div>
          </div>

          {isLoading ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
            </div>
          ) : !data ? (
            <div className="flex h-64 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500">
              Unable to load report data.
            </div>
          ) : (
            <>
              {shouldShowSection(activeReport, 'kpis') && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                  {kpiCards.map((card) => {
                    const Icon = card.icon
                    return (
                      <div key={card.title} className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm flex flex-col justify-between">
                        <div>
                          <div className="mb-2 flex items-start justify-between">
                            <p className="text-[11px] font-medium text-slate-500">{card.title}</p>
                            <div className={cn('flex h-8 w-8 items-center justify-center rounded-lg', card.iconBg)}>
                              <Icon className={cn('h-4 w-4', card.iconColor)} />
                            </div>
                          </div>
                          <p className="text-lg font-bold text-slate-900 truncate">{card.value}</p>
                        </div>
                        <div className="mt-2">
                          <p className="text-[10px] font-semibold text-slate-500">{card.trend}</p>
                          {card.sparkData && card.sparkData.length > 0 ? (
                            <Sparkline data={card.sparkData} color={card.sparkColor} />
                          ) : (
                            <div className="h-2" />
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {shouldShowSection(activeReport, 'profitStatement') && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Profit &amp; Loss Financial Statement</h3>
                      <p className="text-xs text-slate-500">
                        Executive statement of Sales Revenue, Cost of Goods Sold (COGS), Gross Profit Earned, and Cold Store Expected Realization
                      </p>
                    </div>
                    <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                      {(data.kpis?.profitMargin ?? 0).toFixed(1)}% Realized Margin
                    </span>
                  </div>

                  {/* Financial Equation Tiles */}
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    {/* Gross Revenue */}
                    <div className="rounded-xl border border-blue-100 bg-gradient-to-br from-blue-50/60 to-indigo-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Gross Sales Revenue</p>
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                      </div>
                      <p className="mt-2 text-2xl font-black text-slate-900">
                        {formatCurrency(data.kpis?.totalSales ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Total invoice revenue billed in period</p>
                    </div>

                    {/* Less COGS */}
                    <div className="rounded-xl border border-rose-100 bg-gradient-to-br from-rose-50/60 to-pink-50/40 p-4">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Less: Cost of Goods Sold (COGS)</p>
                        <ShoppingBag className="h-4 w-4 text-rose-600" />
                      </div>
                      <p className="mt-2 text-2xl font-black text-rose-600">
                        - {formatCurrency(data.kpis?.cogs ?? 0)}
                      </p>
                      <p className="mt-1 text-[11px] text-slate-500">Direct purchase cost of inventory sold</p>
                    </div>

                    {/* Net Profit Earned */}
                    <div className="rounded-xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-teal-50/50 p-4 shadow-xs">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">Gross Profit Earned</p>
                        <DollarSign className="h-4 w-4 text-emerald-600" />
                      </div>
                      <p className="mt-2 text-2xl font-black text-emerald-700">
                        {formatCurrency(data.kpis?.profitEarned ?? data.kpis?.grossProfit ?? 0)}
                      </p>
                      <div className="mt-1 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">Realized gross profit</span>
                        <span className="font-bold text-emerald-700">{(data.kpis?.profitMargin ?? 0).toFixed(1)}% margin</span>
                      </div>
                    </div>
                  </div>

                  {/* Cold Store Stock Valuation & Unrealized Profits Expected */}
                  <div className="mt-4 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50/70 via-orange-50/30 to-amber-50/50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500 text-white shadow-xs flex-shrink-0">
                          <TrendingUp className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-bold text-slate-900">Cold Store Inventory &amp; Profits Expected</h4>
                            <span className="rounded-full bg-amber-200/80 px-2 py-0.5 text-[10px] font-bold text-amber-900 uppercase tracking-wide">
                              Unrealized Stock Value
                            </span>
                          </div>
                          <p className="text-xs text-slate-600">
                            Potential gross profit to be realized when current cold store stock is sold at standard retail pricing.
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock Valuation (Cost)</p>
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(data.kpis?.inventoryCost ?? 0)}</p>
                        </div>
                        <div className="h-8 w-px bg-amber-200/80 hidden sm:block" />
                        <div>
                          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Stock Valuation (Retail)</p>
                          <p className="text-sm font-bold text-slate-800">{formatCurrency(data.kpis?.expectedInventoryRevenue ?? 0)}</p>
                        </div>
                        <div className="h-8 w-px bg-amber-200/80 hidden sm:block" />
                        <div className="rounded-lg bg-white px-3.5 py-2 border border-amber-300/80 shadow-xs">
                          <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Profits Expected</p>
                          <p className="text-lg font-black text-amber-600">{formatCurrency(data.kpis?.profitsExpected ?? 0)}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {shouldShowSection(activeReport, 'inventoryOverview') && (
                <div className="space-y-4">
                  {/* Executive Stock Health & Capital Valuation Banner */}
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 pb-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-base font-bold text-slate-900">Cold Store Inventory &amp; Stock Analytics</h3>
                          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-[11px] font-bold text-indigo-700 border border-indigo-200">
                            Live Stock Valuation
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs text-slate-500">
                          Real-time audit of cold store stock levels, batch expiries, reorder alerts, and capital valuation.
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <div className="rounded-lg bg-emerald-50 px-3 py-1.5 border border-emerald-200 text-xs">
                          <span className="text-emerald-700 font-medium">Healthy: </span>
                          <strong className="text-emerald-900 font-bold">{inventoryData.healthyCount}</strong>
                        </div>
                        <div className="rounded-lg bg-amber-50 px-3 py-1.5 border border-amber-200 text-xs">
                          <span className="text-amber-700 font-medium">Low Stock: </span>
                          <strong className="text-amber-900 font-bold">{inventoryData.lowStockCount}</strong>
                        </div>
                        <div className="rounded-lg bg-rose-50 px-3 py-1.5 border border-rose-200 text-xs">
                          <span className="text-rose-700 font-medium">Out of Stock: </span>
                          <strong className="text-rose-900 font-bold">{inventoryData.outOfStockCount}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Stock Health Progress Bar */}
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-slate-600 font-medium">Stock Status Distribution</span>
                        <span className="text-slate-500 text-[11px]">
                          {inventoryData.totalProducts} Total Products &bull; {inventoryData.totalCartons.toLocaleString()} Cartons on Hand
                        </span>
                      </div>
                      <div className="h-3 w-full rounded-full bg-slate-100 overflow-hidden flex">
                        <div
                          className="bg-emerald-500 transition-all"
                          style={{
                            width: `${inventoryData.totalProducts > 0 ? (inventoryData.healthyCount / inventoryData.totalProducts) * 100 : 0}%`,
                          }}
                          title={`Healthy Stock: ${inventoryData.healthyCount} products`}
                        />
                        <div
                          className="bg-amber-400 transition-all"
                          style={{
                            width: `${inventoryData.totalProducts > 0 ? (inventoryData.lowStockCount / inventoryData.totalProducts) * 100 : 0}%`,
                          }}
                          title={`Low Stock Alert: ${inventoryData.lowStockCount} products`}
                        />
                        <div
                          className="bg-rose-500 transition-all"
                          style={{
                            width: `${inventoryData.totalProducts > 0 ? (inventoryData.outOfStockCount / inventoryData.totalProducts) * 100 : 0}%`,
                          }}
                          title={`Out of Stock: ${inventoryData.outOfStockCount} products`}
                        />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-emerald-500" />
                          <span>Healthy Stock ({inventoryData.totalProducts > 0 ? ((inventoryData.healthyCount / inventoryData.totalProducts) * 100).toFixed(0) : 0}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-amber-400" />
                          <span>Low Stock Alert ({inventoryData.totalProducts > 0 ? ((inventoryData.lowStockCount / inventoryData.totalProducts) * 100).toFixed(0) : 0}%)</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full bg-rose-500" />
                          <span>Out of Stock ({inventoryData.totalProducts > 0 ? ((inventoryData.outOfStockCount / inventoryData.totalProducts) * 100).toFixed(0) : 0}%)</span>
                        </div>
                      </div>
                    </div>

                    {/* Category Breakdown Grid */}
                    {inventoryData.categories.length > 0 && (
                      <div className="mt-5 pt-4 border-t border-slate-100">
                        <div className="mb-3 flex items-center justify-between">
                          <p className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Cold Store Category Valuation
                          </p>
                          <span className="text-[11px] text-slate-400">Click a category card to filter catalogue</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                          {inventoryData.categories.map((cat) => (
                            <button
                              key={cat.category}
                              onClick={() => setInventoryCategory(inventoryCategory === cat.category ? 'ALL' : cat.category)}
                              className={cn(
                                'rounded-xl border p-3 text-left transition-all',
                                inventoryCategory === cat.category
                                  ? 'border-indigo-400 bg-indigo-50/70 shadow-sm ring-1 ring-indigo-300'
                                  : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100/60'
                              )}
                            >
                              <p className="text-xs font-bold text-slate-900 truncate" title={cat.category}>{cat.category}</p>
                              <div className="mt-1 flex items-baseline justify-between">
                                <span className="text-[11px] text-slate-500">{cat.totalStock.toLocaleString()} ctns</span>
                                <span className="text-[10px] font-semibold text-indigo-600">{cat.percentOfTotalValue.toFixed(0)}%</span>
                              </div>
                              <p className="mt-1 text-xs font-black text-slate-800">{formatCurrency(cat.totalCostValue)}</p>
                              <div className="mt-1.5 h-1 w-full rounded-full bg-slate-200 overflow-hidden">
                                <div
                                  className="h-full bg-indigo-600 rounded-full"
                                  style={{ width: `${Math.min(100, cat.percentOfTotalValue)}%` }}
                                />
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {shouldShowSection(activeReport, 'inventoryTable') && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  {/* Table Control Bar */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Inventory Items Catalogue &amp; Valuation</h3>
                      <p className="text-xs text-slate-500">
                        Detailed itemized breakdown showing cartons in stock, reorder levels, purchase cost valuation, and potential retail profit.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Search */}
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Search product or SKU..."
                          value={inventorySearch}
                          onChange={(e) => setInventorySearch(e.target.value)}
                          className="h-8 w-52 pl-8 text-xs bg-slate-50 border-slate-200"
                        />
                      </div>

                      {/* Category filter */}
                      <select
                        value={inventoryCategory}
                        onChange={(e) => setInventoryCategory(e.target.value)}
                        className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="ALL">All Categories ({availableCategories.length})</option>
                        {availableCategories.map((c) => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>

                      {/* Status filter chips */}
                      <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-xs">
                        <button
                          onClick={() => setInventoryStatusFilter('ALL')}
                          className={cn(
                            'rounded-md px-2 py-1 font-medium transition-colors',
                            inventoryStatusFilter === 'ALL' ? 'bg-white text-indigo-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          All ({inventoryData.totalProducts})
                        </button>
                        <button
                          onClick={() => setInventoryStatusFilter('IN_STOCK')}
                          className={cn(
                            'rounded-md px-2 py-1 font-medium transition-colors',
                            inventoryStatusFilter === 'IN_STOCK' ? 'bg-white text-emerald-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          Healthy ({inventoryData.healthyCount})
                        </button>
                        <button
                          onClick={() => setInventoryStatusFilter('LOW_STOCK')}
                          className={cn(
                            'rounded-md px-2 py-1 font-medium transition-colors',
                            inventoryStatusFilter === 'LOW_STOCK' ? 'bg-white text-amber-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          Low ({inventoryData.lowStockCount})
                        </button>
                        <button
                          onClick={() => setInventoryStatusFilter('OUT_OF_STOCK')}
                          className={cn(
                            'rounded-md px-2 py-1 font-medium transition-colors',
                            inventoryStatusFilter === 'OUT_OF_STOCK' ? 'bg-white text-rose-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                          )}
                        >
                          Out ({inventoryData.outOfStockCount})
                        </button>
                      </div>

                      {/* Sort by */}
                      <select
                        value={inventorySortBy}
                        onChange={(e) => setInventorySortBy(e.target.value as any)}
                        className="h-8 rounded-md border border-slate-200 bg-slate-50 px-2.5 text-xs text-slate-700 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      >
                        <option value="cost_desc">Sort: Highest Cost Valuation</option>
                        <option value="retail_desc">Sort: Highest Retail Valuation</option>
                        <option value="profit_desc">Sort: Highest Expected Profit</option>
                        <option value="stock_desc">Sort: Most Stock Cartons</option>
                        <option value="urgent_low">Sort: Lowest Stock (Urgent)</option>
                        <option value="name_asc">Sort: Product Name (A-Z)</option>
                      </select>
                    </div>
                  </div>

                  {filteredInventoryItems.length === 0 ? (
                    <div className="py-12 text-center text-sm text-slate-400">
                      No inventory products match the selected filters.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="font-semibold text-slate-700">Product &amp; SKU</TableHead>
                            <TableHead className="font-semibold text-slate-700">Category</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">In Stock</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Unit Cost</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Unit Price</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Cost Valuation</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Retail Valuation</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Expected Profit</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Status</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-center">Batches</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredInventoryItems.map((item) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{item.name}</p>
                                  <p className="text-[10px] text-slate-400 font-mono">{item.sku}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-xs text-slate-600 font-medium">
                                {item.category}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-bold">
                                <span
                                  className={cn(
                                    item.status === 'OUT_OF_STOCK'
                                      ? 'text-rose-600'
                                      : item.status === 'LOW_STOCK'
                                      ? 'text-amber-600'
                                      : 'text-slate-900'
                                  )}
                                >
                                  {item.currentStock.toLocaleString()}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs text-slate-700">
                                {formatCurrency(item.unitCost)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs text-slate-900 font-medium">
                                {formatCurrency(item.unitPrice)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-semibold text-slate-900">
                                {formatCurrency(item.totalCostValue)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-semibold text-slate-900">
                                {formatCurrency(item.totalRetailValue)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-bold text-emerald-600">
                                <div>
                                  <span>{formatCurrency(item.potentialProfit)}</span>
                                  <span className="block text-[10px] font-normal text-slate-400">
                                    {item.marginPercent.toFixed(1)}%
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-center">
                                <span
                                  className={cn(
                                    'inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                    item.status === 'IN_STOCK'
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                      : item.status === 'LOW_STOCK'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : 'bg-rose-50 text-rose-700 border border-rose-200'
                                  )}
                                >
                                  {item.status === 'IN_STOCK' ? 'In Stock' : item.status === 'LOW_STOCK' ? 'Low Stock' : 'Out of Stock'}
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-center">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 gap-1 px-2 text-[10px] border-slate-200 hover:bg-indigo-50 hover:text-indigo-700"
                                  onClick={() => {
                                    setSelectedItemForBatches(item)
                                    setBatchModalOpen(true)
                                  }}
                                >
                                  <Eye className="h-3 w-3" />
                                  {item.batchCount} {item.batchCount === 1 ? 'Lot' : 'Lots'}
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900 text-xs">
                          <tr>
                            <td className="px-4 py-3" colSpan={2}>
                              Total ({filteredInventoryItems.length} products)
                            </td>
                            <td className="px-4 py-3 text-right">
                              {filteredInventoryItems.reduce((s, i) => s + i.currentStock, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-400">-</td>
                            <td className="px-4 py-3 text-right text-slate-400">-</td>
                            <td className="px-4 py-3 text-right font-black">
                              {formatCurrency(filteredInventoryItems.reduce((s, i) => s + i.totalCostValue, 0))}
                            </td>
                            <td className="px-4 py-3 text-right font-black">
                              {formatCurrency(filteredInventoryItems.reduce((s, i) => s + i.totalRetailValue, 0))}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600 font-black">
                              {formatCurrency(filteredInventoryItems.reduce((s, i) => s + i.potentialProfit, 0))}
                            </td>
                            <td className="px-4 py-3 text-center" colSpan={2}>
                              {(() => {
                                const ret = filteredInventoryItems.reduce((s, i) => s + i.totalRetailValue, 0)
                                const prof = filteredInventoryItems.reduce((s, i) => s + i.potentialProfit, 0)
                                return ret > 0 ? `${((prof / ret) * 100).toFixed(1)}% margin` : '-'
                              })()}
                            </td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {(shouldShowSection(activeReport, 'chart') || shouldShowSection(activeReport, 'payment')) && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                  {shouldShowSection(activeReport, 'chart') && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">{chartConfig.label}</h3>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                          Daily
                        </span>
                      </div>
                      <div className="h-[260px]">
                        {(data.salesOverview ?? []).length === 0 ? (
                          <div className="flex h-full items-center justify-center text-sm text-slate-400">
                            No data for the selected period.
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.salesOverview || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                              <defs>
                                <linearGradient id={chartConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={chartConfig.color} stopOpacity={0.25} />
                                  <stop offset="95%" stopColor={chartConfig.color} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                              <YAxis
                                tick={{ fontSize: 11, fill: '#94a3b8' }}
                                tickLine={false}
                                axisLine={false}
                                tickFormatter={(v) => `₵${v}`}
                              />
                              <Tooltip content={<SalesOverviewTooltip />} />
                              <Area
                                type="monotone"
                                dataKey={chartConfig.key}
                                stroke={chartConfig.color}
                                strokeWidth={2.5}
                                fill={`url(#${chartConfig.gradientId})`}
                                dot={{ r: 4, fill: chartConfig.color, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 6, fill: chartConfig.color, stroke: '#fff', strokeWidth: 2 }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                      {activeReport === 'tax' && (
                        <p className="mt-3 text-sm text-slate-500">
                          Estimated tax (15%): <span className="font-semibold text-slate-800">{formatCurrency((data.kpis?.grossProfit ?? 0) * 0.15)}</span>
                        </p>
                      )}
                    </div>
                  )}

                  {shouldShowSection(activeReport, 'payment') && (
                    <div className={cn('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', !shouldShowSection(activeReport, 'chart') && 'lg:col-span-3')}>
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Sales by Payment Method</h3>
                        <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-600">
                          Selected Period
                        </span>
                      </div>
                      {(data.paymentBreakdown ?? []).length === 0 ? (
                        <div className="flex h-40 items-center justify-center text-sm text-slate-400">
                          No payment data for this period.
                        </div>
                      ) : (
                        <div className="space-y-3.5">
                          {/* Dedicated Cash and Mobile summary tiles */}
                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-2.5 flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-emerald-600 text-white flex-shrink-0">
                                <Banknote className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Cash Total</p>
                                <p className="text-xs font-black text-emerald-950 truncate">
                                  {formatCurrency(data.paymentBreakdown?.find(p => p.name.toLowerCase().includes('cash'))?.value ?? data.kpis?.cashSales ?? 0)}
                                </p>
                              </div>
                            </div>
                            <div className="rounded-lg border border-amber-200 bg-amber-50/70 p-2.5 flex items-center gap-2">
                              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-500 text-white flex-shrink-0">
                                <Smartphone className="h-3.5 w-3.5" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wider">Mobile Total</p>
                                <p className="text-xs font-black text-amber-950 truncate">
                                  {formatCurrency(data.paymentBreakdown?.find(p => p.name.toLowerCase().includes('mobile'))?.value ?? data.kpis?.mobileSales ?? 0)}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-4">
                            <div className="relative flex-shrink-0" style={{ width: 120, height: 120 }}>
                              <PieChart width={120} height={120}>
                                <Pie
                                  data={data.paymentBreakdown || []}
                                  cx={55}
                                  cy={55}
                                  innerRadius={36}
                                  outerRadius={54}
                                  dataKey="value"
                                  strokeWidth={2}
                                  stroke="#fff"
                                >
                                  {(data.paymentBreakdown || []).map((entry) => (
                                    <Cell key={entry.name} fill={entry.color} />
                                  ))}
                                </Pie>
                              </PieChart>
                              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                                <p className="text-[9px] font-medium text-slate-400">Total</p>
                                <p className="text-xs font-bold text-slate-900">{formatCurrency(totalPayment)}</p>
                              </div>
                            </div>
                            <div className="min-w-0 flex-1 space-y-2">
                              {(data.paymentBreakdown || []).map((item) => (
                                <div key={item.name} className="flex items-center justify-between gap-2 text-xs">
                                  <div className="flex min-w-0 items-center gap-1.5">
                                    <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: item.color }} />
                                    <span className="truncate text-slate-600 font-medium">{item.name}</span>
                                  </div>
                                  <span className="flex-shrink-0 font-bold text-slate-800">
                                    {formatCurrency(item.value)} <span className="text-[10px] font-normal text-slate-400">({(item.percent ?? 0).toFixed(1)}%)</span>
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {shouldShowSection(activeReport, 'profitBreakdown') && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Product Profit &amp; Loss Breakdown</h3>
                      <p className="text-xs text-slate-500">
                        Itemized performance: Revenue, Cost of Goods Sold (COGS), Realized Profit, and Profits Expected on stock
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                        <Input
                          placeholder="Filter products..."
                          value={profitSearch}
                          onChange={(e) => setProfitSearch(e.target.value)}
                          className="h-8 w-52 pl-8 text-xs bg-slate-50 border-slate-200"
                        />
                      </div>
                    </div>
                  </div>

                  {filteredProfitBreakdown.length === 0 ? (
                    <p className="py-8 text-center text-sm text-slate-400">No product records found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-b border-slate-200 bg-slate-50/80 hover:bg-slate-50/80">
                            <TableHead className="font-semibold text-slate-700">Product</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Units Sold</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Revenue</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">COGS</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Profit Earned</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Margin</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">In Stock</TableHead>
                            <TableHead className="font-semibold text-slate-700 text-right">Profits Expected</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProfitBreakdown.map((item) => (
                            <TableRow key={item.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                              <TableCell className="py-2.5">
                                <div>
                                  <p className="text-xs font-bold text-slate-900">{item.name}</p>
                                  <p className="text-[10px] text-slate-400">{item.category}</p>
                                </div>
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-medium text-slate-700">
                                {item.quantitySold.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-semibold text-slate-900">
                                {formatCurrency(item.revenue)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-medium text-rose-600">
                                {formatCurrency(item.cogs)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-bold text-emerald-600">
                                {formatCurrency(item.profitEarned)}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs">
                                <span
                                  className={cn(
                                    'inline-block rounded px-1.5 py-0.5 text-[10px] font-bold',
                                    item.marginPercent >= 20
                                      ? 'bg-emerald-50 text-emerald-700'
                                      : item.marginPercent > 0
                                      ? 'bg-amber-50 text-amber-700'
                                      : 'bg-rose-50 text-rose-700'
                                  )}
                                >
                                  {item.marginPercent.toFixed(1)}%
                                </span>
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-medium text-slate-700">
                                {item.currentStock.toLocaleString()}
                              </TableCell>
                              <TableCell className="py-2.5 text-right text-xs font-bold text-amber-600">
                                {formatCurrency(item.expectedProfit)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                        <tfoot className="border-t-2 border-slate-200 bg-slate-50/80 font-bold text-slate-900 text-xs">
                          <tr>
                            <td className="px-4 py-3">Total ({filteredProfitBreakdown.length} items)</td>
                            <td className="px-4 py-3 text-right">
                              {filteredProfitBreakdown.reduce((s, i) => s + i.quantitySold, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {formatCurrency(filteredProfitBreakdown.reduce((s, i) => s + i.revenue, 0))}
                            </td>
                            <td className="px-4 py-3 text-right text-rose-600">
                              {formatCurrency(filteredProfitBreakdown.reduce((s, i) => s + i.cogs, 0))}
                            </td>
                            <td className="px-4 py-3 text-right text-emerald-600">
                              {formatCurrency(filteredProfitBreakdown.reduce((s, i) => s + i.profitEarned, 0))}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {(() => {
                                const rev = filteredProfitBreakdown.reduce((s, i) => s + i.revenue, 0)
                                const prof = filteredProfitBreakdown.reduce((s, i) => s + i.profitEarned, 0)
                                return rev > 0 ? `${((prof / rev) * 100).toFixed(1)}%` : '-'
                              })()}
                            </td>
                            <td className="px-4 py-3 text-right">
                              {filteredProfitBreakdown.reduce((s, i) => s + i.currentStock, 0).toLocaleString()}
                            </td>
                            <td className="px-4 py-3 text-right text-amber-600">
                              {formatCurrency(filteredProfitBreakdown.reduce((s, i) => s + i.expectedProfit, 0))}
                            </td>
                          </tr>
                        </tfoot>
                      </Table>
                    </div>
                  )}
                </div>
              )}

              {shouldShowSection(activeReport, 'purchases') && (data.purchases ?? []).length > 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="mb-4 text-base font-bold text-slate-900">Purchase Orders</h3>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Date</TableHead>
                          <TableHead>Supplier</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(data.purchases || []).map((purchase) => (
                          <TableRow key={purchase.id}>
                            <TableCell>{format(new Date(purchase.date), 'dd MMM yyyy HH:mm')}</TableCell>
                            <TableCell className="font-medium">{purchase.supplier}</TableCell>
                            <TableCell className="font-semibold">{formatCurrency(purchase.total)}</TableCell>
                            <TableCell>{purchase.status}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              {(shouldShowSection(activeReport, 'topMedicines') ||
                shouldShowSection(activeReport, 'transactions') ||
                shouldShowSection(activeReport, 'expiry')) && (
                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                  {shouldShowSection(activeReport, 'topMedicines') && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Top Selling Products</h3>
                        <button className="flex items-center gap-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                          View all <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {(data.topMedicines ?? []).length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">No sales in this period.</p>
                      ) : (
                        <div className="space-y-3">
                          {(data.topMedicines || []).map((med, idx) => (
                            <div key={med.name} className="flex items-center gap-3">
                              <span className="w-4 flex-shrink-0 text-center text-xs font-bold text-slate-400">{idx + 1}</span>
                              <div
                                className={cn(
                                  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white',
                                  MED_COLORS[idx % MED_COLORS.length]
                                )}
                              >
                                <Package className="h-4 w-4" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-800">{med.name}</p>
                                <p className="text-xs text-slate-400">{med.qty.toLocaleString()} units sold</p>
                              </div>
                              <span className="flex-shrink-0 text-sm font-bold text-slate-900">{formatCurrency(med.revenue)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {shouldShowSection(activeReport, 'transactions') && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Recent Transactions</h3>
                        <button className="flex items-center gap-0.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700">
                          View all <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {(data.recentTransactions ?? []).length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">No transactions in this period.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <Table>
                            <TableHeader>
                              <TableRow className="border-b border-slate-100 hover:bg-transparent">
                                <TableHead className="h-8 px-2 text-xs font-semibold text-slate-500">Invoice</TableHead>
                                <TableHead className="h-8 px-2 text-xs font-semibold text-slate-500">Customer</TableHead>
                                <TableHead className="h-8 px-2 text-xs font-semibold text-slate-500">Amount</TableHead>
                                <TableHead className="h-8 px-2 text-xs font-semibold text-slate-500">Payment</TableHead>
                                <TableHead className="h-8 px-2 text-xs font-semibold text-slate-500">Time</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {(data.recentTransactions || []).map((txn) => (
                                <TableRow key={txn.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                  <TableCell className="px-2 py-2 text-xs font-semibold text-slate-800">{txn.id}</TableCell>
                                  <TableCell className="max-w-[90px] truncate px-2 py-2 text-xs text-slate-600">
                                    {txn.customer}
                                  </TableCell>
                                  <TableCell className="px-2 py-2 text-xs font-semibold text-slate-800">
                                    {formatCurrency(txn.amount)}
                                  </TableCell>
                                  <TableCell className="px-2 py-2">
                                    <span
                                      className={cn(
                                        'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                                        getPaymentMethodColor(txn.payment)
                                      )}
                                    >
                                      {txn.payment}
                                    </span>
                                  </TableCell>
                                  <TableCell className="px-2 py-2 text-xs text-slate-500">{txn.time}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  )}

                  {shouldShowSection(activeReport, 'expiry') && (
                    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between">
                        <h3 className="text-base font-bold text-slate-900">Stock Expiry Alert</h3>
                        <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">View all</button>
                      </div>
                      {(data.expiringBatches ?? []).length === 0 ? (
                        <p className="py-8 text-center text-sm text-slate-400">No batches expiring soon.</p>
                      ) : (
                        <div className="space-y-2.5">
                          {(data.expiringBatches || []).map((med) => (
                            <div
                              key={med.batch}
                              className="flex items-start gap-2.5 rounded-lg border border-red-100 bg-red-50/60 p-3"
                            >
                              <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-red-500" />
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-slate-800">{med.name}</p>
                                <p className="text-xs text-slate-500">Batch: {med.batch}</p>
                                <p className="text-xs font-semibold text-red-600">
                                  {med.days <= 0 ? 'Expired' : `Expires in ${med.days} days`}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          <p className="pb-2 text-center text-xs text-slate-400">
            All reports are based on the selected date range. Data is updated in real-time.
          </p>
        </div>
      </div>

      <Dialog open={customOpen} onOpenChange={setCustomOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Custom Date Range</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={draftStart} onChange={(e) => setDraftStart(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>End Date</Label>
              <Input type="date" value={draftEnd} onChange={(e) => setDraftEnd(e.target.value)} />
            </div>
            <Button
              className="w-full bg-indigo-600 text-white hover:bg-indigo-700"
              onClick={applyCustomRange}
              disabled={!draftStart || !draftEnd || draftStart > draftEnd}
            >
              Apply Range
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Batch Lots Details Modal */}
      <Dialog open={batchModalOpen} onOpenChange={setBatchModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-slate-900">
              <Package className="h-5 w-5 text-indigo-600" />
              Batch Lots for {selectedItemForBatches?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedItemForBatches && (
            <div className="space-y-4 pt-2">
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 p-3 border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-500 font-medium">SKU / Code: </span>
                  <span className="font-bold text-slate-800">{selectedItemForBatches.sku}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Category: </span>
                  <span className="font-bold text-slate-800">{selectedItemForBatches.category}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Total Stock: </span>
                  <span className="font-bold text-indigo-700">{selectedItemForBatches.currentStock.toLocaleString()} cartons</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Cost / Carton: </span>
                  <span className="font-bold text-slate-800">{formatCurrency(selectedItemForBatches.unitCost)}</span>
                </div>
              </div>

              {(!selectedItemForBatches.batches || selectedItemForBatches.batches.length === 0) ? (
                <p className="py-6 text-center text-xs text-slate-400">
                  No individual batch records logged for this product.
                </p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <Table>
                    <TableHeader>
                      <TableRow className="border-b border-slate-200 bg-slate-50 hover:bg-slate-50">
                        <TableHead className="text-xs font-semibold text-slate-700">Batch Number</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700 text-right">Quantity (Cartons)</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Expiry Date</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700">Days Remaining</TableHead>
                        <TableHead className="text-xs font-semibold text-slate-700 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedItemForBatches.batches.map((b: any) => (
                        <TableRow key={b.id || b.batchNumber} className="border-b border-slate-100 hover:bg-slate-50/50">
                          <TableCell className="py-2.5 text-xs font-bold text-slate-900 font-mono">
                            {b.batchNumber}
                          </TableCell>
                          <TableCell className="py-2.5 text-right text-xs font-semibold text-slate-800">
                            {b.quantity.toLocaleString()}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs text-slate-600">
                            {format(new Date(b.expiryDate), 'dd MMM yyyy')}
                          </TableCell>
                          <TableCell className="py-2.5 text-xs font-medium">
                            <span
                              className={cn(
                                b.status === 'EXPIRED'
                                  ? 'text-rose-600 font-bold'
                                  : b.status === 'EXPIRING_SOON'
                                  ? 'text-amber-600 font-semibold'
                                  : 'text-emerald-700'
                              )}
                            >
                              {b.daysToExpiry <= 0 ? 'Expired' : `${b.daysToExpiry} days`}
                            </span>
                          </TableCell>
                          <TableCell className="py-2.5 text-center">
                            <span
                              className={cn(
                                'inline-block rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                                b.status === 'HEALTHY'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : b.status === 'EXPIRING_SOON'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              )}
                            >
                              {b.status === 'HEALTHY' ? 'Fresh' : b.status === 'EXPIRING_SOON' ? 'Expiring Soon' : 'Expired'}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
