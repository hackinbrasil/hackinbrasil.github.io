-- Sponsorship enquiries submitted from the native "Quero patrocinar" page.
-- Replaces the external Airtable form. Business contact data (company, work
-- email/phone), so it is stored in plaintext — unlike the attendee CPF/phone,
-- which stay encrypted. The team is notified by e-mail on each submission.
CREATE TABLE IF NOT EXISTS sponsor_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  company TEXT NOT NULL,
  website TEXT,
  contact_name TEXT NOT NULL,
  role TEXT,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_sponsor_requests_created_at
ON sponsor_requests(created_at);
