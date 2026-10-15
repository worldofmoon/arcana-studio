import { createBrowserPlatform } from "./infrastructure/browser-platform.js?v=e180db8dc555";
import { loadCatalog } from "./infrastructure/asset-proxy.js?v=e180db8dc555";
import { EditorFacade } from "./core/editor-facade.js?v=e180db8dc555";

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
