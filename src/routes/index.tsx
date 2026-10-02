import { createHashRouter, Navigate } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import AppLayout from '@/layouts/AppLayout'
import AuthLayout from '@/layouts/AuthLayout'
import LoginPage from '@/pages/Login'
import Dashboard from '@/pages/Dashboard'
import POS from '@/pages/POS'
import SalesHistory from '@/pages/SalesHistory'
import Medicines from '@/pages/Medicines'
import Inventory from '@/pages/Inventory'
import Purchases from '@/pages/Purchases'
import Suppliers from '@/pages/Suppliers'

import Customers from '@/pages/Customers'
import Expiry from '@/pages/Expiry'
import Reports from '@/pages/Reports'
import Backup from '@/pages/Backup'
import BatchTracking from '@/pages/BatchTracking'
import Users from '@/pages/Users'
import Settings from '@/pages/Settings'
import Categories from '@/pages/Categories'
import AuditTrail from '@/pages/Audit'
import SyncPage from '@/pages/Sync'
import { isCloudHosting } from '@/services/api/hubClient'

import { RoleGuard } from './RoleGuard'

export const router = createHashRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <Navigate to="/dashboard" replace /> },
          { path: 'dashboard', element: <Dashboard /> },
          { path: 'pos', element: isCloudHosting() ? <Navigate to="/dashboard" replace /> : <POS /> },
          { path: 'sales-history', element: <SalesHistory /> },
          { path: 'products', element: <Medicines /> },
          { path: 'medicines', element: <Navigate to="/products" replace /> },
          { path: 'inventory', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Inventory /></RoleGuard> },
          { path: 'purchases', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Purchases /></RoleGuard> },
          { path: 'suppliers', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Suppliers /></RoleGuard> },
          { path: 'customers', element: <Customers /> },
          { path: 'prescriptions', element: <Navigate to="/pos" replace /> },
          { path: 'categories', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Categories /></RoleGuard> },
          { path: 'expiry', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Expiry /></RoleGuard> },
          { path: 'reports', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><Reports /></RoleGuard> },
          { path: 'audit', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><AuditTrail /></RoleGuard> },
          { path: 'sync', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><SyncPage /></RoleGuard> },
          { path: 'batches', element: <RoleGuard allowedRoles={['ADMIN', 'MANAGER']}><BatchTracking /></RoleGuard> },
          { path: 'backup', element: <RoleGuard allowedRoles={['ADMIN']}><Backup /></RoleGuard> },
          { path: 'users', element: <RoleGuard allowedRoles={['ADMIN']}><Users /></RoleGuard> },
          { path: 'settings', element: <RoleGuard allowedRoles={['ADMIN']}><Settings /></RoleGuard> },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/dashboard" replace /> },
])
