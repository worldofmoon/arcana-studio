export function createService(runtime) {
  function message(text, error = false) {
    runtime.services.experience.notify(text, error);
  }

  function num(id) {
    const n = Number(runtime.view.get(id).value);
    return Number.isFinite(n) ? n : 0;
  }

  const tab = function (name) {
    runtime.services.editor.tabCore(name);
    if (name === "layers") runtime.services.editor.layerControls();
  };

  const changed = function () {
    runtime.services.editor.changedCore();
    runtime.services.editor.updateExportState();
  };

  function resetAdvancedField(id) {
    if (runtime.view.get(id).type === "checkbox")
      runtime.view.get(id).checked = !!runtime.state.advancedDefaults[id];
    else runtime.view.get(id).value = runtime.state.advancedDefaults[id] ?? "";
  }

  function getLayers() {
    try {
      const items = JSON.parse(runtime.view.get("layerState").value);
      if (
        !Array.isArray(items) ||
        items.length !== runtime.config.defaultLayers.length ||
        new Set(items.map((l) => l.id)).size !==
          runtime.config.defaultLayers.length ||
        items.some((l) => !runtime.config.defaultLayers.includes(l.id))
      )
        throw 0;
      return items.map((l) => ({
        id: l.id,
        visible: l.visible !== false,
        opacity: Math.max(
          0,
          Math.min(1, Number.isFinite(l.opacity) ? l.opacity : 1),
        ),
      }));
    } catch {
      return runtime.config.defaultLayers.map((id) => ({
        id,
        visible: true,
        opacity: 1,
      }));
    }
  }

  function layerControls() {
    const layers = runtime.services.editor.getLayers();
    runtime.view.get("layerList").replaceChildren();
    for (let i = layers.length - 1; i >= 0; i--) {
      const item = layers[i],
        row = runtime.platform.document.createElement("div");
      row.className = "layer-row";
      const check = runtime.platform.document.createElement("input");
      check.type = "checkbox";
      check.checked = item.visible;
      check.setAttribute(
        "aria-label",
        "Mostrar " + runtime.config.layerNames[item.id],
      );
      const label = runtime.platform.document.createElement("span");
      label.textContent = runtime.config.layerNames[item.id];
      const range = runtime.platform.document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "1";
      range.step = ".05";
      range.value = item.opacity;
      range.setAttribute(
        "aria-label",
        "Opacidade de " + runtime.config.layerNames[item.id],
      );
      const up = runtime.platform.document.createElement("button"),
        down = runtime.platform.document.createElement("button");
      up.textContent = "↑";
      down.textContent = "↓";
      up.setAttribute(
        "aria-label",
        "Subir " + runtime.config.layerNames[item.id],
      );
      down.setAttribute(
        "aria-label",
        "Descer " + runtime.config.layerNames[item.id],
      );
      up.disabled = i === layers.length - 1;
      down.disabled = i === 0;
      const store = () => {
        runtime.view.get("layerState").value = JSON.stringify(layers);
        runtime.services.editor.changed();
      };
      check.onchange = () => {
        item.visible = check.checked;
        store();
      };
      range.oninput = () => {
        item.opacity = Number(range.value);
        store();
      };
      up.onclick = () => {
        [layers[i], layers[i + 1]] = [layers[i + 1], layers[i]];
        store();
        runtime.services.editor.layerControls();
      };
      down.onclick = () => {
        [layers[i], layers[i - 1]] = [layers[i - 1], layers[i]];
        store();
        runtime.services.editor.layerControls();
      };
      row.append(check, label, range, up, down);
      runtime.view.get("layerList").append(row);
    }
  }

  function updateSpecialFields() {
    const mode = runtime.view.get("cardLayout").value;
    runtime.view.get("walkerFields").hidden = mode !== "planeswalker";
    runtime.view.get("sagaFields").hidden = mode !== "saga";
    runtime.view.get("secondFields").hidden = !["adventure", "split"].includes(
      mode,
    );
    runtime.view.get("secondHeading").textContent =
      mode === "adventure" ? "Aventura" : "Segunda metade";
    runtime.view.get("layoutHint").textContent =
      mode === "normal"
        ? "Na carta padrão, edite as habilidades no campo acima."
        : "Os campos preenchidos aparecem nas áreas próprias da carta. Molduras especiais usam o desenho Arcana.";
  }

  function formatSelection(style) {
    const allowed = [
        "rules",
        "flavor",
        "secondRules",
        "secondFlavor",
        "sagaIntro",
        ...Array.from({ length: 4 }, (_, i) => "pwText" + (i + 1)),
        ...Array.from({ length: 4 }, (_, i) => "chapterText" + (i + 1)),
      ],
      input = runtime.view.get(
        allowed.includes(runtime.state.lastText)
          ? runtime.state.lastText
          : "rules",
      ),
      start = input.selectionStart ?? 0,
      end = input.selectionEnd ?? input.value.length,
      selected = input.value.slice(start, end);
    let replacement;
    if (style === "clear")
      replacement = selected.replace(/\[\/?(?:b|i)\]/g, "");
    else
      replacement =
        "[" + style + "]" + (selected || "texto") + "[/" + style + "]";
    input.value =
      input.value.slice(0, start) + replacement + input.value.slice(end);
    input.focus();
    input.setSelectionRange(start, start + replacement.length);
    runtime.services.editor.changed();
  }

  function exportBusy() {
    return (
      runtime.state.batchRendering ||
      runtime.state.collectionBusy ||
      runtime.state.editorLocks > 0 ||
      runtime.state.importLoading ||
      runtime.state.pendingMediaLoads.size > 0 ||
      runtime.state.fontLoading.size > 0 ||
      runtime.state.setLoading
    );
  }

  function updateExportState() {
    const isBack =
      runtime.state.activeTab === "back" ||
      (runtime.state.activeTab === "finish" &&
        runtime.view.get("downloadSide").value === "back");
    const blocked =
      runtime.services.editor.exportBusy() ||
      (isBack && !runtime.state.media.back);
    runtime.view.get("export").disabled = blocked;
    runtime.view.get("finishPng").disabled = blocked;
    runtime.services.collection.updateOperationButtons();
    if (
      runtime.view.get("printDialog").open &&
      !runtime.state.batchRendering &&
      !runtime.state.editorLocks &&
      !runtime.state.collectionBusy
    )
      runtime.services.printing.updatePrintSummary();
    runtime.view.get("downloadHint").textContent =
      isBack && !runtime.state.media.back
        ? "Envie uma imagem na etapa Verso para baixar esse lado."
        : "Carta de 63 × 88 mm. O PNG inclui 3 mm de margem branca em cada lado, totalizando 69 × 94 mm.";
  }

  function lockEditor() {
    if (runtime.state.editorLocks++ === 0) {
      runtime.state.lockedControls = [
        ...runtime.platform.document.querySelectorAll(
          "button,input,select,textarea",
        ),
      ].map((el) => [el, el.disabled]);
      for (const [el] of runtime.state.lockedControls) el.disabled = true;
    }
    runtime.services.editor.updateExportState();
  }

  function unlockEditor() {
    if (runtime.state.editorLocks > 0) --runtime.state.editorLocks;
    if (!runtime.state.editorLocks) {
      for (const [el, disabled] of runtime.state.lockedControls)
        el.disabled = disabled;
      runtime.state.lockedControls = [];
      runtime.services.bindings.updateFrameSelection();
      runtime.services.history.updateHistoryButtons();
    }
    runtime.services.editor.updateExportState();
  }

  function tabCore(name) {
    runtime.state.activeTab = name;
    runtime.view.canvas.style.touchAction =
      name === "art" || name === "back" ? "none" : "pan-y";
    for (const button of runtime.platform.document.querySelectorAll(
      "[data-tab]",
    )) {
      const selected = button.dataset.tab === name;
      button.setAttribute(
        button.dataset.tab === "layers" ? "aria-pressed" : "aria-selected",
        String(selected),
      );
      button.tabIndex = selected || button.dataset.tab === "layers" ? 0 : -1;
      if (selected)
        button.scrollIntoView?.({ block: "nearest", inline: "nearest" });
      runtime.view.get("pane-" + button.dataset.tab).hidden = !selected;
    }
    const index = runtime.config.editorSteps.indexOf(name);
    runtime.view.get("stepStatus").textContent =
      index < 0
        ? "Ajustes avançados · Camadas"
        : `Etapa ${index + 1} de 7 · ${runtime.config.stepLabels[index]}`;
    runtime.view.get("stepStatusBottom").textContent =
      runtime.view.get("stepStatus").textContent;
    runtime.view.get("previousStepBottom").disabled = index === 0;
    runtime.view.get("nextStepBottom").disabled =
      index === runtime.config.editorSteps.length - 1;
    runtime.view.get("previousStep").disabled = index === 0;
    runtime.view.get("nextStep").disabled =
      index === runtime.config.editorSteps.length - 1;
    runtime.services.renderer.render();
    runtime.services.editor.updateExportState();
  }

  function changedCore() {
    runtime.state.dirty = true;
    runtime.services.experience.changed();
    if (
      runtime.state.collection &&
      !runtime.state.batchRendering &&
      !runtime.state.collectionBusy &&
      !runtime.state.editorLocks
    ) {
      runtime.platform.clearTimeout(runtime.state.collectionTimer);
      runtime.state.collectionTimer = runtime.platform.setTimeout(() => {
        runtime.services.collection.capture();
        runtime.services.collection.render();
      }, 400);
    }

    runtime.services.history.scheduleHistory();
    runtime.services.bindings.ensureFrameAsset().catch(() => {});
    runtime.services.bindings.updateFrameSelection();
    runtime.services.editor.updateSpecialFields();
    runtime.services.renderer.render();
    runtime.platform.clearTimeout(runtime.state.draftTimer);
    if (!runtime.state.batchRendering && !runtime.state.historyRestoring)
      runtime.state.draftTimer = runtime.platform.setTimeout(
        runtime.services.projects.saveDraft,
        1100,
      );
  }
  return {
    message,
    num,
    tab,
    changed,
    resetAdvancedField,
    getLayers,
    layerControls,
    updateSpecialFields,
    formatSelection,
    exportBusy,
    updateExportState,
    lockEditor,
    unlockEditor,
    tabCore,
    changedCore,
  };
}
