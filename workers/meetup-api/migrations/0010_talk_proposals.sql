CREATE TABLE IF NOT EXISTS talk_proposals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  abstract TEXT NOT NULL,
  speaker_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  photo_url TEXT NOT NULL,
  bio TEXT NOT NULL,
  in_person INTEGER NOT NULL CHECK (in_person IN (0, 1)),
  image_consent INTEGER NOT NULL CHECK (image_consent IN (0, 1)),
  terms_ack INTEGER NOT NULL CHECK (terms_ack IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_talk_proposals_created_at
ON talk_proposals(created_at);
