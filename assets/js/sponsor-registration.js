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

  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const registerUrl = `${apiBase}/api/sponsors`;

  function setFeedback(message, type) {
    feedbackTitle.textContent = type === "success" ? "Solicitação enviada" : "Não foi possível enviar";
    feedbackMessage.textContent = message;
    feedbackModal.classList.remove("is-success", "is-error");
    feedbackModal.classList.add(type === "success" ? "is-success" : "is-error");
    feedbackModal.classList.add("open");
  }

  if (!apiBase || apiBase.includes("REPLACE-WITH-YOUR-WORKER-DOMAIN")) {
    submit.disabled = true;
    setFeedback("Configuração pendente: defina o domínio da API no formulário.", "error");
    return;
  }

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  // Contact phone: accepts Brazilian mobile (11 digits) or landline (10 digits).
  // Country code +55 is fixed and added on submit.
  function normalizePhone(value) {
    let digits = onlyDigits(value);
    if (digits.length === 13 && digits.startsWith("55")) digits = digits.slice(2);
    return digits.slice(0, 11);
  }

  function formatPhone(value) {
    const digits = normalizePhone(value);
    if (digits.length === 0) return "";
    if (digits.length <= 2) return `(${digits}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  function isValidContactPhone(value) {
    return /^[1-9][1-9]\d{8,9}$/.test(normalizePhone(value));
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
      phoneInput.value = formatPhone(phoneInput.value);
      if (normalizePhone(phoneInput.value).length < 10) {
        setPhoneErrorState(false);
        return;
      }
      setPhoneErrorState(!isValidContactPhone(phoneInput.value));
    });
  }

  let captchaAnswer = null;

  function renderCaptcha() {
    if (!captchaQuestion) return;
    const a = Math.floor(Math.random() * 9) + 1;
    const b = Math.floor(Math.random() * 9) + 1;
    const isAddition = Math.random() < 0.5;
    let left = a;
    let right = b;
    if (!isAddition && left < right) {
      const temp = left;
      left = right;
      right = temp;
    }
    captchaAnswer = isAddition ? left + right : left - right;
    captchaQuestion.textContent = `${left} ${isAddition ? "+" : "−"} ${right}`;
    if (captchaInput) captchaInput.value = "";
  }

  function isCaptchaValid() {
    if (!captchaInput || captchaAnswer === null) return true;
    const value = captchaInput.value.trim();
    if (value === "") return false;
    return Number(value) === captchaAnswer;
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

    if (!isValidContactPhone(phoneInput.value)) {
      setPhoneErrorState(true);
      setFeedback("Número de celular inválido. Use DDD + número, ex.: (11) 912345678.", "error");
      return;
    }
    setPhoneErrorState(false);

    if (!isCaptchaValid()) {
      setFeedback("Resposta da verificação incorreta. Resolva a nova operação e tente novamente.", "error");
      renderCaptcha();
      return;
    }

    payload.phone = `+55${normalizePhone(phoneInput.value)}`;
    payload.captcha = Number(captchaInput.value);

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
        setFeedback(data.error || "Não foi possível enviar a solicitação.", "error");
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
      renderCaptcha();
      submit.disabled = false;
      submit.textContent = "Enviar solicitação";
    } catch {
      setFeedback("Erro de conexão. Tente novamente.", "error");
      submit.disabled = false;
      submit.textContent = "Enviar solicitação";
    }
  });

  renderCaptcha();
})();
