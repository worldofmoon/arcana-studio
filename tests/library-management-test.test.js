import test from "node:test";
import {
  env,
  nodes,
  blobs,
  fs,
  vm,
  assert,
  __dirname,
  facade,
} from "./parity-fixture.js";
test("library-management-test.test", async () => {
  await vm.runInContext("embeddedReady", env);
  assert.equal(vm.runInContext("symbols.size", env), 80);
  assert.equal(nodes.frameGallery.children.length, 32);
  nodes.frameCategory.value = "neon";
  nodes.frameCategory.onchange();
  assert.equal(nodes.frameGallery.children.length, 3);
  await nodes.frameGallery.children[0].onclick();
  assert(nodes.frame.value.startsWith("asset-neon"));
  assert(vm.runInContext("frameImages.size>0", env));
  nodes.frameCategory.value = "all";
  nodes.frameCategory.onchange();
  vm.runInContext(
    "setCache.set('eoe',{img:symbols.get('{W}'),url:symbolData['{W}'],name:'Edge of Eternities'});",
    env,
  );
  const cards = Array.from({ length: 25 }, (_, i) => ({
    id: "treasure-" + i,
    name: "Treasure",
    set: "eoe",
    set_name: "Edge of Eternities",
    lang: "en",
    rarity: "common",
    collector_number: String(i),
    layout: "token",
    type_line: "Token Artifact — Treasure",
    oracle_text: "{T}, Sacrifice this token: Add one mana of any color.",
    image_uris: {
      small: "https://cards.scryfall.io/small.jpg",
      art_crop: "https://cards.scryfall.io/art.jpg",
    },
  }));
  env.fetch = async (url) => {
    assert(url.includes("include_extras=true"));
    return {
      ok: true,
      json: async () => ({ data: cards, total_cards: 25, has_more: false }),
    };
  };
  nodes.searchName.value = "Treasure";
  await vm.runInContext("search()", env);
  assert.equal(nodes.results.children.length, 20);
  assert.equal(vm.runInContext("selectedCard", env), null);
  await nodes.more.onclick();
  assert.equal(nodes.results.children.length, 25);
  await nodes.results.children[2].onclick();
  assert.equal(nodes.frame.value, "token");
  assert.equal(nodes.name.value, "Treasure");
  assert(nodes.rules.value.includes("{T}"));
  assert(vm.runInContext("media.art!==null", env));
  assert(vm.runInContext("media.symbol!==null", env));
  nodes.name.value = "Meu Tesouro";
  nodes.rules.value = "{T}: Add {C}{C}.";
  nodes.mana.value = "{2}{U}";
  nodes.frame.value = "asset-neon-blue";
  await vm.runInContext("ensureFrameAsset()", env);
  env.changed();
  const saved = vm.runInContext("snapshot()", env);
  assert.equal(saved.format, "arcana-studio");
  assert.equal(saved.version, 2);
  nodes.name.value = "Changed";
  nodes.frame.value = "modern";
  env.projectForTest = saved;
  await vm.runInContext("restoreProject(projectForTest)", env);
  assert.equal(nodes.name.value, "Meu Tesouro");
  assert.equal(nodes.frame.value, "asset-neon-blue");
  assert.equal(nodes.rules.value, "{T}: Add {C}{C}.");
  assert.equal(vm.runInContext("activeTab", env), "art");
  await nodes.saveProject.onclick();
  assert.equal(blobs.at(-1).type, "application/json");
  const project = JSON.parse(await blobs.at(-1).text());
  assert(project.media.art.startsWith("data:image/png"));
  await nodes.export.onclick();
  const b = Buffer.from(await blobs.at(-1).arrayBuffer());
  assert.equal(b.readUInt32BE(16), 1380);
  assert.equal(b.readUInt32BE(20), 1880);
  let o = 8,
    density = 0;
  while (o < b.length) {
    const size = b.readUInt32BE(o),
      type = b.toString("ascii", o + 4, o + 8);
    if (type === "pHYs") {
      density++;
      assert.equal(b.readUInt32BE(o + 8), 20000);
      assert.equal(b.readUInt32BE(o + 12), 20000);
    }
    o += size + 12;
  }
  assert.equal(density, 1);
  fs.writeFileSync(__dirname + "/qa-print.png", b);
  vm.runInContext(
    "media.back=media.art;dataUrls.back=dataUrls.art;tab('back');",
    env,
  );
  await nodes.export.onclick();
  assert.equal(blobs.at(-1).type, "image/png");
  nodes.palette.value = "red";
  nodes.name.value = "Teste de Criatura";
  nodes.power.value = "5";
  nodes.toughness.value = "5";
  nodes.frame.value = "full";
  env.tab("frame");
  env.render();
  assert(!nodes["pane-frame"].hidden);
  nodes.expand.onclick();
  assert(nodes.dialog.open);
  nodes.closeDialog.onclick();
  assert(!nodes.dialog.open);
  nodes.rules.selectionStart = 0;
  nodes.rules.selectionEnd = 0;
  nodes.rules.handlers.focus();
  nodes.manaButtons.children[0].onclick();
  assert(nodes.rules.value.startsWith("{W}"));
  const libraryStore = new Map();
  env.database = async () => ({
    close() {},
    transaction() {
      const staged = new Map(libraryStore);
      let scheduled = false,
        aborted = false;
      const tx = {
        abort() {
          aborted = true;
          queueMicrotask(() => tx.onabort?.());
        },
        objectStore() {
          const schedule = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
              if (aborted) return;
              libraryStore.clear();
              for (const [k, v] of staged) libraryStore.set(k, v);
              tx.oncomplete?.();
            });
          };
          return {
            put(value, key) {
              staged.set(key, value);
              schedule();
            },
            delete(key) {
              staged.delete(key);
              schedule();
            },
            getAll() {
              const req = {};
              queueMicrotask(() => {
                req.result = [...libraryStore.values()];
                req.onsuccess?.();
              });
              return req;
            },
          };
        },
      };
      return tx;
    },
  });
  await env.refreshLibrary();
  nodes.libraryFolderName.value = "Coleção";
  await nodes.createLibraryFolder.onclick();
  const collectionId = nodes.projectFolder.value;
  assert(collectionId.startsWith("folder:"));
  assert.equal(nodes.libraryFolderFilter.value, collectionId);
  nodes.libraryName.value = "Dragão Azul";
  await env.saveInLibrary(true);
  const dragonRecord = [...libraryStore.values()].find(
    (r) => r.name === "Dragão Azul",
  );
  assert.equal(dragonRecord.folderId, collectionId);
  nodes.projectFolder.value = "";
  nodes.libraryName.value = "Tesouro";
  await env.saveInLibrary(true);
  assert.equal(vm.runInContext("libraryRecords.length", env), 2);
  nodes.libraryFolderFilter.value = "all";
  nodes.librarySearch.value = "dragao";
  env.renderLibraryList();
  assert.equal(nodes.libraryList.children.length, 1);
  assert(
    nodes.libraryList.children[0].children[2].children[0].textContent.includes(
      "Dragão",
    ),
  );
  nodes.libraryList.children[0].children[0].checked = true;
  nodes.libraryList.children[0].children[0].onchange();
  assert.equal(vm.runInContext("selectedLibraryIds.size", env), 1);
  nodes.librarySearch.value = "nada";
  env.renderLibraryList();
  assert.equal(vm.runInContext("libraryVisibleRecords().length", env), 0);
  assert.equal(vm.runInContext("selectedLibraryIds.size", env), 1);
  nodes.librarySearch.value = "";
  nodes.libraryFolderFilter.value = collectionId;
  env.renderLibraryList();
  assert.equal(vm.runInContext("libraryVisibleRecords().length", env), 1);
  nodes.libraryFolderName.value = "Commander";
  await nodes.renameLibraryFolder.onclick();
  assert.equal(
    [...libraryStore.values()].find((r) => r.id === collectionId).name,
    "Commander",
  );
  nodes.libraryFolderName.value = "commander";
  await nodes.createLibraryFolder.onclick();
  assert.equal(
    [...libraryStore.values()].filter((r) => r.kind === "saved-folder").length,
    1,
  );
  await env.exportLibraryBackup(true);
  const selectionBackup = JSON.parse(await blobs.at(-1).text());
  assert.equal(selectionBackup.projects.length, 1);
  assert.equal(selectionBackup.folders[0].name, "Commander");
  assert.equal(
    selectionBackup.projects[0].project.media.art.startsWith("data:"),
    true,
  );
  await env.exportLibraryBackup(false);
  const fullBackup = JSON.parse(await blobs.at(-1).text());
  assert.equal(fullBackup.projects.length, 2);
  assert.equal(fullBackup.folders.length, 1);
  env.validateLibraryBackup(fullBackup);
  const beforeRestore = vm.runInContext("snapshot()", env),
    existingIds = [...libraryStore.keys()];
  await env.prepareLibraryBackup({
    size: JSON.stringify(fullBackup).length,
    text: async () => JSON.stringify(fullBackup),
  });
  assert.equal(nodes.libraryRestoreSummary.hidden, false);
  await nodes.confirmRestoreLibrary.onclick();
  assert.equal(
    [...libraryStore.values()].filter((r) => r.kind === "saved-project").length,
    4,
  );
  assert.equal(
    [...libraryStore.values()].filter((r) => r.kind === "saved-folder").length,
    1,
  );
  for (const id of existingIds) assert(libraryStore.has(id));
  assert(env.sameSnapshot(beforeRestore, vm.runInContext("snapshot()", env)));
  assert.equal(nodes.libraryRestoreSummary.hidden, true);
  assert(
    [...libraryStore.values()]
      .filter((r) => r.name === "Dragão Azul")
      .every((r) => r.folderId === collectionId),
  );
  const malformed = JSON.parse(JSON.stringify(fullBackup));
  malformed.projects[0].project.media.art = "javascript:alert(1)";
  const beforeBad = libraryStore.size;
  await env.prepareLibraryBackup({
    size: 100,
    text: async () => JSON.stringify(malformed),
  });
  assert.equal(nodes.confirmRestoreLibrary.disabled, true);
  await env.restoreLibraryBackup();
  assert.equal(libraryStore.size, beforeBad);
  assert.throws(() =>
    env.validateLibraryBackup({
      ...fullBackup,
      projects: [{ ...fullBackup.projects[0], folderId: "missing" }],
    }),
  );
  assert.throws(() =>
    env.validateLibraryBackup({
      ...fullBackup,
      projects: [
        {
          ...fullBackup.projects[0],
          thumbnail: "https://example.com/track.png",
        },
      ],
    }),
  );
  await env.prepareLibraryBackup({ size: 150000001, text: async () => "" });
  assert(nodes.libraryStatus.textContent.includes("150 MB"));
  // Moving several selected records preserves folder membership and handles deletion without deleting projects.
  nodes.libraryFolderFilter.value = "all";
  nodes.librarySearch.value = "";
  env.renderLibraryList();
  nodes.selectVisibleLibrary.onclick();
  assert.equal(vm.runInContext("selectedLibraryIds.size", env), 4);
  nodes.moveDestination.value = collectionId;
  await nodes.moveSelected.onclick();
  assert(
    [...libraryStore.values()]
      .filter((r) => r.kind === "saved-project")
      .every((r) => r.folderId === collectionId),
  );
  nodes.libraryFolderFilter.value = collectionId;
  await nodes.deleteLibraryFolder.onclick();
  assert.equal(
    [...libraryStore.values()].filter((r) => r.kind === "saved-project").length,
    4,
  );
  assert.equal(
    [...libraryStore.values()].filter((r) => r.kind === "saved-folder").length,
    0,
  );
  assert(
    [...libraryStore.values()]
      .filter((r) => r.kind === "saved-project")
      .every((r) => r.folderId === ""),
  );
  nodes.clearLibrarySelection.onclick();
  assert.equal(vm.runInContext("selectedLibraryIds.size", env), 0);
  await env.populatePrintQueue();
  assert.equal(vm.runInContext("printRows.length", env), 4);
  console.log(
    "PASS: accent-insensitive search, folder create/rename/move/delete, persistent selection, complete/selected portable backups, duplicate-safe restore, invalid/oversize rejection, unchanged editor and PDF queue.",
  );
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
