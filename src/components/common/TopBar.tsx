import { useState, useEffect, useRef } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { Bell, Search, Plus, Maximize2, AlertTriangle, Clock, Package, User, RefreshCw } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Command } from 'cmdk'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useQuery } from '@tanstack/react-query'
import { cn } from '@/utils'
import { subscribeToSyncState, reconcileAllSalesWithCloud } from '@/services/sync/syncQueue'
import { fetchCloudSalesIfAvailable, syncAllCloudDataIfAvailable } from '@/services/api/mobileStorage'
import { queryClient } from '@/lib/queryClient'

const greetingText = () => {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

const routeSubtitles: Record<string, string> = {
  '/dashboard': "Here's what's happening in your cold store today.",
  '/pos': 'Process sales and manage checkout transactions.',
  '/products': 'Manage your frozen products catalog.',
  '/medicines': 'Manage your frozen products catalog.',
  '/inventory': 'Track cold room stock, cartons, and inventory levels.',
  '/purchases': 'Manage supplier purchase orders and stock receipts.',
  '/suppliers': 'View and manage seafood and poultry suppliers.',
  '/customers': 'Customer directory and wholesale records.',
  '/reports': 'Cold store analytics and system reports.',
  '/audit': 'Governance audit trail for critical price, stock, and staff events.',
  '/sync': 'Manage cloud synchronization, queue status, and connectivity to Supabase.',
  '/expiry': 'Monitor batch shelf life and expiration dates.',
  '/batches': 'Track batch status, freezer shelf life, and carton stock.',
  '/backup': 'Export and restore your cold store database.',
  '/users': 'User management and staff roles.',
  '/settings': 'Business info, receipt layout, and hardware configuration.',
}

export default function TopBar() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const isDashboard = pathname === '/dashboard'

  // Fullscreen
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {})
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen()
      }
    }
  }

  // Dashboard Stats (for alerts)
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: () => window.api.getDashboardStats(),
    staleTime: 30000,
  })

  const lowStock = stats?.lowStockItems || []
  const expiring = stats?.expiringItems || []
  const alertCount = lowStock.length + expiring.length

  const [showNotifications, setShowNotifications] = useState(false)
  const notifRef = useRef<HTMLDivElement>(null)

  const [syncState, setSyncState] = useState<{ isSyncing: boolean; pendingCount: number; lastSyncTime: string | null }>({
    isSyncing: false,
    pendingCount: 0,
    lastSyncTime: null,
  })

  const [manualSyncing, setManualSyncing] = useState(false)
  const [syncSuccessMsg, setSyncSuccessMsg] = useState<string | null>(null)

  const handleManualSync = async () => {
    if (manualSyncing || syncState.isSyncing) return
    setManualSyncing(true)
    setSyncSuccessMsg(null)
    try {
      const res = await reconcileAllSalesWithCloud()
      await syncAllCloudDataIfAvailable().catch(() => {})
      queryClient.invalidateQueries({ queryKey: ['dashboard-stats'] })
      queryClient.invalidateQueries({ queryKey: ['reports'] })
      queryClient.invalidateQueries({ queryKey: ['batches'] })
      queryClient.invalidateQueries({ queryKey: ['medicines'] })
      queryClient.invalidateQueries({ queryKey: ['customers'] })
      queryClient.invalidateQueries({ queryKey: ['sales'] })
      setSyncSuccessMsg(res.pushedCount > 0 ? `Synced (${res.pushedCount})!` : 'Synced!')
      setTimeout(() => setSyncSuccessMsg(null), 3000)
    } catch (err: any) {
      console.warn('Manual sync failed:', err)
      setSyncSuccessMsg('Error')
      setTimeout(() => setSyncSuccessMsg(null), 3000)
    } finally {
      setManualSyncing(false)
    }
  }

  useEffect(() => {
    const unsub = subscribeToSyncState((s) => setSyncState(s))
    return () => unsub()
  }, [])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // CMDK Global Search
  const [searchOpen, setSearchOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setSearchOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const { data: medicines } = useQuery({ queryKey: ['medicines'], queryFn: () => window.api.getMedicines() })
  const { data: customers } = useQuery({ queryKey: ['customers'], queryFn: () => window.api.getCustomers() })

  return (
    <header className="h-auto bg-white border-b border-slate-100 flex items-center justify-between px-4 sm:px-6 md:px-7 py-3 md:py-4 flex-shrink-0 z-30 gap-3 md:gap-6">
      {/* Left: greeting/title */}
      <div className="flex-1 min-w-0">
        {isDashboard ? (
          <div>
            <h1 className="text-xl font-bold text-slate-800">
              {greetingText()}, {user?.username ?? 'Admin'}! 👋
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {routeSubtitles[pathname]}
            </p>
          </div>
        ) : (
          <div>
            <h1 className="text-xl font-bold text-slate-800 capitalize">
              {pathname === '/products' || pathname === '/medicines' ? 'Products' : pathname.replace('/', '')}
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {routeSubtitles[pathname] ?? ''}
            </p>
          </div>
        )}
      </div>

      {/* Search bar */}
      <div 
        onClick={() => setSearchOpen(true)}
        className="hidden md:flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 w-72 group focus-within:border-indigo-300 focus-within:bg-white transition-all cursor-pointer"
      >
        <Search className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-sm text-slate-400 min-w-0 text-left">Search everything...</span>
        <span className="text-[10px] text-slate-400 bg-slate-200 rounded px-1.5 py-0.5 font-mono flex-shrink-0">⌘K</span>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Live Cloud Sync Chip */}
        <Link
          to="/sync"
          title="Click to manage offline sync & cloud settings"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all text-xs font-semibold shadow-xs"
        >
          <span
            className={cn(
              "h-2 w-2 rounded-full",
              syncState.isSyncing || manualSyncing
                ? "bg-blue-500 animate-spin"
                : syncState.pendingCount > 0
                ? "bg-amber-500"
                : "bg-emerald-500"
            )}
          />
          <span className="hidden sm:inline text-slate-700">
            {syncState.isSyncing || manualSyncing
              ? "Syncing..."
              : syncState.pendingCount > 0
              ? `${syncState.pendingCount} Pending`
              : "Cloud Synced"}
          </span>
        </Link>

        {/* Manual Sync Fallback Button */}
        <button
          onClick={handleManualSync}
          disabled={manualSyncing || syncState.isSyncing}
          title="Manual Sync: Force sync all offline and cloud transactions now"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-700 transition-all text-xs font-semibold shadow-xs disabled:opacity-60 cursor-pointer active:scale-95"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5 transition-transform duration-500",
              (manualSyncing || syncState.isSyncing) && "animate-spin text-indigo-600"
            )}
          />
          <span className="hidden md:inline">
            {manualSyncing ? "Syncing..." : syncSuccessMsg || "Sync Now"}
          </span>
        </button>

        {/* Fullscreen toggle */}
        <button onClick={toggleFullScreen} className="w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all">
          <Maximize2 className="w-4 h-4" />
        </button>

        {/* Notification bell */}
        <div className="relative" ref={notifRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative w-9 h-9 rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 hover:border-slate-300 hover:bg-slate-50 transition-all"
          >
            <Bell className="w-4 h-4" />
            {alertCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-white text-[9px] font-bold flex items-center justify-center">
                {alertCount}
              </span>
            )}
          </button>
          
          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl overflow-hidden z-50">
              <div className="p-3 border-b border-slate-100 font-bold text-slate-800 flex items-center justify-between">
                <span>Alerts</span>
                <span className="text-xs font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{alertCount}</span>
              </div>
              <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                {alertCount === 0 ? (
                  <p className="text-center text-sm text-slate-500 py-6">All clear! No new alerts.</p>
                ) : (
                  <>
                    {lowStock.map((item: any) => (
                      <div key={'low'+item.name} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setShowNotifications(false); navigate('/inventory') }}>
                        <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center flex-shrink-0">
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-red-500 font-medium">Low stock: {item.left} left</p>
                        </div>
                      </div>
                    ))}
                    {expiring.map((item: any) => (
                      <div key={'exp'+item.name} className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => { setShowNotifications(false); navigate('/expiry') }}>
                        <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                          <Clock className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{item.name}</p>
                          <p className="text-xs text-amber-500 font-medium">{item.days}</p>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* New Sale CTA */}
        <Link to="/pos" className="flex-shrink-0" title="New Sale (POS)">
          <button
            className="flex items-center justify-center gap-1.5 sm:gap-2 rounded-xl px-2.5 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold text-white shadow-md sm:shadow-lg shadow-blue-500/25 transition-all hover:brightness-110 active:scale-95 whitespace-nowrap"
            style={{ backgroundColor: '#2563eb' }}
          >
            <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
            <span className="hidden sm:inline">New Sale</span>
            <span className="sm:hidden font-semibold">Sale</span>
          </button>
        </Link>
      </div>

      {/* Search Modal */}
      <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
        <DialogContent className="p-0 border-none shadow-2xl max-w-2xl bg-white overflow-hidden rounded-2xl">
          <Command className="w-full h-full flex flex-col bg-white">
            <div className="flex items-center border-b border-slate-100 px-3">
              <Search className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <Command.Input 
                placeholder="Search products, customers, or pages..." 
                className="flex-1 h-12 sm:h-14 bg-transparent outline-none border-none text-slate-700 placeholder:text-slate-400 px-3 text-sm sm:text-base focus:ring-0" 
              />
              <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 font-mono">ESC</span>
            </div>
            <Command.List className="max-h-[60vh] overflow-y-auto p-2">
              <Command.Empty className="py-6 text-center text-sm text-slate-500">No results found.</Command.Empty>
              
              <Command.Group heading="Pages" className="text-xs font-semibold text-slate-400 px-2 py-1.5 [&_[cmdk-group-heading]]:mb-2">
                {Object.entries(routeSubtitles)
                  .filter(([path]) => {
                    const role = user?.role || 'CASHIER'
                    if (role === 'ADMIN') return true
                    if (role === 'MANAGER') return !['/backup', '/users', '/settings'].includes(path)
                    return ['/dashboard', '/pos', '/products', '/customers'].includes(path)
                  })
                  .map(([path, desc]) => (
                  <Command.Item 
                    key={path} 
                    onSelect={() => { navigate(path); setSearchOpen(false) }}
                    className="flex items-center gap-3 p-2 rounded-lg cursor-pointer aria-selected:bg-indigo-50 aria-selected:text-indigo-700 text-slate-700 data-[selected=true]:bg-indigo-50 data-[selected=true]:text-indigo-700"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center flex-shrink-0">
                      <Search className="w-4 h-4 text-slate-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold capitalize">{path === '/products' || path === '/medicines' ? 'Products' : path.replace('/', '')}</p>
                      <p className="text-xs text-slate-400 truncate opacity-80">{desc}</p>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>

              {medicines && medicines.length > 0 && (
                <Command.Group heading="Products" className="text-xs font-semibold text-slate-400 px-2 py-1.5 mt-2 [&_[cmdk-group-heading]]:mb-2">
                  {medicines.map((m: any) => (
                    <Command.Item 
                      key={'med'+m.id} 
                      onSelect={() => { navigate('/products'); setSearchOpen(false) }}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer aria-selected:bg-sky-50 aria-selected:text-sky-700 text-slate-700 data-[selected=true]:bg-sky-50 data-[selected=true]:text-sky-700"
                    >
                      <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                        <Package className="w-4 h-4 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{m.name}</p>
                        <p className="text-xs opacity-80">{m.category?.name || 'Uncategorized'}</p>
                      </div>
                      <span className="text-sm font-bold opacity-90">₵{m.price.toFixed(2)}</span>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

              {customers && customers.length > 0 && (
                <Command.Group heading="Customers" className="text-xs font-semibold text-slate-400 px-2 py-1.5 mt-2 [&_[cmdk-group-heading]]:mb-2">
                  {customers.map((c: any) => (
                    <Command.Item 
                      key={'cus'+c.id} 
                      onSelect={() => { navigate('/customers'); setSearchOpen(false) }}
                      className="flex items-center gap-3 p-2 rounded-lg cursor-pointer aria-selected:bg-blue-50 aria-selected:text-blue-700 text-slate-700 data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700"
                    >
                      <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                        <User className="w-4 h-4 text-blue-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold">{c.name}</p>
                        <p className="text-xs opacity-80">{c.phone || 'No phone'}</p>
                      </div>
                    </Command.Item>
                  ))}
                </Command.Group>
              )}

            </Command.List>
          </Command>
        </DialogContent>
      </Dialog>
    </header>
  )
}
