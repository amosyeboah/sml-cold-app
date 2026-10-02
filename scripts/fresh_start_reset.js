const path = require('path');
const ws = require('ws');
globalThis.WebSocket = ws;
const { createClient } = require('@supabase/supabase-js');
const { PrismaClient } = require('../generated/client');
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

async function freshStartReset() {
  console.log('====================================================');
  console.log('  SML COLD STORE: COMPLETE FRESH START RESET');
  console.log('====================================================\n');

  try {
    // ------------------------------------------------------------------
    // STEP 1: PURGE SUPABASE CLOUD SALES & AUDIT LOGS
    // ------------------------------------------------------------------
    console.log('1. Clearing Supabase Cloud transactions...');
    
    // Delete sale items
    const { error: errItems } = await supabase.from('cloud_sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errItems) console.warn('   cloud_sale_items purge note:', errItems.message);
    else console.log('   ✓ Cleared cloud_sale_items');

    // Delete sales
    const { error: errSales } = await supabase.from('cloud_sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errSales) console.warn('   cloud_sales purge note:', errSales.message);
    else console.log('   ✓ Cleared cloud_sales');

    // Delete audit logs
    const { error: errAudit } = await supabase.from('cloud_audit_logs').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (errAudit) console.warn('   cloud_audit_logs purge note:', errAudit.message);
    else console.log('   ✓ Cleared cloud_audit_logs');

    // ------------------------------------------------------------------
    // STEP 2: CLEAR LOCAL SQLITE DATABASE
    // ------------------------------------------------------------------
    console.log('\n2. Clearing Local SQLite Database...');
    await prisma.salePayment.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.stockMovement.deleteMany();
    await prisma.syncOutbox.deleteMany();
    await prisma.syncInbox.deleteMany();
    await prisma.purchaseItem.deleteMany();
    await prisma.purchase.deleteMany();
    await prisma.batch.deleteMany();
    await prisma.medicine.deleteMany();
    await prisma.category.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.customer.deleteMany();
    await prisma.user.deleteMany();
    console.log('   ✓ Local SQLite completely purged');

    console.log('\n====================================================');
    console.log('  DATABASE PURGE COMPLETE!');
    console.log('  Next step: Seeding fresh default catalog...');
    console.log('====================================================\n');
  } catch (err) {
    console.error('Reset error:', err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

freshStartReset();
