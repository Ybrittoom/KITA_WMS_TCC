document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const senhaInput = document.getElementById("senha");
  const rememberInput = document.getElementById("remember");
  const button = document.getElementById("login-button");
  const message = document.getElementById("login-message");

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    message.textContent = "";
    message.removeAttribute("data-state");

    const email = emailInput.value.trim().toLowerCase();
    const senha = senhaInput.value;
    if (!email || !senha) {
      message.textContent = "Informe o e-mail e a senha da empresa.";
      message.dataset.state = "error";
      return;
    }

    button.disabled = true;
    button.textContent = "Entrando...";

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, senha }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.erro || "Não foi possível realizar o login.");
      }

      const storage = rememberInput.checked ? localStorage : sessionStorage;
      const otherStorage = rememberInput.checked ? sessionStorage : localStorage;
      otherStorage.removeItem("kita_token");
      otherStorage.removeItem("kita_empresa");
      storage.setItem("kita_token", data.token);
      storage.setItem("kita_empresa", JSON.stringify(data.empresa));

      message.textContent = `Login realizado. Bem-vinda, ${data.empresa.nome}.`;
      message.dataset.state = "success";
      senhaInput.value = "";
    } catch (error) {
      message.textContent = error.message || "Falha de comunicação com o servidor.";
      message.dataset.state = "error";
    } finally {
      button.disabled = false;
      button.textContent = "Entrar no Sistema";
    }
  });
});
