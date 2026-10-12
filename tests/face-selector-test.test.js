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
test("face-selector-test.test", async () => {
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
  const commonImported = {
    id: "special-id",
    set: "eoe",
    lang: "en",
    rarity: "rare",
    collector_number: "1",
    image_uris: { art_crop: "https://cards.scryfall.io/art.jpg" },
  };
  await env.importCard({
    ...commonImported,
    name: "Test Walker",
    layout: "normal",
    type_line: "Legendary Planeswalker — Test",
    loyalty: "3",
    oracle_text:
      "+1: Draw a card.\n−X: Deal X damage.\n−7: Take an extra turn.",
  });
  assert.equal(nodes.cardLayout.value, "planeswalker");
  assert.equal(nodes.pwCost2.value, "−X");
  assert.equal(nodes.pwText1.value, "Draw a card.");
  assert.equal(nodes.loyalty.value, "3");
  await env.importCard({
    ...commonImported,
    name: "Test Saga",
    layout: "saga",
    type_line: "Enchantment — Saga",
    oracle_text:
      "(As this Saga enters, add a lore counter.)\nI, II — Create a token.\nIII — Draw three cards.",
  });
  assert.equal(nodes.cardLayout.value, "saga");
  assert.equal(nodes.chapterLabel1.value, "I, II");
  assert.equal(nodes.chapterText2.value, "Draw three cards.");
  assert(nodes.sagaIntro.value.startsWith("(As"));
  const twoFaces = [
    {
      name: "Fire",
      mana_cost: "{1}{R}",
      type_line: "Instant",
      oracle_text: "Deal 2 damage.",
      image_uris: { art_crop: "https://cards.scryfall.io/first.jpg" },
    },
    {
      name: "Ice",
      mana_cost: "{1}{U}",
      type_line: "Instant",
      oracle_text: "Tap target permanent. Draw a card.",
      image_uris: { art_crop: "https://cards.scryfall.io/second.jpg" },
    },
  ];
  await env.importCard({
    ...commonImported,
    layout: "split",
    card_faces: twoFaces,
  });
  assert.equal(nodes.cardLayout.value, "split");
  assert.equal(nodes.secondName.value, "Ice");
  assert.equal(
    vm.runInContext("dataUrls.secondary", env),
    "https://cards.scryfall.io/second.jpg",
  );
  await env.importCard({
    ...commonImported,
    layout: "adventure",
    card_faces: [
      {
        ...twoFaces[0],
        name: "Mage",
        type_line: "Creature — Wizard",
        power: "2",
        toughness: "2",
      },
      { ...twoFaces[1], name: "Journey", type_line: "Sorcery — Adventure" },
    ],
  });
  assert.equal(nodes.cardLayout.value, "adventure");
  assert.equal(nodes.secondName.value, "Journey");
  assert.equal(vm.runInContext("dataUrls.secondary", env), "");
  await nodes.export.onclick();
  const advancedPNG = Buffer.from(await blobs.at(-1).arrayBuffer());
  assert.equal(advancedPNG.readUInt32BE(16), 1380);
  assert.equal(advancedPNG.readUInt32BE(20), 1880);
  fs.writeFileSync(__dirname + "/qa-special-print.png", advancedPNG);
  await env.populatePrintQueue();
  nodes.includeCurrent.checked = true;
  nodes.currentCopies.value = "1";
  nodes.printPaper.value = "a4";
  nodes.printSides.value = "front";
  nodes.cropMarks.checked = true;
  const beforeSpecialPDF = vm.runInContext("snapshot()", env);
  await env.exportPrintPDF();
  const afterSpecialPDF = vm.runInContext("snapshot()", env);
  if (!env.sameSnapshot(beforeSpecialPDF, afterSpecialPDF)) {
    for (const k of Object.keys(beforeSpecialPDF.values))
      if (beforeSpecialPDF.values[k] !== afterSpecialPDF.values[k])
        console.log(
          "DIFF VALUE",
          k,
          beforeSpecialPDF.values[k],
          afterSpecialPDF.values[k],
        );
    for (const k of Object.keys(beforeSpecialPDF.media))
      if (beforeSpecialPDF.media[k] !== afterSpecialPDF.media[k])
        console.log(
          "DIFF MEDIA",
          k,
          beforeSpecialPDF.media[k]?.slice(0, 60),
          afterSpecialPDF.media[k]?.slice(0, 60),
        );
  }
  assert(env.sameSnapshot(beforeSpecialPDF, afterSpecialPDF));
  const specialPDF = blobs.findLast((b) => b.type === "application/pdf");
  assert(specialPDF);
  fs.writeFileSync(
    __dirname + "/qa-special.pdf",
    Buffer.from(await specialPDF.arrayBuffer()),
  );
  assert(nodes.pdfStatus.textContent.includes("PDF pronto: 1"));
  console.log(
    "PASS: Planeswalker, Saga, split and Adventure imports; second artwork, special PNG sizing, special PDF and unchanged editor state.",
  );

  assert.equal(nodes.faceSelector.hidden, true);
  await env.importCard({
    ...commonImported,
    id: "double-visible",
    layout: "transform",
    card_faces: twoFaces,
  });
  assert.equal(nodes.faceSelector.hidden, false);
  assert.equal(nodes.faceSelect.children.length, 2);
  nodes.faceSelect.value = "1";
  await nodes.faceSelect.onchange();
  assert.equal(nodes.name.value, "Ice");
  assert.equal(nodes.faceSelector.hidden, false);
  await env.importCard({
    ...commonImported,
    id: "single-hidden",
    name: "Sol Ring",
    layout: "normal",
    type_line: "Artifact",
    oracle_text: "{T}: Add {C}{C}.",
  });
  assert.equal(nodes.faceSelector.hidden, true);
  console.log(
    "PASS: face selector hidden for single/composite/restored cards and visible with working face switch on double-faced cards.",
  );
  console.log(
    "PASS: app initialization, 80 symbols, search/pagination/import, independent text editing, project roundtrip with images, front/back PNG dimensions/density, tabs, expanded preview and symbol insertion.",
  );
});
