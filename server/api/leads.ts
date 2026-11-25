// /api/leads
//   POST — საკონტაქტო ფორმის მოთხოვნა (სახელი, ტელეფონი, კომენტარი). ინახება ბაზაში;
//          WhatsApp-ს მომხმარებლის ბრაუზერი ხსნის (Contact.astro).
// /api/leads/status
//   POST id, sig, status — მოთხოვნის მონიშვნა „დამუშავებულად“ ადმინ-გვერდიდან.
import { type Ctx, json, hmac, requireSecret, safeEqual, isAdmin } from '../reviews';

/** ერთი მისამართიდან (IP) საათში მაქსიმუმ ამდენი მოთხოვნა */
const MAX_PER_HOUR = 5;
const MIN_FILL_SECONDS = 2;

const clean = (v: unknown, max: number) =>
  String(v ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+/g, ' ')
    .trim()
    .slice(0, max);

export const signLead = async (env: Ctx['env'], id: string) => hmac(requireSecret(env), `lead:${id}`);

export const onRequestPost = async ({ request, env }: Ctx) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'მოთხოვნა ვერ წავიკითხეთ.' }, 400);
  }

  // ბოტებისგან დაცვა (ბოტს „წარმატებას“ ვუბრუნებთ)
  const openedAt = Number(body.t);
  const tooFast = !Number.isFinite(openedAt) || Date.now() - openedAt < MIN_FILL_SECONDS * 1000;
  if (String(body.website ?? '').trim() !== '' || tooFast) return json({ ok: true });

  const name = clean(body.name, 60);
  const phone = clean(body.phone, 30);
  const message = clean(body.message, 1000);
  const digits = phone.replace(/\D/g, '');

  if (name.length < 2) return json({ ok: false, field: 'name', error: 'გთხოვთ, მიუთითოთ სახელი.' }, 422);
  if (digits.length < 9 || digits.length > 15 || !/^[+\d\s()-]+$/.test(phone))
    return json({ ok: false, field: 'phone', error: 'გთხოვთ, მიუთითოთ სწორი ტელეფონის ნომერი.' }, 422);

  let secret: string;
  try {
    secret = requireSecret(env);
  } catch {
    return json({ ok: false, error: 'სერვისი დროებით მიუწვდომელია.' }, 503);
  }

  const ipHash = await hmac(secret, `ip:${request.headers.get('cf-connecting-ip') ?? 'unknown'}`);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM leads WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')`,
  )
    .bind(ipHash)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return json({ ok: false, error: 'ძალიან ბევრი მცდელობაა. სცადეთ მოგვიანებით.' }, 429);
  }

  await env.DB.prepare(`INSERT INTO leads (id, name, phone, message, ip_hash) VALUES (?, ?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), name, phone, message || null, ipHash)
    .run();

  return json({ ok: true });
};

/** ადმინ-გვერდიდან: მოთხოვნის სტატუსის შეცვლა (new ↔ done) */
export const onStatusPost = async (ctx: Ctx) => {
  const origin = new URL(ctx.request.url).origin;
  if (!(await isAdmin(ctx.env, ctx.request))) return Response.redirect(`${origin}/api/reviews/admin`, 303);

  const form = await ctx.request.formData();
  const id = String(form.get('id') ?? '');
  const sig = String(form.get('sig') ?? '');
  const status = String(form.get('status') ?? '');
  if (!id || !sig || (status !== 'new' && status !== 'done')) return Response.redirect(`${origin}/api/reviews/admin`, 303);
  if (!safeEqual(sig, await signLead(ctx.env, id))) return Response.redirect(`${origin}/api/reviews/admin`, 303);

  await ctx.env.DB.prepare(
    `UPDATE leads SET status = ?, handled_at = CASE WHEN ? = 'done' THEN strftime('%Y-%m-%dT%H:%M:%SZ', 'now') ELSE NULL END WHERE id = ?`,
  )
    .bind(status, status, id)
    .run();

  return Response.redirect(`${origin}/api/reviews/admin`, 303);
};
