// api/stripe/checkout.js — POST { email }
import Stripe from 'stripe';
import { query } from '../../lib/db.js';
import { applyCors } from '../../lib/cors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const normalizedEmail = String(email).trim().toLowerCase();

  try {
    const result = await query(
      'SELECT id, stripe_customer_id FROM users WHERE email = $1',
      [normalizedEmail]
    );
    const user = result.rows[0];
    if (!user) return res.status(404).json({ error: 'No account found for this email' });

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: user.stripe_customer_id || undefined,
      customer_email: user.stripe_customer_id ? undefined : normalizedEmail,
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      success_url: process.env.CHECKOUT_SUCCESS_URL || 'https://example.com/success',
      cancel_url: process.env.CHECKOUT_CANCEL_URL || 'https://example.com/cancel',
      metadata: { userId: String(user.id) }
    });

    return res.status(200).json({ url: session.url });
  } catch (err) {
    console.error('checkout error:', err);
    return res.status(500).json({ error: 'Could not create checkout session' });
  }
}
