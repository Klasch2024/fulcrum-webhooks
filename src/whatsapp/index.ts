import { Router, Request, Response } from 'express';
import { WasenderWebhookPayload } from './types';
import { handleWaMessageSent }     from './handlers/message-sent';
import { handleWaMessagesUpdate }  from './handlers/messages-update';
import { handleWaMessageReceived } from './handlers/message-received';

export const wasenderWebhookRouter = Router();

wasenderWebhookRouter.post('/', async (req: Request, res: Response) => {
  const payload = req.body as WasenderWebhookPayload;

  // Respond immediately so Wasender doesn't timeout
  res.status(200).json({ received: true });

  try {
    switch (payload.event) {
      case 'message.sent':
        await handleWaMessageSent(payload as any);
        break;

      case 'messages.update':
        await handleWaMessagesUpdate(payload as any);
        break;

      case 'messages.received':
      case 'messages-personal.received':
        await handleWaMessageReceived(payload as any);
        break;

      default:
        // Silently ignore events we don't need (session.status, groups, etc.)
        break;
    }
  } catch (err) {
    console.error(`[wasender webhook] Error handling ${payload.event}:`, err);
  }
});
