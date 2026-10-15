export function createService(runtime) {
  async function svgImage(text) {
    const doc = new runtime.platform.DOMParser().parseFromString(
        text,
        "image/svg+xml",
      ),
      svg = doc.documentElement;
    if (svg.localName !== "svg" || doc.querySelector("parsererror"))
      throw new Error("Símbolo inválido.");
    const box = svg.getAttribute("viewBox")?.split(/[ ,]+/).map(Number);
    svg.setAttribute("width", "256");
    svg.setAttribute(
      "height",
      String(
        box?.length === 4
          ? Math.max(1, Math.round((256 * box[3]) / box[2]))
          : 256,
      ),
    );
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const data =
      "data:image/svg+xml;base64," +
      runtime.platform.btoa(
        unescape(
          encodeURIComponent(
            new runtime.platform.XMLSerializer().serializeToString(svg),
          ),
        ),
      );
    return { img: await runtime.services.images.imageUrl(data), url: data };
  }

  async function loadSet() {
    const code = runtime.view.get("setCode").value.trim().toLowerCase(),
      request = ++runtime.state.setRequest;
    if (!code) {
      runtime.state.media.symbol = null;
      runtime.state.dataUrls.symbol = "";
      runtime.services.editor.changed();
      return;
    }
    runtime.state.setLoading = true;
    runtime.view.get("setStatus").textContent = "Carregando símbolo…";
    try {
      let entry = runtime.state.setCache.get(code);
      if (!entry) {
        if (!/^[a-z0-9]{2,12}$/.test(code))
          throw new Error("Use um código de edição, como EOE.");
        const response = await runtime.services.cards.fetchWithTimeout(
            "https://api.scryfall.com/sets/" + encodeURIComponent(code),
            { headers: { Accept: "application/json" } },
          ),
          set = await response.json();
        if (!response.ok) throw new Error("Edição não encontrada.");
        const svg = await runtime.services.cards.fetchWithTimeout(
          set.icon_svg_uri,
        );
        if (!svg.ok) throw new Error("Não foi possível baixar o símbolo.");
        entry = {
          ...(await runtime.services.cards.svgImage(await svg.text())),
          name: set.name,
        };
        runtime.state.setCache.set(code, entry);
      }
      if (request !== runtime.state.setRequest) return;
      runtime.state.media.symbol = entry.img;
      runtime.state.dataUrls.symbol = entry.url;
      runtime.view.get("showSymbol").checked = true;
      runtime.view.get("setStatus").textContent = entry.name;
      runtime.services.editor.changed();
    } catch (e) {
      if (request === runtime.state.setRequest)
        runtime.view.get("setStatus").textContent = e.message;
    } finally {
      if (request === runtime.state.setRequest)
        runtime.state.setLoading = false;
    }
  }

  function imageInfo(card) {
    return (
      card.image_uris || card.card_faces?.find((f) => f.image_uris)?.image_uris
    );
  }

  function showResults() {
    for (const card of runtime.state.resultCards.slice(
      runtime.state.shown,
      runtime.state.shown + 20,
    )) {
      const b = runtime.platform.document.createElement("button");
      b.className = "result";
      b.dataset.cardId = card.id;
      b.setAttribute(
        "aria-pressed",
        String(card.id === runtime.state.selectedCard?.id),
      );
      const img = runtime.platform.document.createElement("img"),
        info = runtime.services.cards.imageInfo(card);
      if (info) {
        img.src = info.small || info.normal;
        img.alt = "";
        img.loading = "lazy";
        b.append(img);
      }
      const d = runtime.platform.document.createElement("div"),
        title = runtime.platform.document.createElement("strong"),
        meta = runtime.platform.document.createElement("small");
      title.textContent = card.printed_name || card.name;
      meta.textContent =
        card.set_name +
        " · #" +
        card.collector_number +
        " · " +
        card.lang.toUpperCase();
      d.append(title, meta);
      b.append(d);
      b.onclick = () => runtime.services.cards.importCard(card);
      runtime.view.get("results").append(b);
    }
    runtime.state.shown = Math.min(
      runtime.state.shown + 20,
      runtime.state.resultCards.length,
    );
    runtime.view.get("more").hidden =
      runtime.state.shown >= runtime.state.resultCards.length &&
      !runtime.state.nextPage;
    runtime.view.get("searchStatus").textContent =
      runtime.state.shown +
      " de " +
      runtime.state.total +
      " opções. Escolha a carta.";
  }

  async function search() {
    runtime.platform.clearTimeout(runtime.state.searchTimer);
    const term = runtime.view.get("searchName").value.trim(),
      version = ++runtime.state.searchVersion;
    runtime.state.searchAbort?.abort();
    runtime.state.searchAbort = new AbortController();
    runtime.view.get("results").replaceChildren();
    runtime.view.get("more").hidden = true;
    runtime.state.resultCards = [];
    runtime.state.shown = 0;
    runtime.state.nextPage = null;
    if (term.length < 2) {
      runtime.view.get("searchStatus").textContent =
        "Digite pelo menos 2 letras.";
      return;
    }
    runtime.view.get("searchStatus").textContent = "Buscando…";
    try {
      const tokenSearch = /^(?:tokens?|fichas?)\s+|\s+(?:tokens?|fichas?)$/i.test(term),
        name = tokenSearch
          ? term
              .replace(/^(?:tokens?|fichas?)\s+|\s+(?:tokens?|fichas?)$/gi, "")
              .trim()
          : term,
        safe = name.replace(/["\\]/g, " "),
        url =
          "https://api.scryfall.com/cards/search?" +
          new URLSearchParams({
            q:
              (tokenSearch ? "t:token " : "") +
              'name:"' + safe + '" (lang:en or lang:pt)',
            include_extras: "true",
            include_multilingual: "true",
            unique: "prints",
            order: "name",
          });
      const r = await runtime.services.cards.fetchWithTimeout(url, {
          headers: { Accept: "application/json" },
          signal: runtime.state.searchAbort.signal,
        }),
        j = await r.json();
      if (version !== runtime.state.searchVersion) return;
      if (!r.ok)
        throw new Error(
          r.status === 404
            ? "Nenhuma carta encontrada."
            : j.details || "Não foi possível buscar.",
        );
      const exact = (c) =>
        [c.name, c.printed_name].some(
          (n) => n?.toLowerCase() === term.toLowerCase(),
        );
      runtime.state.resultCards = j.data.sort(
        (a, b) => Number(exact(b)) - Number(exact(a)),
      );
      runtime.state.total = j.total_cards;
      runtime.state.nextPage = j.has_more ? j.next_page : null;
      runtime.services.cards.showResults();
    } catch (e) {
      if (version === runtime.state.searchVersion && e.name !== "AbortError")
        runtime.view.get("searchStatus").textContent = e.message;
    }
  }

  function autoPalette(card) {
    if (card.type_line?.includes("Land")) return "land";
    const colors = card.colors || [];
    if (colors.length > 1) return "gold";
    return (
      { W: "white", U: "blue", B: "black", R: "red", G: "green" }[colors[0]] ||
      "artifact"
    );
  }

  const importCard = async function (card, face = 0) {
    const {
        composite,
        faces,
        index,
        face: f,
        second,
        mode,
        values,
      } = runtime.adapters.cards.normalize(card, face),
      request = ++runtime.state.importVersion;
    runtime.state.importLoading = true;
    ++runtime.state.projectRestoreVersion;
    if (!runtime.state.collection) runtime.state.activeProjectId = null;
    runtime.state.selectedCard = card;
    runtime.state.faceIndex = index;
    for (const button of runtime.view.get("results").children)
      button.setAttribute(
        "aria-pressed",
        String(button.dataset.cardId === card.id),
      );
    for (const kind of ["art", "secondary"]) {
      ++runtime.state.mediaEpoch[kind];
      runtime.state.pendingMediaLoads.delete(kind);
      runtime.state.media[kind] = null;
      runtime.state.dataUrls[kind] = "";
    }
    for (const id of runtime.config.advancedFields)
      runtime.services.editor.resetAdvancedField(id);
    for (const [id, value] of Object.entries(values))
      runtime.view.write(id, value);
    runtime.view.get("cardLayout").value = mode;
    if (second)
      for (const [id, value] of Object.entries({
        secondName: second.printed_name || second.name || "",
        secondMana: second.mana_cost || "",
        secondType: second.printed_type_line || second.type_line || "",
        secondRules: second.printed_text || second.oracle_text || "",
        secondFlavor: second.flavor_text || "",
        secondPower: second.power || "",
        secondToughness: second.toughness || "",
      }))
        runtime.view.get(id).value = value;
    if (mode === "planeswalker") {
      let n = 1,
        extra = [];
      for (const line of (f.printed_text || f.oracle_text || "").split("\n")) {
        const m = line.match(/^([+−-]?(?:\d+|X)):\s*(.*)$/);
        if (m && n <= 4) {
          runtime.view.get("pwCost" + n).value = m[1];
          runtime.view.get("pwText" + n++).value = m[2];
        } else if (line.trim()) extra.push(line);
      }
      if (extra.length)
        runtime.view.get("pwText1").value =
          extra.join("\n") +
          (runtime.view.get("pwText1").value
            ? "\n" + runtime.view.get("pwText1").value
            : "");
    }
    if (mode === "saga") {
      let n = 1;
      for (const line of (f.printed_text || f.oracle_text || "").split("\n")) {
        const m = line.match(/^([IVX, ]+) — (.*)$/);
        if (m && n <= 4) {
          runtime.view.get("chapterLabel" + n).value = m[1];
          runtime.view.get("chapterText" + n++).value = m[2];
        } else if (line.trim())
          runtime.view.get("sagaIntro").value +=
            (runtime.view.get("sagaIntro").value ? "\n" : "") + line;
      }
    }
    runtime.view.get("faceSelect").replaceChildren(
      ...faces.map((face, i) => {
        const o = runtime.platform.document.createElement("option");
        o.value = i;
        o.textContent = face.printed_name || face.name;
        return o;
      }),
    );
    runtime.view.get("faceSelect").disabled = composite || faces.length < 2;
    runtime.view.get("faceSelector").hidden =
      runtime.view.get("faceSelect").disabled;
    runtime.view.get("faceSelect").value = index;
    runtime.state.media.symbol = null;
    runtime.state.dataUrls.symbol = "";
    runtime.services.cards.loadSet();
    runtime.services.images.fit();
    runtime.services.editor.message(
      "Dados importados. Carregando a ilustração…",
    );
    try {
      const info = f.image_uris || card.image_uris;
      if (info?.art_crop)
        await runtime.services.images.setMedia("art", info.art_crop);
      if (request !== runtime.state.importVersion) return;
      if (mode === "split" && second?.image_uris?.art_crop)
        await runtime.services.images.setMedia(
          "secondary",
          second.image_uris.art_crop,
        );
      if (request !== runtime.state.importVersion) return;
      runtime.services.editor.changed();
      runtime.services.editor.message(
        info?.art_crop
          ? "Carta importada. Personalize sua arte e os textos."
          : "Dados importados. Envie sua ilustração na aba Arte.",
      );
    } catch (e) {
      if (request === runtime.state.importVersion) {
        runtime.services.editor.changed();
        runtime.services.editor.message(
          "Dados importados; não foi possível carregar a arte. Envie uma imagem na aba Arte.",
          true,
        );
      }
    } finally {
      if (request === runtime.state.importVersion)
        runtime.state.importLoading = false;
      runtime.services.editor.updateExportState();
    }
  };

  async function fetchWithTimeout(url, options = {}) {
    const controller = new AbortController(),
      external = options.signal,
      abort = () => controller.abort();
    if (external?.aborted) controller.abort();
    else external?.addEventListener("abort", abort, { once: true });
    let timedOut = false;
    const timer = runtime.platform.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 20000);
    try {
      return await runtime.platform.fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (timedOut)
        throw new Error(
          "A consulta demorou demais. Verifique a conexão e tente novamente.",
        );
      throw error;
    } finally {
      runtime.platform.clearTimeout(timer);
      external?.removeEventListener("abort", abort);
    }
  }
  return {
    svgImage,
    loadSet,
    imageInfo,
    showResults,
    search,
    autoPalette,
    importCard,
    fetchWithTimeout,
  };
}
