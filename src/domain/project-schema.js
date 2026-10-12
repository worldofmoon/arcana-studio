export function createService(runtime) {
  function backupObject(value) {
    return !!value && typeof value === "object" && !Array.isArray(value);
  }

  function validateBackupProject(p) {
    if (p?.format === "arcana-project") {
      if (
        p.version !== 1 ||
        typeof p.name !== "string" ||
        !p.name.trim() ||
        p.name.length > 160 ||
        typeof p.sharedBack !== "boolean" ||
        !Array.isArray(p.cards) ||
        !p.cards.length ||
        p.cards.length > 100
      )
        throw new Error("Projeto com várias cartas inválido.");
      const ids = new Set();
      for (const card of p.cards) {
        if (
          !runtime.services.schema.backupObject(card) ||
          typeof card.id !== "string" ||
          !card.id ||
          card.id.length > 80 ||
          ids.has(card.id) ||
          typeof card.label !== "string" ||
          card.label.length > 160 ||
          !Number.isInteger(card.copies) ||
          card.copies < 1 ||
          card.copies > 30 ||
          card.project?.format !== "arcana-studio"
        )
          throw new Error("Há uma carta inválida no projeto.");
        ids.add(card.id);
        runtime.services.schema.validateBackupProject(card.project);
        if (
          card.thumbnail !== undefined &&
          (typeof card.thumbnail !== "string" ||
            card.thumbnail.length > 2000000 ||
            (card.thumbnail &&
              !/^data:image\/(png|jpeg|webp);base64,/.test(card.thumbnail)))
        )
          throw new Error("Miniatura inválida no projeto.");
      }
      if (!ids.has(p.activeId))
        throw new Error("Carta ativa inválida no projeto.");
      return p;
    }

    if (
      !runtime.services.schema.backupObject(p) ||
      p.format !== "arcana-studio" ||
      p.version !== 2 ||
      !runtime.services.schema.backupObject(p.values) ||
      !runtime.services.schema.backupObject(p.media)
    )
      throw new Error("O backup contém um projeto inválido.");
    for (const [k, v] of Object.entries(p.values)) {
      if (!runtime.config.fields.includes(k)) continue;
      if (
        !["string", "number", "boolean"].includes(typeof v) ||
        String(v).length > 100000
      )
        throw new Error("Há um campo inválido no backup.");
    }
    for (const kind of runtime.config.mediaKinds) {
      const url = p.media[kind] ?? "";
      if (
        typeof url !== "string" ||
        url.length > 36000000 ||
        (url &&
          !/^(data:image\/(png|jpeg|webp|gif|svg\+xml);base64,|https:\/\/(cards|svgs)\.scryfall\.io\/)/.test(
            url,
          ))
      )
        throw new Error("Há uma imagem inválida no backup.");
    }
    if (p.fonts !== undefined && !runtime.services.schema.backupObject(p.fonts))
      throw new Error("Fontes inválidas no backup.");
    for (const kind of ["title", "rules"]) {
      const url = p.fonts?.[kind] ?? "";
      if (
        typeof url !== "string" ||
        url.length > 7200000 ||
        (url && !/^data:application\/octet-stream;base64,/.test(url))
      )
        throw new Error("Há uma fonte inválida no backup.");
    }
    return p;
  }

  function validateLibraryBackup(data) {
    if (
      !runtime.services.schema.backupObject(data) ||
      data.format !== "arcana-library" ||
      data.version !== 1 ||
      !Array.isArray(data.projects) ||
      !Array.isArray(data.folders) ||
      data.projects.length > 500 ||
      data.folders.length > 200
    )
      throw new Error(
        "Este arquivo não é um backup válido da biblioteca Arcana.",
      );
    const ids = new Set();
    for (const f of data.folders) {
      if (
        !runtime.services.schema.backupObject(f) ||
        typeof f.id !== "string" ||
        !f.id ||
        ids.has(f.id) ||
        typeof f.name !== "string" ||
        !f.name.trim() ||
        f.name.length > 80
      )
        throw new Error("Há uma pasta inválida no backup.");
      ids.add(f.id);
    }
    const projects = new Set();
    for (const r of data.projects) {
      if (
        !runtime.services.schema.backupObject(r) ||
        typeof r.id !== "string" ||
        !r.id ||
        projects.has(r.id) ||
        typeof r.name !== "string" ||
        !r.name.trim() ||
        r.name.length > 160 ||
        (r.folderId && !ids.has(r.folderId))
      )
        throw new Error("Há um registro inválido no backup.");
      projects.add(r.id);
      runtime.services.schema.validateBackupProject(r.project);
      if (
        r.thumbnail !== undefined &&
        (typeof r.thumbnail !== "string" ||
          r.thumbnail.length > 2000000 ||
          (r.thumbnail &&
            !/^data:image\/(png|jpeg|webp|svg\+xml);base64,/.test(r.thumbnail)))
      )
        throw new Error("Há uma miniatura inválida no backup.");
    }
    if (!data.projects.length && !data.folders.length)
      throw new Error("O backup está vazio.");
    return data;
  }
  return { backupObject, validateBackupProject, validateLibraryBackup };
}
