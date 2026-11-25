// Cloudflare Worker — საიტის შესასვლელი წერტილი.
// საიტის ფაილები (dist/) Cloudflare-ის static assets-იდან ემსახურება პირდაპირ.
// ეს Worker მხოლოდ /api/* მოთხოვნებს იღებს (wrangler.toml → run_worker_first).
import type { Ctx, Env as ReviewsEnv } from '../server/reviews';
import * as reviews from '../server/api/reviews';
import * as moderate from '../server/api/moderate';
import * as admin from '../server/api/admin';
import * as leads from '../server/api/leads';

interface Env extends ReviewsEnv {
  ASSETS: { fetch(request: Request): Promise<Response> };
}

interface ExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
}

type Handler = (ctx: Ctx) => Promise<Response> | Response;
type Route = { onRequestGet?: Handler; onRequestPost?: Handler };

const routes: Record<string, Route> = {
  '/api/reviews': reviews,
  '/api/reviews/moderate': moderate,
  '/api/reviews/admin': admin,
  '/api/leads': { onRequestPost: leads.onRequestPost },
  '/api/leads/status': { onRequestPost: leads.onStatusPost },
};

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '') || '/';
    const route = routes[path];

    // API-ს გარეთ — ჩვეულებრივი საიტის ფაილები
    if (!route) return env.ASSETS.fetch(request);

    const handler =
      request.method === 'GET' || request.method === 'HEAD'
        ? route.onRequestGet
        : request.method === 'POST'
          ? route.onRequestPost
          : undefined;

    if (!handler) {
      return new Response('Method Not Allowed', {
        status: 405,
        headers: { allow: [route.onRequestGet && 'GET', route.onRequestPost && 'POST'].filter(Boolean).join(', ') },
      });
    }

    try {
      return await handler({ request, env, waitUntil: (p) => ctx.waitUntil(p) });
    } catch (err) {
      console.error('API error', path, err);
      return new Response(JSON.stringify({ ok: false, error: 'სერვერის შეცდომა. სცადეთ მოგვიანებით.' }), {
        status: 500,
        headers: { 'content-type': 'application/json; charset=utf-8' },
      });
    }
  },
};
