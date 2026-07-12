(function () {
  const form = document.getElementById("meetup-registration-form");
  const status = document.getElementById("registration-status");
  const submit = document.getElementById("registration-submit");
  const feedbackModal = document.getElementById("registrationFeedbackModal");
  const feedbackTitle = document.getElementById("registration-feedback-title");
  const feedbackMessage = document.getElementById("registration-feedback-message");
  const cpfInput = document.getElementById("reg-document");
  const cpfHelp = document.getElementById("cpf-help");
  const captchaInput = document.getElementById("reg-captcha");
  const captchaQuestion = document.getElementById("captcha-question");
  const phoneInput = document.getElementById("reg-phone");
  const phoneHelp = document.getElementById("phone-help");

  if (!form || !status || !submit || !feedbackModal || !feedbackTitle || !feedbackMessage) return;
  if (!window.HIBForms) return;

  const F = window.HIBForms;
  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const meetupSlug = (form.dataset.meetupSlug || "").trim();
  const meetupDate = (form.dataset.meetupDate || "").trim();

  const feedback = F.createFeedback(feedbackModal, feedbackTitle, feedbackMessage, {
    success: "Inscrição confirmada",
    error: "Não foi possível concluir"
  });
  const captcha = F.createCaptcha(captchaQuestion, captchaInput, apiBase);

  // Hide the registration section once the meetup date has passed.
  // An empty/invalid date means the meetup is still upcoming, so we keep showing it.
  function isMeetupPast() {
    if (!meetupDate) return false;
    const endOfMeetupDay = new Date(`${meetupDate}T23:59:59`);
    if (Number.isNaN(endOfMeetupDay.getTime())) return false;
    return Date.now() > endOfMeetupDay.getTime();
  }

  if (isMeetupPast()) {
    const section = form.closest(".meetup-card");
    if (section) section.hidden = true;
    const kicker = document.querySelector(".hero-kicker");
    if (kicker) kicker.textContent = "Edição anterior";
    return;
  }

  function setSuccessFeedbackWithWhatsappInvite() {
    const whatsappInviteUrl = "https://chat.whatsapp.com/D4vKksmiQ53JpVMih0PF4b?mode=hq2tcli";
    const whatsappInviteLink = document.createElement("a");

    feedbackTitle.textContent = "Inscrição confirmada! 🎉";
    feedbackMessage.textContent = "";
    feedbackMessage.append("Sua vaga está garantida. Nos vemos no meetup!");
    feedbackMessage.append(document.createElement("br"));
    feedbackMessage.append(document.createElement("br"));
    feedbackMessage.append("Entre no nosso grupo do WhatsApp para receber os avisos e novidades do evento:");

    whatsappInviteLink.href = whatsappInviteUrl;
    whatsappInviteLink.target = "_blank";
    whatsappInviteLink.rel = "noopener noreferrer";
    whatsappInviteLink.className = "registration-feedback-whatsapp-link";
    whatsappInviteLink.setAttribute("aria-label", "Entrar no grupo do WhatsApp");
    whatsappInviteLink.textContent = "Entrar no grupo do WhatsApp";

    feedbackMessage.append(document.createElement("br"));
    feedbackMessage.append(whatsappInviteLink);

    feedbackModal.classList.remove("is-success", "is-error");
    feedbackModal.classList.add("is-success");
    feedbackModal.classList.add("open");
  }

  if (!apiBase || apiBase.includes("REPLACE-WITH-YOUR-WORKER-DOMAIN")) {
    status.textContent = "Configuração pendente: defina o domínio da API no formulário.";
    submit.disabled = true;
    feedback.show("Não foi possível iniciar as inscrições.", "error");
    return;
  }

  // Every field the registration flow depends on must be present in the form before we let
  // anyone submit. The API now requires all of them (phone included), so a page cloned
  // without one would otherwise submit incomplete data and be rejected with a confusing
  // error the user can't fix — fail loudly here instead of silently.
  const requiredControls = {
    "nome": form.querySelector('[name="name"]'),
    "e-mail": form.querySelector('[name="email"]'),
    "celular": phoneInput,
    "documento": cpfInput,
    "verificação": captchaInput,
    "pergunta de verificação": captchaQuestion,
    "consentimento LGPD": form.querySelector('[name="consentLgpd"]')
  };
  const missingControls = Object.keys(requiredControls).filter((label) => !requiredControls[label]);
  if (missingControls.length > 0) {
    status.textContent = "Formulário de inscrição incompleto. Contate a organização.";
    submit.disabled = true;
    feedback.show(`Formulário indisponível: campo(s) ausente(s) — ${missingControls.join(", ")}.`, "error");
    return;
  }

  const statusUrl = `${apiBase}/api/meetups/${meetupSlug}/status`;
  const registerUrl = `${apiBase}/api/meetups/${meetupSlug}/register`;

  function setCpfErrorState(isInvalid) {
    cpfInput.classList.toggle("is-invalid", isInvalid);
    if (cpfHelp) {
      cpfHelp.classList.toggle("is-error", isInvalid);
      cpfHelp.textContent = isInvalid
        ? "CPF inválido. Verifique os dígitos e tente novamente."
        : "Apenas CPF válido será aceito.";
    }
  }

  cpfInput.addEventListener("input", function () {
    cpfInput.value = F.formatCpf(cpfInput.value);
    if (cpfInput.value.length < 14) {
      setCpfErrorState(false);
      return;
    }
    setCpfErrorState(!F.isValidCpf(cpfInput.value));
  });

  function setPhoneErrorState(isInvalid) {
    if (!phoneInput) return;
    phoneInput.classList.toggle("is-invalid", isInvalid);
    if (phoneHelp) {
      phoneHelp.classList.toggle("is-error", isInvalid);
      phoneHelp.textContent = isInvalid
        ? "Número de celular inválido. Use DDD + número, ex.: (11) 912345678."
        : "DDD + número, com +55 (Brasil). Ex.: (11) 912345678.";
    }
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      phoneInput.value = F.formatPhone(phoneInput.value);
      if (F.normalizePhone(phoneInput.value).length < 11) {
        setPhoneErrorState(false);
        return;
      }
      setPhoneErrorState(!F.isBrazilMobile(phoneInput.value));
    });
  }

  function setClosedState(message) {
    status.textContent = message;
    submit.disabled = true;
    submit.textContent = "Inscrições encerradas";
    feedback.show("Novos ingressos serão liberados em breve", "error");
  }

  async function refreshStatus() {
    try {
      const res = await fetch(statusUrl);
      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || "Não foi possível consultar as vagas.";
        submit.disabled = true;
        feedback.show("Falha ao carregar disponibilidade de vagas.", "error");
        return;
      }

      if (data.isFull) {
        setClosedState("Inscrições encerradas para este meetup.");
        return;
      }

      status.textContent = "Inscrições abertas.";
      submit.disabled = false;
      submit.textContent = "Inscrever-se";
    } catch {
      status.textContent = "Erro ao verificar disponibilidade. Tente novamente em instantes.";
      submit.disabled = true;
      feedback.show("Erro de conexão ao consultar vagas.", "error");
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();

    if (submit.disabled) return;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      document: String(formData.get("document") || "").trim(),
      consentLgpd: formData.get("consentLgpd") === "on"
    };

    if (!F.isValidCpf(payload.document)) {
      setCpfErrorState(true);
      feedback.show("CPF inválido. Revise o número informado.", "error");
      return;
    }

    setCpfErrorState(false);

    if (!F.isBrazilMobile(phoneInput.value)) {
      setPhoneErrorState(true);
      feedback.show("Número de celular inválido. Use DDD + número, ex.: (11) 912345678.", "error");
      return;
    }
    setPhoneErrorState(false);

    if (!captcha.ready()) {
      feedback.show("Resolva a verificação antes de enviar.", "error");
      captcha.render();
      return;
    }

    payload.document = F.onlyDigits(payload.document);
    payload.phone = `+55${F.normalizePhone(phoneInput.value)}`;
    payload.captchaId = captcha.getToken();
    payload.captcha = Number(captcha.getAnswer());

    submit.disabled = true;
    submit.textContent = "Enviando...";

    try {
      const res = await fetch(registerUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        const errorMessage = data.error || "Não foi possível concluir a inscrição.";
        feedback.show(errorMessage, "error");
        if (res.status === 409) {
          const isCapacityError = /inscriç(ã|a)es encerradas/i.test(errorMessage);
          if (isCapacityError) {
            setClosedState("Inscrições encerradas para este meetup.");
            return;
          }
        }
        // The challenge is single-use and may now be spent — fetch a fresh one.
        captcha.render();
        submit.disabled = false;
        submit.textContent = "Inscrever-se";
        return;
      }

      setSuccessFeedbackWithWhatsappInvite();
      form.reset();
      setCpfErrorState(false);
      setPhoneErrorState(false);
      captcha.render();

      if (data.isFull) {
        setClosedState("Inscrições encerradas. Limite de participantes atingido.");
      } else {
        await refreshStatus();
      }
    } catch {
      feedback.show("Erro de conexão. Tente novamente.", "error");
      captcha.render();
      submit.disabled = false;
      submit.textContent = "Inscrever-se";
    }
  });

  captcha.render();
  refreshStatus();
})();
