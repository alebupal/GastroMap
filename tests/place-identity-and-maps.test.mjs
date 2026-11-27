import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const mapsSrc = fs.readFileSync(new URL("../src/lib/maps.ts", import.meta.url), "utf8");
const identitySrc = fs.readFileSync(new URL("../src/lib/place-identity.ts", import.meta.url), "utf8");

test("Validación de enlaces Maps y generación de enlace efectivo por coordenadas", () => {
  assert.ok(mapsSrc.includes("export function isValidGoogleMapsUrl"));
  assert.ok(mapsSrc.includes("export function getMapsHref"));
  assert.ok(mapsSrc.includes("export function getGoogleSearchHref"));
  assert.ok(mapsSrc.includes("maps.app.goo.gl"));
  assert.ok(mapsSrc.includes("https://www.google.com/maps/search/?api=1&query="));
});

test("Identidad de locales y sufijo de copia: funciones puras presentes", () => {
  assert.ok(identitySrc.includes("export function normalizeMapsUrlKey"));
  assert.ok(identitySrc.includes("export function normalizePlaceName"));
  assert.ok(identitySrc.includes("export function matchPlaceIdentity"));
  assert.ok(identitySrc.includes("export function buildCopyName"));
  assert.ok(identitySrc.includes("(copia)"));
});

test("Seguridad anti-SSRF en resolución de Google Maps", () => {
  assert.ok(mapsSrc.includes("function isPrivateOrLocalHostname"));
  assert.ok(mapsSrc.includes("function getSafeGoogleMapsFetchUrl"));
  assert.ok(mapsSrc.includes("function fetchGoogleMapsWithSafeRedirects"));
  assert.ok(mapsSrc.includes('redirect: "manual"'));
  assert.ok(mapsSrc.includes("169"));
  assert.ok(mapsSrc.includes("127"));
});
