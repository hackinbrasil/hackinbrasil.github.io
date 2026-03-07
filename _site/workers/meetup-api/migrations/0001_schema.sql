CREATE TABLE IF NOT EXISTS meetups (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  event_date TEXT NOT NULL,
  capacity INTEGER NOT NULL CHECK (capacity > 0),
  registrations_count INTEGER NOT NULL DEFAULT 0 CHECK (registrations_count >= 0),
  is_open INTEGER NOT NULL DEFAULT 1 CHECK (is_open IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meetup_slug TEXT NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  document_encrypted TEXT NOT NULL,
  document_last4 TEXT NOT NULL,
  consent_lgpd INTEGER NOT NULL CHECK (consent_lgpd IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_slug) REFERENCES meetups(slug) ON DELETE CASCADE,
  UNIQUE (meetup_slug, email)
);

CREATE INDEX IF NOT EXISTS idx_registrations_meetup_slug ON registrations(meetup_slug);

INSERT OR IGNORE INTO meetups (slug, title, event_date, capacity, is_open)
VALUES (
  'meetup-25-03-2026',
  'Meetup de Cibersegurança - 25/03/2026',
  '2026-03-25T19:00:00-03:00',
  120,
  1
);
