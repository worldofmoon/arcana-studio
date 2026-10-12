export function initializeControllers(runtime) {
  runtime.services.experience.bind();
  for (const button of runtime.platform.document.querySelectorAll(
    "[data-tab]",
  )) {
    button.onclick = () => runtime.services.editor.tab(button.dataset.tab);
    button.addEventListener("keydown", (e) => {
      const keys =
          button.dataset.tab === "layers"
            ? [...runtime.config.editorSteps, "layers"]
            : runtime.config.editorSteps,
        i = keys.indexOf(button.dataset.tab);
      let next;
      if (e.key === "ArrowRight") next = keys[(i + 1) % keys.length];
      if (e.key === "ArrowLeft")
        next = keys[(i + keys.length - 1) % keys.length];
      if (e.key === "Home") next = keys[0];
      if (e.key === "End") next = keys[keys.length - 1];
      if (next) {
        e.preventDefault();
        runtime.services.editor.tab(next);
        runtime.view.get("tab-" + next).focus();
      }
    });
  }
  const moveStep = (offset) => {
    const steps = runtime.config.editorSteps;
    const current = steps.indexOf(runtime.state.activeTab);
    const index = Math.max(
      0,
      Math.min(steps.length - 1, (current < 0 ? 3 : current) + offset),
    );
    runtime.services.editor.tab(steps[index]);
    runtime.view.get("tab-" + steps[index]).focus();
  };
  runtime.view.get("previousStep").onclick = () => moveStep(-1);
  runtime.view.get("nextStep").onclick = () => moveStep(1);
  runtime.view.get("previousStepBottom").onclick = () => moveStep(-1);
  runtime.view.get("nextStepBottom").onclick = () => moveStep(1);
  runtime.view.get("downloadSide").onchange = () => {
    runtime.services.renderer.render();
    runtime.services.editor.updateExportState();
  };
  runtime.view.get("finishPng").onclick = () =>
    runtime.services.bindings.exportHandler();
  runtime.view.get("finishPdf").onclick = () =>
    runtime.services.bindings.pdfBtnHandler();
  runtime.view.get("finishProject").onclick = () =>
    runtime.services.bindings.saveProjectHandler();
  runtime.view.get("finishLibrary").onclick = () =>
    runtime.services.bindings.libraryBtnHandler();
  runtime.view.get("createBlank").onclick = async () => {
    if (
      runtime.state.dirty &&
      !runtime.platform.confirm(
        "Começar uma carta do zero? Baixe ou salve o projeto atual para guardar uma cópia. Você também pode desfazer esta ação.",
      )
    )
      return;
    try {
      const restored = await runtime.services.projects.restoreProject({
        format: "arcana-studio",
        version: 2,
        values: { ...runtime.state.fieldDefaults },
        media: {},
        fonts: {},
      });
      if (!restored) return;
      if (!runtime.state.collection) runtime.state.activeProjectId = null;
      runtime.services.editor.changed();
      runtime.services.editor.tab("frame");
      runtime.services.editor.message(
        "Carta em branco criada. Escolha a moldura para começar.",
      );
    } catch (error) {
      runtime.services.editor.message(error.message, true);
    }
  };
  const collection = runtime.services.collection;
  const bindCollection = (id, action) => {
    runtime.view.get(id).onclick = () => collection.handle(action);
  };
  bindCollection("collectionAdd", () => collection.add());
  bindCollection("collectionDuplicate", () => collection.add(true));
  bindCollection("collectionDelete", () => collection.remove());
  bindCollection("collectionEarlier", () => collection.move(-1));
  bindCollection("collectionLater", () => collection.move(1));
  bindCollection("collectionFrame", () => collection.applyFrame());
  bindCollection("collectionZip", () => collection.exportPngs());
  bindCollection("undoCollection", () => collection.moveOperation(-1));
  bindCollection("redoCollection", () => collection.moveOperation(1));
  runtime.view.get("collectionName").onchange = () =>
    collection.handle(() =>
      collection.renameProject(runtime.view.get("collectionName").value),
    );
  runtime.view.get("collectionLabel").onchange = () =>
    collection.handle(() =>
      collection.renameCard(runtime.view.get("collectionLabel").value),
    );
  runtime.view.get("collectionCopies").onchange = () =>
    collection.handle(() =>
      collection.copies(runtime.view.get("collectionCopies").value),
    );
  runtime.view.get("collectionSharedBack").onchange = () =>
    collection.handle(() =>
      collection.toggleBack(runtime.view.get("collectionSharedBack").checked),
    );
  collection.render();
  runtime.services.editor.tab("card");
  for (const id of runtime.config.fields) {
    runtime.view
      .get(id)
      .addEventListener("input", runtime.services.editor.changed);
    runtime.view
      .get(id)
      .addEventListener("change", runtime.services.editor.changed);
  }
  for (const id of ["name", "mana", "type", "rules", "flavor"])
    runtime.view
      .get(id)
      .addEventListener("focus", () => (runtime.state.lastText = id));
  for (const [input, kind] of [
    ["artFile", "art"],
    ["backFile", "back"],
    ["frameFile", "frame"],
    ["symbolFile", "symbol"],
  ])
    runtime.view
      .get(input)
      .addEventListener("change", (e) =>
        runtime.services.images.upload(kind, e.target.files?.[0]),
      );
  for (const [button, kind, input] of [
    ["removeArt", "art", "artFile"],
    ["removeBack", "back", "backFile"],
    ["clearFrame", "frame", "frameFile"],
  ])
    runtime.view.get(button).onclick = () => {
      ++runtime.state.mediaEpoch[kind];
      runtime.state.media[kind] = null;
      runtime.state.dataUrls[kind] = "";
      runtime.view.get(input).value = "";
      runtime.services.editor.changed();
    };
  runtime.view.get("fitArt").onclick = runtime.services.bindings.fitArtHandler;
  runtime.view.get("fitBack").onclick =
    runtime.services.bindings.fitBackHandler;
  runtime.view.get("accent").addEventListener("input", () => {
    runtime.view.get("palette").value = "custom";
    runtime.services.editor.changed();
  });
  runtime.view.canvas.style.touchAction =
    runtime.state.activeTab === "art" || runtime.state.activeTab === "back"
      ? "none"
      : "pan-y";
  runtime.view.canvas.addEventListener("pointerdown", (e) => {
    if (runtime.state.activeTab !== "art" && runtime.state.activeTab !== "back")
      return;
    e.preventDefault();
    runtime.state.pointer = {
      x: e.clientX,
      y: e.clientY,
      b: runtime.state.activeTab === "back",
      sx: runtime.services.editor.num(
        runtime.state.activeTab === "back" ? "backX" : "shiftX",
      ),
      sy: runtime.services.editor.num(
        runtime.state.activeTab === "back" ? "backY" : "shiftY",
      ),
    };
    runtime.view.canvas.setPointerCapture(e.pointerId);
    runtime.view.canvas.style.touchAction = "none";
  });
  runtime.view.canvas.addEventListener("pointermove", (e) => {
    if (!runtime.state.pointer) return;
    const rect = runtime.view.canvas.getBoundingClientRect(),
      x =
        runtime.state.pointer.sx -
        ((e.clientX - runtime.state.pointer.x) / rect.width) * 200,
      y =
        runtime.state.pointer.sy -
        ((e.clientY - runtime.state.pointer.y) / rect.height) * 200;
    runtime.view.get(runtime.state.pointer.b ? "backX" : "shiftX").value =
      Math.max(-100, Math.min(100, x));
    runtime.view.get(runtime.state.pointer.b ? "backY" : "shiftY").value =
      Math.max(-100, Math.min(100, y));
    runtime.services.editor.changed();
  });
  for (const event of ["pointerup", "pointercancel"])
    runtime.view.canvas.addEventListener(event, () => {
      runtime.state.pointer = null;
      runtime.view.canvas.style.touchAction =
        runtime.state.activeTab === "art" || runtime.state.activeTab === "back"
          ? "none"
          : "pan-y";
    });
  runtime.view.get("expand").onclick = runtime.services.bindings.expandHandler;
  runtime.view.get("closeDialog").onclick =
    runtime.services.bindings.closeDialogHandler;
  runtime.view.get("loadSet").onclick =
    runtime.services.bindings.loadSetHandler;
  runtime.view.get("setCode").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runtime.services.cards.loadSet();
  });
  runtime.view.get("symbolFile").addEventListener("change", () => {
    ++runtime.state.setRequest;
    runtime.state.setLoading = false;
    runtime.view.get("setStatus").textContent = "Símbolo personalizado.";
  });
  runtime.view.get("searchBtn").onclick =
    runtime.services.bindings.searchBtnHandler;
  runtime.view.get("searchName").addEventListener("keydown", (e) => {
    if (e.key === "Enter") runtime.services.cards.search();
  });
  runtime.view.get("searchName").addEventListener("input", () => {
    runtime.platform.clearTimeout(runtime.state.searchTimer);
    ++runtime.state.searchVersion;
    runtime.state.searchAbort?.abort();
    runtime.view.get("results").replaceChildren();
    runtime.view.get("more").hidden = true;
    runtime.state.searchTimer = runtime.platform.setTimeout(
      runtime.services.cards.search,
      650,
    );
  });
  runtime.view.get("more").onclick = runtime.services.bindings.moreHandler;
  runtime.view.get("faceSelect").onchange = () => {
    if (runtime.state.selectedCard)
      runtime.services.cards.importCard(
        runtime.state.selectedCard,
        Number(runtime.view.get("faceSelect").value),
      );
  };
  runtime.view.get("openProject").onclick =
    runtime.services.bindings.openProjectHandler;
  runtime.view.get("projectFile").addEventListener("change", async (e) => {
    try {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 60000000) throw new Error("Projeto muito grande.");
      if (await runtime.services.collection.open(JSON.parse(await file.text())))
        runtime.state.activeProjectId = null;
    } catch (e) {
      runtime.services.editor.message(e.message, true);
    } finally {
      runtime.view.get("projectFile").value = "";
    }
  });
  (async () => {
    try {
      const db = await runtime.services.storage.database();
      runtime.state.availableDraft = await new Promise((resolve, reject) => {
        const r = db
          .transaction("projects")
          .objectStore("projects")
          .get("draft");
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
      });
      db.close();
      runtime.view.get("restoreBar").hidden = !runtime.state.availableDraft;
      runtime.services.experience.restoreHint(runtime.state.availableDraft);
    } catch {}
  })();
  for (const [id, kind] of [
    ["titleFontFile", "title"],
    ["rulesFontFile", "rules"],
  ])
    runtime.view
      .get(id)
      .addEventListener("change", (e) =>
        runtime.services.fonts.uploadFont(kind, e.target.files?.[0]),
      );
  runtime.state.fontsReady = Promise.all([
    runtime.platform.document.fonts.load("700 58px ArcanaTitle"),
    runtime.platform.document.fonts.load("43px ArcanaRules"),
    runtime.platform.document.fonts.load("italic 43px ArcanaRules"),
    runtime.platform.document.fonts.load("700 58px ArcanaClassic"),
  ])
    .then(() => {
      runtime.services.renderer.render();
      return true;
    })
    .catch(() => {
      runtime.services.editor.message(
        "Não foi possível carregar as fontes. Recarregue a página antes de exportar.",
        true,
      );
      return false;
    });
  runtime.view
    .get("frameFind")
    .addEventListener("input", runtime.services.bindings.populateFrameGallery);
  runtime.view.get("frameCategory").onchange =
    runtime.services.bindings.populateFrameGallery;
  runtime.view.get("frame").addEventListener("change", () => {
    runtime.services.bindings.ensureFrameAsset().catch(() => {});
    runtime.services.bindings.updateFrameSelection();
  });
  runtime.services.bindings.populateFrameGallery();
  runtime.state.embeddedReady = (async () => {
    await Promise.all(
      Object.entries(runtime.state.symbolData).map(async ([key, url]) => {
        try {
          runtime.state.symbols.set(
            key,
            await runtime.services.images.imageUrl(url),
          );
        } catch {}
      }),
    );
    for (const token of [
      "{W}",
      "{U}",
      "{B}",
      "{R}",
      "{G}",
      "{C}",
      "{T}",
      "{Q}",
      "{X}",
      "{1}",
      "{2}",
      "{W/U}",
      "{W/P}",
    ]) {
      const b = runtime.platform.document.createElement("button");
      b.type = "button";
      b.title = "Inserir " + token;
      const img = runtime.platform.document.createElement("img");
      img.src = runtime.state.symbolData[token] || "";
      img.alt = token;
      b.append(img);
      b.onclick = () => {
        const input = runtime.view.get(runtime.state.lastText),
          start = input.selectionStart ?? input.value.length,
          end = input.selectionEnd ?? start;
        input.value =
          input.value.slice(0, start) + token + input.value.slice(end);
        input.focus();
        input.setSelectionRange(start + token.length, start + token.length);
        runtime.services.editor.changed();
      };
      runtime.view.get("manaButtons").append(b);
    }
    runtime.services.renderer.render();
  })();
  runtime.view.get("undo").onclick = runtime.services.bindings.undoHandler;
  runtime.view.get("redo").onclick = runtime.services.bindings.redoHandler;
  runtime.platform.document.addEventListener("keydown", (e) => {
    const focused = runtime.platform.document.activeElement;
    if (
      focused &&
      ["INPUT", "TEXTAREA"].includes(focused.tagName) &&
      !runtime.config.fields.includes(focused.id)
    )
      return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "z")
      return;
    if (runtime.state.batchRendering) return;
    e.preventDefault();
    runtime.services.history.moveHistory(e.shiftKey ? 1 : -1);
  });
  runtime.view.get("closeLibrary").onclick =
    runtime.services.bindings.closeLibraryHandler;
  runtime.view.get("storeProject").onclick =
    runtime.services.bindings.storeProjectHandler;
  runtime.view.get("saveCopy").onclick =
    runtime.services.bindings.saveCopyHandler;
  for (const id of [
    "printPaper",
    "printSides",
    "includeCurrent",
    "currentCopies",
    "cropMarks",
  ]) {
    runtime.view
      .get(id)
      .addEventListener("change", runtime.services.printing.updatePrintSummary);
    runtime.view
      .get(id)
      .addEventListener("input", runtime.services.printing.updatePrintSummary);
  }
  runtime.view.get("pdfBtn").onclick = runtime.services.bindings.pdfBtnHandler;
  runtime.view.get("closePrint").onclick =
    runtime.services.bindings.closePrintHandler;
  runtime.view.get("resetLayers").onclick =
    runtime.services.bindings.resetLayersHandler;
  for (const [input, kind, button] of [
    ["watermarkFile", "watermark", "removeWatermark"],
    ["secondaryFile", "secondary", "removeSecondary"],
    ["overlayFile", "overlay", "removeOverlay"],
  ]) {
    runtime.view
      .get(input)
      .addEventListener("change", (e) =>
        runtime.services.images.upload(kind, e.target.files?.[0]),
      );
    runtime.view.get(button).onclick = () => {
      ++runtime.state.mediaEpoch[kind];
      runtime.state.media[kind] = null;
      runtime.state.dataUrls[kind] = "";
      runtime.view.get(input).value = "";
      runtime.services.editor.changed();
    };
  }
  for (const id of [
    "secondRules",
    "secondFlavor",
    "sagaIntro",
    ...Array.from({ length: 4 }, (_, i) => "pwText" + (i + 1)),
    ...Array.from({ length: 4 }, (_, i) => "chapterText" + (i + 1)),
  ])
    runtime.view
      .get(id)
      .addEventListener("focus", () => (runtime.state.lastText = id));
  runtime.view.get("boldText").onclick =
    runtime.services.bindings.boldTextHandler;
  runtime.view.get("italicText").onclick =
    runtime.services.bindings.italicTextHandler;
  runtime.view.get("clearTextStyle").onclick =
    runtime.services.bindings.clearTextStyleHandler;
  runtime.services.editor.updateSpecialFields();
  runtime.services.editor.layerControls();
  runtime.view.get("libraryBtn").onclick =
    runtime.services.bindings.libraryBtnHandler;
  runtime.view
    .get("librarySearch")
    .addEventListener("input", runtime.services.library.renderLibraryList);
  runtime.view.get("libraryFolderFilter").onchange =
    runtime.services.library.renderLibraryList;
  runtime.view.get("createLibraryFolder").onclick =
    runtime.services.bindings.createLibraryFolderHandler;
  runtime.view.get("renameLibraryFolder").onclick =
    runtime.services.bindings.renameLibraryFolderHandler;
  runtime.view.get("deleteLibraryFolder").onclick =
    runtime.services.bindings.deleteLibraryFolderHandler;
  runtime.view.get("moveSelected").onclick =
    runtime.services.bindings.moveSelectedHandler;
  runtime.view.get("selectVisibleLibrary").onclick =
    runtime.services.bindings.selectVisibleLibraryHandler;
  runtime.view.get("clearLibrarySelection").onclick =
    runtime.services.bindings.clearLibrarySelectionHandler;
  runtime.view.get("backupAll").onclick =
    runtime.services.bindings.backupAllHandler;
  runtime.view.get("backupSelected").onclick =
    runtime.services.bindings.backupSelectedHandler;
  runtime.view.get("restoreLibraryBtn").onclick =
    runtime.services.bindings.restoreLibraryBtnHandler;
  runtime.view
    .get("libraryBackupFile")
    .addEventListener("change", (e) =>
      runtime.services.library.prepareLibraryBackup(e.target.files?.[0]),
    );
  runtime.view.get("confirmRestoreLibrary").onclick =
    runtime.services.bindings.confirmRestoreLibraryHandler;
  runtime.view.get("cancelRestoreLibrary").onclick =
    runtime.services.bindings.cancelRestoreLibraryHandler;
  for (const id of ["dialog", "libraryDialog", "printDialog"])
    runtime.view.get(id).addEventListener("cancel", (e) => {
      if (
        runtime.state.editorLocks ||
        runtime.state.batchRendering ||
        runtime.state.libraryBusy
      )
        e.preventDefault();
    });
  runtime.view.get("export").onclick = runtime.services.bindings.exportHandler;
  runtime.view.get("restoreDraft").onclick =
    runtime.services.bindings.restoreDraftHandler;
  runtime.view.canvas.addEventListener("pointerdown", (e) => {
    if (runtime.state.editorLocks || runtime.state.batchRendering) {
      runtime.state.pointer = null;
      e.preventDefault();
    }
  });
  for (const [button, kind, input] of [
    ["removeArt", "art", "artFile"],
    ["removeBack", "back", "backFile"],
    ["clearFrame", "frame", "frameFile"],
    ["removeSecondary", "secondary", "secondaryFile"],
    ["removeWatermark", "watermark", "watermarkFile"],
    ["removeOverlay", "overlay", "overlayFile"],
  ])
    runtime.view.get(button).onclick = () => {
      runtime.services.images.cancelPendingMedia(kind);
      runtime.view.get(input).value = "";
    };
  runtime.services.editor.updateExportState();
  runtime.view.get("resetFonts").onclick =
    runtime.services.bindings.resetFontsHandler;
  runtime.view.get("saveProject").onclick =
    runtime.services.bindings.saveProjectHandler;
  runtime.view.get("generatePDF").onclick =
    runtime.services.bindings.generatePDFHandler;
  runtime.services.history.commitHistory();
  runtime.services.renderer.render();
}
