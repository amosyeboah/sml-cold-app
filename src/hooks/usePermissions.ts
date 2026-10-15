import { useQuery } from '@tanstack/react-query'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/services/api'
import {
  resolveUserPermissions,
  checkUserPermission,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from '@/services/permissions'

export function usePermissions() {
  const user = useAuthStore((s) => s.user)

  const { data: settings = {} } = useQuery<Record<string, string>>({
    queryKey: ['settings'],
    queryFn: () => {
      if (typeof window !== 'undefined' && window.api?.getSettings) {
        return window.api.getSettings()
      }
      return api.getSettings()
    },
    staleTime: 30000,
  })

  const permissions = resolveUserPermissions(user, settings)
  const role = (user?.role || 'CASHIER').toUpperCase()
  const isAdmin = role === 'ADMIN'
  const isManager = role === 'MANAGER'
  const isCashier = role === 'CASHIER'

  const hasPermission = (permissionId: string): boolean => {
    return checkUserPermission(user, permissionId, settings)
  }

  return {
    user,
    role,
    isAdmin,
    isManager,
    isCashier,
    permissions,
    hasPermission,
    allPermissions: ALL_PERMISSIONS,
    defaultRolePermissions: DEFAULT_ROLE_PERMISSIONS,
  }
}
