import test from "node:test";
import { facade, nodes, assert } from "./parity-fixture.js";

test("token searches select the token category and retain printing options", async () => {
  const r = facade.runtime;
  const cards = Array.from({ length: 25 }, (_, i) => ({
    id: "dragon-" + i,
    name: "Dragon",
    set_name: "Dragon tokens",
    collector_number: String(i),
    lang: "en",
    layout: "token",
    type_line: "Token Creature — Dragon",
  }));
  let params;
  r.services.cards.fetchWithTimeout = async (url) => {
    params = new URL(url).searchParams;
    return {
      ok: true,
      json: async () => ({
        data: cards, total_cards: 25, has_more: true,
        next_page: "https://api.scryfall.com/cards/search?page=2",
      }),
    };
  };
  for (const term of ["token dragon", "Dragon token", "TOKENS Dragon", "ficha Dragon"]) {
    nodes.searchName.value = term;
    await r.services.cards.search();
    assert.equal(params.get("q"), 't:token name:"' + (term === "token dragon" ? "dragon" : "Dragon") + '" (lang:en or lang:pt)');
    assert.equal(params.get("unique"), "prints");
    assert.equal(params.get("include_extras"), "true");
    assert.equal(nodes.results.children.length, 20);
    assert.equal(r.state.resultCards.length, 25);
    assert.equal(nodes.more.hidden, false);
    assert(r.state.nextPage);
  }
  nodes.searchName.value = "Dragon";
  await r.services.cards.search();
  assert.equal(params.get("q"), 'name:"Dragon" (lang:en or lang:pt)');
  nodes.searchName.value = 'Dragon "Mage"';
  await r.services.cards.search();
  assert.equal(params.get("q"), 'name:"Dragon  Mage " (lang:en or lang:pt)');
});
