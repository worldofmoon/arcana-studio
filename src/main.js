import { createBrowserPlatform } from "./infrastructure/browser-platform.js?v=0560ed3bb7ba";
import { loadCatalog } from "./infrastructure/asset-proxy.js?v=0560ed3bb7ba";
import { EditorFacade } from "./core/editor-facade.js?v=0560ed3bb7ba";

const platform = createBrowserPlatform();
const status = platform.document.getElementById("appStatus");
const controls = [
  ...platform.document.querySelectorAll("button,input,select,textarea"),
];
const initial = controls.map((control) => [control, control.disabled]);
controls.forEach((control) => (control.disabled = true));
status.textContent = "Carregando molduras, fontes e símbolos…";
try {
  const assets = await loadCatalog(
    platform.fetch,
    new URL("../", import.meta.url),
  );
  initial.forEach(([control, disabled]) => (control.disabled = disabled));
  const editor = new EditorFacade({ platform, assets });
  await editor.start();
  status.textContent =
    "Pronto para criar. Abra Projetos para buscar, organizar pastas e fazer backup.";
} catch (error) {
  controls.forEach((control) => (control.disabled = true));
  status.textContent =
    error.message + " Atualize a página para tentar novamente.";
}
