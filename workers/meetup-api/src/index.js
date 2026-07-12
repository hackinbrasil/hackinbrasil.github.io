function json(data, status = 200, corsOrigin = "*") {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": corsOrigin,
      "access-control-allow-methods": "GET,POST,OPTIONS",
      "access-control-allow-headers": "content-type,authorization"
    }
  });
}

// Logs the real cause to the Worker logs (server-side only) and returns a
// generic message to the client, so backend state (missing tables, missing
// secrets, etc.) is never disclosed in the response.
function serverError(corsOrigin, context, error) {
  console.error(`[${context}]`, error);
  return json({error: "Erro interno. Tente novamente mais tarde."}, 500, corsOrigin);
}

function getCorsOrigin(request, env) {
  const allowedOrigins = String(env.ALLOWED_ORIGIN || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  const origin = request.headers.get("Origin");
  if (!origin) return allowedOrigins[0] || "*";
  if (allowedOrigins.includes(origin)) return origin;
  return allowedOrigins[0] || "*";
}

function isValidEmail(email) {
  if (typeof email !== "string") return false;
  if (email.length < 6 || email.length > 254) return false;
  if (email.includes(" ")) return false;

  const atIndex = email.indexOf("@");
  if (atIndex <= 0) return false;
  if (atIndex !== email.lastIndexOf("@")) return false;

  const local = email.slice(0, atIndex);
  const domain = email.slice(atIndex + 1);

  if (!local || !domain) return false;
  if (local.length > 64) return false;
  if (domain.startsWith(".") || domain.endsWith(".")) return false;
  if (domain.includes("..")) return false;

  const lastDot = domain.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === domain.length - 1) return false;

  return true;
}

// Cap the raw input before the regex so an oversized body field can't turn into
// a CPU amplifier. A CPF/phone is well under 32 chars.
function normalizeDocument(document) {
  return String(document || "").slice(0, 32).replace(/\D+/g, "");
}

function isValidCpf(document) {
  const cpf = normalizeDocument(document);
  if (cpf.length !== 11) return false;
  if (/^(\d)\1+$/.test(cpf)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i += 1) sum += Number(cpf[i]) * (10 - i);
  let firstDigit = (sum * 10) % 11;
  if (firstDigit === 10) firstDigit = 0;
  if (firstDigit !== Number(cpf[9])) return false;

  sum = 0;
  for (let i = 0; i < 10; i += 1) sum += Number(cpf[i]) * (11 - i);
  let secondDigit = (sum * 10) % 11;
  if (secondDigit === 10) secondDigit = 0;
  return secondDigit === Number(cpf[10]);
}

function normalizePhone(phone) {
  let digits = String(phone || "").slice(0, 32).replace(/\D+/g, "");
  if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
  return digits;
}

// Brazilian mobile: DDD (2 digits, no leading zero) + 9 + 8 digits.
function isValidBrazilMobile(nationalDigits) {
  return /^[1-9][1-9]9\d{8}$/.test(nationalDigits);
}

// Contact phone for sponsors is more permissive than an attendee mobile: it
// accepts both mobiles (11 digits) and landlines (10 digits), since a company
// may give either. DDD must not start with 0.
function isValidBrazilContactPhone(nationalDigits) {
  return /^[1-9][1-9]\d{8,9}$/.test(nationalDigits);
}

function isHttpUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return url.protocol === "http:" || url.protocol === "https:";
}

function escapeHtml(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function truncateError(value, maxLength = 500) {
  const text = String(value || "");
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength);
}

async function getMeetupBySlug(db, slug) {
  return db
    .prepare("SELECT slug, title, event_date, capacity, registrations_count, is_open FROM meetups WHERE slug = ?")
    .bind(slug)
    .first();
}

async function getRegistrationByMeetupAndEmail(db, slug, email) {
  return db
    .prepare("SELECT id, document_encrypted FROM registrations WHERE meetup_slug = ? AND email = ?")
    .bind(slug, email)
    .first();
}

async function getEmailTemplateByMeetupSlug(db, slug) {
  return db
    .prepare("SELECT id, subject, text_body, html_body FROM email_templates WHERE meetup_slug = ?")
    .bind(slug)
    .first();
}

function base64ToBytes(base64) {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let str = "";
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str);
}

async function importAesKey(env) {
  if (!env.DOC_ENCRYPTION_KEY_BASE64) {
    throw new Error("DOC_ENCRYPTION_KEY_BASE64 secret is required");
  }
  const raw = base64ToBytes(env.DOC_ENCRYPTION_KEY_BASE64);
  if (raw.byteLength !== 32) {
    throw new Error("DOC_ENCRYPTION_KEY_BASE64 must decode to 32 bytes");
  }
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encryptField(value, env) {
  const key = await importAesKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plain = new TextEncoder().encode(value);
  const cipher = await crypto.subtle.encrypt({name: "AES-GCM", iv}, key, plain);
  const payload = new Uint8Array(iv.length + cipher.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(cipher), iv.length);
  return bytesToBase64(payload);
}

async function decryptField(encryptedPayload, env) {
  const key = await importAesKey(env);
  const payload = base64ToBytes(encryptedPayload);
  if (payload.byteLength <= 12) {
    throw new Error("Invalid encrypted document payload");
  }
  const iv = payload.slice(0, 12);
  const cipher = payload.slice(12);
  const plainBuffer = await crypto.subtle.decrypt({name: "AES-GCM", iv}, key, cipher);
  return new TextDecoder().decode(plainBuffer);
}

async function queueConfirmationEmail(env, payload) {
  await env.DB
    .prepare(
      "INSERT INTO email_jobs (meetup_slug, template_id, registration_id, recipient_name, recipient_email, subject, html_body, text_body, send_after, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?), 'pending')"
    )
    .bind(
      payload.meetupSlug,
      payload.templateId,
      payload.registrationId,
      payload.recipientName,
      payload.recipientEmail,
      payload.subject,
      payload.html,
      payload.text,
      `+${payload.delayMinutes} minutes`
    )
    .run();
}

// Collapse CR/LF and other control characters so attacker-influenced values
// (subject built from company/talk title, reply-to from the submitter's email)
// can't smuggle line breaks into header-like fields.
function sanitizeHeaderValue(value) {
  return String(value == null ? "" : value)
    .replace(/[\u0000-\u001F\u007F]+/g, " ")
    .trim();
}

async function sendEmailWithResend(env, job) {
  if (!env.RESEND_API_KEY) {
    throw new Error("RESEND_API_KEY secret is required");
  }
  if (!env.RESEND_FROM_EMAIL) {
    throw new Error("RESEND_FROM_EMAIL variable is required");
  }

  const body = {
    from: env.RESEND_FROM_EMAIL,
    to: [job.recipient_email],
    subject: sanitizeHeaderValue(job.subject),
    html: job.html_body,
    text: job.text_body
  };

  const replyTo = job.reply_to || env.RESEND_REPLY_TO;
  if (replyTo) {
    body.reply_to = sanitizeHeaderValue(replyTo);
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.RESEND_API_KEY}`,
      "content-type": "application/json"
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = payload.message || payload.error || `Resend request failed with status ${response.status}`;
    throw new Error(message);
  }

  return String(payload.id || "");
}

async function markEmailAsSent(env, jobId, resendEmailId) {
  await env.DB
    .prepare(
      "UPDATE email_jobs SET status = 'sent', resend_email_id = ?, sent_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP, last_error = NULL WHERE id = ?"
    )
    .bind(resendEmailId, jobId)
    .run();
}

async function markEmailAsRetry(env, jobId, errorText) {
  await env.DB
    .prepare(
      "UPDATE email_jobs SET status = 'pending', send_after = datetime('now', '+10 minutes'), updated_at = CURRENT_TIMESTAMP, last_error = ? WHERE id = ?"
    )
    .bind(errorText, jobId)
    .run();
}

async function markEmailAsFailed(env, jobId, errorText) {
  await env.DB
    .prepare(
      "UPDATE email_jobs SET status = 'failed', updated_at = CURRENT_TIMESTAMP, last_error = ? WHERE id = ?"
    )
    .bind(errorText, jobId)
    .run();
}

async function processPendingEmailJobs(env, limit = 20) {
  const sentTodayRow = await env.DB
    .prepare("SELECT COUNT(*) AS total FROM email_jobs WHERE status = 'sent' AND date(sent_at) = date('now')")
    .first();

  const sentToday = Number(sentTodayRow?.total || 0);
  const remainingForToday = 100 - sentToday;
  if (remainingForToday <= 0) {
    return;
  }

  const maxBatchSize = Math.min(limit, remainingForToday);
  const pending = await env.DB
    .prepare(
      "SELECT id, meetup_slug, recipient_name, recipient_email, subject, html_body, text_body, attempts FROM email_jobs WHERE status = 'pending' AND send_after <= CURRENT_TIMESTAMP ORDER BY id ASC LIMIT ?"
    )
    .bind(maxBatchSize)
    .all();

  const rows = Array.isArray(pending.results) ? pending.results : [];

  for (const job of rows) {
    const lock = await env.DB
      .prepare(
        "UPDATE email_jobs SET status = 'processing', attempts = attempts + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'pending' AND send_after <= CURRENT_TIMESTAMP"
      )
      .bind(job.id)
      .run();

    if (!lock.meta || lock.meta.changes !== 1) {
      continue;
    }

    const currentAttempt = Number(job.attempts || 0) + 1;

    try {
      const resendEmailId = await sendEmailWithResend(env, job);
      await markEmailAsSent(env, job.id, resendEmailId);
    } catch (error) {
      const errorText = truncateError(error?.message || error || "Unknown email sending failure");
      if (currentAttempt >= 5) {
        await markEmailAsFailed(env, job.id, errorText);
      }
      if (currentAttempt < 5) {
        await markEmailAsRetry(env, job.id, errorText);
      }
    }
  }
}

function randomInt(maxExclusive) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return buf[0] % maxExclusive;
}

// Builds a small arithmetic challenge. The answer stays server-side; only the
// question string is shown to the user.
function generateCaptchaChallenge() {
  const a = randomInt(9) + 1;
  const b = randomInt(9) + 1;
  const isAddition = randomInt(2) === 0;
  let left = a;
  let right = b;
  if (!isAddition && left < right) {
    const temp = left;
    left = right;
    right = temp;
  }
  const answer = isAddition ? left + right : left - right;
  const question = `${left} ${isAddition ? "+" : "−"} ${right}`;
  return {question, answer};
}

async function handleCaptchaIssue(env, corsOrigin) {
  const {question, answer} = generateCaptchaChallenge();
  const id = crypto.randomUUID();

  try {
    await env.DB
      .prepare(
        "INSERT INTO captcha_challenges (id, answer, expires_at) VALUES (?, ?, datetime('now', '+10 minutes'))"
      )
      .bind(id, answer)
      .run();
  } catch (err) {
    return serverError(corsOrigin, "captcha:issue", err);
  }

  return json({id, question}, 200, corsOrigin);
}

// Verifies and consumes a challenge. The consuming UPDATE is atomic, so a
// challenge can be used at most once — a correct answer, a wrong answer, an
// expired token or a reused token all resolve to a single attempt.
async function consumeCaptcha(env, id, answer) {
  if (typeof id !== "string" || !id || !Number.isFinite(answer)) return false;

  let consumed;
  try {
    consumed = await env.DB
      .prepare(
        "UPDATE captcha_challenges SET consumed = 1 WHERE id = ? AND consumed = 0 AND expires_at > CURRENT_TIMESTAMP"
      )
      .bind(id)
      .run();
  } catch {
    return false;
  }

  if (!consumed.meta || consumed.meta.changes !== 1) return false;

  const row = await env.DB
    .prepare("SELECT answer FROM captcha_challenges WHERE id = ?")
    .bind(id)
    .first();

  return !!row && Number(row.answer) === answer;
}

async function handleStatus(env, slug, corsOrigin) {
  let meetup;
  try {
    meetup = await getMeetupBySlug(env.DB, slug);
  } catch (err) {
    return serverError(corsOrigin, "getMeetup", err);
  }

  if (!meetup) return json({error: "Meetup not found"}, 404, corsOrigin);

  const isFull = meetup.registrations_count >= meetup.capacity || meetup.is_open !== 1;
  return json(
    {
      slug: meetup.slug,
      title: meetup.title,
      eventDate: meetup.event_date,
      isOpen: meetup.is_open === 1,
      isFull
    },
    200,
    corsOrigin
  );
}

async function handleRegister(request, env, slug, corsOrigin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({error: "Invalid JSON body"}, 400, corsOrigin);
  }

  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const document = normalizeDocument(body.document);
  const phoneNational = normalizePhone(body.phone);
  const phone = `+55${phoneNational}`;
  const consentLgpd = body.consentLgpd === true;
  const captchaId = String(body.captchaId || "");
  const captchaValue = Number(body.captcha);

  if (!name || name.length < 3 || name.length > 200) {
    return json({error: "Nome inválido"}, 400, corsOrigin);
  }
  if (!isValidEmail(email)) {
    return json({error: "E-mail inválido"}, 400, corsOrigin);
  }
  if (!isValidCpf(document)) {
    return json({error: "CPF inválido"}, 400, corsOrigin);
  }
  if (!isValidBrazilMobile(phoneNational)) {
    return json({error: "Número de celular inválido"}, 400, corsOrigin);
  }
  if (!captchaId || !Number.isFinite(captchaValue)) {
    return json({error: "Verificação obrigatória"}, 400, corsOrigin);
  }
  if (!consentLgpd) {
    return json({error: "Consentimento LGPD é obrigatório"}, 400, corsOrigin);
  }

  let meetup;
  try {
    meetup = await getMeetupBySlug(env.DB, slug);
  } catch (err) {
    return serverError(corsOrigin, "getMeetup", err);
  }

  if (!meetup) return json({error: "Meetup not found"}, 404, corsOrigin);

  if (meetup.is_open !== 1 || meetup.registrations_count >= meetup.capacity) {
    return json({error: "Inscrições encerradas para este meetup"}, 409, corsOrigin);
  }

  if (!(await consumeCaptcha(env, captchaId, captchaValue))) {
    return json({error: "Verificação inválida ou expirada. Tente novamente."}, 400, corsOrigin);
  }

  const encryptedDocument = await encryptField(document, env);
  const encryptedPhone = await encryptField(phone, env);
  const documentLast4 = document.slice(-4);

  // Claim a seat and insert the registration in a single atomic transaction, so a
  // crash between the two can no longer leave the count incremented without a
  // matching registration (undersell) or vice versa. Both statements are gated on
  // capacity within the same transaction, so they either both apply (a seat was
  // free) or both no-op (full). A failed batch rolls back entirely, so no manual
  // decrement is needed on error.
  let batchResults;
  try {
    batchResults = await env.DB.batch([
      env.DB
        .prepare(
          "INSERT INTO registrations (meetup_slug, name, email, phone_encrypted, document_encrypted, document_last4, consent_lgpd) SELECT ?, ?, ?, ?, ?, ?, 1 FROM meetups WHERE slug = ? AND is_open = 1 AND registrations_count < capacity"
        )
        .bind(slug, name, email, encryptedPhone, encryptedDocument, documentLast4, slug),
      env.DB
        .prepare(
          "UPDATE meetups SET registrations_count = registrations_count + 1, updated_at = CURRENT_TIMESTAMP WHERE slug = ? AND is_open = 1 AND registrations_count < capacity"
        )
        .bind(slug)
    ]);
  } catch (err) {
    const message = String(err?.message || err || "");

    if (message.includes("UNIQUE constraint failed: registrations.meetup_slug, registrations.email")) {
      try {
        const existingRegistration = await getRegistrationByMeetupAndEmail(env.DB, slug, email);
        if (existingRegistration) {
          const existingDocument = await decryptField(
            String(existingRegistration.document_encrypted),
            env
          );
          if (normalizeDocument(existingDocument) === document) {
            const updated = await getMeetupBySlug(env.DB, slug);
            const isFull = updated.registrations_count >= updated.capacity || updated.is_open !== 1;
            return json(
              {
                ok: true,
                message: "Inscrição realizada com sucesso",
                emailScheduled: false,
                isFull
              },
              201,
              corsOrigin
            );
          }
        }
      } catch {
        return json({error: "Não foi possível concluir a inscrição"}, 409, corsOrigin);
      }
      return json({error: "Não foi possível concluir a inscrição"}, 409, corsOrigin);
    }
    return json({error: "Falha ao registrar inscrição"}, 500, corsOrigin);
  }

  const insertResult = batchResults[0];
  const updateResult = batchResults[1];

  // No seat was free: both gated statements matched no rows and nothing was written.
  if (
    !insertResult?.meta ||
    insertResult.meta.changes !== 1 ||
    !updateResult?.meta ||
    updateResult.meta.changes !== 1
  ) {
    return json({error: "Inscrições encerradas para este meetup"}, 409, corsOrigin);
  }

  let registrationId = Number(insertResult.meta.last_row_id || 0);

  if (!registrationId) {
    const createdRegistration = await env.DB
      .prepare(
        "SELECT id FROM registrations WHERE meetup_slug = ? AND email = ? ORDER BY id DESC LIMIT 1"
      )
      .bind(slug, email)
      .first();

    registrationId = Number(createdRegistration?.id || 0);
  }

  let emailScheduled = false;
  try {
    const emailTemplate = await getEmailTemplateByMeetupSlug(env.DB, slug);
    if (emailTemplate && registrationId) {
      await queueConfirmationEmail(env, {
        meetupSlug: slug,
        templateId: Number(emailTemplate.id),
        registrationId,
        recipientName: name,
        recipientEmail: email,
        subject: String(emailTemplate.subject),
        html: String(emailTemplate.html_body),
        text: String(emailTemplate.text_body),
        delayMinutes: 10
      });
      emailScheduled = true;
    }
  } catch {
    emailScheduled = false;
  }

  const updated = await getMeetupBySlug(env.DB, slug);
  const isFull = updated.registrations_count >= updated.capacity || updated.is_open !== 1;

  return json(
    {
      ok: true,
      message: "Inscrição realizada com sucesso",
      emailScheduled,
      isFull
    },
    201,
    corsOrigin
  );
}

function buildSponsorNotificationEmail(data) {
  const rows = [
    ["Empresa", data.company],
    ["Site da empresa", data.website || "—"],
    ["Pessoa para contato", data.contactName],
    ["Cargo", data.role || "—"],
    ["E-mail", data.email],
    ["Celular para contato", data.phone],
    ["Mensagem / observações", data.message || "—"]
  ];

  const subject = `Nova solicitação de patrocínio — ${data.company}`;

  const textBody = [
    "Uma nova solicitação de patrocínio foi enviada pelo site.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Responda diretamente a este e-mail para entrar em contato com a empresa."
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(
          label
        )}</td><td style="padding:6px 0;">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const htmlBody = `<p>Uma nova solicitação de patrocínio foi enviada pelo site.</p>` +
    `<table style="border-collapse:collapse;font-size:14px;">${htmlRows}</table>` +
    `<p style="color:#666;font-size:13px;">Responda diretamente a este e-mail para entrar em contato com a empresa.</p>`;

  return {subject, textBody, htmlBody};
}

async function handleSponsorRegister(request, env, corsOrigin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({error: "Invalid JSON body"}, 400, corsOrigin);
  }

  const company = String(body.company || "").trim();
  const website = String(body.website || "").trim();
  const contactName = String(body.contactName || "").trim();
  const role = String(body.role || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phoneNational = normalizePhone(body.phone);
  const phone = `+55${phoneNational}`;
  const message = String(body.message || "").trim();
  const captchaId = String(body.captchaId || "");
  const captchaValue = Number(body.captcha);

  if (!company || company.length < 2 || company.length > 200) {
    return json({error: "Nome da empresa inválido"}, 400, corsOrigin);
  }
  if (website.length > 300) {
    return json({error: "Site da empresa inválido"}, 400, corsOrigin);
  }
  if (!contactName || contactName.length < 3 || contactName.length > 200) {
    return json({error: "Nome de contato inválido"}, 400, corsOrigin);
  }
  if (role.length > 150) {
    return json({error: "Cargo inválido"}, 400, corsOrigin);
  }
  if (!isValidEmail(email)) {
    return json({error: "E-mail inválido"}, 400, corsOrigin);
  }
  if (!isValidBrazilContactPhone(phoneNational)) {
    return json({error: "Número de celular inválido"}, 400, corsOrigin);
  }
  if (message.length > 2000) {
    return json({error: "Mensagem muito longa"}, 400, corsOrigin);
  }
  if (!captchaId || !Number.isFinite(captchaValue)) {
    return json({error: "Verificação obrigatória"}, 400, corsOrigin);
  }
  if (!(await consumeCaptcha(env, captchaId, captchaValue))) {
    return json({error: "Verificação inválida ou expirada. Tente novamente."}, 400, corsOrigin);
  }

  try {
    await env.DB
      .prepare(
        "INSERT INTO sponsor_requests (company, website, contact_name, role, email, phone, message) VALUES (?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(company, website || null, contactName, role || null, email, phone, message || null)
      .run();
  } catch (err) {
    return serverError(corsOrigin, "sponsors:insert", err);
  }

  const notify = buildSponsorNotificationEmail({
    company,
    website,
    contactName,
    role,
    email,
    phone,
    message
  });

  let emailSent = false;
  try {
    const recipient =
      env.SPONSOR_NOTIFY_EMAIL || env.RESEND_REPLY_TO || "contato@hackinbrasil.com.br";
    await sendEmailWithResend(env, {
      recipient_email: recipient,
      subject: notify.subject,
      html_body: notify.htmlBody,
      text_body: notify.textBody,
      reply_to: email
    });
    emailSent = true;
  } catch {
    // The lead is already stored; a failed notification must not fail the request.
    emailSent = false;
  }

  return json(
    {
      ok: true,
      message: "Solicitação de patrocínio enviada com sucesso",
      emailSent
    },
    201,
    corsOrigin
  );
}

function buildTalkNotificationEmail(data) {
  const rows = [
    ["Título", data.title],
    ["Palestrante", data.speakerName],
    ["E-mail", data.email],
    ["Telefone", data.phone || "—"],
    ["Presencial no RJ", data.inPerson ? "Sim" : "Não"],
    ["Link da foto", data.photoUrl],
    ["Minibio", data.bio],
    ["Descrição da palestra", data.abstract],
    ["Autoriza uso de imagem", data.imageConsent ? "Sim" : "Não"],
    ["Ciente das orientações", data.termsAck ? "Sim" : "Não"]
  ];

  const subject = `Nova proposta de palestra — ${data.title}`;

  const textBody = [
    "Uma nova proposta de palestra foi enviada pelo site.",
    "",
    ...rows.map(([label, value]) => `${label}: ${value}`),
    "",
    "Responda diretamente a este e-mail para entrar em contato com a pessoa palestrante."
  ].join("\n");

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:6px 12px 6px 0;font-weight:600;vertical-align:top;white-space:nowrap;">${escapeHtml(
          label
        )}</td><td style="padding:6px 0;">${escapeHtml(value).replace(/\n/g, "<br>")}</td></tr>`
    )
    .join("");

  const htmlBody = `<p>Uma nova proposta de palestra foi enviada pelo site.</p>` +
    `<table style="border-collapse:collapse;font-size:14px;">${htmlRows}</table>` +
    `<p style="color:#666;font-size:13px;">Responda diretamente a este e-mail para entrar em contato com a pessoa palestrante.</p>`;

  return {subject, textBody, htmlBody};
}

async function handleTalkSubmit(request, env, corsOrigin) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({error: "Invalid JSON body"}, 400, corsOrigin);
  }

  const title = String(body.title || "").trim();
  const abstract = String(body.abstract || "").trim();
  const speakerName = String(body.speakerName || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const phoneRaw = String(body.phone || "").trim();
  const phoneNational = normalizePhone(phoneRaw);
  const phone = phoneRaw ? `+55${phoneNational}` : "";
  const photoUrl = String(body.photoUrl || "").trim();
  const bio = String(body.bio || "").trim();
  const inPersonRaw = String(body.inPerson || "").trim().toLowerCase();
  const imageConsent = body.imageConsent === true;
  const termsAck = body.termsAck === true;
  const captchaId = String(body.captchaId || "");
  const captchaValue = Number(body.captcha);

  if (!title || title.length < 3 || title.length > 200) {
    return json({error: "Título inválido"}, 400, corsOrigin);
  }
  if (!abstract || abstract.length < 10 || abstract.length > 5000) {
    return json({error: "Descrição da palestra inválida"}, 400, corsOrigin);
  }
  if (!speakerName || speakerName.length < 2 || speakerName.length > 200) {
    return json({error: "Nome inválido"}, 400, corsOrigin);
  }
  if (!isValidEmail(email)) {
    return json({error: "E-mail inválido"}, 400, corsOrigin);
  }
  if (phoneRaw && !isValidBrazilContactPhone(phoneNational)) {
    return json({error: "Número de telefone inválido"}, 400, corsOrigin);
  }
  if (!photoUrl || photoUrl.length > 500 || !isHttpUrl(photoUrl)) {
    return json({error: "Link da foto inválido"}, 400, corsOrigin);
  }
  if (!bio || bio.length < 10 || bio.length > 3000) {
    return json({error: "Minibio inválida"}, 400, corsOrigin);
  }
  if (inPersonRaw !== "sim" && inPersonRaw !== "nao") {
    return json({error: "Informe sua disponibilidade presencial"}, 400, corsOrigin);
  }
  if (!imageConsent) {
    return json({error: "É necessário autorizar o uso de imagem"}, 400, corsOrigin);
  }
  if (!termsAck) {
    return json({error: "É necessário confirmar ciência das orientações"}, 400, corsOrigin);
  }
  if (!captchaId || !Number.isFinite(captchaValue)) {
    return json({error: "Verificação obrigatória"}, 400, corsOrigin);
  }
  if (!(await consumeCaptcha(env, captchaId, captchaValue))) {
    return json({error: "Verificação inválida ou expirada. Tente novamente."}, 400, corsOrigin);
  }

  const inPerson = inPersonRaw === "sim" ? 1 : 0;

  try {
    await env.DB
      .prepare(
        "INSERT INTO talk_proposals (title, abstract, speaker_name, email, phone, photo_url, bio, in_person, image_consent, terms_ack) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .bind(
        title,
        abstract,
        speakerName,
        email,
        phone || null,
        photoUrl,
        bio,
        inPerson,
        imageConsent ? 1 : 0,
        termsAck ? 1 : 0
      )
      .run();
  } catch (err) {
    return serverError(corsOrigin, "talks:insert", err);
  }

  const notify = buildTalkNotificationEmail({
    title,
    abstract,
    speakerName,
    email,
    phone,
    photoUrl,
    bio,
    inPerson: inPerson === 1,
    imageConsent,
    termsAck
  });

  let emailSent = false;
  try {
    const recipient =
      env.TALK_NOTIFY_EMAIL || env.RESEND_REPLY_TO || "contato@hackinbrasil.com.br";
    await sendEmailWithResend(env, {
      recipient_email: recipient,
      subject: notify.subject,
      html_body: notify.htmlBody,
      text_body: notify.textBody,
      reply_to: email
    });
    emailSent = true;
  } catch {
    // The proposal is already stored; a failed notification must not fail the request.
    emailSent = false;
  }

  return json(
    {
      ok: true,
      message: "Proposta de palestra enviada com sucesso",
      emailSent
    },
    201,
    corsOrigin
  );
}

export default {
  async fetch(request, env) {
    const corsOrigin = getCorsOrigin(request, env);

    // Safety net: any unexpected throw (missing secret, unforeseen DB error,
    // etc.) becomes a uniform generic 500 with the detail logged server-side,
    // instead of a raw Cloudflare error page.
    try {
      const url = new URL(request.url);

      if (request.method === "OPTIONS") {
        return new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": corsOrigin,
            "access-control-allow-methods": "GET,POST,OPTIONS",
            "access-control-allow-headers": "content-type,authorization"
          }
        });
      }

      const statusMatch = url.pathname.match(/^\/api\/meetups\/([a-z0-9-]+)\/status$/);
      if (request.method === "GET" && statusMatch) {
        return handleStatus(env, statusMatch[1], corsOrigin);
      }

      if (request.method === "GET" && url.pathname === "/api/captcha") {
        return handleCaptchaIssue(env, corsOrigin);
      }

      const registerMatch = url.pathname.match(/^\/api\/meetups\/([a-z0-9-]+)\/register$/);
      if (request.method === "POST" && registerMatch) {
        return handleRegister(request, env, registerMatch[1], corsOrigin);
      }

      if (request.method === "POST" && url.pathname === "/api/sponsors") {
        return handleSponsorRegister(request, env, corsOrigin);
      }

      if (request.method === "POST" && url.pathname === "/api/talks") {
        return handleTalkSubmit(request, env, corsOrigin);
      }

      return json({error: "Not found"}, 404, corsOrigin);
    } catch (err) {
      return serverError(corsOrigin, "fetch", err);
    }
  },

  async scheduled(_event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        await processPendingEmailJobs(env);
        try {
          await env.DB
            .prepare("DELETE FROM captcha_challenges WHERE expires_at < CURRENT_TIMESTAMP")
            .run();
        } catch {
          // Best-effort cleanup; ignore (e.g. table not yet migrated).
        }
      })()
    );
  }
};
