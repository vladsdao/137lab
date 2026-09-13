// /members — personal room (House of Unicorns). Supabase Edge Function: key entry, room state, events, Telegram signal.
// Pages (static, Netlify): <домен>/members/ → /members/room/. They call this function with a signed token in header x-member.
// Uses only what the Edge runtime already has: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto), TELEGRAM_BOT_TOKEN (project secret).
// Config lives in public.member_config: tg_chat_id (signals), tg_username (link «Так»), tz (timestamps).
// Deployed with verify_jwt=false: auth is the guest key + HMAC token (see below), no Supabase users.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPA = Deno.env.get("SUPABASE_URL")!.replace(/\/$/, "");
const KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BOT = Deno.env.get("TELEGRAM_BOT_TOKEN") || "";
const WINDOW = 600; // seconds — the ten minutes
const BUCKET = "member";
const TOKEN_DAYS = 30;

const H = { apikey: KEY, Authorization: "Bearer " + KEY, "Content-Type": "application/json" };
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-member",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" } });

const enc = new TextEncoder();
const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
const b64u = (b: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const sha = async (s: string) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));
let hmacKey: CryptoKey | null = null;
async function hmac(s: string) {
  if (!hmacKey) {
    const raw = await crypto.subtle.digest("SHA-256", enc.encode("m137:" + KEY)); // derived from the service key — no extra secret to manage
    hmacKey = await crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  }
  return b64u(await crypto.subtle.sign("HMAC", hmacKey, enc.encode(s)));
}
const same = (a: string, b: string) => {
  if (a.length !== b.length) return false;
  let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};
const clean = (v: unknown, n = 200) => String(v ?? "").replace(/[<>]/g, "").slice(0, n).trim();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── db (PostgREST with service role) ─────────────────────────────────────────
type Guest = Record<string, any>;
async function getGuest(slug: string): Promise<Guest | null> {
  const r = await fetch(`${SUPA}/rest/v1/member_guests?slug=eq.${encodeURIComponent(slug)}&select=*`, { headers: H });
  if (!r.ok) throw new Error("db_get_" + r.status);
  return (await r.json())[0] || null;
}
async function patchGuest(slug: string, fields: Guest): Promise<Guest> {
  const r = await fetch(`${SUPA}/rest/v1/member_guests?slug=eq.${encodeURIComponent(slug)}`, {
    method: "PATCH", headers: { ...H, Prefer: "return=representation" }, body: JSON.stringify(fields),
  });
  if (!r.ok) throw new Error("db_patch_" + r.status);
  return (await r.json())[0];
}
let cfgCache: Record<string, string> | null = null;
async function config(): Promise<Record<string, string>> {
  if (cfgCache) return cfgCache;
  const r = await fetch(`${SUPA}/rest/v1/member_config?select=key,value`, { headers: H });
  const rows = r.ok ? await r.json() : [];
  cfgCache = Object.fromEntries(rows.map((x: any) => [x.key, x.value]));
  return cfgCache!;
}
async function signVideo(path: string): Promise<string | null> {
  const r = await fetch(`${SUPA}/storage/v1/object/sign/${BUCKET}/${path}`, { method: "POST", headers: H, body: JSON.stringify({ expiresIn: 3600 }) });
  if (!r.ok) return null;
  const d = await r.json();
  return d?.signedURL ? `${SUPA}/storage/v1${d.signedURL}` : null;
}

// ── time & signal ────────────────────────────────────────────────────────────
async function hhmm(iso: string) {
  const tz = (await config()).tz || "Europe/Lisbon";
  return new Intl.DateTimeFormat("ru-RU", { hour: "2-digit", minute: "2-digit", timeZone: tz }).format(new Date(iso));
}
const mmss = (sec: number) => Math.floor(sec / 60) + ":" + String(Math.floor(sec % 60)).padStart(2, "0");
async function notify(text: string) {
  const chat = (await config()).tg_chat_id;
  if (!BOT || !chat) { console.log("[member] signal (not configured):", text.replace(/\n/g, " · ")); return; }
  try {
    const r = await fetch(`https://api.telegram.org/bot${BOT}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true }),
    });
    if (!r.ok) console.log("[member] signal failed", r.status, (await r.text()).slice(0, 200));
  } catch (e) { console.log("[member] signal error", (e as Error).message); }
}
const head = (g: Guest) => `/members · ${g.name}\n`;

// ── state ────────────────────────────────────────────────────────────────────
function compute(g: Guest) {
  const now = Date.now();
  if (g.yes_at) return { state: "yes", remaining: 0 };
  if (!g.ended_at) return { state: "video", remaining: WINDOW };
  const closeAt = new Date(g.ended_at).getTime() + WINDOW * 1000;
  if (now <= closeAt) return { state: "window", remaining: Math.max(0, Math.round((closeAt - now) / 1000)) };
  return { state: "closed", remaining: 0 };
}
async function stateOf(g: Guest) {
  const s = compute(g);
  const video = await signVideo(g.video_path || `${g.slug}/video.mp4`);
  return { ok: true, name: g.name, state: s.state, remaining: s.remaining, window: WINDOW, video,
    ended_at: g.ended_at || null, yes_at: g.yes_at || null, tg: (await config()).tg_username || null };
}
async function closeAtIso(g: Guest) { return new Date(new Date(g.ended_at).getTime() + WINDOW * 1000).toISOString(); }

// ── token (header x-member): slug.exp.sig ────────────────────────────────────
async function makeToken(slug: string) {
  const exp = Math.floor(Date.now() / 1000) + TOKEN_DAYS * 86400;
  const p = `${slug}.${exp}`;
  return `${p}.${await hmac(p)}`;
}
async function readToken(req: Request) {
  const t = req.headers.get("x-member") || "";
  const parts = t.split(".");
  if (parts.length !== 3) return null;
  const [slug, exp, sig] = parts;
  if (!same(sig, await hmac(`${slug}.${exp}`))) return null;
  if (Number(exp) < Date.now() / 1000) return null;
  return slug;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return json(405, { ok: false, error: "method_not_allowed" });
  let data: any;
  try { data = await req.json(); } catch { return json(400, { ok: false, error: "bad_json" }); }
  if (data["bot-field"]) return json(200, { ok: true });
  const action = clean(data.action, 20);

  try {
    if (action === "probe") { // diagnostics without secrets: is the signal wired?
      const c = await config();
      let bot: string | null = null;
      if (BOT) { try { const r = await fetch(`https://api.telegram.org/bot${BOT}/getMe`); const d = await r.json(); bot = d?.result?.username || null; } catch { bot = null; } }
      return json(200, { ok: true, bot, chat: !!c.tg_chat_id, tg_username: c.tg_username || null, tz: c.tz || null });
    }

    if (action === "enter") {
      const slug = clean(data.u, 40).toLowerCase();
      const key = clean(data.key, 80).toLowerCase().replace(/\s+/g, " ");
      let g = slug ? await getGuest(slug) : null;
      if (g && g.fail_count >= 6 && g.fail_at && Date.now() - new Date(g.fail_at).getTime() < 60000) {
        await sleep(1500); return json(429, { ok: false, error: "slow_down" });
      }
      const ok = !!(g && key && g.key_hash && same(g.key_hash, await sha(`${slug}:${key}`)));
      if (!ok) {
        if (g) await patchGuest(slug, { fail_count: (g.fail_at && Date.now() - new Date(g.fail_at).getTime() < 60000 ? g.fail_count : 0) + 1, fail_at: new Date().toISOString() });
        await sleep(700); return json(401, { ok: false, error: "wrong_key" });
      }
      const fields: Guest = { fail_count: 0 };
      if (!g!.opened_at) fields.opened_at = new Date().toISOString();
      g = await patchGuest(slug, fields);
      if (fields.opened_at) await notify(head(g!) + "ключ · " + await hhmm(fields.opened_at));
      return json(200, { ok: true, token: await makeToken(slug) });
    }

    const slug = await readToken(req);
    if (!slug) return json(401, { ok: false, error: "no_session" });
    let g = await getGuest(slug);
    if (!g) return json(401, { ok: false, error: "no_guest" });

    // окно закрылось без страницы — сигнал при первом взгляде сервера
    if (compute(g).state === "closed" && !g.closed_notified_at) {
      g = await patchGuest(slug, { closed_notified_at: new Date().toISOString() });
      await notify(head(g) + "окно закрылось · " + await hhmm(await closeAtIso(g)));
    }

    if (action === "state") return json(200, await stateOf(g));

    if (action === "event") {
      const type = clean(data.type, 10);
      const now = new Date().toISOString();
      if (type === "ended" && !g.ended_at) {
        g = await patchGuest(slug, { ended_at: now });
        await notify(head(g) + "видео до конца · " + await hhmm(now) + "\nокно до · " + await hhmm(await closeAtIso(g)));
      } else if (type === "yes" && g.ended_at && !g.yes_at && compute(g).state === "window") {
        g = await patchGuest(slug, { yes_at: now });
        const plus = (new Date(now).getTime() - new Date(g.ended_at).getTime()) / 1000;
        await notify(head(g) + "ДА · " + await hhmm(now) + " (+" + mmss(plus) + ")");
      }
      return json(200, await stateOf(g));
    }
    return json(400, { ok: false, error: "unknown_action" });
  } catch (e) {
    console.log("[member] error", (e as Error).message);
    return json(502, { ok: false, error: "server" });
  }
});
