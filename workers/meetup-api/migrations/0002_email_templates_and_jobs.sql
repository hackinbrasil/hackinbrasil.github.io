CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meetup_slug TEXT NOT NULL UNIQUE,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_slug) REFERENCES meetups(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_jobs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  meetup_slug TEXT NOT NULL,
  template_id INTEGER NOT NULL,
  registration_id INTEGER NOT NULL UNIQUE,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  text_body TEXT NOT NULL,
  html_body TEXT NOT NULL,
  send_after TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  resend_email_id TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (meetup_slug) REFERENCES meetups(slug) ON DELETE CASCADE,
  FOREIGN KEY (template_id) REFERENCES email_templates(id) ON DELETE RESTRICT,
  FOREIGN KEY (registration_id) REFERENCES registrations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_email_jobs_status_send_after
ON email_jobs(status, send_after);

INSERT OR IGNORE INTO email_templates (meetup_slug, subject, text_body, html_body)
VALUES (
  'meetup-25-03-2026',
  'Inscrição confirmada - Meetup Hack in Brasil',
  'Olá,\n\nSua inscrição está confirmada! 🚀\n\nEstamos te esperando no Meetup do Hack in Brasil, que acontecerá nesta quarta-feira, dia 25/03/2026.\n\nSerá uma ótima oportunidade para aprender mais sobre hacking e segurança cibernética, além de fazer networking com a galera da área.\n\n📅 Data: 25/03/2026\n🕒 Horário: 19h\n📍 Local: FIAP - Rua Marques de Olinda, 11\n\nPrepare-se para uma noite de muito conteúdo, troca de experiências e conexões valiosas em Ciber Segurança.\n\nNos vemos lá!\n\nAbraços,\nEquipe Hack in Brasil',
  '<p>Olá,</p><p>Sua inscrição está confirmada! 🚀</p><p>Estamos te esperando no Meetup do Hack in Brasil, que acontecerá nesta quarta-feira, dia 25/03/2026.</p><p>Será uma ótima oportunidade para aprender mais sobre hacking e segurança cibernética, além de fazer networking com a galera da área.</p><p>📅 Data: 25/03/2026<br>🕒 Horário: 19h<br>📍 Local: FIAP - Rua Marques de Olinda, 11</p><p>Prepare-se para uma noite de muito conteúdo, troca de experiências e conexões valiosas em Ciber Segurança.</p><p>Nos vemos lá!</p><p>Abraços,<br>Equipe Hack in Brasil</p>'
);

INSERT OR IGNORE INTO email_jobs (
  meetup_slug,
  template_id,
  registration_id,
  recipient_name,
  recipient_email,
  subject,
  text_body,
  html_body,
  send_after,
  status
)
SELECT
  r.meetup_slug,
  t.id,
  r.id,
  r.name,
  r.email,
  t.subject,
  t.text_body,
  t.html_body,
  CURRENT_TIMESTAMP,
  'pending'
FROM registrations r
JOIN email_templates t ON t.meetup_slug = r.meetup_slug
LEFT JOIN email_jobs j ON j.registration_id = r.id
WHERE j.id IS NULL;
