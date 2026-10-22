document.addEventListener("DOMContentLoaded", () => {
  // O login guarda o JWT em um dos dois storages conforme a opcao "lembrar".
  const token = localStorage.getItem("kita_token") || sessionStorage.getItem("kita_token");
  if (!token) {
    window.location.replace("/login");
    return;
  }

  const modal = document.getElementById("modal-overlay");
  const deleteOverlay = document.getElementById("delete-overlay");
  const form = document.getElementById("product-form");
  const tableBody = document.getElementById("products-tbody");
  const count = document.getElementById("total-count");
  const pageMessage = document.getElementById("products-message");
  const formMessage = document.getElementById("form-message");
  const deleteMessage = document.getElementById("delete-message");
  const scannerOverlay = document.getElementById("scanner-overlay");
  const scannerVideo = document.getElementById("scanner-video");
  const scannerStatus = document.getElementById("scanner-status");
  const scannerInput = document.getElementById("scanner-sku");
  const scannerResult = document.getElementById("scanner-result");
  const cameraSelect = document.getElementById("scanner-camera-select");
  const zoomGroup = document.getElementById("scanner-zoom-group");
  const zoomSlider = document.getElementById("scanner-zoom");
  const zoomValue = document.getElementById("scanner-zoom-value");
  const saveButton = document.getElementById("btn-save-product");
  const confirmDeleteButton = document.getElementById("btn-confirm-delete");
  // O leitor e o controle devolvido pelo ZXing sao mantidos para encerrar a camera.
  let barcodeReader = null;
  let cameraControls = null;
  let cameraStarting = false;
  // Cada tentativa recebe um numero para invalidar inicializacoes antigas ao parar/reabrir.
  let cameraGeneration = 0;
  let codeAlreadyHandled = false;
  // Guarda o ID que esta sendo editado e o produto aguardando confirmacao.
  let editingProductId = null;
  let productPendingDeletion = null;

  /** Exibe avisos na pagina; dataset.state controla a cor no CSS. */
  const showPageMessage = (message, state = "error") => {
    pageMessage.textContent = message;
    pageMessage.dataset.state = state;
  };

  /** Exibe o modal do leitor e limpa o estado de uma leitura anterior. */
  const openScanner = () => {
    scannerOverlay.classList.add("active");
    scannerOverlay.setAttribute("aria-hidden", "false");
    scannerStatus.textContent = "Inicie a camera ou digite o SKU manualmente.";
    scannerInput.value = "";
    scannerResult.hidden = true;
    document.getElementById("btn-prefill-product").hidden = true;
    codeAlreadyHandled = false;
    void window.KitaCameraHelpers.listarCameras(cameraSelect).catch(() => {
      scannerStatus.textContent = "Nao foi possivel listar as cameras. Tente iniciar a camera automaticamente.";
    });
    document.getElementById("btn-start-camera").focus();
  };

  /**
   * Desliga a leitura e solta a camera do sistema operacional.
   * Encerrar as tracks e importante: apenas esconder o modal deixaria a camera ligada.
   */
  const stopCamera = () => {
    // Invalida qualquer pedido de camera que ainda esteja aguardando permissao do navegador.
    cameraGeneration += 1;

    if (cameraControls) {
      cameraControls.stop();
      cameraControls = null;
    }

    // Libera diretamente as faixas de video, inclusive se o ZXing ainda nao devolveu controls.
    const stream = scannerVideo.srcObject;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
    }

    scannerVideo.pause();
    scannerVideo.srcObject = null;
    barcodeReader = null;
    zoomGroup.hidden = true;
    cameraStarting = false;
    document.getElementById("btn-start-camera").disabled = false;
    document.getElementById("btn-stop-camera").disabled = true;
  };

  /** Fecha o leitor; toda forma de fechamento passa primeiro pela limpeza da camera. */
  const closeScanner = () => {
    stopCamera();
    scannerOverlay.classList.remove("active");
    scannerOverlay.setAttribute("aria-hidden", "true");
  };

  /**
   * Consulta a API usando o codigo lido ou digitado. O token autentica a empresa,
   * e o servidor usa o ID desse token para limitar a busca ao tenant correto.
   */
  const searchProductBySku = async (rawSku) => {
    const sku = String(rawSku || "").trim();
    if (!sku) {
      scannerStatus.textContent = "Digite ou leia um SKU para pesquisar.";
      scannerInput.focus();
      return;
    }

    scannerInput.value = sku;
    scannerResult.hidden = true;
    document.getElementById("btn-prefill-product").hidden = true;
    scannerStatus.textContent = "Buscando produto nesta empresa...";
    document.getElementById("btn-search-sku").disabled = true;

    try {
      const data = await request(`/api/produtos/buscar?sku=${encodeURIComponent(sku)}`);
      const product = data.produto;
      // textContent evita interpretar nome/SKU do banco como markup ou script.
      document.getElementById("scanner-product-name").textContent = product.nome;
      document.getElementById("scanner-product-sku").textContent = product.sku;
      document.getElementById("scanner-product-price").textContent = formatPrice(product.preco);
      scannerResult.hidden = false;
      document.getElementById("btn-prefill-product").hidden = true;
      scannerStatus.textContent = "Produto encontrado na sua empresa.";
    } catch (error) {
      // Uma leitura valida pode nao ter cadastro correspondente; oferecemos criar o item.
      scannerStatus.textContent = error.message || "Nao foi possivel localizar esse SKU.";
      scannerResult.hidden = true;
      // O botao de cadastro so aparece quando a resposta significa SKU inexistente.
      document.getElementById("btn-prefill-product").hidden = error.status !== 404;
    } finally {
      document.getElementById("btn-search-sku").disabled = false;
    }
  };

  /**
   * Pede acesso a uma camera e inicia a decodificacao ZXing no elemento de video.
   * O navegador exige HTTPS em hospedagem; localhost e aceito para desenvolvimento.
   */
  const startCamera = async () => {
    if (cameraStarting || cameraControls) return;
    if (!window.ZXingBrowser?.BrowserMultiFormatReader) {
      scannerStatus.textContent = "O leitor nao carregou. Digite o SKU manualmente.";
      return;
    }

    cameraStarting = true;
    const thisCameraGeneration = ++cameraGeneration;
    codeAlreadyHandled = false;
    document.getElementById("btn-start-camera").disabled = true;
    scannerStatus.textContent = "Solicitando permissao para usar a camera...";

    try {
      barcodeReader = new window.ZXingBrowser.BrowserMultiFormatReader();
      const controls = await barcodeReader.decodeFromVideoDevice(
        cameraSelect.value || undefined, // ID explicito permite evitar a lente ultrawide selecionada automaticamente.
        scannerVideo,
        (result) => {
          // Callback de uma tentativa antiga nao pode agir sobre uma camera nova.
          if (thisCameraGeneration !== cameraGeneration) return;
          // A leitura continua em varios quadros por segundo; processamos apenas o primeiro.
          if (!result || codeAlreadyHandled) return;
          codeAlreadyHandled = true;
          const scannedCode = result.getText();
          scannerInput.value = scannedCode;
          scannerStatus.textContent = `Codigo lido: ${scannedCode}`;
          stopCamera();
          // A busca e disparada sem bloquear a callback do decodificador.
          void searchProductBySku(scannedCode);
        }
      );

      // O usuario pode ter parado/fechado e iniciado outra tentativa enquanto havia permissao pendente.
      if (thisCameraGeneration !== cameraGeneration) {
        controls.stop();
        return;
      }

      // Se a camera encontrou o codigo enquanto o metodo aguardava, ela ja deve estar parada.
      if (codeAlreadyHandled) {
        controls.stop();
        return;
      }

      // Se a pessoa fechou o modal enquanto a permissao estava pendente, nao manter camera ativa.
      if (scannerOverlay.getAttribute("aria-hidden") === "true") {
        controls.stop();
        return;
      }
      cameraControls = controls;
      cameraStarting = false;
      document.getElementById("btn-stop-camera").disabled = false;

      // Atualiza nomes depois da permissao, solicita foco automatico e mostra zoom se suportado.
      const videoTrack = scannerVideo.srcObject?.getVideoTracks?.()[0];
      const focoAtivo = await window.KitaCameraHelpers.ativarFocoContinuo(scannerVideo);
      const zoomDisponivel = window.KitaCameraHelpers.configurarZoom(
        scannerVideo, zoomGroup, zoomSlider, zoomValue
      );
      if (thisCameraGeneration !== cameraGeneration) return;
      const cameraAtiva = videoTrack?.getSettings?.().deviceId || cameraSelect.value;
      await window.KitaCameraHelpers.listarCameras(cameraSelect, cameraAtiva).catch(() => {});
      if (thisCameraGeneration !== cameraGeneration) return;

      scannerStatus.textContent = focoAtivo
        ? "Foco contínuo ativo. Aponte a câmera para o código de barras do produto."
        : "Aponte a câmera para o código de barras. O foco automático depende do aparelho.";
      if (!zoomDisponivel) zoomGroup.hidden = true;
    } catch (error) {
      // Um erro de uma tentativa cancelada nao deve parar a tentativa mais recente.
      if (thisCameraGeneration !== cameraGeneration) return;
      stopCamera();
      if (error.name === "NotAllowedError" || error.name === "PermissionDeniedError") {
        scannerStatus.textContent = "Permissao da camera negada. Voce ainda pode digitar o SKU.";
      } else if (error.name === "NotFoundError" || error.name === "DevicesNotFoundError") {
        scannerStatus.textContent = "Nenhuma camera foi encontrada. Digite o SKU manualmente.";
      } else {
        console.error("Falha ao iniciar leitor:", error);
        scannerStatus.textContent = "Nao foi possivel iniciar a camera. Digite o SKU manualmente.";
      }
    }
  };

  /** Apaga a sessao local vencida e volta para a tela de login. */
  const closeSession = () => {
    localStorage.removeItem("kita_token");
    localStorage.removeItem("kita_empresa");
    sessionStorage.removeItem("kita_token");
    sessionStorage.removeItem("kita_empresa");
    window.location.replace("/login");
  };

  /** Faz chamadas autenticadas e trata token vencido e erros da API. */
  const request = async (url, options = {}) => {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...(options.headers || {}),
        Authorization: `Bearer ${token}`,
      },
    });
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
      closeSession();
      throw new Error("Sua sessão expirou. Entre novamente.");
    }
    if (!response.ok) {
      const error = new Error(data.erro || "Não foi possível concluir a operação.");
      // O status permite a interface diferenciar SKU ausente de falha do servidor.
      error.status = response.status;
      throw error;
    }
    return data;
  };

  /** Formata o valor numerico vindo do PostgreSQL como moeda brasileira. */
  const formatPrice = (value) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));

  /** Cria botoes de acao sem inserir texto do banco como HTML executavel. */
  const createActionButton = (label, className, onClick) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = className;
    button.textContent = label;
    button.addEventListener("click", onClick);
    return button;
  };

  /** Monta a tabela com os produtos ativos retornados para esta empresa. */
  const renderProducts = (products) => {
    tableBody.replaceChildren();
    count.textContent = String(products.length);

    if (products.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 5;
      cell.textContent = "Nenhum produto ativo cadastrado nesta empresa.";
      row.append(cell);
      tableBody.append(row);
      return;
    }

    for (const product of products) {
      const row = document.createElement("tr");
      const nameCell = document.createElement("td");
      const name = document.createElement("span");
      name.className = "product-name";
      name.textContent = product.nome;
      nameCell.append(name);

      const skuCell = document.createElement("td");
      const sku = document.createElement("code");
      sku.className = "sku-badge";
      sku.textContent = product.sku;
      skuCell.append(sku);

      const priceCell = document.createElement("td");
      priceCell.textContent = formatPrice(product.preco);

      const minimumStockCell = document.createElement("td");
      minimumStockCell.textContent = `${product.estoque_minimo} un`;

      const actionsCell = document.createElement("td");
      actionsCell.className = "product-actions";
      actionsCell.append(
        createActionButton("Editar", "btn-table btn-edit", () => openEditModal(product)),
        createActionButton("Excluir", "btn-table btn-delete", () => openDeleteConfirmation(product))
      );

      row.append(nameCell, skuCell, priceCell, minimumStockCell, actionsCell);
      tableBody.append(row);
    }
  };

  /** Busca novamente a lista depois de cadastrar, editar ou inativar. */
  const loadProducts = async () => {
    const data = await request("/api/produtos");
    renderProducts(data.produtos || []);
  };

  /** Busca o nome da empresa pelo endpoint protegido de sessao. */
  const loadCompany = async () => {
    const data = await request("/api/auth/me");
    document.getElementById("company-name").textContent = data.empresa?.nome || "Empresa logada";
  };

  /** Abre o mesmo formulario para cadastro novo ou edicao existente. */
  const openModal = (product = null) => {
    editingProductId = product?.id ?? null;
    formMessage.textContent = "";
    document.getElementById("modal-title").textContent = editingProductId ? "Editar produto" : "Novo produto";
    saveButton.textContent = editingProductId ? "Salvar alterações" : "Salvar produto";
    form.reset();

    if (product) {
      document.getElementById("nome").value = product.nome;
      document.getElementById("sku").value = product.sku;
      document.getElementById("preco").value = String(product.preco);
      document.getElementById("estoque_minimo").value = String(product.estoque_minimo);
    } else {
      document.getElementById("preco").value = "0";
      document.getElementById("estoque_minimo").value = "0";
    }

    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("nome").focus();
  };

  /** Preenche o formulario com o produto selecionado para editar. */
  const openEditModal = (product) => openModal(product);

  /** Fecha e limpa o formulario, sem manter campos da operacao anterior. */
  const closeModal = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    form.reset();
    formMessage.textContent = "";
    editingProductId = null;
  };

  /** Mostra confirmacao com o nome do produto antes de inativa-lo. */
  const openDeleteConfirmation = (product) => {
    productPendingDeletion = product;
    document.getElementById("delete-product-name").textContent = product.nome;
    deleteMessage.textContent = "";
    deleteOverlay.classList.add("active");
    deleteOverlay.setAttribute("aria-hidden", "false");
    confirmDeleteButton.focus();
  };

  /** Fecha a confirmacao sem alterar o produto. */
  const closeDeleteConfirmation = () => {
    deleteOverlay.classList.remove("active");
    deleteOverlay.setAttribute("aria-hidden", "true");
    deleteMessage.textContent = "";
    productPendingDeletion = null;
  };

  document.getElementById("btn-open-modal").addEventListener("click", () => openModal());
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

  document.getElementById("btn-close-delete").addEventListener("click", closeDeleteConfirmation);
  document.getElementById("btn-cancel-delete").addEventListener("click", closeDeleteConfirmation);
  deleteOverlay.addEventListener("click", (event) => {
    if (event.target === deleteOverlay) closeDeleteConfirmation();
  });

  // Eventos do leitor agrupados aqui deixam claro o caminho de abrir, usar e fechar.
  document.getElementById("btn-open-scanner").addEventListener("click", openScanner);
  document.getElementById("btn-close-scanner").addEventListener("click", closeScanner);
  document.getElementById("btn-start-camera").addEventListener("click", startCamera);
  cameraSelect.addEventListener("change", () => {
    if (!cameraControls && !cameraStarting) return;
    stopCamera();
    void startCamera();
  });
  zoomSlider.addEventListener("change", () => {
    void window.KitaCameraHelpers.aplicarZoom(scannerVideo, zoomSlider, zoomValue).then((aplicado) => {
      if (!aplicado) scannerStatus.textContent = "Este aparelho não conseguiu aplicar o zoom solicitado.";
    });
  });
  document.getElementById("btn-stop-camera").addEventListener("click", () => {
    stopCamera();
    scannerStatus.textContent = "Camera parada. Voce pode digitar o SKU ou reiniciar a camera.";
  });
  document.getElementById("btn-search-sku").addEventListener("click", (event) => {
    // O botao type=submit tambem envia o formulario; nao fazemos uma segunda busca aqui.
    event.preventDefault();
    void searchProductBySku(scannerInput.value);
  });
  document.getElementById("scanner-manual-form").addEventListener("submit", (event) => {
    event.preventDefault();
    void searchProductBySku(scannerInput.value);
  });
  scannerOverlay.addEventListener("click", (event) => {
    // Clique no fundo equivale ao botao fechar; clique no cartao nao fecha o modal.
    if (event.target === scannerOverlay) closeScanner();
  });
  document.getElementById("btn-prefill-product").addEventListener("click", () => {
    const skuToPrefill = scannerInput.value.trim().toUpperCase();
    closeScanner();
    openModal();
    document.getElementById("sku").value = skuToPrefill;
    document.getElementById("nome").focus();
  });

  // Ao navegar para outra pagina, liberamos a camera mesmo sem fechar o modal manualmente.
  window.addEventListener("pagehide", stopCamera);

  // O envio escolhe POST para novo produto e PUT para produto em edicao.
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    formMessage.textContent = "";
    saveButton.disabled = true;
    saveButton.textContent = "Salvando...";

    const produto = {
      nome: document.getElementById("nome").value.trim(),
      sku: document.getElementById("sku").value.trim().toUpperCase(),
      preco: Number(document.getElementById("preco").value),
      estoque_minimo: Number(document.getElementById("estoque_minimo").value),
    };
    const isEditing = editingProductId !== null;
    const url = isEditing ? `/api/produtos/${encodeURIComponent(editingProductId)}` : "/api/produtos";

    try {
      const data = await request(url, {
        method: isEditing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produto),
      });
      closeModal();
      showPageMessage(data.mensagem, "success");
      await loadProducts();
    } catch (error) {
      formMessage.textContent = error.message || "Não foi possível salvar o produto.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = editingProductId ? "Salvar alterações" : "Salvar produto";
    }
  });

  // O DELETE da API e uma inativacao; so ocorre depois do clique de confirmacao.
  confirmDeleteButton.addEventListener("click", async () => {
    if (!productPendingDeletion) return;

    confirmDeleteButton.disabled = true;
    confirmDeleteButton.textContent = "Inativando...";
    try {
      const data = await request(`/api/produtos/${encodeURIComponent(productPendingDeletion.id)}`, {
        method: "DELETE",
      });
      closeDeleteConfirmation();
      showPageMessage(data.mensagem, "success");
      await loadProducts();
    } catch (error) {
      deleteMessage.textContent = error.message || "Não foi possível inativar o produto.";
    } finally {
      confirmDeleteButton.disabled = false;
      confirmDeleteButton.textContent = "Inativar produto";
    }
  });

  Promise.all([loadCompany(), loadProducts()]).catch((error) => {
    if (error.message !== "Sua sessão expirou. Entre novamente.") {
      showPageMessage(error.message || "Não foi possível carregar os dados.");
    }
  });
});
