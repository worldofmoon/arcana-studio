import { renderCollection } from "../ui/collection-view.js";
import { zipArchive } from "../domain/zip.js";
const MAX_CARDS = 100;
const BACK_FIELDS = ["backZoom", "backRotation", "backX", "backY"];
const FRAME_FIELDS = [
  "frame",
  "palette",
  "accent",
  "border",
  "panelOpacity",
  "dualColor",
  "colorLeft",
  "colorRight",
  "colorBlend",
];
const clone = (value) => JSON.parse(JSON.stringify(value));
export function createService(runtime) {
  const sessions = new Map();
  const uid = () => runtime.platform.crypto.randomUUID();
  const model = () => runtime.state.collection;
  const current = () => model()?.cards.find((c) => c.id === model().activeId);
  function cardsOf(project) {
    return project.format === "arcana-project"
      ? project.cards
      : [
          {
            id: "single",
            label: project.values?.name || "Carta",
            copies: 1,
            project,
          },
        ];
  }
  function captureSession(id) {
    sessions.set(id, {
      history: runtime.state.historyEntries.slice(),
      index: runtime.state.historyIndex,
      selectedCard: runtime.state.selectedCard,
      faceIndex: runtime.state.faceIndex,
      faces: [...runtime.view.get("faceSelect").children].map((o) => ({
        value: o.value,
        text: o.textContent,
      })),
      hidden: runtime.view.get("faceSelector").hidden,
    });
  }
  function restoreSession(card) {
    const session = sessions.get(card.id);
    runtime.platform.clearTimeout(runtime.state.historyTimer);
    runtime.state.historyEntries = session?.history || [clone(card.project)];
    runtime.state.historyIndex = session?.index ?? 0;
    if (session?.selectedCard) {
      runtime.state.selectedCard = session.selectedCard;
      runtime.state.faceIndex = session.faceIndex;
      runtime.view.get("faceSelect").replaceChildren(
        ...session.faces.map((face) => {
          const o = runtime.platform.document.createElement("option");
          o.value = face.value;
          o.textContent = face.text;
          return o;
        }),
      );
      runtime.view.get("faceSelect").value = session.faceIndex;
      runtime.view.get("faceSelect").disabled = session.hidden;
      runtime.view.get("faceSelector").hidden = session.hidden;
    }
    runtime.services.history.updateHistoryButtons();
  }
  function shareBack() {
    if (!model()?.sharedBack || !current()) return;
    const source = current().project;
    for (const card of model().cards) {
      card.project.media.back = source.media.back;
      for (const key of BACK_FIELDS)
        card.project.values[key] = source.values[key];
    }
  }
  function capture() {
    if (
      !current() ||
      runtime.state.batchRendering ||
      runtime.state.collectionBusy ||
      runtime.state.editorLocks
    )
      return;
    current().project = runtime.services.projects.snapshot();
    current().thumbnail = runtime.services.projects.projectThumbnail();
    captureSession(current().id);
    shareBack();
  }
  function ensure() {
    if (!model()) {
      const id = uid();
      runtime.state.collection = {
        format: "arcana-project",
        version: 1,
        name: "Meu projeto",
        activeId: id,
        sharedBack: false,
        cards: [
          {
            id,
            label: "",
            copies: 1,
            project: runtime.services.projects.snapshot(),
            thumbnail: runtime.services.projects.projectThumbnail(),
          },
        ],
      };
      captureSession(id);
    }
    return model();
  }
  function snapshot() {
    capture();
    return model() ? clone(model()) : runtime.services.projects.snapshot();
  }
  function normalize(source) {
    runtime.services.schema.validateBackupProject(source);
    if (source.format !== "arcana-project")
      return runtime.services.projects.normalizedProject(source);
    const result = clone(source);
    result.cards = result.cards.map((c) => ({
      ...c,
      project: runtime.services.projects.normalizedProject(c.project),
    }));
    return result;
  }
  async function run(action) {
    if (runtime.services.editor.exportBusy() || runtime.state.collectionBusy)
      throw new Error(
        "Aguarde o carregamento terminar antes de trocar ou organizar cartas.",
      );
    runtime.services.history.commitHistory();
    capture();
    runtime.state.collectionBusy = true;
    runtime.services.editor.lockEditor();
    try {
      return await action();
    } finally {
      runtime.state.collectionBusy = false;
      runtime.services.editor.unlockEditor();
      render();
    }
  }
  async function open(source) {
    // Validate every card before replacing the editor or current collection.
    const incoming = normalize(source);
    if (runtime.state.collectionBusy)
      throw new Error("Aguarde a operação atual terminar.");
    const request = ++runtime.state.collectionOpenVersion;
    runtime.state.collectionBusy = true;
    try {
      const active =
        incoming.format === "arcana-project"
          ? incoming.cards.find((c) => c.id === incoming.activeId)
          : null;
      if (
        !(await runtime.services.projects.restoreProject(
          active?.project || incoming,
        )) ||
        request !== runtime.state.collectionOpenVersion
      )
        return false;
      runtime.state.collection = active ? incoming : null;
      sessions.clear();
      if (active) restoreSession(active);
      runtime.state.activeProjectId = null;
      render();
      return true;
    } finally {
      runtime.state.collectionBusy = false;
      render();
      runtime.services.editor.updateExportState();
    }
  }
  async function select(id) {
    if (current()?.id === id) return;
    return run(async () => {
      const card = model()?.cards.find((c) => c.id === id);
      if (!card) throw new Error("Carta não encontrada.");
      const tab = runtime.state.activeTab;
      if (!(await runtime.services.projects.restoreProject(card.project)))
        return;
      model().activeId = id;
      restoreSession(card);
      runtime.services.editor.tab(tab);
    });
  }
  async function add(duplicate = false) {
    if ((model()?.cards.length || 1) >= MAX_CARDS)
      throw new Error("Use até 100 cartas por projeto.");
    return run(async () => {
      const deck = ensure(),
        source = current();
      const project = duplicate
        ? clone(source.project)
        : {
            format: "arcana-studio",
            version: 2,
            values: { ...runtime.state.fieldDefaults },
            media: {},
            fonts: {},
          };
      if (deck.sharedBack) {
        project.media.back = source.project.media.back;
        for (const key of BACK_FIELDS)
          project.values[key] = source.project.values[key];
      }
      const card = {
        id: uid(),
        label: duplicate
          ? (source.label || source.project.values.name || "Carta") + " (cópia)"
          : "",
        copies: duplicate ? source.copies : 1,
        project: runtime.services.projects.normalizedProject(project),
        thumbnail: "",
      };
      if (!(await runtime.services.projects.restoreProject(card.project)))
        return;
      deck.cards.push(card);
      deck.activeId = card.id;
      restoreSession(card);
      runtime.services.editor.tab(duplicate ? "text" : "card");
    });
  }
  async function remove() {
    if (!model() || model().cards.length < 2)
      throw new Error("O projeto precisa manter pelo menos uma carta.");
    if (
      !runtime.platform.confirm(
        "Excluir esta carta do projeto? As outras cartas serão mantidas.",
      )
    )
      return;
    return run(async () => {
      const deck = model(),
        index = deck.cards.findIndex((c) => c.id === deck.activeId),
        old = deck.activeId;
      const target =
        deck.cards[index === deck.cards.length - 1 ? index - 1 : index + 1];
      if (!(await runtime.services.projects.restoreProject(target.project)))
        return;
      deck.cards.splice(index, 1);
      deck.activeId = target.id;
      sessions.delete(old);
      restoreSession(target);
    });
  }
  function mark() {
    runtime.state.dirty = true;
    runtime.services.editor.changed();
    render();
  }
  function renameProject(name) {
    ensure().name = name.trim().slice(0, 160) || "Meu projeto";
    mark();
  }
  function renameCard(label) {
    ensure();
    capture();
    current().label = label.trim().slice(0, 160);
    mark();
  }
  function copies(value) {
    ensure();
    current().copies = Math.max(
      1,
      Math.min(30, Math.trunc(Number(value) || 1)),
    );
    mark();
  }
  function move(offset) {
    ensure();
    capture();
    const deck = model(),
      i = deck.cards.findIndex((c) => c.id === deck.activeId),
      j = i + offset;
    if (j < 0 || j >= deck.cards.length) return;
    [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    mark();
  }
  function toggleBack(enabled) {
    ensure();
    capture();
    if (enabled && !runtime.state.media.back)
      throw new Error("Envie primeiro uma imagem na etapa Verso.");
    model().sharedBack = enabled;
    shareBack();
    mark();
  }
  function applyFrame() {
    ensure();
    capture();
    const source = current().project;
    if (
      !runtime.platform.confirm(
        "Aplicar a moldura e suas cores a todas as cartas deste projeto?",
      )
    )
      return;
    for (const card of model().cards) {
      for (const key of FRAME_FIELDS)
        card.project.values[key] = source.values[key];
      card.project.media.frame = source.media.frame;
      card.thumbnail = "";
      sessions.delete(card.id);
    }
    mark();
  }
  async function portable() {
    const project = snapshot(),
      cache = new Map();
    for (const card of cardsOf(project))
      for (const kind of runtime.config.mediaKinds) {
        const url = card.project.media[kind];
        if (!url?.startsWith("https:")) continue;
        if (!cache.has(url))
          cache.set(
            url,
            (async () => {
              const image =
                  runtime.config.mediaKinds
                    .map(
                      (k) =>
                        runtime.state.dataUrls[k] === url &&
                        runtime.state.media[k],
                    )
                    .find(Boolean) ||
                  (await runtime.services.images.imageUrl(url)),
                c = runtime.platform.document.createElement("canvas");
              c.width = image.naturalWidth || image.width;
              c.height = image.naturalHeight || image.height;
              c.getContext("2d").drawImage(image, 0, 0);
              return c.toDataURL("image/png");
            })(),
          );
        card.project.media[kind] = await cache.get(url);
      }
    return project;
  }
  function name() {
    return model()?.name || runtime.view.get("name").value || "Carta";
  }
  function safeName() {
    return name()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_");
  }
  const render = () => renderCollection(runtime);
  async function handle(action) {
    try {
      await action();
      if (!runtime.state.collectionBusy) {
        capture();
        mark();
      }
    } catch (error) {
      runtime.services.editor.message(error.message, true);
      render();
    }
  }
  async function exportPngs() {
    if (runtime.services.editor.exportBusy())
      throw new Error("Aguarde o carregamento terminar.");
    runtime.services.history.commitHistory();
    capture();
    runtime.services.editor.lockEditor();
    try {
      await exportPngsCore();
    } finally {
      runtime.services.editor.unlockEditor();
    }
  }
  async function exportPngsCore() {
    const source = await portable(),
      cards = cardsOf(source),
      side = runtime.view.get("downloadSide").value;
    if (side === "back" && cards.some((c) => !c.project.media.back))
      throw new Error(
        "Envie um verso para todas as cartas antes de exportar versos.",
      );
    const before = runtime.services.projects.snapshot(),
      tab = runtime.state.activeTab,
      files = [];
    let bytes = 0,
      generated = false;
    runtime.state.batchRendering = true;
    runtime.state.historyRestoring = true;
    runtime.services.editor.lockEditor();
    try {
      await runtime.state.embeddedReady;
      if (!(await runtime.state.fontsReady))
        throw new Error("Aguarde as fontes carregarem.");
      for (let i = 0; i < cards.length; i++) {
        runtime.services.editor.message(
          `Preparando PNG ${i + 1} de ${cards.length}…`,
        );
        await runtime.services.projects.restoreProject(cards[i].project);
        runtime.services.editor.tab(side === "back" ? "back" : "art");
        const blob = await runtime.services.printing.printablePng(
            runtime.view.canvas,
          ),
          data = new Uint8Array(await blob.arrayBuffer());
        bytes += data.length;
        if (bytes > 200000000)
          throw new Error(
            "O ZIP excede 200 MB. Divida o projeto em conjuntos menores.",
          );
        const label = (
          cards[i].label ||
          cards[i].project.values.name ||
          "Carta"
        )
          .replace(/[^a-zA-Z0-9_-]+/g, "_")
          .slice(0, 80);
        files.push({
          name: `${String(i + 1).padStart(3, "0")}_${label}_${side === "back" ? "verso" : "frente"}_69x94mm.png`,
          bytes: data,
        });
      }
      runtime.services.printing.saveBlob(
        zipArchive(files, runtime.platform),
        safeName() + "_" + side + ".zip",
      );
      generated = true;
    } finally {
      try {
        await runtime.services.projects.restoreProject(before);
        restoreSession(current() || { id: "single", project: before });
        runtime.services.editor.tab(tab);
      } finally {
        runtime.state.batchRendering = false;
        runtime.state.historyRestoring = false;
        runtime.services.editor.unlockEditor();
        render();
      }
    }
    if (generated)
      runtime.services.editor.message(
        `${cards.length} PNGs reunidos no ZIP. Cada carta inclui margem branca de 3 mm.`,
      );
  }
  return {
    cardsOf,
    capture,
    ensure,
    snapshot,
    normalize,
    open,
    select,
    add,
    remove,
    renameProject,
    renameCard,
    copies,
    move,
    toggleBack,
    applyFrame,
    portable,
    name,
    safeName,
    render,
    handle,
    exportPngs,
  };
}
