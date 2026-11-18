"use client";

import { useState } from "react";
import { seedDemoPlacesAction } from "@/lib/actions/seed";

export function DemoPlacesSeeder() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSeed() {
    if (!confirm("¿Cargar 20 sitios de prueba reales (España y resto del mundo: Roma, Tokio, Nueva York, París, Nápoles...)?")) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await seedDemoPlacesAction();
    setLoading(false);

    if (res.error) {
      setMessage(`❌ ${res.error}`);
    } else {
      setMessage(`✓ ${res.count} sitios incorporados al catálogo.`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }

  return (
    <div className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🌱</span>
        <div>
          <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
            Sitios de Demostración Mundiales
          </h3>
          <p className="text-xs text-slate-500">
            Carga 20 restaurantes reales de España, Italia, Japón, EE. UU., Francia, etc.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {message && (
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            {message}
          </span>
        )}
        <button
          type="button"
          onClick={handleSeed}
          disabled={loading}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition active:scale-95 cursor-pointer disabled:opacity-50 shrink-0"
        >
          {loading ? "Cargando..." : "Cargar 20 sitios"}
        </button>
      </div>
    </div>
  );
}
