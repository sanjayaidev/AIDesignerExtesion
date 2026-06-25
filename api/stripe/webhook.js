// api/stripe/webhook.js — Stripe sends events here to update subscription status.
// Configure this URL in your Stripe Dashboard → Developers → Webhooks.
import Stripe from 'stripe';
import { query } from '../../lib/db.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe needs the raw request body to verify the signature, so we disable
// Vercel's automatic JSON body parsing for this route only.
export const config = {
  api: { bodyParser: false }
};

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    readable.on('data', (chunk) => chunks.push(chunk));
    readable.on('end', () => resolve(Buffer.concat(chunks)));
    readable.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['stripe-signature'];
  const buf = await buffer(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.userId;
        if (userId) {
          await query(
            `UPDATE users SET subscription_active = TRUE, stripe_customer_id = $1 WHERE id = $2`,
            [session.customer, userId]
          );
        }
        break;
      }

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const active = sub.status === 'active' || sub.status === 'trialing';
        const expires = sub.current_period_end ? new Date(sub.current_period_end * 1000) : null;
        await query(
          `UPDATE users SET subscription_active = $1, subscription_expires = $2 WHERE stripe_customer_id = $3`,
          [active, expires, sub.customer]
        );
        break;
      }

      default:
        break; // ignore other event types
    }

    return res.status(200).json({ received: true });
  } catch (err) {
    console.error('webhook handling error:', err);
    return res.status(500).json({ error: 'Webhook handler failed' });
  }
}
