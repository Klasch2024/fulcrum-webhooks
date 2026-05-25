import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { webhookRouter }         from './webhooks';
import { wasenderWebhookRouter } from './whatsapp';
import { whatsappSendRouter }    from './whatsapp/send';
import { scheduleBackfill, runBackfill } from './jobs/backfill';

const app = express();

app.use(express.json({ limit: '1mb' }));

// ── Routes ───────────────────────────────────────────────────────────────────

// Instantly webhook receiver
app.use('/webhooks/instantly', webhookRouter);

// Wasender webhook receiver
app.use('/webhooks/wasender', wasenderWebhookRouter);

// WhatsApp send proxy — your dashboard calls this instead of Wasender directly
app.use('/api/whatsapp/send', whatsappSendRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Manual backfill trigger
app.post('/admin/backfill', async (_req, res) => {
  res.json({ message: 'Backfill started' });
  await runBackfill();
});

// ── Start ────────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`Fulcrum webhook server running on port ${config.port}`);
  console.log(`Instantly webhooks:  POST https://fulcrum-webhooks-production.up.railway.app/webhooks/instantly`);
  console.log(`Wasender webhooks:   POST https://fulcrum-webhooks-production.up.railway.app/webhooks/wasender`);
  console.log(`WhatsApp send proxy: POST https://fulcrum-webhooks-production.up.railway.app/api/whatsapp/send`);

  scheduleBackfill();
});

export default app;
