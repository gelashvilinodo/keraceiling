// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  // TODO: შეიცვალოს რეალური დომენით
  site: 'https://example.ge',
  // host: true — საიტი ტელეფონიდანაც გაიხსნება იმავე Wi-Fi ქსელში
  server: { host: true, port: 4321 },
});
