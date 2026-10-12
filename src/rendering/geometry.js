export function createService(runtime) {
  function rounded(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.quadraticCurveTo(x + w, y, x + w, y + r);
    c.lineTo(x + w, y + h - r);
    c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    c.lineTo(x + r, y + h);
    c.quadraticCurveTo(x, y + h, x, y + h - r);
    c.lineTo(x, y + r);
    c.quadraticCurveTo(x, y, x + r, y);
    c.closePath();
  }

  function palette() {
    if (runtime.view.get("palette").value === "artifact") {
      const styles = {
        stained: ["#70679a", "#ece6f4"],
        parchment: ["#bb9860", "#f6ebd1"],
        deco: ["#514538", "#f7eccb"],
        invention: ["#965e3b", "#f2e2c8"],
        cosmic: ["#293c62", "#dce8f6"],
      };
      if (styles[runtime.view.get("frame").value])
        return styles[runtime.view.get("frame").value];
    }
    const map = {
      artifact: ["#a4bdc6", "#e7eff0"],
      white: ["#ccba84", "#fff3d4"],
      blue: ["#35759f", "#d9edf8"],
      black: ["#62586c", "#ded9e1"],
      red: ["#a74e39", "#f7ddcf"],
      green: ["#417350", "#e0eddb"],
      gold: ["#b18a37", "#f6ebc8"],
      land: ["#95725c", "#eee2d3"],
      custom: [runtime.view.get("accent").value, "#f5f0e8"],
    };
    if (
      runtime.view.get("frame").value === "ivory" &&
      runtime.view.get("palette").value === "artifact"
    )
      return ["#c8be9c", "#fcfaf2"];
    if (
      runtime.view.get("frame").value === "classic" &&
      runtime.view.get("palette").value === "artifact"
    )
      return ["#8f664a", "#edddbd"];
    return map[runtime.view.get("palette").value] || map.artifact;
  }

  function layout() {
    const chosen = runtime.view.get("frame").value,
      frame =
        chosen === "legend"
          ? "modern"
          : chosen === "legend-full"
            ? "full"
            : chosen;
    const typeY =
      frame === "token"
        ? 1200
        : ["full", "borderless"].includes(frame)
          ? 1235
          : frame === "ivory"
            ? 1010
            : frame === "classic"
              ? 1000
              : 985;
    const full = ["full", "borderless"].includes(frame),
      extended = frame === "extended";
    return {
      frame,
      typeY,
      art: {
        x: full ? 0 : extended ? 34 : 85,
        y: full ? 0 : 205,
        w: full ? 1260 : extended ? 1192 : 1090,
        h: full ? 1760 : typeY - 218,
      },
      rules: { x: 85, y: typeY + 123, w: 1090, h: 1638 - typeY - 123 },
    };
  }

  function artDraw(c, img, box, back = false) {
    c.save();
    runtime.services.geometry.rounded(c, box.x, box.y, box.w, box.h, 18);
    c.clip();
    c.fillStyle = runtime.view.get("artBg").value;
    c.fillRect(box.x, box.y, box.w, box.h);
    if (img) {
      const rotation =
          (runtime.services.editor.num(back ? "backRotation" : "rotation") *
            Math.PI) /
          180,
        cos = Math.abs(Math.cos(rotation)),
        sin = Math.abs(Math.sin(rotation)),
        requiredW = box.w * cos + box.h * sin,
        requiredH = box.w * sin + box.h * cos;
      const zoom = runtime.services.editor.num(back ? "backZoom" : "zoom"),
        scale = Math.max(requiredW / img.width, requiredH / img.height) * zoom,
        iw = img.width * scale,
        ih = img.height * scale;
      const sx = runtime.services.editor.num(back ? "backX" : "shiftX") / 100,
        sy = runtime.services.editor.num(back ? "backY" : "shiftY") / 100;
      const dx = (-sx * Math.max(0, iw - requiredW)) / 2,
        dy = (-sy * Math.max(0, ih - requiredH)) / 2;
      c.translate(box.x + box.w / 2, box.y + box.h / 2);
      c.rotate(rotation);
      c.globalAlpha *= back ? 1 : runtime.services.editor.num("artOpacity");
      c.drawImage(img, dx - iw / 2, dy - ih / 2, iw, ih);
    }
    c.restore();
  }

  function paperTexture(c, x, y, w, h) {
    c.save();
    let seed = 1729;
    const rand = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      return seed / 4294967296;
    };
    c.beginPath();
    c.rect(x, y, w, h);
    c.clip();
    for (let i = 0; i < 55; i++) {
      const yy = y + rand() * h;
      c.beginPath();
      c.moveTo(x, yy);
      c.bezierCurveTo(
        x + w * 0.32,
        yy + (rand() - 0.5) * h * 0.18,
        x + w * 0.65,
        yy + (rand() - 0.5) * h * 0.2,
        x + w,
        yy + (rand() - 0.5) * h * 0.13,
      );
      c.strokeStyle = i % 2 ? "rgba(151,128,75,.035)" : "rgba(255,255,255,.12)";
      c.lineWidth = 2 + rand() * 10;
      c.stroke();
    }
    c.restore();
  }

  function ivoryPlate(c, x, y, w, h, r, light, dark, alpha) {
    c.save();
    c.globalAlpha *= alpha;
    const g = c.createLinearGradient(x, y, x + w, y + h);
    g.addColorStop(0, light);
    g.addColorStop(0.55, "#fffefa");
    g.addColorStop(1, "#ece7d8");
    runtime.services.geometry.rounded(c, x, y, w, h, r);
    c.fillStyle = g;
    c.fill();
    c.save();
    c.clip();
    runtime.services.geometry.paperTexture(c, x, y, w, h);
    c.restore();
    runtime.services.geometry.rounded(c, x, y, w, h, r);
    c.strokeStyle = "#393936";
    c.lineWidth = 3;
    c.stroke();
    runtime.services.geometry.rounded(
      c,
      x + 6,
      y + 6,
      w - 12,
      h - 12,
      Math.max(1, r - 4),
    );
    c.strokeStyle = "#fff";
    c.lineWidth = 4;
    c.stroke();
    runtime.services.geometry.rounded(
      c,
      x + 10,
      y + 10,
      w - 20,
      h - 20,
      Math.max(1, r - 6),
    );
    c.strokeStyle = "#94958d";
    c.lineWidth = 1.5;
    c.stroke();
    c.restore();
  }

  function plate(c, x, y, w, h, r, light, dark, alpha = 1) {
    if (runtime.view.get("frame").value === "ivory") {
      runtime.services.geometry.ivoryPlate(
        c,
        x,
        y,
        w,
        h,
        r,
        light,
        dark,
        alpha,
      );
      return;
    }
    c.save();
    c.globalAlpha *= alpha;
    const g = c.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, light);
    g.addColorStop(0.48, "#f2efe6");
    g.addColorStop(1, dark);
    runtime.services.geometry.rounded(c, x, y, w, h, r);
    c.fillStyle = g;
    c.fill();
    c.lineWidth = 6;
    c.strokeStyle = "#24242a";
    c.stroke();
    runtime.services.geometry.rounded(
      c,
      x + 5,
      y + 5,
      w - 10,
      h - 10,
      Math.max(0, r - 4),
    );
    c.lineWidth = 2;
    c.strokeStyle = "#fff9";
    c.stroke();
    c.restore();
  }

  function legendCrown(c) {
    const [dark, light] = runtime.services.geometry.palette();
    c.save();
    const g = c.createLinearGradient(0, 42, 0, 88);
    g.addColorStop(0, "#f8e6a4");
    g.addColorStop(1, dark);
    c.fillStyle = g;
    c.strokeStyle = "#2b262a";
    c.lineWidth = 3;
    c.beginPath();
    c.moveTo(110, 68);
    c.lineTo(145, 42);
    c.lineTo(178, 63);
    c.lineTo(275, 48);
    c.lineTo(420, 60);
    c.lineTo(630, 35);
    c.lineTo(840, 60);
    c.lineTo(985, 48);
    c.lineTo(1082, 63);
    c.lineTo(1115, 42);
    c.lineTo(1150, 68);
    c.closePath();
    c.fill();
    c.stroke();
    c.restore();
  }

  function frameFill(c, x, y, w, h, light = false, second = false) {
    if (runtime.view.get("dualColor").checked && !second) {
      const g = c.createLinearGradient(x, 0, x + w, 0);
      if (runtime.view.get("colorBlend").value === "split") {
        g.addColorStop(0, runtime.view.get("colorLeft").value);
        g.addColorStop(0.499, runtime.view.get("colorLeft").value);
        g.addColorStop(0.501, runtime.view.get("colorRight").value);
        g.addColorStop(1, runtime.view.get("colorRight").value);
      } else {
        g.addColorStop(0, runtime.view.get("colorLeft").value);
        g.addColorStop(1, runtime.view.get("colorRight").value);
      }
      c.fillStyle = g;
    } else
      c.fillStyle = second
        ? runtime.view.get("secondAccent").value
        : runtime.services.geometry.palette()[light ? 1 : 0];
    c.fillRect(x, y, w, h);
  }

  function ownPanel(c, x, y, w, h, r, second = false) {
    const [dark, light] = runtime.services.geometry.palette(),
      special =
        runtime.view.get("cardLayout").value !== "normal" ||
        ["stained", "parchment", "deco", "invention", "cosmic"].includes(
          runtime.view.get("frame").value,
        );
    runtime.services.geometry.plate(
      c,
      x,
      y,
      w,
      h,
      r,
      light,
      special
        ? "#dcd6c7"
        : second
          ? runtime.view.get("secondAccent").value
          : dark,
      runtime.services.editor.num("panelOpacity"),
    );
    if (runtime.view.get("dualColor").checked && !second) {
      c.save();
      runtime.services.geometry.rounded(c, x + 8, y + 8, w - 16, h - 16, r - 4);
      c.clip();
      c.globalAlpha *= 0.25;
      runtime.services.geometry.frameFill(c, x, y, w, h);
      c.restore();
    }
  }

  function drawSecondary(c, img, box) {
    const old = {};
    for (const [a, b] of [
      ["zoom", "secondZoom"],
      ["rotation", "secondRotation"],
      ["shiftX", "secondX"],
      ["shiftY", "secondY"],
    ]) {
      old[a] = runtime.view.get(a).value;
      runtime.view.get(a).value = runtime.view.get(b).value;
    }
    try {
      runtime.services.geometry.artDraw(c, img, box);
    } finally {
      for (const [id, value] of Object.entries(old))
        runtime.view.get(id).value = value;
    }
  }

  function showcaseOrnaments(c, plan) {
    const style = runtime.view.get("frame").value;
    if (
      !["stained", "parchment", "deco", "invention", "cosmic"].includes(style)
    )
      return;
    c.save();
    c.beginPath();
    c.rect(38, 38, 1184, 1684);
    for (const b of [
      { x: 73, y: 65, w: 1114, h: 119 },
      { x: 73, y: plan.typeY, w: 1114, h: 116 },
      plan.art,
      plan.rules,
    ])
      c.rect(b.x, b.y, b.w, b.h);
    if (runtime.view.get("cardLayout").value === "adventure")
      c.rect(85, plan.typeY + 123, 545, 1638 - plan.typeY - 123);
    c.clip("evenodd");
    if (style === "parchment") {
      runtime.services.geometry.paperTexture(c, 38, 38, 1184, 1684);
      c.strokeStyle = "#80623966";
      c.lineWidth = 5;
      runtime.services.geometry.rounded(c, 50, 50, 1160, 1615, 18);
      c.stroke();
    } else if (style === "cosmic") {
      let seed = 491;
      for (let i = 0; i < 160; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const x = 40 + (seed % 1170);
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const y = 40 + (seed % 1620);
        if (x > 90 && x < 1170 && y > 200 && y < plan.typeY) continue;
        c.beginPath();
        c.arc(x, y, i % 7 === 0 ? 3 : 1.4, 0, Math.PI * 2);
        c.fillStyle = "#d4eaffaa";
        c.fill();
      }
      c.strokeStyle = "#82acdf";
      c.lineWidth = 3;
      runtime.services.geometry.rounded(c, 56, 49, 1148, 1600, 34);
      c.stroke();
    } else {
      c.strokeStyle =
        style === "stained"
          ? "#292139"
          : style === "invention"
            ? "#daa570"
            : "#e2c477";
      c.lineWidth = style === "stained" ? 8 : 4;
      for (const x of [53, 1207]) {
        c.beginPath();
        c.moveTo(x, 170);
        c.lineTo(x, 1610);
        c.stroke();
      }
      for (let n = 0; n < 9; n++) {
        const y = 230 + n * 152;
        for (const x of [53, 1207]) {
          c.beginPath();
          if (style === "stained") {
            c.moveTo(x - 16, y);
            c.lineTo(x + 16, y + 70);
            c.lineTo(x - 16, y + 140);
            c.closePath();
            c.fillStyle = ["#ca998e", "#a5b7c7", "#aca0c3", "#b7c89a"][n % 4];
            c.fill();
          } else if (style === "invention") {
            c.arc(x, y, 12, 0, Math.PI * 2);
          } else {
            c.moveTo(x - 12, y + 12);
            c.lineTo(x, y);
            c.lineTo(x + 12, y + 12);
            c.lineTo(x, y + 24);
            c.closePath();
          }
          c.stroke();
        }
      }
      if (style === "deco") {
        for (let i = 0; i < 4; i++) {
          c.beginPath();
          c.moveTo(90 + i * 9, 184 + i * 4);
          c.lineTo(630, 42 + i * 9);
          c.lineTo(1170 - i * 9, 184 + i * 4);
          c.stroke();
        }
      }
    }
    c.restore();
  }
  return {
    rounded,
    palette,
    layout,
    artDraw,
    paperTexture,
    ivoryPlate,
    plate,
    legendCrown,
    frameFill,
    ownPanel,
    drawSecondary,
    showcaseOrnaments,
  };
}
