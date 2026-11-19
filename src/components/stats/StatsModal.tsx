"use client";

import { useState, useEffect } from "react";
import { getUserStatsAction, type UserStatsData, type CountItem } from "@/lib/actions/stats";
import { useT } from "@/lib/i18n/client";

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

function MiniBarList({
  title,
  items,
  prefix = "",
  colorClass = "bg-amber-500",
}: {
  title: string;
  items: CountItem[];
  prefix?: string;
  colorClass?: string;
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2">
      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        {title}
      </h4>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.label} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-700 dark:text-slate-200 truncate">
                {item.icon ? `${item.icon} ` : ""}
                {prefix}
                {item.label}
              </span>
              <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                {item.count}
              </span>
            </div>
            <div className="w-full h-1.5 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
              <div
                className={`h-full rounded-full ${colorClass}`}
                style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsModal({ isOpen, onClose, username }: StatsModalProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<"overview" | "wrapped">("overview");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getUserStatsAction(selectedYear)
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedYear]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">📊</span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {t("stats.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                @{username}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        {/* Pestañas */}
        <div className="px-5 pt-3 shrink-0">
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-slate-100 dark:bg-slate-800/80">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "overview"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("stats.overview_tab")}
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wrapped")}
              className={`py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                activeTab === "wrapped"
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 shadow-xs"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {t("stats.wrapped_tab", { year: selectedYear })}
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-5 overflow-y-auto flex-1 space-y-4">
          {loading || !stats ? (
            <p className="text-xs text-slate-400 text-center py-10">{t("common.loading")}</p>
          ) : activeTab === "overview" ? (
            <>
              {/* KPIs principales */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50">
                  <div className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
                    ✅ {t("cards.visited")}
                  </div>
                  <div className="text-2xl font-black text-emerald-900 dark:text-emerald-200 mt-0.5">
                    {stats.visitedCount}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50">
                  <div className="text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                    ⭐ {t("places.favorites")}
                  </div>
                  <div className="text-2xl font-black text-amber-900 dark:text-amber-200 mt-0.5">
                    {stats.favoritesCount}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/50">
                  <div className="text-[11px] font-semibold text-blue-700 dark:text-blue-400">
                    🕒 {t("places.want_to_go")}
                  </div>
                  <div className="text-2xl font-black text-blue-900 dark:text-blue-200 mt-0.5">
                    {stats.pendingCount}
                  </div>
                </div>

                <div className="p-3 rounded-2xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-900/50">
                  <div className="text-[11px] font-semibold text-violet-700 dark:text-violet-400">
                    🏆 Nota media
                  </div>
                  <div className="text-2xl font-black text-violet-900 dark:text-violet-200 mt-0.5">
                    {stats.averageRating !== null ? `${stats.averageRating}/10` : "—"}
                  </div>
                </div>
              </div>

              {/* KPIs secundarios */}
              <div className="grid grid-cols-3 gap-2.5 text-center">
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {stats.totalVisitsCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">📅 Visitas reg.</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {stats.contributedPlacesCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">🍽️ Aportados</div>
                </div>
                <div className="p-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800">
                  <div className="text-lg font-black text-slate-800 dark:text-slate-100">
                    {stats.commentsCount}
                  </div>
                  <div className="text-[10px] font-semibold text-slate-500">💬 Comentarios</div>
                </div>
              </div>

              {/* Gráficas de barras */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <MiniBarList
                  title={`🏙️ ${t("stats.top_cities")}`}
                  items={stats.topCities}
                  colorClass="bg-blue-500"
                />
                <MiniBarList
                  title={`🍽️ ${t("stats.top_occasions")}`}
                  items={stats.topOccasions}
                  colorClass="bg-amber-500"
                />
                <MiniBarList
                  title={`💶 ${t("stats.price_distribution")}`}
                  items={stats.priceDistribution}
                  colorClass="bg-emerald-500"
                />
                <MiniBarList
                  title={`🏷️ ${t("stats.top_tags")}`}
                  items={stats.topTags}
                  prefix="#"
                  colorClass="bg-violet-500"
                />
              </div>
            </>
          ) : (
            /* Pestaña Wrapped Anual */
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  Elige el año del resumen:
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-1.5 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                >
                  {stats.wrapped.availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="p-6 rounded-3xl bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-slate-950 shadow-xl space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[11px] font-black uppercase tracking-widest opacity-80">
                      GastroMap Wrapped
                    </div>
                    <h4 className="text-2xl font-black tracking-tight">
                      Tu año gastronómico {stats.wrapped.year}
                    </h4>
                  </div>
                  <span className="text-4xl">🍽️</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3 rounded-2xl bg-slate-950/15 backdrop-blur-xs">
                    <div className="text-2xl font-black">{stats.wrapped.uniquePlacesVisited}</div>
                    <div className="text-[11px] font-bold opacity-85">Sitios probados</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/15 backdrop-blur-xs">
                    <div className="text-2xl font-black">{stats.wrapped.visitsCount}</div>
                    <div className="text-[11px] font-bold opacity-85">Visitas con fecha</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/15 backdrop-blur-xs">
                    <div className="text-2xl font-black">{stats.wrapped.placesAdded}</div>
                    <div className="text-[11px] font-bold opacity-85">Sitios añadidos</div>
                  </div>
                  <div className="p-3 rounded-2xl bg-slate-950/15 backdrop-blur-xs">
                    <div className="text-2xl font-black">{stats.wrapped.commentsPosted}</div>
                    <div className="text-[11px] font-bold opacity-85">Comentarios</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  {stats.wrapped.topRatedPlace && (
                    <div className="p-3.5 rounded-2xl bg-white/90 text-slate-900 shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-wider text-amber-600">
                        🏆 Tu favorito del año
                      </div>
                      <div className="font-black text-sm mt-0.5">
                        {stats.wrapped.topRatedPlace.name}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {stats.wrapped.topRatedPlace.city || "—"} • ⭐{" "}
                        {stats.wrapped.topRatedPlace.rating}/10
                      </div>
                    </div>
                  )}

                  {stats.wrapped.topCity && (
                    <div className="p-3.5 rounded-2xl bg-white/90 text-slate-900 shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-wider text-blue-600">
                        🏙️ Ciudad estrella
                      </div>
                      <div className="font-black text-sm mt-0.5">{stats.wrapped.topCity}</div>
                      <div className="text-[11px] text-slate-600">Donde más has explorado</div>
                    </div>
                  )}

                  {stats.wrapped.topOccasion && (
                    <div className="p-3.5 rounded-2xl bg-white/90 text-slate-900 shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                        🎯 Tu plan predilecto
                      </div>
                      <div className="font-black text-sm mt-0.5">
                        {stats.wrapped.topOccasion.icon} {stats.wrapped.topOccasion.name}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {stats.wrapped.topOccasion.count} locales
                      </div>
                    </div>
                  )}

                  {stats.wrapped.topTag && (
                    <div className="p-3.5 rounded-2xl bg-white/90 text-slate-900 shadow-sm">
                      <div className="text-[10px] font-black uppercase tracking-wider text-violet-600">
                        🏷️ Especialidad estrella
                      </div>
                      <div className="font-black text-sm mt-0.5">
                        #{stats.wrapped.topTag.name}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        Repetida en {stats.wrapped.topTag.count} locales
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
