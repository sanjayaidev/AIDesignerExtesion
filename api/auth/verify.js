// api/auth/verify.js — GET, requires Authorization: Bearer <token>
// Lightweight check used by requireAuth() in the extension on every action.
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

    const result = await query('SELECT email, plan FROM users WHERE id = $1', [payload.userId]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    return res.status(200).json({ email: user.email, plan: user.plan });
  } catch (err) {
    // Covers both expired and malformed/invalid tokens
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
