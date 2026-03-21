-- ================================================================
-- Migration 001: Usage Tracking & Billing Lock
-- CockroachDB compatible — no PL/pgSQL, plain SQL only.
-- ================================================================


-- ── 1. Plans table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_plans (
  id             SERIAL        PRIMARY KEY,
  plan_name      VARCHAR(50)   UNIQUE NOT NULL,
  image_limit    INT           NOT NULL DEFAULT 10,
  video_limit    INT           NOT NULL DEFAULT 5,
  api_call_limit INT           NOT NULL DEFAULT 100,
  document_limit INT           NOT NULL DEFAULT 20,
  reset_period   VARCHAR(20)   NOT NULL DEFAULT 'daily',
  created_at     TIMESTAMPTZ   DEFAULT NOW()
);

INSERT INTO usage_plans
  (plan_name, image_limit, video_limit, api_call_limit, document_limit, reset_period)
VALUES
  ('free',        10,    5,    100,   20,   'daily'),
  ('pro',         100,   50,   1000,  200,  'daily'),
  ('enterprise',  9999,  9999, 99999, 9999, 'monthly')
ON CONFLICT (plan_name) DO NOTHING;


-- ── 2. Per-user counters ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_usage (
  id             SERIAL        PRIMARY KEY,
  user_id        UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  plan_name      VARCHAR(50)   NOT NULL DEFAULT 'free',
  images_used    INT           NOT NULL DEFAULT 0,
  videos_used    INT           NOT NULL DEFAULT 0,
  api_calls_used INT           NOT NULL DEFAULT 0,
  documents_used INT           NOT NULL DEFAULT 0,
  is_locked      BOOLEAN       NOT NULL DEFAULT FALSE,
  lock_reason    TEXT,
  period_start   TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  last_reset_at  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_user_usage UNIQUE (user_id)
);

ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS is_locked   BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE user_usage ADD COLUMN IF NOT EXISTS lock_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_user_usage_user_id ON user_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_user_usage_period  ON user_usage (period_start);


-- ── 3. Audit event log ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS usage_events (
  id            BIGSERIAL     PRIMARY KEY,
  user_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id    UUID,
  resource_type VARCHAR(30)   NOT NULL,
  quantity      INT           NOT NULL DEFAULT 1,
  metadata      JSONB         DEFAULT '{}',
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_usage_events_user_id    ON usage_events (user_id);
CREATE INDEX IF NOT EXISTS idx_usage_events_created_at ON usage_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_usage_events_type       ON usage_events (resource_type);