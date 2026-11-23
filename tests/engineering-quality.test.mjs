import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

test("Accesibilidad: viewport permite zoom táctil y soporta viewportFit cover", () => {
  const layout = fs.readFileSync(path.join(root, "src/app/layout.tsx"), "utf8");
  assert.equal(layout.includes("userScalable: false"), false);
  assert.equal(layout.includes("maximumScale: 1"), false);
  assert.equal(layout.includes('viewportFit: "cover"'), true);
});

test("Cola offline: mutación de favoritos es idempotente (set_favorite)", () => {
  const queueSrc = fs.readFileSync(path.join(root, "src/lib/offlineQueue.ts"), "utf8");
  const cardSrc = fs.readFileSync(path.join(root, "src/components/places/PlaceCard.tsx"), "utf8");
  assert.equal(queueSrc.includes('type: "set_favorite"'), true);
  assert.equal(queueSrc.includes("setFavoriteAction"), true);
  assert.equal(cardSrc.includes('type: "set_favorite"'), true);
  assert.equal(cardSrc.includes("setFavoriteAction("), true);
});

test("Esquema DB: places incluye columna country y occasions.icon admite Material Symbols", () => {
  const schema = fs.readFileSync(path.join(root, "src/db/schema.ts"), "utf8");
  assert.equal(schema.includes('country: varchar("country"'), true);
  assert.equal(schema.includes('icon: varchar("icon", { length: 50 })'), true);
});

test("Mapa e i18n: sin coordenadas hardcodeadas de Granada ni textos fijos sin traducir", () => {
  const explorer = fs.readFileSync(
    path.join(root, "src/components/places/PlacesExplorer.tsx"),
    "utf8"
  );
  const docs = fs.readFileSync(
    path.join(root, "src/components/docs/DocsViewer.tsx"),
    "utf8"
  );
  assert.equal(explorer.includes("37.1773"), false);
  assert.equal(explorer.includes("Base de datos sincronizada localmente"), false);
  assert.equal(docs.includes("Centro de Documentación"), false);
});
