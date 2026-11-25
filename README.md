# KERA CEILING — გასაჭიმი ჭერების საიტი

Astro (სტატიკური საიტი) + Vanilla TypeScript. ჰოსტინგი: **Cloudflare Pages**.
სერვერული ნაწილი მხოლოდ დამკვეთების შეფასებებს სჭირდება (Pages Functions + D1 ბაზა) — იხ. ქვემოთ „შეფასებები“.

## გაშვება

```bash
npm install
npm run dev      # http://localhost:4321 (ტელეფონიდანაც — Network მისამართით)
npm run build    # საბოლოო ფაილები → dist/
npm run preview  # build-ის შემოწმება
```

> Node: დაყენებულია `astro@7.4.1`, რადგან ახალ ვერსიებს Node ≥ 22.23.4 სჭირდება.
> Node-ის განახლების შემდეგ: `npm install astro@latest`.

## სტრუქტურა

```
src/
  data/
    site.ts        ← კონტაქტები, ნავიგაცია, ენები
    content.ts     ← ყველა ტექსტი (ტიპები, FAQ, პროცესი, პორტფოლიო…)
    prices.json    ← კალკულატორის ფასები (აქ იცვლება მხოლოდ)
  styles/
    tokens.css     ← ფერები, შრიფტი, ზომები, breakpoint-ები
    global.css     ← reset, ღილაკები, ველები, ფოტოს ფლეისჰოლდერი (.ph)
  layouts/BaseLayout.astro
  components/
    Header.astro, Footer.astro, MobileBar.astro, Logo.astro, SectionHeading.astro
    sections/      ← მთავარი გვერდის სექციები
  scripts/calculator.ts   ← კალკულატორის ლოგიკა
  pages/index.astro, 404.astro
  pages/review.astro      ← დამალული შეფასების გვერდი (/review)
functions/api/            ← Cloudflare Pages Functions (შეფასებების API)
server/reviews.ts         ← API-ის საერთო ლოგიკა
migrations/               ← D1 ბაზის სტრუქტურა
wrangler.toml             ← Cloudflare-ის კონფიგურაცია
public/            ← ფოტოები, favicon, ფონტები
```

## TODO (დამკვეთის პასუხების შემდეგ)

- [ ] ლოგო, სახელი, კონტაქტები → `site.ts`
- [ ] რეალური ფასები → `prices.json`
- [ ] ტექსტები, FAQ, შეფასებები → `content.ts`
- [ ] ფოტოები `.ph` ფლეისჰოლდერების ნაცვლად
- [ ] შრიფტი FiraGO (self-host)
- [ ] საკონტაქტო ფორმის დაკავშირება
- [ ] EN / RU ვერსიები
- [ ] ანალიტიკა, Search Console, OG სურათი

## შეფასებები (Cloudflare)

### როგორ მუშაობს

1. სამუშაოს დასრულების შემდეგ კომპანია მომხმარებელს უგზავნის ბმულს: **`https://<დომენი>/review`**.
   საიტზე ამ გვერდზე ბმული არ არის და Google მას არ ინდექსირებს.
2. მომხმარებელი ავსებს ფორმას (ვარსკვლავები, ტექსტი, სახელი, სურვ. ოთახი და უბანი).
3. შეფასება ბაზაში ინახება **„მოლოდინის“** სტატუსით — საიტზე ჯერ არ ჩანს.
4. კომპანიას Telegram-ში მოსდის შეტყობინება ღილაკით „გახსნა და დადასტურება“ → **გამოქვეყნება** ან **უარყოფა**.
5. გამოქვეყნებული შეფასება რამდენიმე წუთში ჩანს მთავარ გვერდზე („რას ამბობენ დამკვეთები“).
   სანამ ერთი შეფასებაც არ არის გამოქვეყნებული, ეს სექცია საიტზე არ ჩანს. 3+ შეფასებისას ჩნდება საშუალო რეიტინგიც.

სარეზერვო მართვის გვერდი (ყველა შეფასება, გამოქვეყნება / მოხსნა): **`https://<დომენი>/api/reviews/admin`** — შესვლა `ADMIN_KEY` პაროლით.

დაცვა: ბოტების ფარული ველი, ძალიან სწრაფი გაგზავნის ბლოკი, ბმულების აკრძალვა ტექსტში,
1 მისამართიდან (IP) საათში მაქს. 3 შეფასება, ხელმოწერილი მოდერაციის ბმულები, და — მთავარი — ხელით დადასტურება.

### პირველადი დაყენება

```bash
npx wrangler login                                  # Cloudflare ანგარიშში შესვლა
npx wrangler d1 create keraceiling-reviews          # ბაზის შექმნა → დააკოპირეთ database_id wrangler.toml-ში
npm run db:migrate:remote                           # ცხრილის შექმნა Cloudflare-ის ბაზაში
```

Cloudflare Dashboard → Workers & Pages → პროექტი → **Settings → Variables and Secrets** (Production):

| სახელი | რა არის |
|---|---|
| `REVIEW_SECRET` | გრძელი შემთხვევითი სტრიქონი (მაგ. `openssl rand -hex 32`). არ შეცვალოთ — ძველი ბმულები გაუქმდება |
| `ADMIN_KEY` | ადმინ-გვერდის პაროლი |
| `TELEGRAM_BOT_TOKEN` | Telegram-ის ბოტის ტოკენი (@BotFather → /newbot) |
| `TELEGRAM_CHAT_ID` | ვისთან მივიდეს შეტყობინება (იხ. ქვემოთ) |

Telegram-ის `CHAT_ID`: მისწერეთ ახალ ბოტს ნებისმიერი შეტყობინება, შემდეგ გახსენით
`https://api.telegram.org/bot<TOKEN>/getUpdates` — `"chat":{"id": …}` არის საჭირო რიცხვი.
ჯგუფში შეტყობინებისთვის: ბოტი დაამატეთ ჯგუფში და იგივე გააკეთეთ (ჯგუფის ID უარყოფითი რიცხვია).

საიტის ატვირთვა: Git რეპოზიტორიის მიერთება Pages-თან (Build command: `npm run build`, Output: `dist`)
ან ხელით: `npm run deploy`. D1 ბაზა პროექტს `wrangler.toml`-იდან უერთდება.

### ლოკალური შემოწმება

```bash
cp .dev.vars.example .dev.vars    # შეავსეთ (Telegram შეგიძლიათ ცარიელი დატოვოთ)
npm run db:migrate:local
npm run cf:dev                    # http://localhost:8788 — საიტი + API + ლოკალური ბაზა
```

`npm run dev` (Astro) API-ს არ უშვებს — იქ შეფასებების სექცია უბრალოდ დამალულია.
