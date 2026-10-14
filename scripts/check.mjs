import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { execFileSync } from "node:child_process";
async function files(dir) {
  const result = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = dir + "/" + entry.name;
    if (entry.isDirectory()) result.push(...(await files(name)));
    else result.push(name);
  }
  return result;
}
const modules = (await files("src")).filter((path) => path.endsWith(".js"));
for (const file of modules) {
  execFileSync(process.execPath, ["--check", file]);
  const source = await readFile(file, "utf8");
  for (const match of source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g))
    if (match[1].startsWith("."))
      await stat(resolve(dirname(file), match[1].split("?")[0]));
}
const html = await readFile("index.html", "utf8");
if (/<style>|<script>(?!\s*<\/script>)/.test(html))
  throw new Error("HTML must not contain embedded code");
for (const m of html.matchAll(/(?:href|src)="((?:styles|src)\/[^"?]+)/g))
  await stat(m[1]);
const catalog = JSON.parse(await readFile("assets/catalog.json", "utf8"));
for (const preset of catalog) if (preset.asset) await stat(preset.asset);
console.log(
  `PASS: ${modules.length} ES modules, HTML resources and ${catalog.length} frame presets.`,
);
