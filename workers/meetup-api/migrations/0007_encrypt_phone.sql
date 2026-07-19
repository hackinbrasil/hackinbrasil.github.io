ALTER TABLE registrations ADD COLUMN phone_encrypted TEXT;
ALTER TABLE registrations DROP COLUMN phone;
