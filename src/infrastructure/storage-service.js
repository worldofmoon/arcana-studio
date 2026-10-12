export function createService(runtime) {
  function database() {
    return runtime.adapters.repository.open();
  }
  function allLibraryItems() {
    return runtime.adapters.repository.all(() =>
      runtime.services.storage.database(),
    );
  }
  async function libraryRead() {
    return (await allLibraryItems())
      .filter((r) => r?.kind === "saved-project")
      .sort((a, b) => b.updated - a.updated);
  }
  function libraryWrite(record) {
    return runtime.adapters.repository.write([record], [], () =>
      runtime.services.storage.database(),
    );
  }
  function libraryRemove(id) {
    return runtime.adapters.repository.write([], [id], () =>
      runtime.services.storage.database(),
    );
  }
  function libraryBatchWrite(records, deletes = []) {
    return runtime.adapters.repository.write(records, deletes, () =>
      runtime.services.storage.database(),
    );
  }
  return {
    database,
    allLibraryItems,
    libraryRead,
    libraryWrite,
    libraryRemove,
    libraryBatchWrite,
  };
}
