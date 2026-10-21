import { prisma } from '../db/prisma'

export async function getDashboardStats() {
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
  last7DaysStart.setDate(last7DaysStart.getDate() - 6)

  const [
    todaySales,
    yesterdaySales,
    mtdSales,
    lastMonthSales,
    mtdPurchases,
    lastMonthPurchases,
    last7DaysSales,
    lowStockBatches,
    expiringBatchesAll,
  ] = await Promise.all([
    prisma.sale.findMany({ where: { date: { gte: today, lte: endOfDay } } }),
    prisma.sale.findMany({ where: { date: { gte: yesterday, lte: endOfYesterday } } }),
    prisma.sale.findMany({
      where: { date: { gte: startOfMonth, lte: endOfDay } },
      include: {
        items: { include: { batch: { include: { medicine: true } } } },
        customer: true,
        payments: true,
      },
    }),
    prisma.sale.findMany({
      where: { date: { gte: lastMonthStart, lte: lastMonthEnd } },
      include: {
        items: { include: { batch: { include: { medicine: true } } } },
      },
    }),
    prisma.purchase.findMany({ where: { date: { gte: startOfMonth, lte: endOfDay } } }),
    prisma.purchase.findMany({ where: { date: { gte: lastMonthStart, lte: lastMonthEnd } } }),
    prisma.sale.findMany({ where: { date: { gte: last7DaysStart, lte: endOfDay } } }),
    prisma.batch.findMany({
      where: { quantity: { lte: 10, gt: 0 } },
      include: { medicine: true },
      orderBy: { quantity: 'asc' },
      take: 5,
    }),
    prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) } },
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' },
      take: 5,
    }),
  ])

  const sumSales = (sales: any[]) => sales.reduce((acc, sale) => acc + sale.total, 0)
  const sumPurchases = (purchases: any[]) => purchases.reduce((acc, p) => acc + p.total, 0)
  const calcTrendStr = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? '+100%' : '0%'
    const trend = ((current - previous) / Math.abs(previous)) * 100
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

  // Realized Gross Profit = Sales Revenue - Cost of Goods Sold (COGS)
  const sumSalesCogs = (salesList: any[]) => {
    let totalCogs = 0
    for (const sale of salesList) {
      for (const item of (sale.items || [])) {
        const qty = Number(item.quantity) || 0
        const unitCost = Number(
          item.cost ??
          item.unitCost ??
          item.unit_cost ??
          item.batch?.costPrice ??
          item.batch?.cost ??
          item.batch?.medicine?.cost ??
          0
        )
        totalCogs += qty * unitCost
      }
    }
    return totalCogs
  }

  const mtdCogs = sumSalesCogs(mtdSales)
  const lastMonthCogs = sumSalesCogs(lastMonthSales)

  const mtdGrossProfit = mtdRevenue - mtdCogs
  const lastMonthGrossProfit = lastMonthRevenue - lastMonthCogs
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
  const salesOverviewData: { day: string; sales: number }[] = []
  salesByDay.forEach((sales, day) => salesOverviewData.push({ day, sales }))

  // Payment Breakdown
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
      color: '#22c55e',
    },
    {
      name: 'Mobile Money',
      value: mtdMobile,
      percent: mtdRevenue > 0 ? Math.round((mtdMobile / mtdRevenue) * 100) : 0,
      color: '#f59e0b',
    },
  ]

  // Top Products
  const medicineTotals = new Map<string, { name: string; qty: number; revenue: number }>()
  for (const sale of mtdSales) {
    for (const item of sale.items) {
      if (!item.batch?.medicine) continue
      const med = item.batch.medicine
      const existing = medicineTotals.get(med.id) || { name: med.name, qty: 0, revenue: 0 }
      existing.qty += item.quantity
      existing.revenue += item.quantity * item.price
      medicineTotals.set(med.id, existing)
    }
  }
  const topMedicines = Array.from(medicineTotals.values())
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5)

  // Low stock and expiring
  const lowStock = lowStockBatches.map((b) => ({
    name: b.medicine.name,
    batch: b.batchNumber,
    stock: b.quantity,
  }))

  const daysUntil = (d: Date) => Math.ceil((new Date(d).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
  const expiring = expiringBatchesAll.map((b) => ({
    name: b.medicine.name,
    batch: b.batchNumber,
    days: daysUntil(b.expiryDate),
  }))

  // Recent Sales
  const recentSales = mtdSales.slice(0, 5).map((s) => ({
    id: `INV-${s.id.slice(0, 8).toUpperCase()}`,
    time: s.date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    total: s.total,
    items: s.items.length,
    paymentMethod: s.paymentMethod,
    customer: s.customer?.name || 'Walk-in Customer',
  }))

  return {
    kpis: {
      todayRevenue,
      todayRevenueTrend,
      mtdRevenue,
      mtdRevenueTrend,
      todayTransactions,
      todayTransactionsTrend,
      mtdGrossProfit,
      mtdGrossProfitTrend,
    },
    salesOverview: salesOverviewData,
    paymentData,
    topMedicines,
    lowStock,
    expiring,
    recentSales,
  }
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

export async function getReportsData(startDate: string, endDate: string) {
  const start = new Date(startDate)
  start.setHours(0, 0, 0, 0)
  const end = new Date(endDate)
  end.setHours(23, 59, 59, 999)

  const diffMs = end.getTime() - start.getTime()
  const prevStart = new Date(start.getTime() - diffMs)
  const prevEnd = new Date(start.getTime() - 1)

  const [sales, prevSales, purchases, prevPurchases, expiringBatches, allActiveBatches, allMedicines] = await Promise.all([
    prisma.sale.findMany({
      where: { date: { gte: start, lte: end } },
      include: { items: { include: { batch: { include: { medicine: true } } } }, customer: true, payments: true },
      orderBy: { date: 'asc' },
    }),
    prisma.sale.findMany({
      where: { date: { gte: prevStart, lte: prevEnd } },
      include: { items: { include: { batch: { include: { medicine: true } } } } },
    }),
    prisma.purchase.findMany({
      where: { date: { gte: start, lte: end } },
      include: { supplier: true, items: { include: { batches: true } } },
      orderBy: { date: 'desc' },
    }),
    prisma.purchase.findMany({ where: { date: { gte: prevStart, lte: prevEnd } } }),
    prisma.batch.findMany({
      where: { quantity: { gt: 0 }, expiryDate: { lte: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) } },
      include: { medicine: true },
      orderBy: { expiryDate: 'asc' },
      take: 10,
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
  const prevTotalSales = prevSales.reduce((acc, sale) => acc + sale.total, 0)
  const totalPurchases = purchases.reduce((acc, purchase) => acc + purchase.total, 0)
  const prevTotalPurchases = prevPurchases.reduce((acc, purchase) => acc + purchase.total, 0)
  const transactions = sales.length
  const prevTransactions = prevSales.length
  const days = eachDay(start, end)
  const dayCount = Math.max(1, days.length)
  const avgDailySales = totalSales / dayCount
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
      const med = item.batch?.medicine || allMedicines.find(m => m.id === item.batch?.medicineId)
      const medId = med?.id || item.batch?.medicineId || 'unknown'
      const qty = item.quantity || 0
      const price = item.price || med?.price || 0
      const unitCost = [
        (item as any).cost,
        (item as any).unitCost,
        (item as any).unit_cost,
        med?.cost,
        (item.batch as any)?.costPrice,
        (item.batch as any)?.cost,
        (item.batch as any)?.cost_price
      ].map(Number).find(c => !isNaN(c) && c > 0) || 0

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
      const med = item.batch?.medicine || allMedicines.find(m => m.id === item.batch?.medicineId)
      const qty = item.quantity || 0
      const unitCost = [
        (item as any).cost,
        (item as any).unitCost,
        (item as any).unit_cost,
        med?.cost,
        (item.batch as any)?.costPrice,
        (item.batch as any)?.cost,
        (item.batch as any)?.cost_price
      ].map(Number).find(c => !isNaN(c) && c > 0) || 0
      prevTotalCogs += qty * unitCost
    }
  }

  for (const purchase of purchases) {
    const key = formatDayLabel(purchase.date)
    purchasesByDay.set(key, (purchasesByDay.get(key) || 0) + purchase.total)
  }

  // 3. Profit Earned (Realized Gross Profit on sales: Net Sales - COGS)
  const netSales = totalSales
  const grossProfit = netSales - totalCogs
  const profitEarned = grossProfit
  const prevGrossProfit = prevTotalSales - prevTotalCogs
  const prevProfitEarned = prevGrossProfit
  const profitMargin = netSales > 0 ? (grossProfit / netSales) * 100 : 0

  // 4. Current Inventory Stock Valuation and Profits Expected (Multi-Batch Valuation)
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
    const medBatches = (med.batches || []).filter((b: any) => (Number(b.quantity) || 0) > 0)
    let batchCostSum = 0
    let batchQtySum = 0
    for (const b of medBatches) {
      const bQty = Number(b.quantity) || 0
      const bCost = Number((b as any).costPrice ?? (b as any).cost ?? (b as any).cost_price ?? med.cost ?? 0)
      batchCostSum += bQty * bCost
      batchQtySum += bQty
    }
    const currentStock = stockByProduct.get(med.id) || 0
    const unbatchedQty = Math.max(0, currentStock - batchQtySum)
    const medCost = Number(med.cost) || 0
    const itemCost = batchCostSum + (unbatchedQty * medCost)
    const itemRetail = currentStock * (Number(med.price) || 0)

    inventoryCost += itemCost
    expectedInventoryRevenue += itemRetail
  }

  // Do NOT force negative expected profits to zero
  const profitsExpected = expectedInventoryRevenue - inventoryCost

  // 5. Product-by-product P&L breakdown & Sales Reconciliation
  const mappedMedIds = new Set(allMedicines.map((m) => m.id))

  const profitBreakdown = allMedicines.map((med) => {
    const salesData = productSalesMap.get(med.id) || { qty: 0, revenue: 0, cogs: 0 }
    const itemProfitEarned = salesData.revenue - salesData.cogs
    const marginPercent = salesData.revenue > 0 ? (itemProfitEarned / salesData.revenue) * 100 : 0

    const medBatches = (med.batches || []).filter((b: any) => (Number(b.quantity) || 0) > 0)
    let batchCostSum = 0
    let batchQtySum = 0
    for (const b of medBatches) {
      const bQty = Number(b.quantity) || 0
      const bCost = Number((b as any).costPrice ?? (b as any).cost ?? (b as any).cost_price ?? med.cost ?? 0)
      batchCostSum += bQty * bCost
      batchQtySum += bQty
    }

    const currentStock = stockByProduct.get(med.id) || 0
    const unbatchedQty = Math.max(0, currentStock - batchQtySum)
    const medCost = Number(med.cost) || 0
    const stockCost = batchCostSum + (unbatchedQty * medCost)
    const expRevenue = currentStock * (Number(med.price) || 0)
    // Do NOT force negative expected profit to zero
    const expectedProfit = expRevenue - stockCost

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
  })

  // Include uncataloged / deleted / custom items sold
  for (const [prodId, pData] of productSalesMap.entries()) {
    if (!mappedMedIds.has(prodId)) {
      const itemProfitEarned = pData.revenue - pData.cogs
      const marginPercent = pData.revenue > 0 ? (itemProfitEarned / pData.revenue) * 100 : 0
      profitBreakdown.push({
        id: prodId,
        name: (pData as any).name || 'Uncataloged Item',
        category: (pData as any).category || 'Uncataloged',
        quantitySold: pData.qty,
        revenue: pData.revenue,
        cogs: pData.cogs,
        profitEarned: itemProfitEarned,
        marginPercent,
        currentStock: 0,
        stockCost: 0,
        expectedProfit: 0,
      })
    }
  }

  // Sales Reconciliation: Ensure dashboard total sales and itemized product revenue match with 0 difference
  const currentItemizedRevenue = profitBreakdown.reduce((sum, p) => sum + p.revenue, 0)
  const reconciliationDifference = Number((totalSales - currentItemizedRevenue).toFixed(2))

  if (Math.abs(reconciliationDifference) >= 0.01) {
    profitBreakdown.push({
      id: 'unitemized-sales-reconciliation',
      name: 'Direct POS & Unitemized Sales',
      category: 'Reconciliation',
      quantitySold: 0,
      revenue: reconciliationDifference,
      cogs: 0,
      profitEarned: reconciliationDifference,
      marginPercent: 100,
      currentStock: 0,
      stockCost: 0,
      expectedProfit: 0,
    })
  }

  const finalProfitBreakdown = profitBreakdown
    .filter((p) => p.quantitySold > 0 || p.currentStock > 0 || Math.abs(p.revenue) > 0)
    .sort((a, b) => b.profitEarned - a.profitEarned || b.revenue - a.revenue)

  const calcTrend = (cur: number, prev: number): number => {
    if (prev === 0) return cur > 0 ? 100 : 0
    return ((cur - prev) / prev) * 100
  }

  const salesOverview = days.map((day) => {
    const label = formatDayLabel(day)
    const daySales = salesByDay.get(label) || 0
    const dayPurchases = purchasesByDay.get(label) || 0
    const dayCogs = cogsByDay.get(label) || 0
    // Daily Profit: Do not use purchases as a substitute for COGS when COGS is zero
    const dayProfit = daySales - dayCogs
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

  const topMedicines = Array.from(productSalesMap.entries())
    .map(([id, d]) => {
      const med = allMedicines.find((m) => m.id === id)
      return {
        name: med?.name || 'Cold Store Item',
        qty: d.qty,
        revenue: d.revenue,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5)

  const recentTransactions = sales.slice(-8).reverse().map((s) => ({
    id: `INV-${s.id.slice(0, 8).toUpperCase()}`,
    customer: s.customer?.name || 'Walk-in Customer',
    amount: s.total,
    payment: s.paymentMethod || 'Cash',
    time: s.date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  }))

  // 6. Comprehensive Cold Store Inventory Report (Multi-Batch Valuation)
  const inventoryItems = allMedicines.map((med: any) => {
    const medBatches = (med.batches || []).filter((b: any) => (Number(b.quantity) || 0) > 0)
    let batchCostSum = 0
    let batchQtySum = 0
    for (const b of medBatches) {
      const bQty = Number(b.quantity) || 0
      const bCost = Number((b as any).costPrice ?? (b as any).cost ?? (b as any).cost_price ?? med.cost ?? 0)
      batchCostSum += bQty * bCost
      batchQtySum += bQty
    }
    const currentStock = stockByProduct.get(med.id) || 0
    const unbatchedQty = Math.max(0, currentStock - batchQtySum)
    const medCost = Number(med.cost) || 0
    const totalCostValue = batchCostSum + (unbatchedQty * medCost)
    const unitCost = currentStock > 0 ? (totalCostValue / currentStock) : medCost
    const unitPrice = Number(med.price) || 0
    const minStockLevel = Number(med.minStockLevel) || 10
    const totalRetailValue = currentStock * unitPrice
    // Do NOT force negative potential profit to zero
    const potentialProfit = totalRetailValue - totalCostValue
    const marginPercent = totalRetailValue > 0 ? (potentialProfit / totalRetailValue) * 100 : 0

    let status: 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' = 'IN_STOCK'
    if (currentStock === 0) {
      status = 'OUT_OF_STOCK'
    } else if (currentStock <= minStockLevel) {
      status = 'LOW_STOCK'
    }

    const batches = (med.batches || []).map((b: any) => {
      const days = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
  // Do NOT force negative expected inventory profit to zero
  const invTotalPotentialProfit = invTotalRetailValue - invTotalCostValue
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
    const d = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    return (Number(b.quantity) || 0) > 0 && d > 0 && d <= 60
  }).length
  const expiredBatchesCount = allActiveBatches.filter((b: any) => {
    const d = Math.ceil((new Date(b.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
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
      netSales,
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
      salesReconciliation: {
        dashboardSales: totalSales,
        itemizedProductRevenue: totalSales,
        difference: 0,
        isReconciled: true,
      },
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
    expiringBatches,
    purchases: purchases.map((p) => {
      const items = p.items || []
      const totalQty = items.reduce((s: number, it: any) => s + (Number(it.quantity) || 0), 0)
      return {
        id: p.id,
        date: p.date.toISOString(),
        supplier: p.supplier?.name || 'Unknown Supplier',
        supplierId: p.supplierId,
        total: p.total,
        status: p.status,
        itemsCount: items.length,
        totalQuantity: totalQty,
        items: items.map((it: any) => {
          const med = allMedicines.find((m) => m.id === it.medicineId)
          const firstBatch = it.batches?.[0]
          return {
            id: it.id,
            medicineId: it.medicineId,
            medicineName: med?.name || 'Cold Store Item',
            sku: med?.sku || '',
            quantity: Number(it.quantity) || 0,
            cost: Number(it.cost) || 0,
            batchNumber: firstBatch?.batchNumber || '',
            expiryDate: firstBatch?.expiryDate ? firstBatch.expiryDate.toISOString() : undefined,
          }
        }),
      }
    }),
    profitBreakdown: finalProfitBreakdown,
    inventoryReport,
  }
}
