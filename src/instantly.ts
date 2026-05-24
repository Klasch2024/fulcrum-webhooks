import axios from 'axios';
import { config } from './config';

export const instantly = axios.create({
  baseURL: 'https://api.instantly.ai/api/v2',
  headers: {
    Authorization: `Bearer ${config.instantlyApiKey}`,
    'Content-Type': 'application/json',
  },
  timeout: 10_000,
});

// Classify a reply using Instantly's AI label endpoint
export async function classifyReply(replyText: string): Promise<{
  label: string;
  confidence: number | null;
}> {
  try {
    const { data } = await instantly.post('/lead-labels/ai-reply-label', {
      reply_text: replyText,
    });
    return { label: data.result ?? 'neutral', confidence: null };
  } catch {
    return { label: 'neutral', confidence: null };
  }
}

// Map Instantly's AI label → our sentiment_label_type enum
export function mapInstantlyLabel(label: string): string {
  const map: Record<string, string> = {
    Interested:       'positive',
    'Not Interested':  'negative',
    'Out of Office':   'ooo',
    'Auto Reply':      'auto_reply',
    Unsubscribe:       'unsubscribe',
    'Wrong Person':    'neutral',
    'Do Not Contact':  'negative',
    Referral:          'referral',
    'More Information': 'request_info',
  };
  return map[label] ?? 'neutral';
}
