import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { format, isAfter, isBefore, addDays } from 'date-fns'
import type { ExpiryStatus, Medicine } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Currency ─────────────────────────────────────────────────────────────────
export function formatGHS(amount: number): string {
  return `₵${amount.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`
}

// ─── Date ─────────────────────────────────────────────────────────────────────
export function formatDate(dateStr: string | null | undefined, fmt = 'dd MMM yyyy'): string {
  if (!dateStr) return '—'
  return format(new Date(dateStr), fmt)
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return format(new Date(dateStr), 'dd MMM yyyy, HH:mm')
}

export function getToday(): string {
  return format(new Date(), 'yyyy-MM-dd')
}

export function get7DaysAgo(): string {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  return format(d, 'yyyy-MM-dd')
}

export function getMonthStart(): string {
  const d = new Date()
  d.setDate(1)
  return format(d, 'yyyy-MM-dd')
}

// ─── Expiry ───────────────────────────────────────────────────────────────────
export function getExpiryStatus(expiryDate: string | null | undefined): ExpiryStatus {
  if (!expiryDate) return 'ok'
  const today = new Date()
  const expiry = new Date(expiryDate)
  if (isBefore(expiry, today)) return 'expired'
  if (isBefore(expiry, addDays(today, 30))) return 'expiring-soon'
  return 'ok'
}

export function expiryStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case 'expired': return 'Expired'
    case 'expiring-soon': return 'Expiring Soon'
    default: return 'OK'
  }
}

export function expiryStatusColor(status: ExpiryStatus): string {
  switch (status) {
    case 'expired': return 'bg-red-100 text-red-700 border-red-200'
    case 'expiring-soon': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-emerald-100 text-emerald-700 border-emerald-200'
  }
}

// ─── Stock ────────────────────────────────────────────────────────────────────
export function isLowStock(medicine: Medicine): boolean {
  return medicine.stock <= medicine.reorderLevel
}

export function stockStatusColor(medicine: Medicine): string {
  if (medicine.stock === 0) return 'bg-red-100 text-red-700'
  if (isLowStock(medicine)) return 'bg-amber-100 text-amber-700'
  return 'bg-emerald-100 text-emerald-700'
}

// ─── Invoice ──────────────────────────────────────────────────────────────────
export function invoiceStatusColor(status: string): string {
  switch (status) {
    case 'PAID': return 'bg-emerald-100 text-emerald-700 border-emerald-200'
    case 'UNPAID': return 'bg-red-100 text-red-700 border-red-200'
    case 'PARTIAL': return 'bg-amber-100 text-amber-700 border-amber-200'
    default: return 'bg-gray-100 text-gray-700'
  }
}

// ─── Number ───────────────────────────────────────────────────────────────────
export function formatNumber(n: number): string {
  return n.toLocaleString()
}

export function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`
}

// ─── Platform & Client Environment ─────────────────────────────────────────────
/**
 * Detects whether the current session is running in a Remote Web browser
 * (e.g. Vercel cloud dashboard, external Chrome/Safari session) rather than
 * the dedicated physical counter devices (Android Tablet Capacitor app or Windows Desktop Electron app).
 */
export function isRemoteWebClient(): boolean {
  if (typeof window === 'undefined') return false

  // In test runners (Vitest / Jest), default to false unless explicitly mocking
  if (
    typeof process !== 'undefined' &&
    (process.env?.NODE_ENV === 'test' || Boolean(process.env?.VITEST))
  ) {
    return false
  }

  // 1. Android Tablet Native App (Capacitor)
  const isCapacitorNative = Boolean(
    (window as any).Capacitor?.isNativePlatform &&
    typeof (window as any).Capacitor.isNativePlatform === 'function' &&
    (window as any).Capacitor.isNativePlatform()
  )
  if (isCapacitorNative) return false

  // 2. Windows Desktop Native App (Electron)
  const isElectron = Boolean(
    (window as any).electron?.ipcRenderer ||
    (window as any).process?.versions?.electron
  )
  if (isElectron) return false

  // Regular web browser (remote web cloud session)
  return true
}
