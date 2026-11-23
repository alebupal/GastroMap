"use client";

import { useState } from "react";
import { seedDemoPlacesAction, deleteDemoPlacesAction } from "@/lib/actions/seed";
import { useT } from "@/lib/i18n/client";

interface DemoPlacesSeederProps {
  totalPlacesCount?: number;
  totalOccasionsCount?: number;
  totalTagsCount?: number;
}

export function DemoPlacesSeeder({
  totalPlacesCount = 0,
  totalOccasionsCount = 0,
  totalTagsCount = 0,
}: DemoPlacesSeederProps) {
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
    if (!confirm(t("admin_demo.delete_confirm"))) {
      return;
    }

    setLoading(true);
    setMessage(null);

    const res = await deleteDemoPlacesAction();
    setLoading(false);

    if (res.error) {
      setMessage(`❌ ${res.error}`);
    } else {
      setMessage(t("admin_demo.delete_success", { count: res.count ?? 0 }));
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    }
  }

  return (
    <div className="space-y-6 text-left">
      {/* Cabecera estilo Stitch */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-400">
            <span className="material-symbols-outlined text-sm leading-none">science</span>
            Catálogo &amp; Ambientes de Prueba
          </span>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight mt-1">
            Datos de Demostración y Pruebas
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Población rápida y reseteo de datos de catálogo para pruebas de desarrollo, geolocalización e indexado culinario.
          </p>
        </div>

        <span className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 text-xs font-bold text-slate-700 dark:text-slate-300 shrink-0 self-start sm:self-auto">
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          Base de Datos: Sincronizada
        </span>
      </div>

      {/* Tarjeta principal del generador */}
      <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200/60 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-2xl">eco</span>
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
                {t("admin_demo.title")}
              </h3>
              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-[10px] font-bold">
                Semilla Demo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
              {t("admin_demo.desc")}
            </p>
            {message && (
              <p className="mt-2 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={handleSeed}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold rounded-full bg-emerald-700 hover:bg-emerald-800 text-white transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <span className="material-symbols-outlined text-base leading-none">download</span>
            <span>{loading ? t("admin_demo.seeding") : t("admin_demo.seed_btn")}</span>
          </button>

          <button
            type="button"
            onClick={handleDeleteDemo}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 text-xs font-bold rounded-full bg-rose-700 hover:bg-rose-800 text-white transition active:scale-95 cursor-pointer disabled:opacity-50 shadow-sm"
            title={t("admin_demo.delete_title")}
          >
            <span className="material-symbols-outlined text-base leading-none">delete</span>
            <span>{t("admin_demo.delete_btn")}</span>
          </button>
        </div>
      </div>

      {/* Información del paquete y validación */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Paquete Pre-configurado
              </span>
              <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100 mt-0.5">
                Pack España &amp; Mundo Gastro
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Restaurantes icónicos con coordenadas verificadas, etiquetas temáticas, ocasiones, usuarios de prueba y reseñas colaborativas.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] font-bold shrink-0">
              GeoJSON + Metadata
            </span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-sm text-orange-600">restaurant</span>
              {totalPlacesCount} Sitios en catálogo
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-sm text-amber-600">category</span>
              {totalOccasionsCount} Planes / Categorías
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-xs font-bold text-slate-700 dark:text-slate-200">
              <span className="material-symbols-outlined text-sm text-emerald-600">sell</span>
              {totalTagsCount} Etiquetas
            </span>
          </div>
        </div>

        <div className="rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 p-5 sm:p-6 shadow-xs space-y-3">
          <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <span className="material-symbols-outlined text-sm text-emerald-600">verified</span>
            Integridad de Datos
          </span>
          <h4 className="text-base font-extrabold text-slate-900 dark:text-slate-100">
            Validación de Coordenadas
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Todos los puntos de interés cuentan con GeoPoint WGS84 verificado en PostGIS para navegación GPS, búsqueda por proximidad y soporte offline en la PWA.
          </p>
        </div>
      </div>
    </div>
  );
}
