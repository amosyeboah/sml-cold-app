-- ==============================================================================
-- SML LEGACY LIMITED - CLOUD SYNC SESSIONS TABLE MIGRATION
-- Ensures cloud_sync_sessions exists with all required telemetry columns
-- ==============================================================================

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

-- Reconcile cloud_audit_logs columns for backwards & forwards compatibility
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS entity_id TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS operator TEXT DEFAULT 'System';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'ADMIN';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS severity TEXT DEFAULT 'INFO';
ALTER TABLE cloud_audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
