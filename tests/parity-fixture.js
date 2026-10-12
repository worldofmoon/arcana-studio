import fs from "node:fs";
import vm from "node:vm";
import assert from "node:assert";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { EditorFacade } from "../src/core/editor-facade.js";
import { SERVICE_MAP } from "../src/core/service-map.js";
const require = createRequire(import.meta.url);
const __dirname = fileURLToPath(new URL("../.test-output/", import.meta.url));
fs.mkdirSync(__dirname, { recursive: true });
const { createCanvas, Image, GlobalFonts } = require("@napi-rs/canvas");
for (const [file, family] of [
  ["Beleren2016-Bold.ttf", "ArcanaTitle"],
  ["MagictheGathering.TTF", "ArcanaClassic"],
])
  assert(
    GlobalFonts.registerFromPath(
      fileURLToPath(new URL("../assets/fonts/" + file, import.meta.url)),
      family,
    ),
  );
const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const iconData = JSON.parse(
  fs.readFileSync(new URL("../assets/symbols.json", import.meta.url), "utf8"),
);
const catalog = JSON.parse(
  fs.readFileSync(new URL("../assets/catalog.json", import.meta.url), "utf8"),
);
const nodes = {};
function node(id = "") {
  return {
    id,
    value: "",
    type: "text",
    checked: false,
    hidden: false,
    disabled: false,
    textContent: "",
    children: [],
    dataset: {},
    handlers: {},
    classList: { toggle() {} },
    addEventListener(e, fn) {
      this.handlers[e] = fn;
    },
    setAttribute(k, v) {
      this[k] = v;
    },
    querySelectorAll() {
      return this.children;
    },
    append(...items) {
      this.children.push(...items);
    },
    replaceChildren(...items) {
      this.children = items;
    },
    focus() {},
    click() {
      if (this.onclick) this.onclick();
    },
    setSelectionRange(a, b) {
      this.selectionStart = a;
      this.selectionEnd = b;
    },
    showModal() {
      this.open = true;
    },
    close() {
      this.open = false;
    },
  };
}
for (const m of html.matchAll(
  /<(input|select|textarea|button|canvas|div|span|p|strong|dialog|section|script|nav|h3)[^>]*id="([^"]+)"[^>]*>/g,
)) {
  const n = node(m[2]),
    v = m[0].match(/value="([^"]*)"/);
  n.value = v ? v[1] : "";
  n.type = m[0].match(/type="([^"]+)"/)?.[1] || "text";
  n.checked = /\bchecked\b/.test(m[0]);
  n.hidden = /\bhidden\b/.test(m[0]);
  n.dataset.tab = m[0].match(/data-tab="([^"]+)"/)?.[1];
  nodes[n.id] = n;
}
for (const m of html.matchAll(
  /<select[^>]*id="([^"]+)"[^>]*>\s*<option(?: value="([^"]*)")?[^>]*>([^<]*)/g,
))
  nodes[m[1]].value = m[2] || m[3];
for (const m of html.matchAll(
  /<textarea[^>]*id="([^"]+)"[^>]*>(.*?)<\/textarea\s*>/gs,
))
  nodes[m[1]].value = m[2];
nodes.embeddedSymbols = node("embeddedSymbols");
nodes.embeddedSymbols.textContent = JSON.stringify(iconData);
nodes.frameCatalogData = node("frameCatalogData");
nodes.frameCatalogData.textContent = JSON.stringify(catalog);
for (const n of Object.values(nodes)) {
  let value = String(n.value);
  Object.defineProperty(n, "value", {
    get: () => value,
    set: (v) => {
      value = String(v);
    },
    configurable: true,
  });
}
const create = () => {
  const c = createCanvas(1260, 1760);
  c.style = {};
  c.handlers = {};
  c.addEventListener = (e, fn) => (c.handlers[e] = fn);
  c.setPointerCapture = () => {};
  c.getBoundingClientRect = () => ({ width: 300, height: 419 });
  c.toBlob = (fn, type) =>
    fn(
      new Blob([c.toBuffer(type || "image/png")], {
        type: type || "image/png",
      }),
    );
  return c;
};
nodes.canvas = create();
nodes.expanded = create();
nodes.dialog.open = false;
const imported = createCanvas(900, 1200),
  ic = imported.getContext("2d");
ic.fillStyle = "#496674";
ic.fillRect(0, 0, 900, 1200);
const pngData = imported.toDataURL("image/png");
class LocalImage extends Image {
  set src(url) {
    super.src = url.startsWith("data:")
      ? Buffer.from(url.split(",")[1], "base64")
      : url.startsWith("assets/")
        ? fs.readFileSync(new URL("../" + url, import.meta.url))
        : Buffer.from(pngData.split(",")[1], "base64");
  }
}
const blobs = [];
const env = {
  console,
  TextEncoder,
  atob: (s) => Buffer.from(s, "base64").toString("binary"),
  crypto: require("crypto").webcrypto,
  confirm: () => true,
  Image: LocalImage,
  Blob,
  Uint8Array,
  DataView,
  URLSearchParams,
  AbortController,
  URL: {
    createObjectURL: (b) => {
      blobs.push(b);
      return "blob:test";
    },
    revokeObjectURL() {},
  },
  setTimeout: () => 1,
  clearTimeout() {},
  btoa: (s) => Buffer.from(s, "binary").toString("base64"),
  document: {
    addEventListener() {},
    fonts: {
      load: async () => [],
      ready: Promise.resolve(),
      add() {},
      delete() {},
    },
    getElementById: (id) => {
      if (!id.startsWith("v-")) assert(nodes[id], "Missing " + id);
      return nodes[id] || null;
    },
    querySelectorAll: (q) =>
      q === "[data-tab]"
        ? Object.values(nodes).filter((n) => n.dataset?.tab)
        : [],
    createElement: (tag) =>
      tag === "canvas" ? create() : Object.assign(node(), { remove() {} }),
    body: { append() {} },
  },
};
const facade = new EditorFacade({
  platform: env,
  assets: {
    catalog: JSON.parse(nodes.frameCatalogData.textContent),
    symbols: iconData,
  },
});
const scope = {};
for (const [name, [service, method]] of Object.entries(SERVICE_MAP))
  Object.defineProperty(scope, name, {
    configurable: true,
    get: () => facade.runtime.services[service][method],
    set: (value) => (facade.runtime.services[service][method] = value),
  });
for (const name of Object.keys(facade.runtime.state))
  Object.defineProperty(scope, name, {
    configurable: true,
    get: () => facade.runtime.state[name],
    set: (value) => (facade.runtime.state[name] = value),
  });
for (const [name, value] of Object.entries(facade.runtime.config))
  Object.defineProperty(scope, name, { configurable: true, value });
Object.defineProperty(scope, "$", { value: facade.runtime.view.get });
const stateContext = vm.createContext(scope);
const nativeRun = vm.runInContext;
vm.runInContext = (code, context) => {
  if (context === env)
    for (const [name, value] of Object.entries(env))
      if (!(name in scope)) scope[name] = value;
  return nativeRun(code, context === env ? stateContext : context);
};
for (const [name, [service, method]] of Object.entries(SERVICE_MAP))
  Object.defineProperty(env, name, {
    configurable: true,
    get: () => facade.runtime.services[service][method],
    set: (value) => (facade.runtime.services[service][method] = value),
  });
await facade.start();
for (const name of Object.keys(facade.runtime.state))
  if (!(name in scope))
    Object.defineProperty(scope, name, {
      configurable: true,
      get: () => facade.runtime.state[name],
      set: (value) => (facade.runtime.state[name] = value),
    });

export { env, nodes, blobs, fs, vm, assert, __dirname, facade };
