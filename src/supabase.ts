import { createClient } from '@supabase/supabase-js';
import { config } from './config';

export const supabase = createClient(
  config.supabaseUrl,
  config.supabaseServiceRoleKey,
  { auth: { persistSession: false } }
);

// Second client for the dashboard Supabase project (wa_email_flow_leads etc.)
export const dashboardSupabase = createClient(
  config.dashboardSupabaseUrl,
  config.dashboardSupabaseServiceRoleKey,
  { auth: { persistSession: false } }
);
