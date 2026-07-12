(function () {
  const form = document.getElementById("talk-form");
  const submit = document.getElementById("talk-submit");
  const feedbackModal = document.getElementById("talkFeedbackModal");
  const feedbackTitle = document.getElementById("talk-feedback-title");
  const feedbackMessage = document.getElementById("talk-feedback-message");
  const phoneInput = document.getElementById("talk-phone");
  const phoneHelp = document.getElementById("talk-phone-help");
  const captchaInput = document.getElementById("talk-captcha");
  const captchaQuestion = document.getElementById("talk-captcha-question");

  if (!form || !submit || !feedbackModal || !feedbackTitle || !feedbackMessage) return;

  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const submitUrl = `${apiBase}/api/talks`;

  function setFeedback(message, type) {
    feedbackTitle.textContent = type === "success" ? "Proposta enviada" : "Não foi possível enviar";
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

  // Contact phone (optional): accepts Brazilian mobile (11 digits) or landline (10 digits).
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
        : "Opcional. DDD + número, com +55 (Brasil). Ex.: (11) 912345678.";
    }
  }

  if (phoneInput) {
    phoneInput.addEventListener("input", function () {
      phoneInput.value = formatPhone(phoneInput.value);
      const digits = normalizePhone(phoneInput.value);
      if (digits.length === 0 || digits.length < 10) {
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
      title: String(formData.get("title") || "").trim(),
      abstract: String(formData.get("abstract") || "").trim(),
      speakerName: String(formData.get("speakerName") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      photoUrl: String(formData.get("photoUrl") || "").trim(),
      bio: String(formData.get("bio") || "").trim(),
      inPerson: String(formData.get("inPerson") || "").trim(),
      imageConsent: formData.get("imageConsent") === "on",
      termsAck: formData.get("termsAck") === "on"
    };

    const phoneDigits = normalizePhone(phoneInput.value);
    if (phoneDigits && !isValidContactPhone(phoneInput.value)) {
      setPhoneErrorState(true);
      setFeedback("Número de telefone inválido. Use DDD + número, ex.: (11) 912345678.", "error");
      return;
    }
    setPhoneErrorState(false);

    if (!payload.inPerson) {
      setFeedback("Informe sua disponibilidade para palestrar presencialmente no Rio de Janeiro.", "error");
      return;
    }
    if (!payload.imageConsent) {
      setFeedback("É necessário autorizar o uso de imagem para enviar a proposta.", "error");
      return;
    }
    if (!payload.termsAck) {
      setFeedback("Confirme que está ciente das orientações para enviar a proposta.", "error");
      return;
    }

    if (!isCaptchaValid()) {
      setFeedback("Resposta da verificação incorreta. Resolva a nova operação e tente novamente.", "error");
      renderCaptcha();
      return;
    }

    payload.phone = phoneDigits ? `+55${phoneDigits}` : "";
    payload.captcha = Number(captchaInput.value);

    submit.disabled = true;
    submit.textContent = "Enviando...";

    try {
      const res = await fetch(submitUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok) {
        setFeedback(data.error || "Não foi possível enviar a proposta.", "error");
        submit.disabled = false;
        submit.textContent = "Enviar proposta";
        return;
      }

      feedbackTitle.textContent = "Proposta enviada! 🎉";
      feedbackMessage.textContent =
        "Recebemos a sua proposta de palestra. A organização entrará em contato pelo e-mail informado com o resultado da seleção.";
      feedbackModal.classList.remove("is-error");
      feedbackModal.classList.add("is-success", "open");

      form.reset();
      setPhoneErrorState(false);
      renderCaptcha();
      submit.disabled = false;
      submit.textContent = "Enviar proposta";
    } catch {
      setFeedback("Erro de conexão. Tente novamente.", "error");
      submit.disabled = false;
      submit.textContent = "Enviar proposta";
    }
  });

  renderCaptcha();
})();
