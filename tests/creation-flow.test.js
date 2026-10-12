import test from "node:test";
import { nodes, blobs, assert, facade } from "./parity-fixture.js";

test("guided creation keeps free navigation, clears imports and exports the selected side", async () => {
  const { runtime } = facade;
  const steps = runtime.config.editorSteps;
  assert.deepEqual(steps, [
    "card",
    "frame",
    "art",
    "text",
    "symbol",
    "back",
    "finish",
  ]);
  assert.equal(nodes.previousStep.disabled, true);
  for (const step of steps.slice(1)) {
    nodes.nextStep.onclick();
    assert.equal(runtime.state.activeTab, step);
    assert.equal(nodes["pane-" + step].hidden, false);
  }
  assert.equal(nodes.nextStep.disabled, true);
  nodes.previousStep.onclick();
  assert.equal(runtime.state.activeTab, "back");
  nodes["tab-text"].onclick();
  assert.equal(runtime.state.activeTab, "text");
  nodes["tab-layers"].onclick();
  assert.equal(runtime.state.activeTab, "layers");
  nodes.nextStep.onclick();
  assert.equal(runtime.state.activeTab, "symbol");
  nodes.name.value = "Imported card";
  runtime.state.selectedCard = { name: "Imported card" };
  runtime.state.activeProjectId = "existing";
  await nodes.createBlank.onclick();
  assert.equal(nodes.name.value, "Sua carta");
  assert.equal(runtime.state.selectedCard, null);
  assert.equal(runtime.state.activeProjectId, null);
  assert.equal(runtime.state.activeTab, "frame");
  nodes["tab-finish"].onclick();
  nodes.downloadSide.value = "back";
  nodes.downloadSide.onchange();
  assert.equal(nodes.finishPng.disabled, true);
  assert.equal(nodes.previewTitle.textContent, "Prévia do verso");
  nodes.downloadSide.value = "front";
  nodes.downloadSide.onchange();
  assert.equal(nodes.finishPng.disabled, false);
  const before = blobs.length;
  await nodes.finishPng.onclick();
  assert.equal(blobs.length, before + 1);
  assert.equal(blobs.at(-1).type, "image/png");
  assert.equal(runtime.state.activeTab, "finish");
  await nodes.finishProject.onclick();
  assert.equal(blobs.at(-1).type, "application/json");
  let pdf = false,
    library = false;
  runtime.services.bindings.pdfBtnHandler = async () => {
    pdf = true;
  };
  runtime.services.bindings.libraryBtnHandler = async () => {
    library = true;
  };
  await nodes.finishPdf.onclick();
  await nodes.finishLibrary.onclick();
  assert(pdf && library);
});
