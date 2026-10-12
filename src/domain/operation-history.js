export function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, cloneValue(item)]),
    );
  return value;
}
export function projectFingerprint(project) {
  const card = (p) => ({
    values: p.values,
    media: p.media,
    fonts: { title: p.fonts?.title || "", rules: p.fonts?.rules || "" },
  });
  if (project.format !== "arcana-project") return JSON.stringify(card(project));
  return JSON.stringify({
    format: project.format,
    name: project.name,
    sharedBack: project.sharedBack,
    cards: project.cards.map(({ id, label, copies, project }) => ({
      id,
      label,
      copies,
      project: card(project),
    })),
  });
}
export class OperationHistory {
  constructor(limit = 10) {
    this.entries = [];
    this.index = 0;
    this.limit = limit;
  }
  clear() {
    this.entries = [];
    this.index = 0;
  }
  record(label, before, after) {
    if (
      projectFingerprint(before.project) === projectFingerprint(after.project)
    )
      return;
    this.entries = this.entries.slice(0, this.index);
    this.entries.push({ label, before, after });
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length;
  }
  peek(direction) {
    return this.entries[direction < 0 ? this.index - 1 : this.index];
  }
  applied(direction) {
    this.index += direction < 0 ? -1 : 1;
  }
}
