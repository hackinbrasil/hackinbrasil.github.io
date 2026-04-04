INSERT OR IGNORE INTO meetups (slug, title, event_date, capacity, is_open)
VALUES (
  'meetup-25-04-2026',
  'Meetup de Cibersegurança - 25/04/2026',
  '2026-04-25T10:00:00-03:00',
  120,
  1
);

INSERT OR IGNORE INTO email_templates (meetup_slug, subject, text_body, html_body)
VALUES (
  'meetup-25-04-2026',
  'Inscrição confirmada - Meetup Hack in Brasil',
  'Olá,\n\nSua inscrição está confirmada! 🚀\n\nEstamos te esperando no Meetup do Hack in Brasil, que acontecerá no sábado, dia 25/04/2026.\n\nSerá uma ótima oportunidade para aprender sobre segurança cibernética e fazer networking com a comunidade.\n\n📅 Data: 25/04/2026\n🕒 Horário: 10h às 13h\n📍 Local: Colégio Niterói - R. Vereador José Vicente Sobrinho, 269 - Barreto, Niterói - RJ\n\nNos vemos lá!\n\nAbraços,\nEquipe Hack in Brasil',
  '<p>Olá,</p><p>Sua inscrição está confirmada! 🚀</p><p>Estamos te esperando no Meetup do Hack in Brasil, que acontecerá no sábado, dia 25/04/2026.</p><p>Será uma ótima oportunidade para aprender sobre segurança cibernética e fazer networking com a comunidade.</p><p>📅 Data: 25/04/2026<br>🕒 Horário: 10h às 13h<br>📍 Local: Colégio Niterói - R. Vereador José Vicente Sobrinho, 269 - Barreto, Niterói - RJ</p><p>Nos vemos lá!</p><p>Abraços,<br>Equipe Hack in Brasil</p>'
);
