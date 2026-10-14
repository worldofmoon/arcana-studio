import { buildPrintPlan } from "../domain/print-plan.js?v=b3c18be5cfcc";
export function createService(runtime) {
  function saveBlob(blob, name) {
    const url = runtime.platform.URL.createObjectURL(blob),
      a = runtime.platform.document.createElement("a");
    a.href = url;
    a.download = name;
    runtime.platform.document.body.append(a);
    a.click();
    a.remove();
    runtime.platform.setTimeout(
      () => runtime.platform.URL.revokeObjectURL(url),
      60000,
    );
  }

  function printCanvas(source) {
    const output = runtime.platform.document.createElement("canvas");
    output.width = 1380;
    output.height = 1880;
    const c = output.getContext("2d");
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, 1380, 1880);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.drawImage(source, 60, 60, 1260, 1760);
    return output;
  }

  function pngCrc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++)
        crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
    return (crc ^ 0xffffffff) >>> 0;
  }

  async function withPrintDensity(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer()),
      view = new DataView(bytes.buffer);
    if (bytes.length < 33 || bytes[0] !== 137 || bytes[1] !== 80)
      throw new Error("PNG inválido.");
    const chunk = new Uint8Array(21),
      cv = new DataView(chunk.buffer);
    cv.setUint32(0, 9);
    chunk.set([112, 72, 89, 115], 4);
    cv.setUint32(8, 20000);
    cv.setUint32(12, 20000);
    chunk[16] = 1;
    cv.setUint32(17, runtime.services.printing.pngCrc32(chunk.subarray(4, 17)));
    const pieces = [bytes.subarray(0, 8)];
    let offset = 8,
      inserted = false;
    while (offset + 12 <= bytes.length) {
      const length = view.getUint32(offset),
        end = offset + 12 + length;
      if (end > bytes.length) throw new Error("PNG incompleto.");
      const type = String.fromCharCode(
        ...bytes.subarray(offset + 4, offset + 8),
      );
      if (type !== "pHYs") pieces.push(bytes.subarray(offset, end));
      if (type === "IHDR") {
        pieces.push(chunk);
        inserted = true;
      }
      offset = end;
    }
    if (!inserted) throw new Error("PNG sem cabeçalho.");
    return new runtime.platform.Blob(pieces, { type: "image/png" });
  }

  async function printablePng(source) {
    const output = runtime.services.printing.printCanvas(source);
    const blob = await new Promise((resolve, reject) =>
      output.toBlob(
        (value) =>
          value
            ? resolve(value)
            : reject(new Error("Não foi possível gerar o PNG.")),
        "image/png",
      ),
    );
    return runtime.services.printing.withPrintDensity(blob);
  }

  function paperGrid(paper) {
    return paper === "letter"
      ? { w: 215.9, h: 279.4, cols: 2, rows: 2, gapX: 6, gapY: 6 }
      : { w: 210, h: 297, cols: 2, rows: 3, gapX: 6, gapY: 2 };
  }

  function slotsFor(paper) {
    const g = runtime.services.printing.paperGrid(paper),
      x = (g.w - (g.cols * 69 + (g.cols - 1) * g.gapX)) / 2,
      y = (g.h - (g.rows * 94 + (g.rows - 1) * g.gapY)) / 2;
    return { ...g, x, y, capacity: g.cols * g.rows };
  }

  function cropCommands(x, y, pageH) {
    const pt = (v) => (v * 72) / 25.4,
      fmt = (v) => pt(v).toFixed(3),
      top = y + 3,
      left = x + 3,
      right = left + 63,
      bottom = top + 88;
    const lines = [];
    for (const px of [left, right])
      for (const py of [top, bottom]) {
        const sx = px === left ? -1 : 1,
          sy = py === top ? -1 : 1;
        lines.push(
          fmt(px + sx * 0.35) +
            " " +
            fmt(pageH - py) +
            " m " +
            fmt(px + sx * 2.4) +
            " " +
            fmt(pageH - py) +
            " l S",
        );
        lines.push(
          fmt(px) +
            " " +
            fmt(pageH - (py + sy * 0.35)) +
            " m " +
            fmt(px) +
            " " +
            fmt(pageH - (py + sy * 2.4)) +
            " l S",
        );
      }
    return "0.55 G 0.25 w\n" + lines.join("\n") + "\n";
  }

  function jpegBytes(url) {
    return Uint8Array.from(runtime.platform.atob(url.split(",")[1]), (c) =>
      c.charCodeAt(0),
    );
  }

  function pdfDocument(pages, paper, crop = true) {
    const grid = runtime.services.printing.slotsFor(paper),
      enc = new runtime.platform.TextEncoder(),
      objects = [null, null, null],
      imageIds = new Map();
    const put = (value) => {
        objects.push(value);
        return objects.length - 1;
      },
      text = (s) => enc.encode(s),
      stream = (dict, bytes) => [
        text(dict + "\nstream\n"),
        bytes,
        text("\nendstream"),
      ],
      pageIds = [];
    for (const page of pages) {
      const resources = [],
        commands = [];
      for (let i = 0; i < page.length; i++) {
        const placement = page[i],
          key = placement.image.key;
        let id = imageIds.get(key);
        if (!id) {
          const bytes = placement.image.bytes;
          id = put(
            stream(
              "<< /Type /XObject /Subtype /Image /Width 1380 /Height 1880 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length " +
                bytes.length +
                " >>",
              bytes,
            ),
          );
          imageIds.set(key, id);
        }
        const name = "Im" + i;
        resources.push("/" + name + " " + id + " 0 R");
        const pt = (v) => ((v * 72) / 25.4).toFixed(3);
        commands.push(
          "q " +
            pt(69) +
            " 0 0 " +
            pt(94) +
            " " +
            pt(placement.x) +
            " " +
            pt(grid.h - placement.y - 94) +
            " cm /" +
            name +
            " Do Q",
        );
        if (crop)
          commands.push(
            runtime.services.printing.cropCommands(
              placement.x,
              placement.y,
              grid.h,
            ),
          );
      }
      const content = text(commands.join("\n")),
        contentId = put(
          stream("<< /Length " + content.length + " >>", content),
        ),
        pageId = put(
          text(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 " +
              ((grid.w * 72) / 25.4).toFixed(4) +
              " " +
              ((grid.h * 72) / 25.4).toFixed(4) +
              "] /Resources << /XObject << " +
              resources.join(" ") +
              " >> >> /Contents " +
              contentId +
              " 0 R >>",
          ),
        );
      pageIds.push(pageId);
    }
    objects[1] = text("<< /Type /Catalog /Pages 2 0 R >>");
    objects[2] = text(
      "<< /Type /Pages /Kids [" +
        pageIds.map((id) => id + " 0 R").join(" ") +
        "] /Count " +
        pageIds.length +
        " >>",
    );
    const parts = [text("%PDF-1.4\n%Arcana Studio\n")],
      offsets = [0];
    let length = parts[0].length;
    for (let id = 1; id < objects.length; id++) {
      offsets[id] = length;
      const body = Array.isArray(objects[id]) ? objects[id] : [objects[id]],
        chunks = [text(id + " 0 obj\n"), ...body, text("\nendobj\n")];
      parts.push(...chunks);
      length += chunks.reduce((sum, b) => sum + b.length, 0);
    }
    const xref = length;
    parts.push(
      text(
        "xref\n0 " +
          objects.length +
          "\n0000000000 65535 f \n" +
          offsets
            .slice(1)
            .map((o) => String(o).padStart(10, "0") + " 00000 n \n")
            .join("") +
          "trailer\n<< /Size " +
          objects.length +
          " /Root 1 0 R >>\nstartxref\n" +
          xref +
          "\n%%EOF\n",
      ),
    );
    return new runtime.platform.Blob(parts, { type: "application/pdf" });
  }

  async function populatePrintQueue() {
    runtime.state.printRows = [];
    runtime.view.get("printList").replaceChildren();
    try {
      runtime.state.libraryRecords =
        await runtime.services.storage.libraryRead();
    } catch {
      runtime.state.libraryRecords = [];
    }
    for (const record of runtime.state.libraryRecords) {
      const row = runtime.platform.document.createElement("div");
      row.className = "print-row";
      const check = runtime.platform.document.createElement("input");
      check.type = "checkbox";
      check.checked = false;
      check.setAttribute("aria-label", "Imprimir " + record.name);
      const image = runtime.platform.document.createElement("img");
      image.src = record.thumbnail;
      image.alt = "";
      const title = runtime.platform.document.createElement("span");
      title.textContent = record.name;
      const copies = runtime.platform.document.createElement("input");
      copies.type = "number";
      copies.min = "1";
      copies.max = "30";
      copies.value = "1";
      copies.setAttribute("aria-label", "Cópias de " + record.name);
      row.append(check, image, title, copies);
      runtime.view.get("printList").append(row);
      runtime.state.printRows.push({ record, check, copies });
      check.addEventListener("change", updatePrintSummary);
      copies.addEventListener("input", updatePrintSummary);
      copies.addEventListener("change", updatePrintSummary);
    }
    runtime.view.get("pdfStatus").textContent = runtime.state.libraryRecords
      .length
      ? "Selecione os projetos que deseja imprimir."
      : "Guarde projetos na biblioteca para imprimir várias cartas juntas.";
    updatePrintSummary();
  }

  function selectedItems(
    currentProject = runtime.services.collection.snapshot(),
  ) {
    const items = [];
    if (runtime.view.get("includeCurrent").checked)
      items.push({
        id: "current",
        name: runtime.services.collection.name(),
        project: currentProject,
        copies: copiesValue(runtime.view.get("currentCopies")),
      });
    for (const item of runtime.state.printRows)
      if (item.check.checked)
        items.push({
          id: item.record.id,
          name: item.record.name,
          project: item.record.project,
          copies: copiesValue(item.copies),
        });
    return items;
  }
  function printPlan(items = selectedItems()) {
    const paper = runtime.view.get("printPaper").value,
      mode = runtime.view.get("printSides").value;
    return buildPrintPlan(items, {
      paper,
      mode,
      capacity: runtime.services.printing.slotsFor(paper).capacity,
    });
  }
  function updatePrintSummary() {
    if (runtime.state.batchRendering) return;
    const plan = printPlan(),
      side = {
        front: "somente frentes",
        back: "somente versos",
        both: "frentes e versos",
      }[plan.mode];
    runtime.view.get("printSummary").textContent =
      `${plan.unique} carta(s) selecionada(s) · ${plan.count} cópia(s) · ${plan.sheets} folha(s) · ${plan.pages} página(s) de PDF · ${plan.paper.toUpperCase()} · ${side}.`;
    const warnings = [];
    if (plan.error) warnings.push(plan.error);
    if (plan.mode !== "front" && plan.missing.length)
      warnings.push("Sem verso: " + plan.missing.join(", "));
    if (
      runtime.state.printRows.some(
        (item) =>
          item.check.checked &&
          item.record.id === runtime.state.activeProjectId,
      ) &&
      runtime.view.get("includeCurrent").checked
    )
      warnings.push(
        "O projeto atual também foi selecionado na biblioteca; suas quantidades serão somadas.",
      );
    runtime.view.get("printWarning").textContent = warnings.join(" ");
    runtime.view.get("printWarning").hidden = !warnings.length;
    runtime.view.get("generatePDF").disabled =
      !!plan.error || runtime.services.editor.exportBusy();
    return plan;
  }
  function copiesValue(input) {
    return Math.max(1, Math.min(30, Math.trunc(Number(input.value) || 1)));
  }

  function pagePlacements(items, paper, mirror = false) {
    const g = runtime.services.printing.slotsFor(paper);
    return items.map((image, i) => {
      const col = i % g.cols,
        row = Math.floor(i / g.cols);
      return {
        image,
        x: g.x + (mirror ? g.cols - 1 - col : col) * (69 + g.gapX),
        y: g.y + row * (94 + g.gapY),
      };
    });
  }

  const exportPrintPDF = async function () {
    if (runtime.services.editor.exportBusy()) {
      runtime.view.get("pdfStatus").textContent =
        "Aguarde o carregamento terminar antes de imprimir.";
      return;
    }
    runtime.services.collection.capture();
    runtime.services.editor.lockEditor();
    try {
      await runtime.services.printing.exportPrintPDFCore();
    } finally {
      runtime.services.editor.unlockEditor();
    }
    runtime.services.editor.updateExportState();
  };

  async function exportPrintPDFCore() {
    if (runtime.state.batchRendering) return;
    let plan = printPlan();
    if (plan.error) {
      runtime.view.get("pdfStatus").textContent = plan.error;
      runtime.services.editor.message(plan.error, true);
      return;
    }
    const project = runtime.view.get("includeCurrent").checked
      ? await runtime.services.collection.portable()
      : runtime.services.projects.snapshot();
    plan = printPlan(selectedItems(project));
    const { queue, count, mode } = plan;
    if (runtime.state.setLoading) {
      runtime.view.get("pdfStatus").textContent =
        "Aguarde o símbolo da edição terminar de carregar.";
      return;
    }
    const previous = runtime.services.projects.snapshot(),
      previousTab = runtime.state.activeTab,
      previousId = runtime.state.activeProjectId;
    runtime.services.history.commitHistory();
    runtime.state.batchRendering = true;
    runtime.state.historyRestoring = true;
    runtime.platform.clearTimeout(runtime.state.draftTimer);
    runtime.platform.clearTimeout(runtime.state.historyTimer);
    const controls = [
      ...runtime.platform.document.querySelectorAll(
        "button,input,select,textarea",
      ),
    ].map((el) => [el, el.disabled]);
    for (const [el] of controls) el.disabled = true;
    const paper = runtime.view.get("printPaper").value,
      crop = runtime.view.get("cropMarks").checked;
    let generated = false;
    try {
      await runtime.state.embeddedReady;
      if (!(await runtime.state.fontsReady))
        throw new Error("As fontes não terminaram de carregar.");
      const fronts = [],
        backs = [];
      for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        runtime.view.get("pdfStatus").textContent =
          "Preparando " + (i + 1) + " de " + queue.length + ": " + item.name;
        await runtime.services.projects.restoreProject(item.project);
        await runtime.services.bindings.ensureFrameAsset();
        await runtime.platform.document.fonts.ready;
        const make = (side) => {
          runtime.services.editor.tab(side === "back" ? "back" : "art");
          runtime.services.renderer.render();
          const c = runtime.services.printing.printCanvas(runtime.view.canvas);
          return {
            key: item.id + ":" + side,
            bytes: runtime.services.printing.jpegBytes(
              c.toDataURL("image/jpeg", 0.97),
            ),
          };
        };
        const front = mode !== "back" ? make("front") : null,
          back = mode !== "front" ? make("back") : null;
        for (let n = 0; n < item.copies; n++) {
          if (front) fronts.push(front);
          if (back) backs.push(back);
        }
      }
      const pages = [],
        capacity = runtime.services.printing.slotsFor(paper).capacity;
      const length = mode === "back" ? backs.length : fronts.length;
      for (let i = 0; i < length; i += capacity) {
        if (mode !== "back")
          pages.push(
            runtime.services.printing.pagePlacements(
              fronts.slice(i, i + capacity),
              paper,
            ),
          );
        if (mode !== "front")
          pages.push(
            runtime.services.printing.pagePlacements(
              backs.slice(i, i + capacity),
              paper,
              mode === "both",
            ),
          );
      }
      const blob = runtime.services.printing.pdfDocument(pages, paper, crop);
      runtime.services.printing.saveBlob(
        blob,
        "Arcana_" + paper.toUpperCase() + "_" + count + "_cartas.pdf",
      );
      runtime.view.get("pdfStatus").textContent =
        "PDF pronto: " +
        count +
        " cartas em " +
        pages.length +
        " páginas. Imprima em tamanho real / 100%. Se houver versos, use frente e verso pela borda longa.";
      generated = true;
    } catch (e) {
      runtime.view.get("pdfStatus").textContent =
        e.message || "Não foi possível gerar o PDF.";
    } finally {
      try {
        await runtime.services.projects.restoreProject(previous);
        runtime.state.activeProjectId = previousId;
        runtime.services.editor.tab(previousTab);
      } catch (e) {
        runtime.services.editor.message(
          "Não foi possível restaurar a prévia. Use Desfazer ou reabra seu projeto.",
          true,
        );
      }
      for (const [el, disabled] of controls) el.disabled = disabled;
      runtime.state.batchRendering = false;
      runtime.state.historyRestoring = false;
      runtime.services.bindings.updateFrameSelection();
      runtime.services.history.updateHistoryButtons();
      if (generated)
        runtime.services.editor.message(
          "PDF gerado com carta de 63 × 88 mm e margem branca de 3 mm.",
        );
    }
  }
  return {
    saveBlob,
    printCanvas,
    pngCrc32,
    withPrintDensity,
    printablePng,
    paperGrid,
    slotsFor,
    printPlan,
    updatePrintSummary,
    cropCommands,
    jpegBytes,
    pdfDocument,
    populatePrintQueue,
    copiesValue,
    pagePlacements,
    exportPrintPDF,
    exportPrintPDFCore,
  };
}
