export function createService(runtime) {
  function snapshot() {
    const values = {};
    for (const id of runtime.config.fields)
      values[id] =
        runtime.view.get(id).type === "checkbox"
          ? runtime.view.get(id).checked
          : runtime.view.get(id).value;
    return {
      format: "arcana-studio",
      version: 2,
      values,
      media: { ...runtime.state.dataUrls },
      fonts: { ...runtime.state.fontData },
    };
  }

  async function saveDraft() {
    let db;
    try {
      db = await runtime.services.storage.database();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("projects", "readwrite");
        tx.objectStore("projects").put(
          runtime.services.collection.snapshot(),
          "draft",
        );
        tx.oncomplete = resolve;
        tx.onerror = () => reject(tx.error);
      });
      db.close();
    } catch (e) {
      runtime.services.editor.message(
        "O salvamento automático não está disponível. Use Baixar projeto para guardar seu trabalho.",
        true,
      );
    } finally {
      db?.close();
    }
  }

  const restoreProject = async function (source) {
    const project = runtime.services.projects.normalizedProject(source),
      request = ++runtime.state.projectRestoreVersion;
    runtime.services.editor.lockEditor();
    try {
      ++runtime.state.setRequest;
      runtime.state.setLoading = false;
      ++runtime.state.importVersion;
      runtime.state.importLoading = false;
      for (const kind of ["title", "rules"]) {
        ++runtime.state.fontVersions[kind];
        runtime.state.fontLoading.delete(kind);
      }
      for (const kind of runtime.config.mediaKinds) {
        ++runtime.state.mediaEpoch[kind];
        runtime.state.pendingMediaLoads.delete(kind);
      }
      const loaded = Object.fromEntries(
        await Promise.all(
          runtime.config.mediaKinds.map(async (kind) => [
            kind,
            project.media[kind]
              ? await runtime.services.images.imageUrl(project.media[kind])
              : null,
          ]),
        ),
      );
      const preparedFonts = {};
      for (const kind of ["title", "rules"]) {
        const url = project.fonts[kind] || "";
        if (url && url !== runtime.state.fontData[kind]) {
          const face = new runtime.platform.FontFace(
            kind === "title" ? "ArcanaCustomTitle" : "ArcanaCustomRules",
            "url(" + url + ")",
            { weight: kind === "title" ? "700" : "400" },
          );
          await face.load();
          preparedFonts[kind] = face;
        }
      }
      const preset = runtime.state.frameCatalog.find(
        (p) => p.id === project.values.frame,
      );
      if (preset?.asset && !runtime.state.frameImages.has(preset.id))
        runtime.state.frameImages.set(
          preset.id,
          await runtime.adapters.frames.get(preset.asset),
        );
      if (request !== runtime.state.projectRestoreVersion) return false;
      for (const kind of ["title", "rules"]) {
        const url = project.fonts[kind] || "";
        if (url === runtime.state.fontData[kind]) continue;
        if (runtime.state.fontFaces[kind])
          runtime.platform.document.fonts.delete(runtime.state.fontFaces[kind]);
        runtime.state.fontFaces[kind] = preparedFonts[kind] || null;
        runtime.state.fontData[kind] = url;
        if (preparedFonts[kind])
          runtime.platform.document.fonts.add(preparedFonts[kind]);
      }
      for (const id of runtime.config.fields) {
        if (runtime.view.get(id).type === "checkbox")
          runtime.view.get(id).checked = project.values[id];
        else runtime.view.get(id).value = project.values[id];
      }
      for (const kind of runtime.config.mediaKinds) {
        runtime.state.media[kind] = loaded[kind];
        runtime.state.dataUrls[kind] = project.media[kind];
      }
      runtime.state.selectedCard = null;
      runtime.view.get("faceSelect").disabled = true;
      runtime.view.get("faceSelector").hidden = true;
      runtime.services.bindings.updateFrameSelection();
      runtime.services.editor.layerControls();
      runtime.services.editor.tab("art");
      runtime.services.editor.changed();
      runtime.services.editor.message("Projeto restaurado.");
      runtime.view.get("restoreBar").hidden = true;
      return true;
    } finally {
      runtime.services.editor.unlockEditor();
    }
  };

  function safeName() {
    return (runtime.view.get("name").value || "carta")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
  }

  async function portableSnapshot() {
    const project = runtime.services.projects.snapshot();
    for (const kind of runtime.config.mediaKinds)
      if (
        runtime.state.media[kind] &&
        project.media[kind].startsWith("https:")
      ) {
        const c = runtime.platform.document.createElement("canvas");
        c.width =
          runtime.state.media[kind].naturalWidth ||
          runtime.state.media[kind].width;
        c.height =
          runtime.state.media[kind].naturalHeight ||
          runtime.state.media[kind].height;
        c.getContext("2d").drawImage(runtime.state.media[kind], 0, 0);
        project.media[kind] = c.toDataURL("image/png");
      }
    return project;
  }

  function projectThumbnail() {
    const c = runtime.platform.document.createElement("canvas");
    c.width = 180;
    c.height = 251;
    const t = c.getContext("2d");
    t.scale(180 / 1260, 251 / 1760);
    runtime.services.renderer.renderFront(t);
    return c.toDataURL("image/jpeg", 0.82);
  }

  function normalizedProject(project) {
    runtime.services.schema.validateBackupProject(project);
    const values = { ...runtime.state.fieldDefaults };
    const enums = {
      frame: runtime.state.frameCatalog.map((p) => p.id),
      palette: [
        "artifact",
        "white",
        "blue",
        "black",
        "red",
        "green",
        "gold",
        "land",
        "custom",
      ],
      rarity: ["common", "uncommon", "rare", "mythic"],
      cardLayout: ["normal", "planeswalker", "saga", "adventure", "split"],
      colorBlend: ["smooth", "split"],
      textAlign: ["left", "center", "right"],
    };
    for (const id of runtime.config.fields) {
      if (!(id in project.values)) continue;
      const value = project.values[id];
      if (enums[id] && !enums[id].includes(value))
        throw new Error("Opção inválida no campo " + id + ".");
      if (runtime.view.get(id).type === "checkbox") {
        if (typeof value !== "boolean")
          throw new Error("Opção inválida no campo " + id + ".");
        values[id] = value;
      } else if (
        runtime.view.get(id).type === "range" ||
        runtime.view.get(id).type === "number"
      ) {
        const n = Number(value);
        if (!Number.isFinite(n))
          throw new Error("Número inválido no campo " + id + ".");
        const min = Number(runtime.view.get(id).min),
          max = Number(runtime.view.get(id).max);
        values[id] = String(
          Math.min(
            runtime.view.get(id).max !== undefined &&
              runtime.view.get(id).max !== ""
              ? max
              : Infinity,
            Math.max(
              runtime.view.get(id).min !== undefined &&
                runtime.view.get(id).min !== ""
                ? min
                : -Infinity,
              n,
            ),
          ),
        );
      } else {
        if (!["string", "number"].includes(typeof value))
          throw new Error("Texto inválido no campo " + id + ".");
        values[id] = String(value);
      }
    }
    return {
      ...project,
      values,
      media: Object.fromEntries(
        runtime.config.mediaKinds.map((k) => [k, project.media[k] || ""]),
      ),
      fonts: project.fonts || {},
    };
  }

  function downloadProject(project, name) {
    const blob = new runtime.platform.Blob([JSON.stringify(project)], {
      type: "application/json",
    });
    if (blob.size > 60000000)
      throw new Error(
        "O projeto excede 60 MB. Reduza as imagens ou fontes antes de baixar.",
      );
    runtime.services.printing.saveBlob(blob, name);
  }
  return {
    snapshot,
    saveDraft,
    restoreProject,
    safeName,
    portableSnapshot,
    projectThumbnail,
    normalizedProject,
    downloadProject,
  };
}
