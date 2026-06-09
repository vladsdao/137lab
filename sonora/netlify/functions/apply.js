// Telegram bot relay for retreat applications.
// On submit, the site POSTs JSON {name, telegram, email} here; this sends it to Vika's Telegram.
//
// Required environment variables (set in Netlify → Site settings → Environment):
//   TELEGRAM_BOT_TOKEN  — token from @BotFather
//   TELEGRAM_CHAT_ID    — Vika's chat id (get it from https://api.telegram.org/bot<token>/getUpdates
//                         after she sends /start to the bot)
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
  const telegram = clean(data.telegram || data.contact);
  const request = clean(data.request);

  if (!name || !telegram) {
    return { statusCode: 422, body: JSON.stringify({ ok: false, error: 'missing_fields' }) };
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return { statusCode: 503, body: JSON.stringify({ ok: false, error: 'not_configured' }) };
  }

  const text =
    '🌿 Новая заявка · SONORA (27–30 июня)\n\n' +
    'Имя: ' + name + '\n' +
    'Telegram: ' + telegram +
    (request ? '\nЗапрос: ' + request : '');

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
