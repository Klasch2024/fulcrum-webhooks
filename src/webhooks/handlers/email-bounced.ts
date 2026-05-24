import { supabase } from '../../supabase';
import { EmailBouncedPayload } from '../types';
import { findMessageId } from '../../utils/prospects';

export async function handleEmailBounced(p: EmailBouncedPayload): Promise<void> {
  const messageId = await findMessageId(p.campaign_id, p.lead_email, p.step);
  if (!messageId) {
    console.warn(`email_bounced: no send found for campaign=${p.campaign_id} email=${p.lead_email} step=${p.step}`);
    return;
  }

  const { error } = await supabase
    .from('outreach_sends')
    .update({
      deliverability_status: 'hard_bounce',
      bounce_type:           'hard',
    })
    .eq('message_id', messageId);

  if (error) throw new Error(`email_bounced update failed: ${error.message}`);
}
