-- Initial Supabase mirror schema. Run before 20250930_cloud_stock_movements.sql.
-- The tablet hub uses SUPABASE_SERVICE_ROLE_KEY for writes; browser clients are read-only.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS sml_stores (
    id TEXT PRIMARY KEY DEFAULT 'sml_accra_main',
    name TEXT NOT NULL DEFAULT 'SML Legacy Limited - Cold Store Main Depot',
    location TEXT NOT NULL DEFAULT 'Cold Store Market Depot, Accra, Ghana',
    phone TEXT NOT NULL DEFAULT '+233 54 386 4610',
    email TEXT NOT NULL DEFAULT 'sorphygold@yahoo.com',
    owner_name TEXT NOT NULL DEFAULT 'Sofiyat Opeyemi Yusuf',
    owner_phone TEXT NOT NULL DEFAULT '+447999007775',
    currency TEXT NOT NULL DEFAULT 'GHS',
    currency_symbol TEXT NOT NULL DEFAULT 'GH₵',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO sml_stores (id, name, location, phone, email, owner_name, owner_phone, currency, currency_symbol)
VALUES ('sml_accra_main', 'SML Legacy Limited - Cold Store Main Depot', 'Cold Store Market Depot, Accra, Ghana', '+233 54 386 4610', 'sorphygold@yahoo.com', 'Sofiyat Opeyemi Yusuf', '+447999007775', 'GHS', 'GH₵')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS cloud_devices (
    device_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    device_name TEXT NOT NULL,
    device_type TEXT NOT NULL,
    app_version TEXT DEFAULT '1.0.0',
    ip_address TEXT,
    last_seen TIMESTAMPTZ DEFAULT NOW(),
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    generic_name TEXT,
    sku TEXT NOT NULL,
    category_name TEXT NOT NULL DEFAULT 'General',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    min_stock_level INT NOT NULL DEFAULT 10,
    version INT NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES cloud_products(id) ON DELETE CASCADE,
    batch_number TEXT NOT NULL,
    expiry_date TIMESTAMPTZ NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_sales (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    sale_number TEXT,
    customer_name TEXT DEFAULT 'Walk-in Customer',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method TEXT NOT NULL DEFAULT 'CASH',
    cashier_username TEXT DEFAULT 'cashier',
    device_id TEXT,
    date TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cloud_sales_store_id UNIQUE (store_id, id)
);

CREATE TABLE IF NOT EXISTS cloud_sale_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    sale_id TEXT NOT NULL REFERENCES cloud_sales(id) ON DELETE CASCADE,
    product_id TEXT,
    batch_id TEXT,
    product_name TEXT NOT NULL,
    sku TEXT,
    quantity INT NOT NULL DEFAULT 1,
    unit_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    unit_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS cloud_sale_payments (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    sale_id TEXT NOT NULL REFERENCES cloud_sales(id) ON DELETE CASCADE,
    method TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00
);

CREATE TABLE IF NOT EXISTS cloud_purchases (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    supplier_name TEXT DEFAULT 'Local Supplier',
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status TEXT NOT NULL DEFAULT 'COMPLETED',
    device_id TEXT,
    date TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cloud_purchases_store_id UNIQUE (store_id, id)
);

CREATE TABLE IF NOT EXISTS cloud_purchase_items (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    purchase_id TEXT NOT NULL REFERENCES cloud_purchases(id) ON DELETE CASCADE,
    product_id TEXT,
    quantity INT NOT NULL DEFAULT 1,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    batch_number TEXT,
    expiry_date TIMESTAMPTZ
);

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

CREATE TABLE IF NOT EXISTS cloud_audit_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    category TEXT NOT NULL,
    details TEXT NOT NULL,
    operator TEXT DEFAULT 'System',
    role TEXT DEFAULT 'STAFF',
    severity TEXT NOT NULL DEFAULT 'INFO',
    device_id TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL,
    synced_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_sync_events (
    cursor_seq BIGSERIAL PRIMARY KEY,
    event_id TEXT UNIQUE NOT NULL,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload JSONB NOT NULL,
    device_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cloud_sync_sessions (
    id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::TEXT,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    device_id TEXT DEFAULT 'Local Depot Hub',
    sync_type TEXT DEFAULT 'AUTO_BACKGROUND',
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    events_attempted INT NOT NULL DEFAULT 0,
    events_succeeded INT NOT NULL DEFAULT 0,
    events_failed INT NOT NULL DEFAULT 0,
    duration_ms INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    error_summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cloud_devices_store ON cloud_devices(store_id);
CREATE INDEX IF NOT EXISTS idx_cloud_products_sku ON cloud_products(sku);
CREATE INDEX IF NOT EXISTS idx_cloud_products_category ON cloud_products(category_name);
CREATE INDEX IF NOT EXISTS idx_cloud_batches_product ON cloud_batches(product_id);
CREATE INDEX IF NOT EXISTS idx_cloud_batches_expiry ON cloud_batches(expiry_date);
CREATE INDEX IF NOT EXISTS idx_cloud_sales_date ON cloud_sales(date DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_sales_total ON cloud_sales(total DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_sale_items_sale ON cloud_sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sale_payments_sale ON cloud_sale_payments(sale_id);
CREATE INDEX IF NOT EXISTS idx_cloud_purchases_date ON cloud_purchases(date DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_purchase_items_purchase ON cloud_purchase_items(purchase_id);
CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_product ON cloud_stock_movements(product_id);
CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_created ON cloud_stock_movements(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_stock_movements_type ON cloud_stock_movements(movement_type);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_logs_created_at ON cloud_audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cloud_audit_logs_severity ON cloud_audit_logs(severity);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_events_cursor ON cloud_sync_events(cursor_seq ASC);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_events_entity ON cloud_sync_events(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_cloud_sync_sessions_created_at ON cloud_sync_sessions(created_at DESC);

ALTER TABLE sml_stores ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sale_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_purchase_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_stock_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sync_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_sync_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read for portal" ON sml_stores;
DROP POLICY IF EXISTS "Allow POS and Portal access devices" ON cloud_devices;
DROP POLICY IF EXISTS "Allow POS and Portal access products" ON cloud_products;
DROP POLICY IF EXISTS "Allow POS and Portal access batches" ON cloud_batches;
DROP POLICY IF EXISTS "Allow POS and Portal access sales" ON cloud_sales;
DROP POLICY IF EXISTS "Allow POS and Portal access sale items" ON cloud_sale_items;
DROP POLICY IF EXISTS "Allow POS and Portal access sale payments" ON cloud_sale_payments;
DROP POLICY IF EXISTS "Allow POS and Portal access purchases" ON cloud_purchases;
DROP POLICY IF EXISTS "Allow POS and Portal access purchase items" ON cloud_purchase_items;
DROP POLICY IF EXISTS "Allow POS and Portal access stock movements" ON cloud_stock_movements;
DROP POLICY IF EXISTS "Allow POS and Portal access audit logs" ON cloud_audit_logs;
DROP POLICY IF EXISTS "Allow POS and Portal access sync events" ON cloud_sync_events;
DROP POLICY IF EXISTS "Allow POS and Portal access sync sessions" ON cloud_sync_sessions;

DROP POLICY IF EXISTS "Allow portal read devices" ON cloud_devices;
DROP POLICY IF EXISTS "Allow portal read products" ON cloud_products;
DROP POLICY IF EXISTS "Allow portal read batches" ON cloud_batches;
DROP POLICY IF EXISTS "Allow portal read sales" ON cloud_sales;
DROP POLICY IF EXISTS "Allow portal read sale items" ON cloud_sale_items;
DROP POLICY IF EXISTS "Allow portal read sale payments" ON cloud_sale_payments;
DROP POLICY IF EXISTS "Allow portal read purchases" ON cloud_purchases;
DROP POLICY IF EXISTS "Allow portal read purchase items" ON cloud_purchase_items;
DROP POLICY IF EXISTS "Allow portal read stock movements" ON cloud_stock_movements;
DROP POLICY IF EXISTS "Allow portal read audit logs" ON cloud_audit_logs;
DROP POLICY IF EXISTS "Allow portal read sync events" ON cloud_sync_events;
DROP POLICY IF EXISTS "Allow portal read sync sessions" ON cloud_sync_sessions;

CREATE POLICY "Allow public read for portal" ON sml_stores FOR SELECT USING (true);
CREATE POLICY "Allow portal read devices" ON cloud_devices FOR SELECT USING (true);
CREATE POLICY "Allow portal read products" ON cloud_products FOR SELECT USING (true);
CREATE POLICY "Allow portal read batches" ON cloud_batches FOR SELECT USING (true);
CREATE POLICY "Allow portal read sales" ON cloud_sales FOR SELECT USING (true);
CREATE POLICY "Allow portal read sale items" ON cloud_sale_items FOR SELECT USING (true);
CREATE POLICY "Allow portal read sale payments" ON cloud_sale_payments FOR SELECT USING (true);
CREATE POLICY "Allow portal read purchases" ON cloud_purchases FOR SELECT USING (true);
CREATE POLICY "Allow portal read purchase items" ON cloud_purchase_items FOR SELECT USING (true);
CREATE POLICY "Allow portal read stock movements" ON cloud_stock_movements FOR SELECT USING (true);
CREATE POLICY "Allow portal read audit logs" ON cloud_audit_logs FOR SELECT USING (true);
CREATE POLICY "Allow portal read sync events" ON cloud_sync_events FOR SELECT USING (true);
CREATE POLICY "Allow portal read sync sessions" ON cloud_sync_sessions FOR SELECT USING (true);

GRANT SELECT ON TABLE sml_stores, cloud_devices, cloud_products, cloud_batches, cloud_sales,
    cloud_sale_items, cloud_sale_payments, cloud_purchases, cloud_purchase_items,
    cloud_stock_movements, cloud_audit_logs, cloud_sync_events, cloud_sync_sessions TO anon, authenticated;
GRANT ALL ON TABLE sml_stores, cloud_devices, cloud_products, cloud_batches, cloud_sales,
    cloud_sale_items, cloud_sale_payments, cloud_purchases, cloud_purchase_items,
    cloud_stock_movements, cloud_audit_logs, cloud_sync_events, cloud_sync_sessions TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;

DO $$
DECLARE
    table_name TEXT;
BEGIN
    FOREACH table_name IN ARRAY ARRAY['cloud_sales', 'cloud_products', 'cloud_stock_movements', 'cloud_audit_logs', 'cloud_sync_events']
    LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_publication_tables
            WHERE pubname = 'supabase_realtime'
              AND schemaname = 'public'
              AND tablename = table_name
        ) THEN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
        END IF;
    END LOOP;
END $$;
