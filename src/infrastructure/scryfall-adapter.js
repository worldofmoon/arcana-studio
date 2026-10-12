/** Adapter: converts Scryfall card/face schemas into the editor's data model. */
export class ScryfallAdapter {
  palette(face) {
    if (face.type_line?.includes("Land")) return "land";
    const colors = face.colors || [];
    if (colors.length > 1) return "gold";
    return (
      { W: "white", U: "blue", B: "black", R: "red", G: "green" }[colors[0]] ||
      "artifact"
    );
  }
  normalize(card, requestedFace = 0) {
    const composite = ["adventure", "split"].includes(card.layout);
    const faces = card.card_faces || [card];
    const index = composite
      ? 0
      : Math.max(0, Math.min(faces.length - 1, Number(requestedFace) || 0));
    const face = faces[index],
      second = composite ? faces[1] : null;
    const mode = composite
      ? card.layout
      : /Planeswalker/.test(face.type_line || "")
        ? "planeswalker"
        : /\bSaga\b/.test(face.type_line || "")
          ? "saga"
          : "normal";
    const values = {
      name: face.printed_name || face.name || "",
      mana: face.mana_cost || "",
      type: face.printed_type_line || face.type_line || "",
      rules: face.printed_text || face.oracle_text || "",
      flavor: face.flavor_text || "",
      power: face.power || "",
      toughness: face.toughness || "",
      loyalty: face.loyalty || face.defense || "",
      artist: face.artist || card.artist || "",
      setCode: card.set || "",
      collector: card.collector_number || "",
      language: card.lang || "en",
      rarity: card.rarity || "common",
      palette: this.palette(face),
      frame: ["token", "double_faced_token"].includes(card.layout)
        ? "token"
        : "modern",
    };
    return { composite, faces, index, face, second, mode, values };
  }
}
