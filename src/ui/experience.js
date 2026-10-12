export function createService(runtime) {
  let noticeTimer;
  const time = (value) =>
    new Date(value).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  function notify(text, error = false) {
    const notice = runtime.view.get("feedback"),
      status = runtime.view.get("appStatus");
    status.textContent = text;
    status.setAttribute("role", error ? "alert" : "status");
    status.setAttribute("aria-live", error ? "assertive" : "polite");
    status.classList.toggle("error", error);
    notice.hidden = false;
    notice.classList.toggle("error", error);
    runtime.platform.clearTimeout(noticeTimer);
    if (!error)
      noticeTimer = runtime.platform.setTimeout(() => {
        notice.hidden = true;
      }, 9000);
  }
  function saveStatus(
    status,
    revision = runtime.state.editRevision,
    savedAt = null,
  ) {
    if (revision !== runtime.state.editRevision && status === "saved")
      status = "pending";
    runtime.state.draftStatus = status;
    const node = runtime.view.get("saveStatus");
    const description = {
      idle: "Rascunho ainda não salvo",
      pending: "Alterações aguardando salvamento",
      saving: "Salvando rascunho…",
      saved:
        "Rascunho salvo neste navegador" +
        (savedAt ? " às " + time(savedAt) : ""),
      error: "Falha ao salvar · baixe uma cópia",
    }[status];
    if (node.textContent !== description) node.textContent = description;
    node.classList.toggle("error", status === "error");
    runtime.view.get("backupNow").hidden = status !== "error";
  }
  function changed() {
    if (runtime.state.batchRendering) return;
    runtime.state.editRevision++;
    saveStatus("pending");
    runtime.view.get("librarySaveStatus").textContent = runtime.state
      .activeProjectId
      ? "Biblioteca: alterações ainda não atualizadas"
      : "";
    identify();
  }
  function identify() {
    const deck = runtime.state.collection,
      card = deck?.cards.find((c) => c.id === deck.activeId);
    const project =
      deck?.name || runtime.view.get("name").value || "Novo projeto";
    const label =
      card?.label || runtime.view.get("name").value || "Carta sem nome";
    const index = deck
      ? deck.cards.findIndex((c) => c.id === deck.activeId) + 1
      : 1;
    runtime.view.get("currentProjectName").textContent = "Projeto: " + project;
    runtime.view.get("currentCardName").textContent =
      `Carta ${index} de ${deck?.cards.length || 1}: ${label}`;
    runtime.view.get("previewProjectName").textContent = "Projeto: " + project;
    runtime.view.get("previewCardName").textContent =
      `Carta ${index} de ${deck?.cards.length || 1}: ${label}`;
    for (const id of [
      "currentProjectName",
      "currentCardName",
      "previewProjectName",
      "previewCardName",
    ])
      runtime.view
        .get(id)
        .setAttribute("title", runtime.view.get(id).textContent);
  }
  function librarySaved(revision) {
    runtime.view.get("librarySaveStatus").textContent =
      revision === runtime.state.editRevision
        ? "Biblioteca atualizada às " + time(Date.now())
        : "Biblioteca: versão anterior · há novas alterações";
  }
  function libraryOpened(record) {
    runtime.view.get("librarySaveStatus").textContent =
      "Biblioteca: versão salva em " +
      new Date(record.updated).toLocaleString("pt-BR");
  }
  function restoreHint(draft) {
    if (!draft) return;
    const name = (draft.name || draft.values?.name || "seu projeto").slice(
      0,
      160,
    );
    const date = draft.savedAt
      ? " · " + new Date(draft.savedAt).toLocaleString("pt-BR")
      : "";
    runtime.view.get("restoreText").textContent =
      "Retomar rascunho: " + name + date;
  }
  function setEditing(editing) {
    runtime.platform.document.body?.classList.toggle("editing-field", editing);
  }
  function bind() {
    runtime.view.get("dismissFeedback").onclick = () => {
      runtime.view.get("feedback").hidden = true;
    };
    runtime.view.get("backupNow").onclick = () =>
      runtime.services.bindings.saveProjectHandler();
    let compact = false;
    runtime.view.get("compactPreview").onclick = () => {
      compact = !compact;
      runtime.platform.document.body?.classList.toggle(
        "preview-compact",
        compact,
      );
      runtime.view
        .get("compactPreview")
        .setAttribute("aria-expanded", String(!compact));
      runtime.view.get("compactPreview").textContent = compact
        ? "Expandir"
        : "Compactar";
    };
    const typing = (field) =>
      field &&
      (field.tagName === "TEXTAREA" ||
        (field.tagName === "INPUT" &&
          [
            "text",
            "number",
            "search",
            "email",
            "url",
            "tel",
            "password",
          ].includes(field.type)));
    runtime.platform.document.addEventListener("focusin", (event) =>
      setEditing(!!typing(event.target)),
    );
    runtime.platform.document.addEventListener("focusout", () =>
      runtime.platform.setTimeout(
        () => setEditing(!!typing(runtime.platform.document.activeElement)),
        0,
      ),
    );
    const preview = runtime.view.canvas.parentElement;
    if (preview && runtime.platform.ResizeObserver) {
      const observer = new runtime.platform.ResizeObserver(() =>
        runtime.platform.document.documentElement.style.setProperty(
          "--preview-offset",
          preview.getBoundingClientRect().height + "px",
        ),
      );
      observer.observe(preview);
    }
    saveStatus("idle");
    identify();
  }
  return {
    notify,
    saveStatus,
    changed,
    identify,
    librarySaved,
    libraryOpened,
    restoreHint,
    setEditing,
    bind,
  };
}
