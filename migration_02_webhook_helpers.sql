-- ============================================================
-- MIGRATION 02: Webhook helper columns
-- Run this in Supabase SQL Editor before starting the server.
-- ============================================================

-- Cross-reference columns so webhook events can match rows
ALTER TABLE outreach_sends
  ADD COLUMN IF NOT EXISTS instantly_email_id VARCHAR(255),
  ADD COLUMN IF NOT EXISTS prospect_email     VARCHAR(255),
  ADD COLUMN IF NOT EXISTS sender_email       VARCHAR(255);

-- Fast lookup: match subsequent events (opened, replied, clicked)
-- back to the original send row
CREATE UNIQUE INDEX IF NOT EXISTS idx_sends_instantly_email_id
  ON outreach_sends (instantly_email_id)
  WHERE instantly_email_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sends_campaign_email_step
  ON outreach_sends (campaign_id, prospect_email, sequence_step_number);

CREATE INDEX IF NOT EXISTS idx_sends_prospect_email
  ON outreach_sends (prospect_email);

-- Minimal prospects lookup table
-- Maps lead_email (from Instantly) → prospect_id (UUID used in outreach_sends)
CREATE TABLE IF NOT EXISTS prospects (
  prospect_id UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  email       VARCHAR(255) NOT NULL UNIQUE,
  created_at  TIMESTAMPTZ  DEFAULT NOW()
);

ALTER TABLE prospects ENABLE ROW LEVEL SECURITY;
