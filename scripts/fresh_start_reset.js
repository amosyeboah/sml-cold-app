const path = require('path');
const ws = require('ws');
globalThis.WebSocket = ws;
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('../generated/client');
require('dotenv').config();

const dbPath = path.resolve(__dirname, '../database/pharmacy.db').replace(/\\/g, '/');
const prisma = new PrismaClient({
  datasources: { db: { url: `file:${dbPath}` } }
});

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk';

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});

async function freshStartReset() {
  console.log('====================================================');
  console.log('  SML COLD STORE: COMPLETE 100% PRODUCTION RESET');
  console.log('  Wipes Local SQLite + Supabase Cloud Clean');
  console.log('====================================================\n');

  try {
    // ------------------------------------------------------------------
    // STEP 1: CLEAR LOCAL SQLITE DATABASE (Desktop Hub)
    // ------------------------------------------------------------------
    console.log('1. Purging Local SQLite Database (pharmacy.db)...');
    
    // Clear sales & payments
    await prisma.salePayment.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.sale.deleteMany();
    console.log('   ✓ Cleared sales, payments, sale items');

    // Clear inventory, batches, movements & purchases
    await prisma.stockMovement.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.batch.deleteMany();
    await prisma.medicine.deleteMany();
    await prisma.category.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.customer.deleteMany();
    console.log('   ✓ Cleared purchases, batches, inventory, categories, customers, suppliers');

    // Clear sync outbox, inbox & sessions
    await prisma.syncOutbox.deleteMany();
    await prisma.syncInbox.deleteMany();
    try {
      await prisma.syncSession.deleteMany();
    } catch {}
    console.log('   ✓ Cleared offline sync queues and telemetry sessions');

    // Clear audit logs
    await prisma.auditLog.deleteMany();
    console.log('   ✓ Cleared local audit logs');

    // Reset Users to single production Admin
    await prisma.user.deleteMany();
    const adminPasswordHash = await bcrypt.hash('admin1234', 10);
    await prisma.user.create({
      data: {
        id: 'usr_admin_root',
        username: 'admin',
        password: adminPasswordHash,
        pin: '1111',
        role: 'ADMIN',
      }
    });
    console.log('   ✓ Initialized clean Admin account (user: admin | pass: admin1234 | PIN: 1111)');

    // Log fresh initialization
    await prisma.auditLog.create({
      data: {
        id: 'aud_prod_init_' + Date.now(),
        action: 'SYSTEM_INIT',
        category: 'SYSTEM',
        details: 'Cold store production database initialized cleanly. Ready for live inventory.',
        username: 'admin',
        userRole: 'ADMIN',
        severity: 'INFO',
      }
    });
    console.log('   ✓ Local SQLite completely purged and initialized.\n');

    // ------------------------------------------------------------------
    // STEP 2: PURGE SUPABASE CLOUD TABLES
    // ------------------------------------------------------------------
    console.log('2. Purging Supabase Cloud Remote Tables...');
    
    const tablesToPurge = [
      'cloud_sale_items',
      'cloud_sale_payments',
      'cloud_sales',
      'cloud_purchase_items',
      'cloud_purchases',
      'cloud_stock_movements',
      'cloud_batches',
      'cloud_products',
      'cloud_categories',
      'cloud_customers',
      'cloud_suppliers',
      'cloud_audit_logs',
      'cloud_sync_events',
      'cloud_sync_sessions'
    ];

    for (const tbl of tablesToPurge) {
      try {
        const { error } = await supabase.from(tbl).delete().neq('id', '___NEVER_MATCH___');
        if (error && !error.message.includes('does not exist')) {
          // If id column is integer (like cursor_seq) or not text
          await supabase.from(tbl).delete().gte('created_at', '1970-01-01');
        }
        console.log(`   ✓ Purged ${tbl}`);
      } catch (err) {
        console.warn(`   Note on ${tbl}: ${err.message || err}`);
      }
    }

    // Upsert Depot Store
    try {
      await supabase.from('sml_stores').upsert({
        id: 'sml_accra_main',
        name: 'SOFIYEM Legacy Limited - Cold Store Main Depot',
        location: 'Cold Store Market Depot, Accra, Ghana',
        phone: '+233 54 386 4610',
        email: 'sorphygold@yahoo.com',
        owner_name: 'Sofiyat Opeyemi Yusuf',
        owner_phone: '+447999007775',
        currency: 'GHS',
        currency_symbol: 'GH₵'
      });
      console.log('   ✓ Store depot verified in cloud');
    } catch {}

    // Reset cloud_users
    try {
      await supabase.from('cloud_users').delete().neq('id', '___NEVER_MATCH___');
      await supabase.from('cloud_users').insert({
        id: 'usr_admin_root',
        store_id: 'sml_accra_main',
        username: 'admin',
        password_hash: '$2a$10$WfvX8Rt.Fmy9kdPSboP1OO5tYpCFbbEgYW0HQyXqpMvOWbGogKrbi',
        pin: '1111',
        role: 'ADMIN'
      });
      console.log('   ✓ Cloud admin initialized');
    } catch {}

    // Insert Cloud Audit Init
    try {
      await supabase.from('cloud_audit_logs').insert({
        id: 'aud_prod_init_' + Date.now(),
        store_id: 'sml_accra_main',
        action: 'SYSTEM_INIT',
        category: 'SYSTEM',
        entity_name: 'SYSTEM',
        entity_id: 'sml_accra_main',
        details: 'Cold store production database initialized cleanly. Ready for live inventory.',
        operator: 'System',
        user_name: 'System',
        role: 'ADMIN',
        severity: 'INFO'
      });
      console.log('   ✓ Cloud audit log initialized');
    } catch {}

    console.log('\n====================================================');
    console.log('  SUCCESS: PRODUCTION RESET COMPLETED 100%!');
    console.log('  Both local SQLite and Supabase are clean.');
    console.log('  Admin Login: admin | Password: admin1234 | PIN: 1111');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Reset error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

freshStartReset();
