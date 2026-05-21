-- Phase 2: async media, email threads, realtime

-- Add file metadata columns to assets
ALTER TABLE assets
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint,
  ADD COLUMN IF NOT EXISTS duration_secs numeric(8, 2);

-- Add job tracking to briefs
ALTER TABLE briefs
  ADD COLUMN IF NOT EXISTS jobs_total int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS jobs_done int NOT NULL DEFAULT 0;

-- Email threads (one per brief)
CREATE TABLE IF NOT EXISTS threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brief_id uuid NOT NULL REFERENCES briefs(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  subject text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS threads_brief_id_idx ON threads(brief_id);

-- Messages within a thread
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES threads(id) ON DELETE CASCADE,
  sender text NOT NULL, -- 'agent' | 'client' | email address
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_thread_id_idx ON messages(thread_id);

-- RLS
ALTER TABLE threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "threads: workspace member read" ON threads
  FOR SELECT USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "threads: workspace member insert" ON threads
  FOR INSERT WITH CHECK (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

CREATE POLICY "messages: thread member read" ON messages
  FOR SELECT USING (
    thread_id IN (
      SELECT t.id FROM threads t
      JOIN workspaces w ON w.id = t.workspace_id
      WHERE w.owner_id = auth.uid()
    )
  );

CREATE POLICY "messages: thread member insert" ON messages
  FOR INSERT WITH CHECK (
    thread_id IN (
      SELECT t.id FROM threads t
      JOIN workspaces w ON w.id = t.workspace_id
      WHERE w.owner_id = auth.uid()
    )
  );

-- Realtime publications
BEGIN;
  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'briefs'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE briefs;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'assets'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE assets;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'threads'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE threads;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND tablename = 'messages'
    ) THEN
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    END IF;
  END $$;
COMMIT;
