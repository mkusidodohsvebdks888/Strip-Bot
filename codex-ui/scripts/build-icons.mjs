// Generates codex-ui/src/icons.generated.ts from icons/manifest.json.
// Sources: Page07/.runtime/icon-sources (Lucide, MingCute). Run: node scripts/build-icons.mjs
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const uiRoot = path.resolve(here, "..");
const manifest = JSON.parse(await readFile(path.join(uiRoot, "icons", "manifest.json"), "utf8"));
const sourceRoot = path.join(uiRoot, "icons");

const collapse = (value) => value.replace(/\r?\n/g, " ").replace(/\s+/g, " ").trim();

function normalize(raw, strokeWidth, label) {
  const svg = collapse(raw);
  const open = svg.match(/^<svg[^>]*>/);
  const close = svg.lastIndexOf("</svg>");
  if (!open || close < 0) throw new Error(`${label}: not an <svg> document`);
  const viewBox = (open[0].match(/viewBox="([^"]+)"/) || [, "0 0 24 24"])[1];
  let body = svg.slice(open[0].length, close);
  body = body.replace(/stroke="#[0-9a-fA-F]{3,8}"/g, 'stroke="currentColor"');
  body = body.replace(/fill="#[0-9a-fA-F]{3,8}"/g, 'fill="currentColor"');
  const head =
    '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="' + viewBox + '" fill="none" stroke="currentColor" stroke-width="' + strokeWidth + '" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">';
  return head + body + "</svg>";
}

const quote = (value) => "'" + value.replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";

const entries = [];
const credits = new Set();

for (const icon of manifest.icons) {
  const set = manifest.sets[icon.set];
  if (!set) throw new Error(`Unknown icon set "${icon.set}" for "${icon.id}"`);
  const relative = set.file
    .replace("{file}", icon.file)
    .replace("{variant}", icon.variant || set.variant || "");
  const file = path.resolve(sourceRoot, set.root, relative);
  const raw = await readFile(file, "utf8");
  entries.push([icon.id, normalize(raw, set.strokeWidth ?? 1.5, icon.id)]);
  credits.add(`${set.credit} (${set.license})`);
}

const lines = [
  "// AUTO-GENERATED FILE - do not edit by hand.",
  "// Source: codex-ui/icons/manifest.json via scripts/build-icons.mjs",
  "// Sets: " + [...credits].join(", "),
  "",
  "export const functionalIcons: Record<string, string> = {",
  ...entries.map(([id, svg]) => "  " + JSON.stringify(id) + ": " + quote(svg) + ","),
  "};",
  "",
];

await writeFile(path.join(uiRoot, "src", "icons.generated.ts"), lines.join("\n"), "utf8");
console.log(`Generated ${entries.length} functional icons -> src/icons.generated.ts`);
console.log("Sets: " + [...credits].join(", "));
