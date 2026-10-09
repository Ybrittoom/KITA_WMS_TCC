document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("kita_token") || sessionStorage.getItem("kita_token");
  if (!token) {
    // A URL pode ser digitada diretamente, mas e necessario entrar primeiro.
    window.location.replace("/login");
    return;
  }

  const modal = document.getElementById("modal-overlay");
  const form = document.getElementById("product-form");
  const tableBody = document.getElementById("products-tbody");
  const count = document.getElementById("total-count");
  const pageMessage = document.getElementById("products-message");
  const formMessage = document.getElementById("form-message");
  const saveButton = document.getElementById("btn-save-product");

  const showPageMessage = (message, state = "error") => {
    pageMessage.textContent = message;
    pageMessage.dataset.state = state;
  };

  const closeSession = () => {
    localStorage.removeItem("kita_token");
    localStorage.removeItem("kita_empresa");
    sessionStorage.removeItem("kita_token");
    sessionStorage.removeItem("kita_empresa");
    window.location.replace("/login");
  };

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

  const formatPrice = (value) => new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(value));

  const renderProducts = (products) => {
    tableBody.replaceChildren();
    count.textContent = String(products.length);

    if (products.length === 0) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 4;
      cell.textContent = "Nenhum produto cadastrado nesta empresa.";
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

      row.append(nameCell, skuCell, priceCell, minimumStockCell);
      tableBody.append(row);
    }
  };

  const loadProducts = async () => {
    const data = await request("/api/produtos");
    renderProducts(data.produtos || []);
  };

  const loadCompany = async () => {
    const data = await request("/api/auth/me");
    document.getElementById("company-name").textContent = data.empresa?.nome || "Empresa logada";
  };

  const openModal = () => {
    formMessage.textContent = "";
    modal.classList.add("active");
    modal.setAttribute("aria-hidden", "false");
    document.getElementById("nome").focus();
  };

  const closeModal = () => {
    modal.classList.remove("active");
    modal.setAttribute("aria-hidden", "true");
    form.reset();
    document.getElementById("preco").value = "0";
    document.getElementById("estoque_minimo").value = "0";
    formMessage.textContent = "";
  };

  document.getElementById("btn-open-modal").addEventListener("click", openModal);
  document.getElementById("btn-close-modal").addEventListener("click", closeModal);
  document.getElementById("btn-cancel-modal").addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });

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

    try {
      const data = await request("/api/produtos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(produto),
      });
      closeModal();
      showPageMessage(data.mensagem || "Produto cadastrado com sucesso.", "success");
      await loadProducts();
    } catch (error) {
      formMessage.textContent = error.message || "Não foi possível cadastrar o produto.";
    } finally {
      saveButton.disabled = false;
      saveButton.textContent = "Salvar produto";
    }
  });

  Promise.all([loadCompany(), loadProducts()]).catch((error) => {
    if (error.message !== "Sua sessão expirou. Entre novamente.") {
      showPageMessage(error.message || "Não foi possível carregar os dados.");
    }
  });
});
