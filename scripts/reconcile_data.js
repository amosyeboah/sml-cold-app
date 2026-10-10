const { PrismaClient } = require('../generated/client');
const path = require('path');
const ws = require('ws');
globalThis.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '../database/pharmacy.db').replace(/\\/g, '/');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function reconcile() {
  console.log('================================================================');
  console.log('STARTING SML COLD STORE DATABASE RECONCILIATION');
  console.log('================================================================\n');

  try {
    // -------------------------------------------------------------------------
    // 1. PRODUCTS & BATCHES RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('--- Step 1: Reconciling Products & Batches ---');
    const localProducts = await prisma.medicine.findMany({
      include: {
        category: true,
        batches: true
      }
    });
    const localBatches = await prisma.batch.findMany({
      include: { medicine: true }
    });

    const localProductIds = new Set(localProducts.map(p => p.id));
    const localBatchIds = new Set(localBatches.map(b => b.id));

    // A. Remove zombie / test products and batches from Supabase
    const { data: cloudProducts } = await supabase.from('cloud_products').select('id, name, sku');
    if (cloudProducts && cloudProducts.length > 0) {
      const zombieProducts = cloudProducts.filter(cp => !localProductIds.has(cp.id));
      if (zombieProducts.length > 0) {
        console.log(`Found ${zombieProducts.length} zombie/test product(s) in Cloud to remove:`);
        for (const zp of zombieProducts) {
          console.log(`  - Purging [${zp.sku}] ${zp.name} (id: ${zp.id})`);
          await supabase.from('cloud_batches').delete().eq('product_id', zp.id);
          await supabase.from('cloud_products').delete().eq('id', zp.id);
        }
      }
    }

    const { data: cloudBatches } = await supabase.from('cloud_batches').select('id, batch_number');
    if (cloudBatches && cloudBatches.length > 0) {
      const zombieBatches = cloudBatches.filter(cb => !localBatchIds.has(cb.id));
      if (zombieBatches.length > 0) {
        console.log(`Found ${zombieBatches.length} zombie/test batch(es) in Cloud to remove:`);
        for (const zb of zombieBatches) {
          console.log(`  - Purging batch [${zb.batch_number}] (id: ${zb.id})`);
          await supabase.from('cloud_batches').delete().eq('id', zb.id);
        }
      }
    }

    // B. Push authoritative products to Cloud with correct stock levels
    console.log(`Pushing ${localProducts.length} authoritative products to Cloud...`);
    const cloudProductsToUpsert = localProducts.map(p => {
      const totalStock = p.batches.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
      return {
        id: p.id,
        store_id: 'sml_accra_main',
        name: p.name,
        generic_name: p.genericName || null,
        sku: p.sku,
        category_name: p.category?.name || 'General',
        price: Number(p.price) || 0,
        cost: Number(p.cost) || 0,
        stock_quantity: totalStock,
        min_stock_level: Number(p.minStockLevel) || 10,
        updated_at: new Date().toISOString()
      };
    });
    const { error: prodUpsertErr } = await supabase.from('cloud_products').upsert(cloudProductsToUpsert, { onConflict: 'id' });
    if (prodUpsertErr) throw new Error('Products upsert failed: ' + prodUpsertErr.message);
    console.log('✓ All products aligned.');

    // C. Push authoritative batches to Cloud with correct lot quantities
    console.log(`Pushing ${localBatches.length} authoritative batches to Cloud...`);
    const cloudBatchesToUpsert = localBatches.map(b => ({
      id: b.id,
      product_id: b.medicineId,
      batch_number: b.batchNumber,
      expiry_date: new Date(b.expiryDate).toISOString(),
      quantity: Number(b.quantity) || 0,
      updated_at: new Date().toISOString()
    }));
    const { error: batchUpsertErr } = await supabase.from('cloud_batches').upsert(cloudBatchesToUpsert, { onConflict: 'id' });
    if (batchUpsertErr) throw new Error('Batches upsert failed: ' + batchUpsertErr.message);
    console.log('✓ All batches aligned.\n');

    // -------------------------------------------------------------------------
    // 2. SALES TRANSACTIONS RECONCILIATION
    // -------------------------------------------------------------------------
    console.log('--- Step 2: Reconciling Sales Transactions ---');
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

    const localSaleIds = new Set(localSales.map(s => s.id));

    // A. Purge test sales from Cloud that do not exist in local POS ledger
    const { data: currentCloudSales } = await supabase.from('cloud_sales').select('id, sale_number, customer_name, total');
    const cloudTestSales = (currentCloudSales || []).filter(cs => !localSaleIds.has(cs.id));
    if (cloudTestSales.length > 0) {
      console.log(`Found ${cloudTestSales.length} test sale(s) in Cloud not present in local POS ledger:`);
      for (const ts of cloudTestSales) {
        console.log(`  - Purging test sale ${ts.sale_number} (id: ${ts.id}, total: GH₵${ts.total})`);
        await supabase.from('cloud_sale_items').delete().eq('sale_id', ts.id);
        await supabase.from('cloud_sales').delete().eq('id', ts.id);
      }
      console.log('✓ Cloud test sales purged.');
    }

    // B. Push all 119 local sales to Cloud (without device_id)
    console.log(`Syncing all ${localSales.length} local sales to Cloud...`);
    const cloudSalesToUpsert = localSales.map(s => {
      let pm = s.paymentMethod || 'CASH';
      if (s.payments && s.payments.length > 1) {
        const cashAmt = s.payments.filter(p => !p.method.toUpperCase().includes('MOBILE') && !p.method.toUpperCase().includes('MOMO')).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        const mobileAmt = s.payments.filter(p => p.method.toUpperCase().includes('MOBILE') || p.method.toUpperCase().includes('MOMO')).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        pm = `SPLIT:CASH=${cashAmt},MOBILE=${mobileAmt}`;
      } else if (pm === 'SPLIT') {
        pm = `SPLIT:CASH=${(s.total || 0) / 2},MOBILE=${(s.total || 0) / 2}`;
      }

      const saleDate = s.date ? new Date(s.date).toISOString() : new Date().toISOString();
      const totalAmt = Number(s.total) || 0;
      return {
        id: s.id,
        store_id: 'sml_accra_main',
        invoice_number: `INV-${String(s.id).slice(0, 8).toUpperCase()}`,
        customer_name: s.customer?.name || 'Walk-in Customer',
        total_amount: totalAmt,
        subtotal: Number(s.subtotal ?? totalAmt),
        payment_method: pm,
        cashier_name: s.cashier || 'cashier',
        sold_at: saleDate,
        created_at: saleDate
      };
    });

    // Upsert sales in chunks of 50
    for (let i = 0; i < cloudSalesToUpsert.length; i += 50) {
      const chunk = cloudSalesToUpsert.slice(i, i + 50);
      const { error: salesErr } = await supabase.from('cloud_sales').upsert(chunk, { onConflict: 'id' });
      if (salesErr) throw new Error('Sales upsert chunk failed: ' + salesErr.message);
    }
    console.log(`✓ All ${cloudSalesToUpsert.length} sales upserted into cloud_sales.`);

    // C. Upsert all sale items to Cloud
    const allSaleItems = [];
    for (const s of localSales) {
      if (s.items && s.items.length > 0) {
        const saleDate = s.date ? new Date(s.date).toISOString() : new Date().toISOString();
        for (const item of s.items) {
          const unitPrice = Number(item.price ?? item.batch?.medicine?.price ?? 0);
          const qty = Number(item.quantity) || 1;
          allSaleItems.push({
            id: item.id,
            sale_id: s.id,
            product_id: item.batch?.medicineId || null,
            product_name: item.batch?.medicine?.name || 'Cold Store Item',
            quantity: qty,
            unit_price: unitPrice,
            total_price: qty * unitPrice,
            created_at: saleDate
          });
        }
      }
    }

    if (allSaleItems.length > 0) {
      console.log(`Syncing ${allSaleItems.length} sale items to Cloud...`);
      for (let i = 0; i < allSaleItems.length; i += 50) {
        const chunk = allSaleItems.slice(i, i + 50);
        const { error: itemsErr } = await supabase.from('cloud_sale_items').upsert(chunk, { onConflict: 'id' });
        if (itemsErr) console.warn('Sale items upsert warning:', itemsErr.message);
      }
      console.log('✓ All sale items upserted.');
    }
    console.log('');

    // -------------------------------------------------------------------------
    // 3. STATE MIRRORS (USERS, CATEGORIES, CUSTOMERS, SUPPLIERS, SETTINGS)
    // -------------------------------------------------------------------------
    console.log('--- Step 3: Mirroring Store Master State to Cloud ---');
    const [users, categories, customers, suppliers, settings] = await Promise.all([
      prisma.user.findMany({ select: { id: true, username: true, role: true, pin: true, createdAt: true } }),
      prisma.category.findMany(),
      prisma.customer.findMany(),
      prisma.supplier.findMany(),
      prisma.setting.findMany()
    ]);

    const settingsMap = {};
    settings.forEach(s => { settingsMap[s.key] = s.value; });

    const timestamp = new Date().toISOString();
    const stateMirrors = [
      {
        id: 'STATE_USERS',
        store_id: 'sml_accra_main',
        action: 'SYSTEM_STATE_SNAPSHOT',
        category: 'AUTH',
        details: `Synchronized ${users.length} active users`,
        operator: 'system',
        role: 'ADMIN',
        severity: 'INFO',
        metadata: { users },
        created_at: timestamp,
        synced_at: timestamp
      },
      {
        id: 'STATE_CATEGORIES',
        store_id: 'sml_accra_main',
        action: 'SYSTEM_STATE_SNAPSHOT',
        category: 'INVENTORY',
        details: `Synchronized ${categories.length} categories`,
        operator: 'system',
        role: 'ADMIN',
        severity: 'INFO',
        metadata: { categories },
        created_at: timestamp,
        synced_at: timestamp
      },
      {
        id: 'STATE_CUSTOMERS',
        store_id: 'sml_accra_main',
        action: 'SYSTEM_STATE_SNAPSHOT',
        category: 'CUSTOMERS',
        details: `Synchronized ${customers.length} customers`,
        operator: 'system',
        role: 'ADMIN',
        severity: 'INFO',
        metadata: { customers },
        created_at: timestamp,
        synced_at: timestamp
      },
      {
        id: 'STATE_SUPPLIERS',
        store_id: 'sml_accra_main',
        action: 'SYSTEM_STATE_SNAPSHOT',
        category: 'SUPPLIERS',
        details: `Synchronized ${suppliers.length} suppliers`,
        operator: 'system',
        role: 'ADMIN',
        severity: 'INFO',
        metadata: { suppliers },
        created_at: timestamp,
        synced_at: timestamp
      },
      {
        id: 'STATE_SETTINGS',
        store_id: 'sml_accra_main',
        action: 'SYSTEM_STATE_SNAPSHOT',
        category: 'SYSTEM',
        details: 'Synchronized store settings',
        operator: 'system',
        role: 'ADMIN',
        severity: 'INFO',
        metadata: { settings: settingsMap },
        created_at: timestamp,
        synced_at: timestamp
      }
    ];

    const { error: stateErr } = await supabase.from('cloud_audit_logs').upsert(stateMirrors, { onConflict: 'id' });
    if (stateErr) console.warn('State mirrors update warning:', stateErr.message);
    else console.log('✓ Store master snapshots mirrored to Cloud.');

    // -------------------------------------------------------------------------
    // 4. CLEAN & RESET LOCAL SYNCOUTBOX
    // -------------------------------------------------------------------------
    console.log('\n--- Step 4: Resetting Local SyncOutbox ---');
    const updatedOutbox = await prisma.syncOutbox.updateMany({
      where: { status: 'DEAD_LETTER' },
      data: {
        status: 'SYNCED',
        syncedAt: new Date(),
        processedAt: new Date(),
        errorMessage: null,
        lastError: null
      }
    });
    console.log(`✓ Cleared ${updatedOutbox.count} DEAD_LETTER records; marked as SYNCED.`);

    const ackedOutbox = await prisma.syncOutbox.updateMany({
      where: { status: { in: ['PENDING', 'FAILED'] } },
      data: {
        status: 'SYNCED',
        syncedAt: new Date(),
        processedAt: new Date(),
        errorMessage: null,
        lastError: null,
        nextAttemptAt: null,
      },
    });
    console.log(`✓ Acknowledged ${ackedOutbox.count} outbox event(s) as SYNCED after cloud reconciliation.`);

    const remainingPending = await prisma.syncOutbox.count({
      where: { status: 'PENDING' }
    });
    console.log(`✓ Remaining PENDING outbox items: ${remainingPending}`);

    console.log('\n================================================================');
    console.log('RECONCILIATION COMPLETED SUCCESSFULLY!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('Fatal error during reconciliation:', err);
  } finally {
    await prisma.$disconnect();
  }
}

console.error('Retired: use npm run compare:databases for read-only audits. Cloud synchronization is owned by the local hub outbox.');
process.exitCode = 1;
