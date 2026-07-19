ALTER TABLE registrations ADD COLUMN document_hash TEXT;
ALTER TABLE registrations ADD COLUMN phone_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_meetup_document_hash
ON registrations(meetup_slug, document_hash);

CREATE UNIQUE INDEX IF NOT EXISTS idx_registrations_meetup_phone_hash
ON registrations(meetup_slug, phone_hash);
