import { supabase } from '../../supabase';
import { EmailSentPayload } from '../types';
import { getOrCreateProspect } from '../../utils/prospects';
import { getTimeFields } from '../../utils/time';
import { countWords, stripHtml } from '../../utils/text';

export async function handleEmailSent(p: EmailSentPayload): Promise<void> {
const prospectId = await getOrCreateProspect(p.lead_email);
  const t = getTimeFields(p.timestamp);
  const body = p.email_text || stripHtml(p.email_html);

  // Check if this email_id already exists
  if (p.email_id) {
    const { data: existing } = await supabase
      .from('outreach_sends')
      .select('message_id')
      .eq('instantly_email_id', p.email_id)
      .maybeSingle();
    if (existing) return; // Already inserted, skip
  }

  const { error } = await supabase
    .from('outreach_sends')
    .insert({
      instantly_email_id:   p.email_id,
      prospect_id:          prospectId,
      prospect_email:       p.lead_email,
      campaign_id:          p.campaign_id,
      sender_email:         p.email_account,
      channel:              'email',
      sequence_step_number: p.step,
      is_first_touch:       p.is_first,
      sent_at:              p.timestamp,
      sent_day_of_week:     t.dayOfWeek,
      sent_hour_utc:        t.hourUtc,
      sent_week_of_year:    t.weekOfYear,
      sent_month:           t.month,
      subject_line:         p.email_subject,
      message_body:         body,
      message_length_words: countWords(body),
      channel_format:       p.email_html ? 'html' : 'plain_text',
      deliverability_status:'delivered',
    });

  if (error) throw new Error(`email_sent insert failed: ${error.message}`);
}
