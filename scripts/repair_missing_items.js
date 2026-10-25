globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk';

const client = createClient(url, key);

async function run() {
  const { data: allSales, error: sErr } = await client
    .from('cloud_sales')
    .select('*')
    .order('created_at', { ascending: false });

  if (sErr || !allSales) {
    console.error('Failed to fetch sales:', sErr);
    return;
  }

  const { data: allItems, error: iErr } = await client
    .from('cloud_sale_items')
    .select('sale_id');

  const existingSaleIds = new Set((allItems || []).map((i) => i.sale_id));
  const missing = allSales.filter((s) => !existingSaleIds.has(s.id));

  console.log(`Total cloud_sales: ${allSales.length}`);
  console.log(`Sales WITH items: ${existingSaleIds.size}`);
  console.log(`Sales WITHOUT items: ${missing.length}`);

  // Fetch audit logs to see if we have itemsCount or details
  const { data: logs } = await client.from('cloud_audit_logs').select('*');
  const logMap = new Map();
  for (const l of logs || []) {
    if (l.entity_id) logMap.set(l.entity_id, l);
    if (l.metadata && l.metadata.saleId) logMap.set(l.metadata.saleId, l);
  }

  const itemsToInsert = [];

  for (const s of missing) {
    const saleDate = s.sold_at || s.created_at || new Date().toISOString();
    const totalAmt = Number(s.total_amount ?? s.total ?? 0);

    // Try finding matching audit log
    let itemsCount = 1;
    let match = logMap.get(s.id);
    if (!match && logs) {
      match = logs.find((l) => {
        if (typeof l.details === 'string' && (l.details.includes(s.id) || (s.invoice_number && l.details.includes(s.invoice_number)))) {
          return true;
        }
        if (Math.abs(new Date(l.created_at).getTime() - new Date(saleDate).getTime()) < 3000) {
          const detailAmt = l.details?.match(/GH[₵c]\s*([0-9.]+)/i);
          if (detailAmt && Math.abs(parseFloat(detailAmt[1]) - totalAmt) < 0.1) {
            return true;
          }
        }
        return false;
      });
    }

    if (match) {
      if (match.metadata && match.metadata.itemsCount) {
        itemsCount = Math.max(1, Number(match.metadata.itemsCount));
      } else if (typeof match.details === 'string') {
        const countMatch = match.details.match(/\((\d+)\s+items?/i);
        if (countMatch) {
          itemsCount = Math.max(1, parseInt(countMatch[1], 10));
        }
      }
    }

    const unitPrice = itemsCount > 0 ? Math.round((totalAmt / itemsCount) * 100) / 100 : totalAmt;
    const invLabel = s.invoice_number || `INV-${String(s.id).slice(0, 8).toUpperCase()}`;

    itemsToInsert.push({
      id: `repair_${s.id}_item_1`,
      sale_id: s.id,
      product_id: null,
      batch_id: null,
      product_name: `Cold Store Products (${invLabel})`,
      quantity: itemsCount,
      unit_price: unitPrice,
      total_price: totalAmt,
      created_at: saleDate,
    });
  }

  console.log(`Generated ${itemsToInsert.length} self-healing items for missing sales.`);
  if (itemsToInsert.length > 0) {
    console.log('Sample item to insert:', itemsToInsert[0]);
    // Batch insert in chunks of 25
    for (let i = 0; i < itemsToInsert.length; i += 25) {
      const chunk = itemsToInsert.slice(i, i + 25);
      const { error: insErr } = await client.from('cloud_sale_items').upsert(chunk);
      if (insErr) {
        console.error(`Error inserting chunk ${i}:`, insErr);
      } else {
        console.log(`Successfully repaired chunk ${i} to ${i + chunk.length}`);
      }
    }
  }

  // Final verification
  const { count: finalItemsCount } = await client.from('cloud_sale_items').select('*', { count: 'exact', head: true });
  console.log(`Done! Total cloud_sale_items is now: ${finalItemsCount}`);
}

run();
