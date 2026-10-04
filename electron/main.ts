import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import type { PrismaClient as PrismaClientType } from '../generated/client'
import * as bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'
import * as ExcelJS from 'exceljs'
import { startHubServer } from '../src/hub'
import * as saleService from '../src/hub/services/saleService'
import * as purchaseService from '../src/hub/services/purchaseService'
import * as inventoryService from '../src/hub/services/inventoryService'
import * as auditService from '../src/hub/services/auditService'
import * as syncEngine from '../src/hub/services/syncEngine'
import * as syncOutboxService from '../src/hub/services/syncOutboxService'

// ─── Prisma ─────────────────────────────────────────────────────────────────
let prisma: PrismaClientType

function resolvePrismaClient(): typeof import('../generated/client') {
  if (is.dev) {
    return require(path.join(__dirname, '../../generated/client'))
  }
  const unpackedPath = path.join(
    process.resourcesPath,
    'app.asar.unpacked',
    'generated',
    'client'
  )
  const enginePath = path.join(unpackedPath, 'query_engine-windows.dll.node')
  if (fs.existsSync(enginePath)) {
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = enginePath
  }
  return require(unpackedPath)
}

function resolveDatabaseUrl(): string {
  const dbDir = is.dev
    ? path.join(__dirname, '../../database')
    : path.join(app.getPath('userData'), 'database')

  if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true })

  const dbPath = path.join(dbDir, 'pharmacy.db')
  // Prisma SQLite requires 'file:' prefix with forward slashes (not file:/// triple-slash)
  // Convert Windows backslashes to forward slashes
  const normalizedPath = dbPath.replace(/\\/g, '/')
  return `file:${normalizedPath}`
}

function resolveDatabasePath(): string {
  const dbDir = is.dev
    ? path.join(__dirname, '../../database')
    : path.join(app.getPath('userData'), 'database')
  return path.join(dbDir, 'pharmacy.db')
}

async function initDatabase(): Promise<void> {
  const targetDbPath = resolveDatabasePath()
  const dbDir = path.dirname(targetDbPath)
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true })
  }

  // Ensure fresh production installs copy the initial template database with seeded schema and catalog
  if (!is.dev && !fs.existsSync(targetDbPath)) {
    const candidates = [
      path.join(process.resourcesPath, 'database', 'pharmacy.db'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'database', 'pharmacy.db'),
      path.join(__dirname, '../../database/pharmacy.db')
    ]
    for (const cand of candidates) {
      if (fs.existsSync(cand)) {
        try {
          fs.copyFileSync(cand, targetDbPath)
          console.log(`✅ Seeded production database from template: ${cand}`)
          break
        } catch (copyErr) {
          console.error(`⚠️ Failed to copy initial database from ${cand}:`, copyErr)
        }
      }
    }
  }

  const dbUrl = resolveDatabaseUrl()
  process.env.DATABASE_URL = dbUrl

  const { PrismaClient } = resolvePrismaClient()
  prisma = new PrismaClient({ datasources: { db: { url: dbUrl } } })
  await prisma.$connect()
  console.log('✅ Database connected:', dbUrl)
}

// ─── Audit Logger Helper (Important Activities Only) ──────────────────────────
async function recordAudit(entry: {
  action: string
  category: string
  details: string
  username?: string
  userRole?: string
  severity?: 'INFO' | 'WARNING' | 'CRITICAL'
  metadata?: any
}) {
  try {
    if (!prisma) return
    await prisma.auditLog.create({
      data: {
        action: entry.action,
        category: entry.category,
        details: entry.details,
        username: entry.username || 'System',
        userRole: entry.userRole || 'SYSTEM',
        severity: entry.severity || 'INFO',
        metadata: entry.metadata ? JSON.stringify(entry.metadata) : null,
      },
    })
  } catch (err) {
    console.error('Failed to write audit log:', err)
  }
}

// ─── Window ──────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    autoHideMenuBar: true,
    frame: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error('❌ Renderer process gone:', details)
  })

  mainWindow.webContents.on('did-fail-load', (_event, code, desc) => {
    console.error(`❌ Page failed to load: [${code}] ${desc}`)
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    if (is.dev) {
      console.log(`[Renderer Log ${level}]: ${message} (${sourceId}:${line})`)
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
    // mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── App lifecycle ───────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  electronApp.setAppUserModelId('com.smllegacy.coldstore')
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  await initDatabase()
  try {
    await startHubServer()
    console.log('✅ Local Depot Hub HTTP API is live on LAN')
  } catch (hubErr) {
    console.warn('⚠️ Could not start Local Depot Hub on default port:', hubErr)
  }
  createWindow()
  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', async () => {
  if (prisma) await prisma.$disconnect()
  if (process.platform !== 'darwin') app.quit()
})

// ═══════════════════════════════════════════════════════════════════════════════
// IPC HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Auth ─────────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async (_, username: string, password: string) => {
  const cleanUsername = (username || '').trim().toLowerCase()
  const cleanPassword = (password || '').trim()

  const allUsers = await prisma.user.findMany()
  const user = allUsers.find(u => u.username.toLowerCase() === cleanUsername)
  let valid = false
  if (user && cleanPassword) {
    if (user.password.startsWith('$2a$') || user.password.startsWith('$2b$')) {
      valid = await bcrypt.compare(cleanPassword, user.password)
    } else {
      valid = cleanPassword === user.password
    }
  }

  if (!user || !valid) {
    await recordAudit({
      action: 'LOGIN_FAILED',
      category: 'AUTH',
      details: `Failed sign-in attempt for username "${username}"`,
      username,
      userRole: user?.role || 'UNKNOWN',
      severity: 'WARNING',
      metadata: { attemptedUsername: username },
    })
    throw new Error('Invalid credentials')
  }

  await recordAudit({
    action: 'LOGIN_SUCCESS',
    category: 'AUTH',
    details: `Staff user "${user.username}" signed in with role [${user.role}]`,
    username: user.username,
    userRole: user.role,
    severity: 'INFO',
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
})

ipcMain.handle('auth:loginWithPin', async (_, pin: string, selectedRole?: string) => {
  const cleanPin = (pin || '').trim()
  const allUsers = await prisma.user.findMany()
  let user = allUsers.find(u => u.pin === cleanPin && (!selectedRole || u.role === selectedRole))

  if (!user && !selectedRole) {
    user = allUsers.find(u => u.pin === cleanPin)
  }

  // Fallback to hardcoded default PINs if user didn't set a custom PIN yet
  if (!user) {
    let targetUsername = ''
    if (cleanPin === '1111' && (!selectedRole || selectedRole === 'ADMIN')) {
      targetUsername = 'admin'
    } else if (cleanPin === '2222' && (!selectedRole || selectedRole === 'MANAGER')) {
      targetUsername = 'manager'
    } else if (cleanPin === '1234' && (!selectedRole || selectedRole === 'CASHIER')) {
      targetUsername = 'cashier'
    }
    if (targetUsername) {
      user = allUsers.find(u => u.username.toLowerCase() === targetUsername.toLowerCase())
    }
  }

  if (!user) {
    throw new Error('Invalid PIN code. Try 1111 (Admin), 2222 (Manager), or 1234 (Cashier)')
  }

  await recordAudit({
    action: 'LOGIN_SUCCESS_PIN',
    category: 'AUTH',
    details: `Staff user "${user.username}" signed in via touch PIN pad [${user.role}]`,
    username: user.username,
    userRole: user.role,
    severity: 'INFO',
  })

  return {
    id: user.id,
    username: user.username,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
})

// ─── Medicines ────────────────────────────────────────────────────────────────
ipcMain.handle('medicines:getAll', async () => {
  const meds = await prisma.medicine.findMany({
    include: { category: true, batches: true },
    orderBy: { name: 'asc' },
  })
  return meds
})

ipcMain.handle('medicines:create', async (_, data: any) => {
  return await inventoryService.createProduct({ ...data, deviceId: 'desktop-main-pos' })
})

ipcMain.handle('medicines:update', async (_, id: string, data: any) => {
  return await inventoryService.updateProduct(id, data, { deviceId: 'desktop-main-pos' })
})

ipcMain.handle('medicines:delete', async (_, id: string) => {
  return await inventoryService.deleteProduct(id, { deviceId: 'desktop-main-pos' })
})

// ─── Users ────────────────────────────────────────────────────────────────────
ipcMain.handle('users:update', async (_, id: string, data: { username: string; role: string; passwordHash?: string; pin?: string }) => {
  const existing = await prisma.user.findUnique({ where: { id } })
  const updateData: any = { username: data.username, role: data.role }
  if (data.passwordHash) {
    updateData.password = await bcrypt.hash(data.passwordHash, 10)
  }
  if (data.pin !== undefined) {
    updateData.pin = data.pin
  }
  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
  })

  await recordAudit({
    action: 'USER_UPDATE',
    category: 'AUTH',
    details: `Updated operator account "${data.username}" (Role: ${data.role}${data.passwordHash ? ', Password reset' : ''})`,
    severity: 'WARNING',
    metadata: { userId: id, username: data.username, role: data.role, roleChanged: existing?.role !== data.role },
  })

  return updated
})

ipcMain.handle('users:delete', async (_, id: string) => {
  const user = await prisma.user.findUnique({ where: { id } })
  const res = await prisma.user.delete({ where: { id } })
  await recordAudit({
    action: 'USER_DELETE',
    category: 'AUTH',
    details: `Deleted staff operator account "${user?.username || id}" (Former role: ${user?.role || 'UNKNOWN'})`,
    severity: 'CRITICAL',
    metadata: { userId: id, username: user?.username, role: user?.role },
  })
  return res
})


// ─── Categories ───────────────────────────────────────────────────────────────
ipcMain.handle('categories:getAll', async () => {
  return prisma.category.findMany({ orderBy: { name: 'asc' } })
})

ipcMain.handle('categories:create', async (_, data: { name: string }) => {
  const cat = await prisma.category.create({ data })
  await recordAudit({
    action: 'CATEGORY_CREATE',
    category: 'INVENTORY',
    details: `Created product category "${cat.name}"`,
    severity: 'INFO',
    metadata: { categoryId: cat.id, name: cat.name },
  })
  return cat
})

ipcMain.handle('categories:update', async (_, id: string, data: { name: string }) => {
  const existing = await prisma.category.findUnique({ where: { id } })
  const cat = await prisma.category.update({ where: { id }, data })
  await recordAudit({
    action: 'CATEGORY_UPDATE',
    category: 'INVENTORY',
    details: `Updated category "${existing?.name || id}" to "${cat.name}"`,
    severity: 'INFO',
    metadata: { categoryId: id, oldName: existing?.name, newName: cat.name },
  })
  return cat
})

ipcMain.handle('categories:delete', async (_, id: string) => {
  const existing = await prisma.category.findUnique({ where: { id } })
  const res = await prisma.category.delete({ where: { id } })
  await recordAudit({
    action: 'CATEGORY_DELETE',
    category: 'INVENTORY',
    details: `Deleted product category "${existing?.name || id}"`,
    severity: 'WARNING',
    metadata: { categoryId: id, name: existing?.name },
  })
  return res
})

// ─── Batches ──────────────────────────────────────────────────────────────────
ipcMain.handle('batches:getAll', async (_, startDate?: string, endDate?: string) => {
  const where: any = {}
  if (startDate || endDate) {
    where.expiryDate = {}
    if (startDate) where.expiryDate.gte = new Date(startDate)
    if (endDate) where.expiryDate.lte = new Date(endDate)
  }
  return prisma.batch.findMany({
    where,
    include: { medicine: true },
    orderBy: { expiryDate: 'asc' },
  })
})

ipcMain.handle('batches:create', async (_, data: any) => {
  return await inventoryService.createBatch({ ...data, deviceId: 'desktop-main-pos' })
})

ipcMain.handle('batches:update', async (_, id: string, data: any) => {
  return await inventoryService.updateBatch(id, data, { deviceId: 'desktop-main-pos' })
})

ipcMain.handle('batches:delete', async (_, id: string) => {
  return await inventoryService.deleteBatch(id, { deviceId: 'desktop-main-pos' })
})

// ─── Suppliers ────────────────────────────────────────────────────────────────
ipcMain.handle('suppliers:getAll', async () => {
  return prisma.supplier.findMany({ orderBy: { name: 'asc' } })
})

ipcMain.handle('suppliers:create', async (_, data: any) => {
  const sup = await prisma.supplier.create({ data })
  await recordAudit({
    action: 'SUPPLIER_CREATE',
    category: 'PURCHASES',
    details: `Registered new supplier "${sup.name}"${sup.contact ? ` (Contact: ${sup.contact})` : ''}`,
    severity: 'INFO',
    metadata: { supplierId: sup.id, name: sup.name },
  })
  return sup
})

ipcMain.handle('suppliers:update', async (_, id: string, data: any) => {
  const existing = await prisma.supplier.findUnique({ where: { id } })
  const sup = await prisma.supplier.update({ where: { id }, data })
  await recordAudit({
    action: 'SUPPLIER_UPDATE',
    category: 'PURCHASES',
    details: `Updated supplier profile for "${existing?.name || sup.name}"`,
    severity: 'INFO',
    metadata: { supplierId: id, name: sup.name, changes: data },
  })
  return sup
})

ipcMain.handle('suppliers:delete', async (_, id: string) => {
  const existing = await prisma.supplier.findUnique({ where: { id } })
  const res = await prisma.supplier.delete({ where: { id } })
  await recordAudit({
    action: 'SUPPLIER_DELETE',
    category: 'PURCHASES',
    details: `Deleted supplier "${existing?.name || id}"`,
    severity: 'WARNING',
    metadata: { supplierId: id, name: existing?.name },
  })
  return res
})

// ─── Customers ────────────────────────────────────────────────────────────────
ipcMain.handle('customers:getAll', async () => {
  return prisma.customer.findMany({ orderBy: { name: 'asc' } })
})

ipcMain.handle('customers:create', async (_, data: any) => {
  const cust = await prisma.customer.create({ data })
  await recordAudit({
    action: 'CUSTOMER_CREATE',
    category: 'SALES',
    details: `Registered customer "${cust.name}"${cust.phone ? ` (${cust.phone})` : ''}`,
    severity: 'INFO',
    metadata: { customerId: cust.id, name: cust.name, phone: cust.phone },
  })
  return cust
})

ipcMain.handle('customers:update', async (_, id: string, data: any) => {
  const existing = await prisma.customer.findUnique({ where: { id } })
  const cust = await prisma.customer.update({ where: { id }, data })
  await recordAudit({
    action: 'CUSTOMER_UPDATE',
    category: 'SALES',
    details: `Updated customer profile for "${existing?.name || cust.name}"`,
    severity: 'INFO',
    metadata: { customerId: id, name: cust.name, phone: cust.phone },
  })
  return cust
})

ipcMain.handle('customers:delete', async (_, id: string) => {
  const existing = await prisma.customer.findUnique({ where: { id } })
  const res = await prisma.customer.delete({ where: { id } })
  await recordAudit({
    action: 'CUSTOMER_DELETE',
    category: 'SALES',
    details: `Deleted customer "${existing?.name || id}"`,
    severity: 'WARNING',
    metadata: { customerId: id, name: existing?.name },
  })
  return res
})

// ─── Sales (POS) ──────────────────────────────────────────────────────────────
ipcMain.handle('sales:create', async (_, data: any) => {
  return await saleService.completeSale({
    ...data,
    deviceId: 'desktop-main-pos',
  })
})

ipcMain.handle('sales:getAll', async () => {
  return await prisma.sale.findMany({
    include: {
      items: {
        include: {
          batch: {
            include: { medicine: true },
          },
        },
      },
      customer: true,
      payments: true,
      prescription: true,
    },
    orderBy: { date: 'desc' },
  })
})

ipcMain.handle('sales:refund', async (_, id: string) => {
  const res = await saleService.refundSale(id)
  await recordAudit({
    action: 'SALE_REFUND',
    category: 'SALES',
    details: `Sale transaction #${id.slice(0, 8)} was refunded and reversed`,
    severity: 'WARNING',
    metadata: { saleId: id },
  })
  return res
})

// ─── Dashboard Stats ─────────────────────────────────────────────────────────
ipcMain.handle('dashboard:stats', async () => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const endOfDay = new Date(today)
  endOfDay.setHours(23, 59, 59, 999)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)
  const endOfYesterday = new Date(yesterday)
  endOfYesterday.setHours(23, 59, 59, 999)

  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1)
  const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999)

  const last7DaysStart = new Date(today)
  last7DaysStart.setDate(last7DaysStart.getDate() - 6) // last 7 days including today

  const [
    todaySales, yesterdaySales,
    mtdSales, lastMonthSales,
    mtdPurchases, lastMonthPurchases,
    last7DaysSales,
    lowStockBatches,
    expiringBatchesAll
  ] = await Promise.all([
    prisma.sale.findMany({ where: { date: { gte: today, lte: endOfDay } } }),
    prisma.sale.findMany({ where: { date: { gte: yesterday, lte: endOfYesterday } } }),
    prisma.sale.findMany({ where: { date: { gte: startOfMonth, lte: endOfDay } }, include: { items: { include: { batch: { include: { medicine: true } } } }, customer: true, payments: true } }),
    prisma.sale.findMany({ where: { date: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.purchase.findMany({ where: { date: { gte: startOfMonth, lte: endOfDay } } }),
    prisma.purchase.findMany({ where: { date: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.sale.findMany({ where: { date: { gte: last7DaysStart, lte: endOfDay } } }),
    prisma.batch.findMany({
      where: { quantity: { lte: 10, gt: 0 } },
      include: { medicine: true },
      orderBy: { quantity: 'asc' },
      take: 5
    }),
    prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) } },
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' },
      take: 5
    })
  ])

  const sumSales = (sales: any[]) => sales.reduce((acc, sale) => acc + sale.total, 0)
  const sumPurchases = (purchases: any[]) => purchases.reduce((acc, p) => acc + p.total, 0)
  const calcTrendStr = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const trend = ((current - previous) / previous) * 100
    return trend > 0 ? `+${trend.toFixed(1)}%` : `${trend.toFixed(1)}%`
  }

  const todayRevenue = sumSales(todaySales)
  const yesterdayRevenue = sumSales(yesterdaySales)
  const todayRevenueTrend = calcTrendStr(todayRevenue, yesterdayRevenue)

  const mtdRevenue = sumSales(mtdSales)
  const lastMonthRevenue = sumSales(lastMonthSales)
  const mtdRevenueTrend = calcTrendStr(mtdRevenue, lastMonthRevenue)

  const todayTransactions = todaySales.length
  const todayTransactionsTrend = calcTrendStr(todayTransactions, yesterdaySales.length)

  const mtdGrossProfit = mtdRevenue - sumPurchases(mtdPurchases)
  const lastMonthGrossProfit = lastMonthRevenue - sumPurchases(lastMonthPurchases)
  const mtdGrossProfitTrend = calcTrendStr(mtdGrossProfit, lastMonthGrossProfit)

  // Sales Overview (Last 7 days)
  const salesByDay = new Map<string, number>()
  for (let d = new Date(last7DaysStart); d <= endOfDay; d.setDate(d.getDate() + 1)) {
    salesByDay.set(d.toLocaleDateString('en-US', { weekday: 'short' }), 0)
  }
  for (const sale of last7DaysSales) {
    const day = sale.date.toLocaleDateString('en-US', { weekday: 'short' })
    salesByDay.set(day, (salesByDay.get(day) || 0) + sale.total)
  }
  const salesOverviewData: { day: string, sales: number }[] = []
  salesByDay.forEach((sales, day) => salesOverviewData.push({ day, sales }))

  // Payment Breakdown (Strictly Cash & Mobile Money)
  let mtdCash = 0
  let mtdMobile = 0
  for (const sale of mtdSales) {
    if ((sale as any).payments && (sale as any).payments.length > 0) {
      for (const p of (sale as any).payments) {
        const method = (p.method || 'CASH').toUpperCase()
        if (method.includes('MOBILE') || method.includes('MOMO')) {
          mtdMobile += Number(p.amount) || 0
        } else {
          mtdCash += Number(p.amount) || 0
        }
      }
    } else {
      const pm = (sale.paymentMethod || 'CASH').toUpperCase()
      const tot = Number(sale.total) || 0
      if (pm.startsWith('SPLIT:')) {
        const cashMatch = pm.match(/CASH[=:]\s*([0-9.]+)/i)
        const mobileMatch = pm.match(/MOBILE[=:]\s*([0-9.]+)/i)
        const c = cashMatch ? parseFloat(cashMatch[1]) : 0
        const m = mobileMatch ? parseFloat(mobileMatch[1]) : 0
        if (c > 0 || m > 0) {
          mtdCash += c
          mtdMobile += m
        } else {
          mtdCash += tot / 2
          mtdMobile += tot / 2
        }
      } else if (pm === 'SPLIT') {
        mtdCash += tot / 2
        mtdMobile += tot / 2
      } else if (pm.includes('MOBILE') || pm.includes('MOMO')) {
        mtdMobile += tot
      } else {
        mtdCash += tot
      }
    }
  }

  const paymentData: any[] = [
    {
      name: 'Cash',
      value: mtdCash,
      percent: mtdRevenue > 0 ? Math.round((mtdCash / mtdRevenue) * 100) : 0,
      color: '#22c55e'
    },
    {
      name: 'Mobile Money',
      value: mtdMobile,
      percent: mtdRevenue > 0 ? Math.round((mtdMobile / mtdRevenue) * 100) : 0,
      color: '#f59e0b'
    }
  ]

  // Top Medicines (from MTD Sales)
  const medicineTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of mtdSales) {
    for (const item of sale.items) {
      if (!item.batch?.medicine) continue
      const med = item.batch.medicine
      const existing = medicineTotals.get(med.id) || { name: med.name, qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += item.price * item.quantity
      medicineTotals.set(med.id, existing)
    }
  }
  const topMedicinesArr: any[] = []
  medicineTotals.forEach(m => topMedicinesArr.push(m))
  const topMedicines = topMedicinesArr
    .sort((a, b) => b.revenue - a.revenue)
    .map((m, i) => ({
      rank: i + 1,
      name: m.name,
      desc: `${m.qty} items sold`,
      price: `₵${m.revenue.toLocaleString()}.00`
    }))

  // Recent Transactions
  const recentTransactions = [...mtdSales]
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((sale) => {
      let pMethod = sale.paymentMethod
      if (sale.paymentMethod === 'SPLIT' && (sale as any).payments && (sale as any).payments.length > 0) {
        pMethod = `Split (${(sale as any).payments.map((p: any) => PAYMENT_LABELS[p.method.toUpperCase()] || p.method).join(' + ')})`
      }
      return {
        id: `INV-${sale.id.slice(0, 6).toUpperCase()}`,
        customer: sale.customer?.name || 'Walk-in Customer',
        time: sale.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        date: sale.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: sale.total,
        paymentMethod: pMethod
      }
    })

  const lowStockItems = lowStockBatches.map(b => ({
    name: b.medicine?.name || 'Unknown',
    left: b.quantity
  }))

  const expiringItems = expiringBatchesAll.map(b => {
    const days = Math.ceil((b.expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    return {
      name: b.medicine?.name || 'Unknown',
      days: `Expires in ${days} days`
    }
  })

  return {
    todayRevenue,
    todayRevenueTrend,
    mtdRevenue,
    mtdRevenueTrend,
    todayTransactions,
    todayTransactionsTrend,
    mtdGrossProfit,
    mtdGrossProfitTrend,
    salesOverviewData,
    paymentData,
    topMedicines,
    recentTransactions,
    lowStockItems,
    expiringItems,
  }
})

// ─── Prescriptions ─────────────────────────────────────────────────────────────
ipcMain.handle('prescriptions:getAll', async () => {
  return prisma.prescription.findMany({
    include: { customer: true, sale: { include: { items: { include: { batch: { include: { medicine: true } } } } } } },
    orderBy: { date: 'desc' },
  })
})

// ─── Purchases ─────────────────────────────────────────────────────────────────
ipcMain.handle('purchases:getAll', async () => {
  return prisma.purchase.findMany({
    include: { supplier: true, items: { include: { batches: true } } },
    orderBy: { date: 'desc' },
  })
})

ipcMain.handle('purchases:create', async (_, data: any) => {
  return await purchaseService.createPurchase({
    ...data,
    deviceId: 'desktop-main-pos',
  })
})

ipcMain.handle('purchases:delete', async (_, id: string) => {
  return await prisma.$transaction(async (tx) => {
    const existing = await tx.purchase.findUnique({ where: { id } })
    // Delete batches associated with purchase items first
    const items = await tx.purchaseItem.findMany({ where: { purchaseId: id } })
    for (const item of items) {
      await tx.batch.deleteMany({ where: { purchaseItemId: item.id } })
    }
    const deleted = await tx.purchase.delete({ where: { id } })

    await recordAudit({
      action: 'PURCHASE_DELETE',
      category: 'INVENTORY',
      details: `Purchase order #${id.slice(0, 8)} for GH₵${existing?.total?.toFixed(2) ?? '0.00'} was deleted`,
      severity: 'WARNING',
      metadata: { purchaseId: id, total: existing?.total },
    })

    return deleted
  })
})

ipcMain.handle('purchases:update', async (_, id: string, data: { supplierId: string; total: number; items: { medicineId: string; quantity: number; cost: number; batchNumber: string; expiryDate: string }[] }) => {
  return await prisma.$transaction(async (tx) => {
    // Delete existing batches for this purchase
    const existingItems = await tx.purchaseItem.findMany({ where: { purchaseId: id } })
    for (const item of existingItems) {
      await tx.batch.deleteMany({ where: { purchaseItemId: item.id } })
    }
    // Delete existing purchase items
    await tx.purchaseItem.deleteMany({ where: { purchaseId: id } })

    // Update purchase info
    const purchase = await tx.purchase.update({
      where: { id },
      data: {
        supplierId: data.supplierId,
        total: data.total,
        items: {
          create: data.items.map((i) => ({
            medicineId: i.medicineId,
            quantity: i.quantity,
            cost: i.cost,
          })),
        },
      },
      include: { items: true },
    })

    // Recreate batches using the actual new item order
    for (let index = 0; index < data.items.length; index++) {
      const item = data.items[index]
      const createdItem = purchase.items[index]
      await tx.batch.create({
        data: {
          medicineId: item.medicineId,
          batchNumber: item.batchNumber,
          expiryDate: new Date(item.expiryDate),
          quantity: item.quantity,
          purchaseItemId: createdItem?.id,
        },
      })
    }
    await recordAudit({
      action: 'PURCHASE_UPDATE',
      category: 'PURCHASES',
      details: `Purchase order #${id.slice(0, 8)} updated (New total: GH₵${data.total.toFixed(2)}, ${data.items.length} items)`,
      severity: 'WARNING',
      metadata: { purchaseId: id, total: data.total, itemCount: data.items.length },
    })
    return purchase
  })
})

// ─── Backup ───────────────────────────────────────────────────────────────────
ipcMain.handle('backup:export', async () => {
  const dbPath = resolveDatabasePath()
  
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Database Backup',
    defaultPath: `sml-coldstore-backup-${new Date().toISOString().split('T')[0]}.db`,
    filters: [{ name: 'SQLite DB', extensions: ['db'] }],
  })

  if (filePath) {
    fs.copyFileSync(dbPath, filePath)
    await recordAudit({
      action: 'BACKUP_EXPORT',
      category: 'SYSTEM',
      details: `Database backup snapshot exported to ${path.basename(filePath)}`,
      severity: 'INFO',
      metadata: { destination: filePath },
    })
    return { success: true, path: filePath }
  }
  return { success: false }
})

// ─── Print POS ────────────────────────────────────────────────────────────────
ipcMain.handle('system:getPrinters', async () => {
  try {
    const win = mainWindow || new BrowserWindow({ show: false })
    const printers = await win.webContents.getPrintersAsync()
    if (!mainWindow) win.close()
    return printers
  } catch (err) {
    console.error('Failed to get system printers:', err)
    return []
  }
})

ipcMain.handle('print:receipt', async (_, htmlContent: string) => {
  let configuredPrinter = ''
  try {
    const setting = await prisma.setting.findUnique({ where: { key: 'hw.printerName' } })
    if (setting?.value) {
      configuredPrinter = setting.value.trim()
    }
  } catch (err) {
    console.error('Error reading hw.printerName setting:', err)
  }

  // Wrap the receipt HTML fragment in a full document with proper
  // thermal-printer-friendly @page rules and charset declaration
  const wrappedHTML = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    @page {
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      width: 72mm;
      max-width: 100%;
      font-family: 'Courier New', Courier, monospace;
      font-size: 11px;
      color: #000;
      background: #fff;
      -webkit-print-color-adjust: exact;
    }
    body { padding: 2mm 4mm 2mm 2mm; }
    table { border-collapse: collapse; width: 100%; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`

  const printWindow = new BrowserWindow({
    show: false,
    width: 302,   // ~80mm at 96 DPI
    height: 800,
    webPreferences: { nodeIntegration: true }
  })
  printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(wrappedHTML)}`)

  return new Promise((resolve) => {
    printWindow.webContents.on('did-finish-load', async () => {
      // Small delay to ensure full render before printing
      await new Promise((r) => setTimeout(r, 300))

      let printers: Electron.PrinterInfo[] = []
      try {
        printers = await printWindow.webContents.getPrintersAsync()
      } catch (e) {
        console.error('Failed to get printers:', e)
      }

      const printOptions: Electron.WebContentsPrintOptions = {
        silent: true,
        printBackground: true,
        margins: { marginType: 'none' },
        pageSize: { width: 80000, height: 297000 },  // 80mm × 297mm in microns
      }

      if (configuredPrinter) {
        const matched = printers.find(
          (p) =>
            p.name.toLowerCase() === configuredPrinter.toLowerCase() ||
            p.displayName?.toLowerCase() === configuredPrinter.toLowerCase()
        )
        if (matched) {
          printOptions.deviceName = matched.name
        } else {
          printOptions.deviceName = configuredPrinter
        }
      } else {
        const defaultPrinter = printers.find((p) => p.isDefault)
        const defaultName = (defaultPrinter?.name || '').toLowerCase()

        const isVirtualOrOneNote =
          !defaultName ||
          defaultName.includes('onenote') ||
          defaultName.includes('pdf') ||
          defaultName.includes('xps') ||
          defaultName.includes('fax')

        if (isVirtualOrOneNote) {
          const realPrinter = printers.find((p) => {
            const name = p.name.toLowerCase()
            return (
              !name.includes('onenote') &&
              !name.includes('pdf') &&
              !name.includes('xps') &&
              !name.includes('fax') &&
              !name.includes('microsoft')
            )
          })

          if (realPrinter) {
            printOptions.deviceName = realPrinter.name
          } else {
            printOptions.silent = false
          }
        }
      }

      printWindow.webContents.print(printOptions, (success, failureReason) => {
        printWindow.close()
        if (!success) {
          console.error('Print failed:', failureReason)
        }
        resolve({ success, failureReason })
      })
    })
  })
})

// ─── Cash Drawer ──────────────────────────────────────────────────────────────

// Helper: send raw bytes directly to a Windows printer using winspool.drv WritePrinter API
function sendRawBytesToPrinter(printerName: string, data: Buffer): Promise<{ success: boolean; error?: string }> {
  const { execSync } = require('child_process')
  const timestamp = Date.now()
  const tmpBinFile = path.join(app.getPath('temp'), `drawer_kick_${timestamp}.bin`)
  const tmpPs1File = path.join(app.getPath('temp'), `drawer_kick_${timestamp}.ps1`)

  fs.writeFileSync(tmpBinFile, data)

  // Write the PowerShell script to a temp file to avoid quote-escaping issues
  const psScript = `
Add-Type @'
using System;
using System.IO;
using System.Runtime.InteropServices;

public class RawPrint {
    [StructLayout(LayoutKind.Sequential)] public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDatatype;
    }
    [DllImport("winspool.Drv", EntryPoint="OpenPrinterA", SetLastError=true)]
    public static extern bool OpenPrinter(string p, out IntPtr hP, IntPtr d);
    [DllImport("winspool.Drv", EntryPoint="ClosePrinter", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr hP);
    [DllImport("winspool.Drv", EntryPoint="StartDocPrinterA", SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr hP, int l, ref DOCINFOA di);
    [DllImport("winspool.Drv", EntryPoint="EndDocPrinter", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr hP);
    [DllImport("winspool.Drv", EntryPoint="StartPagePrinter", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr hP);
    [DllImport("winspool.Drv", EntryPoint="EndPagePrinter", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr hP);
    [DllImport("winspool.Drv", EntryPoint="WritePrinter", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr hP, IntPtr pB, int c, out int w);

    public static bool Send(string name, byte[] data) {
        IntPtr hP;
        if (!OpenPrinter(name, out hP, IntPtr.Zero)) return false;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "CashDrawerKick";
        di.pDatatype = "RAW";
        if (!StartDocPrinter(hP, 1, ref di)) { ClosePrinter(hP); return false; }
        if (!StartPagePrinter(hP)) { EndDocPrinter(hP); ClosePrinter(hP); return false; }
        IntPtr pU = Marshal.AllocCoTaskMem(data.Length);
        Marshal.Copy(data, 0, pU, data.Length);
        int w; bool ok = WritePrinter(hP, pU, data.Length, out w);
        Marshal.FreeCoTaskMem(pU);
        EndPagePrinter(hP); EndDocPrinter(hP); ClosePrinter(hP);
        return ok;
    }
}
'@
$bytes = [System.IO.File]::ReadAllBytes('${tmpBinFile.replace(/\\/g, '\\\\')}')
$result = [RawPrint]::Send('${printerName.replace(/'/g, "''")}', $bytes)
if ($result) { Write-Output 'OK' } else { Write-Output 'FAIL'; exit 1 }
`
  fs.writeFileSync(tmpPs1File, psScript, 'utf-8')

  try {
    const result = execSync(
      `powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpPs1File}"`,
      { timeout: 10000, encoding: 'utf-8' }
    )
    return Promise.resolve({ success: result.trim().includes('OK') })
  } catch (err: any) {
    console.error('Raw print error:', err.message)
    return Promise.resolve({ success: false, error: err.message })
  } finally {
    try { fs.unlinkSync(tmpBinFile) } catch (_) { /* ignore */ }
    try { fs.unlinkSync(tmpPs1File) } catch (_) { /* ignore */ }
  }
}

ipcMain.handle('cash-drawer:open', async () => {
  try {
    // Read drawer settings
    const drawerEnabledSetting = await prisma.setting.findUnique({ where: { key: 'hw.drawerEnabled' } })
    if (drawerEnabledSetting?.value !== 'true') {
      return { success: false, reason: 'Cash drawer is disabled in settings' }
    }

    const drawerPortSetting = await prisma.setting.findUnique({ where: { key: 'hw.drawerPort' } })
    const drawerPort = drawerPortSetting?.value?.trim() || 'Via Printer'

    const pulseSetting = await prisma.setting.findUnique({ where: { key: 'hw.drawerPulseMs' } })
    const pulseMs = Math.min(Math.max(parseInt(pulseSetting?.value || '200', 10) || 200, 100), 999)

    // ESC/POS cash drawer kick commands:
    // Pin 0 (pin 2) and Pin 1 (pin 5) to support both RJ11/RJ12 pinouts
    // on-time and off-time are in units of 2ms
    const onTime = Math.min(Math.round(pulseMs / 2), 255)
    const offTime = Math.min(Math.round(pulseMs / 2), 255)
    const kickBytes = Buffer.from([
      0x1B, 0x70, 0x00, onTime, offTime, // ESC p 0 (pin 2)
      0x1B, 0x70, 0x01, onTime, offTime, // ESC p 1 (pin 5)
      0x10, 0x14, 0x01, 0x00, 0x05,       // DLE DC4 real-time kick
      0x07                                // BEL trigger
    ])

    if (drawerPort === 'Via Printer') {
      // Send kick command through the receipt printer as RAW data
      let printerName = ''
      try {
        const setting = await prisma.setting.findUnique({ where: { key: 'hw.printerName' } })
        if (setting?.value) printerName = setting.value.trim()
      } catch (_) { /* use default */ }

      if (!printerName) {
        // Fallback: look for an installed thermal/receipt printer
        try {
          const { execSync } = require('child_process')
          const output = execSync('powershell -Command "Get-Printer | Select-Object -ExpandProperty Name"', { encoding: 'utf-8' })
          const names = output.split(/\r?\n/).map((s: string) => s.trim()).filter(Boolean)
          const matched = names.find((n: string) => !n.includes('OneNote') && !n.includes('PDF') && !n.includes('XPS') && !n.includes('Fax'))
          if (matched) printerName = matched
        } catch (_) { /* ignore */ }
      }

      if (!printerName) {
        return { success: false, reason: 'No receipt printer configured. Set the printer name in Settings → Receipt Printer.' }
      }

      const result = await sendRawBytesToPrinter(printerName, kickBytes)
      if (result.success) {
        return { success: true }
      } else {
        return { success: false, reason: result.error || 'Failed to send drawer kick command to printer' }
      }
    } else {
      // Direct COM port: write raw ESC/POS bytes to the serial port
      const { execSync } = require('child_process')
      const tmpFile = path.join(app.getPath('temp'), 'drawer_kick.bin')
      fs.writeFileSync(tmpFile, kickBytes)

      try {
        execSync(
          `powershell -NoProfile -Command "$port = New-Object System.IO.Ports.SerialPort('${drawerPort}', 9600); $port.Open(); $bytes = [System.IO.File]::ReadAllBytes('${tmpFile.replace(/\\/g, '\\\\')}'); $port.Write($bytes, 0, $bytes.Length); $port.Close()"`,
          { timeout: 5000 }
        )
        return { success: true }
      } catch (err: any) {
        console.error('Cash drawer COM port error:', err.message)
        return { success: false, reason: err.message }
      } finally {
        try { fs.unlinkSync(tmpFile) } catch (_) { /* ignore */ }
      }
    }
  } catch (err: any) {
    console.error('Cash drawer error:', err)
    return { success: false, reason: err.message }
  }
})

// ─── Reports ──────────────────────────────────────────────────────────────────

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#22c55e',
  MOBILE: '#3b82f6',
  CARD: '#a855f7',
  'BANK TRANSFER': '#f97316',
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  MOBILE: 'Mobile Money',
  CARD: 'Card',
  'BANK TRANSFER': 'Bank Transfer',
}

function parseReportDate(dateStr: string, endOfDay = false): Date {
  const date = new Date(dateStr)
  if (endOfDay) {
    date.setHours(23, 59, 59, 999)
  } else {
    date.setHours(0, 0, 0, 0)
  }
  return date
}

function calcTrend(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function eachDay(start: Date, end: Date): Date[] {
  const days: Date[] = []
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const endDay = new Date(end)
  endDay.setHours(0, 0, 0, 0)
  while (cursor <= endDay) {
    days.push(new Date(cursor))
    cursor.setDate(cursor.getDate() + 1)
  }
  return days
}

function formatDayLabel(date: Date): string {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

function daysUntil(date: Date): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const target = new Date(date)
  target.setHours(0, 0, 0, 0)
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

async function buildReportsData(startDate: string, endDate: string) {
  const start = parseReportDate(startDate)
  const end = parseReportDate(endDate, true)

  const periodMs = end.getTime() - start.getTime()
  const prevEnd = new Date(start.getTime() - 1)
  prevEnd.setHours(23, 59, 59, 999)
  const prevStart = new Date(prevEnd.getTime() - periodMs)
  prevStart.setHours(0, 0, 0, 0)

  const [sales, purchases, prevSales, prevPurchases, expiringBatches, recentSales, allActiveBatches, allMedicines] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: {
        customer: true,
        items: { include: { batch: { include: { medicine: true } } } },
        payments: true,
      },
      orderBy: { date: 'desc' },
    }),
    prisma.purchase.findMany({
      where: { date: { gte: start, lte: end } },
      include: { supplier: true },
      orderBy: { date: 'desc' },
    }),
    prisma.sale.findMany({
      where: { date: { gte: prevStart, lte: prevEnd } },
      include: {
        items: { include: { batch: { include: { medicine: true } } } },
      },
    }),
    prisma.purchase.findMany({ where: { date: { gte: prevStart, lte: prevEnd } } }),
    prisma.batch.findMany({
      where: {
        quantity: { gt: 0 },
        expiryDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) },
      },
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' },
      take: 8,
    }),
    prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: { customer: true, payments: true },
      orderBy: { date: 'desc' },
      take: 8,
    }),
    prisma.batch.findMany({
      where: { quantity: { gt: 0 } },
      include: { medicine: true },
    }),
    prisma.medicine.findMany({
      include: { category: true, batches: true },
    }),
  ])

  const totalSales = sales.reduce((acc, sale) => acc + sale.total, 0)
  const totalPurchases = purchases.reduce((acc, purchase) => acc + purchase.total, 0)
  const transactions = sales.length
  const days = eachDay(start, end)
  const dayCount = Math.max(1, days.length)
  const avgDailySales = totalSales / dayCount

  const prevTotalSales = prevSales.reduce((acc, sale) => acc + sale.total, 0)
  const prevTotalPurchases = prevPurchases.reduce((acc, purchase) => acc + purchase.total, 0)
  const prevTransactions = prevSales.length
  const prevAvgDaily = prevTotalSales / dayCount

  // 1. Calculate COGS and product sales for the current period
  let totalCogs = 0
  const salesByDay = new Map<string, number>()
  const cogsByDay = new Map<string, number>()
  const purchasesByDay = new Map<string, number>()
  const transactionsByDay = new Map<string, number>()
  const productSalesMap = new Map<string, { qty: number; revenue: number; cogs: number }>()

  for (const sale of sales) {
    const key = formatDayLabel(sale.date)
    salesByDay.set(key, (salesByDay.get(key) || 0) + sale.total)
    transactionsByDay.set(key, (transactionsByDay.get(key) || 0) + 1)

    let saleCogs = 0
    for (const item of sale.items) {
      const med = item.batch?.medicine
      const medId = med?.id || 'unknown'
      const qty = item.quantity || 0
      const price = item.price || med?.price || 0
      const unitCost = med?.cost || 0

      const itemCogs = qty * unitCost
      saleCogs += itemCogs

      const existingProd = productSalesMap.get(medId) || { qty: 0, revenue: 0, cogs: 0 }
      existingProd.qty += qty
      existingProd.revenue += qty * price
      existingProd.cogs += itemCogs
      productSalesMap.set(medId, existingProd)
    }
    totalCogs += saleCogs
    cogsByDay.set(key, (cogsByDay.get(key) || 0) + saleCogs)
  }

  // 2. Previous period COGS for trend analysis
  let prevTotalCogs = 0
  for (const sale of prevSales) {
    for (const item of sale.items) {
      const med = item.batch?.medicine
      const qty = item.quantity || 0
      const unitCost = med?.cost || 0
      prevTotalCogs += qty * unitCost
    }
  }

  for (const purchase of purchases) {
    const key = formatDayLabel(purchase.date)
    purchasesByDay.set(key, (purchasesByDay.get(key) || 0) + purchase.total)
  }

  // 3. Profit Earned (Realized Gross Profit on sales: Total Sales - COGS)
  const profitEarned = totalCogs > 0 ? (totalSales - totalCogs) : (totalSales - totalPurchases)
  const prevProfitEarned = prevTotalCogs > 0 ? (prevTotalSales - prevTotalCogs) : (prevTotalSales - prevTotalPurchases)
  const profitMargin = totalSales > 0 ? (profitEarned / totalSales) * 100 : 0
  const grossProfit = profitEarned
  const prevGrossProfit = prevProfitEarned

  // 4. Current Inventory Stock Valuation and Profits Expected
  const stockByProduct = new Map<string, number>()
  for (const batch of allActiveBatches) {
    const qty = batch.quantity || 0
    if (qty > 0 && batch.medicineId) {
      stockByProduct.set(batch.medicineId, (stockByProduct.get(batch.medicineId) || 0) + qty)
    }
  }

  let inventoryCost = 0
  let expectedInventoryRevenue = 0
  for (const med of allMedicines) {
    const stock = stockByProduct.get(med.id) || 0
    const cost = Number(med.cost) || 0
    const price = Number(med.price) || 0
    inventoryCost += stock * cost
    expectedInventoryRevenue += stock * price
  }
  const profitsExpected = Math.max(0, expectedInventoryRevenue - inventoryCost)

  // 5. Product-by-product P&L breakdown
  const profitBreakdown = allMedicines.map((med) => {
    const salesData = productSalesMap.get(med.id) || { qty: 0, revenue: 0, cogs: 0 }
    const itemProfitEarned = salesData.revenue - salesData.cogs
    const marginPercent = salesData.revenue > 0 ? (itemProfitEarned / salesData.revenue) * 100 : 0
    const currentStock = stockByProduct.get(med.id) || 0
    const unitCost = Number(med.cost) || 0
    const unitPrice = Number(med.price) || 0
    const stockCost = currentStock * unitCost
    const expRevenue = currentStock * unitPrice
    const expectedProfit = Math.max(0, expRevenue - stockCost)

    return {
      id: med.id,
      name: med.name,
      category: med.category?.name || 'General',
      quantitySold: salesData.qty,
      revenue: salesData.revenue,
      cogs: salesData.cogs,
      profitEarned: itemProfitEarned,
      marginPercent,
      currentStock,
      stockCost,
      expectedProfit,
    }
  }).filter((p) => p.quantitySold > 0 || p.currentStock > 0)
    .sort((a, b) => b.profitEarned - a.profitEarned || b.revenue - a.revenue)

  const salesOverview = days.map((day) => {
    const label = formatDayLabel(day)
    const daySales = salesByDay.get(label) || 0
    const dayPurchases = purchasesByDay.get(label) || 0
    const dayCogs = cogsByDay.get(label) || 0
    const dayProfit = dayCogs > 0 ? (daySales - dayCogs) : (daySales - dayPurchases)
    return {
      date: label,
      sales: daySales,
      purchases: dayPurchases,
      cogs: dayCogs,
      profit: dayProfit,
      transactions: transactionsByDay.get(label) || 0,
    }
  })

  let cashTotal = 0
  let mobileTotal = 0
  for (const sale of sales) {
    if ((sale as any).payments && (sale as any).payments.length > 0) {
      for (const p of (sale as any).payments) {
        const method = (p.method || 'CASH').toUpperCase()
        if (method.includes('MOBILE') || method.includes('MOMO')) {
          mobileTotal += Number(p.amount) || 0
        } else {
          cashTotal += Number(p.amount) || 0
        }
      }
    } else {
      const pm = (sale.paymentMethod || 'CASH').toUpperCase()
      const tot = Number(sale.total) || 0
      if (pm.startsWith('SPLIT:')) {
        const cashMatch = pm.match(/CASH[=:]\s*([0-9.]+)/i)
        const mobileMatch = pm.match(/MOBILE[=:]\s*([0-9.]+)/i)
        const c = cashMatch ? parseFloat(cashMatch[1]) : 0
        const m = mobileMatch ? parseFloat(mobileMatch[1]) : 0
        if (c > 0 || m > 0) {
          cashTotal += c
          mobileTotal += m
        } else {
          cashTotal += tot / 2
          mobileTotal += tot / 2
        }
      } else if (pm === 'SPLIT') {
        cashTotal += tot / 2
        mobileTotal += tot / 2
      } else if (pm.includes('MOBILE') || pm.includes('MOMO')) {
        mobileTotal += tot
      } else {
        cashTotal += tot
      }
    }
  }

  const paymentBreakdown = [
    {
      name: 'Cash',
      value: cashTotal,
      percent: totalSales > 0 ? (cashTotal / totalSales) * 100 : 0,
      color: '#22c55e',
    },
    {
      name: 'Mobile Money',
      value: mobileTotal,
      percent: totalSales > 0 ? (mobileTotal / totalSales) * 100 : 0,
      color: '#f59e0b',
    },
  ]

  const medicineTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of sales) {
    for (const item of sale.items) {
      const med = item.batch.medicine
      const existing = medicineTotals.get(med.id) || { name: med.name, qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += item.price * item.quantity
      medicineTotals.set(med.id, existing)
    }
  }

  const topMedicinesArr: any[] = []
  medicineTotals.forEach(m => topMedicinesArr.push(m))
  const topMedicines = topMedicinesArr
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const recentTransactions = recentSales.map((sale) => {
    let paymentLabel = 'Cash'
    const pm = (sale.paymentMethod || '').toUpperCase()
    if ((sale as any).payments && (sale as any).payments.length > 1) {
      const parts = (sale as any).payments.map((p: any) => {
        const m = (p.method || '').toUpperCase().includes('MOBILE') ? 'Mobile' : 'Cash'
        return `${m}: GH₵${Number(p.amount).toFixed(2)}`
      })
      paymentLabel = `Split (${parts.join(' + ')})`
    } else if (pm.startsWith('SPLIT:')) {
      const cashMatch = pm.match(/CASH[=:]\s*([0-9.]+)/i)
      const mobileMatch = pm.match(/MOBILE[=:]\s*([0-9.]+)/i)
      const c = cashMatch ? parseFloat(cashMatch[1]) : 0
      const m = mobileMatch ? parseFloat(mobileMatch[1]) : 0
      paymentLabel = `Split (Cash: GH₵${c.toFixed(2)} + Mobile: GH₵${m.toFixed(2)})`
    } else if (pm.includes('MOBILE') || pm.includes('MOMO')) {
      paymentLabel = 'Mobile Money'
    } else {
      paymentLabel = 'Cash'
    }
    return {
      id: `INV-${sale.id.slice(0, 8).toUpperCase()}`,
      customer: sale.customer?.name || 'Walk-in Customer',
      amount: sale.total,
      payment: paymentLabel,
      time: formatTime(sale.date),
    }
  })

  const expiring = expiringBatches.map((batch) => ({
    name: batch.medicine.name,
    batch: batch.batchNumber,
    days: daysUntil(batch.expiryDate),
  }))

  const purchaseRows = purchases.slice(0, 20).map((purchase) => ({
    id: purchase.id,
    date: purchase.date.toISOString(),
    supplier: purchase.supplier.name,
    total: purchase.total,
    status: purchase.status,
  }))

  // 6. Comprehensive Cold Store Inventory Report
  const inventoryItems = allMedicines.map((med: any) => {
    const medBatches = med.batches || []
    const currentStock = stockByProduct.get(med.id) || 0
    const unitCost = Number(med.cost) || 0
    const unitPrice = Number(med.price) || 0
    const minStockLevel = Number(med.minStockLevel) || 10
    const totalCostValue = currentStock * unitCost
    const totalRetailValue = currentStock * unitPrice
    const potentialProfit = Math.max(0, totalRetailValue - totalCostValue)
    const marginPercent = totalRetailValue > 0 ? (potentialProfit / totalRetailValue) * 100 : 0

    let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK'
    if (currentStock === 0) {
      status = 'OUT_OF_STOCK'
    } else if (currentStock <= minStockLevel) {
      status = 'LOW_STOCK'
    }

    const batches = medBatches.map((b: any) => {
      const days = daysUntil(b.expiryDate)
      let batchStatus: 'HEALTHY' | 'EXPIRING_SOON' | 'EXPIRED' = 'HEALTHY'
      if (days <= 0) {
        batchStatus = 'EXPIRED'
      } else if (days <= 60) {
        batchStatus = 'EXPIRING_SOON'
      }
      return {
        id: b.id,
        batchNumber: b.batchNumber || 'N/A',
        quantity: Number(b.quantity) || 0,
        expiryDate: new Date(b.expiryDate).toISOString(),
        daysToExpiry: days,
        status: batchStatus,
      }
    }).sort((a: any, b: any) => a.daysToExpiry - b.daysToExpiry)

    return {
      id: med.id,
      name: med.name,
      sku: med.sku || 'N/A',
      category: med.category?.name || 'General',
      currentStock,
      minStockLevel,
      unitCost,
      unitPrice,
      totalCostValue,
      totalRetailValue,
      potentialProfit,
      marginPercent,
      status,
      batchCount: batches.length,
      batches,
    }
  }).sort((a: any, b: any) => b.totalCostValue - a.totalCostValue || a.name.localeCompare(b.name))

  const totalCartons = inventoryItems.reduce((acc: number, i: any) => acc + i.currentStock, 0)
  const invTotalCostValue = inventoryItems.reduce((acc: number, i: any) => acc + i.totalCostValue, 0)
  const invTotalRetailValue = inventoryItems.reduce((acc: number, i: any) => acc + i.totalRetailValue, 0)
  const invTotalPotentialProfit = Math.max(0, invTotalRetailValue - invTotalCostValue)
  const invPotentialMarginPercent = invTotalRetailValue > 0 ? (invTotalPotentialProfit / invTotalRetailValue) * 100 : 0
  const healthyCount = inventoryItems.filter((i: any) => i.status === 'IN_STOCK').length
  const lowStockCount = inventoryItems.filter((i: any) => i.status === 'LOW_STOCK').length
  const outOfStockCount = inventoryItems.filter((i: any) => i.status === 'OUT_OF_STOCK').length

  const categoryMap = new Map<string, { itemCount: number; totalStock: number; totalCostValue: number; totalRetailValue: number }>()
  for (const item of inventoryItems) {
    const cat = item.category || 'General'
    const existing = categoryMap.get(cat) || { itemCount: 0, totalStock: 0, totalCostValue: 0, totalRetailValue: 0 }
    existing.itemCount += 1
    existing.totalStock += item.currentStock
    existing.totalCostValue += item.totalCostValue
    existing.totalRetailValue += item.totalRetailValue
    categoryMap.set(cat, existing)
  }

  const categoriesSummary = Array.from(categoryMap.entries()).map(([category, catData]) => ({
    category,
    itemCount: catData.itemCount,
    totalStock: catData.totalStock,
    totalCostValue: catData.totalCostValue,
    totalRetailValue: catData.totalRetailValue,
    percentOfTotalValue: invTotalCostValue > 0 ? (catData.totalCostValue / invTotalCostValue) * 100 : 0,
  })).sort((a, b) => b.totalCostValue - a.totalCostValue)

  const expiringBatchesCount = allActiveBatches.filter((b: any) => {
    const d = daysUntil(b.expiryDate)
    return (Number(b.quantity) || 0) > 0 && d > 0 && d <= 60
  }).length
  const expiredBatchesCount = allActiveBatches.filter((b: any) => {
    const d = daysUntil(b.expiryDate)
    return (Number(b.quantity) || 0) > 0 && d <= 0
  }).length

  const inventoryReport = {
    totalProducts: inventoryItems.length,
    totalCartons,
    totalCostValue: invTotalCostValue,
    totalRetailValue: invTotalRetailValue,
    totalPotentialProfit: invTotalPotentialProfit,
    potentialMarginPercent: invPotentialMarginPercent,
    healthyCount,
    lowStockCount,
    outOfStockCount,
    expiringBatchesCount,
    expiredBatchesCount,
    categories: categoriesSummary,
    items: inventoryItems,
  }

  return {
    kpis: {
      totalSales,
      cashSales: cashTotal,
      mobileSales: mobileTotal,
      totalPurchases,
      cogs: totalCogs,
      profitEarned,
      profitsExpected,
      profitMargin,
      inventoryCost: invTotalCostValue,
      expectedInventoryRevenue: invTotalRetailValue,
      inventoryCartons: totalCartons,
      inventoryItemsCount: inventoryItems.length,
      inventoryHealthyCount: healthyCount,
      inventoryLowStockCount: lowStockCount,
      inventoryOutOfStockCount: outOfStockCount,
      grossProfit,
      transactions,
      avgDailySales,
      salesTrend: calcTrend(totalSales, prevTotalSales),
      purchasesTrend: calcTrend(totalPurchases, prevTotalPurchases),
      profitTrend: calcTrend(grossProfit, prevGrossProfit),
      cogsTrend: calcTrend(totalCogs, prevTotalCogs),
      profitEarnedTrend: calcTrend(profitEarned, prevProfitEarned),
      transactionsTrend: calcTrend(transactions, prevTransactions),
      avgDailyTrend: calcTrend(avgDailySales, prevAvgDaily),
      salesSparkline: salesOverview.map((d) => d.sales),
      purchasesSparkline: salesOverview.map((d) => d.purchases),
      cogsSparkline: salesOverview.map((d) => d.cogs || 0),
      profitSparkline: salesOverview.map((d) => d.profit),
      transactionsSparkline: salesOverview.map((d) => d.transactions),
      avgDailySparkline: salesOverview.map((d) => (d.sales > 0 ? d.sales : 0)),
    },
    salesOverview,
    paymentBreakdown,
    topMedicines,
    recentTransactions,
    expiringBatches: expiring,
    purchases: purchaseRows,
    profitBreakdown,
    inventoryReport,
  }
}

ipcMain.handle('reports:getData', async (_, startDate: string, endDate: string) => {
  return buildReportsData(startDate, endDate)
})

ipcMain.handle('reports:exportExcel', async (_, startDate: string, endDate: string) => {
  const data = await buildReportsData(startDate, endDate)

  const workbook = new ExcelJS.Workbook()
  const summary = workbook.addWorksheet('Summary')
  summary.addRow(['SML Legacy Limited Cold Store Report'])
  summary.addRow(['Period', `${startDate} to ${endDate}`])
  summary.addRow([])
  summary.addRow(['Metric', 'Value'])
  summary.addRow(['Total Sales (Revenue)', data.kpis.totalSales])
  summary.addRow(['Cost of Goods Sold (COGS)', data.kpis.cogs ?? 0])
  summary.addRow(['Gross Profit Earned', data.kpis.profitEarned ?? data.kpis.grossProfit])
  summary.addRow(['Profit Margin (%)', `${(data.kpis.profitMargin ?? 0).toFixed(1)}%`])
  summary.addRow(['Current Inventory Valuation (Cost)', data.kpis.inventoryCost ?? 0])
  summary.addRow(['Profits Expected (Stock Realization)', data.kpis.profitsExpected ?? 0])
  summary.addRow(['Total Cash Sales', data.kpis.cashSales ?? 0])
  summary.addRow(['Total Mobile Money Sales', data.kpis.mobileSales ?? 0])
  summary.addRow(['Total Purchases', data.kpis.totalPurchases])
  summary.addRow(['Gross Profit', data.kpis.grossProfit])
  summary.addRow(['Transactions', data.kpis.transactions])
  summary.addRow(['Avg Daily Sales', data.kpis.avgDailySales])

  const salesSheet = workbook.addWorksheet('Sales')
  salesSheet.addRow(['Date', 'Sales', 'Purchases', 'COGS', 'Profit', 'Transactions'])
  data.salesOverview.forEach((row) => {
    salesSheet.addRow([row.date, row.sales, row.purchases, row.cogs || 0, row.profit, row.transactions])
  })

  if (data.profitBreakdown && data.profitBreakdown.length > 0) {
    const plSheet = workbook.addWorksheet('Profit & Loss')
    plSheet.addRow([
      'Product Name',
      'Category',
      'Units Sold',
      'Revenue (GH₵)',
      'COGS (GH₵)',
      'Profit Earned (GH₵)',
      'Margin (%)',
      'Stock Qty',
      'Stock Cost (GH₵)',
      'Profits Expected (GH₵)',
    ])
    data.profitBreakdown.forEach((p) => {
      plSheet.addRow([
        p.name,
        p.category,
        p.quantitySold,
        p.revenue,
        p.cogs,
        p.profitEarned,
        `${p.marginPercent.toFixed(1)}%`,
        p.currentStock,
        p.stockCost,
        p.expectedProfit,
      ])
    })
  }

  if (data.inventoryReport && data.inventoryReport.items.length > 0) {
    const invSheet = workbook.addWorksheet('Inventory Valuation & Stock')
    invSheet.addRow([
      'Product Name',
      'Category',
      'SKU',
      'Cartons On Hand',
      'Min Stock Alert',
      'Unit Cost (GH₵)',
      'Unit Selling Price (GH₵)',
      'Valuation Cost (GH₵)',
      'Valuation Retail (GH₵)',
      'Expected Profit (GH₵)',
      'Margin (%)',
      'Stock Status',
      'Batch Lots Count',
    ])
    data.inventoryReport.items.forEach((item) => {
      invSheet.addRow([
        item.name,
        item.category,
        item.sku,
        item.currentStock,
        item.minStockLevel,
        item.unitCost,
        item.unitPrice,
        item.totalCostValue,
        item.totalRetailValue,
        item.potentialProfit,
        `${item.marginPercent.toFixed(1)}%`,
        item.status,
        item.batchCount,
      ])
    })

    if (data.inventoryReport.categories && data.inventoryReport.categories.length > 0) {
      const catSheet = workbook.addWorksheet('Inventory Categories')
      catSheet.addRow(['Category', 'Product Count', 'Total Cartons', 'Cost Valuation (GH₵)', 'Retail Valuation (GH₵)', '% of Total Stock Value'])
      data.inventoryReport.categories.forEach((cat) => {
        catSheet.addRow([
          cat.category,
          cat.itemCount,
          cat.totalStock,
          cat.totalCostValue,
          cat.totalRetailValue,
          `${cat.percentOfTotalValue.toFixed(1)}%`,
        ])
      })
    }
  }

  const topSheet = workbook.addWorksheet('Top Medicines')
  topSheet.addRow(['Medicine', 'Quantity Sold', 'Revenue'])
  data.topMedicines.forEach((med) => {
    topSheet.addRow([med.name, med.qty, med.revenue])
  })

  const txnSheet = workbook.addWorksheet('Transactions')
  txnSheet.addRow(['Invoice', 'Customer', 'Amount', 'Payment', 'Time'])
  data.recentTransactions.forEach((txn) => {
    txnSheet.addRow([txn.id, txn.customer, txn.amount, txn.payment, txn.time])
  })

  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Report',
    defaultPath: `sml-coldstore-report-${startDate}-to-${endDate}.xlsx`,
    filters: [{ name: 'Excel', extensions: ['xlsx'] }],
  })

  if (!filePath) return { success: false }

  await workbook.xlsx.writeFile(filePath)
  return { success: true, path: filePath }
})

// ─── Users ────────────────────────────────────────────────────────────────────
ipcMain.handle('users:getAll', async () => {
  return prisma.user.findMany({
    select: { id: true, username: true, role: true, createdAt: true },
    orderBy: { username: 'asc' },
  })
})

ipcMain.handle('users:create', async (_, data: { username: string; passwordHash: string; role: string; pin?: string }) => {
  const password = await bcrypt.hash(data.passwordHash, 10)
  const newUser = await prisma.user.create({
    data: {
      username: data.username,
      password: password,
      role: data.role,
      pin: data.pin || null,
    }
  })
  await recordAudit({
    action: 'USER_CREATE',
    category: 'AUTH',
    details: `New staff user "${data.username}" created with role "${data.role}"`,
    severity: 'WARNING',
    metadata: { userId: newUser.id, username: data.username, role: data.role },
  })
  return newUser
})

// ─── Settings ─────────────────────────────────────────────────────────────────
ipcMain.handle('settings:get', async () => {
  const rows = await prisma.setting.findMany()
  const result: Record<string, string> = {}
  for (const row of rows) {
    result[row.key] = row.value
  }
  return result
})

ipcMain.handle('settings:set', async (_, updates: Record<string, string>) => {
  await Promise.all(
    Object.entries(updates).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      })
    )
  )
  await recordAudit({
    action: 'SETTINGS_UPDATE',
    category: 'SYSTEM',
    details: `Cold store system settings updated (${Object.keys(updates).join(', ')})`,
    severity: 'WARNING',
    metadata: { updatedKeys: Object.keys(updates) },
  })
  return { success: true }
})

// ─── Audit Trail (Important Activities Only) ──────────────────────────────────
ipcMain.handle('audit:getAll', async (_, filters?: { category?: string; severity?: string; startDate?: string; endDate?: string }) => {
  const where: any = {}
  if (filters?.category && filters.category !== 'all') {
    where.category = filters.category
  }
  if (filters?.severity && filters.severity !== 'all') {
    where.severity = filters.severity
  }
  if (filters?.startDate || filters?.endDate) {
    where.createdAt = {}
    if (filters.startDate) where.createdAt.gte = new Date(filters.startDate)
    if (filters.endDate) {
      const end = new Date(filters.endDate)
      end.setHours(23, 59, 59, 999)
      where.createdAt.lte = end
    }
  }
  return prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 300,
  })
})

ipcMain.handle('audit:log', async (_, data: { action: string; category: string; details: string; username?: string; userRole?: string; severity?: any; metadata?: any }) => {
  await recordAudit(data)
  return { success: true }
})

// ─── Sync Full State Mirror ───────────────────────────────────────────────────
ipcMain.handle('sync:getFullState', async () => {
  const [users, categories, customers, suppliers, purchases, settings] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.customer.findMany({ orderBy: { name: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.purchase.findMany({
      include: {
        supplier: true,
        items: { include: { medicine: true } }
      },
      orderBy: { date: 'desc' },
      take: 100
    }),
    prisma.setting.findMany(),
  ])

  const settingsMap: Record<string, string> = {}
  for (const s of settings) {
    settingsMap[s.key] = s.value
  }

  return {
    users,
    categories,
    customers,
    suppliers,
    purchases,
    settings: settingsMap,
  }
})

// ─── Phase 2 Authoritative Synchronization Engine IPC Handlers ──────────────
ipcMain.handle('sync:getStatus', async () => {
  return await syncEngine.getSyncState()
})

ipcMain.handle('sync:flush', async (_, batchSize?: number) => {
  return await syncEngine.flushOutboxBatch(batchSize)
})

ipcMain.handle('sync:pull', async (_, limit?: number) => {
  return await syncEngine.pullCloudChanges(limit)
})

ipcMain.handle('sync:reconcile', async () => {
  return await syncEngine.getReconciliationReport()
})

ipcMain.handle('sync:getOutbox', async (_, status?: string, limit?: number) => {
  const where: any = {}
  if (status) where.status = status
  return await prisma.syncOutbox.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: limit ? Number(limit) : 100,
  })
})

ipcMain.handle('sync:getSessions', async (_, limit?: number) => {
  return await prisma.syncSession.findMany({
    orderBy: { startedAt: 'desc' },
    take: limit ? Number(limit) : 40,
  })
})

ipcMain.handle('sync:retryDeadLetter', async () => {
  const updated = await prisma.syncOutbox.updateMany({
    where: { status: 'DEAD_LETTER' },
    data: {
      status: 'PENDING',
      retryCount: 0,
      nextAttemptAt: null,
      errorMessage: null,
      lastError: null,
    },
  })
  return { success: true, count: updated.count }
})

// ─── Cloud Sync Reconciliation IPC Handlers ─────────────────────────────────
// Local SQLite is the authoritative transactional source of truth for products & stock.
// The cloud is primarily for remote monitoring and control.
// Under NO circumstances should missing or deleted local products/batches be recreated from the cloud.
ipcMain.handle('sync:reconcileCloudProducts', async (_, _cloudProducts: any[]) => {
  // Cloud products are not injected into local SQLite to prevent resurrection of deleted items.
  return { importedCount: 0 }
})

ipcMain.handle('sync:reconcileCloudBatches', async (_, _cloudBatches: any[]) => {
  // Cloud batches are not injected into local SQLite to prevent resurrection of deleted items.
  return { importedCount: 0 }
})

// ─── Cloud Sync Backend Credentials (.env / Environment) ────────────────────
function getCloudCredentials() {
  let url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || ''
  let anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || ''

  if (!url || !anonKey) {
    try {
      const candidates = [
        is.dev ? path.join(__dirname, '../../.env') : null,
        path.join(process.resourcesPath, '.env'),
        path.join(process.cwd(), '.env'),
        path.join(app.getPath('userData'), '.env')
      ].filter(Boolean) as string[]

      for (const envPath of candidates) {
        if (fs.existsSync(envPath)) {
          const content = fs.readFileSync(envPath, 'utf8')
          for (const rawLine of content.split('\n')) {
            const line = rawLine.trim()
            if (!line || line.startsWith('#')) continue
            const [key, ...rest] = line.split('=')
            const val = rest.join('=').replace(/^["']|["']$/g, '').trim()
            if ((key === 'VITE_SUPABASE_URL' || key === 'SUPABASE_URL') && !url) url = val
            if ((key === 'VITE_SUPABASE_ANON_KEY' || key === 'SUPABASE_ANON_KEY') && !anonKey) anonKey = val
          }
        }
      }
    } catch (e) {
      console.warn('Could not read backend environment file:', e)
    }
  }

  // Production defaults for SML Legacy Limited Cloud PostgreSQL
  if (!url) url = 'https://porlaindujqtgrtiuzjz.supabase.co'
  if (!anonKey) anonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk'

  return { url, anonKey }
}

ipcMain.handle('cloud:getCredentials', async () => {
  return getCloudCredentials()
})

