import 'dotenv/config';
import express from 'express';
import { config } from './config';
import { webhookRouter } from './webhooks';
import { scheduleBackfill, runBackfill } from './jobs/backfill';

const app = express();

// Parse JSON bodies — Instantly sends JSON
app.use(express.json({ limit: '1mb' }));

// ── Routes ──────────────────────────────────────────────────────────────────

// Instantly webhook receiver
app.use('/webhooks/instantly', webhookRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Manual backfill trigger (protect this in production with auth)
app.post('/admin/backfill', async (_req, res) => {
  res.json({ message: 'Backfill started' });
  await runBackfill();
});

// ── Start ───────────────────────────────────────────────────────────────────

app.listen(config.port, () => {
  console.log(`Fulcrum webhook server running on port ${config.port}`);
  console.log(`Webhook URL: POST http://your-server:${config.port}/webhooks/instantly`);

  // Start nightly backfill cron
  scheduleBackfill();
});

export default app;
