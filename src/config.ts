import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required environment variable: ${key}`);
  return val;
}

export const config = {
  port:                   parseInt(process.env.PORT ?? '3000', 10),
  supabaseUrl:            required('SUPABASE_URL'),
  supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
  instantlyApiKey:        required('INSTANTLY_API_KEY'),
  wasenderApiKey:         required('WASENDER_API_KEY'),
  webhookSecret:          process.env.WEBHOOK_SECRET ?? '',
};
