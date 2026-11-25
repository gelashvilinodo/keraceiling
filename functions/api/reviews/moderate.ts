// /api/reviews/moderate
//   GET  ?id&sig — შეფასების ნახვა და დადასტურების ღილაკები (Telegram-ის ბმული აქ მოდის).
//                  GET თავად არაფერს ცვლის — ასე ბმულის წინასწარი ჩატვირთვა (preview) შემთხვევით ვერ გამოაქვეყნებს.
//   POST id, sig, action — სტატუსის შეცვლა (approve / reject)
import {
  type Ctx,
  type ReviewRow,
  page,
  signId,
  safeEqual,
  reviewCard,
} from '../../../server/reviews';

const load = (ctx: Ctx, id: string) =>
  ctx.env.DB.prepare(`SELECT id, name, rating, text, room, district, status, created_at FROM reviews WHERE id = ?`)
    .bind(id)
    .first<ReviewRow>();

async function verified(ctx: Ctx, id: string, sig: string) {
  if (!id || !sig) return false;
  try {
    return safeEqual(sig, await signId(ctx.env, id));
  } catch {
    return false;
  }
}

const notFound = () =>
  page('ბმული არასწორია', `<h1>ბმული არასწორია</h1><p class="muted">შეფასება ვერ მოიძებნა ან ბმული დაზიანებულია.</p>`, 404);

export const onRequestGet = async (ctx: Ctx) => {
  const url = new URL(ctx.request.url);
  const id = url.searchParams.get('id') ?? '';
  const sig = url.searchParams.get('sig') ?? '';
  if (!(await verified(ctx, id, sig))) return notFound();

  const review = await load(ctx, id);
  if (!review) return notFound();

  return page(
    'შეფასების მოდერაცია',
    `<h1>შეფასების მოდერაცია</h1>
     <p class="muted">გამოქვეყნებული შეფასება საიტზე რამდენიმე წუთში გამოჩნდება.</p>
     ${await reviewCard(ctx.env, url.origin, review)}`,
  );
};

export const onRequestPost = async (ctx: Ctx) => {
  const form = await ctx.request.formData();
  const id = String(form.get('id') ?? '');
  const sig = String(form.get('sig') ?? '');
  const action = String(form.get('action') ?? '');
  const fromAdmin = form.get('return') === 'admin';

  if (!(await verified(ctx, id, sig))) return notFound();
  if (action !== 'approve' && action !== 'reject') return notFound();

  const status = action === 'approve' ? 'approved' : 'rejected';
  await ctx.env.DB.prepare(
    `UPDATE reviews SET status = ?, moderated_at = strftime('%Y-%m-%dT%H:%M:%SZ', 'now') WHERE id = ?`,
  )
    .bind(status, id)
    .run();

  const origin = new URL(ctx.request.url).origin;
  if (fromAdmin) return Response.redirect(`${origin}/api/reviews/admin`, 303);

  const review = await load(ctx, id);
  if (!review) return notFound();
  return page(
    status === 'approved' ? 'გამოქვეყნდა' : 'უარყოფილია',
    `<h1>${status === 'approved' ? 'შეფასება გამოქვეყნდა' : 'შეფასება უარყოფილია'}</h1>
     <p class="muted">${status === 'approved' ? 'საიტზე რამდენიმე წუთში გამოჩნდება.' : 'საიტზე არ გამოჩნდება. გადაწყვეტილების შეცვლა ქვემოთ შეგიძლიათ.'}</p>
     ${await reviewCard(ctx.env, origin, review)}`,
  );
};
