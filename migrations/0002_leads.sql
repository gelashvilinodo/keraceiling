-- საკონტაქტო ფორმის მოთხოვნები (უფასო კონსულტაცია).
-- ფორმა ჯერ აქ ინახავს მოთხოვნას, შემდეგ მომხმარებელს WhatsApp-ს უხსნის —
-- ასე მოთხოვნა არ იკარგება, თუნდაც WhatsApp-ში „გაგზავნას“ არ დააჭიროს.
CREATE TABLE IF NOT EXISTS leads (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  phone       TEXT NOT NULL,
  message     TEXT,
  status      TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'done')),
  ip_hash     TEXT,
  created_at  TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  handled_at  TEXT
);

CREATE INDEX IF NOT EXISTS idx_leads_status_created ON leads (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_ip_created ON leads (ip_hash, created_at);
