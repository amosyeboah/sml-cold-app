-- ==============================================================================
-- DEDICATED RELATIONAL TABLE: cloud_user_permissions
-- Prevents data inconsistency through:
--   1. Strict Foreign Key constraints referencing cloud_users(id) with ON DELETE CASCADE
--   2. Strict Foreign Key constraints referencing sml_stores(id) with ON DELETE CASCADE
--   3. Composite UNIQUE constraint (user_id, permission) preventing duplicate/inconsistent assignments
--   4. RLS policies allowing authenticated & anon client synchronization
--   5. Realtime publication subscription for instant multi-device propagation
-- ==============================================================================

CREATE TABLE IF NOT EXISTS cloud_user_permissions (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    store_id TEXT NOT NULL DEFAULT 'sml_accra_main' REFERENCES sml_stores(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES cloud_users(id) ON DELETE CASCADE,
    permission TEXT NOT NULL,
    granted_by TEXT DEFAULT 'admin',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT uq_cloud_user_permission UNIQUE (user_id, permission)
);

-- Performance Indexes
CREATE INDEX IF NOT EXISTS idx_cloud_user_permissions_user_id ON cloud_user_permissions(user_id);
CREATE INDEX IF NOT EXISTS idx_cloud_user_permissions_store_id ON cloud_user_permissions(store_id);
CREATE INDEX IF NOT EXISTS idx_cloud_user_permissions_perm ON cloud_user_permissions(permission);

-- Enable Row Level Security
ALTER TABLE cloud_user_permissions ENABLE ROW LEVEL SECURITY;

-- Access Policies (matching other cloud_* tables for multi-device sync)
DROP POLICY IF EXISTS "Allow public access to cloud_user_permissions" ON cloud_user_permissions;
CREATE POLICY "Allow public access to cloud_user_permissions" ON cloud_user_permissions FOR ALL USING (true);

-- Permissions Grants
GRANT ALL ON TABLE cloud_user_permissions TO anon, authenticated, service_role;

-- Enable Realtime Replication
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = 'cloud_user_permissions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE cloud_user_permissions;
    END IF;
END $$;
