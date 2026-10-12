export function initializeState(runtime) {
  runtime.state.frameCatalog = runtime.assets.catalog;
  runtime.state.frameImages = new Map();
  runtime.state.media = Object.fromEntries(
    runtime.config.mediaKinds.map((k) => [k, null]),
  );
  runtime.state.dataUrls = Object.fromEntries(
    runtime.config.mediaKinds.map((k) => [k, ""]),
  );
  runtime.state.symbols = new Map();
  runtime.state.symbolData = runtime.assets.symbols;
  runtime.state.activeTab = "card";
  runtime.state.lastText = "rules";
  runtime.state.selectedCard = null;
  runtime.state.faceIndex = 0;
  runtime.state.draftTimer = null;
  runtime.state.dirty = false;
  runtime.state.mediaEpoch = Object.fromEntries(
    runtime.config.mediaKinds.map((k) => [k, 0]),
  );
  runtime.state.pointer = null;
  runtime.state.setRequest = 0;
  runtime.state.setLoading = false;
  runtime.state.setCache = new Map();
  runtime.state.searchAbort = null;
  runtime.state.searchVersion = 0;
  runtime.state.searchTimer = null;
  runtime.state.resultCards = [];
  runtime.state.shown = 0;
  runtime.state.nextPage = null;
  runtime.state.total = 0;
  runtime.state.importVersion = 0;
  runtime.state.availableDraft = null;
  runtime.state.fontVersions = { title: 0, rules: 0 };
  runtime.state.fontLoading = new Map();
  runtime.state.fontData = { title: "", rules: "" };
  runtime.state.fontFaces = { title: null, rules: null };
  runtime.state.activeProjectId = null;
  runtime.state.libraryRecords = [];
  runtime.state.historyEntries = [];
  runtime.state.historyIndex = -1;
  runtime.state.historyTimer = null;
  runtime.state.historyRestoring = false;
  runtime.state.historyBusy = false;
  runtime.state.batchRendering = false;
  runtime.state.printRows = [];
  runtime.state.advancedDefaults = Object.fromEntries(
    runtime.config.advancedFields.map((id) => [
      id,
      runtime.view.get(id).type === "checkbox"
        ? runtime.view.get(id).checked
        : runtime.view.get(id).value,
    ]),
  );
  runtime.state.libraryFolders = [];
  runtime.state.selectedLibraryIds = new Set();
  runtime.state.pendingLibraryBackup = null;
  runtime.state.libraryBusy = false;
  runtime.state.projectRestoreVersion = 0;
  runtime.state.editorLocks = 0;
  runtime.state.lockedControls = [];
  runtime.state.importLoading = false;
  runtime.state.pendingMediaLoads = new Map();
  runtime.state.fieldDefaults = Object.fromEntries(
    runtime.config.fields.map((id) => [
      id,
      runtime.view.get(id).type === "checkbox"
        ? runtime.view.get(id).checked
        : runtime.view.get(id).value,
    ]),
  );
}
