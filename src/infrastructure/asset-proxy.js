/** Proxy: shares in-flight work and lazily loads immutable image assets. */
export class AssetProxy {
  constructor(load) {
    this.load = load;
    this.cache = new Map();
    this.pending = new Map();
  }
  async get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    if (!this.pending.has(key)) {
      const pending = Promise.resolve()
        .then(() => this.load(key))
        .then((value) => {
          this.cache.set(key, value);
          this.pending.delete(key);
          return value;
        })
        .catch((error) => {
          this.pending.delete(key);
          throw error;
        });
      this.pending.set(key, pending);
    }
    return this.pending.get(key);
  }
}
export async function loadCatalog(fetch, baseURL) {
  const read = async (name) => {
    const response = await fetch(new URL(name, baseURL));
    if (!response.ok)
      throw new Error("Não foi possível carregar os recursos do editor.");
    return response.json();
  };
  const [catalog, symbols] = await Promise.all([
    read("assets/catalog.json"),
    read("assets/symbols.json"),
  ]);
  if (!Array.isArray(catalog) || !symbols || typeof symbols !== "object")
    throw new Error("Recursos do editor inválidos.");
  return { catalog, symbols };
}
