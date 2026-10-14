import test from "node:test";
import { facade, nodes, assert } from "./parity-fixture.js";
import { createCanvas } from "@napi-rs/canvas";

test("artwork moves independently on both axes at reduced, fitted and enlarged zoom, including rotated and secondary art", () => {
  const r = facade.runtime,
    g = r.services.geometry;
  const art = createCanvas(100, 100);
  art.getContext("2d").fillStyle = "#ff0000";
  art.getContext("2d").fillRect(0, 0, 100, 100);
  const box = { x: 0, y: 0, w: 200, h: 200 };
  nodes.artBg.value = "#ffffff";
  nodes.artOpacity.value = "1";
  for (const zoom of [0.1, 1, 2])
    for (const rotation of [0, 90])
      for (const side of ["front", "back", "secondary"]) {
        nodes.zoom.value = String(zoom);
        nodes.rotation.value = String(rotation);
        nodes.backZoom.value = String(zoom);
        nodes.backRotation.value = String(rotation);
        nodes.secondZoom.value = String(zoom);
        nodes.secondRotation.value = String(rotation);
        const x =
            side === "front" ? "shiftX" : side === "back" ? "backX" : "secondX",
          y =
            side === "front" ? "shiftY" : side === "back" ? "backY" : "secondY";
        nodes[x].value = "0";
        nodes[y].value = "0";
        const record = [];
        const c = {
          globalAlpha: 1,
          save() {},
          restore() {},
          beginPath() {},
          moveTo() {},
          lineTo() {},
          quadraticCurveTo() {},
          closePath() {},
          clip() {},
          fillRect() {},
          translate: (...v) => record.push(v),
          rotate() {},
          drawImage() {},
        };
        const draw = () =>
          side === "secondary"
            ? g.drawSecondary(c, art, box)
            : g.artDraw(c, art, box, side === "back");
        draw();
        const centered = record.at(-1);
        nodes[x].value = "50";
        draw();
        assert(record.at(-1)[0] < centered[0]);
        assert.equal(record.at(-1)[1], centered[1]);
        nodes[x].value = "0";
        nodes[y].value = "50";
        draw();
        assert.equal(record.at(-1)[0], centered[0]);
        assert(record.at(-1)[1] < centered[1]);
      }
  nodes.zoom.value = "0.1";
  nodes.rotation.value = "0";
  nodes.shiftX.value = "-50";
  nodes.shiftY.value = "-50";
  const out = createCanvas(200, 200);
  g.artDraw(out.getContext("2d"), art, box);
  assert.equal(out.getContext("2d").getImageData(150, 150, 1, 1).data[1], 0);
  assert.equal(out.getContext("2d").getImageData(100, 100, 1, 1).data[1], 255);
});

test("dragging the preview follows the pointer at low zoom on either face and stops on release", () => {
  const r = facade.runtime,
    art = createCanvas(100, 100);
  r.state.media.art = art;
  r.state.media.back = art;
  for (const side of ["art", "back"]) {
    nodes.cardLayout.value = "normal";
    nodes.zoom.value = "0.1";
    nodes.backZoom.value = "0.1";
    nodes.rotation.value = "0";
    nodes.backRotation.value = "0";
    const x = side === "back" ? "backX" : "shiftX",
      y = side === "back" ? "backY" : "shiftY";
    nodes[x].value = "0";
    nodes[y].value = "0";
    r.services.editor.tab(side);
    nodes.canvas.handlers.pointerdown({
      clientX: 100,
      clientY: 100,
      pointerId: 1,
      preventDefault() {},
    });
    const pointer = { ...r.state.pointer };
    nodes.canvas.handlers.pointermove({ clientX: 115, clientY: 110 });
    assert.equal(
      Number(nodes[x].value),
      ((-15 * 1260) / 300 / pointer.rangeX) * 200,
    );
    assert.equal(
      Number(nodes[y].value),
      ((-10 * 1760) / 419 / pointer.rangeY) * 200,
    );
    const before = nodes[x].value;
    nodes.canvas.handlers.pointerup();
    nodes.canvas.handlers.pointermove({ clientX: 130, clientY: 110 });
    assert.equal(nodes[x].value, before);
  }
});

test("direction buttons and numeric positions update every artwork axis and stay synchronized with the sliders", () => {
  const r = facade.runtime;
  for (const field of [
    "shiftX",
    "shiftY",
    "secondX",
    "secondY",
    "backX",
    "backY",
  ]) {
    nodes[field].value = "0";
    nodes[field + "Before"].onclick();
    assert.equal(nodes[field].value, "5");
    assert.equal(nodes[field + "Number"].value, "5");
    nodes[field + "After"].onclick();
    assert.equal(nodes[field].value, "0");
    nodes[field + "Number"].value = "-25";
    nodes[field + "Number"].handlers.input();
    assert.equal(nodes[field].value, "-25");
    nodes[field + "Number"].value = "200";
    nodes[field + "Number"].handlers.change();
    assert.equal(nodes[field].value, "100");
    assert.equal(nodes[field + "Number"].value, "100");
    nodes[field].value = "-10";
    nodes[field].handlers.input();
    assert.equal(nodes[field + "Number"].value, "-10");
  }
  const project = r.services.projects.snapshot();
  assert.equal(project.values.shiftX, "-10");
  assert(!("shiftXNumber" in project.values));
});
