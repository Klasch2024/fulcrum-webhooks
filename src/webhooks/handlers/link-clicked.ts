import { supabase } from '../../supabase';
import { EmailLinkClickedPayload } from '../types';
import { findMessageId } from '../../utils/prospects';

export async function handleLinkClicked(p: EmailLinkClickedPayload): Promise<void> {
  const messageId = await findMessageId(p.campaign_id, p.lead_email, p.step);
  if (!messageId) {
    console.warn(`email_link_clicked: no send found for campaign=${p.campaign_id} email=${p.lead_email} step=${p.step}`);
    return;
  }

  const { error } = await supabase
    .from('outreach_sends')
    .update({
      link_clicked:    true,
      link_clicked_at: p.timestamp,
    })
    .eq('message_id', messageId)
    .eq('link_clicked', false); // Only set on first click

  if (error) throw new Error(`link_clicked update failed: ${error.message}`);
}
