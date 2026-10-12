export function createService(runtime) {
  const saveInLibrary = async function (copy = false) {
    if (runtime.services.editor.exportBusy()) {
      runtime.services.editor.message(
        "Aguarde o carregamento terminar antes de guardar o projeto.",
        true,
      );
      return;
    }
    return runtime.services.library.saveInLibraryCore(copy);
  };

  const refreshLibrary = async function () {
    const items = await runtime.services.storage.allLibraryItems();
    runtime.state.libraryRecords = items
      .filter((r) => r?.kind === "saved-project")
      .sort((a, b) => b.updated - a.updated);
    runtime.state.libraryFolders = items
      .filter((r) => r?.kind === "saved-folder")
      .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    const validIds = new Set(runtime.state.libraryRecords.map((r) => r.id));
    runtime.state.selectedLibraryIds = new Set(
      [...runtime.state.selectedLibraryIds].filter((id) => validIds.has(id)),
    );
    for (const id of [
      "projectFolder",
      "libraryFolderFilter",
      "moveDestination",
    ])
      runtime.services.library.fillFolderSelect(
        runtime.view.get(id),
        id === "libraryFolderFilter",
      );
    runtime.services.library.renderLibraryList();
  };

  function libraryKey(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  function libraryFolderName(id) {
    return (
      runtime.state.libraryFolders.find((f) => f.id === id)?.name || "Sem pasta"
    );
  }

  function fillFolderSelect(select, filter = false) {
    const current = select.value,
      options = [];
    const add = (value, label) => {
      const o = runtime.platform.document.createElement("option");
      o.value = value;
      o.textContent = label;
      options.push(o);
    };
    if (filter) add("all", "Todas as pastas");
    add("", "Sem pasta");
    for (const folder of runtime.state.libraryFolders)
      add(folder.id, folder.name);
    select.replaceChildren(...options);
    select.value = options.some((o) => o.value === current)
      ? current
      : filter
        ? "all"
        : "";
  }

  function libraryVisibleRecords() {
    const term = runtime.services.library.libraryKey(
        runtime.view.get("librarySearch").value,
      ),
      folder = runtime.view.get("libraryFolderFilter").value;
    return runtime.state.libraryRecords.filter(
      (r) =>
        (folder === "all" || (r.folderId || "") === folder) &&
        (!term ||
          runtime.services.library
            .libraryKey(
              r.name +
                " " +
                runtime.services.collection
                  .cardsOf(r.project)
                  .map((c) => c.project.values.name || "")
                  .join(" "),
            )
            .includes(term)),
    );
  }

  function updateLibrarySelection() {
    const count = runtime.state.selectedLibraryIds.size;
    runtime.view.get("librarySelectionCount").textContent =
      count + " selecionados";
    runtime.view.get("backupSelected").disabled =
      runtime.state.libraryBusy || count === 0;
    runtime.view.get("moveSelected").disabled =
      runtime.state.libraryBusy || count === 0;
    runtime.view.get("clearLibrarySelection").disabled = count === 0;
    const realFolder = runtime.state.libraryFolders.some(
      (f) => f.id === runtime.view.get("libraryFolderFilter").value,
    );
    runtime.view.get("renameLibraryFolder").disabled =
      runtime.state.libraryBusy || !realFolder;
    runtime.view.get("deleteLibraryFolder").disabled =
      runtime.state.libraryBusy || !realFolder;
  }

  function renderLibraryList() {
    const visible = runtime.services.library.libraryVisibleRecords();
    runtime.view.get("libraryList").replaceChildren();
    runtime.view.get("libraryCount").textContent =
      visible.length +
      " de " +
      runtime.state.libraryRecords.length +
      " projetos";
    for (const record of visible) {
      const row = runtime.platform.document.createElement("div");
      row.className = "saved-row";
      const selection = runtime.platform.document.createElement("input");
      selection.type = "checkbox";
      selection.checked = runtime.state.selectedLibraryIds.has(record.id);
      selection.setAttribute("aria-label", "Selecionar " + record.name);
      selection.onchange = () => {
        if (selection.checked) runtime.state.selectedLibraryIds.add(record.id);
        else runtime.state.selectedLibraryIds.delete(record.id);
        runtime.services.library.updateLibrarySelection();
      };
      const image = runtime.platform.document.createElement("img");
      image.src = record.thumbnail;
      image.alt = "";
      const info = runtime.platform.document.createElement("div"),
        title = runtime.platform.document.createElement("strong"),
        date = runtime.platform.document.createElement("small");
      title.textContent = record.name;
      date.textContent =
        runtime.services.library.libraryFolderName(record.folderId) +
        " · " +
        new Date(record.updated).toLocaleString("pt-BR");
      const actions = runtime.platform.document.createElement("div");
      actions.className = "saved-actions";
      const open = runtime.platform.document.createElement("button");
      open.textContent = "Abrir";
      open.onclick = async () => {
        try {
          if (!(await runtime.services.collection.open(record.project))) return;
          runtime.state.activeProjectId = record.id;
          runtime.services.experience.libraryOpened(record);
          runtime.view.get("libraryDialog").close();
          runtime.services.editor.message("Projeto aberto: " + record.name);
        } catch (e) {
          runtime.services.editor.message(e.message, true);
        }
      };
      const download = runtime.platform.document.createElement("button");
      download.textContent = "Baixar";
      download.onclick = () => {
        try {
          runtime.services.projects.downloadProject(
            record.project,
            record.name.replace(/[^a-zA-Z0-9_-]+/g, "_") + ".arcana.json",
          );
        } catch (error) {
          runtime.view.get("libraryStatus").textContent = error.message;
        }
      };
      const remove = runtime.platform.document.createElement("button");
      remove.textContent = "Excluir";
      remove.className = "danger";
      remove.onclick = async () => {
        if (
          !runtime.platform.confirm(
            'Excluir "' + record.name + '" da biblioteca deste navegador?',
          )
        )
          return;
        try {
          await runtime.services.storage.libraryRemove(record.id);
          if (runtime.state.activeProjectId === record.id)
            runtime.state.activeProjectId = null;
          runtime.state.selectedLibraryIds.delete(record.id);
          await runtime.services.library.refreshLibrary();
        } catch (e) {
          runtime.services.editor.message(e.message, true);
        }
      };
      actions.append(open, download, remove);
      const move = runtime.platform.document.createElement("select");
      move.setAttribute("aria-label", "Pasta de " + record.name);
      runtime.services.library.fillFolderSelect(move);
      move.value = record.folderId || "";
      move.onchange = async () => {
        move.disabled = true;
        try {
          await runtime.services.storage.libraryWrite({
            ...record,
            folderId: move.value,
            updated: Date.now(),
          });
          await runtime.services.library.refreshLibrary();
          runtime.view.get("libraryStatus").textContent = "Projeto movido.";
        } catch (e) {
          move.value = record.folderId || "";
          runtime.view.get("libraryStatus").textContent = e.message;
        } finally {
          move.disabled = false;
        }
      };
      info.append(title, date, actions, move);
      row.append(selection, image, info);
      runtime.view.get("libraryList").append(row);
    }
    if (!visible.length) {
      const p = runtime.platform.document.createElement("p");
      p.className = "hint";
      p.textContent = runtime.state.libraryRecords.length
        ? "Nenhum projeto corresponde à busca ou à pasta."
        : "Nenhum projeto guardado. Dê um nome e toque em Guardar na biblioteca.";
      runtime.view.get("libraryList").append(p);
    }
    runtime.services.library.updateLibrarySelection();
  }

  async function createLibraryFolder() {
    if (runtime.state.libraryBusy) return;
    const name = runtime.view.get("libraryFolderName").value.trim();
    if (!name) {
      runtime.view.get("libraryStatus").textContent = "Digite o nome da pasta.";
      return;
    }
    if (name.length > 80) {
      runtime.view.get("libraryStatus").textContent =
        "Use até 80 caracteres no nome da pasta.";
      return;
    }
    if (
      runtime.state.libraryFolders.some(
        (f) =>
          runtime.services.library.libraryKey(f.name) ===
          runtime.services.library.libraryKey(name),
      )
    ) {
      runtime.view.get("libraryStatus").textContent =
        "Já existe uma pasta com esse nome.";
      return;
    }
    try {
      const id = "folder:" + runtime.platform.crypto.randomUUID();
      await runtime.services.storage.libraryWrite({
        kind: "saved-folder",
        id,
        name,
        created: Date.now(),
      });
      await runtime.services.library.refreshLibrary();
      runtime.view.get("projectFolder").value = id;
      runtime.view.get("libraryFolderFilter").value = id;
      runtime.view.get("libraryFolderName").value = "";
      runtime.services.library.renderLibraryList();
      runtime.view.get("libraryStatus").textContent = "Pasta criada: " + name;
    } catch (e) {
      runtime.view.get("libraryStatus").textContent = e.message;
    }
  }

  async function renameLibraryFolder() {
    if (runtime.state.libraryBusy) return;
    const folder = runtime.state.libraryFolders.find(
        (f) => f.id === runtime.view.get("libraryFolderFilter").value,
      ),
      name = runtime.view.get("libraryFolderName").value.trim();
    if (!folder) return;
    if (!name || name.length > 80) {
      runtime.view.get("libraryStatus").textContent =
        "Digite um novo nome de até 80 caracteres.";
      return;
    }
    if (
      runtime.state.libraryFolders.some(
        (f) =>
          f.id !== folder.id &&
          runtime.services.library.libraryKey(f.name) ===
            runtime.services.library.libraryKey(name),
      )
    ) {
      runtime.view.get("libraryStatus").textContent =
        "Já existe uma pasta com esse nome.";
      return;
    }
    try {
      await runtime.services.storage.libraryWrite({ ...folder, name });
      await runtime.services.library.refreshLibrary();
      runtime.view.get("libraryFolderName").value = "";
      runtime.view.get("libraryStatus").textContent = "Pasta renomeada.";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent = e.message;
    }
  }

  async function deleteLibraryFolder() {
    if (runtime.state.libraryBusy) return;
    const folder = runtime.state.libraryFolders.find(
      (f) => f.id === runtime.view.get("libraryFolderFilter").value,
    );
    if (
      !folder ||
      !runtime.platform.confirm(
        'Excluir a pasta "' +
          folder.name +
          '"? Os projetos serão movidos para Sem pasta.',
      )
    )
      return;
    try {
      const moves = runtime.state.libraryRecords
        .filter((r) => r.folderId === folder.id)
        .map((r) => ({ ...r, folderId: "", updated: Date.now() }));
      await runtime.services.storage.libraryBatchWrite(moves, [folder.id]);
      await runtime.services.library.refreshLibrary();
      runtime.view.get("libraryStatus").textContent =
        "Pasta excluída. Seus projetos foram preservados.";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent = e.message;
    }
  }

  async function moveLibrarySelection() {
    if (runtime.state.libraryBusy) return;
    const destination = runtime.view.get("moveDestination").value,
      records = runtime.state.libraryRecords
        .filter((r) => runtime.state.selectedLibraryIds.has(r.id))
        .map((r) => ({ ...r, folderId: destination, updated: Date.now() }));
    if (!records.length) return;
    try {
      await runtime.services.storage.libraryBatchWrite(records);
      await runtime.services.library.refreshLibrary();
      runtime.view.get("libraryStatus").textContent =
        records.length +
        " projetos movidos para " +
        runtime.services.library.libraryFolderName(destination) +
        ".";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent = e.message;
    }
  }

  function makeLibraryBackup(records, folders) {
    return {
      format: "arcana-library",
      version: 1,
      createdAt: new Date().toISOString(),
      folders: folders.map((f) => ({ id: f.id, name: f.name })),
      projects: records.map((r) => ({
        id: r.id,
        name: r.name,
        folderId: r.folderId || "",
        created: r.created,
        updated: r.updated,
        project: r.project,
        thumbnail: r.thumbnail,
      })),
    };
  }

  async function exportLibraryBackup(selected = false) {
    try {
      await runtime.services.library.refreshLibrary();
      const records = selected
        ? runtime.state.libraryRecords.filter((r) =>
            runtime.state.selectedLibraryIds.has(r.id),
          )
        : runtime.state.libraryRecords;
      if (selected && !records.length)
        throw new Error("Selecione ao menos um projeto.");
      const used = new Set(records.map((r) => r.folderId)),
        folders = selected
          ? runtime.state.libraryFolders.filter((f) => used.has(f.id))
          : runtime.state.libraryFolders;
      if (!records.length && !folders.length)
        throw new Error("A biblioteca está vazia.");
      const backup = runtime.services.schema.validateLibraryBackup(
          runtime.services.library.makeLibraryBackup(records, folders),
        ),
        backupBlob = new runtime.platform.Blob([JSON.stringify(backup)], {
          type: "application/json",
        });
      if (backupBlob.size > 150000000)
        throw new Error(
          "O backup excede 150 MB. Selecione menos projetos ou reduza suas imagens.",
        );
      runtime.services.printing.saveBlob(
        backupBlob,
        "Arcana_biblioteca_" +
          new Date().toISOString().slice(0, 10) +
          ".arcana-library.json",
      );
      runtime.view.get("libraryStatus").textContent =
        "Backup baixado: " +
        records.length +
        " projetos e " +
        folders.length +
        " pastas.";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent = e.message;
    }
  }

  async function prepareLibraryBackup(file) {
    runtime.state.pendingLibraryBackup = null;
    runtime.view.get("confirmRestoreLibrary").disabled = true;
    runtime.view.get("libraryRestoreSummary").hidden = true;
    if (!file) return;
    try {
      if (file.size > 150000000)
        throw new Error("Use um backup de até 150 MB.");
      const data = runtime.services.schema.validateLibraryBackup(
        JSON.parse(await file.text()),
      );
      runtime.state.pendingLibraryBackup = data;
      runtime.view.get("libraryRestoreText").textContent =
        data.projects.length +
        " projetos e " +
        data.folders.length +
        " pastas serão adicionados. Projetos existentes serão preservados; os importados serão novas cópias.";
      runtime.view.get("libraryRestoreSummary").hidden = false;
      runtime.view.get("confirmRestoreLibrary").disabled = false;
      runtime.view.get("libraryStatus").textContent =
        "Backup verificado. Confira o resumo antes de restaurar.";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent =
        "Não foi possível abrir o backup: " + e.message;
    }
  }

  async function restoreLibraryBackup() {
    if (!runtime.state.pendingLibraryBackup || runtime.state.libraryBusy)
      return;
    runtime.state.libraryBusy = true;
    runtime.view.get("confirmRestoreLibrary").disabled = true;
    try {
      const data = runtime.services.schema.validateLibraryBackup(
        runtime.state.pendingLibraryBackup,
      );
      await runtime.services.library.refreshLibrary();
      const records = [],
        folderMap = new Map(),
        known = [...runtime.state.libraryFolders];
      for (const folder of data.folders) {
        let match = known.find(
          (f) =>
            runtime.services.library.libraryKey(f.name) ===
            runtime.services.library.libraryKey(folder.name),
        );
        if (!match) {
          match = {
            kind: "saved-folder",
            id: "folder:" + runtime.platform.crypto.randomUUID(),
            name: folder.name.trim(),
            created: Date.now(),
          };
          known.push(match);
          records.push(match);
        }
        folderMap.set(folder.id, match.id);
      }
      const thumbnail = runtime.state.frameCatalog.find(
        (p) => p.id === "modern",
      ).thumb;
      for (const source of data.projects) {
        records.push({
          kind: "saved-project",
          id: "saved:" + runtime.platform.crypto.randomUUID(),
          name: source.name.trim(),
          folderId: folderMap.get(source.folderId) || "",
          created: Number.isFinite(source.created)
            ? source.created
            : Date.now(),
          updated: Date.now(),
          project: source.project,
          thumbnail: source.thumbnail || thumbnail,
        });
      }
      await runtime.services.storage.libraryBatchWrite(records);
      runtime.state.pendingLibraryBackup = null;
      runtime.view.get("libraryBackupFile").value = "";
      runtime.view.get("libraryRestoreSummary").hidden = true;
      await runtime.services.library.refreshLibrary();
      runtime.view.get("libraryStatus").textContent =
        "Backup restaurado: " +
        data.projects.length +
        " projetos adicionados como cópias.";
    } catch (e) {
      runtime.view.get("libraryStatus").textContent =
        "A restauração não foi concluída: " + e.message;
      runtime.view.get("confirmRestoreLibrary").disabled = false;
    } finally {
      runtime.state.libraryBusy = false;
      runtime.services.library.updateLibrarySelection();
    }
  }

  const saveInLibraryCore = async function (copy = false) {
    if (runtime.state.libraryBusy) return;
    const button = copy
      ? runtime.view.get("saveCopy")
      : runtime.view.get("storeProject");
    button.disabled = true;
    try {
      await runtime.state.embeddedReady;
      if (!(await runtime.state.fontsReady))
        throw new Error("Aguarde as fontes carregarem.");
      await runtime.services.bindings.ensureFrameAsset();
      const saveRevision = runtime.state.editRevision;
      const project = await runtime.services.collection.portable(),
        name = (
          runtime.view.get("libraryName").value.trim() ||
          runtime.view.get("name").value ||
          "Minha carta"
        ).slice(0, 160),
        id =
          !copy && runtime.state.activeProjectId
            ? runtime.state.activeProjectId
            : "saved:" + runtime.platform.crypto.randomUUID(),
        old = runtime.state.libraryRecords.find((r) => r.id === id);
      const record = {
        kind: "saved-project",
        id,
        name,
        folderId: runtime.view.get("projectFolder").value,
        updated: Date.now(),
        created: old?.created || Date.now(),
        project,
        thumbnail: runtime.services.projects.projectThumbnail(),
      };
      await runtime.services.storage.libraryWrite(record);
      runtime.services.experience.librarySaved(saveRevision);
      runtime.state.activeProjectId = id;
      await runtime.services.library.refreshLibrary();
      runtime.view.get("libraryStatus").textContent =
        "Projeto guardado: " + name + ".";
      runtime.services.editor.message(
        "Projeto guardado na biblioteca deste navegador.",
      );
    } catch (e) {
      runtime.view.get("libraryStatus").textContent =
        "Não foi possível salvar: " + e.message;
      runtime.services.editor.message(e.message, true);
    } finally {
      button.disabled = false;
    }
  };
  return {
    saveInLibrary,
    refreshLibrary,
    libraryKey,
    libraryFolderName,
    fillFolderSelect,
    libraryVisibleRecords,
    updateLibrarySelection,
    renderLibraryList,
    createLibraryFolder,
    renameLibraryFolder,
    deleteLibraryFolder,
    moveLibrarySelection,
    makeLibraryBackup,
    exportLibraryBackup,
    prepareLibraryBackup,
    restoreLibraryBackup,
    saveInLibraryCore,
  };
}
