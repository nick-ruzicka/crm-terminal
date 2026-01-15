-- Add soft delete support to chat_sessions
ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Index for efficient filtering of non-deleted sessions
CREATE INDEX IF NOT EXISTS idx_chat_sessions_deleted_at
ON chat_sessions(deleted_at)
WHERE deleted_at IS NULL;
