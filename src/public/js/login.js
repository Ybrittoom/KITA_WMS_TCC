document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const emailInput = document.getElementById("email");
  const senhaInput = document.getElementById("senha");
  const rememberInput = document.getElementById("remember");
  const button = document.getElementById("login-button");
  const message = document.getElementById("login-message");
  const forgotPassword = document.getElementById("forgot-password");

  const clearMessage = () => {
    message.textContent = "";
    message.removeAttribute("data-state");
  };

  [emailInput, senhaInput].forEach((input) => {
    input.addEventListener("input", () => {
      if (message.textContent) clearMessage();
    });
  });

  // A recuperação ainda não tem endpoint; explique isso sem navegar para o topo da página.
  forgotPassword.addEventListener("click", (event) => {
    event.preventDefault();
    message.textContent = "A recuperação de senha ainda não está disponível.";
    message.dataset.state = "info";
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearMessage();

    const email = emailInput.value.trim().toLowerCase();
    const senha = senhaInput.value;
    if (!email || !senha) {
      message.textContent = "Informe o e-mail e a senha da empresa.";
      message.dataset.state = "error";
      return;
    }

    button.disabled = true;
    button.textContent = "Entrando...";
    form.setAttribute("aria-busy", "true");

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

      if (typeof data.token !== "string" || !data.empresa?.id) {
        throw new Error("A resposta da API está incompleta. Tente novamente.");
      }

      const storage = rememberInput.checked ? localStorage : sessionStorage;
      const otherStorage = rememberInput.checked ? sessionStorage : localStorage;
      otherStorage.removeItem("kita_token");
      otherStorage.removeItem("kita_empresa");
      storage.setItem("kita_token", data.token);
      storage.setItem("kita_empresa", JSON.stringify(data.empresa));

      message.textContent = `Login realizado. Olá, ${data.empresa.nome}.`;
      message.dataset.state = "success";
      senhaInput.value = "";
    } catch (error) {
      message.textContent = error instanceof TypeError
        ? "Não foi possível conectar à API. Confira se o servidor está iniciado."
        : error.message || "Não foi possível concluir o login. Tente novamente.";
      message.dataset.state = "error";
    } finally {
      button.disabled = false;
      button.textContent = "Entrar no Sistema";
      form.removeAttribute("aria-busy");
    }
  });
});
