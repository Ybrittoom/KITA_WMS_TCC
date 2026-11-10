document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("location-form");
  const body = document.getElementById("locations-body");
  const message = document.getElementById("locations-message");

  function mostrarMensagem(texto, sucesso = false) {
    message.textContent = texto;
    message.dataset.state = sucesso ? "success" : "error";
  }

  async function carregarLocais() {
    const data = await window.KitaWms.api("/api/estoque/locais");
    const locais = data.locais || [];
    document.getElementById("location-count").textContent = `${locais.length} local(is)`;
    body.replaceChildren();
    if (!locais.length) {
      const row = body.insertRow();
      const cell = row.insertCell();
      cell.colSpan = 4;
      cell.className = "empty-row";
      cell.textContent = "Nenhum local cadastrado. Use o formulário acima para começar.";
      return;
    }

    for (const local of locais) {
      const row = body.insertRow();
      const name = row.insertCell();
      name.textContent = local.nome;
      const address = row.insertCell();
      address.textContent = local.localizacao || "—";
      const mapCell = row.insertCell();
      const map = document.createElement("a");
      map.className = "action-button";
      map.href = `/estoque/mapa?estoque_id=${encodeURIComponent(local.id)}`;
      map.textContent = "Abrir mapa";
      mapCell.append(map);
      const movementsCell = row.insertCell();
      const movements = document.createElement("a");
      movements.className = "action-button";
      movements.href = `/estoque/movimentacoes?estoque_id=${encodeURIComponent(local.id)}`;
      movements.textContent = "Ver saldo";
      movementsCell.append(movements);
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = document.getElementById("save-location");
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const result = await window.KitaWms.api("/api/estoque/locais", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values),
      });
      form.reset();
      mostrarMensagem(result.mensagem || "Local cadastrado.", true);
      await carregarLocais();
    } catch (error) {
      mostrarMensagem(error.message);
    } finally {
      button.disabled = false;
    }
  });

  void carregarLocais().catch((error) => mostrarMensagem(error.message));
});
