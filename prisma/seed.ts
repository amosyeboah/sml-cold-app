import { PrismaClient } from '../generated/client'
import * as bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding database...')

  // Clean old data
  await prisma.saleItem.deleteMany()
  await prisma.prescription.deleteMany()
  await prisma.sale.deleteMany()
  await prisma.purchaseItem.deleteMany()
  await prisma.purchase.deleteMany()
  await prisma.batch.deleteMany()
  await prisma.medicine.deleteMany()
  await prisma.category.deleteMany()
  await prisma.supplier.deleteMany()
  await prisma.customer.deleteMany()
  await prisma.user.deleteMany()

  // 1. Users (3 Distinct Roles: Admin, Manager, Cashier)
  const adminPassword = await bcrypt.hash('admin1234', 10)
  const managerPassword = await bcrypt.hash('manager123', 10)
  const cashierPassword = await bcrypt.hash('cashier123', 10)

  await prisma.user.create({
    data: {
      username: 'admin',
      password: adminPassword,
      pin: '1111',
      role: 'ADMIN',
    },
  })

  await prisma.user.create({
    data: {
      username: 'manager',
      password: managerPassword,
      pin: '2222',
      role: 'MANAGER',
    },
  })

  await prisma.user.create({
    data: {
      username: 'cashier',
      password: cashierPassword,
      pin: '1234',
      role: 'CASHIER',
    },
  })

  // 2. Categories (Cold Store product types)
  const poultry    = await prisma.category.create({ data: { name: 'Poultry' } })
  const fish       = await prisma.category.create({ data: { name: 'Fish & Seafood' } })
  const beef       = await prisma.category.create({ data: { name: 'Beef & Mutton' } })
  const pork       = await prisma.category.create({ data: { name: 'Pork Products' } })
  const processed  = await prisma.category.create({ data: { name: 'Processed Meat' } })
  const frozen     = await prisma.category.create({ data: { name: 'Frozen Vegetables' } })
  const dairy      = await prisma.category.create({ data: { name: 'Dairy & Eggs' } })

  // 3. Suppliers (Ghana-based cold store suppliers)
  const supplierA = await prisma.supplier.create({
    data: {
      name: 'Accra Frozen Foods Ltd',
      contact: '+233 30 222 4455',
      email: 'sales@accrafrozen.com.gh',
      address: 'Industrial Area, Accra, Ghana',
    },
  })

  const supplierB = await prisma.supplier.create({
    data: {
      name: 'Gold Coast Meat Distributors',
      contact: '+233 24 500 7890',
      email: 'orders@gcmeat.com.gh',
      address: 'Tema Port Area, Tema, Ghana',
    },
  })

  const supplierC = await prisma.supplier.create({
    data: {
      name: 'West Africa Poultry Hub',
      contact: '+233 54 112 3399',
      email: 'info@wapoultry.com.gh',
      address: 'Spintex Road, Accra, Ghana',
    },
  })

  // 4. Customers
  await prisma.customer.create({
    data: { name: 'Kofi Mensah', phone: '0244112233' },
  })

  await prisma.customer.create({
    data: { name: 'Ama Asante', phone: '0554321098' },
  })

  await prisma.customer.create({
    data: { name: 'Kwame Boateng', phone: '0201987654' },
  })

  await prisma.customer.create({
    data: { name: 'Sofiyat Yusuf', phone: '+447999007775' },
  })

  // 5. Products & Batches (Cold Store Items — prices in GHS)
  const today = new Date()

  const expiredDate = new Date(today)
  expiredDate.setMonth(today.getMonth() - 1) // Expired 1 month ago (demo)

  const soonDate = new Date(today)
  soonDate.setDate(today.getDate() + 20) // Expires in 20 days (near-expiry demo)

  const futureDate = new Date(today)
  futureDate.setFullYear(today.getFullYear() + 1) // 1 year from now (standard frozen)

  const farFutureDate = new Date(today)
  farFutureDate.setFullYear(today.getFullYear() + 2) // 2 years (long-life frozen)

  // ── Poultry ──────────────────────────────────────────────────────────────
  const wholeChicken = await prisma.medicine.create({
    data: {
      name: 'Whole Chicken (Frozen)',
      genericName: 'Broiler Chicken',
      sku: 'SML-PTR-001',
      categoryId: poultry.id,
      price: 85.00,
      cost: 58.00,
      minStockLevel: 20,
    },
  })
  await prisma.batch.create({
    data: { medicineId: wholeChicken.id, batchNumber: 'CHK-2024-001', expiryDate: futureDate, quantity: 80 },
  })

  const chickenLegs = await prisma.medicine.create({
    data: {
      name: 'Chicken Legs (5kg Pack)',
      genericName: 'Chicken Drumsticks',
      sku: 'SML-PTR-002',
      categoryId: poultry.id,
      price: 120.00,
      cost: 82.00,
      minStockLevel: 15,
    },
  })
  await prisma.batch.create({
    data: { medicineId: chickenLegs.id, batchNumber: 'CHL-2024-001', expiryDate: futureDate, quantity: 60 },
  })

  const chickenBreast = await prisma.medicine.create({
    data: {
      name: 'Chicken Breast (Boneless)',
      genericName: 'Breast Fillet',
      sku: 'SML-PTR-003',
      categoryId: poultry.id,
      price: 145.00,
      cost: 98.00,
      minStockLevel: 10,
    },
  })
  await prisma.batch.create({
    data: { medicineId: chickenBreast.id, batchNumber: 'CHB-2024-001', expiryDate: futureDate, quantity: 50 },
  })

  const turkey = await prisma.medicine.create({
    data: {
      name: 'Turkey (Whole Frozen)',
      genericName: 'Turkey Bird',
      sku: 'SML-PTR-004',
      categoryId: poultry.id,
      price: 320.00,
      cost: 220.00,
      minStockLevel: 5,
    },
  })
  await prisma.batch.create({
    data: { medicineId: turkey.id, batchNumber: 'TKY-2024-001', expiryDate: futureDate, quantity: 20 },
  })

  // ── Fish & Seafood ────────────────────────────────────────────────────────
  const tilapia = await prisma.medicine.create({
    data: {
      name: 'Tilapia Fish (Fresh Frozen)',
      genericName: 'Whole Cleaned (20kg Carton)',
      sku: 'SML-FSH-001',
      categoryId: fish.id,
      price: 95.00,
      cost: 62.00,
      minStockLevel: 25,
    },
  })
  await prisma.batch.create({
    data: { medicineId: tilapia.id, batchNumber: 'TLP-2024-001', expiryDate: soonDate, quantity: 10 },
  })
  await prisma.batch.create({
    data: { medicineId: tilapia.id, batchNumber: 'TLP-2024-002', expiryDate: futureDate, quantity: 90 },
  })

  const mackerel = await prisma.medicine.create({
    data: {
      name: 'Mackerel (Frozen, 1kg)',
      genericName: 'Dutch Mackerel (20kg Box)',
      sku: 'SML-FSH-002',
      categoryId: fish.id,
      price: 55.00,
      cost: 36.00,
      minStockLevel: 30,
    },
  })
  await prisma.batch.create({
    data: { medicineId: mackerel.id, batchNumber: 'MCK-2024-001', expiryDate: futureDate, quantity: 120 },
  })

  const prawns = await prisma.medicine.create({
    data: {
      name: 'Tiger Prawns (500g)',
      genericName: 'Jumbo Head-on (10kg Carton)',
      sku: 'SML-FSH-003',
      categoryId: fish.id,
      price: 180.00,
      cost: 125.00,
      minStockLevel: 10,
    },
  })
  await prisma.batch.create({
    data: { medicineId: prawns.id, batchNumber: 'PRW-2024-001', expiryDate: futureDate, quantity: 40 },
  })

  const squid = await prisma.medicine.create({
    data: {
      name: 'Squid Rings (Frozen)',
      genericName: 'Calamari Rings (5kg Box)',
      sku: 'SML-FSH-004',
      categoryId: fish.id,
      price: 140.00,
      cost: 95.00,
      minStockLevel: 10,
    },
  })
  await prisma.batch.create({
    data: { medicineId: squid.id, batchNumber: 'SQD-2024-001', expiryDate: futureDate, quantity: 35 },
  })

  // ── Beef & Mutton ─────────────────────────────────────────────────────────
  const beefChuck = await prisma.medicine.create({
    data: {
      name: 'Beef Chuck (1kg)',
      genericName: 'Bone-in Chuck (25kg Box)',
      sku: 'SML-BEF-001',
      categoryId: beef.id,
      price: 130.00,
      cost: 90.00,
      minStockLevel: 20,
    },
  })
  await prisma.batch.create({
    data: { medicineId: beefChuck.id, batchNumber: 'BFC-2024-001', expiryDate: futureDate, quantity: 75 },
  })

  const beefMince = await prisma.medicine.create({
    data: {
      name: 'Minced Beef (500g)',
      genericName: '80/20 Lean Blend (10kg Pack)',
      sku: 'SML-BEF-002',
      categoryId: beef.id,
      price: 70.00,
      cost: 48.00,
      minStockLevel: 25,
    },
  })
  await prisma.batch.create({
    data: { medicineId: beefMince.id, batchNumber: 'BFM-2024-001', expiryDate: futureDate, quantity: 100 },
  })

  const mutton = await prisma.medicine.create({
    data: {
      name: 'Mutton Leg (Frozen)',
      genericName: 'New Zealand Bone-in Leg',
      sku: 'SML-MTN-001',
      categoryId: beef.id,
      price: 200.00,
      cost: 140.00,
      minStockLevel: 10,
    },
  })
  await prisma.batch.create({
    data: { medicineId: mutton.id, batchNumber: 'MTN-2024-001', expiryDate: futureDate, quantity: 30 },
  })

  const oxtail = await prisma.medicine.create({
    data: {
      name: 'Oxtail (Frozen, 1kg)',
      genericName: 'Center Cut (10kg Box)',
      sku: 'SML-BEF-003',
      categoryId: beef.id,
      price: 155.00,
      cost: 105.00,
      minStockLevel: 10,
    },
  })
  await prisma.batch.create({
    data: { medicineId: oxtail.id, batchNumber: 'OXT-2024-001', expiryDate: expiredDate, quantity: 5 },
  })
  await prisma.batch.create({
    data: { medicineId: oxtail.id, batchNumber: 'OXT-2024-002', expiryDate: futureDate, quantity: 45 },
  })

  // ── Pork Products ─────────────────────────────────────────────────────────
  const porkRibs = await prisma.medicine.create({
    data: {
      name: 'Pork Ribs (Frozen)',
      genericName: 'Spare Ribs (15kg Box)',
      sku: 'SML-PRK-001',
      categoryId: pork.id,
      price: 110.00,
      cost: 75.00,
      minStockLevel: 15,
    },
  })
  await prisma.batch.create({
    data: { medicineId: porkRibs.id, batchNumber: 'PRK-2024-001', expiryDate: futureDate, quantity: 55 },
  })

  const porkBelly = await prisma.medicine.create({
    data: {
      name: 'Pork Belly (1kg)',
      genericName: 'Skin-on Pork Belly (10kg Box)',
      sku: 'SML-PRK-002',
      categoryId: pork.id,
      price: 100.00,
      cost: 68.00,
      minStockLevel: 12,
    },
  })
  await prisma.batch.create({
    data: { medicineId: porkBelly.id, batchNumber: 'PKB-2024-001', expiryDate: futureDate, quantity: 48 },
  })

  // ── Processed Meat ────────────────────────────────────────────────────────
  const sausages = await prisma.medicine.create({
    data: {
      name: 'Beef Sausages (500g)',
      genericName: 'Premium Beef Links (10kg Pack)',
      sku: 'SML-PRC-001',
      categoryId: processed.id,
      price: 65.00,
      cost: 42.00,
      minStockLevel: 20,
    },
  })
  await prisma.batch.create({
    data: { medicineId: sausages.id, batchNumber: 'BSG-2024-001', expiryDate: farFutureDate, quantity: 90 },
  })

  const hotdog = await prisma.medicine.create({
    data: {
      name: 'Chicken Hot Dogs (300g)',
      genericName: 'Classic Chicken Franks (10kg Pack)',
      sku: 'SML-PRC-002',
      categoryId: processed.id,
      price: 45.00,
      cost: 28.00,
      minStockLevel: 20,
    },
  })
  await prisma.batch.create({
    data: { medicineId: hotdog.id, batchNumber: 'CHD-2024-001', expiryDate: farFutureDate, quantity: 110 },
  })

  const baconStrips = await prisma.medicine.create({
    data: {
      name: 'Smoked Bacon Strips',
      genericName: 'Cured Smoked Strips (5kg Pack)',
      sku: 'SML-PRC-003',
      categoryId: processed.id,
      price: 90.00,
      cost: 60.00,
      minStockLevel: 15,
    },
  })
  await prisma.batch.create({
    data: { medicineId: baconStrips.id, batchNumber: 'BCN-2024-001', expiryDate: farFutureDate, quantity: 70 },
  })

  // ── Frozen Vegetables ─────────────────────────────────────────────────────
  const mixedVeg = await prisma.medicine.create({
    data: {
      name: 'Mixed Vegetables (1kg)',
      genericName: 'Carrot, Pea & Corn Blend',
      sku: 'SML-VEG-001',
      categoryId: frozen.id,
      price: 30.00,
      cost: 18.00,
      minStockLevel: 30,
    },
  })
  await prisma.batch.create({
    data: { medicineId: mixedVeg.id, batchNumber: 'MVG-2024-001', expiryDate: farFutureDate, quantity: 150 },
  })

  const greenBeans = await prisma.medicine.create({
    data: {
      name: 'Green Beans (Frozen)',
      genericName: 'Cut Green Beans (10kg Carton)',
      sku: 'SML-VEG-002',
      categoryId: frozen.id,
      price: 25.00,
      cost: 14.00,
      minStockLevel: 25,
    },
  })
  await prisma.batch.create({
    data: { medicineId: greenBeans.id, batchNumber: 'GBN-2024-001', expiryDate: farFutureDate, quantity: 120 },
  })

  // ── Dairy & Eggs ──────────────────────────────────────────────────────────
  const butter = await prisma.medicine.create({
    data: {
      name: 'Unsalted Butter (250g)',
      genericName: 'Dairy Butter',
      sku: 'SML-DRY-001',
      categoryId: dairy.id,
      price: 40.00,
      cost: 26.00,
      minStockLevel: 20,
    },
  })
  await prisma.batch.create({
    data: { medicineId: butter.id, batchNumber: 'BTR-2024-001', expiryDate: futureDate, quantity: 80 },
  })

  const eggs = await prisma.medicine.create({
    data: {
      name: 'Crate of Eggs (30 pcs)',
      genericName: 'Chicken Eggs',
      sku: 'SML-DRY-002',
      categoryId: dairy.id,
      price: 55.00,
      cost: 38.00,
      minStockLevel: 15,
    },
  })
  await prisma.batch.create({
    data: { medicineId: eggs.id, batchNumber: 'EGG-2024-001', expiryDate: soonDate, quantity: 8 },
  })
  await prisma.batch.create({
    data: { medicineId: eggs.id, batchNumber: 'EGG-2024-002', expiryDate: futureDate, quantity: 50 },
  })

  console.log('✅ Database seeded successfully!')
  console.log('👤 Admin login:   admin   / admin1234   (Role: System Admin)')
  console.log('👤 Manager login: manager / manager123 (Role: Store Manager)')
  console.log('👤 Cashier login: cashier / cashier123 (Role: Cashier)')
  console.log('🏪 Business: SOFIYEM Legacy Limited — Cold Store POS')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
