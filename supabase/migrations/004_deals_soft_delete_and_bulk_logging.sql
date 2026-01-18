-- Soft delete for deals + enhanced bulk action logging
-- Migration: 004_deals_soft_delete_and_bulk_logging.sql

-- Add soft delete column to deals table
ALTER TABLE deals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted deals
CREATE INDEX IF NOT EXISTS idx_deals_deleted_at ON deals(deleted_at) WHERE deleted_at IS NULL;

-- Ensure activity_log has metadata column (should already exist, but be safe)
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add index on activity_log type for faster queries
CREATE INDEX IF NOT EXISTS idx_activity_log_type ON activity_log(type);
