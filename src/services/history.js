export function createService(runtime) {
  function sameSnapshot(a, b) {
    if (!a || !b) return false;
    if (JSON.stringify(a.values) !== JSON.stringify(b.values)) return false;
    return (
      runtime.config.mediaKinds.every(
        (k) => (a.media[k] || "") === (b.media[k] || ""),
      ) &&
      ["title", "rules"].every(
        (k) => (a.fonts?.[k] || "") === (b.fonts?.[k] || ""),
      )
    );
  }

  function updateHistoryButtons() {
    runtime.view.get("undo").disabled =
      runtime.state.historyBusy || runtime.state.historyIndex < 1;
    runtime.view.get("redo").disabled =
      runtime.state.historyBusy ||
      runtime.state.historyIndex >= runtime.state.historyEntries.length - 1;
  }

  function commitHistory() {
    runtime.platform.clearTimeout(runtime.state.historyTimer);
    runtime.state.historyTimer = null;
    if (runtime.state.historyRestoring || runtime.state.batchRendering) return;
    const state = runtime.services.projects.snapshot();
    if (
      runtime.services.history.sameSnapshot(
        state,
        runtime.state.historyEntries[runtime.state.historyIndex],
      )
    ) {
      runtime.services.history.updateHistoryButtons();
      return;
    }
    runtime.state.historyEntries = runtime.state.historyEntries.slice(
      0,
      runtime.state.historyIndex + 1,
    );
    runtime.state.historyEntries.push(state);
    if (runtime.state.historyEntries.length > 50)
      runtime.state.historyEntries.shift();
    runtime.state.historyIndex = runtime.state.historyEntries.length - 1;
    runtime.services.history.updateHistoryButtons();
  }

  function scheduleHistory() {
    if (runtime.state.historyRestoring || runtime.state.batchRendering) return;
    runtime.platform.clearTimeout(runtime.state.historyTimer);
    runtime.state.historyTimer = runtime.platform.setTimeout(
      runtime.services.history.commitHistory,
      350,
    );
    runtime.view.get("undo").disabled = false;
  }

  async function moveHistory(delta) {
    if (runtime.state.historyBusy || runtime.state.batchRendering) return;
    runtime.services.history.commitHistory();
    const next = runtime.state.historyIndex + delta;
    if (next < 0 || next >= runtime.state.historyEntries.length) return;
    const before = runtime.state.activeTab;
    runtime.state.historyBusy = true;
    runtime.state.historyRestoring = true;
    runtime.services.history.updateHistoryButtons();
    try {
      ++runtime.state.setRequest;
      runtime.state.setLoading = false;
      ++runtime.state.importVersion;
      if (
        !(await runtime.services.projects.restoreProject(
          runtime.state.historyEntries[next],
        ))
      )
        return;
      runtime.state.historyIndex = next;
      runtime.services.editor.tab(before);
      runtime.services.editor.message(
        delta < 0 ? "Alteração desfeita." : "Alteração refeita.",
      );
    } catch (e) {
      runtime.services.editor.message(e.message, true);
    } finally {
      runtime.state.historyRestoring = false;
      runtime.state.historyBusy = false;
      runtime.services.history.updateHistoryButtons();
      runtime.platform.clearTimeout(runtime.state.draftTimer);
      runtime.state.draftTimer = runtime.platform.setTimeout(
        runtime.services.projects.saveDraft,
        1100,
      );
    }
  }
  return {
    sameSnapshot,
    updateHistoryButtons,
    commitHistory,
    scheduleHistory,
    moveHistory,
  };
}
