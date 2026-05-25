import axios from 'axios';
import { supabase } from '../../supabase';
import { instantly } from '../../instantly';
import { config } from '../../config';
import { CampaignCompletedPayload } from '../types';

export async function handleCampaignCompleted(p: CampaignCompletedPayload) {
  // Log full payload so we can see exactly what Instantly sends
  console.log('[campaign-completed] Raw payload:', JSON.stringify(p));

  const email = p.email ?? p.lead_email;
  let phone = p.lead_phone_number ?? (p as any).phone ?? (p as any).variables?.phone;

  // Instantly doesn't always include phone in the webhook — fetch it from the API
  if (!phone) {
    try {
      // Try listing the lead to get phone
      const { data: listData } = await instantly.post('/leads/list', {
        campaign_id: p.campaign_id,
        email:       email,
        limit:       1,
      });
      const lead = listData?.items?.[0] ?? listData?.[0];
      phone = lead?.phone ?? lead?.lead_phone_number ?? lead?.variables?.phone;
    } catch (err: any) {
      console.error(`[campaign-completed] Failed to fetch lead data for ${email}:`, err?.message);
    }
  }

  if (!phone) {
    console.log(`[campaign-completed] No phone number for ${email} — skipping WhatsApp check`);
    return;
  }

  // Normalise phone: strip leading + and all spaces (matches n8n logic)
  const normalised = phone.replace(/^\+/, '').replace(/\s/g, '');

  // 1. Check if lead is on WhatsApp
  let onWhatsApp = false;
  try {
    const { data } = await axios.get(
      `https://wasenderapi.com/api/on-whatsapp/${normalised}`,
      { headers: { Authorization: `Bearer ${config.wasenderApiKey}` }, timeout: 10_000 }
    );
    onWhatsApp = data?.data?.exists === true;
  } catch (err: any) {
    console.error(`[campaign-completed] WhatsApp check failed for ${phone}:`, err?.message);
    return;
  }

  if (!onWhatsApp) {
    console.log(`[campaign-completed] ${email} (${phone}) is not on WhatsApp — skipping`);
    return;
  }

  console.log(`[campaign-completed] ${email} is on WhatsApp — adding to wa_email_flow_leads`);

  // 2. Insert into wa_email_flow_leads (upsert on email to avoid duplicates)
  const { error } = await supabase
    .from('wa_email_flow_leads')
    .upsert(
      {
        email:        email,
        company:      p.company_name ?? null,
        phone:        phone,
        campaign_id:  p.campaign_id,
        campaign_name: p.campaign_name,
        added_at:     new Date().toISOString(),
      },
      { onConflict: 'email' }
    );

  if (error) {
    console.error(`[campaign-completed] Insert failed for ${email}:`, error.message);
  } else {
    console.log(`[campaign-completed] Added ${email} to wa_email_flow_leads`);
  }
}
