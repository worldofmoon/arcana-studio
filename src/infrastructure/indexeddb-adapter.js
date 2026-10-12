/** Adapter: translates record operations into IndexedDB requests/transactions. */
export class IndexedDbAdapter {
  constructor(factory) {
    this.factory = factory;
  }
  open() {
    return new Promise((resolve, reject) => {
      const request = this.factory.open("arcana-studio", 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore("projects");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }
  async all(open = () => this.open()) {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction("projects")
          .objectStore("projects")
          .getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }
  async get(key, open = () => this.open()) {
    const database = await open();
    try {
      return await new Promise((resolve, reject) => {
        const request = database
          .transaction("projects")
          .objectStore("projects")
          .get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } finally {
      database.close();
    }
  }
  async write(records, deletes = [], open = () => this.open()) {
    return this.transaction(
      records.map((record) => [record.id, record]),
      deletes,
      open,
    );
  }
  async put(key, value, open = () => this.open()) {
    return this.transaction([[key, value]], [], open);
  }
  async transaction(entries, deletes, open) {
    const database = await open();
    try {
      await new Promise((resolve, reject) => {
        const transaction = database.transaction("projects", "readwrite");
        transaction.oncomplete = resolve;
        transaction.onerror = () =>
          reject(
            transaction.error || new Error("Falha ao salvar a biblioteca."),
          );
        transaction.onabort = () =>
          reject(transaction.error || new Error("A operação foi cancelada."));
        try {
          const store = transaction.objectStore("projects");
          for (const key of deletes) store.delete(key);
          for (const [key, value] of entries) store.put(value, key);
        } catch (error) {
          transaction.abort();
          reject(error);
        }
      });
    } finally {
      database.close();
    }
  }
}
