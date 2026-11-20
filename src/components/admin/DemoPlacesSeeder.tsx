"use client";

import { useState } from "react";
import { seedDemoPlacesAction, deleteDemoPlacesAction } from "@/lib/actions/seed";
import { useT } from "@/lib/i18n/client";

export function DemoPlacesSeeder() {
  const { t } = useT();
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
      setMessage(`✓ ${t("admin_demo.success")}`);
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }

  async function handleDeleteDemo() {
    if (
      !confirm(
        "¿Borrar únicamente los datos de la demo?\n\nSe eliminarán los 50 establecimientos predefinidos, sus comentarios y usuarios de prueba. Los sitios, comentarios y grupos que tú hayas añadido manualmente se conservarán intactos."
      )
    ) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await deleteDemoPlacesAction();
    setLoading(false);

    if (res.error) {
      setMessage(`❌ ${res.error}`);
    } else {
      setMessage(`✓ Datos de la demo eliminados (${res.count} sitios borrados)`);
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
            {t("admin_demo.title")}
          </h3>
          <p className="text-xs text-slate-500">
            {t("admin_demo.desc")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 flex-wrap">
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
          {loading ? t("admin_demo.seeding") : t("admin_demo.seed_btn")}
        </button>

        <button
          type="button"
          onClick={handleDeleteDemo}
          disabled={loading}
          className="px-3.5 py-2 text-xs font-bold rounded-xl bg-red-600/90 hover:bg-red-700 text-white transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
          title="Borrar solo los 50 sitios y datos de la demo manteniendo tus propios sitios"
        >
          🗑️ Borrar demo
        </button>
      </div>
    </div>
  );
}
