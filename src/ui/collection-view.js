export function renderCollection(runtime) {
  if (runtime.state.batchRendering || runtime.state.collectionBusy) return;
  runtime.services.experience.identify();
  const deck = runtime.state.collection,
    active = deck?.cards.find((card) => card.id === deck.activeId);
  const write = (id, value) => {
    const input = runtime.view.get(id);
    if (runtime.platform.document.activeElement !== input) input.value = value;
  };
  write("collectionName", deck?.name || "Meu projeto");
  write("collectionLabel", active?.label || "");
  write("collectionCopies", String(active?.copies || 1));
  runtime.view.get("collectionSharedBack").checked = !!deck?.sharedBack;
  runtime.view.get("collectionDelete").disabled =
    !deck || deck.cards.length < 2;
  const index = deck?.cards.findIndex((c) => c.id === deck.activeId) || 0;
  runtime.view.get("collectionEarlier").disabled = index === 0;
  runtime.view.get("collectionLater").disabled =
    !deck || index >= deck.cards.length - 1;
  runtime.view.get("collectionCount").textContent =
    (deck?.cards.length || 1) + " carta(s) no projeto";
  const list = runtime.view.get("collectionList");
  list.replaceChildren();
  const cards = deck?.cards || [
    {
      id: "current",
      label: "",
      project: runtime.services.projects.snapshot(),
      thumbnail: runtime.services.projects.projectThumbnail(),
    },
  ];
  for (const card of cards) {
    const button = runtime.platform.document.createElement("button");
    button.className = "collection-card";
    button.type = "button";
    button.setAttribute(
      "aria-pressed",
      String(!deck || card.id === deck.activeId),
    );
    const image = runtime.platform.document.createElement("img");
    image.src =
      card.thumbnail ||
      runtime.state.frameCatalog.find((p) => p.id === card.project.values.frame)
        ?.thumb ||
      "";
    image.alt = "";
    image.loading = "lazy";
    const label = runtime.platform.document.createElement("span");
    label.textContent =
      card.label || card.project.values.name || "Carta sem nome";
    const count = runtime.platform.document.createElement("small");
    count.textContent = (card.copies || 1) + " cópia(s)";
    button.append(image, label, count);
    button.onclick = () =>
      runtime.services.collection.handle(() =>
        runtime.services.collection.select(card.id),
      );
    list.append(button);
  }
}
