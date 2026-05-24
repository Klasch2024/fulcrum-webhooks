export type InstantlyEventType =
  | 'email_sent'
  | 'email_opened'
  | 'reply_received'
  | 'email_link_clicked'
  | 'email_bounced'
  | 'lead_unsubscribed'
  | 'lead_interested'
  | 'lead_not_interested';

interface BasePayload {
  event_type:    InstantlyEventType;
  timestamp:     string;
  workspace:     string;
  campaign_id:   string;
  campaign_name: string;
  lead_email:    string;
  email_account: string;
  step:          number;
  variant:       string;
}

export interface EmailSentPayload extends BasePayload {
  event_type:    'email_sent';
  email_id:      string;
  email_subject: string;
  email_text:    string;
  email_html:    string;
  is_first:      boolean;
}

export interface EmailOpenedPayload extends BasePayload {
  event_type: 'email_opened';
}

export interface ReplyReceivedPayload extends BasePayload {
  event_type:         'reply_received';
  reply_text_snippet: string;
  reply_subject:      string;
  reply_text:         string;
  reply_html:         string;
}

export interface EmailLinkClickedPayload extends BasePayload {
  event_type: 'email_link_clicked';
}

export interface EmailBouncedPayload extends BasePayload {
  event_type: 'email_bounced';
}

export interface LeadUnsubscribedPayload extends BasePayload {
  event_type: 'lead_unsubscribed';
}

export interface LeadInterestedPayload extends BasePayload {
  event_type: 'lead_interested';
}

export interface LeadNotInterestedPayload extends BasePayload {
  event_type: 'lead_not_interested';
}

export type WebhookPayload =
  | EmailSentPayload
  | EmailOpenedPayload
  | ReplyReceivedPayload
  | EmailLinkClickedPayload
  | EmailBouncedPayload
  | LeadUnsubscribedPayload
  | LeadInterestedPayload
  | LeadNotInterestedPayload;
