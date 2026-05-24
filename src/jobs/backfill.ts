/**
 * Nightly backfill job
 * Catches anything the webhooks may have missed by polling the Instantly REST API.
 * Runs at 02:00 UTC every night via node-cron.
 */

import cron from 'node-cron';
import { instantly } from '../instantly';
import { supabase } from '../supabase';
import { getOrCreateProspect } from '../utils/prospects';
import { getTimeFields } from '../utils/time';
import { countWords, stripHtml } from '../utils/text';

// ── Backfill sent emails ────────────────────────────────────────────────────

async function backfillSentEmails(): Promise<void> {
  console.log('[backfill] Starting sent emails backfill...');

  let startingAfter: string | undefined;
  let fetched = 0;

  do {
    const { data } = await instantly.get('/emails', {
      params: {
        limit:          100,
        ue_type:        1, // sent
        ...(startingAfter && { starting_after: startingAfter }),
      },
    });

    const emails: any[] = data?.items ?? data ?? [];
    if (!emails.length) break;

    for (const email of emails) {
      const prospectId = await getOrCreateProspect(email.to_address_email ?? email.lead_email);
      const t = getTimeFields(email.timestamp_email ?? email.timestamp_created);
      const body = email.body ?? '';

      await supabase.from('outreach_sends').upsert(
        {
          instantly_email_id:   email.id,
          prospect_id:          prospectId,
          prospect_email:       email.to_address_email ?? email.lead_email,
          campaign_id:          email.campaign_id,
          sender_email:         email.from_address_email,
          channel:              'email',
          sequence_step_number: email.step,
          sent_at:              email.timestamp_email ?? email.timestamp_created,
          sent_day_of_week:     t.dayOfWeek,
          sent_hour_utc:        t.hourUtc,
          sent_week_of_year:    t.weekOfYear,
          sent_month:           t.month,
          subject_line:         email.subject,
          message_body:         body,
          message_length_words: countWords(body),
          deliverability_status:'delivered',
        },
        { onConflict: 'instantly_email_id', ignoreDuplicates: true }
      );
    }

    fetched += emails.length;
    startingAfter = emails[emails.length - 1]?.id;
    if (emails.length < 100) break;

  } while (true);

  console.log(`[backfill] Sent emails: processed ${fetched} records`);
}

// ── Backfill replies ────────────────────────────────────────────────────────

async function backfillReplies(): Promise<void> {
  console.log('[backfill] Starting replies backfill...');

  let startingAfter: string | undefined;
  let fetched = 0;

  do {
    const { data } = await instantly.get('/emails', {
      params: {
        limit:          100,
        ue_type:        2, // received / replies
        ...(startingAfter && { starting_after: startingAfter }),
      },
    });

    const emails: any[] = data?.items ?? data ?? [];
    if (!emails.length) break;

    for (const email of emails) {
      // Check if this reply is already stored
      const { data: existing } = await supabase
        .from('replies')
        .select('reply_id')
        .eq('message_id', email.thread_id ?? email.id)
        .maybeSingle();

      if (existing) continue; // Already captured by webhook

      const prospectId = await getOrCreateProspect(email.from_address_email ?? email.lead_email);
      const body = email.body ?? '';
      const t = getTimeFields(email.timestamp_email ?? email.timestamp_created);

      // Find the parent send by thread
      const { data: parentSend } = await supabase
        .from('outreach_sends')
        .select('message_id')
        .eq('instantly_email_id', email.thread_id)
        .maybeSingle();

      if (!parentSend) continue;

      await supabase.from('replies').insert({
        message_id:           parentSend.message_id,
        prospect_id:          prospectId,
        campaign_id:          email.campaign_id,
        channel:              'email',
        received_at:          email.timestamp_email ?? email.timestamp_created,
        received_day_of_week: t.dayOfWeek,
        reply_body_raw:       body,
        reply_body_cleaned:   body,
        reply_length_words:   countWords(body),
        reply_length_chars:   body.length,
        is_auto_reply:        email.is_auto_reply ?? false,
        contains_question:    body.includes('?'),
        question_count:       (body.match(/\?/g) ?? []).length,
      });
    }

    fetched += emails.length;
    startingAfter = emails[emails.length - 1]?.id;
    if (emails.length < 100) break;

  } while (true);

  console.log(`[backfill] Replies: processed ${fetched} records`);
}

// ── Backfill lead statuses (open counts, bounce, unsubscribe) ───────────────

async function backfillLeadStatuses(): Promise<void> {
  console.log('[backfill] Starting lead status backfill...');

  // Get all unique campaign+email combos we have sends for
  const { data: sends } = await supabase
    .from('outreach_sends')
    .select('campaign_id, prospect_email, message_id')
    .eq('deliverability_status', 'delivered')
    .is('replied', false)
    .limit(500);

  if (!sends?.length) return;

  const uniqueLeads = [...new Map(sends.map(s => [
    `${s.campaign_id}:${s.prospect_email}`,
    { campaign_id: s.campaign_id, email: s.prospect_email }
  ])).values()];

  for (const lead of uniqueLeads) {
    try {
      const { data: leadData } = await instantly.get(`/leads/${lead.email}`, {
        params: { campaign_id: lead.campaign_id },
      });

      if (!leadData) continue;

      const updates: Record<string, any> = {};

      if (leadData.email_open_count > 0)        updates.email_open_count = leadData.email_open_count;
      if (leadData.timestamp_last_open)          updates.email_first_opened_at = leadData.timestamp_last_open;
      if (leadData.timestamp_last_open)          updates.email_opened = true;
      if (leadData.status === -1)                updates.deliverability_status = 'hard_bounce';
      if (leadData.status === -2) {
        updates.is_unsubscribe = true;
        if (leadData.timestamp_last_contact)     updates.unsubscribed_at = leadData.timestamp_last_contact;
      }

      if (Object.keys(updates).length) {
        await supabase
          .from('outreach_sends')
          .update(updates)
          .eq('campaign_id', lead.campaign_id)
          .eq('prospect_email', lead.email);
      }
    } catch {
      // Lead not found in Instantly — skip
    }
  }

  console.log(`[backfill] Lead statuses: processed ${uniqueLeads.length} leads`);
}

// ── Main backfill runner ────────────────────────────────────────────────────

export async function runBackfill(): Promise<void> {
  console.log('[backfill] Starting nightly backfill...');
  try {
    await backfillSentEmails();
    await backfillReplies();
    await backfillLeadStatuses();
    console.log('[backfill] Nightly backfill complete.');
  } catch (err) {
    console.error('[backfill] Backfill error:', err);
  }
}

// Schedule: every night at 02:00 UTC
export function scheduleBackfill(): void {
  cron.schedule('0 2 * * *', runBackfill, { timezone: 'UTC' });
  console.log('[backfill] Nightly backfill scheduled at 02:00 UTC');
}
