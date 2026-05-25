import axios from 'axios';

export const wasender = axios.create({
  baseURL: 'https://www.wasenderapi.com/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15_000,
});

// Status code → our whatsapp_delivery_status_type enum
export function mapWasenderStatus(code: number): string {
  switch (code) {
    case 0: return 'failed';
    case 1: return 'sent';      // pending/in-progress
    case 2: return 'sent';
    case 3: return 'delivered';
    case 4: return 'read';
    case 5: return 'read';      // played (audio/video) = read equivalent
    default: return 'sent';
  }
}

// Normalize timestamp — Wasender uses both seconds and milliseconds
export function normalizeTimestamp(ts: number): string {
  // If > 1e12 it's milliseconds, otherwise seconds
  const ms = ts > 1_000_000_000_000 ? ts : ts * 1000;
  return new Date(ms).toISOString();
}
