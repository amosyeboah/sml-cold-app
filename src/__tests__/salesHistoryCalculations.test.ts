import { describe, it, expect } from 'vitest'
import { getSaleBreakdown, buildSaleReceiptHtml } from '../pages/SalesHistory'

describe('Sales History Calculation Verification', () => {
  it('correctly handles split payment with explicit payments array (e.g. 2700 Cash + 300 MoMo = 3000 Total)', () => {
    const sale = {
      id: 'sale-001',
      total: 3000,
      paymentMethod: 'SPLIT:CASH=2700,MOBILE=300',
      payments: [
        { method: 'CASH', amount: 2700 },
        { method: 'MOBILE', amount: 300 },
      ],
    }

    const breakdown = getSaleBreakdown(sale)
    expect(breakdown.cash).toBe(2700)
    expect(breakdown.momo).toBe(300)
    expect(breakdown.other).toBe(0)
    expect(breakdown.isSplit).toBe(true)
    expect(breakdown.cash + breakdown.momo).toBe(sale.total)
  })

  it('correctly handles split payment parsed from SPLIT string when payments array is missing', () => {
    const sale = {
      id: 'sale-002',
      total: 3000,
      paymentMethod: 'SPLIT:CASH=2700,MOBILE=300',
    }

    const breakdown = getSaleBreakdown(sale)
    expect(breakdown.cash).toBe(2700)
    expect(breakdown.momo).toBe(300)
    expect(breakdown.isSplit).toBe(true)
    expect(breakdown.cash + breakdown.momo).toBe(sale.total)
  })

  it('correctly calculates aggregate totals across multiple transactions without double counting', () => {
    const sales = [
      // Transaction 1: 2700 Cash
      {
        id: 'sale-1',
        total: 2700,
        paymentMethod: 'CASH',
        payments: [{ method: 'CASH', amount: 2700 }],
      },
      // Transaction 2: 300 MoMo
      {
        id: 'sale-2',
        total: 300,
        paymentMethod: 'MOBILE',
        payments: [{ method: 'MOBILE', amount: 300 }],
      },
    ]

    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
    const cashRevenue = sales.reduce((sum, s) => sum + getSaleBreakdown(s).cash, 0)
    const momoRevenue = sales.reduce((sum, s) => sum + getSaleBreakdown(s).momo, 0)

    expect(totalRevenue).toBe(3000)
    expect(cashRevenue).toBe(2700)
    expect(momoRevenue).toBe(300)
    expect(cashRevenue + momoRevenue).toBe(totalRevenue)
  })

  it('correctly handles a 3000 Cash sale and 300 MoMo sale (Total = 3300)', () => {
    const sales = [
      {
        id: 'sale-a',
        total: 3000,
        paymentMethod: 'CASH',
        payments: [{ method: 'CASH', amount: 3000 }],
      },
      {
        id: 'sale-b',
        total: 300,
        paymentMethod: 'MOBILE',
        payments: [{ method: 'MOBILE', amount: 300 }],
      },
    ]

    const totalRevenue = sales.reduce((sum, s) => sum + (Number(s.total) || 0), 0)
    const cashRevenue = sales.reduce((sum, s) => sum + getSaleBreakdown(s).cash, 0)
    const momoRevenue = sales.reduce((sum, s) => sum + getSaleBreakdown(s).momo, 0)

    expect(totalRevenue).toBe(3300)
    expect(cashRevenue).toBe(3000)
    expect(momoRevenue).toBe(300)
    expect(cashRevenue + momoRevenue).toBe(totalRevenue)
  })

  it('recognizes MOMO keyword properly in place of MOBILE', () => {
    const sale = {
      id: 'sale-momo',
      total: 300,
      paymentMethod: 'MOMO',
      payments: [{ method: 'MOMO', amount: 300 }],
    }

    const breakdown = getSaleBreakdown(sale)
    expect(breakdown.momo).toBe(300)
    expect(breakdown.cash).toBe(0)
  })

  it('buildSaleReceiptHtml formats duplicate receipt correctly with customer, items, and duplicate badge', () => {
    const sale = {
      id: 'ab12cd34ef56',
      total: 125.5,
      date: '2026-10-07T12:00:00Z',
      customer: { name: 'Kofi Mensah' },
      paymentMethod: 'CASH',
      items: [
        { name: 'Frozen Tilapia', quantity: 2, price: 50, subtotal: 100 },
        { name: 'Mackerel 1kg', quantity: 1, price: 25.5, subtotal: 25.5 },
      ],
    }

    const html = buildSaleReceiptHtml(sale, {
      storeName: 'SML Legacy Test Store',
      currencySymbol: '₵',
      isDuplicate: true,
    })

    expect(html).toContain('SML LEGACY TEST STORE')
    expect(html).toContain('INV-AB12CD34')
    expect(html).toContain('Kofi Mensah')
    expect(html).toContain('[ DUPLICATE RECEIPT ]')
    expect(html).toContain('Frozen Tilapia')
    expect(html).toContain('Mackerel 1kg')
    expect(html).toContain('₵125.50')
  })

  it('buildSaleReceiptHtml includes split payment breakdown when transaction has multiple payments', () => {
    const sale = {
      id: 'split99998888',
      total: 500,
      customerName: 'Ama Serwaa',
      paymentMethod: 'SPLIT:CASH=300,MOBILE=200',
      payments: [
        { method: 'CASH', amount: 300 },
        { method: 'MOBILE', amount: 200 },
      ],
      items: [{ product_name: 'Chicken Wings Box', quantity: 1, price: 500, subtotal: 500 }],
    }

    const html = buildSaleReceiptHtml(sale, { isDuplicate: true })
    expect(html).toContain('SPLIT PAYMENT')
    expect(html).toContain('Cash')
    expect(html).toContain('Mobile Money')
    expect(html).toContain('300.00')
    expect(html).toContain('200.00')
    expect(html).toContain('Chicken Wings Box')
  })
})
