/** Adapter: exposes the editor's fields and drawing surface through one DOM port. */
export class DomView {
  constructor(document) {
    this.document = document;
    this.get = this.get.bind(this);
    this.canvas = this.get("canvas");
    this.context = this.canvas.getContext("2d");
  }
  get(id) {
    return this.document.getElementById(id);
  }
  read(id) {
    const field = this.get(id);
    return field.type === "checkbox" ? field.checked : field.value;
  }
  write(id, value) {
    const field = this.get(id);
    if (field.type === "checkbox") field.checked = Boolean(value);
    else field.value = String(value ?? "");
  }
}
