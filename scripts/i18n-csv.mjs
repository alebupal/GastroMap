#!/usr/bin/env node
/**
 * Conversor JSON <-> CSV de traducciones (estilo TVSpy: añadir un idioma = añadir una columna).
 *
 *   node scripts/i18n-csv.mjs export   → src/locales/translations.csv  (key,es,en,...)
 *   node scripts/i18n-csv.mjs import   → regenera src/locales/<code>.json desde el CSV
 *   node scripts/i18n-csv.mjs check    → lista claves que faltan en cada idioma
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "src", "locales");
const csvPath = path.join(dir, "translations.csv");

const esc = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); cell = "";
      if (row.some((x) => x !== "")) rows.push(row);
      row = [];
    } else cell += c;
  }
  if (cell !== "" || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

function flatten(obj, prefix = "") {
  const result = {};
  if (!obj || typeof obj !== "object") return result;
  for (const [key, value] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value, fullKey));
    } else if (typeof value === "string") {
      result[fullKey] = value;
    }
  }
  return result;
}

function loadJsons() {
  const out = {};
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
    out[f.replace(".json", "")] = flatten(raw);
  }
  return out;
}

const cmd = process.argv[2];

if (cmd === "export") {
  const data = loadJsons();
  const langs = Object.keys(data).sort((a, b) => (a === "es" ? -1 : b === "es" ? 1 : a.localeCompare(b)));
  const keys = [...new Set(langs.flatMap((l) => Object.keys(data[l])))].sort();
  const lines = [["key", ...langs].map(esc).join(",")];
  for (const k of keys) lines.push([k, ...langs.map((l) => data[l][k] ?? "")].map(esc).join(","));
  fs.writeFileSync(csvPath, lines.join("\n") + "\n");
  console.log(`✔ ${keys.length} claves, idiomas: ${langs.join(", ")} → ${csvPath}`);
} else if (cmd === "import") {
  const [header, ...rows] = parseCsv(fs.readFileSync(csvPath, "utf8"));
  const langs = header.slice(1);
  for (let i = 0; i < langs.length; i++) {
    const obj = {};
    for (const r of rows) if (r[i + 1]) obj[r[0]] = r[i + 1];
    const sorted = Object.fromEntries(Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)));
    fs.writeFileSync(path.join(dir, `${langs[i]}.json`), JSON.stringify(sorted, null, 2) + "\n");
    console.log(`✔ ${langs[i]}.json (${Object.keys(sorted).length} claves)`);
  }
  console.log("Recuerda registrar el nuevo idioma en src/lib/i18n/config.ts y messages.ts");
} else if (cmd === "check") {
  const data = loadJsons();
  const keys = new Set(Object.values(data).flatMap((d) => Object.keys(d)));
  let missing = 0;
  for (const [l, d] of Object.entries(data)) {
    const m = [...keys].filter((k) => !d[k]);
    missing += m.length;
    if (m.length) console.log(`✘ ${l}: faltan ${m.length}\n   ${m.slice(0, 15).join("\n   ")}`);
  }
  console.log(missing ? `\n${missing} traducciones pendientes` : "✔ Todos los idiomas completos");
  process.exit(missing ? 1 : 0);
} else {
  console.log("Uso: node scripts/i18n-csv.mjs <export|import|check>");
}
