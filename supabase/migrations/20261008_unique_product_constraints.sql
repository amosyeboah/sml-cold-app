-- ==============================================================================
-- SML LEGACY LIMITED - STRICT PRODUCT UNIQUENESS CONSTRAINTS
-- Enforces store-level unique product names and SKUs (case-insensitive)
-- Prevents duplicate inventory cards and ensures single-catalog lot tracking.
-- ==============================================================================

-- 1. Unique index on product name per store (case-insensitive, trimmed)
-- Excludes historical deleted tombstone items
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_products_store_name 
ON cloud_products (store_id, LOWER(TRIM(name))) 
WHERE name != 'Historical Item (Deleted)';

-- 2. Unique index on product SKU/barcode per store (case-insensitive, trimmed)
-- Excludes null or empty SKUs
CREATE UNIQUE INDEX IF NOT EXISTS uq_cloud_products_store_sku 
ON cloud_products (store_id, LOWER(TRIM(sku))) 
WHERE sku IS NOT NULL AND TRIM(sku) != '';
