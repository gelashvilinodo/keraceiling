// ==========================================================
// კომპანიის საკონტაქტო ინფორმაცია — TODO: ყველაფერი ფლეისჰოლდერია,
// ჩანაცვლდება დამკვეთის პასუხების შემდეგ (კითხვარი, ბლოკი „ი“).
// ==========================================================

export const site = {
  name: 'KERA',
  nameSuffix: 'CEILING',
  tagline: 'გასაჭიმი ჭერები',
  description:
    'გასაჭიმი ჭერების მონტაჟი 1 დღეში. უფასო კონსულტაცია, გარანტია, ფასის ონლაინ კალკულატორი.',
  phone: '+995 5XX XX XX XX',
  phoneHref: 'tel:+995500000000',
  whatsapp: '995500000000', // მხოლოდ ციფრები, „+“-ის გარეშე
  viber: 'viber://chat?number=%2B995500000000',
  address: 'თბილისი',
  hours: 'ორშ–შაბ · 10:00–19:00',
  area: 'თბილისი და მიმდებარე რეგიონები',
  socials: [
    { label: 'Facebook', href: '#' },
    { label: 'Instagram', href: '#' },
    { label: 'TikTok', href: '#' },
  ],
  languages: [
    { code: 'ka', label: 'ქარ', href: '/' },
    { code: 'en', label: 'EN', href: '#' },
    { code: 'ru', label: 'RU', href: '#' },
  ],
};

export const whatsappLink = (text = '') =>
  `https://wa.me/${site.whatsapp}${text ? `?text=${encodeURIComponent(text)}` : ''}`;

export const nav = [
  { label: 'ტიპები', href: '#types' },
  { label: 'განათება', href: '#lighting' },
  { label: 'კალკულატორი', href: '#calculator' },
  { label: 'ნამუშევრები', href: '#portfolio' },
  { label: 'პროცესი', href: '#process' },
  { label: 'კითხვები', href: '#faq' },
  { label: 'კონტაქტი', href: '#contact' },
];
