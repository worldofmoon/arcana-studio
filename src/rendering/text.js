export function createService(runtime) {
  function tokenize(text) {
    return String(text || "").match(/\{[^}]+\}|\n|[^\S\n]+|[^\s{]+|\{/g) || [];
  }

  function symbolKey(token) {
    return token.toUpperCase();
  }

  const inlineWidth = function (c, t, size) {
    const v = runtime.services.text.tokenValue(t);
    if (typeof t === "object") runtime.services.text.tokenFont(c, t, size);
    return /^\{[^}]+\}$/.test(v) ? size * 1.06 : c.measureText(v).width;
  };

  function fallbackSymbol(c, key, x, y, size) {
    c.save();
    c.fillStyle = "#dbd1bd";
    c.strokeStyle = "#262225";
    c.lineWidth = 1.5;
    c.beginPath();
    c.arc(x + size / 2, y - size * 0.35, size * 0.48, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = "#19161a";
    c.font = "bold " + size * 0.55 + "px Georgia";
    c.textAlign = "center";
    c.fillText(
      key.replace(/[{}]/g, ""),
      x + size / 2,
      y - size * 0.15,
      size * 0.84,
    );
    c.restore();
  }

  const drawInline = function (c, tokens, x, y, size, italic = false) {
    c.fillStyle = runtime.view.get("customInk").checked
      ? runtime.view.get("rulesColor").value
      : runtime.services.renderer.frameInk("rules");
    c.textAlign = "left";
    for (const t of tokens) {
      runtime.services.text.tokenFont(c, t, size, italic);
      const v = runtime.services.text.tokenValue(t),
        width = runtime.services.text.inlineWidth(c, t, size);
      if (/^\{[^}]+\}$/.test(v)) {
        const icon = runtime.state.symbols.get(
          runtime.services.text.symbolKey(v),
        );
        if (icon)
          c.drawImage(icon, x, y - size * 0.82, size * 0.96, size * 0.96);
        else runtime.services.text.fallbackSymbol(c, v, x, y, size);
      } else {
        c.fillText(v, x, y);
        if (t?.bold) {
          c.save();
          c.globalAlpha *= 0.5;
          c.fillText(v, x + 0.7, y);
          c.restore();
        }
      }
      x += width;
    }
    return x;
  };

  const richLines = function (c, text, width, size, italic = false) {
    const rows = [];
    let line = [],
      used = 0;
    for (const t of runtime.services.text.styledTokens(text, italic)) {
      if (t.value === "\n") {
        rows.push(line);
        line = [];
        used = 0;
        continue;
      }
      const tw = runtime.services.text.inlineWidth(c, t, size);
      if (used + tw > width && line.length && t.value.trim()) {
        rows.push(line);
        line = [];
        used = 0;
      }
      if (!line.length && !t.value.trim()) continue;
      if (tw > width && !/^\{[^}]+\}$/.test(t.value)) {
        for (const ch of t.value) {
          const ct = { ...t, value: ch },
            cw = runtime.services.text.inlineWidth(c, ct, size);
          if (used + cw > width && line.length) {
            rows.push(line);
            line = [];
            used = 0;
          }
          line.push(ct);
          used += cw;
        }
      } else {
        line.push(t);
        used += tw;
      }
    }
    if (line.length) rows.push(line);
    return rows;
  };

  const textBox = function (c, box) {
    runtime.services.text.formattedBox(
      c,
      {
        ...box,
        h:
          box.h -
          (runtime.view.get("power").value ||
          runtime.view.get("toughness").value ||
          runtime.view.get("loyalty").value
            ? 70
            : 0),
      },
      runtime.view.get("rules").value,
      runtime.view.get("flavor").value,
    );
  };

  function fitTitle(c, text, x, y, width, size, role = "title") {
    c.fillStyle = runtime.services.renderer.frameInk(role);
    c.textAlign = "left";
    c.font = "700 " + size + "px " + runtime.services.fonts.titleFont();
    while (c.measureText(text).width > width && size > 22)
      c.font = "700 " + --size + "px " + runtime.services.fonts.titleFont();
    c.fillText(text, x, y, width);
  }

  function styledTokens(text, baseItalic = false) {
    const tokens = [];
    let boldDepth = 0,
      italicDepth = 0,
      reminderDepth = 0;
    for (const part of String(text || "").split(/(\[\/?(?:b|i)\])/g)) {
      if (/^\[\/?(?:b|i)\]$/.test(part)) {
        const closing = part[1] === "/";
        if (part.includes("b"))
          boldDepth = Math.max(0, boldDepth + (closing ? -1 : 1));
        else italicDepth = Math.max(0, italicDepth + (closing ? -1 : 1));
        continue;
      }
      for (const value of runtime.services.text.tokenize(part)) {
        // Parentheses can span words and lines.
        const opening = (value.match(/\(/g) || []).length,
          closing = (value.match(/\)/g) || []).length;
        tokens.push({
          value,
          bold: boldDepth > 0,
          italic:
            baseItalic ||
            italicDepth > 0 ||
            (runtime.view.get("reminderItalic").checked &&
              (reminderDepth > 0 || opening > 0)),
        });
        reminderDepth = Math.max(0, reminderDepth + opening - closing);
      }
    }
    return tokens;
  }

  function tokenValue(t) {
    return typeof t === "string" ? t : t.value;
  }

  function tokenFont(c, t, size, italic = false) {
    c.font =
      (italic || t?.italic ? "italic " : "") +
      (t?.bold ? "700 " : "") +
      size +
      "px " +
      runtime.services.fonts.rulesFont();
  }

  function formattedBox(
    c,
    box,
    rules,
    flavor = "",
    startSize = 43,
    center = false,
  ) {
    let size = startSize * runtime.services.editor.num("textScale"),
      r = [],
      f = [];
    const spacing = runtime.services.editor.num("lineSpacing") || 1.28;
    for (size = Math.floor(size); size >= 17; size -= 1) {
      r = runtime.services.text.richLines(c, rules, box.w - 44, size);
      f = runtime.services.text.richLines(c, flavor, box.w - 44, size, true);
      if (
        (r.length + f.length) * size * spacing +
          (r.length && f.length ? size * 0.55 : 0) <=
        box.h - 40
      )
        break;
    }
    size = Math.max(17, size);
    c.save();
    c.beginPath();
    c.rect(box.x + 16, box.y + 10, box.w - 32, box.h - 20);
    c.clip();
    const required =
      (r.length + f.length) * size * spacing +
      (r.length && f.length ? size * 0.55 : 0);
    let y = center ? box.y + (box.h - required) / 2 + size : box.y + 22 + size;
    const line = (row) => {
      const width = row.reduce(
          (n, t) => n + runtime.services.text.inlineWidth(c, t, size),
          0,
        ),
        align = runtime.view.get("textAlign").value,
        x =
          align === "center"
            ? box.x + (box.w - width) / 2
            : align === "right"
              ? box.x + box.w - 22 - width
              : box.x + 22;
      runtime.services.text.drawInline(c, row, x, y, size);
      y += size * spacing;
    };
    r.forEach(line);
    if (r.length && f.length) {
      c.strokeStyle = "#38302b55";
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(box.x + 22, y - size * 0.55);
      c.lineTo(box.x + box.w - 22, y - size * 0.55);
      c.stroke();
      y += size * 0.55;
    }
    f.forEach(line);
    c.restore();
    if (size === 17 && (r.length + f.length) * size * spacing > box.h - 40)
      runtime.services.editor.message(
        "Há mais texto do que cabe na área. Reduza o texto ou seu tamanho.",
        true,
      );
  }
  return {
    tokenize,
    symbolKey,
    inlineWidth,
    fallbackSymbol,
    drawInline,
    richLines,
    textBox,
    fitTitle,
    styledTokens,
    tokenValue,
    tokenFont,
    formattedBox,
  };
}
