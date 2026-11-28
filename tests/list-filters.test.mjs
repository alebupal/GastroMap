import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { registerHooks } from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const srcDir = path.join(__dirname, "..", "src");

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith("@/")) {
      const rel = specifier.slice(2);
      const target = rel.endsWith(".json")
        ? path.join(srcDir, rel)
        : path.join(srcDir, `${rel}.ts`);
      return nextResolve(pathToFileURL(target).href, context);
    }
    return nextResolve(specifier, context);
  },
  load(url, context, nextLoad) {
    if (url.endsWith(".json")) {
      return {
        format: "json",
        shortCircuit: true,
        source: fs.readFileSync(fileURLToPath(url), "utf8"),
      };
    }
    return nextLoad(url, context);
  },
});

const {
  matchesListFilterCriteria,
  sanitizeListFilterCriteria,
  summarizeListFilterCriteria,
} = await import("../src/lib/list-filters.ts");

test("Autolistas: filtra correctamente por ciudad/provincia, categoría y etiqueta (La Orotava -> Santa Cruz de Tenerife + tapas + comida canaria)", () => {
  const criteria = {
    selectedCities: ["Santa Cruz de Tenerife"],
    selectedOccasions: ["tapas"],
    selectedTags: ["comida canaria"],
  };

  const matchPlace = {
    name: "Guachinche El Mirador",
    city: "Santa Cruz de Tenerife",
    country: "España",
    address: "Camino El Mirador, 12, La Orotava",
    notes: "Ropa vieja y papas arrugadas",
    priceRange: "€",
    occasions: ["tapas", "comer"],
    tags: ["comida canaria", "guachinche"],
  };

  const wrongCity = { ...matchPlace, city: "Granada", address: "Calle Navas, Granada" };
  const wrongTag = { ...matchPlace, tags: ["italiano"] };
  const wrongOccasion = { ...matchPlace, occasions: ["desayuno"] };

  assert.equal(matchesListFilterCriteria(matchPlace, criteria), true);
  assert.equal(matchesListFilterCriteria(wrongCity, criteria), false);
  assert.equal(matchesListFilterCriteria(wrongTag, criteria), false);
  assert.equal(matchesListFilterCriteria(wrongOccasion, criteria), false);
});

test("Autolistas: sanitizeListFilterCriteria limpia vacíos y summarizeListFilterCriteria genera chips", () => {
  assert.equal(sanitizeListFilterCriteria({ textSearch: "   ", selectedCities: [] }), null);
  const clean = sanitizeListFilterCriteria({
    selectedCities: ["Tenerife", "Tenerife"],
    selectedTags: [" Comida Canaria "],
  });
  assert.deepEqual(clean, {
    selectedCities: ["Tenerife"],
    selectedTags: ["comida canaria"],
  });
  const chips = summarizeListFilterCriteria(clean);
  assert.ok(chips.some((c) => c.includes("Tenerife")));
  assert.ok(chips.some((c) => c.includes("#comida canaria")));
});
