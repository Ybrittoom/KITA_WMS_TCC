document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kita_token") || sessionStorage.getItem("kita_token");
  if (!token) {
    window.KitaWms = { api: async () => { throw new Error("Faça login para continuar."); } };
    window.location.replace("/login");
    return;
  }

  function encerrarSessao() {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("kita_token");
      storage.removeItem("kita_empresa");
    }
    window.location.replace("/login");
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      encerrarSessao();
      throw new Error("Sessão encerrada. Entre novamente.");
    }
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível concluir a operação.");
      error.status = response.status;
      throw error;
    }
    return data;
  }

  const destinations = [
    ["/home", "Início"],
    ["/produtos", "Produtos"],
    ["/estoque/locais", "Locais"],
    ["/estoque/entrada", "Entrada"],
    ["/estoque/saida", "Saída"],
    ["/estoque/movimentacoes", "Saldo e leitor"],
    ["/estoque/historico", "Histórico"],
    ["/estoque/mapa", "Mapa visual"],
  ];
  const navigation = document.createElement("nav");
  navigation.className = "system-nav";
  navigation.setAttribute("aria-label", "Navegação principal");
  for (const [href, label] of destinations) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    if (window.location.pathname === href ||
        (href === "/estoque/movimentacoes" && window.location.pathname.startsWith("/estoque/movimentacoes")) ||
        (href === "/produtos" && window.location.pathname === "/produtos/cadastro")) {
      link.classList.add("active");
      link.setAttribute("aria-current", "page");
    }
    navigation.append(link);
  }

  const logout = document.createElement("button");
  logout.type = "button";
  logout.textContent = "Sair";
  logout.addEventListener("click", encerrarSessao);
  navigation.append(logout);

  const pageHeader = document.querySelector(".topbar, .app-header");
  if (pageHeader) pageHeader.insertAdjacentElement("afterend", navigation);
  window.KitaWms = { api, token, encerrarSessao };

  void api("/api/auth/me").then((data) => {
    document.querySelectorAll("#company-name, .company-name").forEach((element) => {
      element.textContent = data.empresa?.nome || "Empresa logada";
    });
  }).catch((error) => {
    if (error.status !== 401) console.error("Não foi possível carregar a empresa:", error.message);
  });
});
