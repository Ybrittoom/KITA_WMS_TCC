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
  const saveButton = document.getElementById("btn-save-product");
  const confirmDeleteButton = document.getElementById("btn-confirm-delete");
  // Guarda o ID que esta sendo editado e o produto aguardando confirmacao.
  let editingProductId = null;
  let productPendingDeletion = null;

  /** Exibe avisos na pagina; dataset.state controla a cor no CSS. */
  const showPageMessage = (message, state = "error") => {
    pageMessage.textContent = message;
    pageMessage.dataset.state = state;
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
      throw new Error(data.erro || "Não foi possível concluir a operação.");
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
