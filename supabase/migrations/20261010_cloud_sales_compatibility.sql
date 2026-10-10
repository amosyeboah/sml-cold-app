-- ==============================================================================
-- SML LEGACY LIMITED - CLOUD SALES SCHEMA ALIGNMENT & COMPATIBILITY
-- Safe non-breaking ALTER statements to support both standard and legacy columns
-- ==============================================================================

-- 1. Ensure core cloud_sales columns exist
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS cashier_name TEXT DEFAULT 'cashier';
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS total_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS tax_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'COMPLETED';
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ DEFAULT NOW();

-- 2. Optional alias columns for backward compatibility
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS cashier_username TEXT DEFAULT 'cashier';
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS sale_number TEXT;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS total NUMERIC(12, 2);
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ;
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS synced_at TIMESTAMPTZ DEFAULT NOW();

-- 3. Ensure cloud_sale_items columns exist
ALTER TABLE cloud_sale_items ADD COLUMN IF NOT EXISTS total_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sale_items ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE cloud_sale_items ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_sale_items ADD COLUMN IF NOT EXISTS subtotal NUMERIC(12, 2) DEFAULT 0.00;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
