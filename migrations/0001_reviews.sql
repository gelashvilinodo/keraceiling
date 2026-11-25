-- დამკვეთების შეფასებები.
-- ახალი შეფასება იწერება status = 'pending' სტატუსით და საიტზე ჩანს მხოლოდ 'approved'-ის შემდეგ.
CREATE TABLE IF NOT EXISTS reviews (
  id          TEXT PRIMARY KEY,
  name        TEXT    NOT NULL,
  rating      INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  text        TEXT    NOT NULL,
  room        TEXT,
  district    TEXT,
  status      TEXT    NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  ip_hash     TEXT,
  created_at  TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  moderated_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created ON reviews (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_ip_created ON reviews (ip_hash, created_at);
