/** Composite: individual layers and groups share the draw(context) interface. */
export class Layer {
  constructor(id, paint) {
    this.id = id;
    this.paint = paint;
  }
  draw(context) {
    this.paint(context, this.id);
  }
}
export class LayerGroup {
  constructor(children = []) {
    this.children = children;
  }
  draw(context) {
    for (const child of this.children) child.draw(context);
  }
}
/** Decorator: adds opacity and visibility without changing the wrapped layer. */
export class OpacityLayer {
  constructor(layer, { visible = true, opacity = 1 } = {}) {
    this.layer = layer;
    this.visible = visible;
    this.opacity = Math.max(0, Math.min(1, opacity));
  }
  draw(context) {
    if (!this.visible || this.opacity <= 0) return;
    context.save();
    try {
      context.globalAlpha *= this.opacity;
      this.layer.draw(context);
    } finally {
      context.restore();
    }
  }
}
export function createLayerScene(layers, paint) {
  return new LayerGroup(
    layers.map(
      (settings) => new OpacityLayer(new Layer(settings.id, paint), settings),
    ),
  );
}
