import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { usePermissions } from '@/hooks/usePermissions'

interface RoleGuardProps {
  allowedRoles?: string[]
  requiredPermission?: string
  children: JSX.Element
}

export function RoleGuard({ allowedRoles, requiredPermission, children }: RoleGuardProps) {
  const user = useAuthStore((s) => s.user)
  const role = (user?.role || 'CASHIER').toUpperCase()
  const { hasPermission } = usePermissions()

  // Admin / Store Owner always has full access
  if (role === 'ADMIN') {
    return children
  }

  // Check granular permission first if specified
  if (requiredPermission && hasPermission(requiredPermission)) {
    return children
  }

  // Check role-based access if allowedRoles provided
  if (allowedRoles && allowedRoles.includes(role)) {
    return children
  }

  const fallback = role === 'CASHIER' ? '/pos' : '/dashboard'
  return <Navigate to={fallback} replace />
}
