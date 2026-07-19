// Telegram bot relay for «Контракт про вигадку» (/daodedo page).
// The site POSTs JSON {name, email, 'bot-field', 'form-name'} here;
// this notifies Vlad's Telegram. Netlify Forms keeps the dashboard copy.
//
// Env (already configured in Netlify for apply.js):
//   TELEGRAM_BOT_TOKEN
//   TELEGRAM_CHAT_ID          — default destination
//   TELEGRAM_KONTRAKT_CHAT_ID — optional override for contract signatures
//
// Node 18+ runtime provides global fetch.

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

  const clean = (v) => String(v || '').replace(/[<>]/g, '').slice(0, 300).trim();
  const name = clean(data.name);
  const email = clean(data.email);

  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { statusCode: 422, body: JSON.stringify({ ok: false, error: 'missing_fields' }) };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_KONTRAKT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'not_configured' }) };
  }

  const text =
    '📜 Контракт про вигадку · DAO DE DO\n\n' +
    'Імʼя: ' + name + '\n' +
    'Email: ' + email;

  try {
    const resp = await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    if (!resp.ok) {
      return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'telegram_failed' }) };
    }
    return { statusCode: 200, body: JSON.stringify({ ok: true }) };
  } catch (e) {
    return { statusCode: 502, body: JSON.stringify({ ok: false, error: 'telegram_error' }) };
  }
};
