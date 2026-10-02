-- Run in Supabase SQL Editor if hub outbox STOCK_MOVEMENT sync reports a missing table.
-- Matches supabase/schema.sql section 10.

CREATE TABLE IF NOT EXISTS cloud_stock_movements (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    product_id TEXT NOT NULL,
    batch_id TEXT,
    quantity_delta INT NOT NULL,
    movement_type TEXT NOT NULL,
    reference_type TEXT NOT NULL,
    reference_id TEXT,
    unit_cost NUMERIC(12, 2),
    unit_price NUMERIC(12, 2),
    user_id TEXT,
    device_id TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_product ON cloud_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_created ON cloud_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_type ON cloud_stock_movements(movement_type);

-- Optional: align cloud_sales with repo schema (safe if column already exists)
ALTER TABLE cloud_sales ADD COLUMN IF NOT EXISTS device_id TEXT;
