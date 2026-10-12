export function createService(runtime) {
  async function ensureFrameAsset() {
    const preset = runtime.services.renderer.framePreset();
    if (!preset?.asset) return;
    const image = await runtime.adapters.frames.get(preset.asset);
    const missing = !runtime.state.frameImages.has(preset.id);
    runtime.state.frameImages.set(preset.id, image);
    if (missing && runtime.view.get("frame").value === preset.id)
      runtime.services.renderer.render();
    return image;
  }

  function updateFrameSelection() {
    const preset = runtime.services.renderer.framePreset();
    runtime.view.get("palette").disabled =
      runtime.state.batchRendering ||
      (!!preset?.asset && runtime.view.get("cardLayout").value === "normal");
    runtime.view.get("accent").disabled = runtime.view.get("palette").disabled;
    for (const b of runtime.view.get("frameGallery").querySelectorAll("button"))
      b.setAttribute(
        "aria-pressed",
        String(b.dataset.frame === runtime.view.get("frame").value),
      );
  }

  function populateFrameGallery() {
    const term = runtime.view
        .get("frameFind")
        .value.trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase(),
      cat = runtime.view.get("frameCategory").value;
    const list = runtime.state.frameCatalog.filter(
      (p) =>
        (cat === "all" || p.category === cat) &&
        p.label
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .toLowerCase()
          .includes(term),
    );
    runtime.view.get("frameGallery").replaceChildren();
    for (const preset of list) {
      const b = runtime.platform.document.createElement("button");
      b.className = "frame-choice";
      b.dataset.frame = preset.id;
      b.setAttribute(
        "aria-pressed",
        String(preset.id === runtime.view.get("frame").value),
      );
      const img = runtime.platform.document.createElement("img");
      img.src = preset.thumb;
      img.alt = "";
      img.loading = "lazy";
      const label = runtime.platform.document.createElement("span");
      label.textContent = preset.label;
      b.append(img, label);
      b.onclick = async () => {
        runtime.view.get("frame").value = preset.id;
        if (
          runtime.state.media.frame ||
          runtime.state.pendingMediaLoads.has("frame")
        ) {
          runtime.services.images.cancelPendingMedia("frame");
          runtime.view.get("frameFile").value = "";
        }
        try {
          await runtime.services.bindings.ensureFrameAsset();
          runtime.services.editor.changed();
          runtime.services.editor.message(
            "Moldura selecionada: " + preset.label,
          );
        } catch {}
      };
      runtime.view.get("frameGallery").append(b);
    }
    runtime.view.get("frameCount").textContent =
      list.length +
      " opções · " +
      runtime.state.frameCatalog.length +
      " molduras na biblioteca.";
  }

  const fitArtHandler = () => runtime.services.images.fit();

  const fitBackHandler = () => runtime.services.images.fit(true);

  const expandHandler = () => {
    runtime.view.get("dialog").showModal();
    runtime.services.renderer.render();
  };

  const closeDialogHandler = () => runtime.view.get("dialog").close();

  const loadSetHandler = runtime.services.cards.loadSet;

  const searchBtnHandler = runtime.services.cards.search;

  const moreHandler = async () => {
    if (runtime.state.shown < runtime.state.resultCards.length) {
      runtime.services.cards.showResults();
      return;
    }
    if (!runtime.state.nextPage) return;
    const version = runtime.state.searchVersion;
    runtime.view.get("more").disabled = true;
    try {
      const r = await runtime.services.cards.fetchWithTimeout(
          runtime.state.nextPage,
          {
            headers: { Accept: "application/json" },
            signal: runtime.state.searchAbort.signal,
          },
        ),
        j = await r.json();
      if (version !== runtime.state.searchVersion) return;
      if (!r.ok) throw new Error("Não foi possível carregar mais cartas.");
      runtime.state.resultCards.push(...j.data);
      runtime.state.nextPage = j.has_more ? j.next_page : null;
      runtime.services.cards.showResults();
    } catch (e) {
      if (e.name !== "AbortError")
        runtime.view.get("searchStatus").textContent = e.message;
    } finally {
      runtime.view.get("more").disabled = false;
    }
  };

  const saveProjectHandler = async () => {
    try {
      if (runtime.services.editor.exportBusy())
        throw new Error(
          "Aguarde o carregamento terminar antes de baixar o projeto.",
        );
      runtime.services.projects.downloadProject(
        await runtime.services.projects.portableSnapshot(),
        runtime.services.projects.safeName() + ".arcana.json",
      );
      runtime.services.editor.message(
        "Projeto baixado com as imagens e fontes.",
      );
    } catch (error) {
      runtime.services.editor.message(
        error.message || "Não foi possível baixar o projeto.",
        true,
      );
    }
  };

  const openProjectHandler = () => runtime.view.get("projectFile").click();

  const restoreDraftHandler = async () => {
    try {
      if (
        await runtime.services.projects.restoreProject(
          runtime.state.availableDraft,
        )
      )
        runtime.state.activeProjectId = null;
    } catch (e) {
      runtime.services.editor.message(e.message, true);
    }
  };

  const resetFontsHandler = async () => {
    for (const kind of ["title", "rules"]) {
      ++runtime.state.fontVersions[kind];
      runtime.state.fontLoading.delete(kind);
    }
    await runtime.services.bindings.resetFontsHandlerCore();
    runtime.services.editor.updateExportState();
  };

  const exportHandler = async () => {
    if (runtime.services.editor.exportBusy()) {
      runtime.services.editor.message(
        "Aguarde o carregamento terminar antes de exportar.",
        true,
      );
      return;
    }
    try {
      await runtime.services.bindings.exportHandlerCore();
    } finally {
      runtime.services.editor.updateExportState();
    }
  };

  const undoHandler = () => runtime.services.history.moveHistory(-1);

  const redoHandler = () => runtime.services.history.moveHistory(1);

  const libraryBtnHandler = async () => {
    runtime.view.get("libraryDialog").showModal();
    try {
      await runtime.services.library.refreshLibrary();
      const active = runtime.state.libraryRecords.find(
        (r) => r.id === runtime.state.activeProjectId,
      );
      runtime.view.get("libraryName").value =
        active?.name || runtime.view.get("name").value;
      runtime.view.get("projectFolder").value = active?.folderId || "";
      runtime.view.get("libraryStatus").textContent =
        runtime.state.libraryRecords.length + " projetos guardados.";
    } catch {
      runtime.view.get("libraryStatus").textContent =
        "A biblioteca local não está disponível neste navegador.";
    }
  };

  const closeLibraryHandler = () => runtime.view.get("libraryDialog").close();

  const storeProjectHandler = () => runtime.services.library.saveInLibrary();

  const saveCopyHandler = () => runtime.services.library.saveInLibrary(true);

  const pdfBtnHandler = async () => {
    runtime.view.get("printDialog").showModal();
    await runtime.services.printing.populatePrintQueue();
  };

  const closePrintHandler = () => runtime.view.get("printDialog").close();

  const resetLayersHandler = () => {
    runtime.view.get("layerState").value = "";
    runtime.services.editor.changed();
    runtime.services.editor.layerControls();
  };

  const boldTextHandler = () => runtime.services.editor.formatSelection("b");

  const italicTextHandler = () => runtime.services.editor.formatSelection("i");

  const clearTextStyleHandler = () =>
    runtime.services.editor.formatSelection("clear");

  const createLibraryFolderHandler =
    runtime.services.library.createLibraryFolder;

  const renameLibraryFolderHandler =
    runtime.services.library.renameLibraryFolder;

  const deleteLibraryFolderHandler =
    runtime.services.library.deleteLibraryFolder;

  const moveSelectedHandler = runtime.services.library.moveLibrarySelection;

  const selectVisibleLibraryHandler = () => {
    for (const r of runtime.services.library.libraryVisibleRecords())
      runtime.state.selectedLibraryIds.add(r.id);
    runtime.services.library.renderLibraryList();
  };

  const clearLibrarySelectionHandler = () => {
    runtime.state.selectedLibraryIds.clear();
    runtime.services.library.renderLibraryList();
  };

  const backupAllHandler = () =>
    runtime.services.library.exportLibraryBackup(false);

  const backupSelectedHandler = () =>
    runtime.services.library.exportLibraryBackup(true);

  const restoreLibraryBtnHandler = () =>
    runtime.view.get("libraryBackupFile").click();

  const confirmRestoreLibraryHandler =
    runtime.services.library.restoreLibraryBackup;

  const cancelRestoreLibraryHandler = () => {
    runtime.state.pendingLibraryBackup = null;
    runtime.view.get("libraryRestoreSummary").hidden = true;
    runtime.view.get("libraryBackupFile").value = "";
  };

  const generatePDFHandler = () =>
    runtime.services.printing.exportPrintPDF().catch((e) => {
      runtime.view.get("pdfStatus").textContent = e.message;
    });

  const resetFontsHandlerCore = async () => {
    await runtime.services.fonts.restoreFonts({});
    runtime.view.get("titleFontFile").value = "";
    runtime.view.get("rulesFontFile").value = "";
    runtime.view.get("fontStatus").textContent = "Fontes padrão restauradas.";
    runtime.services.editor.changed();
  };

  const exportHandlerCore = async () => {
    const button = runtime.view.get("export");
    button.disabled = true;
    runtime.view.get("finishPng").disabled = true;
    try {
      if (runtime.state.setLoading)
        throw new Error("Aguarde o símbolo da edição terminar de carregar.");
      await runtime.state.embeddedReady;
      await runtime.services.bindings.ensureFrameAsset();
      if (!(await runtime.state.fontsReady))
        throw new Error(
          "A fonte não terminou de carregar. Recarregue e tente novamente.",
        );
      await runtime.platform.document.fonts.ready;
      runtime.services.renderer.render();
      const blob = await runtime.services.printing.printablePng(
        runtime.view.canvas,
      );
      runtime.services.printing.saveBlob(
        blob,
        runtime.services.projects.safeName() +
          "_" +
          (runtime.state.activeTab === "back" ||
          (runtime.state.activeTab === "finish" &&
            runtime.view.get("downloadSide").value === "back")
            ? "verso"
            : "frente") +
          "_69x94mm.png",
      );
      runtime.services.editor.message(
        "PNG gerado: 63 × 88 mm + 3 mm de margem branca em cada lado. Imprima em tamanho real / 100%.",
      );
    } catch (e) {
      runtime.services.editor.message(
        e.message || "Não foi possível gerar o PNG.",
        true,
      );
    } finally {
      button.disabled =
        (runtime.state.activeTab === "back" ||
          (runtime.state.activeTab === "finish" &&
            runtime.view.get("downloadSide").value === "back")) &&
        !runtime.state.media.back;
    }
  };
  return {
    ensureFrameAsset,
    updateFrameSelection,
    populateFrameGallery,
    fitArtHandler,
    fitBackHandler,
    expandHandler,
    closeDialogHandler,
    loadSetHandler,
    searchBtnHandler,
    moreHandler,
    saveProjectHandler,
    openProjectHandler,
    restoreDraftHandler,
    resetFontsHandler,
    exportHandler,
    undoHandler,
    redoHandler,
    libraryBtnHandler,
    closeLibraryHandler,
    storeProjectHandler,
    saveCopyHandler,
    pdfBtnHandler,
    closePrintHandler,
    resetLayersHandler,
    boldTextHandler,
    italicTextHandler,
    clearTextStyleHandler,
    createLibraryFolderHandler,
    renameLibraryFolderHandler,
    deleteLibraryFolderHandler,
    moveSelectedHandler,
    selectVisibleLibraryHandler,
    clearLibrarySelectionHandler,
    backupAllHandler,
    backupSelectedHandler,
    restoreLibraryBtnHandler,
    confirmRestoreLibraryHandler,
    cancelRestoreLibraryHandler,
    generatePDFHandler,
    resetFontsHandlerCore,
    exportHandlerCore,
  };
}
