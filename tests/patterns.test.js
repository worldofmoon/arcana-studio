import test from "node:test";
import assert from "node:assert/strict";
import { AssetProxy } from "../src/infrastructure/asset-proxy.js";
import { Layer, LayerGroup, OpacityLayer } from "../src/rendering/scene.js";
import { ScryfallAdapter } from "../src/infrastructure/scryfall-adapter.js";
import { IndexedDbAdapter } from "../src/infrastructure/indexeddb-adapter.js";

test("Proxy deduplicates parallel work, shares results and retries failures", async () => {
  let calls = 0;
  const proxy = new AssetProxy(async (key) => {
    calls++;
    if (key === "failed" && calls === 2) throw new Error("offline");
    return { key };
  });
  const [a, b] = await Promise.all([proxy.get("frame"), proxy.get("frame")]);
  assert.equal(a, b);
  assert.equal(calls, 1);
  assert.equal(await proxy.get("frame"), a);
  assert.equal(calls, 1);
  await assert.rejects(proxy.get("failed"));
  assert.equal((await proxy.get("failed")).key, "failed");
  assert.equal(calls, 3);
});
test("Composite draws nested groups in order and Decorator restores opacity on errors", () => {
  const calls = [],
    stack = [];
  const context = {
    globalAlpha: 1,
    save() {
      stack.push(this.globalAlpha);
    },
    restore() {
      this.globalAlpha = stack.pop();
    },
  };
  const draw = (ctx, id) => calls.push([id, ctx.globalAlpha]);
  const scene = new LayerGroup([
    new Layer("background", draw),
    new LayerGroup([
      new OpacityLayer(new Layer("art", draw), { opacity: 0.5 }),
      new OpacityLayer(new Layer("hidden", draw), { visible: false }),
    ]),
  ]);
  scene.draw(context);
  assert.deepEqual(calls, [
    ["background", 1],
    ["art", 0.5],
  ]);
  assert.equal(context.globalAlpha, 1);
  assert.throws(() =>
    new OpacityLayer(
      new Layer("failure", () => {
        throw new Error("paint");
      }),
      { opacity: 0.2 },
    ).draw(context),
  );
  assert.equal(context.globalAlpha, 1);
});
test("Scryfall Adapter normalizes translated faces, colors and composite layouts", () => {
  const adapter = new ScryfallAdapter();
  const card = {
    layout: "transform",
    set: "abc",
    card_faces: [
      { name: "One", type_line: "Creature", colors: ["U"] },
      {
        name: "Two",
        printed_name: "Dois",
        printed_type_line: "Criatura",
        colors: ["R", "G"],
        oracle_text: "Text",
      },
    ],
  };
  const dto = adapter.normalize(card, 1);
  assert.equal(dto.values.name, "Dois");
  assert.equal(dto.values.type, "Criatura");
  assert.equal(dto.values.palette, "gold");
  assert.equal(dto.index, 1);
  assert.equal(adapter.normalize({ ...card, layout: "adventure" }, 1).index, 0);
});
test("IndexedDB Adapter aborts synchronous transaction failures and closes the connection", async () => {
  let aborted = false,
    closed = false;
  const transaction = {
    abort() {
      aborted = true;
    },
    objectStore() {
      return {
        put() {
          throw new Error("DataCloneError");
        },
        delete() {},
      };
    },
  };
  const adapter = new IndexedDbAdapter();
  await assert.rejects(
    adapter.write([{ id: "project" }], [], async () => ({
      transaction: () => transaction,
      close() {
        closed = true;
      },
    })),
    /DataCloneError/,
  );
  assert.equal(aborted, true);
  assert.equal(closed, true);
});
