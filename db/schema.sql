-- Orlando Eagles RAG bot — analytics (PostgreSQL)
-- Run: npm run db:migrate

CREATE TABLE IF NOT EXISTS analytics_events (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_type  TEXT NOT NULL,
  locale      TEXT,
  client_id   TEXT,
  page_path   TEXT,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_created_at ON analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events (event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_locale ON analytics_events (locale);

COMMENT ON TABLE analytics_events IS 'Language switches, chat opens, messages, rate limits (self-hosted Postgres)';
