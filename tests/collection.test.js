import test from "node:test";
import {
  facade,
  nodes,
  blobs,
  assert,
  fs,
  __dirname,
} from "./parity-fixture.js";

const clone = (value) => JSON.parse(JSON.stringify(value));

test("multi-card project preserves edits, isolated history, copies and compatibility", async () => {
  const r = facade.runtime,
    c = r.services.collection;
  const old = r.services.projects.snapshot();
  nodes.name.value = "First";
  nodes.rules.value = "First rules";
  r.services.editor.changed();
  await c.add();
  const first = r.state.collection.cards[0].id,
    second = r.state.collection.activeId;
  assert.equal(r.state.collection.cards.length, 2);
  nodes.name.value = "Second";
  nodes.rules.value = "Second rules";
  r.services.editor.changed();
  c.copies(2);
  c.renameCard("Token set");
  await c.select(first);
  assert.equal(nodes.name.value, "First");
  assert.equal(nodes.rules.value, "First rules");
  nodes.rules.value = "Edited first";
  r.services.history.commitHistory();
  await c.select(second);
  assert.equal(nodes.name.value, "Second");
  assert.equal(nodes.rules.value, "Second rules");
  await c.select(first);
  assert.equal(nodes.rules.value, "Edited first");
  await r.services.history.moveHistory(-1);
  assert.equal(nodes.rules.value, "First rules");
  await c.select(second);
  assert.equal(nodes.rules.value, "Second rules");
  await c.add(true);
  assert.equal(r.state.collection.cards.length, 3);
  assert.equal(nodes.rules.value, "Second rules");
  assert.equal(r.state.collection.cards.at(-1).copies, 2);
  c.renameProject("Custom deck");
  c.move(-1);
  assert.equal(r.state.collection.cards[1].id, r.state.collection.activeId);
  await c.remove();
  assert.equal(r.state.collection.cards.length, 2);
  c.capture();
  const saved = await c.portable();
  assert.equal(saved.format, "arcana-project");
  assert.equal(saved.name, "Custom deck");
  await facade.openProject(saved);
  assert.equal(nodes.export.disabled, false);
  assert.equal(facade.getProject().cards.length, 2);
  const before = facade.getProject(),
    invalid = clone(saved);
  invalid.cards[1].id = invalid.cards[0].id;
  await assert.rejects(() => c.open(invalid), /invalida|inválida/);
  assert.deepEqual(facade.getProject(), before);
  const broken = clone(saved);
  broken.cards[1].project.values.frame = "unknown";
  await assert.rejects(() => c.open(broken), /inválida/);
  assert.deepEqual(facade.getProject(), before);
  await r.services.bindings.saveProjectHandler();
  assert.equal(JSON.parse(await blobs.at(-1).text()).cards.length, 2);
  await facade.openProject(old);
  assert.equal(r.state.collection, null);
  assert.equal(facade.getProject().format, "arcana-studio");
});

test("shared back, bulk frame, library backup, PDF and ZIP preserve the complete project", async () => {
  const r = facade.runtime,
    c = r.services.collection;
  const tile = r.platform.document.createElement("canvas");
  tile.width = 64;
  tile.height = 64;
  tile.getContext("2d").fillStyle = "#e0366c";
  tile.getContext("2d").fillRect(0, 0, 64, 64);
  const url = tile.toDataURL("image/png");
  const project = r.services.projects.snapshot();
  project.values.name = "First";
  project.media.back = url;
  await facade.openProject(project);
  await c.add();
  const first = r.state.collection.cards[0].id;
  await c.select(first);
  c.toggleBack(true);
  c.copies(2);
  await c.add();
  assert.equal(r.state.dataUrls.back, url);
  assert.equal(r.state.collection.cards.length, 3);
  assert(
    r.state.collection.cards.every((card) => card.project.media.back === url),
  );
  nodes.frame.value = "classic";
  nodes.border.value = "#111111";
  r.services.editor.changed();
  c.applyFrame();
  assert(
    r.state.collection.cards.every(
      (card) => card.project.values.frame === "classic",
    ),
  );
  c.renameProject("My deck");
  c.capture();
  const saved = await c.portable();
  r.services.schema.validateBackupProject(saved);
  nodes.libraryName.value = "My deck";
  nodes.projectFolder.value = "";
  const records = new Map();
  r.services.storage.libraryRead = async () => [...records.values()];
  r.services.storage.libraryWrite = async (record) =>
    records.set(record.id, record);
  r.services.storage.allLibraryItems = async () => [...records.values()];
  await r.services.library.saveInLibrary();
  assert.equal([...records.values()][0].project.cards.length, 3);
  r.services.schema.validateLibraryBackup({
    format: "arcana-library",
    version: 1,
    folders: [],
    projects: [...records.values()],
  });
  const before = facade.getProject();
  r.services.editor.tab("finish");
  nodes.downloadSide.value = "front";
  nodes.includeCurrent.checked = true;
  nodes.currentCopies.value = "1";
  nodes.printSides.value = "front";
  r.state.printRows = [];
  await r.services.printing.exportPrintPDF();
  assert.equal(blobs.at(-1).type, "application/pdf");
  assert.match(nodes.pdfStatus.textContent, /4 cartas/);
  assert.deepEqual(facade.getProject(), before);
  await c.exportPngs();
  assert.equal(blobs.at(-1).type, "application/zip");
  fs.writeFileSync(
    __dirname + "/collection-front.zip",
    Buffer.from(await blobs.at(-1).arrayBuffer()),
  );
  assert.equal(r.state.activeTab, "finish");
  assert.deepEqual(facade.getProject(), before);
  nodes.downloadSide.value = "back";
  await c.exportPngs();
  fs.writeFileSync(
    __dirname + "/collection-back.zip",
    Buffer.from(await blobs.at(-1).arrayBuffer()),
  );
  assert.deepEqual(facade.getProject(), before);
  c.toggleBack(false);
  r.state.dataUrls.back = "";
  r.state.media.back = null;
  c.capture();
  await assert.rejects(() => c.exportPngs(), /Envie um verso/);
  assert.equal(r.state.batchRendering, false);
  assert.equal(r.state.editorLocks, 0);
});

test("imports keep the saved collection, face choices and autosave; failed loads preserve the active card", async () => {
  const r = facade.runtime,
    c = r.services.collection;
  await facade.openProject(r.services.projects.snapshot());
  const card = {
    id: "double-test",
    name: "Day // Night",
    layout: "transform",
    set: "",
    rarity: "common",
    card_faces: [
      {
        name: "Day",
        type_line: "Creature",
        oracle_text: "Day rules",
        colors: [],
        mana_cost: "{1}",
      },
      {
        name: "Night",
        type_line: "Creature",
        oracle_text: "Night rules",
        colors: [],
        mana_cost: "",
      },
    ],
  };
  await r.services.cards.importCard(card, 0);
  await c.add();
  const first = r.state.collection.cards[0].id,
    second = r.state.collection.activeId;
  await c.select(first);
  assert.equal(nodes.faceSelector.hidden, false);
  assert.equal(nodes.faceSelect.children.length, 2);
  assert.equal(r.state.selectedCard.id, "double-test");
  r.state.activeProjectId = "saved:deck";
  await r.services.cards.importCard(card, 1);
  assert.equal(r.state.activeProjectId, "saved:deck");
  await c.select(second);
  await c.select(first);
  assert.equal(nodes.name.value, "Night");
  assert.equal(Number(nodes.faceSelect.value), 1);
  let saved;
  r.services.storage.database = async () => {
    const tx = {
      objectStore: () => ({
        put: (project, key) => {
          saved = clone(project);
          assert.equal(key, "draft");
          queueMicrotask(() => tx.oncomplete());
        },
      }),
    };
    return { transaction: () => tx, close() {} };
  };
  await r.services.projects.saveDraft();
  assert.equal(saved.format, "arcana-project");
  assert.equal(saved.cards.length, 2);
  const active = r.state.collection.activeId,
    name = nodes.name.value,
    target = r.state.collection.cards.find((c) => c.id === second);
  const previousUrl = target.project.media.art;
  target.project.media.art = "data:image/png;base64,invalid";
  await assert.rejects(() => c.select(second));
  assert.equal(r.state.collection.activeId, active);
  assert.equal(nodes.name.value, name);
  assert.equal(r.state.collectionBusy, false);
  assert.equal(r.state.editorLocks, 0);
  target.project.media.art = previousUrl;
  const broken = clone(c.snapshot());
  broken.cards.find((c) => c.id === broken.activeId).project.media.art =
    "data:image/png;base64,invalid";
  await assert.rejects(() => c.open(broken));
  assert.equal(r.state.collection.activeId, active);
  assert.equal(nodes.name.value, name);
  assert.equal(nodes.export.disabled, false);
});
