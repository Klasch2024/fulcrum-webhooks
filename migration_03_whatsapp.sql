-- ============================================================
-- MIGRATION 03: WhatsApp support
-- Run in Supabase SQL Editor before deploying whatsapp changes.
-- ============================================================

-- Maps Wasender's msgId back to outreach_sends rows
-- Created at send time, used by all subsequent webhook events
CREATE TABLE IF NOT EXISTS wasender_message_map (
  wasender_msg_id      BIGINT       PRIMARY KEY,
  wasender_whatsapp_id VARCHAR(255),             -- WhatsApp native key.id (filled by message.sent webhook)
  message_id           UUID         NOT NULL REFERENCES outreach_sends(message_id) ON DELETE CASCADE,
  prospect_phone       VARCHAR(50)  NOT NULL,
  created_at           TIMESTAMPTZ  DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wasender_map_message_id
  ON wasender_message_map (message_id);

CREATE INDEX IF NOT EXISTS idx_wasender_map_prospect_phone
  ON wasender_message_map (prospect_phone);

ALTER TABLE wasender_message_map DISABLE ROW LEVEL SECURITY;
