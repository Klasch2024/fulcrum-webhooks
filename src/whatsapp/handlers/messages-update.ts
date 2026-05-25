/**
 * messages.update webhook
 * Fires on every status transition: PENDING → SENT → DELIVERED → READ
 * Status codes: 0=ERROR 1=PENDING 2=SENT 3=DELIVERED 4=READ 5=PLAYED
 */

import { supabase } from '../../supabase';
import { WasenderMessagesUpdatePayload } from '../types';
import { mapWasenderStatus, normalizeTimestamp } from '../../wasender';

export async function handleWaMessagesUpdate(p: WasenderMessagesUpdatePayload): Promise<void> {
  const statusCode    = p.data.update.status;
  const whatsappId    = p.data.key.id;
  const deliveryStatus = mapWasenderStatus(statusCode);

  // Find message_id via the map table using WhatsApp native ID
  const { data: mapRow } = await supabase
    .from('wasender_message_map')
    .select('message_id')
    .eq('wasender_whatsapp_id', whatsappId)
    .maybeSingle();

  if (!mapRow?.message_id) {
    console.warn(`[wa/messages.update] No map row found for whatsapp_id=${whatsappId}`);
    return;
  }

  const timestamp = normalizeTimestamp(p.timestamp);

  const updates: Record<string, any> = {
    whatsapp_delivery_status: deliveryStatus,
  };

  // Status 4 = READ, 5 = PLAYED (audio) — both count as read
  if (statusCode === 4 || statusCode === 5) {
    updates.whatsapp_read    = true;
    updates.whatsapp_read_at = timestamp;
  }

  // Status 0 = ERROR / failed delivery
  if (statusCode === 0) {
    updates.deliverability_status = 'hard_bounce';
    updates.bounce_type           = 'hard';
  }

  const { error } = await supabase
    .from('outreach_sends')
    .update(updates)
    .eq('message_id', mapRow.message_id);

  if (error) {
    console.error('[wa/messages.update] Update failed:', error.message);
  }
}
