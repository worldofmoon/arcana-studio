/** Browser port; tests inject doubles without patching global objects. */
export function createBrowserPlatform(browser = globalThis) {
  const names = [
    "document",
    "Image",
    "FontFace",
    "FileReader",
    "DOMParser",
    "XMLSerializer",
    "Blob",
    "TextEncoder",
    "URL",
    "indexedDB",
    "crypto",
    "ResizeObserver",
  ];
  const platform = Object.fromEntries(
    names.map((name) => [name, browser[name]]),
  );
  for (const name of [
    "fetch",
    "setTimeout",
    "clearTimeout",
    "btoa",
    "atob",
    "confirm",
  ])
    platform[name] = browser[name].bind(browser);
  return platform;
}
