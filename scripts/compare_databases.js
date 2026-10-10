const { PrismaClient } = require('../generated/client');
const path = require('path');
const ws = require('ws');
globalThis.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const defaultDbPath = path.resolve(__dirname, '../database/pharmacy.db');
const rawDbUrl = process.env.SML_SQLITE_DB
  ? path.resolve(process.env.SML_SQLITE_DB)
  : (process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('file:'))
  ? path.resolve(process.cwd(), process.env.DATABASE_URL.replace(/^file:/, ''))
  : defaultDbPath;
const databaseUrl = `file:${rawDbUrl.replace(/\\/g, '/')}`;
const prisma = new PrismaClient({
  datasources: { db: { url: databaseUrl } }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function runComparison() {
  let auditFailed = false;
  console.log('================================================================');
  console.log('SML COLD STORE: COMPREHENSIVE LOCAL SQLITE vs ONLINE SUPABASE AUDIT');
  console.log('================================================================\n');

  try {
    // 1. OUTBOX & SYNC QUEUE STATUS IN SQLITE
    console.log('--- 1. LOCAL SYNC ENGINE STATE ---');
    const outboxByStatus = await prisma.syncOutbox.groupBy({
      by: ['status', 'entity'],
      _count: { id: true }
    });
    console.log('SyncOutbox counts by status and entity:');
    outboxByStatus.forEach(g => console.log(`  - [${g.status}] ${g.entity}: ${g._count.id}`));

    const totalOutbox = await prisma.syncOutbox.count();
    console.log(`Total SyncOutbox records: ${totalOutbox}`);
    const outstandingOutbox = await prisma.syncOutbox.count({ where: { status: { not: 'SYNCED' } } });
    if (outstandingOutbox > 0) {
      auditFailed = true;
      console.error(`Outbox is not drained: ${outstandingOutbox} event(s) are pending, failed, processing, or dead-lettered.`);
    }

    const deadLetters = await prisma.syncOutbox.findMany({
      where: { status: 'DEAD_LETTER' },
      take: 15
    });
    console.log(`\nSample DEAD_LETTER outbox events (${deadLetters.length}):`);
    deadLetters.forEach(o => {
      console.log(`  * Entity: ${o.entity} | Action: ${o.action} | RecordId: ${o.recordId} | Error: ${o.errorMessage}`);
    });

    const pendingOutbox = await prisma.syncOutbox.findMany({
      where: { status: 'PENDING' },
      take: 10
    });
    console.log(`\nSample PENDING outbox events (${pendingOutbox.length}):`);
    pendingOutbox.forEach(o => {
      console.log(`  * Entity: ${o.entity} | Action: ${o.action} | RecordId: ${o.recordId}`);
    });

    const lastSessions = await prisma.syncSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: 3
    });
    console.log('\nRecent Sync Sessions in SQLite:');
    lastSessions.forEach(s => console.log(`  - [${s.status}] started=${s.startedAt.toISOString()} attempted=${s.eventsAttempted} ok=${s.eventsSucceeded} failed=${s.eventsFailed} err=${s.errorSummary || 'none'}`));

    // 2. PRODUCTS / MEDICINES
    console.log('\n--- 2. PRODUCTS / MEDICINES ---');
    const localProducts = await prisma.medicine.findMany({
      include: {
        category: true,
        batches: true
      },
      orderBy: { name: 'asc' }
    });

    const { data: cloudProducts, error: cpErr } = await supabase
      .from('cloud_products')
      .select('*')
      .order('name', { ascending: true });

    if (cpErr) {
      auditFailed = true;
      console.error('Cloud products fetch error:', cpErr);
    }

    console.log(`Local SQLite products count: ${localProducts.length}`);
    console.log(`Online Supabase products count: ${cloudProducts?.length || 0}`);
    if (localProducts.length !== (cloudProducts?.length || 0)) auditFailed = true;

    const localProdMap = new Map(localProducts.map(p => [p.id, p]));
    const cloudProdMap = new Map((cloudProducts || []).map(p => [p.id, p]));

    const missingInCloudProducts = localProducts.filter(p => !cloudProdMap.has(p.id));
    const missingInLocalProducts = (cloudProducts || []).filter(p => !localProdMap.has(p.id));
    if (missingInCloudProducts.length || missingInLocalProducts.length) auditFailed = true;

    if (missingInCloudProducts.length > 0) {
      console.log(`Products in Local but MISSING in Cloud (${missingInCloudProducts.length}):`);
      missingInCloudProducts.forEach(p => console.log(`  * ID: ${p.id} | Name: ${p.name} | SKU: ${p.sku} | Price: ${p.price}`));
    } else {
      console.log('✓ All local products exist in Cloud products.');
    }

    if (missingInLocalProducts.length > 0) {
      console.log(`Products in Cloud but MISSING in Local (${missingInLocalProducts.length}):`);
      missingInLocalProducts.forEach(p => console.log(`  * ID: ${p.id} | Name: ${p.name} | SKU: ${p.sku} | Price: ${p.price}`));
    } else {
      console.log('✓ All cloud products exist in Local products.');
    }

    // Check product attribute differences (Price, Cost, Stock, Name)
    const productAttrMismatches = [];
    for (const lp of localProducts) {
      const cp = cloudProdMap.get(lp.id);
      if (!cp) continue;
      const localStock = lp.batches.reduce((sum, b) => sum + (b.quantity || 0), 0);
      const diffs = [];
      if (Math.abs(Number(lp.price) - Number(cp.price)) > 0.01) {
        diffs.push(`price: local=${lp.price} vs cloud=${cp.price}`);
      }
      if (Math.abs(Number(lp.cost) - Number(cp.cost)) > 0.01) {
        diffs.push(`cost: local=${lp.cost} vs cloud=${cp.cost}`);
      }
      const cloudStock = Number(cp.current_stock ?? cp.stock_quantity ?? 0);
      if (localStock !== cloudStock) {
        diffs.push(`stock: local=${localStock} vs cloud=${cloudStock}`);
      }
      if (lp.name !== cp.name) {
        diffs.push(`name: local="${lp.name}" vs cloud="${cp.name}"`);
      }
      if (diffs.length > 0) {
        productAttrMismatches.push({ name: lp.name, sku: lp.sku, id: lp.id, diffs });
      }
    }

    if (productAttrMismatches.length > 0) {
      auditFailed = true;
      console.log(`Product attribute/stock mismatches (${productAttrMismatches.length}):`);
      productAttrMismatches.forEach(m => console.log(`  * [${m.sku}] ${m.name}: ${m.diffs.join(', ')}`));
    } else {
      console.log('✓ All matched products have identical price, cost, stock, and name.');
    }

    // 3. BATCHES
    console.log('\n--- 3. BATCHES ---');
    const localBatches = await prisma.batch.findMany({
      include: { medicine: true }
    });
    const { data: cloudBatches, error: cbErr } = await supabase
      .from('cloud_batches')
      .select('*');
    if (cbErr) {
      auditFailed = true;
      console.error('Cloud batches error:', cbErr);
    }

    console.log(`Local SQLite batches count: ${localBatches.length}`);
    console.log(`Online Supabase batches count: ${cloudBatches?.length || 0}`);
    if (localBatches.length !== (cloudBatches?.length || 0)) auditFailed = true;

    const localBatchMap = new Map(localBatches.map(b => [b.id, b]));
    const cloudBatchMap = new Map((cloudBatches || []).map(b => [b.id, b]));

    const missingInCloudBatches = localBatches.filter(b => !cloudBatchMap.has(b.id));
    const missingInLocalBatches = (cloudBatches || []).filter(b => !localBatchMap.has(b.id));
    if (missingInCloudBatches.length || missingInLocalBatches.length) auditFailed = true;

    if (missingInCloudBatches.length > 0) {
      console.log(`Batches in Local but MISSING in Cloud (${missingInCloudBatches.length}):`);
      missingInCloudBatches.forEach(b => console.log(`  * ID: ${b.id} | Prod: ${b.medicine?.name} | Batch#: ${b.batchNumber} | Qty: ${b.quantity}`));
    } else {
      console.log('✓ All local batches exist in Cloud batches.');
    }

    if (missingInLocalBatches.length > 0) {
      console.log(`Batches in Cloud but MISSING in Local (${missingInLocalBatches.length}):`);
      missingInLocalBatches.forEach(b => console.log(`  * ID: ${b.id} | ProdId: ${b.product_id} | Batch#: ${b.batch_number} | Qty: ${b.quantity_current ?? b.quantity}`));
    } else {
      console.log('✓ All cloud batches exist in Local batches.');
    }

    const batchQtyMismatches = [];
    for (const lb of localBatches) {
      const cb = cloudBatchMap.get(lb.id);
      if (!cb) continue;
      const cQty = Number(cb.quantity_current ?? cb.quantity ?? 0);
      if (lb.quantity !== cQty) {
        batchQtyMismatches.push({
          id: lb.id,
          product: lb.medicine?.name,
          batchNumber: lb.batchNumber,
          localQty: lb.quantity,
          cloudQty: cQty
        });
      }
    }
    if (batchQtyMismatches.length > 0) {
      auditFailed = true;
      console.log(`Batch quantity mismatches (${batchQtyMismatches.length}):`);
      batchQtyMismatches.forEach(m => console.log(`  * [${m.batchNumber}] ${m.product}: local=${m.localQty} vs cloud=${m.cloudQty}`));
    } else {
      console.log('✓ All matched batches have identical quantities.');
    }

    // 4. SALES TRANSACTIONS
    console.log('\n--- 4. SALES TRANSACTIONS ---');
    const localSales = await prisma.sale.findMany({
      include: {
        customer: true,
        payments: true,
        items: {
          include: {
            batch: {
              include: { medicine: true }
            }
          }
        }
      },
      orderBy: { date: 'asc' }
    });

    const { data: cloudSales, error: csErr } = await supabase
      .from('cloud_sales')
      .select('*')
      .order('sold_at', { ascending: true });
    if (csErr) {
      auditFailed = true;
      console.error('Cloud sales error:', csErr);
    }

    const localSalesRevenue = localSales.reduce((acc, s) => acc + (Number(s.total) || 0), 0);
    const cloudSalesRevenue = (cloudSales || []).reduce((acc, s) => acc + (Number(s.total_amount ?? s.total) || 0), 0);

    console.log(`Local SQLite sales count: ${localSales.length} | Total Revenue: GH₵${localSalesRevenue.toFixed(2)}`);
    console.log(`Online Supabase sales count: ${cloudSales?.length || 0} | Total Revenue: GH₵${cloudSalesRevenue.toFixed(2)}`);
    console.log(`Difference: ${localSales.length - (cloudSales?.length || 0)} transactions | GH₵${(localSalesRevenue - cloudSalesRevenue).toFixed(2)} revenue`);
    if (localSales.length !== (cloudSales?.length || 0) || Math.abs(localSalesRevenue - cloudSalesRevenue) > 0.01) auditFailed = true;

    const localSaleMap = new Map(localSales.map(s => [s.id, s]));
    const cloudSaleMap = new Map((cloudSales || []).map(s => [s.id, s]));

    const missingInCloudSales = localSales.filter(s => !cloudSaleMap.has(s.id));
    const missingInLocalSales = (cloudSales || []).filter(s => !localSaleMap.has(s.id));
    if (missingInCloudSales.length || missingInLocalSales.length) auditFailed = true;

    if (missingInCloudSales.length > 0) {
      console.log(`\nSales in Local SQLite but MISSING in Cloud Supabase (${missingInCloudSales.length}):`);
      missingInCloudSales.slice(0, 15).forEach(s => {
        const d = new Date(s.date).toISOString().slice(0, 19).replace('T', ' ');
        console.log(`  * ID: ${s.id} | Date: ${d} | Total: GH₵${s.total} | Method: ${s.paymentMethod} | Customer: ${s.customer?.name || 'Walk-in'} | Items: ${s.items.length}`);
      });
      if (missingInCloudSales.length > 15) {
        console.log(`  ... and ${missingInCloudSales.length - 15} more local sales missing in cloud.`);
      }
    } else {
      console.log('✓ All local sales exist in Cloud.');
    }

    if (missingInLocalSales.length > 0) {
      console.log(`\nSales in Cloud Supabase but MISSING in Local SQLite (${missingInLocalSales.length}):`);
      for (const s of missingInLocalSales) {
        // Fetch items for this sale
        const saleNo = s.invoice_number || s.sale_number || s.id;
        const saleDate = s.sold_at || s.date || s.created_at;
        const saleTot = s.total_amount ?? s.total ?? 0;
        const cashier = s.cashier_name || s.cashier_username || 'cashier';
        console.log(`  * ID: ${s.id} | Sale#: ${saleNo} | Date: ${saleDate} | Total: GH₵${saleTot} | Method: ${s.payment_method} | Cashier: ${cashier} | Customer: ${s.customer_name}`);
        if (items && items.length > 0) {
          items.forEach(i => console.log(`      Item: ${i.product_name} | Qty: ${i.quantity} | UnitPrice: GH₵${i.unit_price} | Subtotal: GH₵${i.total_price ?? i.subtotal}`));
        } else {
          console.log(`      (No items in cloud_sale_items)`);
        }
      }
    } else {
      console.log('✓ All cloud sales exist in Local SQLite.');
    }

    // Check matched sales value differences
    const saleDiffs = [];
    for (const ls of localSales) {
      const cs = cloudSaleMap.get(ls.id);
      if (!cs) continue;
      if (Math.abs(Number(ls.total) - Number(cs.total)) > 0.01) {
        saleDiffs.push({ id: ls.id, localTotal: ls.total, cloudTotal: cs.total });
      }
    }
    if (saleDiffs.length > 0) {
      auditFailed = true;
      console.log(`Matched sales with total amount differences (${saleDiffs.length}):`);
      saleDiffs.forEach(d => console.log(`  * ID: ${d.id}: local=GH₵${d.localTotal} vs cloud=GH₵${d.cloudTotal}`));
    } else {
      console.log('✓ All matched sales have identical total amounts.');
    }

    // 5. SALE ITEMS
    console.log('\n--- 5. SALE ITEMS ---');
    const localSaleItems = await prisma.saleItem.count();
    const { count: cloudSaleItemsCount } = await supabase
      .from('cloud_sale_items')
      .select('*', { count: 'exact', head: true });
    console.log(`Local SQLite sale items count: ${localSaleItems}`);
    console.log(`Online Supabase sale items count: ${cloudSaleItemsCount || 0}`);
    if (localSaleItems !== (cloudSaleItemsCount || 0)) auditFailed = true;

    // 6. STOCK MOVEMENTS
    console.log('\n--- 6. STOCK MOVEMENTS ---');
    const localSmCount = await prisma.stockMovement.count();
    const { count: cloudSmCount } = await supabase
      .from('cloud_stock_movements')
      .select('*', { count: 'exact', head: true });
    console.log(`Local SQLite stock movements count: ${localSmCount}`);
    console.log(`Online Supabase stock movements count: ${cloudSmCount || 0}`);
    if (localSmCount !== (cloudSmCount || 0)) auditFailed = true;

    // 7. AUDIT LOGS
    console.log('\n--- 7. AUDIT LOGS ---');
    const localAuditCount = await prisma.auditLog.count();
    const { count: cloudAuditCount } = await supabase
      .from('cloud_audit_logs')
      .select('*', { count: 'exact', head: true });
    console.log(`Local SQLite audit logs count: ${localAuditCount}`);
    console.log(`Online Supabase audit logs count: ${cloudAuditCount || 0}`);
    if (localAuditCount !== (cloudAuditCount || 0)) auditFailed = true;

    // 8. OTHER TABLES (CUSTOMERS, SUPPLIERS, USERS, CATEGORIES, PURCHASES)
    console.log('\n--- 8. OTHER ENTITIES ---');
    const [cCount, sCount, uCount, catCount, pCount] = await Promise.all([
      prisma.customer.count(),
      prisma.supplier.count(),
      prisma.user.count(),
      prisma.category.count(),
      prisma.purchase.count()
    ]);
    console.log(`Local Customers: ${cCount}`);
    console.log(`Local Suppliers: ${sCount}`);
    console.log(`Local Users: ${uCount}`);
    console.log(`Local Categories: ${catCount}`);
    console.log(`Local Purchases: ${pCount}`);

    const { data: cloudAuditState } = await supabase
      .from('cloud_audit_logs')
      .select('id, category, details, created_at')
      .in('id', ['STATE_USERS', 'STATE_CUSTOMERS', 'STATE_SUPPLIERS', 'STATE_SETTINGS', 'STATE_CATEGORIES', 'STATE_PURCHASES']);
    console.log('State mirrors in Cloud audit logs:');
    (cloudAuditState || []).forEach(s => console.log(`  - [${s.id}] ${s.details} (${s.created_at})`));

    // 9. CLOUD SYNC EVENTS
    console.log('\n--- 9. CLOUD SYNC EVENTS TABLE ---');
    const { count: eventCount } = await supabase
      .from('cloud_sync_events')
      .select('*', { count: 'exact', head: true });
    console.log(`Total events in cloud_sync_events: ${eventCount || 0}`);

    console.log('\n================================================================');
    console.log(auditFailed ? 'AUDIT FAILED: discrepancies or undrained outbox require attention.' : 'AUDIT PASSED: local and cloud mirrors agree; outbox is drained.');
    console.log('================================================================');
    if (auditFailed) process.exitCode = 1;

  } catch (err) {
    console.error('Error during comparison:', err);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

runComparison();
