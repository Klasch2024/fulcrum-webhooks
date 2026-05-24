import { supabase } from '../supabase';

// In-process cache to avoid repeated DB lookups for the same email
const cache = new Map<string, string>();

export async function getOrCreateProspect(email: string): Promise<string> {
  const cached = cache.get(email);
  if (cached) return cached;

  // Try to find existing prospect
  const { data: existing } = await supabase
    .from('prospects')
    .select('prospect_id')
    .eq('email', email)
    .maybeSingle();

  if (existing?.prospect_id) {
    cache.set(email, existing.prospect_id);
    return existing.prospect_id;
  }

  // Create new minimal prospect record
  const { data: created, error } = await supabase
    .from('prospects')
    .insert({ email })
    .select('prospect_id')
    .single();

  if (error || !created) throw new Error(`Failed to create prospect for ${email}: ${error?.message}`);

  cache.set(email, created.prospect_id);
  return created.prospect_id;
}

// Find the outreach_sends row for events that don't carry email_id
// (email_opened, reply_received, link_clicked, bounced, unsubscribed)
export async function findMessageId(
  campaignId: string,
  prospectEmail: string,
  step: number
): Promise<string | null> {
  const { data } = await supabase
    .from('outreach_sends')
    .select('message_id')
    .eq('campaign_id', campaignId)
    .eq('prospect_email', prospectEmail)
    .eq('sequence_step_number', step)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.message_id ?? null;
}

// Find the most recent send for a lead in a campaign (for bounced/unsubscribed
// which don't carry a step number)
export async function findLatestMessageId(
  campaignId: string,
  prospectEmail: string
): Promise<string | null> {
  const { data } = await supabase
    .from('outreach_sends')
    .select('message_id')
    .eq('campaign_id', campaignId)
    .eq('prospect_email', prospectEmail)
    .order('sent_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data?.message_id ?? null;
}
