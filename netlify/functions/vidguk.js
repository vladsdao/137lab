// Telegram bot relay for voice reviews (/vidguk page).
// The site POSTs JSON {name, mime, seconds, data(base64), 'bot-field'} here;
// this forwards the audio to Vlad's Telegram for moderation.
// Approved files are then placed manually into sounds/feed/ + feed.json.
//
// Env (already configured in Netlify for apply.js):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID        — default destination
//   TELEGRAM_FEED_CHAT_ID   — optional override for reviews
//
// Node 18+ runtime: global fetch/FormData/Blob (undici).

const MIME_EXT = {
  'audio/mp4': '.m4a',
  'audio/mpeg': '.mp3',
  'audio/ogg': '.ogg',
  'audio/webm': '.webm',
};

// best-effort per-instance rate limit: ≥60s between accepts per IP
const lastHit = new Map();

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ ok: false, error: 'method_not_allowed' }) };
  }

  let data;
  try {
    data = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'bad_json' }) };
  }

  // Honeypot — silently accept bots without notifying.
  if (data['bot-field']) {
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  }

  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '?').split(',')[0].trim();
  const now = Date.now();
  if (lastHit.has(ip) && now - lastHit.get(ip) < 60_000) {
    return { statusCode: 429, body: JSON.stringify({ ok: false, error: 'too_fast' }) };
  }

  const name = String(data.name || '').replace(/[<>]/g, '').slice(0, 60).trim();
  const mimeBase = String(data.mime || '').split(';')[0].trim().toLowerCase();
  const seconds = Math.max(0, Math.min(60, parseInt(data.seconds, 10) || 0));
  const b64 = String(data.data || '');

  if (!name || !b64) {
    return { statusCode: 422, body: JSON.stringify({ ok: false, error: 'missing_fields' }) };
  }
  if (!MIME_EXT[mimeBase]) {
    return { statusCode: 422, body: JSON.stringify({ ok: false, error: 'bad_mime' }) };
  }
  if (b64.length > 6_200_000) {   // ≈4.6MB декодовано
    return { statusCode: 413, body: JSON.stringify({ ok: false, error: 'too_big' }) };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_FEED_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'not_configured' }) };
  }

  let buf;
  try {
    buf = Buffer.from(b64, 'base64');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ ok: false, error: 'bad_base64' }) };
  }
  if (!buf.length || buf.length > 4_800_000) {
    return { statusCode: 413, body: JSON.stringify({ ok: false, error: 'too_big' }) };
  }

  // sendAudio дає playable-картку для m4a/mp3; webm/ogg надійніше документом.
  const method = (mimeBase === 'audio/mp4' || mimeBase === 'audio/mpeg') ? 'sendAudio' : 'sendDocument';
  const field = method === 'sendAudio' ? 'audio' : 'document';
  const fname = 'vidguk-' + name.replace(/[^\p{L}\p{N}-]+/gu, '_').slice(0, 30) + '-' + now + MIME_EXT[mimeBase];
  const caption = '🎙 Відгук з 137lab.xyz\nІмʼя: ' + name + '\nТривалість: ~' + seconds + 'с · ' + Math.round(buf.length / 1024) + 'КБ';

  try {
    const BlobCtor = typeof Blob !== 'undefined' ? Blob : require('buffer').Blob;
    const fd = new FormData();
    fd.append('chat_id', String(chatId));
    fd.append('caption', caption);
    fd.append(field, new BlobCtor([buf], { type: mimeBase }), fname);

    const resp = await fetch('https://api.telegram.org/bot' + token + '/' + method, {
      method: 'POST',
      body: fd,
    });
    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'telegram_failed' }) };
    }
    lastHit.set(ip, now);
    if (lastHit.size > 500) lastHit.clear();   // не ростемо безмежно
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'telegram_error' }) };
  }
};
