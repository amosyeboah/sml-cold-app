import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Lock, User, Eye, EyeOff, Loader2, Grid3x3, Users, Link2, Package, Shield, Snowflake, ShoppingCart, Delete } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/utils'

import { api } from '@/services/api'

const schema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
})
type FormData = z.infer<typeof schema>

const features = [
  { icon: Package, title: 'Cold Room & Batch Tracking', description: 'Monitor cartons, batch lots, and expiry shelf life with ease.' },
  { icon: ShoppingCart, title: 'Fast POS Checkout', description: 'Process wholesale and retail sales with cash, momo, and thermal receipts.' },
]

export default function LoginPage() {
  const navigate = useNavigate()
  const login = useAuthStore((s) => s.login)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loginMode, setLoginMode] = useState<'credentials' | 'pin'>('credentials')

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.removeItem('sml_depot_hub_url')
      } catch {}
    }
  }, [])

  // PIN Touch Numpad State
  const [pin, setPin] = useState('')
  const [selectedPinRole, setSelectedPinRole] = useState<'ADMIN' | 'MANAGER' | 'CASHIER' | null>(null)
  const [pinError, setPinError] = useState<string | null>(null)
  const [isPinSubmitting, setIsPinSubmitting] = useState(false)

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
  })

  const fillRole = (username: string, pass: string) => {
    setValue('username', username)
    setValue('password', pass)
    setError(null)
  }

  const handlePinSubmit = async (pinValue: string) => {
    setPinError(null)
    setIsPinSubmitting(true)
    try {
      const apiClient = typeof window !== 'undefined' && window.api ? window.api : api
      let res: any
      if (typeof apiClient.loginWithPin === 'function') {
        res = await apiClient.loginWithPin(pinValue, selectedPinRole || undefined)
      } else {
        let username = ''
        let password = ''
        if (pinValue === '1111' && (!selectedPinRole || selectedPinRole === 'ADMIN')) {
          username = 'admin'
          password = 'admin1234'
        } else if (pinValue === '2222' && (!selectedPinRole || selectedPinRole === 'MANAGER')) {
          username = 'manager'
          password = 'manager123'
        } else if (pinValue === '1234' && (!selectedPinRole || selectedPinRole === 'CASHIER')) {
          username = 'cashier'
          password = 'cashier123'
        } else {
          throw new Error('Invalid PIN code. Try 1111 (Admin), 2222 (Manager), or 1234 (Cashier)')
        }
        res = await apiClient.login(username, password)
      }

      if (res?.success === false) {
        throw new Error(res.error || 'Invalid PIN code. Try 1111 (Admin) or 1234 (Cashier)')
      }
      const user = res?.user ? res.user : res
      if (!user || !user.role) {
        throw new Error('Invalid PIN code. Try 1111 (Admin) or 1234 (Cashier)')
      }

      login(user)
      if (user.role === 'CASHIER') {
        navigate('/pos')
      } else {
        navigate('/dashboard')
      }
    } catch (err: any) {
      console.error(err)
      setPinError(err.message || 'Invalid PIN code. Try 1111 (Admin) or 1234 (Cashier)')
      setTimeout(() => {
        setPin('')
      }, 1000)
    } finally {
      setIsPinSubmitting(false)
    }
  }

  const handleNumberClick = (digit: string) => {
    if (pin.length >= 4 || isPinSubmitting) return
    const newPin = pin + digit
    setPin(newPin)
    setPinError(null)
    if (newPin.length === 4) {
      handlePinSubmit(newPin)
    }
  }

  const handleBackspace = () => {
    if (isPinSubmitting) return
    setPin((prev) => prev.slice(0, -1))
    setPinError(null)
  }

  const handleClear = () => {
    if (isPinSubmitting) return
    setPin('')
    setPinError(null)
  }

  // Physical Keyboard Listener when in PIN mode
  useEffect(() => {
    if (loginMode !== 'pin') return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isPinSubmitting) return
      if (e.key >= '0' && e.key <= '9') {
        if (pin.length < 4) {
          const newPin = pin + e.key
          setPin(newPin)
          setPinError(null)
          if (newPin.length === 4) {
            handlePinSubmit(newPin)
          }
        }
      } else if (e.key === 'Backspace') {
        handleBackspace()
      } else if (e.key === 'Escape') {
        handleClear()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [loginMode, pin, isPinSubmitting, selectedPinRole])

  const onSubmit = async (data: FormData) => {
    setError(null)
    try {
      const apiClient = typeof window !== 'undefined' && window.api ? window.api : api
      const cleanU = (data.username || '').trim()
      const cleanP = (data.password || '').trim()
      const res = await apiClient.login(cleanU, cleanP)
      if (res?.success === false) {
        throw new Error(res.error || 'Invalid username or password')
      }
      const user = res?.user ? res.user : res
      if (!user || !user.role) {
        throw new Error('Invalid username or password')
      }
      login(user)
      if (user.role === 'CASHIER') {
        navigate('/pos')
      } else {
        navigate('/dashboard')
      }
    } catch (e: any) {
      console.error(e)
      setError(e.message || 'Invalid username or password')
    }
  }

  return (
    <div className="flex h-[100dvh] w-full bg-[#f3f5f9] font-sans overflow-hidden">
      {/* Left Column */}
      <div className="hidden lg:flex flex-col justify-between w-[55%] max-w-[800px] bg-gradient-to-br from-[#2563EB] to-[#0284C7] p-8 lg:p-12 rounded-r-[2rem] text-white shadow-xl z-10">

        <div className="flex flex-col gap-6 lg:gap-8 max-w-[500px] flex-1 justify-center">
          {/* Logo & Branding */}
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20 shadow-md">
              <Snowflake className="h-7 w-7 text-white" />
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-100">SML LEGACY LIMITED</p>
              <p className="text-sm font-semibold mt-0.5">Quality Frozen Foods &amp; Cold Storage</p>
            </div>
          </div>

          {/* Main Heading */}
          <div className="mt-4 lg:mt-8">
            <h1 className="text-3xl lg:text-4xl font-bold leading-[1.15] mb-3">
              Welcome back to your<br />cold store command center.
            </h1>
            <p className="text-sm lg:text-[15px] leading-relaxed text-blue-100/90 max-w-[420px]">
              Manage cold room inventory, track carton batches and shelf life,
              process fast POS transactions, and keep your wholesale and retail
              sales synchronized.
            </p>
          </div>

          {/* Feature Cards */}
          <div className="space-y-4 pt-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="rounded-2xl border border-white/20 bg-white/10 p-5 flex items-start gap-5 backdrop-blur-sm">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20">
                  <Icon className="h-5 w-5 text-white" strokeWidth={2.5} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white mb-1">{title}</h3>
                  <p className="text-[13px] text-blue-100/90">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer Badge */}
        <div className="mt-8 inline-flex items-center gap-2.5 rounded-full border border-white/20 bg-white/10 px-5 py-2 text-[12px] font-medium backdrop-blur-sm w-fit">
          <Shield className="h-4 w-4" />
          Offline-ready and secure for daily cold store operations
        </div>
      </div>

      {/* Right Column */}
      <div className="flex-1 flex flex-col relative h-full">
        <div className="flex-1 flex flex-col items-center justify-center p-4 lg:p-8 overflow-y-auto">
          <div className="w-full max-w-[360px]">
            {/* Header */}
            <div className="text-center mb-5">
              <h2 className="text-[28px] font-bold text-gray-900 mb-1">Welcome Back!</h2>
              <p className="text-xs text-gray-500 mb-3">Sign in to SML Legacy Cold Store POS</p>

              {/* Quick Role Fill Chips */}
              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => fillRole('admin', 'admin1234')}
                  className="rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-medium text-purple-700 hover:bg-purple-100 transition-colors"
                >
                  Admin
                </button>
                <button
                  type="button"
                  onClick={() => fillRole('manager', 'manager123')}
                  className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700 hover:bg-amber-100 transition-colors"
                >
                  Manager
                </button>
                <button
                  type="button"
                  onClick={() => fillRole('cashier', 'cashier123')}
                  className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  Cashier
                </button>
              </div>
            </div>

            {loginMode === 'credentials' ? (
              <>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  {/* Username */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold text-gray-700">Username</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                      <Input
                        {...register('username')}
                        placeholder="Enter your username"
                        className="h-12 border-gray-200 bg-white pl-11 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20 shadow-sm rounded-lg"
                        autoComplete="username"
                      />
                    </div>
                    {errors.username && <p className="text-xs text-red-500">{errors.username.message}</p>}
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label className="text-[13px] font-semibold text-gray-700">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-gray-400" />
                      <Input
                        {...register('password')}
                        type={showPassword ? 'text' : 'password'}
                        placeholder="Enter your password"
                        className="h-12 border-gray-200 bg-white pl-11 pr-11 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:ring-blue-500/20 shadow-sm rounded-lg"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                    {errors.password && <p className="text-xs text-red-500">{errors.password.message}</p>}
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>Default:</span>
                      <button
                        type="button"
                        onClick={() => fillRole('admin', 'admin1234')}
                        className="font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                      >
                        Admin
                      </button>
                      <span>•</span>
                      <button
                        type="button"
                        onClick={() => fillRole('cashier', 'cashier123')}
                        className="font-medium text-blue-600 hover:text-blue-800 underline underline-offset-2"
                      >
                        Cashier
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => alert('Default Logins:\n\n• Admin: admin / admin1234 (PIN: 1111)\n• Cashier: cashier / cashier123 (PIN: 1234)\n• Manager: manager / manager123 (PIN: 2222)')}
                      className="text-[13px] font-semibold text-blue-600 hover:text-blue-700"
                    >
                      Forgot password?
                    </button>
                  </div>

                  {error && (
                    <div className="rounded-lg bg-red-50 p-3 text-[13px] text-red-600 border border-red-100 text-center font-medium">
                      <p>{error}</p>
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="h-11 w-full bg-[#2563EB] text-[15px] font-semibold text-white hover:bg-blue-700 shadow-sm flex items-center justify-center gap-2 rounded-lg"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-[18px] w-[18px] animate-spin" />
                        Signing in...
                      </>
                    ) : (
                      <>
                        <Users className="h-[18px] w-[18px]" />
                        Sign In
                      </>
                    )}
                  </Button>
                </form>

                <div className="my-5 flex items-center gap-4">
                  <div className="h-px flex-1 bg-gray-200"></div>
                  <span className="text-[11px] font-semibold text-gray-400">OR</span>
                  <div className="h-px flex-1 bg-gray-200"></div>
                </div>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setLoginMode('pin')}
                  className="h-11 w-full border-gray-200 bg-white text-[14px] font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 rounded-lg shadow-sm"
                >
                  <Grid3x3 className="h-4 w-4 text-gray-500" />
                  Login with PIN (Default: 1111)
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className="text-center">
                  <p className="text-sm font-bold text-gray-800">Touch Numpad Access</p>
                  <p className="text-[11px] text-gray-500 mt-0.5">Select role or tap 4-digit PIN</p>
                </div>

                {/* Operator Selector Chips */}
                <div className="flex items-center justify-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => { setSelectedPinRole(selectedPinRole === 'ADMIN' ? null : 'ADMIN'); setPin(''); setPinError(null) }}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                      selectedPinRole === 'ADMIN'
                        ? 'border-purple-600 bg-purple-600 text-white shadow-sm ring-2 ring-purple-200'
                        : 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                    )}
                  >
                    Admin (1111)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedPinRole(selectedPinRole === 'MANAGER' ? null : 'MANAGER'); setPin(''); setPinError(null) }}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                      selectedPinRole === 'MANAGER'
                        ? 'border-amber-600 bg-amber-600 text-white shadow-sm ring-2 ring-amber-200'
                        : 'border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100'
                    )}
                  >
                    Manager (2222)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setSelectedPinRole(selectedPinRole === 'CASHIER' ? null : 'CASHIER'); setPin(''); setPinError(null) }}
                    className={cn(
                      'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                      selectedPinRole === 'CASHIER'
                        ? 'border-blue-600 bg-blue-600 text-white shadow-sm ring-2 ring-blue-200'
                        : 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                    )}
                  >
                    Cashier (1234)
                  </button>
                </div>

                {/* PIN Indicator Circles */}
                <div className="flex justify-center items-center gap-3 py-1">
                  {[0, 1, 2, 3].map((index) => {
                    const isFilled = pin.length > index
                    return (
                      <div
                        key={index}
                        className={cn(
                          'w-4 h-4 rounded-full transition-all duration-200',
                          isFilled
                            ? 'bg-blue-600 ring-4 ring-blue-100 scale-110'
                            : 'border-2 border-slate-300 bg-white'
                        )}
                      />
                    )
                  })}
                </div>

                {pinError && (
                  <div className="rounded-lg bg-red-50 p-2 text-xs text-red-600 border border-red-100 text-center font-medium">
                    {pinError}
                  </div>
                )}

                {isPinSubmitting && (
                  <div className="flex items-center justify-center gap-1.5 text-xs text-blue-600 font-medium">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying PIN...
                  </div>
                )}

                {/* Straightforward Touch Numbers Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-2.5 w-full max-w-[280px] mx-auto pt-1">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                    <button
                      key={digit}
                      type="button"
                      onClick={() => handleNumberClick(digit)}
                      disabled={isPinSubmitting}
                      className="h-12 sm:h-13 w-full rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm hover:bg-blue-50 hover:border-blue-300 active:scale-95 active:bg-blue-100 transition-all flex items-center justify-center select-none"
                    >
                      {digit}
                    </button>
                  ))}
                  {/* Row 4 */}
                  <button
                    type="button"
                    onClick={handleClear}
                    disabled={isPinSubmitting || pin.length === 0}
                    className="h-12 sm:h-13 w-full rounded-2xl bg-rose-50/70 border border-rose-100 text-xs font-bold uppercase tracking-wider text-rose-600 hover:bg-rose-100 active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-40"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNumberClick('0')}
                    disabled={isPinSubmitting}
                    className="h-12 sm:h-13 w-full rounded-2xl bg-white border border-slate-200 text-2xl font-bold text-slate-800 shadow-sm hover:bg-blue-50 hover:border-blue-300 active:scale-95 active:bg-blue-100 transition-all flex items-center justify-center select-none"
                  >
                    0
                  </button>
                  <button
                    type="button"
                    onClick={handleBackspace}
                    disabled={isPinSubmitting || pin.length === 0}
                    className="h-12 sm:h-13 w-full rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 hover:bg-slate-200 active:scale-95 transition-all flex items-center justify-center select-none disabled:opacity-40"
                    title="Backspace"
                  >
                    <Delete className="h-5 w-5" />
                  </button>
                </div>

                <div className="pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => { setLoginMode('credentials'); setPin(''); setPinError(null) }}
                    className="h-10 w-full text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg"
                  >
                    Back to Username &amp; Password
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Text */}
        <div className="pb-4 w-full text-center text-[11px] text-gray-500">
          © 2026 SML Legacy Limited. All rights reserved.
        </div>
      </div>
    </div>
  )
}
