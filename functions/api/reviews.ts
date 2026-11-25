// /api/reviews
//   GET  — გამოქვეყნებული შეფასებები საიტისთვის
//   POST — ახალი შეფასება დამალული გვერდიდან (/review); ინახება „მოლოდინის“ სტატუსით
import {
  type Ctx,
  type ReviewRow,
  json,
  hmac,
  parseReview,
  requireSecret,
  moderationUrl,
  notifyTelegram,
  MAX_PER_HOUR,
  MIN_FILL_SECONDS,
} from '../../server/reviews';

export const onRequestGet = async ({ env }: Ctx) => {
  const { results } = await env.DB.prepare(
    `SELECT name, rating, text, room, district, created_at
       FROM reviews WHERE status = 'approved'
      ORDER BY created_at DESC LIMIT 60`,
  ).all<Pick<ReviewRow, 'name' | 'rating' | 'text' | 'room' | 'district' | 'created_at'>>();

  const count = results.length;
  const average = count ? Math.round((results.reduce((s, r) => s + r.rating, 0) / count) * 10) / 10 : 0;

  return json(
    {
      count,
      average,
      reviews: results.map((r) => ({
        name: r.name,
        rating: r.rating,
        text: r.text,
        room: r.room,
        district: r.district,
        date: r.created_at.slice(0, 10),
      })),
    },
    200,
    // ბრაუზერი 1 წთ, Cloudflare-ის ქეში 5 წთ — დადასტურების შემდეგ რამდენიმე წუთში ჩანს
    { 'cache-control': 'public, max-age=60, s-maxage=300' },
  );
};

export const onRequestPost = async ({ request, env, waitUntil }: Ctx) => {
  let body: Record<string, unknown>;
  try {
    const type = request.headers.get('content-type') ?? '';
    body = type.includes('application/json')
      ? await request.json()
      : Object.fromEntries((await request.formData()).entries());
  } catch {
    return json({ ok: false, error: 'მოთხოვნა ვერ წავიკითხეთ.' }, 400);
  }

  // ბოტებისგან დაცვა: ფარული ველი უნდა იყოს ცარიელი და ფორმა ზედმეტად სწრაფად არ უნდა გაიგზავნოს.
  // ბოტს „წარმატებას“ ვუბრუნებთ, რომ არ მიხვდეს, რატომ ვერ გაიარა.
  const openedAt = Number(body.t);
  const tooFast = !Number.isFinite(openedAt) || Date.now() - openedAt < MIN_FILL_SECONDS * 1000;
  if (String(body.website ?? '').trim() !== '' || tooFast) return json({ ok: true });

  const parsed = parseReview(body);
  if (!parsed.ok) return json({ ok: false, error: parsed.error, field: parsed.field }, 422);

  let secret: string;
  try {
    secret = requireSecret(env);
  } catch {
    return json({ ok: false, error: 'სერვისი დროებით მიუწვდომელია. სცადეთ მოგვიანებით.' }, 503);
  }

  // სიხშირის შეზღუდვა IP-ის ჰეშით (თავად IP არ ინახება)
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  const ipHash = await hmac(secret, `ip:${ip}`);
  const recent = await env.DB.prepare(
    `SELECT COUNT(*) AS n FROM reviews WHERE ip_hash = ? AND created_at > strftime('%Y-%m-%dT%H:%M:%SZ', 'now', '-1 hour')`,
  )
    .bind(ipHash)
    .first<{ n: number }>();
  if ((recent?.n ?? 0) >= MAX_PER_HOUR) {
    return json({ ok: false, error: 'ძალიან ბევრი მცდელობაა. გთხოვთ, სცადეთ მოგვიანებით.' }, 429);
  }

  const id = crypto.randomUUID();
  const { name, rating, text, room, district } = parsed.data;
  await env.DB.prepare(
    `INSERT INTO reviews (id, name, rating, text, room, district, status, ip_hash) VALUES (?, ?, ?, ?, ?, ?, 'pending', ?)`,
  )
    .bind(id, name, rating, text, room, district, ipHash)
    .run();

  const row: ReviewRow = { id, name, rating, text, room, district, status: 'pending', created_at: new Date().toISOString() };
  const origin = new URL(request.url).origin;
  waitUntil(moderationUrl(env, origin, id).then((link) => notifyTelegram(env, row, link)));

  return json({ ok: true });
};
