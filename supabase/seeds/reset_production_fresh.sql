-- ==============================================================================
-- SML LEGACY LIMITED - FRESH PRODUCTION RESET SCRIPT
-- Run this in the Supabase SQL Editor when ready to deploy for real store operations.
-- This wipes all test/demo data and leaves only the store depot & initial Admin account.
-- ==============================================================================

-- 1. Ensure prerequisite tables exist (prevents errors on missing relations)
CREATE TABLE IF NOT EXISTS sml_stores (
    id TEXT PRIMARY KEY DEFAULT 'sml_accra_main',
    name TEXT NOT NULL DEFAULT 'SOFIYEM Legacy Limited - Cold Store Main Depot',
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

ALTER TABLE sml_stores ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public read for portal" ON sml_stores;
CREATE POLICY "Allow public read for portal" ON sml_stores FOR SELECT USING (true);
GRANT SELECT ON TABLE sml_stores TO anon, authenticated;
GRANT ALL ON TABLE sml_stores TO service_role;

CREATE TABLE IF NOT EXISTS cloud_sync_sessions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    device_id TEXT DEFAULT 'Local Depot Hub',
    sync_type TEXT DEFAULT 'AUTO_BACKGROUND',
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    events_attempted INT NOT NULL DEFAULT 0,
    events_succeeded INT NOT NULL DEFAULT 0,
    events_failed INT NOT NULL DEFAULT 0,
    items_count INT DEFAULT 0,
    duration_ms INT DEFAULT 0,
    latency_ms INT DEFAULT 0,
    error_summary TEXT,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure columns exist if table was previously created with older schema
ALTER TABLE cloud_sync_sessions ADD COLUMN IF NOT EXISTS items_count INT DEFAULT 0;
ALTER TABLE cloud_sync_sessions ADD COLUMN IF NOT EXISTS error_message TEXT;

CREATE INDEX IF NOT EXISTS idx_cloud_sync_sessions_created_at ON cloud_sync_sessions(created_at DESC);
ALTER TABLE cloud_sync_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow portal read sync sessions" ON cloud_sync_sessions;
CREATE POLICY "Allow portal read sync sessions" ON cloud_sync_sessions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow POS and Portal access sync sessions" ON cloud_sync_sessions;
CREATE POLICY "Allow POS and Portal access sync sessions" ON cloud_sync_sessions FOR ALL USING (true);
GRANT ALL ON TABLE cloud_sync_sessions TO anon, authenticated, service_role;

-- Harmonize schema for cloud_products and cloud_batches if they exist
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cloud_products') THEN
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'General';
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS stock_quantity INT DEFAULT 0;
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS current_stock INT DEFAULT 0;
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS min_stock_level INT DEFAULT 10;
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'CARTON';
        ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS requires_cold_storage BOOLEAN DEFAULT true;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cloud_batches') THEN
        ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
        ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
        ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) DEFAULT 0.00;
        ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
END $$;

-- 2. Wipe all transactional and catalog records safely
-- Dynamic query ensures only existing tables are truncated without aborting if a table is missing
DO $$
DECLARE
    target_tables text;
BEGIN
    SELECT string_agg(quote_ident(table_name), ', ')
    INTO target_tables
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = ANY(ARRAY[
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
      ]);

    IF target_tables IS NOT NULL AND target_tables <> '' THEN
        EXECUTE 'TRUNCATE TABLE ' || target_tables || ' CASCADE;';
    END IF;
END $$;

-- 3. Verify Store Depot Record exists
INSERT INTO sml_stores (id, name, location, phone, email, owner_name, owner_phone, currency, currency_symbol)
VALUES (
    'sml_accra_main',
    'SOFIYEM Legacy Limited - Cold Store Main Depot',
    'Cold Store Market Depot, Accra, Ghana',
    '+233 54 386 4610',
    'sorphygold@yahoo.com',
    'Sofiyat Opeyemi Yusuf',
    '+447999007775',
    'GHS',
    'GH₵'
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    location = EXCLUDED.location,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    owner_name = EXCLUDED.owner_name,
    owner_phone = EXCLUDED.owner_phone;

-- 4. Reset Users to clean initial Admin account
-- Username: 'admin' | Password: 'admin1234' | PIN: '1111'
CREATE TABLE IF NOT EXISTS cloud_users (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    pin TEXT DEFAULT '1111',
    role TEXT NOT NULL DEFAULT 'ADMIN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cloud_users ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '1111';
ALTER TABLE cloud_users ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';

ALTER TABLE cloud_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow public access to cloud_users" ON cloud_users;
CREATE POLICY "Allow public access to cloud_users" ON cloud_users FOR ALL USING (true);
GRANT ALL ON TABLE cloud_users TO anon, authenticated, service_role;

DELETE FROM cloud_users;

INSERT INTO cloud_users (id, store_id, username, password_hash, pin, role, created_at, updated_at)
VALUES (
    'usr_admin_root',
    'sml_accra_main',
    'admin',
    '$2a$10$WfvX8Rt.Fmy9kdPSboP1OO5tYpCFbbEgYW0HQyXqpMvOWbGogKrbi',
    '1111',
    'ADMIN',
    NOW(),
    NOW()
);

-- 5. Ensure cloud_audit_logs exists and reconcile all possible column names
CREATE TABLE IF NOT EXISTS cloud_audit_logs (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    category TEXT,
    entity_name TEXT,
    entity_id TEXT,
    details TEXT,
    operator TEXT DEFAULT 'System',
    user_name TEXT DEFAULT 'System',
    role TEXT DEFAULT 'ADMIN',
    severity TEXT NOT NULL DEFAULT 'INFO',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Harmonize schema for existing cloud_audit_logs tables (prevents 42703 column does not exist)
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS operator TEXT DEFAULT 'System';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS details TEXT;

ALTER TABLE cloud_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow portal read audit logs" ON cloud_audit_logs;
CREATE POLICY "Allow portal read audit logs" ON cloud_audit_logs FOR SELECT USING (true);
DROP POLICY IF EXISTS "Allow POS and Portal access audit logs" ON cloud_audit_logs;
CREATE POLICY "Allow POS and Portal access audit logs" ON cloud_audit_logs FOR ALL USING (true);
GRANT ALL ON TABLE cloud_audit_logs TO anon, authenticated, service_role;

INSERT INTO cloud_audit_logs (
    id, store_id, action, category, entity_name, entity_id, details, operator, user_name, role, severity, created_at
)
VALUES (
    'aud_prod_init_' || extract(epoch from now())::text,
    'sml_accra_main',
    'SYSTEM_INIT',
    'SYSTEM',
    'SYSTEM',
    'sml_accra_main',
    'Cold store production database initialized cleanly. Ready for live inventory.',
    'System',
    'System',
    'ADMIN',
    'INFO',
    NOW()
);
