-- ==============================================================================
-- SML LEGACY LIMITED - DEDICATED CLOUD TABLES MIGRATION
-- First-class relational tables for Categories, Customers, Suppliers, and Users
-- ==============================================================================

-- 1. CLOUD CATEGORIES
CREATE TABLE IF NOT EXISTS cloud_categories (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_categories_name ON cloud_categories(name);

-- 2. CLOUD CUSTOMERS
CREATE TABLE IF NOT EXISTS cloud_customers (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_customers_phone ON cloud_customers(phone);
CREATE INDEX IF NOT EXISTS idx_cloud_customers_name ON cloud_customers(name);

-- 3. CLOUD SUPPLIERS
CREATE TABLE IF NOT EXISTS cloud_suppliers (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_suppliers_name ON cloud_suppliers(name);

-- 4. CLOUD USERS
CREATE TABLE IF NOT EXISTS cloud_users (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    pin TEXT DEFAULT '1234',
    role TEXT NOT NULL DEFAULT 'CASHIER',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cloud_users_username ON cloud_users(username);

-- RLS & Permissions
ALTER TABLE cloud_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE cloud_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public access to cloud_categories" ON cloud_categories;
CREATE POLICY "Allow public access to cloud_categories" ON cloud_categories FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access to cloud_customers" ON cloud_customers;
CREATE POLICY "Allow public access to cloud_customers" ON cloud_customers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access to cloud_suppliers" ON cloud_suppliers;
CREATE POLICY "Allow public access to cloud_suppliers" ON cloud_suppliers FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public access to cloud_users" ON cloud_users;
CREATE POLICY "Allow public access to cloud_users" ON cloud_users FOR ALL USING (true);

GRANT ALL ON TABLE cloud_categories, cloud_customers, cloud_suppliers, cloud_users TO anon, authenticated, service_role;

-- Enable Realtime Replication
ALTER PUBLICATION supabase_realtime ADD TABLE cloud_categories, cloud_customers, cloud_suppliers, cloud_users;
