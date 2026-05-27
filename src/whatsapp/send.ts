/**
 * POST /api/whatsapp/send
 *
 * Your dashboard calls this endpoint instead of Wasender directly.
 * We proxy the send to Wasender, capture the msgId, and write the
 * outreach_sends row + wasender_message_map row in one shot.
 */

import { Router, Request, Response } from 'express';
import { supabase } from '../supabase';
import { wasender } from '../wasender';
import { getTimeFields } from '../utils/time';
import { countWords } from '../utils/text';
import { WhatsAppSendRequest } from './types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const toUuid = (v: string | undefined): string | null => (v && UUID_RE.test(v) ? v : null);

export const whatsappSendRouter = Router();

whatsappSendRouter.post('/', async (req: Request, res: Response) => {
  const body = req.body as WhatsAppSendRequest;

  // Validate required fields
  if (!body.to || !body.campaign_id || !body.wasender_api_key) {
    res.status(400).json({ error: 'Missing required fields: to, campaign_id, wasender_api_key' });
    return;
  }

  try {
    const sentAt = new Date().toISOString();
    const t      = getTimeFields(sentAt);

    // Build the Wasender payload — strip our internal fields
    const { campaign_id, prospect_id, prospect_email, sequence_step_number, days_into_sequence,
            is_first_touch, wasender_api_key, ...wasenderPayload } = body;

    // 1. Look up real prospect_id UUID from analytics DB by email (skip if no email)
    let resolvedProspectId: string | null = null;
    if (prospect_email) {
      const { data: prospect } = await supabase
        .from('prospects')
        .select('prospect_id')
        .eq('email', prospect_email)
        .maybeSingle();
      if (prospect?.prospect_id) {
        resolvedProspectId = prospect.prospect_id;
      } else {
        // Auto-create prospect so future queries can link to it
        const { data: newProspect } = await supabase
          .from('prospects')
          .insert({ email: prospect_email })
          .select('prospect_id')
          .single();
        resolvedProspectId = newProspect?.prospect_id ?? null;
      }
    } else {
      console.warn(`[whatsapp/send] No prospect_email provided for ${body.to} — send will be unlinked`);
    }

    // 2. Send via Wasender
    const { data: wasenderRes } = await wasender.post('/send-message', wasenderPayload, {
      headers: { Authorization: `Bearer ${wasender_api_key}` },
    });

    if (!wasenderRes?.success) {
      res.status(502).json({ error: 'Wasender send failed', detail: wasenderRes });
      return;
    }

    const wasenderMsgId: number = wasenderRes.data.msgId;

    // Determine message content for DB
    const messageBody = body.text ?? (body.imageUrl ? '[image]' : body.videoUrl ? '[video]'
      : body.audioUrl ? '[voice note]' : body.documentUrl ? '[document]' : '');

    // 3. Insert outreach_sends row (non-fatal — message already delivered)
    let messageUuid: string | null = null;
    const { data: send, error: sendError } = await supabase
      .from('outreach_sends')
      .insert({
        prospect_id:              resolvedProspectId,
        prospect_email:           prospect_email,
        campaign_id:              toUuid(campaign_id),
        channel:                  'whatsapp',
        sequence_step_number:     sequence_step_number,
        days_into_sequence:       days_into_sequence ?? null,
        is_first_touch:           is_first_touch ?? false,
        sent_at:                  sentAt,
        sent_day_of_week:         t.dayOfWeek,
        sent_hour_utc:            t.hourUtc,
        sent_week_of_year:        t.weekOfYear,
        sent_month:               t.month,
        message_body:             messageBody,
        message_length_words:     countWords(body.text ?? ''),
        channel_format:           body.audioUrl ? 'voice_note'
                                : body.videoUrl ? 'video_thumbnail'
                                : body.imageUrl ? 'image'
                                : 'plain_text',
        whatsapp_delivery_status: 'sent',
        deliverability_status:    'delivered',
      })
      .select('message_id')
      .single();

    if (sendError || !send) {
      console.error('[whatsapp/send] outreach_sends insert failed:', sendError?.message, sendError?.details, sendError?.hint);
    } else {
      messageUuid = send.message_id;

      // 4. Store msgId → message_id mapping for webhook lookups
      const { error: mapError } = await supabase
        .from('wasender_message_map')
        .insert({
          wasender_msg_id: wasenderMsgId,
          message_id:      messageUuid,
          prospect_phone:  body.to,
        });

      if (mapError) {
        console.error('[whatsapp/send] wasender_message_map insert failed:', mapError.message);
      }
    }

    // Always return 200 — Wasender already delivered the message
    res.status(200).json({
      success:         true,
      message_id:      messageUuid,
      wasender_msg_id: wasenderMsgId,
    });

  } catch (err: any) {
    console.error('[whatsapp/send] Error:', err?.message);
    res.status(500).json({ error: err?.message ?? 'Unknown error' });
  }
});
