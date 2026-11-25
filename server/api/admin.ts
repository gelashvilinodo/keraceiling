// /api/reviews/admin — ყველა შეფასების სია და მოდერაცია პაროლით (ADMIN_KEY).
// სარეზერვო გზაა, თუ Telegram-ის შეტყობინებები არ არის დაყენებული ან შეტყობინება დაიკარგა.
import {
  type Ctx,
  type ReviewRow,
  page,
  safeEqual,
  isAdmin,
  adminToken,
  adminCookie,
  reviewCard,
} from '../reviews';

const loginForm = (error = '') =>
  page(
    'შესვლა',
    `<h1>შეფასებები — შესვლა</h1>
     ${error ? `<p style="color:#a3362b">${error}</p>` : ''}
     <form method="post" class="card" style="display:grid">
       <label for="key">პაროლი</label>
       <input id="key" name="key" type="password" autocomplete="current-password" required>
       <button class="btn" type="submit">შესვლა</button>
     </form>`,
    error ? 401 : 200,
  );

async function list(ctx: Ctx) {
  const origin = new URL(ctx.request.url).origin;
  const { results } = await ctx.env.DB.prepare(
    `SELECT id, name, rating, text, room, district, status, created_at FROM reviews
      ORDER BY CASE status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, created_at DESC
      LIMIT 200`,
  ).all<ReviewRow>();

  const pending = results.filter((r) => r.status === 'pending').length;
  const cards = await Promise.all(results.map((r) => reviewCard(ctx.env, origin, r, { fromAdmin: true })));

  return page(
    'შეფასებები',
    `<h1>შეფასებები</h1>
     <p class="muted">სულ ${results.length} · მოლოდინში ${pending}</p>
     ${cards.join('') || '<p class="muted">შეფასებები ჯერ არ არის.</p>'}
     <form method="post"><input type="hidden" name="logout" value="1"><button class="btn btn--ghost" type="submit">გასვლა</button></form>`,
  );
}

export const onRequestGet = async (ctx: Ctx) => {
  if (!ctx.env.ADMIN_KEY) return page('გამორთულია', '<h1>ადმინ-გვერდი გამორთულია</h1><p class="muted">დააყენეთ ADMIN_KEY.</p>', 404);
  return (await isAdmin(ctx.env, ctx.request)) ? list(ctx) : loginForm();
};

export const onRequestPost = async (ctx: Ctx) => {
  if (!ctx.env.ADMIN_KEY) return page('გამორთულია', '<h1>ადმინ-გვერდი გამორთულია</h1>', 404);
  const form = await ctx.request.formData();

  if (form.get('logout')) {
    return new Response(null, {
      status: 303,
      headers: { location: '/api/reviews/admin', 'set-cookie': adminCookie('', 0) },
    });
  }

  const key = String(form.get('key') ?? '');
  if (!safeEqual(key, ctx.env.ADMIN_KEY)) {
    // მცდელობების შენელება პაროლის გამოცნობის წინააღმდეგ
    await new Promise((r) => setTimeout(r, 800));
    return loginForm('პაროლი არასწორია.');
  }

  return new Response(null, {
    status: 303,
    headers: { location: '/api/reviews/admin', 'set-cookie': adminCookie(await adminToken(ctx.env)) },
  });
};
