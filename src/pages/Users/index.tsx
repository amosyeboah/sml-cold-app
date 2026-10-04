import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusCircle, Search, Edit2, Trash2, ChevronLeft, ChevronRight, Shield, UserCheck, ShoppingCart, KeyRound } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { api } from '@/services/api'

const userSchema = z.object({
  id: z.string().optional(),
  username: z.string().min(3, 'Username must be at least 3 characters'),
  passwordHash: z.string().optional(),
  pin: z.string().optional(),
  role: z.enum(['ADMIN', 'MANAGER', 'CASHIER']),
})
type UserFormData = z.infer<typeof userSchema>

const ITEMS_PER_PAGE = 15

export default function Users() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any>(null)
  const [userToDelete, setUserToDelete] = useState<any>(null)
  const [currentPage, setCurrentPage] = useState(1)

  const apiClient = typeof window !== 'undefined' && window.api ? window.api : api

  const { data: users = [], isLoading } = useQuery<any[]>({
    queryKey: ['users'],
    queryFn: () => apiClient.getUsers(),
  })

  const createUserMutation = useMutation({
    mutationFn: (data: UserFormData) => apiClient.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
  })

  const updateUserMutation = useMutation({
    mutationFn: (data: UserFormData) => apiClient.updateUser(data.id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      closeModal()
    },
  })

  const deleteUserMutation = useMutation({
    mutationFn: (id: string) => apiClient.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setIsDeleteDialogOpen(false)
      setUserToDelete(null)
    },
  })

  const { register, handleSubmit, reset, setValue, formState: { errors } } = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
  })

  const onSubmit = (data: UserFormData) => {
    const payload = { ...data }
    if (editingUser) {
      if (!payload.passwordHash) delete payload.passwordHash
      if (!payload.pin) delete payload.pin
      updateUserMutation.mutate(payload)
    } else {
      if (!payload.passwordHash) {
        alert('Password is required for new users')
        return
      }
      createUserMutation.mutate(payload)
    }
  }

  const openEditModal = (user: any) => {
    setEditingUser(user)
    setValue('id', user.id)
    setValue('username', user.username)
    setValue('role', user.role)
    setValue('passwordHash', '')
    setValue('pin', user.pin || '')
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setEditingUser(null)
    reset()
  }

  const openDeleteModal = (user: any) => {
    setUserToDelete(user)
    setIsDeleteDialogOpen(true)
  }

  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.role.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE)

  const totalUsers = users.length
  const adminCount = users.filter((u) => u.role === 'ADMIN').length
  const managerCount = users.filter((u) => u.role === 'MANAGER').length
  const cashierCount = users.filter((u) => u.role === 'CASHIER').length

  const getInitials = (username: string) =>
    username
      .split('.')
      .map((word) => word[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-50 text-purple-700 ring-1 ring-purple-200'
      case 'MANAGER':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-200'
      case 'CASHIER':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-200'
      default:
        return 'bg-gray-50 text-gray-700 ring-1 ring-gray-200'
    }
  }

  const getRoleDotColor = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-purple-500'
      case 'MANAGER':
        return 'bg-amber-500'
      case 'CASHIER':
        return 'bg-blue-500'
      default:
        return 'bg-gray-500'
    }
  }

  const getAvatarGradient = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-gradient-to-br from-purple-500 to-indigo-600'
      case 'MANAGER':
        return 'bg-gradient-to-br from-amber-500 to-orange-600'
      case 'CASHIER':
      default:
        return 'bg-gradient-to-br from-blue-500 to-cyan-600'
    }
  }

  return (
    <div className="h-full overflow-y-auto p-3.5 sm:p-5 space-y-4 font-sans bg-slate-50">
      <div className="relative overflow-hidden rounded-2xl border border-blue-200 p-3 sm:p-3.5 md:py-3 md:px-4 text-white shadow-xs" style={{ backgroundColor: '#2563eb' }}>
        <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-cyan-300/20 blur-2xl pointer-events-none" />
        <div className="absolute -bottom-12 left-10 h-28 w-28 rounded-full bg-violet-300/20 blur-2xl pointer-events-none" />
        <div className="absolute right-14 top-10 h-20 w-20 rounded-full border border-white/20 bg-white/5 pointer-events-none" />

        <div className="relative flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center rounded-full border border-white/20 bg-white/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.2em] text-sky-100">
                Access control
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                3 Tier Roles
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold leading-tight">Staff Accounts &amp; Permissions</h2>
          </div>
          <div className="grid grid-cols-4 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-white/10 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] uppercase tracking-wider text-blue-100 font-medium">Total</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{totalUsers}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-violet-400/20 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] uppercase tracking-wider text-violet-100 font-medium">Admin</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{adminCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-amber-400/20 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] uppercase tracking-wider text-amber-100 font-medium">Manager</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{managerCount}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-emerald-400/20 px-2.5 py-1.5 backdrop-blur">
              <p className="text-[9px] uppercase tracking-wider text-emerald-100 font-medium">Cashier</p>
              <p className="text-base sm:text-lg font-bold mt-0.5">{cashierCount}</p>
            </div>
          </div>
        </div>
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-6">
          <div className="mb-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Operator Accounts</h2>
              <p className="text-sm text-slate-500">Configure credentials and permission level for each staff member.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Search staff or role..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value)
                    setCurrentPage(1)
                  }}
                  className="border-slate-200 bg-slate-50 pl-9"
                />
              </div>
              <Button
                onClick={() => {
                  reset()
                  setEditingUser(null)
                  setIsOpen(true)
                }}
                className="gap-2 text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                <PlusCircle className="w-4 h-4" /> Add Staff Member
              </Button>
            </div>
          </div>

          <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Edit Staff Member' : 'Add Staff Member'}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2 font-sans">
                <div className="space-y-1.5">
                  <Label>Username</Label>
                  <Input {...register('username')} placeholder="e.g. k.boateng" />
                  {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Password {editingUser && <span className="text-gray-400 font-normal">(Leave blank to keep current)</span>}</Label>
                  <Input type="password" {...register('passwordHash')} placeholder="••••••••" />
                  {errors.passwordHash && <p className="text-xs text-red-500">{errors.passwordHash.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>4-Digit PIN {editingUser && <span className="text-gray-400 font-normal">(Leave blank to keep current)</span>}</Label>
                  <Input type="text" maxLength={4} {...register('pin')} placeholder="e.g. 1234" />
                  {errors.pin && <p className="text-xs text-red-500">{errors.pin.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label>Authorization Role</Label>
                  <select
                    {...register('role')}
                    className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="CASHIER">Cashier (POS Checkout & Daily Shift)</option>
                    <option value="MANAGER">Store Manager (Inventory, Orders & Audits)</option>
                    <option value="ADMIN">System Admin (Full Unrestricted Access)</option>
                  </select>
                  {errors.role && <p className="text-xs text-red-500">{errors.role.message}</p>}
                </div>

                <Button type="submit" className="mt-4 w-full text-white" style={{ backgroundColor: '#2563eb' }}>
                  {editingUser ? 'Update Staff Member' : 'Save Staff Member'}
                </Button>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Confirm Deletion</DialogTitle>
              </DialogHeader>
              <div className="py-4">
                <p className="text-gray-600">Are you sure you want to delete user <strong>{userToDelete?.username}</strong>? This action cannot be undone.</p>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={() => deleteUserMutation.mutate(userToDelete?.id)}>Delete</Button>
              </div>
            </DialogContent>
          </Dialog>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
            </div>
          ) : (
            <div className="max-h-[min(60vh,560px)] overflow-x-auto overflow-y-auto rounded-xl border border-slate-200">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50">
                    <TableHead className="text-slate-700">Username</TableHead>
                    <TableHead className="text-slate-700">Authorization Role</TableHead>
                    <TableHead className="text-slate-700">Created Date</TableHead>
                    <TableHead className="text-center text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedUsers.map((u) => (
                    <TableRow key={u.id} className="border-b border-slate-100 bg-white transition-colors hover:bg-gradient-to-r hover:from-blue-50 hover:via-white hover:to-indigo-50">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white shadow-sm ${getAvatarGradient(u.role)}`}>
                            {getInitials(u.username)}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-800">{u.username}</div>
                            <div className="text-xs text-slate-500">SML Staff Account</div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${getRoleColor(u.role)}`}>
                          <span className={`h-2 w-2 rounded-full ${getRoleDotColor(u.role)}`} />
                          {u.role === 'ADMIN' ? 'System Admin' : u.role === 'MANAGER' ? 'Store Manager' : 'Cashier'}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-slate-600">{new Date(u.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <div className="flex justify-center gap-1.5">
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100 hover:text-blue-700" onClick={() => openEditModal(u)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700" onClick={() => openDeleteModal(u)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {paginatedUsers.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-slate-500">
                        No users found matching the search.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}

          {filteredUsers.length > 0 && (
            <div className="mt-6 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Showing <span className="font-semibold text-slate-800">{startIndex + 1}</span>
                {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filteredUsers.length)}</span>
                {' '}of <span className="font-semibold text-slate-800">{filteredUsers.length}</span> users
              </p>

              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                  disabled={safeCurrentPage === 1}
                  className="h-8 w-8 rounded-md p-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>

                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <Button
                    key={page}
                    variant={page === safeCurrentPage ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCurrentPage(page)}
                    className={page === safeCurrentPage ? 'h-8 min-w-8 bg-blue-600 text-white hover:bg-blue-700' : 'h-8 min-w-8'}
                  >
                    {page}
                  </Button>
                ))}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                  disabled={safeCurrentPage === totalPages}
                  className="h-8 w-8 rounded-md p-0"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Role Permission Matrix Card */}
      <Card className="border-slate-200 bg-slate-50/70 shadow-sm">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="w-5 h-5 text-blue-600" />
            <h3 className="font-bold text-slate-800">Cold Store Role Permissions Matrix</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl border border-purple-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                <h4 className="font-bold text-purple-900">System Admin</h4>
              </div>
              <p className="text-xs text-slate-500">Unrestricted system governance, staff management & recovery.</p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pt-1">
                <li>Manage staff accounts & passwords</li>
                <li>System settings & hardware config</li>
                <li>Database export & full backups</li>
                <li>All POS, inventory, supplier, and financial reports</li>
                <li>Complete Governance Audit Trail access</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-amber-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                <h4 className="font-bold text-amber-900">Store Manager</h4>
              </div>
              <p className="text-xs text-slate-500">Daily warehouse operations, stock intake, and audit reviews.</p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pt-1">
                <li>Create & receive purchase orders (restocking)</li>
                <li>Add & edit frozen food items & categories</li>
                <li>Batch management, expiry monitoring & write-offs</li>
                <li>Audit trail viewing (price & stock movements)</li>
                <li>Restricted from deleting staff accounts or DB backups</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl border border-blue-200 bg-white shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                <h4 className="font-bold text-blue-900">Cashier</h4>
              </div>
              <p className="text-xs text-slate-500">Frontline POS terminal checkout & customer payments.</p>
              <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside pt-1">
                <li>Fast barcode POS terminal & cart checkout</li>
                <li>Cash, MoMo, card, and split payment handling</li>
                <li>Instant thermal receipt printing</li>
                <li>Customer lookup & customer balance checking</li>
                <li>Inventory is read-only (cannot alter prices or delete items)</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

