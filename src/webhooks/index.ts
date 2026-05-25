import { Router, Request, Response } from 'express';
import { config } from '../config';
import { WebhookPayload } from './types';
import { handleEmailSent }        from './handlers/email-sent';
import { handleEmailOpened }      from './handlers/email-opened';
import { handleReplyReceived }    from './handlers/reply-received';
import { handleLinkClicked }      from './handlers/link-clicked';
import { handleEmailBounced }     from './handlers/email-bounced';
import { handleLeadUnsubscribed } from './handlers/lead-unsubscribed';
import { handleLeadInterested }   from './handlers/lead-interested';
import { handleCampaignCompleted } from './handlers/campaign-completed';

export const webhookRouter = Router();

webhookRouter.post('/', async (req: Request, res: Response) => {
  // Validate webhook secret if configured
  if (config.webhookSecret) {
    const authHeader = req.headers['authorization'] ?? '';
    if (authHeader !== `Bearer ${config.webhookSecret}`) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
  }

  // Instantly can send a single event or an array of events
  const events: WebhookPayload[] = Array.isArray(req.body) ? req.body : [req.body];

  // Respond immediately — process async so Instantly doesn't timeout
  res.status(200).json({ received: events.length });

  for (const event of events) {
    try {
      switch (event.event_type) {
        case 'email_sent':           await handleEmailSent(event);        break;
        case 'email_opened':         await handleEmailOpened(event);      break;
        case 'reply_received':       await handleReplyReceived(event);    break;
        case 'email_link_clicked':   await handleLinkClicked(event);      break;
        case 'email_bounced':        await handleEmailBounced(event);     break;
        case 'lead_unsubscribed':    await handleLeadUnsubscribed(event); break;
        case 'lead_interested':
        case 'lead_not_interested':  await handleLeadInterested(event);   break;
        case 'campaign_completed_for_lead':
        case 'campaign_completed_for_lead_without_reply':
                                     await handleCampaignCompleted(event as any); break;
        default:
          console.log(`Unhandled event type: ${(event as WebhookPayload).event_type}`);
      }
    } catch (err) {
      console.error(`Error handling ${event.event_type}:`, err);
    }
  }
});
