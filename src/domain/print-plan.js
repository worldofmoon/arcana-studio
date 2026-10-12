export function buildPrintPlan(items, { capacity, mode, paper }) {
  const queue = items.flatMap((item) =>
    (item.project.format === "arcana-project"
      ? item.project.cards
      : [{ id: "single", label: "", copies: 1, project: item.project }]
    ).map((card) => ({
      ...item,
      id: item.id + ":" + card.id,
      name: card.label || card.project.values.name || item.name,
      project: card.project,
      copies: item.copies * (card.copies || 1),
    })),
  );
  const count = queue.reduce((n, item) => n + item.copies, 0),
    missing = queue
      .filter((item) => !item.project.media.back)
      .map((item) => item.name);
  const sheets = Math.ceil(count / capacity),
    pages = sheets * (mode === "both" ? 2 : 1);
  const error = !queue.length
    ? "Selecione ao menos uma carta."
    : count > 120
      ? "Exporte até 120 cartas por PDF. Divida em mais de um arquivo."
      : mode !== "front" && missing.length
        ? "Envie um verso para todas as cartas selecionadas antes de imprimir versos."
        : "";
  return {
    queue,
    count,
    unique: queue.length,
    missing,
    sheets,
    pages,
    mode,
    paper,
    error,
  };
}
