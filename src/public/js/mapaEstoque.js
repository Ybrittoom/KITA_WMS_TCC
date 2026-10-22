document.addEventListener("DOMContentLoaded", () => {
  // Reutiliza o token de login salvo pela pagina de autenticacao.
  const token = localStorage.getItem("kita_token") || sessionStorage.getItem("kita_token");
  if (!token) {
    window.location.replace("/login");
    return;
  }

  const localSelect = document.getElementById("location-select");
  const mapContent = document.getElementById("map-content");
  const message = document.getElementById("page-message");
  const summary = document.getElementById("map-summary");
  const addressForm = document.getElementById("address-form");
  let produtos = [];

  /** Faz chamadas autenticadas e apresenta mensagens da API ao utilizador. */
  async function requisicao(url, options = {}) {
    const response = await fetch(url, {
      ...options,
      headers: { ...(options.headers || {}), Authorization: `Bearer ${token}` },
    });
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) {
      localStorage.removeItem("kita_token");
      sessionStorage.removeItem("kita_token");
      window.location.replace("/login");
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (!response.ok) throw new Error(data.erro || "Não foi possível concluir a operação.");
    return data;
  }

  /** Mostra uma mensagem sem interpretar o texto como HTML. */
  function mostrarMensagem(texto, sucesso = false) {
    message.textContent = texto;
    message.dataset.state = sucesso ? "success" : "error";
  }

  /** Cria um campo de texto para formulários inseridos no mapa. */
  function criarCampo(rotulo, campo, valor, maximo = 40) {
    const label = document.createElement("label");
    label.className = "field";
    label.append(document.createTextNode(rotulo));
    const input = document.createElement("input");
    input.name = campo;
    input.maxLength = maximo;
    input.required = campo !== "nome";
    input.value = valor || "";
    label.append(input);
    return label;
  }

  /** Cria um seletor apenas com produtos ativos da empresa autenticada. */
  function criarSeletorProduto(produtoAtual) {
    const label = document.createElement("label");
    label.className = "field product-picker";
    label.append(document.createTextNode("Produto nesta posição"));
    const select = document.createElement("select");
    select.name = "produto_id";
    select.required = true;
    select.add(new Option("Selecione um produto", ""));
    for (const produto of produtos) {
      select.add(new Option(`${produto.nome} (SKU: ${produto.sku})`, String(produto.id)));
    }
    if (produtoAtual) select.value = String(produtoAtual);
    label.append(select);
    return label;
  }

  /** Renderiza cartões agrupados por corredor, estante e prateleira. */
  function renderizarMapa(enderecos) {
    mapContent.replaceChildren();
    summary.textContent = `${enderecos.length} endereço(s) neste local.`;
    if (!enderecos.length) {
      const vazio = document.createElement("div");
      vazio.className = "empty-state";
      vazio.textContent = "Ainda não há posições. Crie os endereços físicos usando o formulário acima.";
      mapContent.append(vazio);
      return;
    }

    const corredores = new Map();
    for (const endereco of enderecos) {
      if (!corredores.has(endereco.corredor)) corredores.set(endereco.corredor, new Map());
      const estantes = corredores.get(endereco.corredor);
      if (!estantes.has(endereco.estante)) estantes.set(endereco.estante, new Map());
      const prateleiras = estantes.get(endereco.estante);
      if (!prateleiras.has(endereco.prateleira)) prateleiras.set(endereco.prateleira, []);
      prateleiras.get(endereco.prateleira).push(endereco);
    }

    for (const [corredor, estantes] of corredores) {
      const corridorSection = document.createElement("section");
      corridorSection.className = "corridor-section";
      const corridorTitle = document.createElement("h3");
      corridorTitle.textContent = `Corredor ${corredor}`;
      corridorSection.append(corridorTitle);

      for (const [estante, prateleiras] of estantes) {
        const rack = document.createElement("section");
        rack.className = "rack-section";
        const rackTitle = document.createElement("h4");
        rackTitle.textContent = `Estante ${estante}`;
        rack.append(rackTitle);

        for (const [prateleira, items] of prateleiras) {
          const shelf = document.createElement("div");
          shelf.className = "shelf-section";
          const shelfTitle = document.createElement("h5");
          shelfTitle.textContent = `Prateleira ${prateleira}`;
          shelf.append(shelfTitle);
          const slots = document.createElement("div");
          slots.className = "slot-grid";
          for (const endereco of items) slots.append(criarCartaoEndereco(endereco));
          shelf.append(slots);
          rack.append(shelf);
        }
        corridorSection.append(rack);
      }
      mapContent.append(corridorSection);
    }
  }

  /** Monta cartão com produto e opções para editar, mover ou excluir a posição. */
  function criarCartaoEndereco(endereco) {
    const card = document.createElement("article");
    card.className = `slot-card${endereco.produto_id ? " occupied" : " vacant"}`;
    card.dataset.id = endereco.id;
    const code = document.createElement("span");
    code.className = "slot-code";
    code.textContent = `${endereco.corredor} · ${endereco.estante} · ${endereco.prateleira} · ${endereco.posicao}`;
    const title = document.createElement("strong");
    title.className = "slot-name";
    title.textContent = endereco.nome || `Posição ${endereco.posicao}`;
    const detail = document.createElement("span");
    detail.className = "slot-product";
    detail.textContent = endereco.produto_id
      ? `${endereco.produto_nome} (SKU: ${endereco.sku})`
      : "Posição vazia";
    const actions = document.createElement("div");
    actions.className = "slot-actions";
    actions.append(botao("Editar endereço", "edit"), botao(endereco.produto_id ? "Mover produto" : "Guardar produto", "assign"));
    if (!endereco.produto_id) actions.append(botao("Excluir posição", "delete", true));

    const editPanel = document.createElement("form");
    editPanel.className = "slot-editor";
    editPanel.dataset.form = "edit";
    editPanel.hidden = true;
    editPanel.append(
      criarCampo("Corredor", "corredor", endereco.corredor),
      criarCampo("Estante", "estante", endereco.estante),
      criarCampo("Prateleira", "prateleira", endereco.prateleira),
      criarCampo("Posição", "posicao", endereco.posicao),
      criarCampo("Nome amigável", "nome", endereco.nome, 100),
      botao("Salvar endereço", "submit")
    );

    const assignPanel = document.createElement("form");
    assignPanel.className = "slot-editor assign-editor";
    assignPanel.dataset.form = "assign";
    assignPanel.hidden = true;
    assignPanel.append(criarSeletorProduto(endereco.produto_id), botao("Guardar aqui", "submit"));
    if (endereco.produto_id) assignPanel.append(botao("Deixar posição vazia", "clear", true));

    card.append(code, title, detail, actions, editPanel, assignPanel);
    return card;
  }

  /** Cria botões sem usar HTML dinâmico. */
  function botao(texto, acao, perigoso = false) {
    const button = document.createElement("button");
    button.type = acao === "submit" ? "submit" : "button";
    button.textContent = texto;
    button.dataset.action = acao;
    button.className = `button small${perigoso ? " danger" : " secondary"}`;
    return button;
  }

  /** Atualiza o mapa do local selecionado depois de uma operação. */
  async function carregarMapa() {
    if (!localSelect.value) {
      mapContent.replaceChildren();
      summary.textContent = "Selecione um local para abrir o mapa.";
      return;
    }
    const data = await requisicao(`/api/estoque/mapa?estoque_id=${encodeURIComponent(localSelect.value)}`);
    renderizarMapa(data.enderecos || []);
  }

  /** Carrega identidade, locais e produtos da empresa da sessão. */
  async function inicializar() {
    const [empresa, locais, listaProdutos] = await Promise.all([
      requisicao("/api/auth/me"), requisicao("/api/estoque/locais"), requisicao("/api/produtos"),
    ]);
    document.getElementById("company-name").textContent = empresa.empresa?.nome || "Empresa logada";
    produtos = listaProdutos.produtos || [];
    localSelect.replaceChildren(new Option("Selecione um local", ""));
    for (const local of locais.locais || []) localSelect.add(new Option(local.nome, String(local.id)));
    localSelect.disabled = false;
    if (!locais.locais?.length) {
      mostrarMensagem("Crie primeiro um local de estoque na tela de movimentações.");
      return;
    }
    // Abre o primeiro local automaticamente para que o mapa apareca logo ao entrar.
    localSelect.value = String(locais.locais[0].id);
    await carregarMapa();
  }

  // Criar endereço envia apenas os componentes da localização; empresa vem do JWT.
  addressForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!localSelect.value) return mostrarMensagem("Selecione um local de estoque primeiro.");
    const button = document.getElementById("create-address-button");
    button.disabled = true;
    try {
      const dados = Object.fromEntries(new FormData(addressForm).entries());
      dados.estoque_id = localSelect.value;
      const result = await requisicao("/api/estoque/enderecos", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados),
      });
      addressForm.reset();
      mostrarMensagem(result.mensagem, true);
      await carregarMapa();
    } catch (error) {
      mostrarMensagem(error.message);
    } finally {
      button.disabled = false;
    }
  });

  localSelect.addEventListener("change", () => {
    carregarMapa().catch((error) => mostrarMensagem(error.message));
  });

  // Eventos delegados continuam funcionando depois que os cartões sao redesenhados.
  mapContent.addEventListener("click", async (event) => {
    const button = event.target.closest("button[data-action]");
    if (!button) return;
    const card = button.closest(".slot-card");
    const id = card.dataset.id;
    const action = button.dataset.action;
    if (action === "edit") card.querySelector('[data-form="edit"]').hidden = !card.querySelector('[data-form="edit"]').hidden;
    if (action === "assign") card.querySelector('[data-form="assign"]').hidden = !card.querySelector('[data-form="assign"]').hidden;
    if (action === "delete" && window.confirm("Excluir este endereço vazio do mapa? Esta ação não apaga produtos nem movimentações.")) {
      try {
        const result = await requisicao(`/api/estoque/enderecos/${encodeURIComponent(id)}`, { method: "DELETE" });
        mostrarMensagem(result.mensagem, true);
        await carregarMapa();
      } catch (error) { mostrarMensagem(error.message); }
    }
    if (action === "clear" && window.confirm("Retirar o produto desta posição? O saldo do estoque não será alterado.")) {
      try {
        const result = await requisicao(`/api/estoque/enderecos/${encodeURIComponent(id)}/produto`, {
          method: "DELETE", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ estoque_id: localSelect.value }),
        });
        mostrarMensagem(result.mensagem, true);
        await carregarMapa();
      } catch (error) { mostrarMensagem(error.message); }
    }
  });

  // Editar coordenadas ou associar/mover um produto sem recarregar a pagina.
  mapContent.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.target;
    const card = form.closest(".slot-card");
    const id = card.dataset.id;
    const dados = Object.fromEntries(new FormData(form).entries());
    const isEdit = form.dataset.form === "edit";
    const endpoint = isEdit
      ? `/api/estoque/enderecos/${encodeURIComponent(id)}`
      : `/api/estoque/enderecos/${encodeURIComponent(id)}/produto`;
    if (!isEdit) {
      if (!dados.produto_id) return mostrarMensagem("Selecione um produto para guardar.");
      dados.estoque_id = localSelect.value;
    }
    try {
      const result = await requisicao(endpoint, {
        method: isEdit ? "PUT" : "PUT",
        headers: { "Content-Type": "application/json" }, body: JSON.stringify(dados),
      });
      mostrarMensagem(result.mensagem, true);
      await carregarMapa();
    } catch (error) { mostrarMensagem(error.message); }
  });

  inicializar().catch((error) => mostrarMensagem(error.message || "Não foi possível carregar o mapa."));
});
