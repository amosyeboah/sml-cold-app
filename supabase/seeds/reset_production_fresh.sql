-- ==============================================================================
-- SML LEGACY LIMITED - FRESH PRODUCTION RESET SCRIPT
-- Run this in the Supabase SQL Editor when ready to deploy for real store operations.
-- This wipes all test/demo data and leaves only the store depot & initial Admin account.
-- ==============================================================================

-- 1. Wipe all transactional records
TRUNCATE cloud_sale_items, cloud_sale_payments, cloud_sales CASCADE;
TRUNCATE cloud_purchase_items, cloud_purchases CASCADE;
TRUNCATE cloud_stock_movements CASCADE;
TRUNCATE cloud_batches CASCADE;
TRUNCATE cloud_products CASCADE;
TRUNCATE cloud_categories CASCADE;
TRUNCATE cloud_customers CASCADE;
TRUNCATE cloud_suppliers CASCADE;
TRUNCATE cloud_audit_logs CASCADE;
TRUNCATE cloud_sync_events, cloud_sync_sessions CASCADE;

-- 2. Verify Store Record exists
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

-- 3. Reset Users to clean initial Admin account
-- Password is 'admin1234', PIN is '1111'
DELETE FROM cloud_users;

INSERT INTO cloud_users (id, store_id, username, password_hash, pin, role, created_at, updated_at)
VALUES (
    'usr_admin_root',
    'sml_accra_main',
    'admin',
    '$2a$10$WfvX8Rt.Fmy9kdPSboP1OO5tYpCFbbEgYW0HQyXqpMvOWbGogKrbi',
    '9842',
    'ADMIN',
    NOW(),
    NOW()
);

-- 4. Log the production initialization
INSERT INTO cloud_audit_logs (id, store_id, action, category, details, operator, role, severity, created_at)
VALUES (
    'aud_prod_init_' || extract(epoch from now())::text,
    'sml_accra_main',
    'SYSTEM_INIT',
    'SYSTEM',
    'Cold store production database initialized cleanly. Ready for live inventory.',
    'System',
    'ADMIN',
    'INFO',
    NOW()
);
