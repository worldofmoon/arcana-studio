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
test("special-test.test", async () => {
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
  assert(nodes.rules.value.startsWith("{W}")); // Meaningful layout and persisted composition checks.
  for (const id of ["cardLayout", "frame", "palette"])
    nodes[id].value =
      id === "cardLayout" ? "normal" : id === "frame" ? "modern" : "artifact";
  nodes.name.value = "Arcana Test";
  nodes.type.value = "Legendary Creature — Wizard";
  nodes.mana.value = "{2}{U}{G}";
  nodes.rules.value =
    "[b]Vigilance[/b]\n{T}: Add {C}. (Activate only once each turn.)";
  nodes.flavor.value = "[i]Across the stars, a story waits.[/i]";
  nodes.power.value = "3";
  nodes.toughness.value = "4";
  vm.runInContext("media.art=media.back;dataUrls.art=dataUrls.back", env);
  for (const style of [
    "modern",
    "stained",
    "parchment",
    "deco",
    "invention",
    "cosmic",
  ]) {
    nodes.frame.value = style;
    env.render();
    fs.writeFileSync(
      __dirname + "/qa-new-" + style + ".png",
      nodes.canvas.toBuffer("image/png"),
    );
  }
  nodes.cardLayout.value = "planeswalker";
  nodes.frame.value = "deco";
  nodes.name.value = "Ari, Keeper of Light";
  nodes.type.value = "Legendary Planeswalker — Ari";
  nodes.power.value = "";
  nodes.toughness.value = "";
  nodes.loyalty.value = "4";
  for (let i = 1; i <= 3; i++) {
    nodes["pwCost" + i].value = ["+1", "−2", "−7"][i - 1];
    nodes["pwText" + i].value = [
      "Draw a card, then discard a card.",
      "Create two 1/1 white Spirit creature tokens with flying.",
      "You get an emblem with “[b]Creatures you control have vigilance.[/b]”",
    ][i - 1];
  }
  env.changed();
  assert.equal(nodes.walkerFields.hidden, false);
  env.render();
  fs.writeFileSync(
    __dirname + "/qa-new-planeswalker.png",
    nodes.canvas.toBuffer("image/png"),
  );
  nodes.cardLayout.value = "saga";
  nodes.frame.value = "parchment";
  nodes.name.value = "The Tale of Arcana";
  nodes.type.value = "Enchantment — Saga";
  nodes.loyalty.value = "";
  nodes.sagaIntro.value =
    "(As this Saga enters and after your draw step, add a lore counter. Sacrifice after III.)";
  for (let i = 1; i <= 3; i++) {
    nodes["chapterLabel" + i].value = String(i);
    nodes["chapterText" + i].value = [
      "Create a Treasure token.",
      "Draw two cards.",
      "Return target artifact card from your graveyard to your hand.",
    ][i - 1];
  }
  env.changed();
  assert.equal(nodes.sagaFields.hidden, false);
  env.render();
  fs.writeFileSync(
    __dirname + "/qa-new-saga.png",
    nodes.canvas.toBuffer("image/png"),
  );
  nodes.cardLayout.value = "adventure";
  nodes.frame.value = "ivory";
  nodes.name.value = "Wandering Mage";
  nodes.type.value = "Creature — Wizard";
  nodes.power.value = "2";
  nodes.toughness.value = "3";
  nodes.rules.value =
    "Whenever you cast an instant or sorcery spell, draw a card.";
  nodes.secondName.value = "A New Journey";
  nodes.secondMana.value = "{1}{U}";
  nodes.secondType.value = "Sorcery — Adventure";
  nodes.secondRules.value =
    "Look at the top three cards of your library. Put one into your hand and the rest on the bottom of your library.";
  nodes.secondFlavor.value = "Every journey starts with a question.";
  env.changed();
  assert.equal(nodes.secondFields.hidden, false);
  env.render();
  fs.writeFileSync(
    __dirname + "/qa-new-adventure.png",
    nodes.canvas.toBuffer("image/png"),
  );
  nodes.cardLayout.value = "split";
  nodes.frame.value = "modern";
  nodes.secondName.value = "Afterlight";
  nodes.secondType.value = "Instant";
  nodes.secondMana.value = "{2}{W}";
  env.render();
  fs.writeFileSync(
    __dirname + "/qa-new-split.png",
    nodes.canvas.toBuffer("image/png"),
  );
  assert(
    env
      .styledTokens("[b]Bold[/b] normal [i]Italic[/i]")
      .some((t) => t.bold && t.value === "Bold"),
  );
  assert(env.styledTokens("(Reminder text)").every((t) => t.italic));
  nodes.rules.value = "chosen";
  nodes.rules.selectionStart = 0;
  nodes.rules.selectionEnd = 6;
  vm.runInContext("lastText='rules'", env);
  nodes.boldText.onclick();
  assert.equal(nodes.rules.value, "[b]chosen[/b]");
  nodes.rules.selectionStart = 0;
  nodes.rules.selectionEnd = nodes.rules.value.length;
  nodes.clearTextStyle.onclick();
  assert.equal(nodes.rules.value, "chosen");
  nodes.cardLayout.value = "normal";
  nodes.dualColor.checked = true;
  nodes.colorBlend.value = "split";
  env.render();
  fs.writeFileSync(
    __dirname + "/qa-new-dual.png",
    nodes.canvas.toBuffer("image/png"),
  );
  vm.runInContext(
    "media.watermark=symbols.get('{U}');dataUrls.watermark=symbolData['{U}'];media.secondary=symbols.get('{R}');dataUrls.secondary=symbolData['{R}'];media.overlay=symbols.get('{G}');dataUrls.overlay=symbolData['{G}']",
    env,
  );
  nodes.watermarkOpacity.value = ".25";
  nodes.overlaySize.value = ".2";
  env.render();
  const advancedSave = vm.runInContext("snapshot()", env);
  assert(advancedSave.media.watermark);
  assert(advancedSave.values.secondName);
  env.advancedSave = advancedSave;
  nodes.secondName.value = "Lost";
  nodes.watermarkOpacity.value = ".8";
  await vm.runInContext("restoreProject(advancedSave)", env);
  assert.equal(nodes.secondName.value, "Afterlight");
  assert.equal(Number(nodes.watermarkOpacity.value), 0.25);
  assert(
    vm.runInContext(
      "media.watermark!==null&&media.secondary!==null&&media.overlay!==null",
      env,
    ),
  );
  vm.runInContext(
    "let testLayers=getLayers();testLayers.find(l=>l.id==='overlay').visible=false;$('layerState').value=JSON.stringify(testLayers)",
    env,
  );
  env.render();
  const withoutOverlay = nodes.canvas.toBuffer("image/png");
  vm.runInContext(
    "testLayers=getLayers();testLayers.find(l=>l.id==='overlay').visible=true;$('layerState').value=JSON.stringify(testLayers)",
    env,
  );
  env.render();
  assert.notDeepEqual(nodes.canvas.toBuffer("image/png"), withoutOverlay);
  env.tab("layers");
  const lastLayer = nodes.layerList.children[0];
  lastLayer.children[4].onclick();
  assert.equal(vm.runInContext("getLayers().at(-1).id", env), "footer");
  nodes.resetLayers.onclick();
  assert.equal(vm.runInContext("getLayers().at(-1).id", env), "overlay");
  const oldProject = {
    ...advancedSave,
    values: Object.fromEntries(
      Object.entries(advancedSave.values).filter(
        ([k]) => !vm.runInContext("advancedFields", env).includes(k),
      ),
    ),
    media: {
      art: advancedSave.media.art,
      back: advancedSave.media.back,
      frame: "",
      symbol: "",
    },
  };
  env.oldProject = oldProject;
  await vm.runInContext("restoreProject(oldProject)", env);
  assert.equal(nodes.cardLayout.value, "normal");
  assert.equal(nodes.layerState.value, "");
  assert.equal(nodes.dualColor.checked, false);
  assert.equal(vm.runInContext("media.watermark", env), null);
  console.log(
    "PASS: five showcases, four special layouts, text styles, dual colors, layer order/visibility and advanced project roundtrip/old-project migration.",
  );
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
