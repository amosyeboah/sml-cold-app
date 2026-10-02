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
  Plus,
  FileText,
  RefreshCw,
  Database,
  ArrowUpRight,
  Package,
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
    <div style={{ minWidth: 0, minHeight: 48 }}>
      <ResponsiveContainer width="100%" height={48}>
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
    <div className="bg-white rounded-2xl border border-slate-100 p-3.5 sm:p-4 md:p-5 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between">
      <div>
        <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-500 mb-1 truncate">{title}</p>
            <p className="text-lg sm:text-xl md:text-2xl font-bold text-slate-800 tracking-tight truncate">{value}</p>
          </div>
          <div
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: iconBg }}
          >
            <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
          </div>
        </div>
        <div className="mb-2">
          <Sparkline data={sparkData} color={sparkColor} />
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-wrap">
        {isPositive ? (
          <TrendingUp className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        ) : (
          <TrendingDown className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
        )}
        <span className={`text-xs font-semibold ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {trend}
        </span>
        <span className="text-[11px] sm:text-xs text-slate-400 truncate">{trendLabel}</span>
      </div>
    </div>
  )
}

// ─── Static data ──────────────────────────────────────────────────────────
const quickActions = [
  { label: 'New Sale', icon: ShoppingCart, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', to: '/pos' },
  { label: 'Add Product', icon: Package, color: '#22c55e', bg: 'rgba(34,197,94,0.1)', to: '/products' },
  { label: 'New Purchase', icon: Package, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', to: '/purchases' },
  { label: 'Stock Adjustment', icon: RefreshCw, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', to: '/inventory' },
  { label: 'Daily Report', icon: FileText, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', to: '/reports' },
  { label: 'Backup Now', icon: Database, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', to: '/backup' },
]

const kpiSparkBlue = [300, 350, 280, 420, 390, 470, 410, 500, 460, 520]
const kpiSparkGreen = [8000, 9200, 8700, 10500, 11200, 10800, 12000, 11500, 13000, 12400]
const kpiSparkOrange = [95, 110, 102, 118, 125, 119, 130, 128, 135, 128]
const kpiSparkPurple = [2800, 3100, 3400, 3200, 3700, 3500, 4000, 3900, 4200, 4500]

// Custom tooltip for Sales Overview
const SalesOverviewTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-800 text-white text-xs rounded-lg px-3 py-2 shadow-xl">
        <p className="font-bold">₵{payload[0].value.toLocaleString()}.00</p>
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
    <div className="p-3.5 sm:p-4 md:p-6 bg-slate-50 h-full overflow-y-auto space-y-4 md:space-y-5">
      {/* Main layout: content + right sidebar */}
      <div className="flex flex-col xl:flex-row gap-4 md:gap-5">

        {/* ── Left/main column ─────────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4 md:space-y-5">

          {/* KPI Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 md:gap-4">
            <KPICard
              title="Today's Sales"
              value={`₵${(stats?.todayRevenue ?? 0).toLocaleString()}.00`}
              trend={stats?.todayRevenueTrend ?? '0%'}
              trendLabel="vs yesterday"
              iconBg="linear-gradient(135deg, #6366f1, #4f46e5)"
              icon={ShoppingCart}
              sparkData={kpiSparkBlue}
              sparkColor="#6366f1"
            />
            <KPICard
              title="Total Revenue (MTD)"
              value={`₵${(stats?.mtdRevenue ?? 0).toLocaleString()}.00`}
              trend={stats?.mtdRevenueTrend ?? '0%'}
              trendLabel="vs last month"
              iconBg="linear-gradient(135deg, #22c55e, #16a34a)"
              icon={TrendingUp}
              sparkData={kpiSparkGreen}
              sparkColor="#22c55e"
            />
            <KPICard
              title="Total Transactions"
              value={String(stats?.todayTransactions ?? 0)}
              trend={stats?.todayTransactionsTrend ?? '0%'}
              trendLabel="vs yesterday"
              iconBg="linear-gradient(135deg, #f59e0b, #d97706)"
              icon={Receipt}
              sparkData={kpiSparkOrange}
              sparkColor="#f59e0b"
            />
            <KPICard
              title="Gross Profit (MTD)"
              value={`₵${(stats?.mtdGrossProfit ?? 0).toLocaleString()}.00`}
              trend={stats?.mtdGrossProfitTrend ?? '0%'}
              trendLabel="vs last month"
              iconBg="linear-gradient(135deg, #a855f7, #9333ea)"
              icon={BarChart2}
              sparkData={kpiSparkPurple}
              sparkColor="#a855f7"
            />
          </div>

          {/* Sales Overview + Top Selling */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Sales Overview Chart */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Sales Overview</h3>
                <button className="flex items-center gap-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-1.5 hover:bg-slate-100 transition-colors active:scale-95">
                  📅 This Week
                </button>
              </div>
              <div className="h-[200px] sm:h-[220px] w-full" style={{ minHeight: 160, minWidth: 0 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats?.salesOverviewData || []} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="day" tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} tickLine={false} axisLine={false} tickFormatter={(v) => `₵${v}`} />
                    <Tooltip content={<SalesOverviewTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="#6366f1"
                      strokeWidth={2.5}
                      fill="url(#salesGradient)"
                      dot={{ r: 4, fill: '#6366f1', strokeWidth: 2, stroke: '#fff' }}
                      activeDot={{ r: 6, fill: '#6366f1', stroke: '#fff', strokeWidth: 2 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Top Selling Products */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Top Selling Products</h3>
                <button 
                  onClick={() => setShowAllMedicines(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors p-1"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {(stats?.topMedicines || []).slice(0, 5).map((med: any, _idx: number) => (
                  <div key={`${med.id ?? med.name ?? med.rank ?? _idx}`} className="flex items-center gap-2.5 sm:gap-3">
                    <span className="w-5 text-xs font-bold text-slate-400 text-center flex-shrink-0">{med.rank}</span>
                    <div className="w-9 h-9 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                      <Package className="w-4 h-4 text-sky-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-700 truncate">{med.name}</p>
                      <p className="text-xs text-slate-400 truncate">{med.desc}</p>
                    </div>
                    <span className="text-sm font-bold text-green-600 flex-shrink-0">{med.price}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Payment Summary + Recent Transactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            {/* Payment Summary Donut */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
              <h3 className="font-bold text-slate-800 text-sm mb-4">Payment Summary</h3>
              <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
                <div className="relative flex-shrink-0" style={{ width: 140, height: 140 }}>
                  <PieChart width={140} height={140}>
                    <Pie
                      data={stats?.paymentData || []}
                      cx={65}
                      cy={65}
                      innerRadius={44}
                      outerRadius={64}
                      dataKey="value"
                      strokeWidth={2}
                      stroke="#fff"
                    >
                      {(stats?.paymentData || []).map((entry: any) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                  {/* Center label */}
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] text-slate-400 font-medium">Total</p>
                    <p className="text-sm font-bold text-slate-800">₵{((stats?.mtdRevenue) || 0).toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex-1 w-full space-y-2.5">
                  {(stats?.paymentData || []).map((item: any) => (
                    <div key={item.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                        <span className="text-xs text-slate-600">{item.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-slate-700">₵{item.value.toLocaleString()}.00</span>
                        <span className="text-[10px] text-slate-400">{item.percent}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white rounded-2xl border border-slate-100 p-4 sm:p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-slate-800 text-sm">Recent Transactions</h3>
                <button 
                  onClick={() => setShowAllTransactions(true)}
                  className="text-xs text-indigo-600 hover:text-indigo-700 font-medium transition-colors p-1"
                >
                  View all
                </button>
              </div>
              <div className="space-y-3">
                {(stats?.recentTransactions || []).slice(0, 5).map((tx: any) => (
                  <div key={tx.id ?? tx._id ?? `${tx.date}-${tx.time}-${tx.amount}`} className="flex items-center gap-3 group">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center flex-shrink-0">
                      <Receipt className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-700">{tx.id}</p>
                      <p className="text-xs text-slate-400 truncate">{tx.customer}</p>
                    </div>
                    <span className="text-xs text-slate-400 flex-shrink-0">{tx.time}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* ── Right column / Widgets ──────────────────────────────────── */}
        <div className="w-full xl:w-[260px] 2xl:w-[280px] flex-shrink-0 grid grid-cols-1 md:grid-cols-3 xl:grid-cols-1 gap-4">

          {/* Low Stock Alert */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-red-500">Low Stock Alert</h3>
                <Link to="/inventory">
                  <button className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium p-1">View all</button>
                </Link>
              </div>
              <div className="space-y-2.5">
                {(stats?.lowStockItems || []).map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                      <AlertTriangle className="w-3 h-3 text-red-500" />
                    </div>
                    <span className="text-xs text-slate-700 flex-1 truncate">{item.name}</span>
                    <span className="text-[11px] font-bold text-red-500 flex-shrink-0">{item.left} left</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Expiring Soon */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-amber-500">Expiring Soon</h3>
                <Link to="/expiry">
                  <button className="text-[11px] text-indigo-600 hover:text-indigo-700 font-medium p-1">View all</button>
                </Link>
              </div>
              <div className="space-y-2.5">
                {(stats?.expiringItems || []).map((item: any) => (
                  <div key={item.name} className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                      <Clock className="w-3 h-3 text-amber-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{item.days}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-100 p-4 shadow-sm flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 mb-3">Quick Actions</h3>
              <div className="grid grid-cols-3 gap-2">
                {quickActions.map((action) => (
                  <Link key={action.label} to={action.to}>
                    <button
                      className="w-full flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95 min-h-[64px] justify-center"
                      style={{ background: action.bg }}
                    >
                      <div
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center"
                        style={{ background: action.color }}
                      >
                        <action.icon className="w-3.5 h-3.5 text-white" />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-semibold text-slate-600 text-center leading-tight">{action.label}</span>
                    </button>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ────────────────────────────────────────────────────────── */}
      <Dialog open={showAllMedicines} onOpenChange={setShowAllMedicines}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>All Top Selling Products (MTD)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
            {(stats?.topMedicines || []).map((med: any, _idx: number) => (
              <div key={`${med.id ?? med.name ?? med.rank ?? _idx}`} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <span className="w-6 text-sm font-bold text-slate-400 text-center flex-shrink-0">{med.rank}</span>
                <div className="w-10 h-10 rounded-xl bg-sky-50 flex items-center justify-center flex-shrink-0">
                  <Package className="w-4 h-4 text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{med.name}</p>
                  <p className="text-xs text-slate-400 truncate">{med.desc}</p>
                </div>
                <span className="text-sm font-bold text-green-600 flex-shrink-0">{med.price}</span>
              </div>
            ))}
            {(stats?.topMedicines?.length === 0) && (
              <p className="text-center text-sm text-slate-500 py-8">No products sold this month.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllTransactions} onOpenChange={setShowAllTransactions}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>All Recent Transactions (MTD)</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2 space-y-3 mt-4">
            {(stats?.recentTransactions || []).map((tx: any) => (
              <div key={tx.id} className="flex items-center gap-4 p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center flex-shrink-0">
                  <Receipt className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0 grid grid-cols-2 sm:grid-cols-4 gap-4 items-center">
                  <div>
                    <p className="text-xs font-bold text-slate-800">{tx.id}</p>
                    <p className="text-[11px] text-slate-400 truncate">{tx.customer}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">{tx.date}</p>
                    <p className="text-xs text-slate-400">{tx.time}</p>
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
                          label = `Split (Cash ₵${c} + Mobile ₵${m})`
                        } else {
                          label = 'Split (Cash + Mobile)'
                        }
                      }
                      return (
                        <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold', 
                          isSplit ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                          isMobile ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        )}>
                          {label}
                        </span>
                      )
                    })()}
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-800">₵{tx.amount.toLocaleString()}.00</p>
                  </div>
                </div>
              </div>
            ))}
            {(stats?.recentTransactions?.length === 0) && (
              <p className="text-center text-sm text-slate-500 py-8">No transactions this month.</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
