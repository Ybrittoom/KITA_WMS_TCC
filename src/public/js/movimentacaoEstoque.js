document.addEventListener("DOMContentLoaded", () => {
  // O login salva o token em localStorage (lembrar) ou sessionStorage (temporário).
  const token = localStorage.getItem("kita_token") || sessionStorage.getItem("kita_token");
  if (!token) {
    window.location.replace("/login");
    return;
  }

  const locationSelect = document.getElementById("location-select");
  const productSelect = document.getElementById("product-select");
  const locationForm = document.getElementById("location-form");
  const movementForm = document.getElementById("movement-form");
  const pageMessage = document.getElementById("page-message");
  const movementMessage = document.getElementById("movement-message");
  const balanceBody = document.getElementById("balance-body");
  const historyBody = document.getElementById("history-body");
  let products = [];

  /** Apaga os dados locais da sessão inválida e volta ao login. */
  function encerrarSessao() {
    for (const storage of [localStorage, sessionStorage]) {
      storage.removeItem("kita_token");
      storage.removeItem("kita_empresa");
    }
    window.location.replace("/login");
  }

  /** Faz chamadas à API anexando o JWT e transforma erros HTTP em mensagens. */
  async function requisicao(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      encerrarSessao();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a operação.");
    return data;
  }

  /** Exibe uma mensagem segura como texto; não interpreta conteúdo como HTML. */
  function mostrarMensagem(elemento, mensagem, estado = "error") {
    elemento.textContent = mensagem;
    elemento.dataset.state = estado;
  }

  /** Cria uma célula usando textContent para evitar injetar HTML vindo do banco. */
  function adicionarCelula(linha, texto, classe = "") {
    const celula = document.createElement("td");
    celula.textContent = texto;
    if (classe) celula.className = classe;
    linha.append(celula);
  }

  /** Carrega o nome da empresa a partir da sessão validada no servidor. */
  async function carregarEmpresa() {
    const data = await requisicao("/api/auth/me");
    document.getElementById("company-name").textContent = data.empresa?.nome || "Empresa logada";
  }

  /** Busca produtos ativos; a API limita a lista à empresa do JWT. */
  async function carregarProdutos() {
    const data = await requisicao("/api/produtos");
    products = data.produtos || [];
    productSelect.replaceChildren(new Option("Selecione um produto", ""));
    for (const product of products) {
      productSelect.add(new Option(`${product.nome} (SKU: ${product.sku})`, String(product.id)));
    }
    productSelect.disabled = products.length === 0;
    if (products.length === 0) productSelect.replaceChildren(new Option("Cadastre um produto primeiro", ""));
  }

  /** Busca e mostra os locais desta empresa, preservando a seleção atual. */
  async function carregarLocais(idParaSelecionar = locationSelect.value) {
    const data = await requisicao("/api/estoque/locais");
    locationSelect.replaceChildren(new Option("Selecione um local", ""));
    for (const local of data.locais || []) {
      const detalhes = local.localizacao ? ` — ${local.localizacao}` : "";
      locationSelect.add(new Option(`${local.nome}${detalhes}`, String(local.id)));
    }
    locationSelect.disabled = false;
    if ([...locationSelect.options].some((option) => option.value === String(idParaSelecionar))) {
      locationSelect.value = String(idParaSelecionar);
    }
    await carregarDadosDoLocal();
  }

  /** Limpa as tabelas se ainda não houver local escolhido. */
  function mostrarEstadoSemLocal() {
    balanceBody.replaceChildren();
    historyBody.replaceChildren();
    adicionarCelula(balanceBody.insertRow(), "Selecione ou crie um local de estoque.");
    balanceBody.rows[0].cells[0].colSpan = 5;
    adicionarCelula(historyBody.insertRow(), "Selecione ou crie um local de estoque.");
    historyBody.rows[0].cells[0].colSpan = 5;
  }

  /** Renderiza o saldo atual e sinaliza quando ele atingiu o mínimo cadastrado. */
  function renderizarSaldos(saldos) {
    balanceBody.replaceChildren();
    if (!saldos.length) {
      const row = balanceBody.insertRow();
      adicionarCelula(row, "Nenhum produto ativo cadastrado.");
      row.cells[0].colSpan = 5;
      return;
    }
    for (const item of saldos) {
      const saldo = Number(item.saldo_atual);
      const minimo = Number(item.estoque_minimo);
      const row = balanceBody.insertRow();
      adicionarCelula(row, item.produto_nome);
      adicionarCelula(row, item.sku);
      adicionarCelula(row, `${saldo} un`);
      adicionarCelula(row, `${minimo} un`);
      adicionarCelula(row, saldo <= minimo ? "Atingiu o mínimo" : "Normal", saldo <= minimo ? "low-stock" : "ok-stock");
    }
  }

  /** Formata a data ISO entregue pelo PostgreSQL para leitura brasileira. */
  function formatarData(data) {
    return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(data));
  }

  /** Renderiza as operações recentes do local, da mais nova para a mais antiga. */
  function renderizarHistorico(movimentacoes) {
    historyBody.replaceChildren();
    if (!movimentacoes.length) {
      const row = historyBody.insertRow();
      adicionarCelula(row, "Ainda não há movimentações neste local.");
      row.cells[0].colSpan = 5;
      return;
    }
    for (const item of movimentacoes) {
      const row = historyBody.insertRow();
      adicionarCelula(row, formatarData(item.data));
      adicionarCelula(row, `${item.produto_nome} (${item.sku})`);
      adicionarCelula(row, item.tipo === "entrada" ? "Entrada" : "Saída");
      adicionarCelula(row, `${item.quantidade} un`);
      adicionarCelula(row, `${item.saldo_atual} un`);
    }
  }

  /** Atualiza saldo e histórico juntos para o local atualmente escolhido. */
  async function carregarDadosDoLocal() {
    const estoqueId = locationSelect.value;
    if (!estoqueId) {
      mostrarEstadoSemLocal();
      return;
    }
    const query = `?estoque_id=${encodeURIComponent(estoqueId)}`;
    const [saldos, historico] = await Promise.all([
      requisicao(`/api/estoque/saldos${query}`),
      requisicao(`/api/estoque/movimentacoes${query}`),
    ]);
    renderizarSaldos(saldos.saldos || []);
    renderizarHistorico(historico.movimentacoes || []);
  }

  // Criar um local sempre envia só nome/localização; o servidor deriva a empresa do JWT.
  locationForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("create-location-button");
    button.disabled = true;
    try {
      const local = {
        nome: document.getElementById("location-name").value.trim(),
        localizacao: document.getElementById("location-address").value.trim(),
      };
      const data = await requisicao("/api/estoque/locais", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(local),
      });
      locationForm.reset();
      mostrarMensagem(pageMessage, data.mensagem || "Local criado.", "success");
      await carregarLocais(data.local?.id);
    } catch (error) {
      mostrarMensagem(pageMessage, error.message);
    } finally {
      button.disabled = false;
    }
  });

  // Trocar local atualiza as duas tabelas sem recarregar a página.
  locationSelect.addEventListener("change", () => {
    carregarDadosDoLocal().catch((error) => mostrarMensagem(pageMessage, error.message));
  });

  // O envio usa IDs de produto/local selecionados; autorização e pertencimento são conferidos no servidor.
  movementForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("movement-button");
    if (!locationSelect.value) {
      mostrarMensagem(movementMessage, "Crie ou selecione um local antes de movimentar o estoque.");
      return;
    }
    button.disabled = true;
    try {
      const movimento = {
        estoque_id: locationSelect.value,
        produto_id: productSelect.value,
        tipo: document.getElementById("movement-type").value,
        quantidade: Number(document.getElementById("movement-quantity").value),
      };
      const data = await requisicao("/api/estoque/movimentacoes", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(movimento),
      });
      movementForm.reset();
      mostrarMensagem(movementMessage, `${data.mensagem} Saldo após operação: ${data.movimentacao.saldo_atual}.`, "success");
      await carregarDadosDoLocal();
    } catch (error) {
      mostrarMensagem(movementMessage, error.message);
    } finally {
      button.disabled = false;
    }
  });

  // A empresa, produtos e locais são carregados antes de usar a tela.
  Promise.all([carregarEmpresa(), carregarProdutos(), carregarLocais()]).catch((error) => {
    mostrarMensagem(pageMessage, error.message || "Não foi possível carregar os dados.");
  });
});
