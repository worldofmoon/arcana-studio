import { AssetProxy } from "../infrastructure/asset-proxy.js?v=e180db8dc555";
import { IndexedDbAdapter } from "../infrastructure/indexeddb-adapter.js?v=e180db8dc555";
import { ScryfallAdapter } from "../infrastructure/scryfall-adapter.js?v=e180db8dc555";
import * as config from "../domain/config.js?v=e180db8dc555";
import { initializeState } from "./state.js?v=e180db8dc555";
import { createServices } from "./create-services.js?v=e180db8dc555";
import { initializeControllers } from "../ui/initialize.js?v=e180db8dc555";
import { DomView } from "../ui/dom-view.js?v=e180db8dc555";
import { SERVICE_MAP } from "./service-map.js?v=e180db8dc555";

/** Facade: coordinates editor subsystems without exposing globals to the page. */
export class EditorFacade {
  constructor({
    platform,
    assets,
    view = new DomView(platform.document),
    adapters = {},
  }) {
    this.runtime = { platform, assets, view, config, state: {}, services: {} };
    initializeState(this.runtime);
    createServices(this.runtime);
    this.runtime.adapters = {
      repository: new IndexedDbAdapter(platform.indexedDB),
      cards: new ScryfallAdapter(),
      frames: new AssetProxy((url) =>
        this.runtime.services.images.imageUrl(url),
      ),
      ...adapters,
    };
  }
  start() {
    if (!this.startPromise) {
      this.startPromise = (async () => {
        initializeControllers(this.runtime);
        await Promise.all([
          this.runtime.state.fontsReady,
          this.runtime.state.embeddedReady,
        ]);
        if (!(await this.runtime.state.fontsReady))
          throw new Error("Não foi possível carregar as fontes do editor.");
        return this;
      })();
    }
    return this.startPromise;
  }
  invoke(name, ...args) {
    const [service, method] = SERVICE_MAP[name] ?? [];
    if (!service) throw new Error(`Unknown editor operation: ${name}`);
    return this.runtime.services[service][method](...args);
  }
  importCard(card, face = 0) {
    return this.invoke("importCard", card, face);
  }
  openProject(project) {
    return this.runtime.services.collection.open(project);
  }
  getProject() {
    return this.runtime.services.collection.snapshot();
  }
  render() {
    return this.invoke("render");
  }
}
