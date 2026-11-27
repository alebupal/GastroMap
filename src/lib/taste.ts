export interface TasteInputPlace {
  id: string;
  occasions: string[];
  tags: string[];
  priceRange: string;
  city?: string | null;
  isFavorite?: boolean;
  personalStatus?: "pending" | "visited" | null;
  rating?: number | null;
  commentsCount?: number;
  createdAt?: Date | string;
}

export interface TasteProfile {
  occasionWeights: Map<string, number>;
  tagWeights: Map<string, number>;
  priceWeights: Map<string, number>;
  cityWeights: Map<string, number>;
  hasSignals: boolean;
}

/**
 * Construye un perfil de gustos personales a partir de los sitios favoritos,
 * bien valorados, visitados o pendientes del usuario.
 */
export function buildTasteProfile(places: TasteInputPlace[]): TasteProfile {
  const occasionWeights = new Map<string, number>();
  const tagWeights = new Map<string, number>();
  const priceWeights = new Map<string, number>();
  const cityWeights = new Map<string, number>();
  let hasSignals = false;

  for (const p of places) {
    let signal = 0;
    if (p.isFavorite) signal += 3;
    if (p.rating !== null && p.rating !== undefined) {
      if (p.rating >= 8) signal += 3;
      else if (p.rating >= 7) signal += 1.5;
      else if (p.rating < 5) signal -= 2;
    }
    if (p.personalStatus === "visited" && (p.rating == null || p.rating >= 5)) {
      signal += 1;
    } else if (p.personalStatus === "pending") {
      signal += 1.2;
    }

    if (signal === 0) continue;
    hasSignals = true;

    for (const occ of p.occasions || []) {
      occasionWeights.set(occ, (occasionWeights.get(occ) || 0) + signal);
    }
    for (const tag of p.tags || []) {
      tagWeights.set(tag, (tagWeights.get(tag) || 0) + signal);
    }
    if (p.priceRange && p.priceRange !== "???") {
      priceWeights.set(p.priceRange, (priceWeights.get(p.priceRange) || 0) + signal);
    }
    if (p.city) {
      cityWeights.set(p.city, (cityWeights.get(p.city) || 0) + signal);
    }
  }

  return {
    occasionWeights,
    tagWeights,
    priceWeights,
    cityWeights,
    hasSignals,
  };
}

/**
 * Calcula la puntuación de afinidad de un sitio para el usuario actual.
 * Prioriza coincidencias con sus categorías, etiquetas, rango de precio y ciudad,
 * dando un ligero impulso a sitios «Por descubrir» o «Quiero ir».
 */
export function scorePlaceByTaste(place: TasteInputPlace, profile: TasteProfile): number {
  let score = 0;

  if (profile.hasSignals) {
    // Media ponderada de categorías coincidentes (evita sesgar por cantidad bruta)
    if (place.occasions && place.occasions.length > 0) {
      let occSum = 0;
      for (const occ of place.occasions) {
        occSum += profile.occasionWeights.get(occ) || 0;
      }
      score += (occSum / Math.sqrt(place.occasions.length)) * 1.4;
    }

    // Top 4 etiquetas más afines del sitio
    if (place.tags && place.tags.length > 0) {
      const topTagScores = place.tags
        .map((tg) => profile.tagWeights.get(tg) || 0)
        .sort((a, b) => b - a)
        .slice(0, 4);
      const tagSum = topTagScores.reduce((acc, v) => acc + v, 0);
      score += tagSum * 0.9;
    }

    if (place.priceRange && place.priceRange !== "???") {
      score += (profile.priceWeights.get(place.priceRange) || 0) * 0.5;
    }

    if (place.city) {
      score += (profile.cityWeights.get(place.city) || 0) * 0.35;
    }
  }

  // Impulso suave a descubrimientos pendientes frente a sitios ya visitados (salvo favoritos/top)
  if (!place.personalStatus) {
    score += 1.5;
  } else if (place.personalStatus === "pending") {
    score += 1.2;
  }

  if (place.isFavorite) score += 1.0;
  if (place.rating != null && place.rating < 5) score -= 4.0;
  if (place.commentsCount) score += Math.min(place.commentsCount, 5) * 0.25;

  return score;
}
