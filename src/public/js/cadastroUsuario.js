document.addEventListener('DOMContentLoaded', () => {
    // Elementos do DOM
    const modalOverlay = document.getElementById('user-modal-overlay');
    const btnOpenModal = document.getElementById('btn-open-user-modal');
    const btnCloseModal = document.getElementById('btn-close-user-modal');
    const btnCancelModal = document.getElementById('btn-cancel-user-modal');
    const userForm = document.getElementById('user-form');
    const usersTbody = document.getElementById('users-tbody');
    const userCountEl = document.getElementById('user-count');
    const currentCompanyEl = document.getElementById('current-company');

})
const closeModal = () => {
    modalOverlay.classList.remove('active');
    userForm.reset();
    // Garante que a empresa logada continue preenchida no input
    document.getElementById('empresa_representada').value = EMPRESA_LOGADA;
};

btnOpenModal.addEventListener('click', openModal);
btnCloseModal.addEventListener('click', closeModal);
btnCancelModal.addEventListener('click', closeModal);

// Fechar ao clicar fora do card
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});

// Controle do Modal
const openModal = () => {
    modalOverlay.classList.add('active');
};

