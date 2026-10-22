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
  const scannerOverlay = document.getElementById("stock-scanner-overlay");
  const scannerVideo = document.getElementById("stock-scanner-video");
  const scannerStatus = document.getElementById("stock-scanner-status");
  const scannerInput = document.getElementById("stock-scanner-sku");
  const scannerProduct = document.getElementById("stock-scanner-product");
  const useScannedProductButton = document.getElementById("use-scanned-product");
  const cameraSelect = document.getElementById("stock-camera-select");
  const zoomGroup = document.getElementById("stock-zoom-group");
  const zoomSlider = document.getElementById("stock-camera-zoom");
  const zoomValue = document.getElementById("stock-camera-zoom-value");
  let products = [];
  let barcodeReader = null;
  let cameraControls = null;
  let cameraStarting = false;
  let cameraGeneration = 0;
  let codeAlreadyHandled = false;
  let scannedProduct = null;

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
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível concluir a operação.");
      error.status = response.status;
      throw error;
    }
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

  /** Abre o leitor e remove o resultado da leitura anterior. */
  function abrirLeitor() {
    scannerOverlay.classList.add("active");
    scannerOverlay.setAttribute("aria-hidden", "false");
    scannerStatus.textContent = "Inicie a câmera ou digite o SKU.";
    scannerInput.value = "";
    scannerProduct.hidden = true;
    useScannedProductButton.hidden = true;
    document.getElementById("stock-scanner-catalog-link").hidden = true;
    scannedProduct = null;
    codeAlreadyHandled = false;
    void window.KitaCameraHelpers.listarCameras(cameraSelect).catch(() => {
      scannerStatus.textContent = "Não foi possível listar as câmeras. Tente iniciar a câmera automaticamente.";
    });
    document.getElementById("start-stock-camera").focus();
  }

  /** Para o leitor e libera as faixas de vídeo da câmera do dispositivo. */
  function pararCameraEstoque() {
    // O número de geração invalida permissões/callbacks de inicializações antigas.
    cameraGeneration += 1;
    if (cameraControls) {
      try { cameraControls.stop(); } catch { /* A câmera pode já ter sido desligada pelo navegador. */ }
      cameraControls = null;
    }
    const stream = scannerVideo.srcObject;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    scannerVideo.pause();
    scannerVideo.srcObject = null;
    barcodeReader = null;
    zoomGroup.hidden = true;
    cameraStarting = false;
    document.getElementById("start-stock-camera").disabled = false;
    document.getElementById("stop-stock-camera").disabled = true;
  }

  /** Fecha a janela sempre desligando a câmera antes de escondê-la. */
  function fecharLeitor() {
    pararCameraEstoque();
    scannerOverlay.classList.remove("active");
    scannerOverlay.setAttribute("aria-hidden", "true");
  }

  /** Procura o SKU no cadastro da empresa; somente produtos ativos podem ser movimentados. */
  async function buscarSkuLido(codigo) {
    const sku = String(codigo || "").trim();
    if (!sku) {
      scannerStatus.textContent = "Digite ou leia um SKU para pesquisar.";
      scannerInput.focus();
      return;
    }
    scannerInput.value = sku;
    scannerProduct.hidden = true;
    useScannedProductButton.hidden = true;
    document.getElementById("stock-scanner-catalog-link").hidden = true;
    scannedProduct = null;
    scannerStatus.textContent = "Buscando produto nesta empresa...";
    const searchButton = document.getElementById("search-stock-sku");
    searchButton.disabled = true;

    try {
      const data = await requisicao(`/api/produtos/buscar?sku=${encodeURIComponent(sku)}`);
      scannedProduct = data.produto;
      document.getElementById("stock-scanner-product-name").textContent = scannedProduct.nome;
      document.getElementById("stock-scanner-product-sku").textContent = scannedProduct.sku;
      document.getElementById("stock-scanner-product-price").textContent = new Intl.NumberFormat("pt-BR", {
        style: "currency", currency: "BRL",
      }).format(Number(scannedProduct.preco));
      scannerProduct.hidden = false;
      useScannedProductButton.hidden = false;
      scannerStatus.textContent = "Produto encontrado. Confirme para selecioná-lo na movimentação.";
    } catch (error) {
      scannerStatus.textContent = error.message || "Não foi possível localizar este SKU.";
      // Se o SKU não existe, apontamos para o cadastro sem tentar movimentar um produto inválido.
      document.getElementById("stock-scanner-catalog-link").hidden = error.status !== 404;
    } finally {
      searchButton.disabled = false;
    }
  }

  /** Pede acesso à câmera e lê somente um código por abertura do leitor. */
  async function iniciarCameraEstoque() {
    if (cameraStarting || cameraControls) return;
    if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
      scannerStatus.textContent = "O leitor não carregou. Digite o SKU manualmente.";
      return;
    }
    cameraStarting = true;
    const tentativa = ++cameraGeneration;
    codeAlreadyHandled = false;
    document.getElementById("start-stock-camera").disabled = true;
    scannerStatus.textContent = "Solicitando permissão para usar a câmera...";

    try {
      barcodeReader = new window.ZXingBrowser.BrowserMultiFormatReader();
      const controls = await barcodeReader.decodeFromVideoDevice(cameraSelect.value || undefined, scannerVideo, (result) => {
        if (tentativa !== cameraGeneration || !result || codeAlreadyHandled) return;
        codeAlreadyHandled = true;
        const codigo = result.getText();
        scannerStatus.textContent = `Código lido: ${codigo}`;
        pararCameraEstoque();
        void buscarSkuLido(codigo);
      });

      // Não mantém a câmera se o leitor foi fechado ou cancelado enquanto o navegador pedia permissão.
      if (tentativa !== cameraGeneration || scannerOverlay.getAttribute("aria-hidden") === "true" || codeAlreadyHandled) {
        controls.stop();
        return;
      }
      cameraControls = controls;
      cameraStarting = false;
      document.getElementById("stop-stock-camera").disabled = false;

      // Algumas câmeras permitem foco contínuo e zoom; o helper só tenta o que o aparelho anuncia.
      const videoTrack = scannerVideo.srcObject?.getVideoTracks?.()[0];
      const focoAtivo = await window.KitaCameraHelpers.ativarFocoContinuo(scannerVideo);
      const zoomDisponivel = window.KitaCameraHelpers.configurarZoom(
        scannerVideo, zoomGroup, zoomSlider, zoomValue
      );
      if (tentativa !== cameraGeneration) return;
      const cameraAtiva = videoTrack?.getSettings?.().deviceId || cameraSelect.value;
      await window.KitaCameraHelpers.listarCameras(cameraSelect, cameraAtiva).catch(() => {});
      if (tentativa !== cameraGeneration) return;

      scannerStatus.textContent = focoAtivo
        ? "Foco contínuo ativo. Aponte a câmera para o código de barras."
        : "Aponte a câmera para o código. O foco automático depende do aparelho.";
      if (!zoomDisponivel) zoomGroup.hidden = true;
    } catch (error) {
      if (tentativa !== cameraGeneration) return;
      pararCameraEstoque();
      if (["NotAllowedError", "PermissionDeniedError"].includes(error.name)) {
        scannerStatus.textContent = "Permissão da câmera negada. Você ainda pode digitar o SKU.";
      } else if (["NotFoundError", "DevicesNotFoundError"].includes(error.name)) {
        scannerStatus.textContent = "Nenhuma câmera foi encontrada. Digite o SKU manualmente.";
      } else {
        console.error("Falha ao iniciar o leitor de estoque:", error);
        scannerStatus.textContent = "Não foi possível iniciar a câmera. Digite o SKU manualmente.";
      }
    }
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

  // A mesma busca serve para câmera e digitação manual.
  document.getElementById("open-stock-scanner").addEventListener("click", abrirLeitor);
  document.getElementById("close-stock-scanner").addEventListener("click", fecharLeitor);
  document.getElementById("start-stock-camera").addEventListener("click", iniciarCameraEstoque);
  cameraSelect.addEventListener("change", () => {
    if (!cameraControls && !cameraStarting) return;
    pararCameraEstoque();
    void iniciarCameraEstoque();
  });
  zoomSlider.addEventListener("change", () => {
    void window.KitaCameraHelpers.aplicarZoom(scannerVideo, zoomSlider, zoomValue).then((aplicado) => {
      if (!aplicado) scannerStatus.textContent = "Este aparelho não conseguiu aplicar o zoom solicitado.";
    });
  });
  document.getElementById("stop-stock-camera").addEventListener("click", () => {
    pararCameraEstoque();
    scannerStatus.textContent = "Câmera parada. Digite o SKU ou inicie a câmera novamente.";
  });
  document.getElementById("stock-scanner-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void buscarSkuLido(scannerInput.value);
  });
  scannerOverlay.addEventListener("click", (event) => {
    if (event.target === scannerOverlay) fecharLeitor();
  });

  // Após confirmar, o produto escaneado é escolhido; a entrada/saída ainda requer confirmação explícita.
  useScannedProductButton.addEventListener("click", () => {
    if (!scannedProduct) return;
    const productId = String(scannedProduct.id);
    const optionExists = [...productSelect.options].some((option) => option.value === productId);
    if (!optionExists) {
      productSelect.add(new Option(`${scannedProduct.nome} (SKU: ${scannedProduct.sku})`, productId));
    }
    productSelect.value = productId;
    fecharLeitor();
    document.getElementById("movement-type").focus();
    mostrarMensagem(movementMessage, `${scannedProduct.nome} selecionado. Escolha a operação e a quantidade.`, "success");
  });

  document.getElementById("stock-scanner-catalog-link").addEventListener("click", fecharLeitor);
  window.addEventListener("pagehide", pararCameraEstoque);

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
