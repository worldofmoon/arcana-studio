export function createService(runtime) {
  const imageUrl = function (url) {
    return new Promise((resolve, reject) => {
      const img = new runtime.platform.Image();
      let timer;
      const done = (error) => {
        runtime.platform.clearTimeout(timer);
        img.onload = null;
        img.onerror = null;
        if (error) reject(error);
        else if (!img.width || !img.height)
          reject(new Error("A imagem não possui dimensões válidas."));
        else resolve(img);
      };
      img.crossOrigin = "anonymous";
      img.onload = () => done();
      img.onerror = () =>
        done(new Error("Não foi possível carregar a imagem."));
      timer = runtime.platform.setTimeout(
        () =>
          done(
            new Error(
              "A imagem demorou demais para carregar. Tente novamente.",
            ),
          ),
        30000,
      );
      img.src = url;
    });
  };

  function fileData(file) {
    return new Promise((resolve, reject) => {
      const reader = new runtime.platform.FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () =>
        reject(new Error("Não foi possível ler o arquivo."));
      reader.readAsDataURL(file);
    });
  }

  const setMedia = async function (kind, url) {
    const request = ++runtime.state.mediaEpoch[kind];
    runtime.state.pendingMediaLoads.set(kind, request);
    runtime.services.editor.updateExportState();
    try {
      const img = url ? await runtime.services.images.imageUrl(url) : null;
      if (request !== runtime.state.mediaEpoch[kind]) return false;
      runtime.state.media[kind] = img;
      runtime.state.dataUrls[kind] = url;
      runtime.services.renderer.render();
      return true;
    } finally {
      if (runtime.state.pendingMediaLoads.get(kind) === request)
        runtime.state.pendingMediaLoads.delete(kind);
      runtime.services.editor.updateExportState();
    }
  };

  const upload = async function (kind, file) {
    if (!file) return;
    let request;
    try {
      if (file.size > 25000000) throw new Error("Use uma imagem de até 25 MB.");
      request = ++runtime.state.mediaEpoch[kind];
      runtime.state.pendingMediaLoads.set(kind, request);
      runtime.services.editor.updateExportState();
      const data = await runtime.services.images.fileData(file);
      if (request !== runtime.state.mediaEpoch[kind]) return;
      if (await runtime.services.images.setMedia(kind, data)) {
        runtime.services.editor.changed();
        runtime.services.editor.message("Imagem atualizada.");
      }
    } catch (e) {
      runtime.services.editor.message(e.message, true);
    } finally {
      if (runtime.state.pendingMediaLoads.get(kind) === request)
        runtime.state.pendingMediaLoads.delete(kind);
      runtime.services.editor.updateExportState();
    }
  };

  function fit(back = false) {
    for (const [id, v] of back
      ? [
          ["backZoom", 1],
          ["backX", 0],
          ["backY", 0],
          ["backRotation", 0],
        ]
      : [
          ["zoom", 1],
          ["shiftX", 0],
          ["shiftY", 0],
          ["rotation", 0],
        ])
      runtime.view.get(id).value = v;
    runtime.services.editor.changed();
  }

  function cancelPendingMedia(kind) {
    ++runtime.state.mediaEpoch[kind];
    runtime.state.pendingMediaLoads.delete(kind);
    runtime.state.media[kind] = null;
    runtime.state.dataUrls[kind] = "";
    runtime.services.editor.changed();
    runtime.services.editor.updateExportState();
  }
  return { imageUrl, fileData, setMedia, upload, fit, cancelPendingMedia };
}
