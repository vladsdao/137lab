// /members — personal room (House of Unicorns): key entry, room state, events, Telegram signal.
// Pages: <домен>/members/ (threshold + key) → /members/room/ (video → window → yes | closed).
//
// Env (Netlify → Site settings → Environment):
//   SUPABASE_URL, SUPABASE_SERVICE_KEY  — table public.member_guests + private bucket "member"
//   MEMBER_SECRET                       — cookie signing secret (any long random string)
//   MEMBER_KEYS                         — optional plain keys: "slug:слово,slug2:слово2" (else key_hash in table)
//   MEMBER_TG                           — Vlad's Telegram username without @ (for the «Так» link)
//   MEMBER_TZ                           — time zone for signal timestamps (default Europe/Lisbon)
//   TELEGRAM_BOT_TOKEN, TELEGRAM_MEMBER_CHAT_ID (fallback TELEGRAM_KONTRAKT_CHAT_ID, TELEGRAM_CHAT_ID)
// Local (no SUPABASE_URL): guests live in a JSON file in os.tmpdir(); demo guest slug "demo", key "слово";
//   video = MEMBER_LOCAL_VIDEO (default /member/_local/sample.mp4, served by netlify/dev.js at /members/_local/).
//
// Node 18+ runtime provides global fetch.

const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');

const WINDOW = 600;            // seconds — the ten minutes
const COOKIE = 'm137';
const COOKIE_DAYS = 30;
const BUCKET = 'member';

const json = (statusCode, body, headers) => ({
  statusCode,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers || {}),
  body: JSON.stringify(body),
});
const sha = (s) => crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
const hmac = (s) => crypto.createHmac('sha256', process.env.MEMBER_SECRET || 'local-secret').update(s).digest('base64url');
const same = (a, b) => {
  const x = Buffer.from(String(a)); const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clean = (v, n) => String(v || '').replace(/[<>]/g, '').slice(0, n || 200).trim();

// ── storage: Supabase (REST, service key) or local JSON file ─────────────────
function supa() {
  const url = process.env.SUPABASE_URL.replace(/\/$/, '');
  const key = process.env.SUPABASE_SERVICE_KEY;
  const h = { apikey: key, Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };
  return {
    async get(slug) {
      const r = await fetch(url + '/rest/v1/member_guests?slug=eq.' + encodeURIComponent(slug) + '&select=*', { headers: h });
      if (!r.ok) throw new Error('db_get_' + r.status);
      const rows = await r.json();
      return rows[0] || null;
    },
    async patch(slug, fields) {
      const r = await fetch(url + '/rest/v1/member_guests?slug=eq.' + encodeURIComponent(slug), {
        method: 'PATCH', headers: Object.assign({ Prefer: 'return=representation' }, h), body: JSON.stringify(fields),
      });
      if (!r.ok) throw new Error('db_patch_' + r.status);
      const rows = await r.json();
      return rows[0] || null;
    },
    async sign(objectPath) {
      const r = await fetch(url + '/storage/v1/object/sign/' + BUCKET + '/' + objectPath, {
        method: 'POST', headers: h, body: JSON.stringify({ expiresIn: 3600 }),
      });
      if (!r.ok) return null;
      const d = await r.json();
      return d && d.signedURL ? url + '/storage/v1' + d.signedURL : null;
    },
  };
}

function local() {
  const file = path.join(os.tmpdir(), 'member-local.json');
  const read = () => {
    try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) {
      return { demo: { slug: 'demo', name: 'Демо', key_hash: sha('demo:слово'), video_path: 'demo/video.mp4' } };
    }
  };
  const write = (d) => fs.writeFileSync(file, JSON.stringify(d, null, 2));
  return {
    async get(slug) { return read()[slug] || null; },
    async patch(slug, fields) { const d = read(); d[slug] = Object.assign({}, d[slug], fields); write(d); return d[slug]; },
    async sign() { return process.env.MEMBER_LOCAL_VIDEO || '/members/_local/sample.mp4'; },
  };
}

const db = process.env.SUPABASE_URL ? supa() : local();

// ── cookie ───────────────────────────────────────────────────────────────────
function setCookie(slug, event) {
  const exp = Math.floor(Date.now() / 1000) + COOKIE_DAYS * 86400;
  const payload = slug + '.' + exp;
  const val = payload + '.' + hmac(payload);
  const https = (event.headers['x-forwarded-proto'] || '').startsWith('https');
  return COOKIE + '=' + val + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + (COOKIE_DAYS * 86400) + (https ? '; Secure' : '');
}
function readCookie(event) {
  const raw = event.headers.cookie || event.headers.Cookie || '';
  const m = raw.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]+)'));
  if (!m) return null;
  const parts = m[1].split('.');
  if (parts.length !== 3) return null;
  const [slug, exp, sig] = parts;
  if (!same(sig, hmac(slug + '.' + exp))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return slug;
}

// ── time ─────────────────────────────────────────────────────────────────────
const TZ = process.env.MEMBER_TZ || 'Europe/Lisbon';
const hhmm = (iso) => new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit', timeZone: TZ }).format(new Date(iso));
const mmss = (sec) => Math.floor(sec / 60) + ':' + String(Math.floor(sec % 60)).padStart(2, '0');

// ── Telegram signal (same relay bot as apply/kontrakt/vidguk) ────────────────
async function notify(text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_MEMBER_CHAT_ID || process.env.TELEGRAM_KONTRAKT_CHAT_ID || process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) { console.log('[member] signal (not configured):', text.replace(/\n/g, ' · ')); return; }
  try {
    await fetch('https://api.telegram.org/bot' + token + '/sendMessage', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
  } catch (e) { console.log('[member] signal failed', e && e.message); }
}
const head = (g) => '/member · ' + g.name + '\n';

// ── state ────────────────────────────────────────────────────────────────────
function compute(g) {
  const now = Date.now();
  if (g.yes_at) return { state: 'yes', remaining: 0 };
  if (!g.ended_at) return { state: 'video', remaining: WINDOW };
  const closeAt = new Date(g.ended_at).getTime() + WINDOW * 1000;
  if (now <= closeAt) return { state: 'window', remaining: Math.max(0, Math.round((closeAt - now) / 1000)) };
  return { state: 'closed', remaining: 0 };
}
async function stateOf(g) {
  const s = compute(g);
  const video = await db.sign(g.video_path || (g.slug + '/video.mp4'));
  return {
    ok: true, name: g.name, state: s.state, remaining: s.remaining, window: WINDOW, video,
    ended_at: g.ended_at || null, yes_at: g.yes_at || null,
    tg: process.env.MEMBER_TG || null,
  };
}

// ── rate limit for key attempts (best-effort, per instance) ──────────────────
const tries = new Map();
function tooMany(ip) {
  const now = Date.now();
  const arr = (tries.get(ip) || []).filter((t) => now - t < 60000);
  arr.push(now); tries.set(ip, arr);
  return arr.length > 6;
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { ok: false, error: 'method_not_allowed' });
  let data;
  try { data = JSON.parse(event.body || '{}'); } catch (e) { return json(400, { ok: false, error: 'bad_json' }); }
  if (data['bot-field']) return json(200, { ok: true });
  const action = clean(data.action, 20);

  try {
    if (action === 'enter') {
      const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || '?').split(',')[0].trim();
      if (tooMany(ip)) { await sleep(1500); return json(429, { ok: false, error: 'slow_down' }); }
      const slug = clean(data.u, 40).toLowerCase();
      const key = clean(data.key, 80).toLowerCase().replace(/\s+/g, ' ');
      const g = slug ? await db.get(slug) : null;
      let ok = false;
      if (g && key) {
        const envKeys = (process.env.MEMBER_KEYS || '').split(',').map((s) => s.trim()).filter(Boolean);
        const envKey = envKeys.map((s) => s.split(':')).find((p) => p[0] === slug);
        ok = envKey ? same(envKey.slice(1).join(':').toLowerCase(), key) : (g.key_hash ? same(g.key_hash, sha(slug + ':' + key)) : false);
      }
      if (!ok) { await sleep(700); return json(401, { ok: false, error: 'wrong_key' }); }
      if (!g.opened_at) {
        const now = new Date().toISOString();
        await db.patch(slug, { opened_at: now });
        await notify(head(g) + 'ключ · ' + hhmm(now));
      }
      return json(200, { ok: true }, { 'Set-Cookie': setCookie(slug, event) });
    }

    const slug = readCookie(event);
    if (!slug) return json(401, { ok: false, error: 'no_session' });
    let g = await db.get(slug);
    if (!g) return json(401, { ok: false, error: 'no_guest' });

    // окно закрылось без страницы (человек ушёл посреди окна) — сигнал при первом же взгляде сервера
    if (compute(g).state === 'closed' && !g.closed_notified_at) {
      g = await db.patch(slug, { closed_notified_at: new Date().toISOString() });
      await notify(head(g) + 'окно закрылось · ' + hhmm(new Date(new Date(g.ended_at).getTime() + WINDOW * 1000).toISOString()));
    }

    if (action === 'state') return json(200, await stateOf(g));

    if (action === 'event') {
      const type = clean(data.type, 10);
      const now = new Date().toISOString();
      if (type === 'ended' && !g.ended_at) {
        g = await db.patch(slug, { ended_at: now });
        const closeAt = new Date(new Date(now).getTime() + WINDOW * 1000).toISOString();
        await notify(head(g) + 'видео до конца · ' + hhmm(now) + '\nокно до · ' + hhmm(closeAt));
      } else if (type === 'yes' && g.ended_at && !g.yes_at && compute(g).state === 'window') {
        g = await db.patch(slug, { yes_at: now });
        const plus = (new Date(now) - new Date(g.ended_at)) / 1000;
        await notify(head(g) + 'ДА · ' + hhmm(now) + ' (+' + mmss(plus) + ')');
      } // type 'closed' — сигнал уже ушёл выше, при первом взгляде сервера на закрытое окно
      return json(200, await stateOf(g));
    }

    return json(400, { ok: false, error: 'unknown_action' });
  } catch (e) {
    console.log('[member] error', e && e.message);
    return json(502, { ok: false, error: 'server' });
  }
};
