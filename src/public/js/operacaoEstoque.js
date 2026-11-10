document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("operation-form");
  const localSelect = document.getElementById("operation-location");
  const produtoSelect = document.getElementById("operation-product");
  const message = document.getElementById("operation-message");
  const tipo = form.dataset.operation;
  const requestedLocation = new URLSearchParams(window.location.search).get("estoque_id");

  function mostrarMensagem(texto, sucesso = false) {
    message.textContent = texto;
    message.dataset.state = sucesso ? "success" : "error";
  }

  async function consultarSaldo() {
    const status = document.getElementById("available-balance");
    if (!status || !localSelect.value || !produtoSelect.value) {
      if (status) status.textContent = "Selecione o local e o produto para consultar o saldo.";
      return;
    }
    status.textContent = "Consultando saldo...";
    try {
      const data = await window.KitaWms.api(`/api/estoque/saldos?estoque_id=${encodeURIComponent(localSelect.value)}`);
      const produto = (data.saldos || []).find((item) => String(item.produto_id) === produtoSelect.value);
      status.textContent = `Saldo disponível neste local: ${Number(produto?.saldo_atual || 0).toLocaleString("pt-BR")} unidade(s).`;
    } catch (error) {
      status.textContent = error.message;
    }
  }

  async function carregarOpcoes() {
    const [locaisData, produtosData] = await Promise.all([
      window.KitaWms.api("/api/estoque/locais"),
      window.KitaWms.api("/api/produtos"),
    ]);
    const locais = locaisData.locais || [];
    const produtos = produtosData.produtos || [];
    localSelect.replaceChildren(new Option(locais.length ? "Selecione um local" : "Cadastre um local primeiro", ""));
    for (const local of locais) localSelect.add(new Option(local.nome, String(local.id)));
    produtoSelect.replaceChildren(new Option(produtos.length ? "Selecione um produto" : "Cadastre um produto primeiro", ""));
    for (const produto of produtos) produtoSelect.add(new Option(`${produto.nome} (SKU: ${produto.sku})`, String(produto.id)));
    localSelect.disabled = !locais.length;
    produtoSelect.disabled = !produtos.length;

    if (requestedLocation && locais.some((local) => String(local.id) === requestedLocation)) {
      localSelect.value = requestedLocation;
    } else if (locais.length === 1) {
      localSelect.value = String(locais[0].id);
    }
    if (!locais.length) mostrarMensagem("Cadastre primeiro um local de estoque.");
    else if (!produtos.length) mostrarMensagem("Cadastre primeiro um produto.");
    await consultarSaldo();
  }

  localSelect.addEventListener("change", () => { void consultarSaldo(); });
  produtoSelect.addEventListener("change", () => { void consultarSaldo(); });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("operation-submit");
    button.disabled = true;
    try {
      const payload = {
        estoque_id: localSelect.value,
        produto_id: produtoSelect.value,
        tipo,
        quantidade: Number(document.getElementById("operation-quantity").value),
      };
      const result = await window.KitaWms.api("/api/estoque/movimentacoes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      document.getElementById("operation-quantity").value = "";
      mostrarMensagem(`${result.mensagem} Saldo após a operação: ${result.movimentacao.saldo_atual} unidade(s).`, true);
      await consultarSaldo();
    } catch (error) {
      mostrarMensagem(error.message);
    } finally {
      button.disabled = false;
    }
  });

  void carregarOpcoes().catch((error) => mostrarMensagem(error.message));
});
