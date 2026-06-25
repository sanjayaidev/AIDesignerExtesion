// api/auth/me.js — GET, requires Authorization: Bearer <token>
// Returns the full profile shape the side panel UI expects:
// { email, name, plan, subscription: { active, tier, expires }, usage: { used, limit } }
import { query } from '../../lib/db.js';
import { verifyToken, getBearerToken } from '../../lib/auth.js';
import { applyCors } from '../../lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  try {
    const payload = verifyToken(token);

    const result = await query(
      `SELECT email, name, plan, subscription_active, subscription_tier,
              subscription_expires, usage_used, usage_limit
       FROM users WHERE id = $1`,
      [payload.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    return res.status(200).json({
      email: user.email,
      name: user.name,
      plan: user.plan,
      subscription: {
        active: user.subscription_active,
        tier: user.subscription_tier,
        expires: user.subscription_expires
      },
      usage: {
        used: user.usage_used,
        limit: user.usage_limit
      }
    });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
