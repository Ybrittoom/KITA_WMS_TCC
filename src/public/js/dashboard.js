document.addEventListener("DOMContentLoaded", () => {
  const mensagem = document.getElementById("dashboard-message");
  const data = document.getElementById("today");
  data.textContent = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date());

  function adicionarMovimentacao(item) {
    const row = document.createElement("div");
    row.className = "history-item";
    const icon = document.createElement("div");
    icon.className = `history-icon ${item.tipo === "entrada" ? "in" : "out"}`;
    icon.textContent = item.tipo === "entrada" ? "↓" : "↑";
    const detail = document.createElement("div");
    detail.className = "history-text";
    const name = document.createElement("strong");
    name.textContent = item.produto_nome;
    const meta = document.createElement("small");
    meta.textContent = `${item.sku} · ${item.local_nome} · ${new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(item.data))}`;
    detail.append(name, meta);
    const quantity = document.createElement("span");
    quantity.className = `history-value ${item.tipo === "entrada" ? "in" : "out"}`;
    quantity.textContent = `${item.tipo === "entrada" ? "+" : "−"}${item.quantidade} un.`;
    row.append(icon, detail, quantity);
    return row;
  }

  void window.KitaWms.api("/api/estoque/resumo").then(({ resumo }) => {
    document.getElementById("stat-products").textContent = Number(resumo.produtos || 0).toLocaleString("pt-BR");
    document.getElementById("stat-units").textContent = Number(resumo.unidades || 0).toLocaleString("pt-BR");
    document.getElementById("stat-entries").textContent = Number(resumo.entradas_hoje || 0).toLocaleString("pt-BR");
    document.getElementById("stat-exits").textContent = Number(resumo.saidas_hoje || 0).toLocaleString("pt-BR");
    document.getElementById("stat-low").textContent = Number(resumo.estoque_baixo || 0).toLocaleString("pt-BR");
    document.getElementById("stat-locations").textContent = Number(resumo.locais || 0).toLocaleString("pt-BR");

    const recent = document.getElementById("recent-movements");
    recent.replaceChildren();
    if (!resumo.recentes?.length) {
      const empty = document.createElement("p");
      empty.className = "empty-row";
      empty.textContent = "Nenhuma movimentação registrada ainda.";
      recent.append(empty);
    } else {
      for (const item of resumo.recentes) recent.append(adicionarMovimentacao(item));
    }

    const low = Number(resumo.estoque_baixo || 0);
    document.getElementById("low-stock-caption").textContent = low ? `${low} produto(s) precisam de atenção` : "Saldos dentro do mínimo";
    document.getElementById("low-stock-title").textContent = low
      ? `${low} produto(s) no estoque mínimo ou abaixo dele`
      : "Nenhum produto no mínimo neste momento";
    document.getElementById("low-stock-description").textContent = low
      ? "Confira os produtos e registre uma entrada quando houver reposição."
      : "O sistema compara o saldo total dos locais com o mínimo cadastrado para cada produto.";
  }).catch((error) => {
    mensagem.textContent = error.message || "Não foi possível carregar os indicadores.";
  });
});
