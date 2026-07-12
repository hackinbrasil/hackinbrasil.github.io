// Shared helpers for the registration/sponsor/talk forms. Loaded before each
// page's form script and exposed on window.HIBForms.
window.HIBForms = (function () {
  function onlyDigits(value) {
    return String(value || "").replace(/\D+/g, "");
  }

  // Brazilian phone: national number is DDD (2 digits) + (mobile 9 + 8 digits,
  // or landline 8 digits). Country code +55 is fixed and added on submit.
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

  // Mobile only: DDD + 9 + 8 digits.
  function isBrazilMobile(value) {
    return /^[1-9][1-9]9\d{8}$/.test(normalizePhone(value));
  }

  // Mobile (11 digits) or landline (10 digits) — for contact fields.
  function isBrazilContactPhone(value) {
    return /^[1-9][1-9]\d{8,9}$/.test(normalizePhone(value));
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

  // Server-issued arithmetic anti-bot challenge. The question is fetched from the
  // backend and the answer is verified server-side (single-use), so the token is
  // sent with the form and validated there — the client never knows the answer.
  function createCaptcha(questionEl, inputEl, apiBase) {
    const base = String(apiBase || "").replace(/\/$/, "");
    let token = null;

    async function render() {
      token = null;
      if (inputEl) inputEl.value = "";
      if (questionEl) questionEl.textContent = "…";
      try {
        const res = await fetch(`${base}/api/captcha`);
        if (!res.ok) throw new Error("captcha");
        const data = await res.json();
        token = typeof data.id === "string" && data.id ? data.id : null;
        if (questionEl) questionEl.textContent = String(data.question || "");
      } catch {
        token = null;
        if (questionEl) questionEl.textContent = "indisponível";
      }
    }

    function getToken() {
      return token;
    }

    function getAnswer() {
      return inputEl ? inputEl.value.trim() : "";
    }

    // A challenge is ready to submit once we have a token and the user typed an
    // answer. The answer itself is only judged by the backend.
    function ready() {
      return !!token && getAnswer() !== "";
    }

    return { render, getToken, getAnswer, ready };
  }

  // Feedback modal controller. `titles` = { success, error }.
  function createFeedback(modalEl, titleEl, messageEl, titles) {
    function show(message, type) {
      titleEl.textContent = type === "success" ? titles.success : titles.error;
      messageEl.textContent = message;
      modalEl.classList.remove("is-success", "is-error");
      modalEl.classList.add(type === "success" ? "is-success" : "is-error");
      modalEl.classList.add("open");
    }
    return { show };
  }

  return {
    onlyDigits,
    normalizePhone,
    formatPhone,
    isBrazilMobile,
    isBrazilContactPhone,
    formatCpf,
    isValidCpf,
    createCaptcha,
    createFeedback
  };
})();
