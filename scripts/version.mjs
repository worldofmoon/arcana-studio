import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = dir + "/" + entry.name;
    if (entry.isDirectory()) result.push(...(await files(path)));
    else if (path.endsWith(".js")) result.push(path);
  }
  return result.sort();
}
const sources = await files("src");
const clean = (text) => text.replace(/(\.js)\?v=[a-f0-9]+/g, "$1");
const contents = await Promise.all(
  sources.map(async (path) => [path, clean(await readFile(path, "utf8"))]),
);
const css = await readFile("styles/editor.css", "utf8");
const version = createHash("sha256")
  .update(contents.map(([path, text]) => path + "\n" + text).join("\n") + css)
  .digest("hex")
  .slice(0, 12);
for (const [path, text] of contents)
  await writeFile(
    path,
    text.replace(
      /((?:from\s+|import\s*)["'])(\.\.?\/[^"']+\.js)(["'])/g,
      `$1$2?v=${version}$3`,
    ),
  );
let html = await readFile("index.html", "utf8");
html = html.replace(
  /((?:src|href)="(?:src\/main\.js|styles\/editor\.css|styles\/fonts\.css))(?:\?v=[a-f0-9]+)?(")/g,
  `$1?v=${version}$2`,
);
await writeFile("index.html", html);
console.log("Versioned release:", version);
