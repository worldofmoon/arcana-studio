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
test("rebuild-integration.test", async () => {
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
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
