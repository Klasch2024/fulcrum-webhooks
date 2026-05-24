import { supabase } from '../../supabase';
import { LeadUnsubscribedPayload } from '../types';
import { findLatestMessageId } from '../../utils/prospects';

export async function handleLeadUnsubscribed(p: LeadUnsubscribedPayload): Promise<void> {
  const messageId = await findLatestMessageId(p.campaign_id, p.lead_email);
  if (!messageId) {
    console.warn(`lead_unsubscribed: no send found for campaign=${p.campaign_id} email=${p.lead_email}`);
    return;
  }

  const { error } = await supabase
    .from('outreach_sends')
    .update({
      is_unsubscribe:  true,
      unsubscribed_at: p.timestamp,
    })
    .eq('message_id', messageId);

  if (error) throw new Error(`lead_unsubscribed update failed: ${error.message}`);
}
