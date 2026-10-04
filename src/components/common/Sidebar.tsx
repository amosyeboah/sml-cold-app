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
  ChevronLeft,
  ChevronRight,
  Sun,
  Layers,
  Database,
  Tags,
  Snowflake,
  ShieldCheck,
  Cloud,
  LogOut,
} from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useUIStore } from '@/store/uiStore'
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
  const { sidebarCollapsed, toggleSidebar } = useUIStore()
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
      className={cn(
        'fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-white/5 transition-all duration-300 ease-in-out',
        sidebarCollapsed ? 'w-[58px]' : 'w-[185px]'
      )}
      style={{ background: 'linear-gradient(180deg, #0d1117 0%, #111827 100%)' }}
    >
      {/* Header / Brand */}
      <div
        className={cn(
          'flex items-center border-b border-white/5 py-2.5 transition-all',
          sidebarCollapsed ? 'justify-center px-1.5' : 'justify-between px-3'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg shadow-md shadow-sky-500/20 hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            style={{ background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)' }}
          >
            <Snowflake className="h-3.5 w-3.5 text-white" />
          </button>
          {!sidebarCollapsed && (
            <div className="min-w-0">
              <p className="text-xs font-bold leading-none tracking-wide text-white truncate">SML Legacy</p>
              <p className="mt-0.5 text-[9px] font-medium text-cyan-400 truncate">Cold Store POS</p>
            </div>
          )}
        </div>

        {!sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            title="Collapse sidebar"
            className="flex h-6 w-6 items-center justify-center rounded-md text-slate-400 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Navigation Links */}
      <nav className="scrollbar-none flex-1 space-y-0.5 overflow-y-auto px-1.5 py-1.5">
        {visibleNavItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            title={sidebarCollapsed ? item.label : undefined}
            className={({ isActive }) =>
              cn(
                'group relative flex items-center rounded-lg transition-all duration-150',
                sidebarCollapsed ? 'justify-center p-2' : 'gap-2 px-2.5 py-1.5 text-xs font-medium',
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                  : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'flex-shrink-0 transition-transform duration-150 group-hover:scale-110',
                    sidebarCollapsed ? 'h-4 w-4' : 'h-3.5 w-3.5',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                  )}
                />
                {!sidebarCollapsed && <span className="truncate">{item.label}</span>}

                {/* Floating Tooltip when Collapsed */}
                {sidebarCollapsed && (
                  <div className="pointer-events-none absolute left-full ml-2.5 z-50 hidden whitespace-nowrap rounded-md border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] font-semibold text-white shadow-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100 md:block">
                    {item.label}
                  </div>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Bottom Footer Section */}
      <div className={cn('space-y-1.5 border-t border-white/5 transition-all', sidebarCollapsed ? 'p-1.5' : 'p-2')}>
        {/* Terminal Status */}
        {sidebarCollapsed ? (
          <div
            title="Terminal MAIN-001 (Online)"
            className="flex items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] py-1 cursor-pointer"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-green-500" />
            </span>
          </div>
        ) : (
          <div className="rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-slate-300 truncate">Terminal MAIN-001</p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-400" />
                <span className="text-[9px] font-medium text-green-400">Online</span>
              </div>
            </div>
          </div>
        )}

        {/* User Card */}
        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            title={sidebarCollapsed ? `${user?.username ?? 'User'} (${roleLabel})` : undefined}
            className={cn(
              'group flex w-full items-center rounded-lg transition-all hover:bg-white/5 cursor-pointer',
              sidebarCollapsed ? 'justify-center p-1' : 'gap-2 p-1.5'
            )}
          >
            <div
              className="h-6 w-6 flex-shrink-0 overflow-hidden rounded-full shadow-xs"
              style={{ background: roleAvatarBg }}
            >
              <div className="flex h-full w-full items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {user?.username?.charAt(0).toUpperCase() ?? 'U'}
                </span>
              </div>
            </div>
            {!sidebarCollapsed && (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[11px] font-semibold text-white leading-tight">{user?.username ?? 'User'}</p>
                  <p className={cn('truncate text-[9px] font-medium leading-tight', roleTextColor)}>{roleLabel}</p>
                </div>
                <ChevronDown className="h-3 w-3 flex-shrink-0 text-slate-500" />
              </>
            )}
          </button>

          {/* User Menu Dropdown */}
          {userMenuOpen && (
            <div
              className={cn(
                'absolute bottom-full mb-1.5 z-50 overflow-hidden rounded-lg border border-white/10 bg-slate-900 p-1 shadow-2xl backdrop-blur-md',
                sidebarCollapsed ? 'left-full ml-2 w-40' : 'left-0 right-0'
              )}
            >
              <div className="px-2 py-1 border-b border-white/5 mb-0.5">
                <p className="text-[11px] font-bold text-white truncate">{user?.username ?? 'User'}</p>
                <p className={cn('text-[9px] font-medium truncate', roleTextColor)}>{roleLabel}</p>
              </div>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                <span>Logout</span>
              </button>
            </div>
          )}
        </div>

        {/* Date & Time */}
        {sidebarCollapsed ? (
          <div
            title={`${now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })} - ${now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}`}
            className="flex flex-col items-center justify-center rounded-lg border border-white/5 bg-white/[0.03] py-1"
          >
            <Sun className="h-3 w-3 text-amber-400 mb-0.5" />
            <span className="text-[8px] font-semibold text-white">
              {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 rounded-lg border border-white/5 bg-white/[0.03] px-2 py-1">
            <Sun className="h-3 w-3 flex-shrink-0 text-amber-400" />
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-white leading-tight">
                {now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="text-[9px] text-slate-400 truncate leading-tight">
                {now.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
              </p>
            </div>
          </div>
        )}

        {/* Bottom Expand/Collapse Quick Toggle */}
        <button
          onClick={toggleSidebar}
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={cn(
            'flex w-full items-center rounded-lg border border-white/5 bg-white/[0.02] text-[10px] font-medium text-slate-400 hover:bg-white/5 hover:text-white transition-all cursor-pointer',
            sidebarCollapsed ? 'justify-center p-1.5' : 'justify-between px-2 py-1'
          )}
        >
          {sidebarCollapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <>
              <span className="text-[10px]">Collapse Menu</span>
              <ChevronLeft className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
