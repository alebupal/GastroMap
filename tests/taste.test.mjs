import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const tasteSrc = fs.readFileSync(new URL("../src/lib/taste.ts", import.meta.url), "utf8");
const explorerSrc = fs.readFileSync(new URL("../src/components/places/PlacesExplorer.tsx", import.meta.url), "utf8");

test("Algoritmo Para ti (gustos personales): funciones y opción en PlacesExplorer", () => {
  assert.ok(tasteSrc.includes("export function buildTasteProfile"));
  assert.ok(tasteSrc.includes("export function scorePlaceByTaste"));
  assert.ok(explorerSrc.includes('"for_you"'));
  assert.ok(explorerSrc.includes("scorePlaceByTaste"));
});
