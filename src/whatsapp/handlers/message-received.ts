/**
 * messages-personal.received / messages.received webhook
 * Fires when the prospect sends a reply.
 */

import { supabase } from '../../supabase';
import { WasenderMessageReceivedPayload } from '../types';
import { normalizeTimestamp } from '../../wasender';
import { getTimeFields } from '../../utils/time';
import { countWords, countChars } from '../../utils/text';
import { classifyReply, mapInstantlyLabel } from '../../instantly';

export async function handleWaMessageReceived(p: WasenderMessageReceivedPayload): Promise<void> {
  const msg          = p.data.messages;
  const senderPhone  = msg.key.cleanedSenderPn ?? msg.key.remoteJid;
  const replyBody    = msg.messageBody ?? '';
  const receivedAt   = normalizeTimestamp(p.timestamp);
  const t            = getTimeFields(receivedAt);

  // Skip outbound messages (fromMe = true)
  if (msg.key.fromMe) return;

  // Skip empty messages (media with no caption)
  if (!replyBody.trim()) return;

  // Find the most recent outbound send to this phone number
  const { data: mapRow } = await supabase
    .from('wasender_message_map')
    .select('message_id, wasender_message_map.prospect_phone, outreach_sends!inner(prospect_id, campaign_id)')
    .eq('prospect_phone', senderPhone)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!mapRow?.message_id) {
    console.warn(`[wa/received] No outbound message found for phone=${senderPhone}`);
    return;
  }

  const messageId  = mapRow.message_id;
  const send       = (mapRow as any).outreach_sends;
  const prospectId = send?.prospect_id;
  const campaignId = send?.campaign_id;

  // Classify the reply
  const { label, confidence } = await classifyReply(replyBody);
  const sentimentLabel = mapInstantlyLabel(label);
  const isPositive     = sentimentLabel === 'positive';
  const isNegative     = sentimentLabel === 'negative';
  const isNeutral      = !isPositive && !isNegative;
  const isAutoReply    = sentimentLabel === 'auto_reply';
  const isOoo          = sentimentLabel === 'ooo';
  const isUnsubscribe  = sentimentLabel === 'unsubscribe';

  // 1. Insert into replies table
  const { data: reply, error: replyError } = await supabase
    .from('replies')
    .insert({
      message_id:                   messageId,
      prospect_id:                  prospectId,
      campaign_id:                  campaignId,
      channel:                      'whatsapp',
      received_at:                  receivedAt,
      received_day_of_week:         t.dayOfWeek,
      received_hour_prospect_local: t.hourUtc,
      reply_body_raw:               replyBody,
      reply_body_cleaned:           replyBody,
      reply_length_words:           countWords(replyBody),
      reply_length_chars:           countChars(replyBody),
      is_auto_reply:                isAutoReply,
      is_out_of_office:             isOoo,
      is_positive_reply:            isPositive,
      sentiment_label:              sentimentLabel,
      sentiment_confidence:         confidence,
      classified_by:                'model',
      contains_question:            replyBody.includes('?'),
      question_count:               (replyBody.match(/\?/g) ?? []).length,
      follow_up_required:           isPositive,
    })
    .select('reply_id')
    .single();

  if (replyError) {
    console.error('[wa/received] Reply insert failed:', replyError.message);
    return;
  }

  // 2. Update outreach_sends
  const { error: sendError } = await supabase
    .from('outreach_sends')
    .update({
      replied:               true,
      replied_at:            receivedAt,
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

  if (sendError) {
    console.error('[wa/received] outreach_sends update failed:', sendError.message);
  }
}
