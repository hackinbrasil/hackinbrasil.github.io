(function () {
  const form = document.getElementById("meetup-registration-form");
  const status = document.getElementById("registration-status");
  const feedback = document.getElementById("registration-feedback");
  const submit = document.getElementById("registration-submit");

  if (!form || !status || !feedback || !submit) return;

  const apiBase = (form.dataset.apiBase || "").trim().replace(/\/$/, "");
  const meetupSlug = (form.dataset.meetupSlug || "").trim();

  if (!apiBase || apiBase.includes("REPLACE-WITH-YOUR-WORKER-DOMAIN")) {
    status.textContent = "Configuração pendente: defina o domínio da API no formulário.";
    submit.disabled = true;
    return;
  }

  const statusUrl = `${apiBase}/api/meetups/${meetupSlug}/status`;
  const registerUrl = `${apiBase}/api/meetups/${meetupSlug}/register`;

  function setClosedState(message) {
    status.textContent = message;
    submit.disabled = true;
    submit.textContent = "Inscrições encerradas";
    feedback.textContent = "Novos ingressos serão liberados em breve";
  }

  async function refreshStatus() {
    try {
      const res = await fetch(statusUrl);
      const data = await res.json();

      if (!res.ok) {
        status.textContent = data.error || "Não foi possível consultar as vagas.";
        submit.disabled = true;
        return;
      }

      if (data.isFull) {
        setClosedState(`Inscrições encerradas. Limite de ${data.capacity} participantes atingido.`);
        return;
      }

      status.textContent = `Vagas restantes: ${data.spotsLeft} de ${data.capacity}.`;
      submit.disabled = false;
      submit.textContent = "Inscrever-se";
    } catch {
      status.textContent = "Erro ao verificar disponibilidade. Tente novamente em instantes.";
      submit.disabled = true;
    }
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    feedback.textContent = "";

    if (submit.disabled) return;

    const formData = new FormData(form);
    const payload = {
      name: String(formData.get("name") || "").trim(),
      email: String(formData.get("email") || "").trim(),
      document: String(formData.get("document") || "").trim(),
      consentLgpd: formData.get("consentLgpd") === "on"
    };

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
        feedback.textContent = data.error || "Não foi possível concluir a inscrição.";
        if (res.status === 409) {
          setClosedState("Inscrições encerradas para este meetup.");
        } else {
          submit.disabled = false;
          submit.textContent = "Inscrever-se";
        }
        return;
      }

      feedback.textContent = "Inscrição confirmada com sucesso.";
      form.reset();

      if (data.isFull) {
        setClosedState("Inscrições encerradas. Limite de participantes atingido.");
      } else {
        await refreshStatus();
      }
    } catch {
      feedback.textContent = "Erro de conexão. Tente novamente.";
      submit.disabled = false;
      submit.textContent = "Inscrever-se";
    }
  });

  refreshStatus();
})();
