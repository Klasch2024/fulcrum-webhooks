import { supabase } from '../../supabase';
import { classifyReply, mapInstantlyLabel } from '../../instantly';
import { ReplyReceivedPayload } from '../types';
import { findMessageId, getOrCreateProspect } from '../../utils/prospects';
import { getTimeFields } from '../../utils/time';
import { countWords, countChars, stripHtml } from '../../utils/text';

export async function handleReplyReceived(p: ReplyReceivedPayload): Promise<void> {
  const [foundMessageId, prospectId] = await Promise.all([
    findMessageId(p.campaign_id, p.lead_email, p.step),
    getOrCreateProspect(p.lead_email),
  ]);

  let messageId = foundMessageId;

  if (!messageId) {
    // No matching send found — backfill a stub so the reply isn't lost
    const tf = getTimeFields(p.timestamp);
    const { data: stub } = await supabase
      .from('outreach_sends')
      .insert({
        prospect_id:          prospectId,
        prospect_email:       p.lead_email,
        campaign_id:          p.campaign_id,
        campaign_name:        p.campaign_name ?? null,
        channel:              'email',
        sequence_step_number: p.step,
        sent_at:              p.timestamp,
        sent_day_of_week:     tf.dayOfWeek,
        sent_hour_utc:        tf.hourUtc,
        sent_week_of_year:    tf.weekOfYear,
        sent_month:           tf.month,
        deliverability_status:'delivered',
      })
      .select('message_id')
      .single();

    if (!stub?.message_id) {
      console.warn(`reply_received: backfill failed for campaign=${p.campaign_id} email=${p.lead_email} step=${p.step}`);
      return;
    }
    console.log(`reply_received: backfilled send for campaign=${p.campaign_id} email=${p.lead_email} step=${p.step}`);
    messageId = stub.message_id;
  }

  const t    = getTimeFields(p.timestamp);
  const body = p.reply_text || stripHtml(p.reply_html);

  // Classify the reply with Instantly's AI endpoint
  const { label, confidence } = await classifyReply(body);
  const sentimentLabel  = mapInstantlyLabel(label);
  const isPositive      = sentimentLabel === 'positive';
  const isNegative      = sentimentLabel === 'negative';
  const isNeutral       = !isPositive && !isNegative;
  const isAutoReply     = sentimentLabel === 'auto_reply';
  const isOoo           = sentimentLabel === 'ooo';
  const isUnsubscribe   = sentimentLabel === 'unsubscribe';

  // 1. Insert into replies table
  const { data: reply, error: replyError } = await supabase
    .from('replies')
    .insert({
      message_id:                  messageId,
      prospect_id:                 prospectId,
      campaign_id:                 p.campaign_id,
      channel:                     'email',
      received_at:                 p.timestamp,
      received_day_of_week:        t.dayOfWeek,
      received_hour_prospect_local:t.hourUtc,
      reply_body_raw:              body,
      reply_body_cleaned:          body,
      reply_length_words:          countWords(body),
      reply_length_chars:          countChars(body),
      is_auto_reply:               isAutoReply,
      is_out_of_office:            isOoo,
      is_positive_reply:           isPositive,
      sentiment_label:             sentimentLabel,
      sentiment_confidence:        confidence,
      classified_by:               'model',
      contains_question:           body.includes('?'),
      question_count:              (body.match(/\?/g) ?? []).length,
      follow_up_required:          isPositive,
    })
    .select('reply_id')
    .single();

  if (replyError) throw new Error(`reply insert failed: ${replyError.message}`);

  // 2. Update outreach_sends with reply outcome
  const { error: sendError } = await supabase
    .from('outreach_sends')
    .update({
      replied:               true,
      replied_at:            p.timestamp,
      reply_day_of_week:     t.dayOfWeek,
      reply_hour_prospect_local: t.hourUtc,
      reply_id:              reply!.reply_id,
      is_positive_reply:     isPositive,
      is_negative_reply:     isNegative,
      is_neutral_reply:      isNeutral,
      is_auto_reply:         isAutoReply,
      is_out_of_office:      isOoo,
      is_unsubscribe:        isUnsubscribe,
    })
    .eq('message_id', messageId);

  if (sendError) throw new Error(`reply outreach_sends update failed: ${sendError.message}`);
}
