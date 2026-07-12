(function () {
  const form = document.getElementById("sponsor-form");
  const submit = document.getElementById("sponsor-submit");
  const feedbackModal = document.getElementById("sponsorFeedbackModal");
  const feedbackTitle = document.getElementById("sponsor-feedback-title");
  const feedbackMessage = document.getElementById("sponsor-feedback-message");
  const phoneInput = document.getElementById("sponsor-phone");
  const phoneHelp = document.getElementById("sponsor-phone-help");
  const captchaInput = document.getElementById("sponsor-captcha");
  const captchaQuestion = document.getElementById("sponsor-captcha-question");

  if (!form || !submit || !feedbackModal || !feedbackTitle || !feedbackMessage) return;
  if (!window.HIBForms) return;

  const F = window.HIBForms;
  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const registerUrl = `${apiBase}/api/sponsors`;

  const feedback = F.createFeedback(feedbackModal, feedbackTitle, feedbackMessage, {
    success: "Solicitação enviada",
    error: "Não foi possível enviar"
  });
  const captcha = F.createCaptcha(captchaQuestion, captchaInput, apiBase);

  if (!apiBase || apiBase.includes("REPLACE-WITH-YOUR-WORKER-DOMAIN")) {
    submit.disabled = true;
    feedback.show("Configuração pendente: defina o domínio da API no formulário.", "error");
    return;
  }

  const requiredControls = {
    "empresa": form.querySelector('[name="company"]'),
    "pessoa para contato": form.querySelector('[name="contactName"]'),
    "e-mail": form.querySelector('[name="email"]'),
    "celular": phoneInput,
    "verificação": captchaInput,
    "pergunta de verificação": captchaQuestion
  };
  const missingControls = Object.keys(requiredControls).filter((label) => !requiredControls[label]);
  if (missingControls.length > 0) {
    submit.disabled = true;
    feedback.show(`Formulário indisponível: campo(s) ausente(s) — ${missingControls.join(", ")}.`, "error");
    return;
  }

  function setPhoneErrorState(isInvalid) {
    if (!phoneInput) return;
    phoneInput.classList.toggle("is-invalid", isInvalid);
    if (phoneHelp) {
      phoneHelp.classList.toggle("is-error", isInvalid);
      phoneHelp.textContent = isInvalid
        ? "Número inválido. Use DDD + número, ex.: (11) 912345678."
        : "DDD + número, com +55 (Brasil). Ex.: (11) 912345678.";
    }
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      phoneInput.value = F.formatPhone(phoneInput.value);
      if (F.normalizePhone(phoneInput.value).length < 10) {
        setPhoneErrorState(false);
        return;
      }
      setPhoneErrorState(!F.isBrazilContactPhone(phoneInput.value));
    });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    if (submit.disabled) return;

    const formData = new FormData(form);
    const payload = {
      company: String(formData.get("company") || "").trim(),
      website: String(formData.get("website") || "").trim(),
      contactName: String(formData.get("contactName") || "").trim(),
      role: String(formData.get("role") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      message: String(formData.get("message") || "").trim()
    };

    if (!F.isBrazilContactPhone(phoneInput.value)) {
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
        feedback.show(data.error || "Não foi possível enviar a solicitação.", "error");
        // The challenge is single-use and now spent — fetch a fresh one to retry.
        captcha.render();
        submit.disabled = false;
        submit.textContent = "Enviar solicitação";
        return;
      }

      feedbackTitle.textContent = "Solicitação enviada! 🎉";
      feedbackMessage.textContent =
        "Recebemos os seus dados. Nossa equipe entrará em contato pelo e-mail informado em até 48h.";
      feedbackModal.classList.remove("is-error");
      feedbackModal.classList.add("is-success", "open");

      form.reset();
      setPhoneErrorState(false);
      captcha.render();
      submit.disabled = false;
      submit.textContent = "Enviar solicitação";
    } catch {
      feedback.show("Erro de conexão. Tente novamente.", "error");
      captcha.render();
      submit.disabled = false;
      submit.textContent = "Enviar solicitação";
    }
  });

  captcha.render();
})();
