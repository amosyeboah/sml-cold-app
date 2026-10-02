globalThis.WebSocket = require('ws');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const url = process.env.VITE_SUPABASE_URL || 'https://porlaindujqtgrtiuzjz.supabase.co';
const key = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBvcmxhaW5kdWpxdGdydGl1emp6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA4ODYyMDIsImV4cCI6MjEwNjQ2MjIwMn0.apA4OxPtd500-6hgxg7Eoha9PCFU6DKcZqYNzTreCpk';

const client = createClient(url, key);

async function test() {
  const { data: sales, error: salesErr } = await client.from('cloud_sales').select('*').limit(5);
  console.log('Sales:', sales?.length, salesErr);

  const { data: prods, error: prodsErr } = await client.from('cloud_products').select('*').limit(5);
  console.log('Products:', prods?.length, prodsErr);
}

test();
