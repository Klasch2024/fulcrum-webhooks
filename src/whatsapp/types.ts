export type WasenderEventType =
  | 'message.sent'
  | 'messages.update'
  | 'messages.received'
  | 'messages-personal.received'
  | 'messages-group.received'
  | 'messages.upsert'
  | 'messages.reaction'
  | 'messages.delete'
  | 'session.status'
  | 'poll.results'
  | 'call';

export interface WasenderMessageKey {
  id:             string;
  fromMe:         boolean;
  remoteJid:      string;
  senderPn?:      string;
  cleanedSenderPn?: string;
}

// message.sent
export interface WasenderMessageSentPayload {
  event:     'message.sent';
  timestamp: number;
  data: {
    key:     WasenderMessageKey;
    message: Record<string, any>;
    success: boolean;
  };
}

// messages.update — delivery/read status change
export interface WasenderMessagesUpdatePayload {
  event:     'messages.update';
  sessionId: string;
  timestamp: number;
  data: {
    update: { status: number };  // 0=ERROR 1=PENDING 2=SENT 3=DELIVERED 4=READ 5=PLAYED
    key:    WasenderMessageKey;
  };
}

// messages-personal.received — incoming 1-on-1 reply
export interface WasenderMessageReceivedPayload {
  event:     'messages.received' | 'messages-personal.received';
  timestamp: number;
  data: {
    messages: {
      key:         WasenderMessageKey;
      messageBody: string;
      message:     Record<string, any>;
    };
  };
}

export type WasenderWebhookPayload =
  | WasenderMessageSentPayload
  | WasenderMessagesUpdatePayload
  | WasenderMessageReceivedPayload;

// ── Send request body (from your dashboard → our proxy endpoint) ────────────
export interface WhatsAppSendRequest {
  to:                   string;   // E.164 phone number
  text?:                string;
  imageUrl?:            string;
  videoUrl?:            string;
  audioUrl?:            string;
  documentUrl?:         string;
  fileName?:            string;
  // Context your dashboard must pass through
  campaign_id:          string;   // Instantly campaign UUID
  prospect_email?:      string;   // used to look up prospect_id UUID in analytics DB; omit/empty = unlinked send
  prospect_id?:         string;   // optional — ignored if not a valid UUID
  sequence_step_number: number;
  days_into_sequence?:  number;
  is_first_touch?:      boolean;
  wasender_api_key:     string;   // session Bearer token
}
