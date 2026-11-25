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
  esc,
} from '../reviews';
import { signLead } from './leads';

type LeadRow = { id: string; name: string; phone: string; message: string | null; status: 'new' | 'done'; created_at: string };

/** ქართული ნომერი WhatsApp-ის ბმულისთვის: 5XX XX XX XX → 9955XXXXXXXX */
const waNumber = (phone: string) => {
  const d = phone.replace(/\D/g, '');
  return d.length === 9 && d.startsWith('5') ? `995${d}` : d;
};

/** თბილისის დრო (UTC+4) მოკლედ: 25.11 19:40 */
const tbilisiTime = (iso: string) => {
  const t = new Date(new Date(iso).getTime() + 4 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(t.getUTCDate())}.${p(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${p(t.getUTCHours())}:${p(t.getUTCMinutes())}`;
};

async function leadCard(env: Ctx['env'], origin: string, l: LeadRow) {
  const sig = await signLead(env, l.id);
  const next = l.status === 'new' ? 'done' : 'new';
  return `<article class="card card--${l.status === 'new' ? 'pending' : 'approved'}">
    <p class="tag muted">${l.status === 'new' ? 'ახალი' : 'დამუშავებულია'} · ${tbilisiTime(l.created_at)}</p>
    <p><b>${esc(l.name)}</b></p>
    <p class="row">
      <a class="btn btn--ghost" style="display:inline-grid;place-items:center;text-decoration:none" href="tel:${esc(l.phone.replace(/[^+\d]/g, ''))}">${esc(l.phone)}</a>
      <a class="btn btn--ghost" style="display:inline-grid;place-items:center;text-decoration:none" href="https://wa.me/${waNumber(l.phone)}" target="_blank" rel="noopener">WhatsApp</a>
    </p>
    ${l.message ? `<p style="white-space:pre-line">${esc(l.message)}</p>` : ''}
    <div class="row">
      <form method="post" action="${origin}/api/leads/status">
        <input type="hidden" name="id" value="${esc(l.id)}"><input type="hidden" name="sig" value="${sig}">
        <input type="hidden" name="status" value="${next}">
        <button class="btn${l.status === 'new' ? '' : ' btn--ghost'}" type="submit">${l.status === 'new' ? 'დამუშავებულია ✓' : 'დაბრუნება ახლებში'}</button>
      </form>
    </div>
  </article>`;
}

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

  const { results: leads } = await ctx.env.DB.prepare(
    `SELECT id, name, phone, message, status, created_at FROM leads
      ORDER BY CASE status WHEN 'new' THEN 0 ELSE 1 END, created_at DESC LIMIT 200`,
  ).all<LeadRow>();
  const newLeads = leads.filter((l) => l.status === 'new').length;
  const leadCards = await Promise.all(leads.map((l) => leadCard(ctx.env, origin, l)));

  return page(
    'მართვა',
    `<h1>კონსულტაციის მოთხოვნები</h1>
     <p class="muted">სულ ${leads.length} · ახალი ${newLeads}</p>
     ${leadCards.join('') || '<p class="muted">მოთხოვნები ჯერ არ არის.</p>'}
     <h1 style="margin-top:24px">შეფასებები</h1>
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
