import { supabase } from '../../supabase';
import { EmailOpenedPayload } from '../types';
import { findMessageId } from '../../utils/prospects';
import { getTimeFields } from '../../utils/time';

export async function handleEmailOpened(p: EmailOpenedPayload): Promise<void> {
  const messageId = await findMessageId(p.campaign_id, p.lead_email, p.step);
  if (!messageId) {
    console.warn(`email_opened: no send found for campaign=${p.campaign_id} email=${p.lead_email} step=${p.step}`);
    return;
  }

  const t = getTimeFields(p.timestamp);

  // Fetch current open count so we can increment it
  const { data: current } = await supabase
    .from('outreach_sends')
    .select('email_open_count, email_opened')
    .eq('message_id', messageId)
    .single();

  const currentCount = current?.email_open_count ?? 0;
  const isFirstOpen  = !current?.email_opened;

  // Update the send row
  const { error: sendError } = await supabase
    .from('outreach_sends')
    .update({
      email_opened:           true,
      email_open_count:       currentCount + 1,
      // Only set first_opened_at on the first open
      ...(isFirstOpen && {
        email_first_opened_at: p.timestamp,
        open_day_of_week:      t.dayOfWeek,
        open_hour_prospect_local: t.hourUtc, // Falls back to UTC; enrich with timezone later
      }),
    })
    .eq('message_id', messageId);

  if (sendError) throw new Error(`email_opened update failed: ${sendError.message}`);

  // Insert granular open event
  const { error: openError } = await supabase
    .from('email_open_events')
    .insert({
      message_id:           messageId,
      prospect_id:          await getProspectId(p.campaign_id, p.lead_email),
      opened_at:            p.timestamp,
      open_sequence_number: currentCount + 1,
      open_day_of_week:     t.dayOfWeek,
      open_hour_prospect_local: t.hourUtc,
    });

  if (openError) throw new Error(`email_open_events insert failed: ${openError.message}`);
}

async function getProspectId(campaignId: string, email: string): Promise<string> {
  const { data } = await supabase
    .from('outreach_sends')
    .select('prospect_id')
    .eq('campaign_id', campaignId)
    .eq('prospect_email', email)
    .limit(1)
    .single();
  return data?.prospect_id ?? '';
}
