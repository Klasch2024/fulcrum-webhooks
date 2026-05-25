/**
 * message.sent webhook
 * Fires when Wasender confirms the message left the server.
 * We use this to store the WhatsApp native key.id for later lookups.
 */

import { supabase } from '../../supabase';
import { WasenderMessageSentPayload } from '../types';

export async function handleWaMessageSent(p: WasenderMessageSentPayload): Promise<void> {
  const whatsappId = p.data.key.id;
  const remoteJid  = p.data.key.remoteJid;

  if (!whatsappId) return;

  // Find the map row by prospect phone (most reliable link at this point)
  // and update it with the WhatsApp native ID
  const { error } = await supabase
    .from('wasender_message_map')
    .update({ wasender_whatsapp_id: whatsappId })
    .eq('prospect_phone', remoteJid)
    .is('wasender_whatsapp_id', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error('[wa/message.sent] Map update failed:', error.message);
  }
}
