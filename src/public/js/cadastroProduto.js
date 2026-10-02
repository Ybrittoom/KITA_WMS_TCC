document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM
    const modalOverlay = document.getElementById('modal-overlay');
    const btnOpenModal = document.getElementById('btn-open-modal');
    const btnCloseModal = document.getElementById('btn-close-modal');
    const btnCancelModal = document.getElementById('btn-cancel-modal');
    const productForm = document.getElementById('product-form');
    const productsTbody = document.getElementById('products-tbody');
    const totalCountEl = document.getElementById('total-count');
  
    // Funções para Controle do Modal
    const openModal = () => {
      modalOverlay.classList.add('active');
    };
  
    const closeModal = () => {
      modalOverlay.classList.remove('active');
      productForm.reset();
    };
  
    // Event Listeners dos Botões do Modal
    btnOpenModal.addEventListener('click', openModal);
    btnCloseModal.addEventListener('click', closeModal);
    btnCancelModal.addEventListener('click', closeModal);
  
    // Fechar modal ao clicar fora do card
    modalOverlay.addEventListener('click', (event) => {
      if (event.target === modalOverlay) {
        closeModal();
      }
    });
  
    // Atualiza a quantidade contada na tela
    const updateProductCount = () => {
      const totalRows = productsTbody.querySelectorAll('tr').length;
      totalCountEl.textContent = totalRows;
    };
  
    // Evento de Submissão do Formulário
    productForm.addEventListener('submit', (e) => {
      e.preventDefault();
  
      // Coleta os valores
      const nome = document.getElementById('nome').value.trim();
      const sku = document.getElementById('sku').value.trim().toUpperCase();
      const estoqueMin = parseInt(document.getElementById('estoque_minimo').value) || 0;
  
      if (!nome || !sku) return;
  
      // Cria nova linha na tabela
      const newRow = document.createElement('tr');
      newRow.innerHTML = `
        <td><span class="product-name">${nome}</span></td>
        <td><code class="sku-badge">${sku}</code></td>
        <td><span class="stock-value">0 un</span></td>
        <td><span class="status-badge status-warning">Estoque Baixo</span></td>
      `;
  
      // Adiciona na tabela
      productsTbody.appendChild(newRow);
  
      // Atualiza contagem e fecha o modal
      updateProductCount();
      closeModal();
    });
  });