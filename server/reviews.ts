// შეფასებების საერთო ლოგიკა Cloudflare Pages Functions-ისთვის (functions/api/reviews*).
// ცალკე საქაღალდეშია, რომ Pages-მა ეს ფაილი მარშრუტად (route) არ ჩათვალოს.

// ---------- Cloudflare-ის მინიმალური ტიპები (დამოკიდებულების გარეშე) ----------
export interface D1Result<T> { results: T[] }
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}
export interface D1Database { prepare(query: string): D1PreparedStatement }

export interface Env {
  DB: D1Database;
  REVIEW_SECRET?: string;
  ADMIN_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
}

export interface Ctx {
  request: Request;
  env: Env;
  waitUntil(p: Promise<unknown>): void;
}

export type Status = 'pending' | 'approved' | 'rejected';

export interface ReviewRow {
  id: string;
  name: string;
  rating: number;
  text: string;
  room: string | null;
  district: string | null;
  status: Status;
  created_at: string;
}

// ---------- წესები ----------
export const ROOMS = ['მისაღები', 'საძინებელი', 'სამზარეულო', 'აბაზანა', 'საბავშვო', 'დერეფანი', 'ოფისი', 'სხვა'];
export const LIMITS = { name: [2, 60], text: [10, 1000], district: [0, 60] } as const;
/** ერთი მისამართიდან (IP) საათში მაქსიმუმ ამდენი შეფასება */
export const MAX_PER_HOUR = 3;
/** ფორმის გახსნიდან გაგზავნამდე მინიმალური დრო (წმ) — ბოტები უფრო სწრაფად აგზავნიან */
export const MIN_FILL_SECONDS = 4;

// ---------- პასუხები ----------
export const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'x-robots-tag': 'noindex', ...headers },
  });

export const esc = (s: unknown) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n);

/** მარტივი HTML გვერდი მოდერაციისთვის (საიტის სტილში, გარე ფაილების გარეშე) */
export const page = (title: string, body: string, status = 200) =>
  new Response(
    `<!doctype html><html lang="ka"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow"><title>${esc(title)} — KERA</title>
<style>
  *{box-sizing:border-box;margin:0}
  body{font-family:'Noto Sans Georgian',system-ui,sans-serif;background:#f4f4f2;color:#0e0e0e;line-height:1.6;padding:24px 16px}
  main{max-width:720px;margin:0 auto;display:grid;gap:20px}
  h1{font-weight:300;font-size:1.75rem;line-height:1.2}
  .muted{color:#6b6b6b;font-size:.875rem}
  .card{background:#fff;border:1px solid #d9d9d6;padding:20px;display:grid;gap:10px}
  .card--pending{border-left:3px solid #c9a86f}.card--approved{border-left:3px solid #2f7d4f}.card--rejected{opacity:.55}
  .stars{letter-spacing:.15em}
  .row{display:flex;flex-wrap:wrap;gap:8px}
  button,input{font:inherit}
  input[type=password]{width:100%;min-height:44px;padding:0 12px;border:1px solid #0e0e0e;background:#fff}
  .btn{min-height:44px;padding:0 18px;border:1px solid #0e0e0e;background:#0e0e0e;color:#f4f4f2;cursor:pointer}
  .btn--ghost{background:transparent;color:#0e0e0e}
  .tag{font-size:.75rem;letter-spacing:.06em;text-transform:uppercase}
  form{display:inline}
</style></head><body><main>${body}</main></body></html>`,
    { status, headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex', 'cache-control': 'no-store' } },
  );

// ---------- კრიპტოგრაფია ----------
const enc = new TextEncoder();
const toHex = (buf: ArrayBuffer) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');

export async function hmac(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return toHex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

/** მუდმივი დროის შედარება (timing-attack-ისგან დასაცავად) */
export function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** ხელმოწერა მოდერაციის ბმულისთვის: მხოლოდ ის ცვლის სტატუსს, ვისაც ეს ბმული აქვს */
export const signId = (env: Env, id: string) => hmac(requireSecret(env), `review:${id}`);

export function requireSecret(env: Env) {
  if (!env.REVIEW_SECRET || env.REVIEW_SECRET.length < 16) {
    throw new Error('REVIEW_SECRET is not configured (min 16 chars)');
  }
  return env.REVIEW_SECRET;
}

export async function moderationUrl(env: Env, origin: string, id: string) {
  const sig = await signId(env, id);
  return `${origin}/api/reviews/moderate?id=${encodeURIComponent(id)}&sig=${sig}`;
}

// ---------- ვალიდაცია ----------
const clean = (v: unknown) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

export type Parsed =
  | { ok: true; data: { name: string; rating: number; text: string; room: string | null; district: string | null } }
  | { ok: false; error: string; field?: string };

export function parseReview(body: Record<string, unknown>): Parsed {
  const name = clean(body.name);
  const text = clean(body.text);
  const district = clean(body.district);
  const roomRaw = clean(body.room);
  const rating = Number(body.rating);

  if (name.length < LIMITS.name[0] || name.length > LIMITS.name[1])
    return { ok: false, field: 'name', error: 'გთხოვთ, მიუთითოთ სახელი (2–60 სიმბოლო).' };
  if (!Number.isInteger(rating) || rating < 1 || rating > 5)
    return { ok: false, field: 'rating', error: 'გთხოვთ, აირჩიოთ შეფასება (1–5 ვარსკვლავი).' };
  if (text.length < LIMITS.text[0] || text.length > LIMITS.text[1])
    return { ok: false, field: 'text', error: 'შეფასების ტექსტი უნდა იყოს 10–1000 სიმბოლო.' };
  if (district.length > LIMITS.district[1])
    return { ok: false, field: 'district', error: 'უბნის სახელი ძალიან გრძელია.' };
  if (/https?:\/\/|www\./i.test(text + name))
    return { ok: false, field: 'text', error: 'გთხოვთ, შეფასებაში ბმულები არ ჩაწეროთ.' };

  const room = ROOMS.includes(roomRaw) ? roomRaw : null;
  return { ok: true, data: { name, rating, text, room, district: district || null } };
}

// ---------- Telegram ----------
export async function notifyTelegram(env: Env, review: ReviewRow, link: string) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;
  const lines = [
    '<b>ახალი შეფასება საიტზე</b>',
    '',
    `${stars(review.rating)}  <b>${esc(review.name)}</b>`,
    [review.room, review.district].filter(Boolean).map(esc).join(' · '),
    '',
    esc(review.text),
  ].filter((l, i, a) => !(l === '' && a[i - 1] === ''));

  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text: lines.join('\n'),
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      reply_markup: { inline_keyboard: [[{ text: 'გახსნა და დადასტურება', url: link }]] },
    }),
  }).catch(() => {});
}

// ---------- მოდერაციის ბარათი (HTML) ----------
export async function reviewCard(env: Env, origin: string, r: ReviewRow, opts: { fromAdmin?: boolean } = {}) {
  const sig = await signId(env, r.id);
  const label = { pending: 'მოლოდინში', approved: 'გამოქვეყნებულია', rejected: 'უარყოფილია' }[r.status];
  const meta = [r.room, r.district, r.created_at.slice(0, 10)].filter(Boolean).map(esc).join(' · ');
  const button = (action: 'approve' | 'reject', text: string, ghost = false) => `
    <form method="post" action="${origin}/api/reviews/moderate">
      <input type="hidden" name="id" value="${esc(r.id)}"><input type="hidden" name="sig" value="${sig}">
      <input type="hidden" name="action" value="${action}">
      ${opts.fromAdmin ? `<input type="hidden" name="return" value="admin">` : ''}
      <button class="btn${ghost ? ' btn--ghost' : ''}" type="submit">${text}</button>
    </form>`;
  const actions =
    r.status === 'approved'
      ? button('reject', 'საიტიდან მოხსნა', true)
      : r.status === 'rejected'
        ? button('approve', 'მაინც გამოქვეყნება', true)
        : button('approve', 'გამოქვეყნება') + button('reject', 'უარყოფა', true);
  return `<article class="card card--${r.status}">
    <p class="tag muted">${label}</p>
    <p class="stars">${stars(r.rating)}</p>
    <p><b>${esc(r.name)}</b></p>
    <p style="white-space:pre-line">${esc(r.text)}</p>
    <p class="muted">${meta}</p>
    <div class="row">${actions}</div>
  </article>`;
}

// ---------- ადმინის სესია (cookie) ----------
export const ADMIN_COOKIE = 'kera_admin';

export const adminToken = (env: Env) => hmac(requireSecret(env), `admin:${env.ADMIN_KEY ?? ''}`);

export async function isAdmin(env: Env, request: Request) {
  if (!env.ADMIN_KEY) return false;
  const cookie = request.headers.get('cookie') ?? '';
  const value = cookie.split(/;\s*/).find((c) => c.startsWith(`${ADMIN_COOKIE}=`))?.slice(ADMIN_COOKIE.length + 1);
  return !!value && safeEqual(value, await adminToken(env));
}

export const adminCookie = (token: string, maxAge = 60 * 60 * 8) =>
  `${ADMIN_COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
