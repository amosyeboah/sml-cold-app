import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from '@/components/common/Sidebar'
import TopBar from '@/components/common/TopBar'
import { useUIStore } from '@/store/uiStore'

export default function AppLayout() {
  const { pathname } = useLocation()
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)

  // POS and Reports have their own integrated headers — hide the shared one
  const hiddenTopBar = pathname === '/pos' || pathname === '/reports'

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      <Sidebar />
      <div
        className="flex flex-col flex-1 overflow-hidden transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: sidebarCollapsed ? '58px' : '185px' }}
      >
        {!hiddenTopBar && <TopBar />}
        <main className="flex-1 overflow-hidden relative">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
