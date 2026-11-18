"use client";

import { useState } from "react";
import { seedDemoPlacesAction } from "@/lib/actions/seed";

export function DemoPlacesSeeder() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    if (
      !confirm(
        "¿Cargar 50 sitios de demostración mundiales y usuarios colaboradores?\n\nSe incorporarán restaurantes icónicos de España (Granada, Madrid, Barcelona, San Sebastián, Sevilla, Barbate...) y del mundo (Roma, Nápoles, París, Tokio, Bangkok, Buenos Aires, Ciudad de México, Lima...), junto con usuarios ficticios de la comunidad, opiniones y comentarios colaborativos."
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await seedDemoPlacesAction();
    setLoading(false);

    if (res.error) {
      setMessage(`❌ ${res.error}`);
    } else {
      setMessage(`✓ Catálogo actualizado con éxito (50 sitios y usuarios de la comunidad).`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }

  return (
    <div className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-xl">🌱</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Carga de Demostración Completa (50 sitios + Comunidad)
          </h3>
          <p className="text-xs text-slate-500">
            Genera 50 restaurantes reales mundiales y nacionales con usuarios colaboradores, hilos de comentarios, estados personales, favoritos y notas privadas.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {message && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={handleSeed}
          disabled={loading}
          className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
        >
          {loading ? "Cargando catálogo..." : "Cargar 50 sitios y usuarios"}
        </button>
      </div>
    </div>
  );
}
