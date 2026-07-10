-- The meetup-03-09-2026 row was created in migration 0006 without a matching email
-- template, so handleRegister never queued confirmation emails for it. Add the template
-- (fixes future registrations) and backfill jobs for attendees already registered.

INSERT OR IGNORE INTO email_templates (meetup_slug, subject, text_body, html_body)
VALUES (
  'meetup-03-09-2026',
  'Inscrição confirmada - Meetup Hack in Brasil',
  'Olá,\n\nSua inscrição está confirmada! 🚀\n\nEstamos te esperando no Meetup do Hack in Brasil, que acontecerá nesta quinta-feira, dia 03/09/2026.\n\nSerá uma ótima oportunidade para aprender mais sobre hacking e segurança cibernética, além de fazer networking com a galera da área.\n\n📅 Data: 03/09/2026\n🕒 Horário: 18h50 às 21h50\n📍 Local: FIAP - Rua Marques de Olinda, 11\n\nPrepare-se para uma noite de muito conteúdo, troca de experiências e conexões valiosas em Ciber Segurança.\n\nNos vemos lá!\n\nAbraços,\nEquipe Hack in Brasil',
  '<p>Olá,</p><p>Sua inscrição está confirmada! 🚀</p><p>Estamos te esperando no Meetup do Hack in Brasil, que acontecerá nesta quinta-feira, dia 03/09/2026.</p><p>Será uma ótima oportunidade para aprender mais sobre hacking e segurança cibernética, além de fazer networking com a galera da área.</p><p>📅 Data: 03/09/2026<br>🕒 Horário: 18h50 às 21h50<br>📍 Local: FIAP - Rua Marques de Olinda, 11</p><p>Prepare-se para uma noite de muito conteúdo, troca de experiências e conexões valiosas em Ciber Segurança.</p><p>Nos vemos lá!</p><p>Abraços,<br>Equipe Hack in Brasil</p>'
);

-- Queue a confirmation email for every registration of this meetup that does not already
-- have a job. LEFT JOIN ... IS NULL keeps this idempotent (registration_id is UNIQUE in
-- email_jobs), and send_after = now means they go out on the next cron run.
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
WHERE r.meetup_slug = 'meetup-03-09-2026'
  AND j.id IS NULL;
