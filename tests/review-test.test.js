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
test("review-test.test", async () => {
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
  const realImageUrl = env.imageUrl,
    waiters = new Map(),
    testArt = vm.runInContext("media.art", env);
  env.imageUrl = (url) =>
    /\/(slow|fast|face[12]|failed|restore-(old|new)|remove)\.jpg$/.test(url)
      ? new Promise((resolve, reject) =>
          waiters.set(url, { resolve: () => resolve(testArt), reject }),
        )
      : Promise.resolve(testArt);
  const raceCard = (id, url, name = id) => ({
    id,
    name,
    type_line: "Artifact",
    oracle_text: "{T}: Add {C}.",
    set: "eoe",
    rarity: "common",
    lang: "en",
    image_uris: { art_crop: url },
  });
  vm.runInContext("activeProjectId='saved:original'", env);
  const slow = env.importCard(
    raceCard("slow", "https://cards.scryfall.io/slow.jpg"),
  );
  const fast = env.importCard(
    raceCard("fast", "https://cards.scryfall.io/fast.jpg"),
  );
  assert(env.exportBusy());
  const exportCount = blobs.length;
  await nodes.export.onclick();
  assert.equal(blobs.length, exportCount);
  waiters.get("https://cards.scryfall.io/fast.jpg").resolve();
  await fast;
  assert.equal(nodes.name.value, "fast");
  waiters.get("https://cards.scryfall.io/slow.jpg").resolve();
  await slow;
  assert.equal(nodes.name.value, "fast");
  assert.equal(
    vm.runInContext("dataUrls.art", env),
    "https://cards.scryfall.io/fast.jpg",
  );
  assert.equal(vm.runInContext("activeProjectId", env), null);
  assert.equal(env.exportBusy(), false);
  // Two faces of the same card must not let the slow first face override the second.
  const doubleCard = {
    id: "same-card",
    layout: "transform",
    set: "eoe",
    lang: "en",
    rarity: "rare",
    card_faces: [
      {
        name: "First Face",
        type_line: "Creature",
        image_uris: { art_crop: "https://cards.scryfall.io/face1.jpg" },
      },
      {
        name: "Second Face",
        type_line: "Creature",
        image_uris: { art_crop: "https://cards.scryfall.io/face2.jpg" },
      },
    ],
  };
  const firstFace = env.importCard(doubleCard, 0),
    secondFace = env.importCard(doubleCard, 1);
  waiters.get("https://cards.scryfall.io/face2.jpg").resolve();
  await secondFace;
  waiters.get("https://cards.scryfall.io/face1.jpg").resolve();
  await firstFace;
  assert.equal(nodes.name.value, "Second Face");
  assert.equal(
    vm.runInContext("dataUrls.art", env),
    "https://cards.scryfall.io/face2.jpg",
  );
  const failed = env.importCard(
    raceCard("failed", "https://cards.scryfall.io/failed.jpg"),
  );
  waiters
    .get("https://cards.scryfall.io/failed.jpg")
    .reject(new Error("network"));
  await failed;
  assert.equal(vm.runInContext("media.art", env), null);
  assert.equal(vm.runInContext("dataUrls.art", env), "");
  assert.equal(env.exportBusy(), false);
  await env.importCard({
    id: "no-art",
    name: "No Art",
    type_line: "Artifact",
    set: "eoe",
    lang: "en",
  });
  assert.equal(vm.runInContext("media.art", env), null);
  // Invalid or unreadable projects preserve every current field, image and font.
  env.imageUrl = realImageUrl;
  const baseReviewProject = vm.runInContext("snapshot()", env);
  env.baseReviewProject = baseReviewProject;
  for (const invalid of [
    { ...baseReviewProject, values: null },
    {
      ...baseReviewProject,
      values: { ...baseReviewProject.values, zoom: "NaN" },
    },
    {
      ...baseReviewProject,
      values: { ...baseReviewProject.values, frame: "unknown-frame" },
    },
    { ...baseReviewProject, media: { ...baseReviewProject.media, art: false } },
  ]) {
    await assert.rejects(env.restoreProject(invalid));
    assert(
      env.sameSnapshot(baseReviewProject, vm.runInContext("snapshot()", env)),
    );
  }
  env.imageUrl = async () => {
    throw new Error("broken image");
  };
  await assert.rejects(
    env.restoreProject({
      ...baseReviewProject,
      values: { ...baseReviewProject.values, name: "Must not change" },
      media: {
        ...baseReviewProject.media,
        art: "https://cards.scryfall.io/broken.jpg",
      },
    }),
  );
  assert(
    env.sameSnapshot(baseReviewProject, vm.runInContext("snapshot()", env)),
  );
  assert.equal(vm.runInContext("editorLocks", env), 0);
  // Concurrent project loads are applied only if still current.
  env.imageUrl = (url) =>
    /\/(slow|fast|face[12]|failed|restore-(old|new)|remove)\.jpg$/.test(url)
      ? new Promise((resolve, reject) =>
          waiters.set(url, { resolve: () => resolve(testArt), reject }),
        )
      : Promise.resolve(testArt);
  const restoreOld = env.restoreProject({
    ...baseReviewProject,
    values: { ...baseReviewProject.values, name: "Old" },
    media: {
      ...baseReviewProject.media,
      art: "https://cards.scryfall.io/restore-old.jpg",
    },
  });
  const restoreNew = env.restoreProject({
    ...baseReviewProject,
    values: { ...baseReviewProject.values, name: "New" },
    media: {
      ...baseReviewProject.media,
      art: "https://cards.scryfall.io/restore-new.jpg",
    },
  });
  waiters.get("https://cards.scryfall.io/restore-new.jpg").resolve();
  await restoreNew;
  waiters.get("https://cards.scryfall.io/restore-old.jpg").resolve();
  assert.equal(await restoreOld, false);
  assert.equal(nodes.name.value, "New");
  assert.equal(vm.runInContext("editorLocks", env), 0);
  // Removing an image while it loads cancels it; the old completion cannot restore it.
  const pendingArt = env.setMedia(
    "art",
    "https://cards.scryfall.io/remove.jpg",
  );
  assert(env.exportBusy());
  nodes.removeArt.onclick();
  waiters.get("https://cards.scryfall.io/remove.jpg").resolve();
  assert.equal(await pendingArt, false);
  assert.equal(vm.runInContext("media.art", env), null);
  assert.equal(env.exportBusy(), false);
  env.imageUrl = realImageUrl;
  nodes.frame.value = "asset-neon-blue";
  await env.ensureFrameAsset();
  nodes.power.value = "5";
  nodes.toughness.value = "5";
  const context = nodes.canvas.getContext("2d"),
    nativeFill = context.fillText.bind(context);
  let statInk = null;
  context.fillText = function (text, ...args) {
    if (text === "5/5") statInk = this.fillStyle;
    return nativeFill(text, ...args);
  };
  env.render();
  assert.equal(statInk, "#17151a");
  context.fillText = nativeFill;
  const missingValues = {
    ...baseReviewProject,
    values: { name: "Minimal old project" },
  };
  await env.restoreProject(missingValues);
  assert.equal(nodes.name.value, "Minimal old project");
  assert.equal(nodes.power.value, "");
  assert.equal(nodes.cardLayout.value, "normal");
  console.log(
    "PASS: rapid card/face races, failed/missing artwork, saved-project detachment, pending-export guard, atomic failed and concurrent restores, invalid data, canceled image loads, default migration and dark-frame stat contrast.",
  );
  // Slow file reading must not clear the loading flag of a more recent upload.
  const nativeFileData = env.fileData,
    fileReaders = new Map();
  env.fileData = (file) =>
    new Promise((resolve) => fileReaders.set(file.name, resolve));
  env.imageUrl = (url) =>
    new Promise((resolve) =>
      waiters.set(url, { resolve: () => resolve(testArt) }),
    );
  const uploadOld = env.upload("art", { name: "old", size: 1 }),
    uploadNew = env.upload("art", { name: "new", size: 1 });
  fileReaders.get("old")("https://cards.scryfall.io/upload-old.jpg");
  await uploadOld;
  assert(env.exportBusy());
  fileReaders.get("new")("https://cards.scryfall.io/upload-new.jpg");
  await new Promise((r) => setImmediate(r));
  assert(env.exportBusy());
  waiters.get("https://cards.scryfall.io/upload-new.jpg").resolve();
  await uploadNew;
  assert.equal(
    vm.runInContext("dataUrls.art", env),
    "https://cards.scryfall.io/upload-new.jpg",
  );
  assert.equal(env.exportBusy(), false);
  env.imageUrl = realImageUrl;
  env.fileData = nativeFileData;
  console.log(
    "PASS: simultaneous file uploads retain the latest loading state and image.",
  );
  // Older font loads cannot replace a newer font or an explicit reset.
  const fontWaiters = [];
  env.FontFace = class {
    constructor(family, source) {
      this.family = family;
      this.source = source;
    }
    load() {
      return new Promise((resolve) => fontWaiters.push(() => resolve(this)));
    }
  };
  const firstFont = env.installFont(
      "title",
      "data:application/octet-stream;base64,AA==",
    ),
    secondFont = env.installFont(
      "title",
      "data:application/octet-stream;base64,AQ==",
    );
  assert(env.exportBusy());
  fontWaiters[1]();
  assert.equal(await secondFont, true);
  fontWaiters[0]();
  assert.equal(await firstFont, false);
  assert.equal(
    vm.runInContext("fontData.title", env),
    "data:application/octet-stream;base64,AQ==",
  );
  const lastFont = env.installFont(
    "title",
    "data:application/octet-stream;base64,Ag==",
  );
  await nodes.resetFonts.onclick();
  fontWaiters[2]();
  assert.equal(await lastFont, false);
  assert.equal(vm.runInContext("fontData.title", env), "");
  assert.equal(env.exportBusy(), false);
  console.log("PASS: font replacement, export blocking and reset races.");
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
