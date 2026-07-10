-- Encrypt the attendee phone number at rest, using the same AES-GCM scheme as the CPF.
-- Replaces the plaintext `phone` column added in migration 0005. That column is still
-- empty (no phone data has been written yet), so dropping it is safe.
ALTER TABLE registrations ADD COLUMN phone_encrypted TEXT;
ALTER TABLE registrations DROP COLUMN phone;
