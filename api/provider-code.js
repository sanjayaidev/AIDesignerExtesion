// api/provider-code.js — GET ?provider=deepseek&action=chat
// Requires Authorization: Bearer <token>. Verifies the user, then returns the
// JS source for that provider/action so the extension can inject it.
//
// Scripts live in /providers/scripts/<provider>-<action>.js as PLAIN .js FILES
// (not strings) — just drop your migrated files in there, named like:
//   providers/scripts/deepseek-chat.js
//   providers/scripts/qwen-chat.js
//   providers/scripts/gemini-image.js

import fs from 'fs';
import path from 'path';
import { query } from '../lib/db.js';
import { verifyToken, getBearerToken } from '../lib/auth.js';
import { applyCors } from '../lib/cors.js';

export default async function handler(req, res) {
  if (applyCors(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const token = getBearerToken(req);
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let payload;
  try {
    payload = verifyToken(token);
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const { provider, action } = req.query;
  if (!provider || !action) {
    return res.status(400).json({ error: 'provider and action query params are required' });
  }

  // Basic sanitization — only allow safe filename characters
  const safe = /^[a-zA-Z0-9_-]+$/;
  if (!safe.test(provider) || !safe.test(action)) {
    return res.status(400).json({ error: 'Invalid provider or action' });
  }

  try {
    const result = await query(
      'SELECT subscription_active, usage_used, usage_limit FROM users WHERE id = $1',
      [payload.userId]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'User no longer exists' });

    // Gate: free users get usage_limit free actions, then must subscribe
    if (!user.subscription_active && user.usage_used >= user.usage_limit) {
      return res.status(403).json({
        error: 'Free usage limit reached. Please subscribe to continue.'
      });
    }

    const filePath = path.join(process.cwd(), 'providers', 'scripts', `${provider}-${action}.js`);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: `No script found for ${provider}/${action}` });
    }

    const code = fs.readFileSync(filePath, 'utf8');

    // Count usage for free-tier users only
    if (!user.subscription_active) {
      await query('UPDATE users SET usage_used = usage_used + 1 WHERE id = $1', [payload.userId]);
    }

    res.setHeader('Content-Type', 'application/json');
    return res.status(200).json({ code });
  } catch (err) {
    console.error('provider-code error:', err);
    return res.status(500).json({ error: 'Failed to fetch provider code' });
  }
}
