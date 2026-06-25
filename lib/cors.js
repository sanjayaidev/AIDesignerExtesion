// lib/cors.js — Allows requests from the Chrome extension (chrome-extension://<id> origin)
// Returns true if the request was a handled OPTIONS preflight (caller should stop processing).
export function applyCors(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return true;
  }
  return false;
}
