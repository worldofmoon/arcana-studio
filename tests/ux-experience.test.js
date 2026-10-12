import test from "node:test";
import { facade, nodes, assert } from "./parity-fixture.js";
import { buildPrintPlan } from "../src/domain/print-plan.js";
import { projectFingerprint } from "../src/domain/operation-history.js";
const turn = () => new Promise((resolve) => setImmediate(resolve));

test("autosave reports progress, serializes writes and never labels newer edits as saved", async () => {
  const r = facade.runtime,
    txs = [],
    writes = [];
  r.services.storage.database = async () => ({
    transaction: () => {
      const tx = { objectStore: () => ({ put: (p) => writes.push(p) }) };
      txs.push(tx);
      return tx;
    },
    close() {},
  });
  nodes.name.value = "Version 1";
  r.services.editor.changed();
  const first = r.services.projects.saveDraft();
  await turn();
  assert.equal(r.state.draftStatus, "saving");
  nodes.name.value = "Version 2";
  r.services.editor.changed();
  txs[0].oncomplete();
  await first;
  assert.equal(r.state.draftStatus, "pending");
  assert.equal(writes[0].values.name, "Version 1");
  const second = r.services.projects.saveDraft();
  await turn();
  const concurrent = r.services.projects.saveDraft();
  txs[1].oncomplete();
  await turn();
  assert.equal(txs.length, 3);
  txs[2].oncomplete();
  await Promise.all([second, concurrent]);
  assert.equal(r.state.draftStatus, "saved");
  assert.match(nodes.saveStatus.textContent, /neste navegador.*às/);
  assert.equal(writes.at(-1).values.name, "Version 2");
  assert(writes.at(-1).savedAt);
  r.services.storage.database = async () => {
    throw new Error("Quota");
  };
  r.services.editor.changed();
  await r.services.projects.saveDraft();
  assert.equal(r.state.draftStatus, "error");
  assert.equal(nodes.backupNow.hidden, false);
  assert.equal(nodes.feedback.hidden, false);
  assert.equal(nodes.appStatus.role, "alert");
  nodes.dismissFeedback.onclick();
  assert.equal(nodes.feedback.hidden, true);
});

test("identity follows selection and bottom navigation shares boundaries; mobile compact state is reversible", async () => {
  const r = facade.runtime,
    c = r.services.collection;
  await c.open(r.services.projects.snapshot());
  await c.add();
  c.renameProject("Deck UX");
  c.renameCard("Token UX");
  assert.match(nodes.previewProjectName.textContent, /Deck UX/);
  assert.match(nodes.previewCardName.textContent, /Carta 2 de 2: Token UX/);
  await c.select(r.state.collection.cards[0].id);
  assert.match(nodes.previewCardName.textContent, /Carta 1 de 2/);
  r.services.editor.tab("card");
  assert.equal(nodes.previousStepBottom.disabled, true);
  nodes.nextStepBottom.onclick();
  assert.equal(r.state.activeTab, "frame");
  nodes.previousStepBottom.onclick();
  assert.equal(r.state.activeTab, "card");
  r.services.editor.tab("finish");
  assert.equal(nodes.nextStepBottom.disabled, true);
  assert.equal(
    nodes.stepStatusBottom.textContent,
    nodes.stepStatus.textContent,
  );
  const classes = new Set();
  r.platform.document.body = {
    classList: {
      toggle: (key, on) => (on ? classes.add(key) : classes.delete(key)),
    },
  };
  r.services.experience.setEditing(true);
  assert(classes.has("editing-field"));
  r.services.experience.setEditing(false);
  assert(!classes.has("editing-field"));
  nodes.compactPreview.onclick();
  assert(classes.has("preview-compact"));
  assert.equal(nodes.compactPreview["aria-expanded"], "false");
  nodes.compactPreview.onclick();
  assert(!classes.has("preview-compact"));
});

test("print summary matches copies, duplex sheets and missing-back validation", async () => {
  const card = {
    format: "arcana-studio",
    version: 2,
    values: { name: "A" },
    media: { back: "" },
    fonts: {},
  };
  const project = {
    format: "arcana-project",
    cards: [
      { id: "a", copies: 2, label: "", project: card },
      { id: "b", copies: 3, label: "B", project: card },
    ],
  };
  let p = buildPrintPlan([{ id: "deck", project, copies: 2 }], {
    capacity: 6,
    paper: "a4",
    mode: "front",
  });
  assert.equal(p.count, 10);
  assert.equal(p.unique, 2);
  assert.equal(p.sheets, 2);
  assert.equal(p.pages, 2);
  assert.equal(p.error, "");
  p = buildPrintPlan([{ id: "deck", project, copies: 2 }], {
    capacity: 6,
    paper: "a4",
    mode: "both",
  });
  assert.equal(p.pages, 4);
  assert.equal(p.missing.length, 2);
  assert.match(p.error, /Envie um verso/);
  p = buildPrintPlan([{ id: "deck", project, copies: 30 }], {
    capacity: 6,
    paper: "a4",
    mode: "front",
  });
  assert.match(p.error, /120/);
  const r = facade.runtime;
  r.state.printRows = [];
  nodes.includeCurrent.checked = true;
  nodes.currentCopies.value = "2";
  nodes.printSides.value = "front";
  nodes.printPaper.value = "a4";
  let shown = r.services.printing.updatePrintSummary();
  assert.match(
    nodes.printSummary.textContent,
    new RegExp(shown.count + " cópia"),
  );
  assert.equal(nodes.generatePDF.disabled, false);
  nodes.printSides.value = "both";
  r.services.printing.updatePrintSummary();
  assert.equal(nodes.generatePDF.disabled, true);
  assert.match(nodes.printWarning.textContent, /Sem verso/);
});

test("collection undo restores additions, deletions and bulk frames, preserves card history and guards later edits", async () => {
  const r = facade.runtime,
    c = r.services.collection;
  await c.open(r.services.projects.snapshot());
  const initial = c.snapshot();
  await c.add();
  assert.equal(r.state.collection.cards.length, 2);
  assert.equal(nodes.undoCollection.disabled, false);
  await c.moveOperation(-1);
  assert.equal(r.state.collection, null);
  assert.equal(projectFingerprint(c.snapshot()), projectFingerprint(initial));
  await c.moveOperation(1);
  assert.equal(r.state.collection.cards.length, 2);
  const first = r.state.collection.cards[0].id,
    second = r.state.collection.activeId;
  nodes.frame.value = "classic";
  r.services.editor.changed();
  c.applyFrame();
  assert(
    r.state.collection.cards.every(
      (card) => card.project.values.frame === "classic",
    ),
  );
  await c.select(first);
  await c.moveOperation(-1);
  assert.equal(
    r.state.collection.cards.find((card) => card.id === first).project.values
      .frame,
    initial.values.frame,
  );
  await c.moveOperation(1);
  assert(
    r.state.collection.cards.every(
      (card) => card.project.values.frame === "classic",
    ),
  );
  await c.select(second);
  await c.remove();
  assert.equal(r.state.collection.cards.length, 1);
  await c.moveOperation(-1);
  assert.equal(r.state.collection.cards.length, 2);
  assert.equal(r.state.collection.activeId, second);
  c.renameProject("New title");
  nodes.rules.value = "Later edit";
  r.services.editor.changed();
  const before = c.snapshot();
  let confirmations = 0;
  r.platform.confirm = () => {
    confirmations++;
    return false;
  };
  await c.moveOperation(-1);
  assert.equal(confirmations, 1);
  assert.equal(projectFingerprint(c.snapshot()), projectFingerprint(before));
  r.platform.confirm = () => true;
  await c.moveOperation(-1);
  assert.notEqual(r.state.collection.name, "New title");
  await c.moveOperation(1);
  assert.equal(r.state.collection.name, "New title");
  c.renameCard("New branch");
  assert.equal(nodes.redoCollection.disabled, true);
  await c.open(initial);
  assert.equal(nodes.undoCollection.disabled, true);
  assert.equal(nodes.redoCollection.disabled, true);
});
