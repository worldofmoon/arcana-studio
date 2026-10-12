export function createService(runtime) {
  function titleFont() {
    return runtime.state.fontData.title
      ? "ArcanaCustomTitle"
      : runtime.view.get("frame").value === "classic"
        ? "ArcanaClassic"
        : "ArcanaTitle";
  }

  function rulesFont() {
    return runtime.state.fontData.rules
      ? "ArcanaCustomRules"
      : '"Times New Roman", serif';
  }

  async function installFont(kind, url) {
    const request = ++runtime.state.fontVersions[kind];
    if ((runtime.state.fontData[kind] || "") === (url || "")) {
      runtime.state.fontLoading.delete(kind);
      return true;
    }
    if (!url) {
      if (runtime.state.fontFaces[kind])
        runtime.platform.document.fonts.delete(runtime.state.fontFaces[kind]);
      runtime.state.fontFaces[kind] = null;
      runtime.state.fontData[kind] = "";
      runtime.state.fontLoading.delete(kind);
      return true;
    }
    if (
      typeof url !== "string" ||
      url.length > 7200000 ||
      !url.startsWith("data:application/octet-stream;base64,")
    )
      throw new Error("Arquivo de fonte inválido.");
    runtime.state.fontLoading.set(kind, request);
    runtime.services.editor.updateExportState();
    try {
      const face = new runtime.platform.FontFace(
        kind === "title" ? "ArcanaCustomTitle" : "ArcanaCustomRules",
        "url(" + url + ")",
        { weight: kind === "title" ? "700" : "400" },
      );
      await face.load();
      if (request !== runtime.state.fontVersions[kind]) return false;
      if (runtime.state.fontFaces[kind])
        runtime.platform.document.fonts.delete(runtime.state.fontFaces[kind]);
      runtime.platform.document.fonts.add(face);
      runtime.state.fontFaces[kind] = face;
      runtime.state.fontData[kind] = url;
      return true;
    } finally {
      if (runtime.state.fontLoading.get(kind) === request)
        runtime.state.fontLoading.delete(kind);
      runtime.services.editor.updateExportState();
    }
  }

  async function restoreFonts(fonts) {
    for (const kind of ["title", "rules"])
      await runtime.services.fonts.installFont(kind, fonts[kind] || "");
  }

  async function uploadFont(kind, file) {
    if (!file) return;
    const request = ++runtime.state.fontVersions[kind];
    let activeRequest = request;
    runtime.state.fontLoading.set(kind, request);
    runtime.services.editor.updateExportState();
    try {
      if (file.size > 5000000) throw new Error("Use uma fonte de até 5 MB.");
      const data = await runtime.services.images.fileData(file);
      if (request !== runtime.state.fontVersions[kind]) return;
      activeRequest = request + 1;
      const url =
        "data:application/octet-stream;base64," + data.split(",", 2)[1];
      if (!(await runtime.services.fonts.installFont(kind, url))) return;
      runtime.view.get("fontStatus").textContent =
        "Fonte personalizada carregada: " + file.name;
      runtime.services.editor.changed();
    } catch (error) {
      if (activeRequest === runtime.state.fontVersions[kind]) {
        runtime.view.get("fontStatus").textContent = error.message;
        runtime.services.editor.message(
          "Não foi possível carregar a fonte.",
          true,
        );
      }
    } finally {
      if (runtime.state.fontLoading.get(kind) === request)
        runtime.state.fontLoading.delete(kind);
      runtime.services.editor.updateExportState();
    }
  }
  return { titleFont, rulesFont, installFont, restoreFonts, uploadFont };
}
