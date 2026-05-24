import { supabase } from '../../supabase';
import { LeadInterestedPayload, LeadNotInterestedPayload } from '../types';
import { findLatestMessageId } from '../../utils/prospects';

export async function handleLeadInterested(
  p: LeadInterestedPayload | LeadNotInterestedPayload
): Promise<void> {
  const isPositive = p.event_type === 'lead_interested';
  const messageId  = await findLatestMessageId(p.campaign_id, p.lead_email);

  if (!messageId) {
    console.warn(`${p.event_type}: no send found for campaign=${p.campaign_id} email=${p.lead_email}`);
    return;
  }

  // Update outreach_sends classification flags
  const { error: sendError } = await supabase
    .from('outreach_sends')
    .update({
      is_positive_reply: isPositive,
      is_negative_reply: !isPositive,
      is_neutral_reply:  false,
    })
    .eq('message_id', messageId);

  if (sendError) throw new Error(`${p.event_type} send update failed: ${sendError.message}`);

  // Also update the linked reply row if it exists
  const { data: send } = await supabase
    .from('outreach_sends')
    .select('reply_id')
    .eq('message_id', messageId)
    .single();

  if (send?.reply_id) {
    const { error: replyError } = await supabase
      .from('replies')
      .update({
        is_positive_reply: isPositive,
        sentiment_label:   isPositive ? 'positive' : 'negative',
        classified_by:     'human', // Instantly's manual label = human signal
      })
      .eq('reply_id', send.reply_id);

    if (replyError) throw new Error(`${p.event_type} reply update failed: ${replyError.message}`);
  }
}
