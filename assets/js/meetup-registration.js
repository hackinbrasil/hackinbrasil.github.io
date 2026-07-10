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

  if (!form || !status || !submit || !feedbackModal || !feedbackTitle || !feedbackMessage || !cpfInput || !cpfHelp) return;

  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const meetupSlug = (form.dataset.meetupSlug || "").trim();
  const meetupDate = (form.dataset.meetupDate || "").trim();

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

  function setFeedback(message, type) {
    feedbackTitle.textContent = type === "success" ? "Inscrição confirmada" : "Não foi possível concluir";
    feedbackMessage.textContent = message;
    feedbackModal.classList.remove("is-success", "is-error");
    feedbackModal.classList.add(type === "success" ? "is-success" : "is-error");
    feedbackModal.classList.add("open");
  }

  function setSuccessFeedbackWithWhatsappInvite() {
    const whatsappInviteUrl = "https://chat.whatsapp.com/D4vKksmiQ53JpVMih0PF4b?mode=hq2tcli";
    const whatsappInviteLink = document.createElement("a");

    feedbackTitle.textContent = "Inscrição confirmada";
    feedbackMessage.textContent = "";
    feedbackMessage.append("Inscrição confirmada com sucesso.");
    feedbackMessage.append(document.createElement("br"));
    feedbackMessage.append("Participe também do nosso ");

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
    setFeedback("Não foi possível iniciar as inscrições.", "error");
    return;
  }

  const statusUrl = `${apiBase}/api/meetups/${meetupSlug}/status`;
  const registerUrl = `${apiBase}/api/meetups/${meetupSlug}/register`;

  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  function formatCpf(value) {
    const digits = onlyDigits(value).slice(0, 11);
    return digits
      .replace(/^(\d{3})(\d)/, "$1.$2")
      .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1-$2");
  }

  function isValidCpf(value) {
    const cpf = onlyDigits(value);
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

  function setCpfErrorState(isInvalid) {
    cpfInput.classList.toggle("is-invalid", isInvalid);
    cpfHelp.classList.toggle("is-error", isInvalid);
    cpfHelp.textContent = isInvalid
      ? "CPF inválido. Verifique os dígitos e tente novamente."
      : "Apenas CPF válido será aceito.";
  }

  cpfInput.addEventListener("input", function () {
    cpfInput.value = formatCpf(cpfInput.value);
    if (cpfInput.value.length < 14) {
      setCpfErrorState(false);
      return;
    }
    setCpfErrorState(!isValidCpf(cpfInput.value));
  });

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

  function setClosedState(message) {
    status.textContent = message;
    submit.disabled = true;
    submit.textContent = "Inscrições encerradas";
    setFeedback("Novos ingressos serão liberados em breve", "error");
  }

  async function refreshStatus() {
    try {
      const res = await fetch(statusUrl);
      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || "Não foi possível consultar as vagas.";
        submit.disabled = true;
        setFeedback("Falha ao carregar disponibilidade de vagas.", "error");
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
      setFeedback("Erro de conexão ao consultar vagas.", "error");
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

    if (!isValidCpf(payload.document)) {
      setCpfErrorState(true);
      setFeedback("CPF inválido. Revise o número informado.", "error");
      return;
    }

    setCpfErrorState(false);

    if (!isCaptchaValid()) {
      setFeedback("Resposta da verificação incorreta. Resolva a nova operação e tente novamente.", "error");
      renderCaptcha();
      return;
    }

    payload.document = onlyDigits(payload.document);

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
        setFeedback(errorMessage, "error");
        if (res.status === 409) {
          const isCapacityError = /inscriç(ã|a)es encerradas/i.test(errorMessage);
          if (isCapacityError) {
            setClosedState("Inscrições encerradas para este meetup.");
            return;
          }
          submit.disabled = false;
          submit.textContent = "Inscrever-se";
        } else {
          submit.disabled = false;
          submit.textContent = "Inscrever-se";
        }
        return;
      }

      setSuccessFeedbackWithWhatsappInvite();
      form.reset();
      setCpfErrorState(false);
      renderCaptcha();

      if (data.isFull) {
        setClosedState("Inscrições encerradas. Limite de participantes atingido.");
      } else {
        await refreshStatus();
      }
    } catch {
      setFeedback("Erro de conexão. Tente novamente.", "error");
      submit.disabled = false;
      submit.textContent = "Inscrever-se";
    }
  });

  renderCaptcha();
  refreshStatus();
})();
