import { useState, useMemo, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ShieldCheck,
  ShieldAlert,
  Search,
  Users,
  Check,
  CheckCircle2,
  RotateCcw,
  Sparkles,
  Lock,
  AlertCircle,
  Save,
  CheckCheck,
  Ban,
  User,
  ShoppingCart,
  Receipt,
  Package,
  Truck,
  BarChart3,
  Sliders,
  CheckSquare,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuthStore } from '@/store/authStore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ALL_PERMISSIONS,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
  CATEGORY_CONFIG,
  ADMIN_ONLY_PERMISSIONS,
  canUserAlterPermissions,
  parsePermissionsMap,
  SETTINGS_KEY_USER_PERMISSIONS,
  PermissionDefinition,
} from '@/services/permissions'
import { api } from '@/services/api'

interface UserPermissionsTabProps {
  storedSettings: Record<string, string>
}

export function UserPermissionsTab({ storedSettings }: UserPermissionsTabProps) {
  const queryClient = useQueryClient()
  const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

  // Currently logged-in user session
  const loggedInUser = useAuthStore((s) => s.user)
  const loggedInRole = (loggedInUser?.role || 'CASHIER').toUpperCase()
  const isCurrentAdmin = loggedInRole === 'ADMIN'

  // Fetch staff users
  const { data: users = [], isLoading: isLoadingUsers } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
  })

  // Selected user
  const [selectedUserId, setSelectedUserId] = useState<string>('')
  const [userSearchTerm, setUserSearchTerm] = useState('')
  const [permSearchTerm, setPermSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Local draft of permissions map: { [userIdOrUsername]: string[] }
  const [permissionsDraft, setPermissionsDraft] = useState<Record<string, string[]>>(() => {
    return parsePermissionsMap(storedSettings[SETTINGS_KEY_USER_PERMISSIONS])
  })

  // Synchronize draft when storedSettings updates externally (e.g. via realtime sync)
  useEffect(() => {
    setPermissionsDraft(parsePermissionsMap(storedSettings[SETTINGS_KEY_USER_PERMISSIONS]))
  }, [storedSettings[SETTINGS_KEY_USER_PERMISSIONS]])

  // Filtered users for left-side staff list
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const q = userSearchTerm.toLowerCase()
      return u.username.toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q)
    })
  }, [users, userSearchTerm])

  // Select first user if none selected
  const activeUser = useMemo(() => {
    if (selectedUserId) {
      const found = users.find((u) => u.id === selectedUserId || u.username === selectedUserId)
      if (found) return found
    }
    return users[0] || null
  }, [users, selectedUserId])

  const activeUserKey = activeUser?.id || activeUser?.username || ''
  const isSelectedAdmin = (activeUser?.role || '').toUpperCase() === 'ADMIN'

  // Check if active user is the currently logged-in actor
  const isSelf = Boolean(
    loggedInUser &&
    ((activeUser?.id && loggedInUser.id && String(activeUser.id) === String(loggedInUser.id)) ||
     (activeUser?.username && loggedInUser.username && activeUser.username.toLowerCase() === loggedInUser.username.toLowerCase()))
  )

  // Current active permissions for the selected user
  const currentUserPermissions = useMemo<string[]>(() => {
    if (!activeUser) return []
    if (isSelectedAdmin) {
      return ALL_PERMISSIONS.map((p) => p.id)
    }

    // Check if customized in draft
    if (activeUserKey && Array.isArray(permissionsDraft[activeUserKey])) {
      return permissionsDraft[activeUserKey]
    }
    if (activeUser.id && Array.isArray(permissionsDraft[activeUser.id])) {
      return permissionsDraft[activeUser.id]
    }
    if (activeUser.username && Array.isArray(permissionsDraft[activeUser.username])) {
      return permissionsDraft[activeUser.username]
    }

    // Fall back to stored settings
    const storedMap = parsePermissionsMap(storedSettings[SETTINGS_KEY_USER_PERMISSIONS])
    if (activeUserKey && Array.isArray(storedMap[activeUserKey])) {
      return storedMap[activeUserKey]
    }
    if (activeUser.id && Array.isArray(storedMap[activeUser.id])) {
      return storedMap[activeUser.id]
    }
    if (activeUser.username && Array.isArray(storedMap[activeUser.username])) {
      return storedMap[activeUser.username]
    }
    if (activeUser.username && Array.isArray(storedMap[activeUser.username.toLowerCase()])) {
      return storedMap[activeUser.username.toLowerCase()]
    }

    // Fall back to default role permissions
    const role = (activeUser.role || 'CASHIER').toUpperCase()
    return DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.CASHIER
  }, [activeUser, activeUserKey, isSelectedAdmin, permissionsDraft, storedSettings])

  // Privilege Guard: Check if the logged-in user can alter permissions for activeUser
  const alterationCheck = useMemo(() => {
    return canUserAlterPermissions(loggedInUser, activeUser, currentUserPermissions)
  }, [loggedInUser, activeUser, currentUserPermissions])

  const isAlterationBlocked = !alterationCheck.allowed

  // Check if active user has custom override
  const isCustomized = useMemo(() => {
    if (!activeUser || isSelectedAdmin) return false
    const storedMap = parsePermissionsMap(storedSettings[SETTINGS_KEY_USER_PERMISSIONS])
    const hasDraft =
      Boolean(activeUserKey && permissionsDraft[activeUserKey]) ||
      Boolean(activeUser.id && permissionsDraft[activeUser.id]) ||
      Boolean(activeUser.username && permissionsDraft[activeUser.username])
    const hasStored =
      Boolean(activeUserKey && storedMap[activeUserKey]) ||
      Boolean(activeUser.id && storedMap[activeUser.id]) ||
      Boolean(activeUser.username && storedMap[activeUser.username]) ||
      Boolean(activeUser.username && storedMap[activeUser.username.toLowerCase()])
    return hasDraft || hasStored
  }, [activeUser, activeUserKey, isSelectedAdmin, permissionsDraft, storedSettings])

  // Helper for category icon
  const getCategoryIcon = (catId: string, className = 'w-3.5 h-3.5') => {
    switch (catId) {
      case 'pos':
        return <ShoppingCart className={className} />
      case 'sales':
        return <Receipt className={className} />
      case 'inventory':
        return <Package className={className} />
      case 'purchases':
        return <Truck className={className} />
      case 'customers':
        return <Users className={className} />
      case 'reports':
        return <BarChart3 className={className} />
      case 'system':
      default:
        return <ShieldCheck className={className} />
    }
  }

  // Mutation to persist user permissions to settings
  const saveMutation = useMutation({
    mutationFn: async (updatedMap: Record<string, string[]>) => {
      if (isAlterationBlocked) {
        throw new Error(
          alterationCheck.reason ||
          'Cashiers and Managers cannot alter their own permissions to become Admin.'
        )
      }
      const payload = {
        [SETTINGS_KEY_USER_PERMISSIONS]: JSON.stringify(updatedMap),
      }
      return await apiClient.setSetting(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
    onError: (err: any) => {
      const msg = err?.message || 'Failed to save user permissions. Please try again.'
      toast.error(msg)
      setFeedback({
        type: 'error',
        message: msg,
      })
    },
  })

  // Toggle single permission
  const handleTogglePermission = (permId: string) => {
    if (!activeUser || isSelectedAdmin) return

    // Privilege Escalation Prevention
    if (isAlterationBlocked) {
      toast.error(
        alterationCheck.reason ||
        'Access Denied: Cashiers and Managers cannot alter their own permissions to become Admin.'
      )
      return
    }

    const willGrant = !currentUserPermissions.includes(permId)

    // Non-admins cannot grant admin-only privileges
    if (!isCurrentAdmin && willGrant && ADMIN_ONLY_PERMISSIONS.includes(permId)) {
      toast.error('Privilege Protection: Only an Administrator can grant administrative permissions.')
      return
    }

    const currentSet = new Set(currentUserPermissions)
    const targetPerm = ALL_PERMISSIONS.find((p) => p.id === permId)
    const permName = targetPerm?.name || permId
    const userName = activeUser.username || 'user'

    if (currentSet.has(permId)) {
      currentSet.delete(permId)
      toast(`Revoked "${permName}" from ${userName}.`, {
        id: `perm-${permId}`,
        icon: '🔒',
        duration: 3500,
      })
      setFeedback({
        type: 'success',
        message: `Revoked permission "${permName}" from ${userName}.`,
      })
    } else {
      currentSet.add(permId)
      toast.success(`Granted "${permName}" to ${userName}!`, {
        id: `perm-${permId}`,
        icon: '✅',
        duration: 3500,
      })
      setFeedback({
        type: 'success',
        message: `Granted permission "${permName}" to ${userName} successfully.`,
      })
    }

    const updatedList = Array.from(currentSet)
    const updatedMap = {
      ...permissionsDraft,
      [activeUserKey]: updatedList,
    }

    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)
  }

  // Quick action: Grant all
  const handleGrantAll = () => {
    if (!activeUser || isSelectedAdmin) return

    if (isAlterationBlocked) {
      toast.error(alterationCheck.reason || 'Cashiers and Managers cannot alter their own permissions.')
      return
    }
    if (!isCurrentAdmin) {
      toast.error('Only an Administrator has authority to grant master access.')
      return
    }

    const allIds = ALL_PERMISSIONS.map((p) => p.id)
    const updatedMap = {
      ...permissionsDraft,
      [activeUserKey]: allIds,
    }
    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)

    const userName = activeUser.username || 'user'
    toast.success(`Granted all ${allIds.length} permissions to ${userName}!`, {
      icon: '✨',
      duration: 4000,
    })
    setFeedback({
      type: 'success',
      message: `Granted all permissions to ${userName} successfully.`,
    })
  }

  // Quick action: Revoke all
  const handleRevokeAll = () => {
    if (!activeUser || isSelectedAdmin) return

    if (isAlterationBlocked) {
      toast.error(alterationCheck.reason || 'Cashiers and Managers cannot alter their own permissions.')
      return
    }

    const updatedMap = {
      ...permissionsDraft,
      [activeUserKey]: [],
    }
    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)

    const userName = activeUser.username || 'user'
    toast(`Revoked all optional permissions from ${userName}.`, {
      icon: '🚫',
      duration: 4000,
    })
    setFeedback({
      type: 'success',
      message: `Revoked all optional permissions from ${userName}.`,
    })
  }

  // Quick action: Reset to role default
  const handleResetToDefault = () => {
    if (!activeUser || isSelectedAdmin) return

    if (isAlterationBlocked) {
      toast.error(alterationCheck.reason || 'Cashiers and Managers cannot alter their own permissions.')
      return
    }

    const updatedMap = { ...permissionsDraft }
    delete updatedMap[activeUserKey]
    if (activeUser.id) delete updatedMap[String(activeUser.id)]
    if (activeUser.username) {
      delete updatedMap[activeUser.username]
      delete updatedMap[activeUser.username.toLowerCase()]
    }
    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)

    const userName = activeUser.username || 'user'
    toast.success(`Reset permissions to standard ${activeUser.role} baseline for ${userName}.`, {
      icon: '🔄',
      duration: 4000,
    })
    setFeedback({
      type: 'success',
      message: `Permissions reset to standard ${activeUser.role} defaults for ${userName}.`,
    })
  }

  // Quick action: Grant all in specific category
  const handleGrantCategory = (category: string) => {
    if (!activeUser || isSelectedAdmin) return

    if (isAlterationBlocked) {
      toast.error(alterationCheck.reason || 'Cashiers and Managers cannot alter their own permissions.')
      return
    }

    const catConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
    const categoryPerms = ALL_PERMISSIONS.filter((p) => p.category === category)
    const assignablePerms = isCurrentAdmin
      ? categoryPerms
      : categoryPerms.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p.id))

    const currentSet = new Set(currentUserPermissions)
    assignablePerms.forEach((p) => currentSet.add(p.id))

    const updatedMap = {
      ...permissionsDraft,
      [activeUserKey]: Array.from(currentSet),
    }
    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)

    const userName = activeUser.username || 'user'
    const catName = catConfig?.name || category
    toast.success(`Granted all ${catName} permissions to ${userName}!`, {
      icon: '✅',
      duration: 3500,
    })
    setFeedback({
      type: 'success',
      message: `Granted all ${catName} permissions to ${userName}.`,
    })
  }

  // Quick action: Revoke all in specific category
  const handleRevokeCategory = (category: string) => {
    if (!activeUser || isSelectedAdmin) return

    if (isAlterationBlocked) {
      toast.error(alterationCheck.reason || 'Cashiers and Managers cannot alter their own permissions.')
      return
    }

    const catConfig = CATEGORY_CONFIG[category as keyof typeof CATEGORY_CONFIG]
    const categoryPermIds = new Set(ALL_PERMISSIONS.filter((p) => p.category === category).map((p) => p.id))
    const updatedList = currentUserPermissions.filter((id) => !categoryPermIds.has(id))

    const updatedMap = {
      ...permissionsDraft,
      [activeUserKey]: updatedList,
    }
    setPermissionsDraft(updatedMap)
    saveMutation.mutate(updatedMap)

    const userName = activeUser.username || 'user'
    const catName = catConfig?.name || category
    toast(`Revoked all ${catName} permissions from ${userName}.`, {
      icon: '🔒',
      duration: 3500,
    })
    setFeedback({
      type: 'success',
      message: `Revoked all ${catName} permissions from ${userName}.`,
    })
  }

  // Filtered permissions list based on search and selected category tab
  const displayedCategories = useMemo(() => {
    return PERMISSION_CATEGORIES.filter((cat) => {
      if (selectedCategory !== 'all' && cat.id !== selectedCategory) return false
      return true
    })
  }, [selectedCategory])

  const getFilteredPermissionsForCategory = (catId: string) => {
    return ALL_PERMISSIONS.filter((p) => {
      if (p.category !== catId) return false
      if (!permSearchTerm) return true
      const q = permSearchTerm.toLowerCase()
      return p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q) || p.id.toLowerCase().includes(q)
    })
  }

  const getRiskBadge = (risk: PermissionDefinition['riskLevel']) => {
    switch (risk) {
      case 'high':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-rose-700 ring-1 ring-rose-200">
            <ShieldAlert className="w-2.5 h-2.5" /> High Risk
          </span>
        )
      case 'medium':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700 ring-1 ring-amber-200">
            Medium
          </span>
        )
      case 'low':
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-600">
            Standard
          </span>
        )
    }
  }

  const getRoleBadgeStyle = (role: string) => {
    switch (role?.toUpperCase()) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
      case 'MANAGER':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      case 'CASHIER':
      default:
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
    }
  }

  return (
    <div className="space-y-4">
      {/* ── Feedback Notification Banner ─────────────────────────────────── */}
      {feedback && (
        <div
          className={`p-4 rounded-xl text-xs font-semibold flex items-center justify-between gap-3 border shadow-xs transition-all animate-in fade-in duration-200 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span className="leading-snug">{feedback.message}</span>
          </div>
          <button
            onClick={() => setFeedback(null)}
            className="text-[10px] uppercase tracking-wider opacity-60 hover:opacity-100 cursor-pointer font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* ── Main Two-Column Layout ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT: Staff User Selector ───────────────────────────────── */}
        <div className="lg:col-span-4 space-y-3">
          <Card className="border-slate-200 shadow-xs">
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-blue-600" />
                    Staff Accounts ({users.length})
                  </CardTitle>
                  <CardDescription className="text-xs text-slate-500">
                    Select a staff member to configure permissions
                  </CardDescription>
                </div>
              </div>
              <div className="relative mt-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <Input
                  value={userSearchTerm}
                  onChange={(e) => setUserSearchTerm(e.target.value)}
                  placeholder="Filter staff by name or role..."
                  className="pl-8 h-8 text-xs bg-slate-50 border-slate-200"
                />
              </div>
            </CardHeader>

            <CardContent className="p-2 space-y-1 max-h-[520px] overflow-y-auto">
              {isLoadingUsers ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading staff accounts...</div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  No staff accounts match &ldquo;{userSearchTerm}&rdquo;
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const isSelected = activeUser?.id === u.id || activeUser?.username === u.username
                  const isAdminUser = (u.role || '').toUpperCase() === 'ADMIN'
                  const userKey = u.id || u.username
                  const hasCustom = !isAdminUser && Boolean(permissionsDraft[userKey])
                  const isItemSelf = Boolean(
                    loggedInUser &&
                    ((u.id && loggedInUser.id && String(u.id) === String(loggedInUser.id)) ||
                     (u.username && loggedInUser.username && u.username.toLowerCase() === loggedInUser.username.toLowerCase()))
                  )

                  // Count granted permissions for preview
                  const grantedCount = isAdminUser
                    ? ALL_PERMISSIONS.length
                    : Array.isArray(permissionsDraft[userKey])
                    ? permissionsDraft[userKey].length
                    : (DEFAULT_ROLE_PERMISSIONS[u.role?.toUpperCase()] || DEFAULT_ROLE_PERMISSIONS.CASHIER).length

                  return (
                    <button
                      key={u.id || u.username}
                      onClick={() => setSelectedUserId(u.id || u.username)}
                      className={`w-full text-left p-2.5 rounded-xl transition-all flex items-center justify-between gap-2.5 cursor-pointer border ${
                        isSelected
                          ? 'bg-blue-50/70 border-blue-300 shadow-xs'
                          : 'bg-white hover:bg-slate-50 border-transparent hover:border-slate-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div
                          className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAdminUser
                              ? 'bg-purple-100 text-purple-700'
                              : u.role === 'MANAGER'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-blue-100 text-blue-700'
                          }`}
                        >
                          {u.username?.slice(0, 2).toUpperCase() || <User className="w-4 h-4" />}
                        </div>

                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-xs text-slate-800 truncate block">
                              {u.username}
                            </span>
                            {isItemSelf && (
                              <span className="rounded-full bg-blue-100 text-blue-800 text-[9px] px-1.5 py-0.2 font-bold ring-1 ring-blue-300">
                                You
                              </span>
                            )}
                            {hasCustom && (
                              <span className="rounded-full bg-cyan-100 text-cyan-800 text-[9px] px-1.5 py-0.1 font-bold">
                                Custom
                              </span>
                            )}
                          </div>
                          <span
                            className={`inline-block mt-0.5 text-[9px] font-bold px-1.5 py-0.2 rounded ${getRoleBadgeStyle(
                              u.role
                            )}`}
                          >
                            {u.role}
                          </span>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[11px] font-mono font-semibold text-slate-700 block">
                          {grantedCount}/{ALL_PERMISSIONS.length}
                        </span>
                        <span className="text-[9px] text-slate-400">Granted</span>
                      </div>
                    </button>
                  )
                })
              )}
            </CardContent>
          </Card>

          {/* Role Baseline Guide */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2 text-xs">
            <span className="font-bold text-[10px] uppercase tracking-wider text-slate-500 block">
              Default Permission Guidelines:
            </span>
            <ul className="space-y-1.5 text-slate-600 text-[11px]">
              <li className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-500 mt-1 shrink-0" />
                <span>
                  <strong>ADMIN:</strong> Master administrative authority over all store functions, settings, and data.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
                <span>
                  <strong>MANAGER:</strong> Operational authority over stock, inventory, purchases, and business reports.
                </span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
                <span>
                  <strong>CASHIER:</strong> Checkout register and sales history. Privileged operations require admin authorization.
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* ── RIGHT: Permissions Manager Panel ───────────────────────── */}
        <div className="lg:col-span-8 space-y-4">
          {activeUser ? (
            <Card className="border-slate-200 shadow-xs">
              {/* Active User Header Banner */}
              <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${
                        isSelectedAdmin
                          ? 'bg-purple-100 text-purple-700'
                          : activeUser.role === 'MANAGER'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-blue-100 text-blue-700'
                      }`}
                    >
                      {activeUser.username?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base font-bold text-slate-800">
                          {activeUser.username}
                        </CardTitle>
                        {isSelf && (
                          <span className="text-[10px] font-bold bg-blue-50 text-blue-700 ring-1 ring-blue-300 px-2 py-0.5 rounded-full">
                            Logged-In Account
                          </span>
                        )}
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getRoleBadgeStyle(
                            activeUser.role
                          )}`}
                        >
                          {activeUser.role}
                        </span>
                        {isCustomized && (
                          <span className="text-[10px] font-bold bg-cyan-50 text-cyan-700 ring-1 ring-cyan-200 px-2 py-0.5 rounded-full">
                            Custom Permissions Active
                          </span>
                        )}
                      </div>
                      <CardDescription className="text-xs text-slate-500 mt-0.5">
                        {isSelectedAdmin
                          ? 'Super Admin accounts have full permissions across all modules by default.'
                          : `Currently granting ${currentUserPermissions.length} of ${ALL_PERMISSIONS.length} privileges.`}
                      </CardDescription>
                    </div>
                  </div>

                  {/* Quick Action Presets (Grant All, Revoke All, Reset) */}
                  {!isSelectedAdmin && (
                    <div className="flex flex-wrap items-center gap-1.5 shrink-0 self-start sm:self-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleGrantAll}
                        disabled={saveMutation.isPending || isAlterationBlocked}
                        className={`h-7 text-xs px-2.5 gap-1 text-emerald-700 border-emerald-200 hover:bg-emerald-50 cursor-pointer ${
                          isAlterationBlocked ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title={
                          isAlterationBlocked
                            ? alterationCheck.reason
                            : 'Grant all permissions to this user'
                        }
                      >
                        <CheckCheck className="w-3 h-3 text-emerald-600" /> Grant All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleRevokeAll}
                        disabled={saveMutation.isPending || isAlterationBlocked}
                        className={`h-7 text-xs px-2.5 gap-1 text-rose-700 border-rose-200 hover:bg-rose-50 cursor-pointer ${
                          isAlterationBlocked ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title={
                          isAlterationBlocked
                            ? alterationCheck.reason
                            : 'Revoke all optional permissions'
                        }
                      >
                        <Ban className="w-3 h-3 text-rose-600" /> Revoke All
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleResetToDefault}
                        disabled={saveMutation.isPending || isAlterationBlocked}
                        className={`h-7 text-xs px-2.5 gap-1 text-slate-700 border-slate-200 hover:bg-slate-100 cursor-pointer ${
                          isAlterationBlocked ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                        title={
                          isAlterationBlocked
                            ? alterationCheck.reason
                            : 'Reset permissions to standard role default'
                        }
                      >
                        <RotateCcw className="w-3 h-3 text-slate-500" /> Reset to Role
                      </Button>
                    </div>
                  )}
                </div>

                {/* ── Security Privilege Escalation Warning Banner ────────── */}
                {isAlterationBlocked && (
                  <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50/90 p-3 text-xs flex items-start gap-3 text-amber-900 shadow-xs animate-in fade-in">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-950 flex items-center gap-1.5">
                        Privilege Protection Active
                        {isSelf && (
                          <span className="bg-amber-200 text-amber-900 text-[9px] px-1.5 py-0.2 rounded-full font-bold">
                            Self-Alteration Prohibited
                          </span>
                        )}
                      </p>
                      <p className="text-amber-800 text-[11px] leading-relaxed">
                        {alterationCheck.reason ||
                          'Cashiers and Managers cannot alter their own permissions or escalate privileges to become Admin.'}
                      </p>
                    </div>
                  </div>
                )}

                {/* ── Search & Category Filter Tabs (With Distinct Color Themes) ── */}
                <div className="pt-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                  {/* Category Pills */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      onClick={() => setSelectedCategory('all')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                        selectedCategory === 'all'
                          ? 'bg-slate-900 text-white shadow-xs'
                          : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      All ({ALL_PERMISSIONS.length})
                    </button>
                    {PERMISSION_CATEGORIES.map((cat) => {
                      const count = ALL_PERMISSIONS.filter((p) => p.category === cat.id).length
                      const config = CATEGORY_CONFIG[cat.id]
                      const isCatSelected = selectedCategory === cat.id

                      return (
                        <button
                          key={cat.id}
                          onClick={() => setSelectedCategory(cat.id)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                            isCatSelected
                              ? config.tabActive
                              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {!isCatSelected && (
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: config.accentColor }}
                            />
                          )}
                          {getCategoryIcon(cat.id, 'w-3 h-3 shrink-0')}
                          <span>{config.shortName}</span>
                          <span
                            className={`text-[10px] px-1 py-0.1 rounded font-bold ${
                              isCatSelected
                                ? 'bg-white/20 text-white'
                                : `${config.badgeBg} ${config.badgeText}`
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      )
                    })}
                  </div>

                  {/* Search inside permissions */}
                  <div className="relative w-full sm:w-48 shrink-0">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <Input
                      value={permSearchTerm}
                      onChange={(e) => setPermSearchTerm(e.target.value)}
                      placeholder="Search privilege..."
                      className="pl-8 h-8 text-xs bg-white border-slate-200"
                    />
                  </div>
                </div>
              </CardHeader>

              {/* Permissions List Grouped by Category with Rich Color Distinction */}
              <CardContent className="p-4 space-y-6">
                {isSelectedAdmin ? (
                  <div className="p-8 text-center bg-purple-50/60 rounded-xl border border-purple-200 space-y-2">
                    <Lock className="w-8 h-8 text-purple-600 mx-auto" />
                    <h4 className="font-bold text-sm text-purple-900">Full Master Access Granted</h4>
                    <p className="text-xs text-purple-700 max-w-md mx-auto">
                      Accounts with the <strong>ADMIN</strong> role hold unrestricted master authority over all store functions, databases, and financial audit logs to prevent administrative lockout.
                    </p>
                  </div>
                ) : (
                  displayedCategories.map((category) => {
                    const categoryPerms = getFilteredPermissionsForCategory(category.id)
                    if (categoryPerms.length === 0) return null

                    const config = CATEGORY_CONFIG[category.id]
                    const enabledCount = categoryPerms.filter((p) =>
                      currentUserPermissions.includes(p.id)
                    ).length
                    const allGrantedInCategory = categoryPerms.every((p) =>
                      currentUserPermissions.includes(p.id)
                    )

                    return (
                      <div
                        key={category.id}
                        className="space-y-3 p-3.5 rounded-2xl border transition-all"
                        style={{
                          borderColor: config.accentColor + '30',
                          backgroundColor: config.accentColor + '04',
                        }}
                      >
                        {/* ── Category Header with Distinct Visual Accent ── */}
                        <div
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b"
                          style={{ borderColor: config.accentColor + '22' }}
                        >
                          <div className="flex items-center gap-2.5">
                            <div
                              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 shadow-2xs"
                              style={{
                                backgroundColor: config.accentColor + '18',
                                color: config.accentColor,
                              }}
                            >
                              {getCategoryIcon(category.id, 'w-4 h-4')}
                            </div>
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4
                                  className="font-bold text-xs uppercase tracking-wider"
                                  style={{ color: config.accentColor }}
                                >
                                  {category.name}
                                </h4>
                                <span
                                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
                                >
                                  {enabledCount}/{categoryPerms.length} enabled
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-500 mt-0.5">
                                {category.description}
                              </p>
                            </div>
                          </div>

                          {/* Quick Grant/Revoke in Category */}
                          {!isAlterationBlocked && (
                            <div className="flex items-center gap-1.5 text-[11px] self-end sm:self-auto shrink-0">
                              {allGrantedInCategory ? (
                                <button
                                  onClick={() => handleRevokeCategory(category.id)}
                                  className="text-rose-600 hover:text-rose-700 font-semibold underline cursor-pointer"
                                  title={`Revoke all ${config.shortName} permissions`}
                                >
                                  Revoke Category
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleGrantCategory(category.id)}
                                  className="font-semibold underline cursor-pointer"
                                  style={{ color: config.accentColor }}
                                  title={`Grant all ${config.shortName} permissions`}
                                >
                                  Grant Category
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* ── Category Items Grid with Category-Colored Accents ── */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                          {categoryPerms.map((perm) => {
                            const isGranted = currentUserPermissions.includes(perm.id)
                            const isAdminOnly = ADMIN_ONLY_PERMISSIONS.includes(perm.id)

                            return (
                              <div
                                key={perm.id}
                                onClick={() => {
                                  if (isAlterationBlocked) {
                                    toast.error(
                                      alterationCheck.reason ||
                                      'Cashiers and Managers cannot alter their own permissions to become Admin.'
                                    )
                                    return
                                  }
                                  handleTogglePermission(perm.id)
                                }}
                                className={`p-3 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                                  isAlterationBlocked
                                    ? 'cursor-not-allowed opacity-65 bg-white border-slate-200'
                                    : 'cursor-pointer'
                                } ${
                                  isGranted
                                    ? `${config.lightBg} shadow-xs`
                                    : 'bg-white border-slate-200 hover:border-slate-300 opacity-80 hover:opacity-100'
                                }`}
                                style={{
                                  borderColor: isGranted ? config.accentColor + '55' : undefined,
                                }}
                              >
                                <div className="space-y-1 min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span
                                      className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider border ${config.badgeBg} ${config.badgeText} ${config.badgeBorder}`}
                                    >
                                      {config.shortName}
                                    </span>
                                    <span className="font-bold text-xs text-slate-800">
                                      {perm.name}
                                    </span>
                                    {getRiskBadge(perm.riskLevel)}
                                    {isAdminOnly && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.2 rounded">
                                        <Lock className="w-2.5 h-2.5" /> Admin Only
                                      </span>
                                    )}
                                  </div>
                                  <p className="text-[11px] text-slate-500 leading-snug">
                                    {perm.description}
                                  </p>
                                  <span className="font-mono text-[9px] text-slate-400 block pt-0.5">
                                    {perm.id}
                                  </span>
                                </div>

                                {/* Custom Toggle Button Styled with Category Color */}
                                <div className="shrink-0 pt-0.5">
                                  <div
                                    className={`relative inline-flex h-5 w-9 shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 ${
                                      isAlterationBlocked ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                                    } ${!isGranted ? 'bg-slate-200' : ''}`}
                                    style={{
                                      backgroundColor: isGranted ? config.accentColor : undefined,
                                    }}
                                  >
                                    <span
                                      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                        isGranted ? 'translate-x-4' : 'translate-x-0'
                                      }`}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
              <Users className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-semibold text-slate-700">No staff account selected</p>
              <p className="text-xs text-slate-400 mt-1">
                Select a user from the list on the left to configure permissions.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
