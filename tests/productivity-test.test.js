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
test("productivity-test.test", async () => {
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
  assert(nodes.rules.value.startsWith("{W}")); // History restores media and frames, supports redo, and truncates a new branch.
  vm.runInContext("historyEntries=[];historyIndex=-1;commitHistory()", env);
  const initialName = nodes.name.value,
    initialFrame = nodes.frame.value;
  nodes.name.value = "Nome alterado";
  nodes.frame.value = "asset-modern-white";
  await vm.runInContext("ensureFrameAsset()", env);
  env.changed();
  env.commitHistory();
  assert.equal(vm.runInContext("historyIndex", env), 1);
  await env.moveHistory(-1);
  assert.equal(nodes.name.value, initialName);
  assert.equal(nodes.frame.value, initialFrame);
  await env.moveHistory(1);
  assert.equal(nodes.name.value, "Nome alterado");
  assert.equal(nodes.frame.value, "asset-modern-white");
  await env.moveHistory(-1);
  nodes.name.value = "Novo ramo";
  env.changed();
  env.commitHistory();
  assert(nodes.redo.disabled);
  // Exercise the IndexedDB transaction contract with persisted in-memory records.
  const records = new Map();
  env.database = async () => ({
    close() {},
    transaction() {
      const tx = {
        objectStore() {
          return {
            put(value, key) {
              records.set(key, value);
              queueMicrotask(() => tx.oncomplete?.());
            },
            delete(key) {
              records.delete(key);
              queueMicrotask(() => tx.oncomplete?.());
            },
            getAll() {
              const r = {};
              queueMicrotask(() => {
                r.result = [...records.values()];
                r.onsuccess?.();
              });
              return r;
            },
            get(key) {
              const r = {};
              queueMicrotask(() => {
                r.result = records.get(key);
                r.onsuccess?.();
              });
              return r;
            },
          };
        },
      };
      return tx;
    },
  });
  nodes.libraryName.value = "Projeto A";
  await env.saveInLibrary();
  assert.equal(records.size, 1);
  const idA = vm.runInContext("activeProjectId", env);
  nodes.name.value = "Carta B";
  nodes.libraryName.value = "Projeto B";
  await env.saveInLibrary(true);
  assert.equal(records.size, 2);
  assert.notEqual(vm.runInContext("activeProjectId", env), idA);
  assert.equal(nodes.libraryList.children.length, 2);
  const savedA = [...records.values()].find((r) => r.name === "Projeto A");
  assert(savedA.thumbnail.startsWith("data:image/jpeg"));
  const savedB = [...records.values()].find((r) => r.name === "Projeto B");
  await env.restoreProject(savedA.project);
  assert.equal(nodes.name.value, "Novo ramo");
  await env.restoreProject(savedB.project);
  assert.equal(nodes.name.value, "Carta B");
  // Print a seven-card queue with both sides: two front sheets and two mirrored back sheets.
  await env.populatePrintQueue();
  assert.equal(vm.runInContext("printRows.length", env), 2);
  vm.runInContext(
    "for(const row of printRows){row.check.checked=true;row.copies.value=1}",
    env,
  );
  nodes.includeCurrent.checked = true;
  nodes.currentCopies.value = "5";
  nodes.printPaper.value = "a4";
  nodes.printSides.value = "both";
  nodes.cropMarks.checked = true;
  const beforePrint = vm.runInContext("snapshot()", env),
    beforeTab = vm.runInContext("activeTab", env);
  await env.exportPrintPDF();
  const pdf = blobs.findLast((b) => b.type === "application/pdf");
  assert(pdf, "PDF must be generated");
  fs.writeFileSync(
    __dirname + "/qa-a4-duplex.pdf",
    Buffer.from(await pdf.arrayBuffer()),
  );
  assert.equal(vm.runInContext("activeTab", env), beforeTab);
  assert(env.sameSnapshot(beforePrint, vm.runInContext("snapshot()", env)));
  assert(nodes.pdfStatus.textContent.includes("7 cartas em 4 páginas"));
  const grid = env.slotsFor("a4");
  assert.equal(grid.capacity, 6);
  assert.equal(grid.x, 33);
  assert.equal(grid.y, 5.5);
  const testImage = { key: "sample", bytes: new Uint8Array([1]) };
  const f = env.pagePlacements([testImage, testImage], "a4"),
    mirrorPlacements = env.pagePlacements([testImage, testImage], "a4", true);
  assert.equal(f[0].x, mirrorPlacements[1].x);
  assert.equal(f[1].x, mirrorPlacements[0].x);
  assert.equal(f[0].y, mirrorPlacements[0].y);
  nodes.printSides.value = "front";
  nodes.printPaper.value = "letter";
  nodes.currentCopies.value = "1";
  vm.runInContext("for(const row of printRows)row.check.checked=false", env);
  await env.exportPrintPDF();
  const letter = blobs.findLast((b) => b.type === "application/pdf");
  fs.writeFileSync(
    __dirname + "/qa-letter.pdf",
    Buffer.from(await letter.arrayBuffer()),
  );
  assert.equal(env.slotsFor("letter").capacity, 4);
  assert(nodes.pdfStatus.textContent.includes("1 cartas em 1 páginas"));
  // Missing backs block export, and local project deletion is reflected by the library.
  const oldBack = vm.runInContext("dataUrls.back", env);
  vm.runInContext('dataUrls.back="";media.back=null', env);
  nodes.printSides.value = "both";
  const countBlobs = blobs.length;
  await env.exportPrintPDF();
  assert.equal(blobs.length, countBlobs);
  assert(nodes.pdfStatus.textContent.includes("Envie um verso"));
  env.backForTest = oldBack;
  await vm.runInContext('setMedia("back",backForTest)', env);
  await env.libraryRemove(idA);
  assert.equal((await env.libraryRead()).length, 1);
  console.log(
    "PASS: undo/redo including frame state, branch truncation, library create/copy/restore/delete, seven-card duplex A4 PDF, Letter PDF, missing-back guard and editor restoration.",
  );
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
