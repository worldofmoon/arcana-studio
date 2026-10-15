import test from "node:test";
import { facade, nodes, assert } from "./parity-fixture.js";
import { createCanvas } from "@napi-rs/canvas";

test("name and type positions move independently across frames and persist in projects", async () => {
  const r = facade.runtime;
  const original = r.services.text.fitTitle;
  const positions = [];
  r.services.text.fitTitle = (...args) => positions.push(args.slice(2, 4));
  const c = createCanvas(1260, 1760).getContext("2d");
  try {
    for (const [frame, mode] of [["ivory", "normal"], ["asset-tokens-artifact", "normal"], ["ivory", "split"], ["ivory", "saga"]]) {
      nodes.frame.value = frame;
      nodes.cardLayout.value = mode;
      for (const field of ["nameX", "nameY", "typeX", "typeY"]) nodes[field].value = "0";
      const draw = () => {
        positions.length = 0;
        r.services.renderer.paintLayer(c, "text", r.services.renderer.specialPlan());
        return positions.map(p => [...p]);
      };
      const baseline = draw();
      nodes.nameX.value = "5";
      nodes.nameY.value = "-3";
      let moved = draw();
      assert(Math.abs(moved[0][0] - baseline[0][0] - 63) < 0.001);
      assert(Math.abs(moved[0][1] - baseline[0][1] + 52.8) < 0.001);
      assert.deepEqual(moved[1], baseline[1]);
      nodes.typeX.value = "-4";
      nodes.typeY.value = "2";
      moved = draw();
      assert(Math.abs(moved[1][0] - baseline[1][0] + 50.4) < 0.001);
      assert(Math.abs(moved[1][1] - baseline[1][1] - 35.2) < 0.001);
    }
  } finally {
    r.services.text.fitTitle = original;
  }
  const saved = r.services.projects.snapshot();
  assert.equal(saved.values.nameX, "5");
  assert.equal(saved.values.typeY, "2");
  nodes.resetTextPosition.onclick();
  assert.equal(nodes.nameX.value, "0");
  assert.equal(nodes.typeY.value, "0");
  await r.services.projects.restoreProject(saved);
  assert.equal(nodes.nameX.value, "5");
  assert.equal(nodes.typeY.value, "2");
  for (const field of ["nameX", "nameY", "typeX", "typeY"]) delete saved.values[field];
  await r.services.projects.restoreProject(saved);
  assert.equal(nodes.nameX.value, "0");
  assert.equal(nodes.typeY.value, "0");
});
