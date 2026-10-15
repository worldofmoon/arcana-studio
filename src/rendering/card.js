import { createLayerScene } from "./scene.js?v=cfde92433bf3";
export function createService(runtime) {
  function setSymbolDraw(c, typeY) {
    if (!runtime.state.media.symbol || !runtime.view.get("showSymbol").checked)
      return;
    const size = 65 * runtime.services.editor.num("symbolSize"),
      x = 1118 + runtime.services.editor.num("symbolX") * 12.6,
      y = typeY + 59 + runtime.services.editor.num("symbolY") * 17.6;
    const tile = runtime.platform.document.createElement("canvas");
    tile.width = 160;
    tile.height = 160;
    const t = tile.getContext("2d"),
      scale = Math.min(
        148 / runtime.state.media.symbol.width,
        148 / runtime.state.media.symbol.height,
      ),
      w = runtime.state.media.symbol.width * scale,
      h = runtime.state.media.symbol.height * scale;
    t.drawImage(runtime.state.media.symbol, (160 - w) / 2, (160 - h) / 2, w, h);
    t.globalCompositeOperation = "source-in";
    const colors = {
      common: ["#25212a", "#25212a"],
      uncommon: ["#d7e0e8", "#788491"],
      rare: ["#f5db86", "#aa782b"],
      mythic: ["#ffa548", "#b33c15"],
    }[runtime.view.get("rarity").value] || ["#25212a", "#25212a"];
    const g = t.createLinearGradient(0, 0, 160, 160);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    t.fillStyle = g;
    t.fillRect(0, 0, 160, 160);
    c.drawImage(tile, x - size / 2, y - size / 2, size, size);
  }

  const render = function () {
    runtime.services.renderer.renderCore();
    runtime.services.editor.updateExportState();
  };

  function framePreset() {
    return runtime.state.frameCatalog.find(
      (p) => p.id === runtime.view.get("frame").value,
    );
  }

  function frameInk(role) {
    const p = runtime.services.renderer.framePreset();
    return runtime.view.get("cardLayout").value === "normal" &&
      p?.text?.[role]?.white
      ? "#faf8ef"
      : "#17151a";
  }

  function faceValue(id, second = false) {
    const map = {
      name: "secondName",
      mana: "secondMana",
      type: "secondType",
      rules: "secondRules",
      flavor: "secondFlavor",
      power: "secondPower",
      toughness: "secondToughness",
    };
    return runtime.view.get(second && map[id] ? map[id] : id).value;
  }

  function specialPlan(second = false) {
    const mode = runtime.view.get("cardLayout").value,
      preset = runtime.services.renderer.framePreset(),
      l = runtime.services.geometry.layout();
    if (mode === "normal" && preset?.asset) {
      const t = preset.text;
      return {
        asset: preset,
        art: {
          x: preset.art.x * 1260,
          y: preset.art.y * 1760,
          w: preset.art.width * 1260,
          h: preset.art.height * 1760,
        },
        title: { x: t.title.x * 1260, y: t.title.y * 1760 + 54, w: 1070 },
        type: {
          x: t.type.x * 1260,
          y: t.type.y * 1760 + 43,
          w: t.type.width * 1260,
        },
        rules: {
          x: t.rules.x * 1260,
          y: t.rules.y * 1760 - 16,
          w: t.rules.width * 1260,
          h: t.rules.height * 1760,
        },
        typeY: t.type.y * 1760 - 27,
      };
    }
    let typeY = mode === "planeswalker" ? 925 : mode === "saga" ? 200 : l.typeY;
    return {
      mode,
      second,
      art:
        mode === "saga"
          ? { x: 620, y: 340, w: 555, h: 1290 }
          : mode === "split"
            ? { x: 85, y: 205, w: 1090, h: 740 }
            : mode === "normal"
              ? l.art
              : { x: 85, y: 205, w: 1090, h: typeY - 218 },
      title: { x: 98, y: 143, w: 1059 },
      type: { x: 98, y: typeY + 77, w: 1040 },
      typeY,
      rules:
        mode === "saga"
          ? { x: 85, y: 340, w: 505, h: 1290 }
          : mode === "adventure"
            ? { x: 650, y: typeY + 125, w: 520, h: 1640 - typeY - 125 }
            : mode === "split"
              ? { x: 85, y: 1108, w: 1090, h: 530 }
              : { x: 85, y: typeY + 123, w: 1090, h: 1638 - typeY - 123 },
    };
  }

  function rowData(mode) {
    const rows = [];
    for (let i = 1; i <= 4; i++) {
      const text = runtime.view.get(
        mode === "planeswalker" ? "pwText" + i : "chapterText" + i,
      ).value;
      if (text.trim())
        rows.push({
          cost: runtime.view.get(
            mode === "planeswalker" ? "pwCost" + i : "chapterLabel" + i,
          ).value,
          text,
        });
    }
    return rows;
  }

  function badge(c, text, x, y, w = 112, h = 72) {
    runtime.services.geometry.rounded(c, x, y, w, h, 16);
    c.fillStyle = "#252330";
    c.fill();
    c.strokeStyle = "#e9e0cd";
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = "#fff9ee";
    c.textAlign = "center";
    c.font = "700 38px " + runtime.services.fonts.titleFont();
    c.fillText(text || "0", x + w / 2, y + h * 0.69, w - 12);
    c.textAlign = "left";
  }

  function drawSpecialRows(c, p, mode, textOnly = false) {
    let rows = runtime.services.renderer.rowData(mode),
      box = mode === "saga" ? { ...p.rules } : p.rules;
    let intro = mode === "saga" ? runtime.view.get("sagaIntro").value : "";
    if (!rows.length)
      rows = [
        {
          cost: mode === "saga" ? "I" : "+1",
          text: runtime.services.renderer.faceValue("rules"),
        },
      ];
    const gap = 12,
      introH = intro ? 150 : 0,
      h = (box.h - introH - (rows.length - 1) * gap) / rows.length;
    if (intro && textOnly)
      runtime.services.text.formattedBox(
        c,
        { x: box.x, y: box.y, w: box.w, h: introH },
        intro,
        "",
        29,
      );
    for (let i = 0; i < rows.length; i++) {
      const y = box.y + introH + i * (h + gap),
        bw = mode === "saga" ? 84 : 112;
      if (!textOnly) {
        runtime.services.geometry.ownPanel(c, box.x, y, box.w, h, 15);
        runtime.services.renderer.badge(
          c,
          mode === "saga"
            ? runtime.services.renderer.romanChapter(rows[i].cost)
            : rows[i].cost,
          box.x + 10,
          y + h / 2 - 36,
          bw,
        );
      } else
        runtime.services.text.formattedBox(
          c,
          { x: box.x + bw + 20, y, w: box.w - bw - 20, h },
          rows[i].text,
          "",
          mode === "saga" ? 33 : 40,
          true,
        );
    }
  }

  function romanChapter(value) {
    return String(value).replace(
      /\d+/g,
      (n) =>
        ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"][
          Number(n)
        ] || n,
    );
  }

  function drawWatermark(c, p) {
    if (!runtime.state.media.watermark) return;
    const b = p.rules,
      size = Math.min(b.w, b.h) * runtime.services.editor.num("watermarkSize"),
      img = runtime.state.media.watermark,
      scale = Math.min(size / img.width, size / img.height),
      w = img.width * scale,
      h = img.height * scale,
      x =
        b.x +
        (b.w - w) / 2 +
        (runtime.services.editor.num("watermarkX") * b.w) / 100,
      y =
        b.y +
        (b.h - h) / 2 +
        (runtime.services.editor.num("watermarkY") * b.h) / 100;
    c.save();
    c.beginPath();
    c.rect(b.x, b.y, b.w, b.h);
    c.clip();
    c.globalAlpha *= runtime.services.editor.num("watermarkOpacity");
    if (runtime.view.get("watermarkTint").checked) {
      const tile = runtime.platform.document.createElement("canvas");
      tile.width = Math.max(1, Math.ceil(w));
      tile.height = Math.max(1, Math.ceil(h));
      const t = tile.getContext("2d");
      t.drawImage(img, 0, 0, w, h);
      t.globalCompositeOperation = "source-in";
      t.fillStyle = runtime.view.get("watermarkColor").value;
      t.fillRect(0, 0, w, h);
      c.drawImage(tile, x, y, w, h);
    } else c.drawImage(img, x, y, w, h);
    c.restore();
  }

  function paintLayer(c, id, p, second = false) {
    const mode = runtime.view.get("cardLayout").value,
      asset = p.asset,
      full =
        mode === "normal" &&
        ["full", "borderless", "legend-full"].includes(
          runtime.view.get("frame").value,
        );
    if (id === "background") {
      runtime.services.geometry.rounded(c, 0, 0, 1260, 1760, 61);
      c.fillStyle = runtime.view.get("border").value;
      c.fill();
      c.save();
      runtime.services.geometry.rounded(c, 34, 34, 1192, 1692, 31);
      c.clip();
      runtime.services.geometry.frameFill(c, 34, 34, 1192, 1692, false, second);
      c.restore();
    }
    if (id === "art") {
      c.save();
      if (full && runtime.view.get("frame").value === "borderless")
        runtime.services.geometry.rounded(c, 0, 0, 1260, 1760, 61);
      else runtime.services.geometry.rounded(c, 34, 34, 1192, 1692, 31);
      c.clip();
      const borderless =
          full && runtime.view.get("frame").value === "borderless",
        box = full
          ? borderless
            ? { x: 0, y: 0, w: 1260, h: 1760 }
            : { x: 34, y: 34, w: 1192, h: 1692 }
          : p.art;
      if (second)
        runtime.services.geometry.drawSecondary(
          c,
          runtime.state.media.secondary || runtime.state.media.art,
          box,
        );
      else runtime.services.geometry.artDraw(c, runtime.state.media.art, box);
      c.restore();
    }
    if (id === "frame") {
      if (asset) {
        const img = runtime.state.frameImages.get(asset.id);
        if (img) c.drawImage(img, 0, 0, 1260, 1760);
        else {
          runtime.services.geometry.ownPanel(c, 73, 65, 1114, 119, 26);
          runtime.services.text.fitTitle(
            c,
            "Carregando moldura…",
            98,
            143,
            1000,
            40,
          );
        }
      } else {
        runtime.services.geometry.ownPanel(c, 73, 65, 1114, 119, 26, second);
        runtime.services.geometry.ownPanel(
          c,
          73,
          p.typeY,
          1114,
          116,
          24,
          second,
        );
        if (mode === "planeswalker")
          runtime.services.renderer.drawSpecialRows(c, p, mode);
        else if (mode === "saga")
          runtime.services.renderer.drawSpecialRows(c, p, mode);
        else if (mode === "adventure") {
          runtime.services.geometry.ownPanel(
            c,
            85,
            p.typeY + 123,
            545,
            1638 - p.typeY - 123,
            14,
            true,
          );
          runtime.services.geometry.ownPanel(
            c,
            650,
            p.typeY + 123,
            520,
            1638 - p.typeY - 123,
            14,
          );
          runtime.services.geometry.ownPanel(
            c,
            93,
            p.typeY + 130,
            529,
            86,
            12,
            true,
          );
          runtime.services.geometry.ownPanel(
            c,
            93,
            p.typeY + 220,
            529,
            64,
            10,
            true,
          );
        } else
          runtime.services.geometry.ownPanel(
            c,
            p.rules.x,
            p.rules.y,
            p.rules.w,
            p.rules.h,
            9,
            second,
          );
        if (!full) {
          runtime.services.geometry.rounded(
            c,
            p.art.x - 3,
            p.art.y - 3,
            p.art.w + 6,
            p.art.h + 6,
            18,
          );
          c.strokeStyle = "#242129";
          c.lineWidth = 6;
          c.stroke();
        }
        runtime.services.geometry.showcaseOrnaments(c, p);
        if (["legend", "legend-full"].includes(runtime.view.get("frame").value))
          runtime.services.geometry.legendCrown(c);
      }
      if (runtime.state.media.frame)
        c.drawImage(
          runtime.state.media.frame,
          asset ? 0 : 34,
          asset ? 0 : 34,
          asset ? 1260 : 1192,
          asset ? 1760 : 1692,
        );
    }
    if (id === "watermark") runtime.services.renderer.drawWatermark(c, p);
    if (id === "text") {
      const mana = runtime.services.text.tokenize(
        runtime.services.renderer.faceValue("mana", second),
      );
      c.font = "45px " + runtime.services.fonts.rulesFont();
      const mw = mana.reduce(
        (n, t) => n + runtime.services.text.inlineWidth(c, t, 45),
        0,
      );
      if (asset?.category === "tokens") {
        c.font = "700 58px " + runtime.services.fonts.titleFont();
        const text =
            runtime.services.renderer.faceValue("name", second) || "Sua carta",
          w = Math.min(950, c.measureText(text).width);
        runtime.services.text.fitTitle(
          c,
          text,
          (1260 - w) / 2,
          p.title.y,
          950,
          58,
        );
      } else
        runtime.services.text.fitTitle(
          c,
          runtime.services.renderer.faceValue("name", second) || "Sua carta",
          p.title.x,
          p.title.y,
          p.title.w - mw,
          58,
        );
      runtime.services.text.fitTitle(
        c,
        runtime.services.renderer.faceValue("type", second),
        p.type.x,
        p.type.y,
        p.type.w - (runtime.view.get("showSymbol").checked ? 110 : 0),
        43,
        "type",
      );
      if (["planeswalker", "saga"].includes(mode))
        runtime.services.renderer.drawSpecialRows(c, p, mode, true);
      else
        runtime.services.text.formattedBox(
          c,
          {
            ...p.rules,
            h:
              p.rules.h -
              (runtime.services.renderer.faceValue("power", second) ||
              runtime.services.renderer.faceValue("toughness", second) ||
              runtime.view.get("loyalty").value
                ? 70
                : 0),
          },
          runtime.services.renderer.faceValue("rules", second),
          runtime.services.renderer.faceValue("flavor", second),
        );
      if (mode === "adventure") {
        const am = runtime.services.text
          .tokenize(runtime.view.get("secondMana").value)
          .reduce((n, t) => n + runtime.services.text.inlineWidth(c, t, 30), 0);
        runtime.services.text.fitTitle(
          c,
          runtime.view.get("secondName").value || "Aventura",
          111,
          p.typeY + 189,
          490 - am,
          36,
        );
        runtime.services.text.fitTitle(
          c,
          runtime.view.get("secondType").value,
          111,
          p.typeY + 265,
          485,
          28,
        );
        runtime.services.text.formattedBox(
          c,
          { x: 93, y: p.typeY + 293, w: 529, h: 1630 - p.typeY - 293 },
          runtime.view.get("secondRules").value,
          runtime.view.get("secondFlavor").value,
          34,
        );
      }
    }
    if (id === "symbols") {
      const mana = runtime.services.text.tokenize(
        runtime.services.renderer.faceValue("mana", second),
      );
      c.font = "45px " + runtime.services.fonts.rulesFont();
      const mw = mana.reduce(
        (n, t) => n + runtime.services.text.inlineWidth(c, t, 45),
        0,
      );
      runtime.services.text.drawInline(c, mana, 1160 - mw, p.title.y - 2, 45);
      runtime.services.renderer.setSymbolDraw(c, p.typeY);
      if (mode === "adventure") {
        const tokens = runtime.services.text.tokenize(
            runtime.view.get("secondMana").value,
          ),
          w = tokens.reduce(
            (n, t) => n + runtime.services.text.inlineWidth(c, t, 30),
            0,
          );
        runtime.services.text.drawInline(c, tokens, 610 - w, p.typeY + 184, 30);
      }
    }
    if (id === "stats") {
      const power = runtime.services.renderer.faceValue("power", second),
        toughness = runtime.services.renderer.faceValue("toughness", second),
        stats =
          power || toughness
            ? (power || "0") + "/" + (toughness || "0")
            : mode === "planeswalker"
              ? runtime.view.get("loyalty").value
              : mode === "normal"
                ? runtime.view.get("loyalty").value
                : "";
      if (stats) {
        runtime.services.geometry.ownPanel(c, 960, 1595, 220, 78, 22, second);
        c.fillStyle = "#17151a";
        c.textAlign = "left";
        c.font = "700 47px " + runtime.services.fonts.titleFont();
        c.fillText(stats, 982, 1650, 175);
      }
    }
    if (id === "footer") {
      runtime.services.geometry.rounded(c, 34, 1678, 1192, 48, 9);
      c.fillStyle = "#17151dea";
      c.fill();
      c.fillStyle = "#eee";
      c.font = "20px system-ui";
      c.textAlign = "left";
      c.fillText(
        [
          runtime.view.get("collector").value,
          runtime.view.get("setCode").value.toUpperCase(),
          runtime.view.get("language").value.toUpperCase(),
        ]
          .filter(Boolean)
          .join(" · "),
        78,
        1710,
        520,
      );
      c.textAlign = "right";
      c.fillText(
        runtime.view.get("artist").value
          ? "Arte: " + runtime.view.get("artist").value
          : "ARCANA · PROXY",
        1180,
        1710,
        560,
      );
      c.textAlign = "left";
    }
    if (id === "overlay" && runtime.state.media.overlay) {
      const img = runtime.state.media.overlay,
        scale =
          Math.min(1260 / img.width, 1760 / img.height) *
          runtime.services.editor.num("overlaySize"),
        w = img.width * scale,
        h = img.height * scale;
      c.drawImage(
        img,
        (1260 - w) / 2 + runtime.services.editor.num("overlayX") * 12.6,
        (1760 - h) / 2 + runtime.services.editor.num("overlayY") * 17.6,
        w,
        h,
      );
    }
  }

  function composeFace(c, second = false) {
    const p = runtime.services.renderer.specialPlan(second);
    c.save();
    try {
      runtime.services.geometry.rounded(c, 0, 0, 1260, 1760, 61);
      c.clip();
      createLayerScene(runtime.services.editor.getLayers(), (context, id) =>
        runtime.services.renderer.paintLayer(context, id, p, second),
      ).draw(c);
    } finally {
      c.restore();
    }
  }

  function renderFront(c) {
    c.clearRect(0, 0, 1260, 1760);
    if (runtime.view.get("cardLayout").value === "split") {
      runtime.services.geometry.rounded(c, 0, 0, 1260, 1760, 61);
      c.fillStyle = runtime.view.get("border").value;
      c.fill();
      c.save();
      c.translate(0, 1760);
      c.rotate(-Math.PI / 2);
      for (let i = 0; i < 2; i++) {
        c.save();
        c.translate(20 + i * 870, 25);
        c.scale(850 / 1260, 1210 / 1760);
        runtime.services.renderer.composeFace(c, i === 1);
        c.restore();
      }
      c.restore();
    } else runtime.services.renderer.composeFace(c);
  }

  function renderCore() {
    runtime.view.canvas.width = 1260;
    runtime.view.canvas.height = 1760;
    if (
      runtime.state.activeTab === "back" ||
      (runtime.state.activeTab === "finish" &&
        runtime.view.get("downloadSide").value === "back")
    ) {
      runtime.services.geometry.rounded(
        runtime.view.context,
        0,
        0,
        1260,
        1760,
        61,
      );
      runtime.view.context.fillStyle = runtime.view.get("border").value;
      runtime.view.context.fill();
      runtime.services.geometry.artDraw(
        runtime.view.context,
        runtime.state.media.back,
        { x: 33, y: 33, w: 1194, h: 1694 },
        true,
      );
      if (!runtime.state.media.back) {
        runtime.view.context.fillStyle = "#635477";
        runtime.view.context.font = "bold 53px Georgia";
        runtime.view.context.textAlign = "center";
        runtime.view.context.fillText("VERSO", 630, 845);
        runtime.view.context.font = "30px system-ui";
        runtime.view.context.fillText(
          "Envie sua imagem na aba Verso",
          630,
          920,
        );
      }
    } else runtime.services.renderer.renderFront(runtime.view.context);
    runtime.view.get("previewTitle").textContent =
      runtime.state.activeTab === "back" ||
      (runtime.state.activeTab === "finish" &&
        runtime.view.get("downloadSide").value === "back")
        ? "Prévia do verso"
        : "Prévia da frente";
    runtime.view.get("export").textContent =
      runtime.state.activeTab === "back" ||
      (runtime.state.activeTab === "finish" &&
        runtime.view.get("downloadSide").value === "back")
        ? "↓ Salvar verso em PNG"
        : "↓ Salvar frente em PNG";
    runtime.view.get("export").disabled =
      runtime.state.batchRendering ||
      ((runtime.state.activeTab === "back" ||
        (runtime.state.activeTab === "finish" &&
          runtime.view.get("downloadSide").value === "back")) &&
        !runtime.state.media.back);
    for (const id of runtime.config.fields) {
      const output = runtime.view.get("v-" + id);
      if (output)
        output.textContent =
          runtime.view.get(id).value +
          (id.includes("Rotation") || id === "rotation" ? "°" : "");
    }
    for (const field of [
      "shiftX",
      "shiftY",
      "secondX",
      "secondY",
      "backX",
      "backY",
    ]) {
      const number = runtime.view.get(field + "Number");
      if (runtime.platform.document.activeElement !== number)
        number.value = runtime.view.get(field).value;
    }
    if (runtime.view.get("dialog").open) {
      const c = runtime.view.get("expanded");
      c.width = 1260;
      c.height = 1760;
      c.getContext("2d").drawImage(runtime.view.canvas, 0, 0);
      runtime.view.get("dialogTitle").textContent =
        runtime.state.activeTab === "back" ||
        (runtime.state.activeTab === "finish" &&
          runtime.view.get("downloadSide").value === "back")
          ? "Verso ampliado"
          : "Frente ampliada";
    }
  }
  return {
    setSymbolDraw,
    render,
    framePreset,
    frameInk,
    faceValue,
    specialPlan,
    rowData,
    badge,
    drawSpecialRows,
    romanChapter,
    drawWatermark,
    paintLayer,
    composeFace,
    renderFront,
    renderCore,
  };
}
