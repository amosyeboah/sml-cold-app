import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingBag,
  Truck,
  Users,
  FileText,
  BarChart3,
  Settings,
  CreditCard,
  Clock,
  ChevronDown,
  Sun,
  Layers,
  Database,
  Tags,
  Snowflake,
  ShieldCheck,
  Cloud,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { cn } from '@/utils'
import { useEffect, useState } from 'react'

const navItems: { to: string; label: string; icon: any; allowedRoles: string[] }[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/pos', label: 'POS', icon: CreditCard, allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/sales-history', label: 'Sales History', icon: FileText, allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/products', label: 'Products', icon: Package, allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/inventory', label: 'Inventory', icon: Layers, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/categories', label: 'Categories', icon: Tags, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/purchases', label: 'Purchases', icon: ShoppingBag, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/suppliers', label: 'Suppliers', icon: Truck, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/customers', label: 'Customers', icon: Users, allowedRoles: ['ADMIN', 'MANAGER', 'CASHIER'] },
  { to: '/reports', label: 'Reports', icon: BarChart3, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/audit', label: 'Audit Trail', icon: ShieldCheck, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/sync', label: 'Offline Sync', icon: Cloud, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/expiry', label: 'Expiry', icon: Clock, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/batches', label: 'Batch Tracking', icon: Layers, allowedRoles: ['ADMIN', 'MANAGER'] },
  { to: '/backup', label: 'Backup', icon: Database, allowedRoles: ['ADMIN'] },
  { to: '/users', label: 'Users', icon: FileText, allowedRoles: ['ADMIN'] },
  { to: '/settings', label: 'Settings', icon: Settings, allowedRoles: ['ADMIN'] },
]

function useClock() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000)
    return () => clearInterval(id)
  }, [])
  return now
}

export default function Sidebar() {
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const now = useClock()

  const handleLogout = () => {
    logout()
    navigate('/login', { replace: true })
  }

  const role = user?.role || 'CASHIER'
  const visibleNavItems = navItems.filter((item) => item.allowedRoles.includes(role))

  const roleLabel =
    role === 'ADMIN'
      ? 'System Admin'
      : role === 'MANAGER'
        ? 'Store Manager'
        : 'Cashier'

  const roleAvatarBg =
    role === 'ADMIN'
      ? 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)'
      : role === 'MANAGER'
        ? 'linear-gradient(135deg, #059669 0%, #0d9488 100%)'
        : 'linear-gradient(135deg, #0284c7 0%, #2563eb 100%)'

  const roleTextColor =
    role === 'ADMIN'
      ? 'text-purple-300'
      : role === 'MANAGER'
        ? 'text-emerald-300'
        : 'text-sky-300'

  return (
    <aside
      className="fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col"
      style={{ background: 'linear-gradient(180deg, #0d1117 0%, #111827 100%)' }}
    >
      <div className="flex items-center gap-2.5 border-b border-white/5 px-5 py-5">
        <div
          className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl shadow-md shadow-sky-500/20"
          style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' }}
        >
          <Snowflake className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-sm font-bold leading-none tracking-wide text-white">SML Legacy</p>
          <p className="mt-0.5 text-[10px] font-medium text-cyan-400">Cold Store POS</p>
        </div>
      </div>

      <nav className="scrollbar-none flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-4 w-4 flex-shrink-0',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                <span className="truncate">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="space-y-2 border-t border-white/5 p-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2.5">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-300">Terminal MAIN-001</p>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
              <span className="text-[10px] font-medium text-green-400">Online</span>
            </div>
          </div>
        </div>

        <button
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          className="group flex w-full items-center gap-2.5 rounded-xl p-2.5 transition-all hover:bg-white/5"
        >
          <div
            className="h-9 w-9 flex-shrink-0 overflow-hidden rounded-full shadow-sm"
            style={{ background: roleAvatarBg }}
          >
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-sm font-bold text-white">
                {user?.username?.charAt(0).toUpperCase() ?? 'U'}
              </span>
            </div>
          </div>
          <div className="min-w-0 flex-1 text-left">
            <p className="truncate text-xs font-semibold text-white">{user?.username ?? 'User'}</p>
            <p className={cn('truncate text-[10px] font-medium', roleTextColor)}>
              {roleLabel}
            </p>
          </div>
          <ChevronDown className="h-3.5 w-3.5 flex-shrink-0 text-slate-500" />
        </button>

        {userMenuOpen && (
          <button
            onClick={handleLogout}
            className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-2.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-white/10"
          >
            Logout
          </button>
        )}

        <div className="flex items-center gap-2 rounded-xl border border-white/5 bg-white/[0.03] px-3 py-2">
          <Sun className="h-3.5 w-3.5 flex-shrink-0 text-amber-400" />
          <div>
            <p className="text-[11px] font-semibold text-white">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <p className="text-[10px] text-slate-400">
              {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
