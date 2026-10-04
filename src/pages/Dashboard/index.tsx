import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Receipt,
  BarChart2,
  AlertTriangle,
  Clock,
  FileText,
  RefreshCw,
  Database,
  Package,
  Layers,
  ShoppingBag,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react'
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
import { Link } from 'react-router-dom'
import { cn } from '@/utils'

// ─── Sparkline mini chart ──────────────────────────────────────────────────
function Sparkline({ data, color }: { data: number[]; color: string }) {
  const chartData = data.map((v, i) => ({ i, v }))
  return (
    <div className="w-full h-8 sm:h-9" style={{ minWidth: 0, minHeight: 32 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── KPI Card ─────────────────────────────────────────────────────────────
function KPICard({
  title,
  value,
  trend,
  trendLabel,
  iconBg,
  icon: Icon,
  sparkData,
  sparkColor,
}: {
  title: string
  value: string
  trend: string
  trendLabel: string
  iconBg: string
  icon: any
  sparkData: number[]
  sparkColor: string
}) {
  const isPositive = trend.startsWith('+')
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs hover:shadow-md hover:border-slate-300 transition-all flex flex-col justify-between group">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1.5 sm:mb-2">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] sm:text-xs font-semibold text-slate-500 truncate uppercase tracking-wider">{title}</p>
            <p className="text-base sm:text-lg lg:text-xl xl:text-2xl font-black text-slate-800 tracking-tight truncate mt-0.5">
              {value}
            </p>
          </div>
          <div
            className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform"
            style={{ background: iconBg }}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
        </div>
        <div className="my-1">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 flex-wrap">
        <span
          className={cn(
            'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] sm:text-[11px] font-bold',
            isPositive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          )}
        >
          {isPositive ? (
            <TrendingUp className="w-3 h-3 text-emerald-600 flex-shrink-0" />
          ) : (
            <TrendingDown className="w-3 h-3 text-rose-600 flex-shrink-0" />
          )}
          {trend}
        </span>
        <span className="text-[10px] sm:text-[11px] text-slate-400 truncate">{trendLabel}</span>
      </div>
    </div>
  )
}

// ─── Quick Actions Data ───────────────────────────────────────────────────
const quickActions = [
  { label: 'New Sale', icon: ShoppingCart, color: '#3b82f6', bg: '#eff6ff', border: '#bfdbfe', to: '/pos' },
  { label: 'Add Product', icon: Package, color: '#10b981', bg: '#ecfdf5', border: '#a7f3d0', to: '/products' },
  { label: 'Purchases', icon: ShoppingBag, color: '#f59e0b', bg: '#fffbeb', border: '#fde68a', to: '/purchases' },
  { label: 'Inventory', icon: Layers, color: '#8b5cf6', bg: '#f5f3ff', border: '#ddd6fe', to: '/inventory' },
  { label: 'Reports', icon: FileText, color: '#ec4899', bg: '#fdf2f8', border: '#fbcfe8', to: '/reports' },
  { label: 'Cloud Sync', icon: RefreshCw, color: '#06b6d4', bg: '#ecfeff', border: '#a5f3fc', to: '/sync' },
]

const kpiSparkBlue = [300, 350, 280, 420, 390, 470, 410, 500, 460, 520]
const kpiSparkGreen = [8000, 9200, 8700, 10500, 11200, 10800, 12000, 11500, 13000, 12400]
const kpiSparkOrange = [95, 110, 102, 118, 125, 119, 130, 128, 135, 128]
const kpiSparkPurple = [2800, 3100, 3400, 3200, 3700, 3500, 4000, 3900, 4200, 4500]

// Custom tooltip for Sales Overview
const SalesOverviewTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl border border-slate-700">
        <p className="text-slate-400 font-medium mb-0.5">{label}</p>
        <p className="font-bold text-sky-400 text-sm">₵{Number(payload[0].value).toLocaleString()}.00</p>
      </div>
    )
  }
  return null
}

export default function Dashboard() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => window.api.getDashboardStats(),
    refetchInterval: 30000,
  })

  const [showAllMedicines, setShowAllMedicines] = useState(false)
  const [showAllTransactions, setShowAllTransactions] = useState(false)

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6 bg-slate-50/70 h-full overflow-y-auto space-y-4 md:space-y-5">
      {/* ── KPI Cards Row (2x2 on portrait, 4 columns on landscape tablet) ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-3.5 md:gap-4">
        <KPICard
          title="Today's Sales"
          value={`₵${(stats?.todayRevenue ?? 0).toLocaleString()}.00`}
          trend={stats?.todayRevenueTrend ?? '0%'}
          trendLabel="vs yesterday"
          iconBg="linear-gradient(135deg, #3b82f6, #1d4ed8)"
          icon={ShoppingCart}
          sparkData={kpiSparkBlue}
          sparkColor="#3b82f6"
        />
        <KPICard
          title="Revenue (MTD)"
          value={`₵${(stats?.mtdRevenue ?? 0).toLocaleString()}.00`}
          trend={stats?.mtdRevenueTrend ?? '0%'}
          trendLabel="vs last month"
          iconBg="linear-gradient(135deg, #10b981, #047857)"
          icon={TrendingUp}
          sparkData={kpiSparkGreen}
          sparkColor="#10b981"
        />
        <KPICard
          title="Transactions"
          value={String(stats?.todayTransactions ?? 0)}
          trend={stats?.todayTransactionsTrend ?? '0%'}
          trendLabel="vs yesterday"
          iconBg="linear-gradient(135deg, #f59e0b, #b45309)"
          icon={Receipt}
          sparkData={kpiSparkOrange}
          sparkColor="#f59e0b"
        />
        <KPICard
          title="Gross Profit"
          value={`₵${(stats?.mtdGrossProfit ?? 0).toLocaleString()}.00`}
          trend={stats?.mtdGrossProfitTrend ?? '0%'}
          trendLabel="vs last month"
          iconBg="linear-gradient(135deg, #8b5cf6, #6d28d9)"
          icon={BarChart2}
          sparkData={kpiSparkPurple}
          sparkColor="#8b5cf6"
        />
      </div>

      {/* ── Touch Quick Action Bar (Comfortable 44px+ tap targets for 10.1 tablet) ── */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-3 sm:p-4 shadow-xs">
        <div className="flex items-center justify-between mb-2.5 px-0.5">
          <p className="text-xs font-bold text-slate-700 tracking-wide uppercase">Quick Actions</p>
          <span className="text-[11px] text-slate-400 font-medium">1-Tap Shortcuts</span>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
          {quickActions.map((action) => (
            <Link key={action.label} to={action.to} className="min-w-0">
              <button
                className="w-full flex flex-col items-center justify-center gap-1.5 p-2 sm:p-2.5 rounded-xl border transition-all duration-150 hover:shadow-sm hover:scale-[1.02] active:scale-95 cursor-pointer min-h-[64px] sm:min-h-[72px]"
                style={{
                  backgroundColor: action.bg,
                  borderColor: action.border,
                }}
              >
                <div
                  className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: action.color }}
                >
                  <action.icon className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                </div>
                <span className="text-[11px] sm:text-xs font-bold text-slate-700 truncate w-full text-center">
                  {action.label}
                </span>
              </button>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Primary Analytics Row: Sales Overview Chart + Top Selling Products ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 md:gap-5">
        {/* Sales Overview Chart (7 columns on tablet landscape) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">Sales Overview</h3>
              <p className="text-xs text-slate-400">Daily revenue trends over the last 7 days</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 bg-slate-100 border border-slate-200 px-2.5 py-1 rounded-lg">
              📅 This Week
            </span>
          </div>

          <div className="h-[210px] sm:h-[230px] md:h-[250px] w-full" style={{ minHeight: 180, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats?.salesOverviewData || []} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <defs>
                  <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                <YAxis
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(v) => `₵${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`}
                />
                <Tooltip content={<SalesOverviewTooltip />} />
                <Area
                  type="monotone"
                  dataKey="sales"
                  stroke="#3b82f6"
                  strokeWidth={2.5}
                  fill="url(#salesGradient)"
                  dot={{ r: 3.5, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Selling Products (5 columns on tablet landscape) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Top Selling Products</h3>
                <p className="text-xs text-slate-400">Best performers by volume (MTD)</p>
              </div>
              <button
                onClick={() => setShowAllMedicines(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors px-2 py-1 rounded-md hover:bg-blue-50 cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-2.5">
              {(stats?.topMedicines || []).slice(0, 5).map((med: any, _idx: number) => (
                <div
                  key={`${med.id ?? med.name ?? med.rank ?? _idx}`}
                  className="flex items-center gap-2.5 p-2 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  <span
                    className={cn(
                      'w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-black flex-shrink-0',
                      _idx === 0
                        ? 'bg-amber-100 text-amber-800'
                        : _idx === 1
                        ? 'bg-slate-200 text-slate-700'
                        : _idx === 2
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    {med.rank || _idx + 1}
                  </span>
                  <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0 text-sky-600">
                    <Package className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs sm:text-sm font-semibold text-slate-800 truncate">{med.name}</p>
                    <p className="text-[11px] text-slate-400 truncate">{med.desc || 'Standard Pack'}</p>
                  </div>
                  <span className="text-xs sm:text-sm font-bold text-emerald-600 flex-shrink-0">{med.price}</span>
                </div>
              ))}

              {(!stats?.topMedicines || stats?.topMedicines.length === 0) && (
                <div className="py-8 text-center text-xs text-slate-400">No product sales recorded yet.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Secondary Analytics Row: Payment Breakdown & Recent Transactions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5 sm:gap-4 md:gap-5">
        {/* Payment Summary Donut (5 columns on tablet landscape) */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Payment Summary</h3>
                <p className="text-xs text-slate-400">Cash vs Mobile Money split (MTD)</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
              <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: 130, height: 130 }}>
                <PieChart width={130} height={130}>
                  <Pie
                    data={stats?.paymentData || []}
                    cx={61}
                    cy={61}
                    innerRadius={42}
                    outerRadius={60}
                    dataKey="value"
                    strokeWidth={2}
                    stroke="#fff"
                  >
                    {(stats?.paymentData || []).map((entry: any) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                {/* Center total label */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <p className="text-[10px] font-semibold text-slate-400 uppercase">Total</p>
                  <p className="text-xs sm:text-sm font-black text-slate-800">
                    ₵{((stats?.mtdRevenue) || 0).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="flex-1 w-full space-y-2.5">
                {(stats?.paymentData || []).map((item: any) => (
                  <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/70 border border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                      <span className="text-xs font-semibold text-slate-700 truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 text-right">
                      <span className="text-xs font-bold text-slate-800">₵{Number(item.value || 0).toLocaleString()}.00</span>
                      <span className="text-[10px] font-semibold bg-white border border-slate-200 px-1.5 py-0.5 rounded text-slate-500">
                        {item.percent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Recent Transactions (7 columns on tablet landscape) */}
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200/80 p-4 sm:p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm sm:text-base">Recent Transactions</h3>
                <p className="text-xs text-slate-400">Latest completed point-of-sale checkouts</p>
              </div>
              <button
                onClick={() => setShowAllTransactions(true)}
                className="text-xs text-blue-600 hover:text-blue-700 font-semibold transition-colors px-2 py-1 rounded-md hover:bg-blue-50 cursor-pointer"
              >
                View all
              </button>
            </div>

            <div className="space-y-2">
              {(stats?.recentTransactions || []).slice(0, 5).map((tx: any) => (
                <div
                  key={tx.id ?? tx._id ?? `${tx.date}-${tx.time}-${tx.amount}`}
                  className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-100 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600">
                    <Receipt className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-bold text-slate-800">{tx.id}</p>
                      {(() => {
                        const pmUpper = String(tx.paymentMethod || '').toUpperCase()
                        const isMobile = pmUpper.includes('MOBILE') || pmUpper.includes('MOMO')
                        const isSplit = pmUpper.includes('SPLIT')
                        return (
                          <span
                            className={cn(
                              'px-1.5 py-0.2 rounded text-[9px] font-bold uppercase',
                              isSplit
                                ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                : isMobile
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            )}
                          >
                            {isSplit ? 'Split' : isMobile ? 'MoMo' : 'Cash'}
                          </span>
                        )
                      })()}
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">{tx.customer || 'Walk-in Customer'}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs sm:text-sm font-black text-slate-800">₵{Number(tx.amount || 0).toLocaleString()}.00</p>
                    <p className="text-[10px] text-slate-400">{tx.time || tx.date}</p>
                  </div>
                </div>
              ))}

              {(!stats?.recentTransactions || stats?.recentTransactions.length === 0) && (
                <div className="py-8 text-center text-xs text-slate-400">No transactions recorded today.</div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Alerts & Operational Health: Low Stock & Expiring Batches ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4 md:gap-5">
        {/* Low Stock Alert */}
        <div className="bg-white rounded-2xl border border-rose-100 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center text-rose-600 flex-shrink-0">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-rose-700">Low Stock Alert</h3>
                <p className="text-[11px] text-slate-400">Cartons below reorder thresholds</p>
              </div>
            </div>
            <Link to="/inventory">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 cursor-pointer">
                Manage
              </button>
            </Link>
          </div>

          <div className="space-y-2">
            {(stats?.lowStockItems || []).slice(0, 4).map((item: any) => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-rose-50/40 border border-rose-100/60">
                <span className="text-xs font-semibold text-slate-700 truncate min-w-0 flex-1 pr-2">{item.name}</span>
                <span className="text-xs font-bold text-rose-600 bg-white px-2 py-0.5 rounded-lg border border-rose-200 flex-shrink-0">
                  {item.left} left
                </span>
              </div>
            ))}

            {(!stats?.lowStockItems || stats?.lowStockItems.length === 0) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-700 text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>All product stock levels are above reorder thresholds.</span>
              </div>
            )}
          </div>
        </div>

        {/* Expiring Soon */}
        <div className="bg-white rounded-2xl border border-amber-100 p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 flex-shrink-0">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold text-amber-700">Batch Shelf Life & Expiry</h3>
                <p className="text-[11px] text-slate-400">Batches needing attention</p>
              </div>
            </div>
            <Link to="/expiry">
              <button className="text-xs text-blue-600 hover:text-blue-700 font-semibold px-2 py-1 rounded hover:bg-blue-50 cursor-pointer">
                View
              </button>
            </Link>
          </div>

          <div className="space-y-2">
            {(stats?.expiringItems || []).slice(0, 4).map((item: any) => (
              <div key={item.name} className="flex items-center justify-between p-2 rounded-xl bg-amber-50/40 border border-amber-100/60">
                <span className="text-xs font-semibold text-slate-700 truncate min-w-0 flex-1 pr-2">{item.name}</span>
                <span className="text-xs font-bold text-amber-700 bg-white px-2 py-0.5 rounded-lg border border-amber-200 flex-shrink-0">
                  {item.days}
                </span>
              </div>
            ))}

            {(!stats?.expiringItems || stats?.expiringItems.length === 0) && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50/60 border border-emerald-100 text-emerald-700 text-xs">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>No products nearing shelf-life expiration.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Modals: All Top Selling & All Recent Transactions ── */}
      <Dialog open={showAllMedicines} onOpenChange={setShowAllMedicines}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-800">
              Top Selling Products (Month to Date)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2 mt-3">
            {(stats?.topMedicines || []).map((med: any, _idx: number) => (
              <div
                key={`${med.id ?? med.name ?? med.rank ?? _idx}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <span className="w-6 text-sm font-bold text-slate-400 text-center flex-shrink-0">{med.rank || _idx + 1}</span>
                <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0 text-sky-600">
                  <Package className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-slate-800 truncate">{med.name}</p>
                  <p className="text-xs text-slate-400 truncate">{med.desc || 'Standard Pack'}</p>
                </div>
                <span className="text-sm font-bold text-emerald-600 flex-shrink-0">{med.price}</span>
              </div>
            ))}
            {(!stats?.topMedicines || stats?.topMedicines.length === 0) && (
              <p className="text-center text-sm text-slate-500 py-8">No products sold this month.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllTransactions} onOpenChange={setShowAllTransactions}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col p-5 rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base sm:text-lg font-bold text-slate-800">
              Recent Transactions (Month to Date)
            </DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-1 space-y-2.5 mt-3">
            {(stats?.recentTransactions || []).map((tx: any) => (
              <div
                key={tx.id}
                className="flex items-center gap-3 sm:gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors"
              >
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0 text-indigo-600">
                  <Receipt className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{tx.id}</p>
                    <p className="text-[11px] text-slate-400 truncate">{tx.customer || 'Walk-in'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-600">{tx.date}</p>
                    <p className="text-[10px] text-slate-400">{tx.time}</p>
                  </div>
                  <div>
                    {(() => {
                      const pmUpper = String(tx.paymentMethod || '').toUpperCase()
                      const isSplit = pmUpper.includes('SPLIT')
                      const isMobile = !isSplit && (pmUpper.includes('MOBILE') || pmUpper.includes('MOMO'))
                      let label = isMobile ? 'Mobile Money' : 'Cash'
                      if (isSplit) {
                        const cMatch = tx.paymentMethod.match(/CASH[=:]\s*([0-9.]+)/i)
                        const mMatch = tx.paymentMethod.match(/MOBILE[=:]\s*([0-9.]+)/i)
                        if (cMatch || mMatch) {
                          const c = cMatch ? parseFloat(cMatch[1]) : 0
                          const m = mMatch ? parseFloat(mMatch[1]) : 0
                          label = `Split (₵${c} + ₵${m})`
                        } else {
                          label = 'Split'
                        }
                      }
                      return (
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                            isSplit
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : isMobile
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          )}
                        >
                          {label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">₵{Number(tx.amount || 0).toLocaleString()}.00</p>
                  </div>
                </div>
              </div>
            ))}
            {(!stats?.recentTransactions || stats?.recentTransactions.length === 0) && (
              <p className="text-center text-sm text-slate-500 py-8">No transactions this month.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
