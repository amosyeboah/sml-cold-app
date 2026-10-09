-- ==============================================================================
-- SOFIYEM LEGACY LIMITED - DEMO & TESTING SEED DATA SCRIPT
-- Run this in the Supabase SQL Editor to populate demo categories, products,
-- batches, suppliers, customers, and test staff accounts.
-- ==============================================================================

-- 0. SCHEMA HARMONIZATION & PREREQUISITE TABLES
-- Ensures all tables and column variants exist to prevent 42P01 and 42703 errors.

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
DROP POLICY IF EXISTS "Allow POS and Portal access sml_stores" ON sml_stores;
CREATE POLICY "Allow POS and Portal access sml_stores" ON sml_stores FOR ALL USING (true);
GRANT ALL ON TABLE sml_stores TO anon, authenticated, service_role;

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
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_users" ON cloud_users;
CREATE POLICY "Allow POS and Portal access cloud_users" ON cloud_users FOR ALL USING (true);
GRANT ALL ON TABLE cloud_users TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS cloud_categories (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cloud_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_categories" ON cloud_categories;
CREATE POLICY "Allow POS and Portal access cloud_categories" ON cloud_categories FOR ALL USING (true);
GRANT ALL ON TABLE cloud_categories TO anon, authenticated, service_role;

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
ALTER TABLE cloud_suppliers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_suppliers" ON cloud_suppliers;
CREATE POLICY "Allow POS and Portal access cloud_suppliers" ON cloud_suppliers FOR ALL USING (true);
GRANT ALL ON TABLE cloud_suppliers TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS cloud_customers (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    phone TEXT,
    email TEXT,
    address TEXT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cloud_customers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_customers" ON cloud_customers;
CREATE POLICY "Allow POS and Portal access cloud_customers" ON cloud_customers FOR ALL USING (true);
GRANT ALL ON TABLE cloud_customers TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS cloud_products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    generic_name TEXT,
    sku TEXT NOT NULL,
    category_name TEXT NOT NULL DEFAULT 'General',
    category TEXT NOT NULL DEFAULT 'General',
    price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    stock_quantity INT NOT NULL DEFAULT 0,
    current_stock INT NOT NULL DEFAULT 0,
    min_stock_level INT NOT NULL DEFAULT 10,
    unit TEXT DEFAULT 'CARTON',
    requires_cold_storage BOOLEAN DEFAULT true,
    version INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'sml_accra_main';
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS generic_name TEXT;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS sku TEXT;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT 'General';
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS price NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS stock_quantity INT NOT NULL DEFAULT 0;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS current_stock INT NOT NULL DEFAULT 0;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS min_stock_level INT NOT NULL DEFAULT 10;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS unit TEXT DEFAULT 'CARTON';
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS requires_cold_storage BOOLEAN DEFAULT true;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cloud_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cloud_products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_products" ON cloud_products;
CREATE POLICY "Allow POS and Portal access cloud_products" ON cloud_products FOR ALL USING (true);
GRANT ALL ON TABLE cloud_products TO anon, authenticated, service_role;

CREATE TABLE IF NOT EXISTS cloud_batches (
    id TEXT PRIMARY KEY,
    product_id TEXT NOT NULL REFERENCES cloud_products(id) ON DELETE CASCADE,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main',
    batch_number TEXT NOT NULL DEFAULT 'BATCH-001',
    expiry_date TIMESTAMPTZ NOT NULL,
    quantity INT NOT NULL DEFAULT 0,
    cost_price NUMERIC(12, 2) DEFAULT 0.00,
    selling_price NUMERIC(12, 2) DEFAULT 0.00,
    status TEXT DEFAULT 'ACTIVE',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS store_id TEXT NOT NULL DEFAULT 'sml_accra_main';
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS batch_number TEXT DEFAULT 'BATCH-001';
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS expiry_date TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '1 year');
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 0;
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS cost_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS selling_price NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE cloud_batches ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

ALTER TABLE cloud_batches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_batches" ON cloud_batches;
CREATE POLICY "Allow POS and Portal access cloud_batches" ON cloud_batches FOR ALL USING (true);
GRANT ALL ON TABLE cloud_batches TO anon, authenticated, service_role;

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
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS operator TEXT DEFAULT 'System';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS details TEXT;

ALTER TABLE cloud_audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow POS and Portal access cloud_audit_logs" ON cloud_audit_logs;
CREATE POLICY "Allow POS and Portal access cloud_audit_logs" ON cloud_audit_logs FOR ALL USING (true);
GRANT ALL ON TABLE cloud_audit_logs TO anon, authenticated, service_role;


-- 1. STORE DEPOT
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

-- 2. USERS (Bcrypt-hashed passwords)
-- admin: admin1234 (PIN 1111)
-- manager: manager123 (PIN 2222)
-- cashier: cashier123 (PIN 1234)
INSERT INTO cloud_users (id, store_id, username, password_hash, pin, role, created_at, updated_at)
VALUES
    ('usr_admin_root', 'sml_accra_main', 'admin', '$2a$10$WfvX8Rt.Fmy9kdPSboP1OO5tYpCFbbEgYW0HQyXqpMvOWbGogKrbi', '1111', 'ADMIN', NOW(), NOW()),
    ('usr_manager_01', 'sml_accra_main', 'manager', '$2a$10$qB1WGB.dOX9jaHBoCyTZGOXDcn0GDFX4Z7sEOfo8hOcSQqIl3EaRi', '2222', 'MANAGER', NOW(), NOW()),
    ('usr_cashier_01', 'sml_accra_main', 'cashier', '$2a$10$OdNZTYSWEahYuN6f3bAf6eA/2.RRw4zfVTUxCA/oNH5Db6sGh1x1W', '1234', 'CASHIER', NOW(), NOW())
ON CONFLICT (username) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    pin = EXCLUDED.pin,
    role = EXCLUDED.role,
    updated_at = NOW();

-- 3. CATEGORIES
INSERT INTO cloud_categories (id, store_id, name, description, created_at, updated_at)
VALUES
    ('79c12559-883a-41c0-aa7e-48d98ac54237', 'sml_accra_main', 'Poultry', 'Frozen chicken, wings, turkey cuts and parts', NOW(), NOW()),
    ('449dec85-0565-4040-a301-2788e4b421f2', 'sml_accra_main', 'Fish & Seafood', 'Tilapia, mackerel, catfish, prawns, squid rings', NOW(), NOW()),
    ('8486b92d-d282-4193-b7b3-bb0b9df3d928', 'sml_accra_main', 'Beef & Mutton', 'Fresh frozen beef cuts, chuck, oxtail, mutton leg', NOW(), NOW()),
    ('1cccec0e-8664-41b6-a82b-ded4592e9bdc', 'sml_accra_main', 'Pork Products', 'Pork ribs, chops, pork belly cuts', NOW(), NOW()),
    ('69e4fb2c-f1d6-4620-9346-dc732c4e6567', 'sml_accra_main', 'Processed Meat', 'Sausages, frankfurters, smoked bacon strips', NOW(), NOW()),
    ('8fead2c2-e239-4091-9ce0-f853217a5b82', 'sml_accra_main', 'Frozen Vegetables', 'Mixed vegetables, sweet peas, green beans', NOW(), NOW()),
    ('60441f27-2fd7-40f6-95c7-e00ba00d06f6', 'sml_accra_main', 'Dairy & Eggs', 'Butter, margarine, eggs and cold dairy goods', NOW(), NOW())
ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    updated_at = NOW();

-- 4. SUPPLIERS
INSERT INTO cloud_suppliers (id, store_id, name, contact, email, address, created_at, updated_at)
VALUES
    ('sup-1', 'sml_accra_main', 'Accra Frozen Foods Ltd', '+233 30 222 4455', 'sales@accrafrozen.com.gh', 'Industrial Area, Accra, Ghana', NOW(), NOW()),
    ('sup-2', 'sml_accra_main', 'Gold Coast Meat Distributors', '+233 24 500 7890', 'orders@gcmeat.com.gh', 'Tema Port Area, Tema, Ghana', NOW(), NOW()),
    ('sup-3', 'sml_accra_main', 'West Africa Poultry Hub', '+233 54 112 3399', 'info@wapoultry.com.gh', 'Spintex Road, Accra, Ghana', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    contact = EXCLUDED.contact,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    updated_at = NOW();

-- 5. CUSTOMERS
INSERT INTO cloud_customers (id, store_id, name, phone, email, address, balance, created_at, updated_at)
VALUES
    ('cust-1', 'sml_accra_main', 'Kofi Mensah', '0244112233', 'kofi.mensah@gmail.com', 'Accra Central', 0.00, NOW(), NOW()),
    ('cust-2', 'sml_accra_main', 'Ama Asante', '0554321098', 'ama.asante@yahoo.com', 'Osu, Accra', 0.00, NOW(), NOW()),
    ('cust-3', 'sml_accra_main', 'Kwame Boateng', '0201987654', 'kwame.b@outlook.com', 'East Legon, Accra', 0.00, NOW(), NOW()),
    ('cust-4', 'sml_accra_main', 'Sofiyat Yusuf', '+447999007775', 'sorphygold@yahoo.com', 'London / Accra', 0.00, NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    phone = EXCLUDED.phone,
    email = EXCLUDED.email,
    address = EXCLUDED.address,
    balance = EXCLUDED.balance,
    updated_at = NOW();

-- 6. PRODUCTS CATALOG (Populates both category_name/category and stock_quantity/current_stock)
INSERT INTO cloud_products (
    id, store_id, name, generic_name, sku, category_name, category, price, cost, stock_quantity, current_stock, min_stock_level, updated_at
)
VALUES
    ('177ba3de-f77e-4468-b497-c1775f620726', 'sml_accra_main', 'Whole Chicken (Frozen)', 'Broiler Chicken', 'SML-PTR-001', 'Poultry', 'Poultry', 85.00, 58.00, 80, 80, 20, NOW()),
    ('93d25f31-d129-449a-adb2-e12ee1ec189a', 'sml_accra_main', 'Chicken Legs (5kg Pack)', 'Chicken Drumsticks', 'SML-PTR-002', 'Poultry', 'Poultry', 120.00, 82.00, 60, 60, 15, NOW()),
    ('b8974930-fb08-4822-bf29-860814bb1311', 'sml_accra_main', 'Chicken Breast (Boneless)', 'Breast Fillet', 'SML-PTR-003', 'Poultry', 'Poultry', 145.00, 98.00, 50, 50, 10, NOW()),
    ('ad6d61e1-7d0f-4a77-b46a-2eb6aa818eef', 'sml_accra_main', 'Turkey (Whole Frozen)', 'Turkey Bird', 'SML-PTR-004', 'Poultry', 'Poultry', 320.00, 220.00, 20, 20, 5, NOW()),
    ('622fcf37-ee76-42a0-8350-7e0ea6564981', 'sml_accra_main', 'Chicken wings (1kg)', 'Chicken Foods', 'SML-CHK-002', 'Poultry', 'Poultry', 100.00, 68.00, 0, 0, 12, NOW()),
    ('dda03a1c-38de-4cb3-a245-deb70da1bade', 'sml_accra_main', 'Hard chicken', 'Spent Layer Chicken', '9781949759228', 'Poultry', 'Poultry', 180.00, 220.00, 119, 119, 10, NOW()),
    ('14c3a5a7-d13b-4bc2-8978-fc817b8fb280', 'sml_accra_main', 'Tilapia Fish (Fresh Frozen)', 'Oreochromis niloticus', 'SML-FSH-001', 'Fish & Seafood', 'Fish & Seafood', 95.00, 62.00, 100, 100, 10, NOW()),
    ('b566226c-2ee1-4cfd-95bc-5e67e2145379', 'sml_accra_main', 'Mackerel (Frozen, 1kg)', 'Scomber scombrus', 'SML-FSH-002', 'Fish & Seafood', 'Fish & Seafood', 55.00, 36.00, 120, 120, 30, NOW()),
    ('267f0f2a-0efd-4987-b559-c0a85e13dae7', 'sml_accra_main', 'Tiger Prawns (500g)', 'Penaeus monodon', 'SML-FSH-003', 'Fish & Seafood', 'Fish & Seafood', 180.00, 125.00, 40, 40, 10, NOW()),
    ('ebd392bb-f7be-4fb0-8c85-c281e6ab31a4', 'sml_accra_main', 'Squid Rings (Frozen)', 'Loligo vulgaris', 'SML-FSH-004', 'Fish & Seafood', 'Fish & Seafood', 140.00, 95.00, 35, 35, 10, NOW()),
    ('2341b5e9-f531-4cfc-9240-824e1b4c77dc', 'sml_accra_main', 'Catfish (Frozen, 1kg)', 'Fresh Frozen Catfish', 'SML-FSH-005', 'Fish & Seafood', 'Fish & Seafood', 80.00, 50.00, 8, 8, 10, NOW()),
    ('5a846dbf-77ae-49c9-b28f-235c7ff4a521', 'sml_accra_main', 'Beef Chuck (1kg)', 'Bovine Chuck Cut', 'SML-BEF-001', 'Beef & Mutton', 'Beef & Mutton', 130.00, 90.00, 125, 125, 20, NOW()),
    ('498007e5-5268-4fa6-bc3d-451bbc84a896', 'sml_accra_main', 'Minced Beef (500g)', 'Ground Beef', 'SML-BEF-002', 'Beef & Mutton', 'Beef & Mutton', 70.00, 48.00, 100, 100, 25, NOW()),
    ('6dfe84fe-e823-429e-8b11-da78a7853dbb', 'sml_accra_main', 'Mutton Leg (Frozen)', 'Ovine Leg Cut', 'SML-MTN-001', 'Beef & Mutton', 'Beef & Mutton', 200.00, 140.00, 30, 30, 10, NOW()),
    ('5e588968-7857-4bce-b7d0-da8d4ef51db1', 'sml_accra_main', 'Oxtail (Frozen, 1kg)', 'Bovine Tail', 'SML-BEF-003', 'Beef & Mutton', 'Beef & Mutton', 155.00, 105.00, 45, 45, 10, NOW()),
    ('43f85ee7-81f9-4642-bdac-c013b117be0c', 'sml_accra_main', 'Pork Ribs (Frozen)', 'Porcine Ribs', 'SML-PRK-001', 'Pork Products', 'Pork Products', 110.00, 75.00, 55, 55, 15, NOW()),
    ('bb2b5a19-f296-4591-9c7e-3f60ea8b15f6', 'sml_accra_main', 'Pork Belly (1kg)', 'Porcine Belly Cut', 'SML-PRK-002', 'Pork Products', 'Pork Products', 100.00, 68.00, 48, 48, 15, NOW()),
    ('4601891b-dada-46b6-b998-f001d8a821cd', 'sml_accra_main', 'Beef Sausages (500g)', 'Processed Beef Sausage', 'SML-PRC-001', 'Processed Meat', 'Processed Meat', 65.00, 42.00, 90, 90, 20, NOW()),
    ('e8b9d351-a759-424c-80a5-e634239fe88e', 'sml_accra_main', 'Chicken Hot Dogs (300g)', 'Processed Chicken Frankfurter', 'SML-PRC-002', 'Processed Meat', 'Processed Meat', 45.00, 28.00, 110, 110, 20, NOW()),
    ('ac38a3d6-bda2-4ba6-8b72-b042b9bfc0be', 'sml_accra_main', 'Smoked Bacon Strips', 'Cured Pork Bacon', 'SML-PRC-003', 'Processed Meat', 'Processed Meat', 90.00, 60.00, 70, 70, 15, NOW()),
    ('f3d588b7-a183-4b06-b47b-3559312b9f32', 'sml_accra_main', 'Mixed Vegetables (1kg)', 'Frozen Mixed Veg', 'SML-VEG-001', 'Frozen Vegetables', 'Frozen Vegetables', 30.00, 18.00, 150, 150, 30, NOW()),
    ('24cdb4d6-5a1f-43c0-a148-a2962f72dd00', 'sml_accra_main', 'Green Beans (Frozen)', 'Phaseolus vulgaris', 'SML-VEG-002', 'Frozen Vegetables', 'Frozen Vegetables', 25.00, 14.00, 120, 120, 25, NOW()),
    ('461960d9-0918-407d-b240-942a69f951dd', 'sml_accra_main', 'Unsalted Butter (250g)', 'Dairy Butter', 'SML-DRY-001', 'Dairy & Eggs', 'Dairy & Eggs', 40.00, 26.00, 80, 80, 20, NOW()),
    ('81975afb-eedb-4014-aced-5c4bfaeb8f97', 'sml_accra_main', 'Crate of Eggs (30 pcs)', 'Chicken Eggs', 'SML-DRY-002', 'Dairy & Eggs', 'Dairy & Eggs', 55.00, 38.00, 58, 58, 15, NOW())
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    generic_name = EXCLUDED.generic_name,
    sku = EXCLUDED.sku,
    category_name = EXCLUDED.category_name,
    category = EXCLUDED.category,
    price = EXCLUDED.price,
    cost = EXCLUDED.cost,
    stock_quantity = EXCLUDED.stock_quantity,
    current_stock = EXCLUDED.current_stock,
    min_stock_level = EXCLUDED.min_stock_level,
    updated_at = NOW();

-- 7. BATCHES (Freezer lots)
INSERT INTO cloud_batches (
    id, product_id, store_id, batch_number, expiry_date, quantity, status, updated_at
)
VALUES
    ('c7409681-fc80-402e-b143-dbf647b5813d', '177ba3de-f77e-4468-b497-c1775f620726', 'sml_accra_main', 'CHK-2024-001', '2027-09-30T19:58:46.855Z', 80, 'ACTIVE', NOW()),
    ('8e68b2a4-4bd9-4863-8230-cff626383e39', '93d25f31-d129-449a-adb2-e12ee1ec189a', 'sml_accra_main', 'CHL-2024-001', '2027-09-30T19:58:46.855Z', 60, 'ACTIVE', NOW()),
    ('ce211b1d-af79-499e-affa-334a0741b095', 'b8974930-fb08-4822-bf29-860814bb1311', 'sml_accra_main', 'CHB-2024-001', '2027-09-30T19:58:46.855Z', 50, 'ACTIVE', NOW()),
    ('62cf30bc-e7f4-41d5-806c-ada3f76a8082', 'ad6d61e1-7d0f-4a77-b46a-2eb6aa818eef', 'sml_accra_main', 'TKY-2024-001', '2027-09-30T19:58:46.855Z', 20, 'ACTIVE', NOW()),
    ('bf774a3a-492d-46d0-b6af-ebb96de2df9d', 'dda03a1c-38de-4cb3-a245-deb70da1bade', 'sml_accra_main', 'PLT-01', '2027-01-15T00:00:00.000Z', 119, 'ACTIVE', NOW()),
    ('856af936-cc17-4992-9049-860151ff5056', '14c3a5a7-d13b-4bc2-8978-fc817b8fb280', 'sml_accra_main', 'TLP-2024-001', '2026-10-20T19:58:46.855Z', 10, 'ACTIVE', NOW()),
    ('38094343-13dc-4365-b521-2d04b2c4df49', '14c3a5a7-d13b-4bc2-8978-fc817b8fb280', 'sml_accra_main', 'TLP-2024-002', '2027-09-30T19:58:46.855Z', 90, 'ACTIVE', NOW()),
    ('ed23b3e5-6dcc-4183-a647-12f61ccdf43d', 'b566226c-2ee1-4cfd-95bc-5e67e2145379', 'sml_accra_main', 'MCK-2024-001', '2027-09-30T19:58:46.855Z', 120, 'ACTIVE', NOW()),
    ('03638c3e-4ef2-4131-91a6-ff4b2a58fca2', '267f0f2a-0efd-4987-b559-c0a85e13dae7', 'sml_accra_main', 'PRW-2024-001', '2027-09-30T19:58:46.855Z', 40, 'ACTIVE', NOW()),
    ('560485a1-2e22-4729-adb0-5414d117dc6a', 'ebd392bb-f7be-4fb0-8c85-c281e6ab31a4', 'sml_accra_main', 'SQD-2024-001', '2027-09-30T19:58:46.855Z', 35, 'ACTIVE', NOW()),
    ('ddd7b772-e061-4bd4-b28f-fa485d5b73e0', '2341b5e9-f531-4cfc-9240-824e1b4c77dc', 'sml_accra_main', 'GAT-587575', '2028-06-22T00:00:00.000Z', 8, 'ACTIVE', NOW()),
    ('7b37eb47-38a4-41b2-895d-d0cc92db1516', '5a846dbf-77ae-49c9-b28f-235c7ff4a521', 'sml_accra_main', 'BFC-2024-001', '2027-09-30T19:58:46.855Z', 75, 'ACTIVE', NOW()),
    ('b4830557-4191-4064-8777-45409966a4b4', '5a846dbf-77ae-49c9-b28f-235c7ff4a521', 'sml_accra_main', '9781949759228', '2026-12-05T00:00:00.000Z', 50, 'ACTIVE', NOW()),
    ('a31a0ea5-4351-4fbc-8d72-d4ec17113579', '498007e5-5268-4fa6-bc3d-451bbc84a896', 'sml_accra_main', 'BFM-2024-001', '2027-09-30T19:58:46.855Z', 100, 'ACTIVE', NOW()),
    ('8c8221db-a7f1-4228-bf5f-a2275890d97a', '6dfe84fe-e823-429e-8b11-da78a7853dbb', 'sml_accra_main', 'MTN-2024-001', '2027-09-30T19:58:46.855Z', 30, 'ACTIVE', NOW()),
    ('abc00652-9bff-4718-a763-2bd6b2c1846a', '5e588968-7857-4bce-b7d0-da8d4ef51db1', 'sml_accra_main', 'OXT-2024-002', '2027-09-30T19:58:46.855Z', 45, 'ACTIVE', NOW()),
    ('a2bf50c0-8fa1-43d4-86e1-416770808109', '43f85ee7-81f9-4642-bdac-c013b117be0c', 'sml_accra_main', 'PRK-2024-001', '2027-09-30T19:58:46.855Z', 55, 'ACTIVE', NOW()),
    ('00cae155-904b-4b5e-a267-b7bd086e0c7b', 'bb2b5a19-f296-4591-9c7e-3f60ea8b15f6', 'sml_accra_main', 'PKB-2024-001', '2027-09-30T19:58:46.855Z', 48, 'ACTIVE', NOW()),
    ('f3c51857-155f-4e63-af5f-1868e02cdb08', '4601891b-dada-46b6-b998-f001d8a821cd', 'sml_accra_main', 'BSG-2024-001', '2028-09-30T19:58:46.855Z', 90, 'ACTIVE', NOW()),
    ('2cd6900e-9cc8-4bb3-9449-fceecad6fc7b', 'e8b9d351-a759-424c-80a5-e634239fe88e', 'sml_accra_main', 'CHD-2024-001', '2028-09-30T19:58:46.855Z', 110, 'ACTIVE', NOW()),
    ('cf791471-0a6f-45c6-96bd-ef75cb39de20', 'ac38a3d6-bda2-4ba6-8b72-b042b9bfc0be', 'sml_accra_main', 'BCN-2024-001', '2028-09-30T19:58:46.855Z', 70, 'ACTIVE', NOW()),
    ('f4e69cfc-6116-4c72-802c-5f1382d50334', 'f3d588b7-a183-4b06-b47b-3559312b9f32', 'sml_accra_main', 'MVG-2024-001', '2028-09-30T19:58:46.855Z', 150, 'ACTIVE', NOW()),
    ('5e7598e2-2d6b-40e9-b73a-cb9cf8fdba27', '24cdb4d6-5a1f-43c0-a148-a2962f72dd00', 'sml_accra_main', 'GBN-2024-001', '2028-09-30T19:58:46.855Z', 120, 'ACTIVE', NOW()),
    ('24c3b95b-b449-4c50-8515-b2574e1d7567', '461960d9-0918-407d-b240-942a69f951dd', 'sml_accra_main', 'BTR-2024-001', '2027-09-30T19:58:46.855Z', 80, 'ACTIVE', NOW()),
    ('913ad1d2-4029-44a7-a279-e66ea1ab6d10', '81975afb-eedb-4014-aced-5c4bfaeb8f97', 'sml_accra_main', 'EGG-2024-001', '2026-10-20T19:58:46.855Z', 8, 'ACTIVE', NOW()),
    ('f90a6d36-a8bc-4280-ab95-729356c3b4e4', '81975afb-eedb-4014-aced-5c4bfaeb8f97', 'sml_accra_main', 'EGG-2024-002', '2027-09-30T19:58:46.855Z', 50, 'ACTIVE', NOW())
ON CONFLICT (id) DO UPDATE SET
    product_id = EXCLUDED.product_id,
    store_id = EXCLUDED.store_id,
    batch_number = EXCLUDED.batch_number,
    expiry_date = EXCLUDED.expiry_date,
    quantity = EXCLUDED.quantity,
    status = EXCLUDED.status,
    updated_at = NOW();

-- 8. AUDIT LOG INITIALIZATION
INSERT INTO cloud_audit_logs (id, store_id, action, category, entity_name, entity_id, details, operator, user_name, role, severity, created_at)
VALUES (
    'aud_demo_seed_' || extract(epoch from now())::text,
    'sml_accra_main',
    'SEED_DATA',
    'SYSTEM',
    'SYSTEM',
    'sml_accra_main',
    'Demo cold store dataset seeded successfully (categories, products, batches, suppliers, customers, and users).',
    'System',
    'System',
    'ADMIN',
    'INFO',
    NOW()
);
