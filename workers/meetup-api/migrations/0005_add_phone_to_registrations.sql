-- Collect the attendee phone number (WhatsApp) starting with the 03/09/2026 meetup.
-- Stored in E.164 format, e.g. +5511912345678. Nullable so existing rows remain valid.
ALTER TABLE registrations ADD COLUMN phone TEXT;
