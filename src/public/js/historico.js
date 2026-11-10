document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("history-filter");
  const body = document.getElementById("history-body");
  const message = document.getElementById("history-message");

  function renderizar(movimentacoes) {
    body.replaceChildren();
    document.getElementById("history-count").textContent = `${movimentacoes.length} registro(s)`;
    if (!movimentacoes.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 7;
      cell.className = "empty-row";
      cell.textContent = "Nenhuma movimentação corresponde aos filtros.";
      return;
    }
    for (const item of movimentacoes) {
      const row = body.insertRow();
      row.insertCell().textContent = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.data));
      const typeCell = row.insertCell();
      const badge = document.createElement("span");
      badge.className = `badge ${item.tipo === "entrada" ? "badge-success" : "badge-danger"}`;
      badge.textContent = item.tipo === "entrada" ? "Entrada" : item.tipo === "saida" ? "Saída" : "Ajuste";
      typeCell.append(badge);
      row.insertCell().textContent = item.produto_nome;
      row.insertCell().textContent = item.sku;
      const quantityCell = row.insertCell();
      quantityCell.textContent = `${item.tipo === "entrada" ? "+" : "−"}${item.quantidade} un.`;
      row.insertCell().textContent = item.local_nome;
      row.insertCell().textContent = `${item.saldo_atual} un.`;
    }
  }

  async function buscarHistorico() {
    const query = new URLSearchParams();
    const fields = [
      ["tipo", "filter-type"], ["busca", "filter-search"],
      ["data_inicio", "filter-start"], ["data_fim", "filter-end"],
    ];
    for (const [key, id] of fields) {
      const value = document.getElementById(id).value.trim();
      if (value) query.set(key, value);
    }
    message.textContent = "";
    body.replaceChildren();
    const loadingRow = body.insertRow();
    const loadingCell = loadingRow.insertCell();
    loadingCell.colSpan = 7;
    loadingCell.className = "empty-row";
    loadingCell.textContent = "Buscando movimentações...";
    try {
      const suffix = query.toString() ? `?${query}` : "";
      const data = await window.KitaWms.api(`/api/estoque/historico${suffix}`);
      renderizar(data.movimentacoes || []);
    } catch (error) {
      message.textContent = error.message;
      renderizar([]);
    }
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void buscarHistorico();
  });
  document.getElementById("clear-filters").addEventListener("click", () => {
    form.reset();
    void buscarHistorico();
  });
  void buscarHistorico();
});
