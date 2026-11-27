import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { buildTasteProfile, scorePlaceByTaste, getTasteSummary } from "../src/lib/taste.ts";

const explorerSrc = fs.readFileSync(new URL("../src/components/places/PlacesExplorer.tsx", import.meta.url), "utf8");

test("Algoritmo Para ti (gustos personales): funciones, UI y puntuación real", () => {
  assert.ok(explorerSrc.includes('"for_you"'));
  assert.ok(explorerSrc.includes("scorePlaceByTaste"));

  const profile = buildTasteProfile([
    {
      id: "fav-1",
      occasions: ["tapear", "comer"],
      tags: ["tapas", "brasa"],
      priceRange: "€€",
      city: "Granada",
      isFavorite: true,
      personalStatus: "visited",
      rating: 9,
    },
    {
      id: "bad-1",
      occasions: ["copas"],
      tags: ["postureo"],
      priceRange: "€€€€",
      city: "Madrid",
      isFavorite: false,
      personalStatus: "visited",
      rating: 3,
    },
  ]);

  assert.equal(profile.hasSignals, true);

  const matchingUnexplored = {
    id: "cand-match",
    occasions: ["tapear"],
    tags: ["tapas", "brasa"],
    priceRange: "€€",
    city: "Granada",
    personalStatus: null,
  };

  const nonMatchingVisited = {
    id: "cand-other",
    occasions: ["copas"],
    tags: ["postureo"],
    priceRange: "€€€€",
    city: "Madrid",
    personalStatus: "visited",
  };

  assert.ok(
    scorePlaceByTaste(matchingUnexplored, profile) > scorePlaceByTaste(nonMatchingVisited, profile),
    "Un sitio afín por descubrir debe puntuar más alto que uno no afín"
  );

  const summary = getTasteSummary(profile);
  assert.ok(summary.topOccasionIds.includes("tapear"));
  assert.ok(summary.topTags.includes("tapas"));
  assert.equal(summary.topPrice, "€€");
});
