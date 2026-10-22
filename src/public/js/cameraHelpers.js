// Recursos de câmera reutilizados pelos leitores de produto e de estoque.
(() => {
  /** Lista os dispositivos de vídeo, preservando a câmera que já estava escolhida. */
  async function listarCameras(select, cameraPreferida = "") {
    if (!navigator.mediaDevices?.enumerateDevices) {
      select.replaceChildren(new Option("Seleção de câmera indisponível", ""));
      select.disabled = true;
      return [];
    }

    const dispositivos = await navigator.mediaDevices.enumerateDevices();
    const cameras = dispositivos.filter((dispositivo) => dispositivo.kind === "videoinput");
    select.replaceChildren();

    if (cameras.length === 0) {
      select.add(new Option("Nenhuma câmera encontrada", ""));
      select.disabled = true;
      return [];
    }

    cameras.forEach((camera, indice) => {
      // Alguns navegadores ocultam os nomes até a pessoa permitir o uso da câmera.
      const nome = camera.label.trim() || `Câmera ${indice + 1}`;
      select.add(new Option(nome, camera.deviceId));
    });

    const preferidaExiste = cameras.some((camera) => camera.deviceId === cameraPreferida);
    const cameraTraseiraPrincipal = cameras.find((camera) => {
      const nome = camera.label.toLowerCase();
      const pareceTraseira = /back|rear|environment|traseira|trás/.test(nome);
      const pareceLenteSecundaria = /ultra.?wide|ultrawide|macro|telephoto/.test(nome);
      return pareceTraseira && !pareceLenteSecundaria;
    });
    const cameraPrincipal = cameras.find((camera) => /main|standard|principal/.test(camera.label.toLowerCase()));
    select.disabled = cameras.length < 2;
    select.value = preferidaExiste
      ? cameraPreferida
      : (cameraPrincipal || cameraTraseiraPrincipal || cameras[0]).deviceId;
    return cameras;
  }

  /** Ativa foco contínuo somente se o dispositivo declarar suporte a essa opção. */
  async function ativarFocoContinuo(video) {
    const track = video.srcObject?.getVideoTracks?.()[0];
    if (!track?.getCapabilities || !track.applyConstraints) return false;

    let capacidades;
    try {
      capacidades = track.getCapabilities();
    } catch {
      return false;
    }
    const modos = capacidades.focusMode;
    const suportaContinuo = Array.isArray(modos) && modos.includes("continuous");
    if (!suportaContinuo) return false;

    try {
      await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
      return true;
    } catch {
      // O navegador pode listar uma capacidade que o driver não consegue aplicar agora.
      return false;
    }
  }

  /** Configura o slider somente quando a câmera informa uma faixa de zoom suportada. */
  function configurarZoom(video, grupo, slider, valorTexto) {
    const track = video.srcObject?.getVideoTracks?.()[0];
    let faixa;
    try {
      faixa = track?.getCapabilities?.().zoom;
    } catch {
      faixa = null;
    }
    if (!faixa || typeof faixa.min !== "number" || typeof faixa.max !== "number" || faixa.max <= faixa.min) {
      grupo.hidden = true;
      return false;
    }

    let ajusteAtual;
    try {
      ajusteAtual = track.getSettings?.().zoom;
    } catch {
      ajusteAtual = undefined;
    }
    slider.min = String(faixa.min);
    slider.max = String(faixa.max);
    slider.step = String(faixa.step || 0.1);
    slider.value = String(typeof ajusteAtual === "number" ? ajusteAtual : faixa.min);
    valorTexto.value = `${Number(slider.value).toFixed(1)}×`;
    grupo.hidden = false;
    return true;
  }

  /** Aplica um novo zoom ao track e exibe o valor efetivamente solicitado. */
  async function aplicarZoom(video, slider, valorTexto) {
    const track = video.srcObject?.getVideoTracks?.()[0];
    if (!track?.applyConstraints) return false;

    try {
      await track.applyConstraints({ advanced: [{ zoom: Number(slider.value) }] });
      valorTexto.value = `${Number(slider.value).toFixed(1)}×`;
      return true;
    } catch {
      valorTexto.value = "indisponível";
      return false;
    }
  }

  window.KitaCameraHelpers = { listarCameras, ativarFocoContinuo, configurarZoom, aplicarZoom };
})();
