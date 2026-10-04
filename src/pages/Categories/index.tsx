import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tags, PlusCircle, Search, Edit2, Trash2, AlertCircle, Package, ChevronsLeft, ChevronsRight } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Category, Medicine } from '@/types'

const categorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(60, 'Max 60 characters'),
})
type CategoryForm = z.infer<typeof categorySchema>

// Colorful badges for categories (cycles through a palette)
const PALETTE = [
  { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
  { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
  { bg: 'bg-rose-100', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-teal-100', text: 'text-teal-700', dot: 'bg-teal-500' },
  { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
]

const ITEMS_PER_PAGE = 15

export default function Categories() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [isOpen, setIsOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [categoryToDelete, setCategoryToDelete] = useState<Category | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const { data: categories = [], isLoading } = useQuery<Category[]>({
    queryKey: ['categories'],
    queryFn: () => window.api.getCategories(),
  })

  const { data: medicines = [] } = useQuery<Medicine[]>({
    queryKey: ['medicines'],
    queryFn: () => window.api.getMedicines(),
  })

  // Count of medicines per category
  const medicineCountMap = useMemo(() => {
    const map: Record<string, number> = {}
      ; (medicines as any[]).forEach((m) => {
        map[m.categoryId] = (map[m.categoryId] ?? 0) + 1
      })
    return map
  }, [medicines])

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<CategoryForm>({ resolver: zodResolver(categorySchema) })

  const createMutation = useMutation({
    mutationFn: (data: CategoryForm) => window.api.createCategory(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeModal()
    },
  })

  const updateMutation = useMutation({
    mutationFn: (data: CategoryForm) => window.api.updateCategory(editingCategory!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      closeModal()
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => window.api.deleteCategory(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] })
      setIsDeleteDialogOpen(false)
      setCategoryToDelete(null)
      setDeleteError(null)
    },
    onError: () => {
      setDeleteError('This category is in use by one or more products. Please reassign those products before deleting.')
    },
  })

  const onSubmit = (data: CategoryForm) => {
    if (editingCategory) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const openCreate = () => {
    setEditingCategory(null)
    reset()
    setIsOpen(true)
  }

  const openEdit = (cat: Category) => {
    setEditingCategory(cat)
    setValue('name', cat.name)
    setIsOpen(true)
  }

  const closeModal = () => {
    setIsOpen(false)
    setEditingCategory(null)
    reset()
  }

  const openDelete = (cat: Category) => {
    setCategoryToDelete(cat)
    setDeleteError(null)
    setIsDeleteDialogOpen(true)
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return categories
    const q = search.toLowerCase()
    return categories.filter((c) => c.name.toLowerCase().includes(q))
  }, [categories, search])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safeCurrentPage = Math.min(currentPage, totalPages)
  const startIndex = (safeCurrentPage - 1) * ITEMS_PER_PAGE
  const paginatedCategories = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE)

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
                Catalogue
              </span>
              <span className="inline-flex items-center rounded-full bg-emerald-400/20 px-2 py-0.5 text-[9px] font-medium text-emerald-100 ring-1 ring-inset ring-emerald-200/30">
                Organized flow
              </span>
            </div>
            <h1 className="text-lg sm:text-xl font-bold leading-tight text-white">Categories</h1>
          </div>

          <div className="grid grid-cols-2 gap-2 flex-shrink-0">
            <div className="rounded-xl border border-white/10 bg-emerald-400/15 px-3 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-emerald-100 font-medium">Categories</p>
              <p className="text-base sm:text-lg font-bold text-white mt-0.5">{categories.length}</p>
            </div>
            <div className="rounded-xl border border-white/10 bg-amber-400/15 px-3 py-1.5 backdrop-blur">
              <p className="text-[9px] sm:text-[10px] uppercase tracking-wider text-amber-100 font-medium">Products</p>
              <p className="text-base sm:text-lg font-bold text-white mt-0.5">{(medicines as any[]).length}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-3.5">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Search categories..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setCurrentPage(1)
              }}
              className="pl-9 h-10 text-sm border-slate-200"
            />
          </div>
          <Button
            onClick={openCreate}
            className="gap-2 text-white font-medium"
            style={{ backgroundColor: '#2563eb' }}
          >
            <PlusCircle className="h-4 w-4" /> Add Category
          </Button>
        </div>

        {/* Table */}
        <Card className="border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 px-5 py-3.5">
            <Tags className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-semibold text-slate-700">Category Registry</span>
            <span className="ml-auto text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{filtered.length}</span> of{' '}
              <span className="font-semibold text-slate-700">{categories.length}</span>
            </span>
          </div>

          {isLoading ? (
            <div className="flex h-52 items-center justify-center">
              <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-emerald-500 border-t-transparent" />
            </div>
          ) : (
            <div className="max-h-[min(65vh,620px)] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 hover:bg-slate-50">
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-700">#</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-700">Category Name</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wide text-slate-700">Products</TableHead>
                    <TableHead className="text-right text-xs font-semibold uppercase tracking-wide text-slate-700">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCategories.length > 0 ? (
                    paginatedCategories.map((cat, idx) => {
                      const palette = PALETTE[(startIndex + idx) % PALETTE.length]
                      const count = medicineCountMap[cat.id] ?? 0
                      return (
                        <TableRow key={cat.id} className="border-b border-slate-100 bg-white transition-colors hover:bg-gradient-to-r hover:from-blue-50 hover:via-white hover:to-indigo-50">
                          <TableCell className="text-xs font-mono text-slate-400">{startIndex + idx + 1}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-sm font-semibold ${palette.bg} ${palette.text}`}
                            >
                              <span className={`h-2 w-2 rounded-full ${palette.dot}`} />
                              {cat.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="inline-flex items-center gap-1.5 text-sm text-slate-600">
                              <Package className="h-3.5 w-3.5 text-slate-400" />
                              <span className="font-semibold">{count}</span>
                              <span className="text-slate-400">product{count !== 1 ? 's' : ''}</span>
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => openEdit(cat)}
                                className="rounded-lg bg-blue-50 p-2 text-blue-600 transition-colors hover:bg-blue-100 hover:text-blue-700"
                                title="Edit category"
                              >
                                <Edit2 className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => openDelete(cat)}
                                className="rounded-lg bg-red-50 p-2 text-red-600 transition-colors hover:bg-red-100 hover:text-red-700"
                                title="Delete category"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="py-16 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <Tags className="h-8 w-8 text-slate-300" />
                          <p className="text-sm font-medium text-slate-400">
                            {search ? 'No categories match your search' : 'No categories yet'}
                          </p>
                          {!search && (
                            <p className="text-xs text-slate-300">
                              Click "Add Category" to get started
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </Card>
      </div>

      {/* ── Create / Edit Modal ─────────────────────────────────────────────── */}
      <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingCategory ? 'Edit Category' : 'New Category'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Category Name</Label>
              <Input {...register('name')} placeholder="e.g. Antibiotics, Vitamins, Pain Relief" />
              {errors.name && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" /> {errors.name.message}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
                className="flex-1 text-white"
                style={{ backgroundColor: '#2563eb' }}
              >
                {editingCategory ? 'Save Changes' : 'Create Category'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {filtered.length > 0 && (
        <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-800">{filtered.length === 0 ? 0 : startIndex + 1}</span>
            {' '}-<span className="font-semibold text-slate-800">{Math.min(startIndex + ITEMS_PER_PAGE, filtered.length)}</span>
            {' '}of <span className="font-semibold text-slate-800">{filtered.length}</span> categories
          </p>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
              disabled={safeCurrentPage === 1}
              className="h-8 w-8 rounded-md p-0"
            >
              <ChevronsLeft className="h-4 w-4" />
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
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────────────────── */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={(open) => { if (!open) { setIsDeleteDialogOpen(false); setDeleteError(null) } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Category</DialogTitle>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <p className="text-sm text-slate-600">
              Are you sure you want to delete{' '}
              <strong className="text-slate-900">"{categoryToDelete?.name}"</strong>?
              {(medicineCountMap[categoryToDelete?.id ?? ''] ?? 0) > 0 && (
                <span className="block mt-1 text-amber-600 font-medium">
                  ⚠ This category has {medicineCountMap[categoryToDelete?.id ?? '']} associated product(s).
                </span>
              )}
            </p>
            {deleteError && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-xs text-red-700 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                {deleteError}
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => { setIsDeleteDialogOpen(false); setDeleteError(null) }}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(categoryToDelete!.id)}
              className="flex-1"
            >
              Delete
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
