"use client";

import { useState, useEffect } from "react";
import { getUserStatsAction, type UserStatsData, type CountItem } from "@/lib/actions/stats";
import { useT } from "@/lib/i18n/client";
import { OccasionIcon } from "@/components/ui/OccasionIcon";

interface StatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  username: string;
}

function MiniBarList({
  title,
  icon,
  items,
  prefix = "",
  topBarClass = "bg-orange-600",
  restBarClass = "bg-orange-300 dark:bg-orange-500/50",
  topLabelClass = "text-orange-700 dark:text-orange-400",
  footerBadge,
}: {
  title: string;
  icon?: string;
  items: CountItem[];
  prefix?: string;
  topBarClass?: string;
  restBarClass?: string;
  topLabelClass?: string;
  footerBadge?: { label: string; value: string };
}) {
  if (items.length === 0) return null;
  const max = Math.max(...items.map((i) => i.count), 1);

  return (
    <div className="p-4 rounded-2xl bg-[#f4f5ff]/80 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800 flex flex-col justify-between gap-3">
      <div className="space-y-2.5">
        <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
          {icon && (
            <span className="material-symbols-outlined text-sm text-orange-600 leading-none">
              {icon}
            </span>
          )}
          <span>{title}</span>
        </h4>
        <div className="space-y-2">
          {items.map((item, idx) => {
            const isTop = idx === 0;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`truncate inline-flex items-center gap-1 ${
                      isTop
                        ? `font-bold ${topLabelClass}`
                        : "font-medium text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    {item.icon && <OccasionIcon icon={item.icon} msClassName="text-[14px]" />}
                    <span className="truncate">
                      {prefix}
                      {item.label}
                    </span>
                  </span>
                  <span className="text-[11px] font-bold text-slate-800 dark:text-slate-200 shrink-0 ml-2">
                    {item.count}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      isTop ? topBarClass : restBarClass
                    }`}
                    style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {footerBadge && (
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-800 flex items-center justify-between text-[11px]">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            {footerBadge.label}
          </span>
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100/80 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-bold">
            {footerBadge.value}
          </span>
        </div>
      )}
    </div>
  );
}

export function StatsModal({ isOpen, onClose, username }: StatsModalProps) {
  const { t } = useT();
  const [activeTab, setActiveTab] = useState<"overview" | "wrapped">("overview");
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [stats, setStats] = useState<UserStatsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [shareFeedback, setShareFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      getUserStatsAction(selectedYear)
        .then(setStats)
        .finally(() => setLoading(false));
    }
  }, [isOpen, selectedYear]);

  if (!isOpen) return null;

  const predominantPrice =
    stats && stats.priceDistribution.length > 0
      ? [...stats.priceDistribution].sort((a, b) => b.count - a.count)[0]
      : null;

  function buildShareText() {
    if (!stats) return "";
    const w = stats.wrapped;
    const lines = [
      `🍽️ Mi GastroMap Wrapped ${w.year} (@${username})`,
      `✅ ${w.uniquePlacesVisited} sitios probados • ⭐ ${w.favoritesCount} favoritos • 📍 ${w.placesAdded} añadidos • 💬 ${w.commentsPosted} comentarios`,
      w.topCity ? `🏙️ Ciudad estrella: ${w.topCity}` : "",
      w.topOccasion ? `🎯 Plan predilecto: ${w.topOccasion.name} (${w.topOccasion.count} locales)` : "",
      w.topTag ? `🏷️ Especialidad: #${w.topTag.name}` : "",
    ].filter(Boolean);
    return lines.join("\n");
  }

  async function handleShareWrapped() {
    const text = buildShareText();
    if (!text) return;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: `GastroMap Wrapped ${selectedYear}`,
          text,
        });
      } else if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShareFeedback("Resumen copiado al portapapeles");
        setTimeout(() => setShareFeedback(null), 2500);
      }
    } catch {
      // Usuario canceló compartir
    }
  }

  function handleDownloadCard() {
    if (!stats || typeof document === "undefined") return;
    const w = stats.wrapped;
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 680;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Fondo degradado naranja oficial GastroMap
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, "#ea580c");
    grad.addColorStop(0.55, "#c2410c");
    grad.addColorStop(1, "#7c2d12");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Encabezado
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText(`GASTROMAP WRAPPED  •  #Gastro${w.year}`, 56, 76);

    ctx.fillStyle = "#ffffff";
    ctx.font = "900 50px sans-serif";
    ctx.fillText(`Tu año gastronómico ${w.year}`, 56, 146);

    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.font = "500 22px sans-serif";
    ctx.fillText("Exploración épica, bocados memorables y nuevos horizontes culinarios.", 56, 188);

    // 4 KPIs
    const kpis = [
      { value: String(w.uniquePlacesVisited), label: t("stats.wrapped_tested") },
      { value: `${w.favoritesCount} ★`, label: t("stats.wrapped_favorites") },
      { value: String(w.placesAdded), label: t("stats.wrapped_added") },
      { value: String(w.commentsPosted), label: t("stats.wrapped_comments") },
    ];
    kpis.forEach((k, i) => {
      const x = 56 + i * 246;
      const y = 232;
      ctx.fillStyle = "rgba(255,255,255,0.16)";
      ctx.beginPath();
      ctx.roundRect(x, y, 228, 130, 22);
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = "900 46px sans-serif";
      ctx.fillText(k.value, x + 24, y + 72);

      ctx.fillStyle = "rgba(255,255,255,0.88)";
      ctx.font = "600 18px sans-serif";
      ctx.fillText(k.label, x + 24, y + 106);
    });

    // 3 Tarjetas destacadas
    const cards = [
      {
        eyebrow: "CIUDAD ESTRELLA",
        title: w.topCity || "—",
        sub: "Donde más has explorado",
      },
      {
        eyebrow: "PLAN PREDILECTO",
        title: w.topOccasion ? w.topOccasion.name : "—",
        sub: w.topOccasion ? `${w.topOccasion.count} locales` : "Sin datos",
      },
      {
        eyebrow: "ESPECIALIDAD",
        title: w.topTag ? `#${w.topTag.name}` : "—",
        sub: w.topTag ? `Repetida en ${w.topTag.count} locales` : "Sin datos",
      },
    ];
    cards.forEach((c, i) => {
      const x = 56 + i * 330;
      const y = 398;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.roundRect(x, y, 310, 170, 22);
      ctx.fill();

      ctx.fillStyle = "#ea580c";
      ctx.font = "800 15px sans-serif";
      ctx.fillText(c.eyebrow, x + 24, y + 42);

      ctx.fillStyle = "#0f172a";
      ctx.font = "900 30px sans-serif";
      ctx.fillText(c.title.slice(0, 18), x + 24, y + 96);

      ctx.fillStyle = "#64748b";
      ctx.font = "500 17px sans-serif";
      ctx.fillText(c.sub, x + 24, y + 134);
    });

    // Pie
    ctx.fillStyle = "rgba(255,255,255,0.82)";
    ctx.font = "600 18px sans-serif";
    ctx.fillText(`GastroMap ${w.year}  •  @${username}`, 56, 628);

    const link = document.createElement("a");
    link.download = `gastromap-wrapped-${w.year}-${username}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[92vh] overflow-hidden">
        {/* Cabecera estilo Stitch */}
        <div className="px-5 sm:px-6 pt-5 pb-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">bar_chart</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                  {t("stats.title")}
                </h3>
                {activeTab === "wrapped" && (
                  <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300 text-[10px] font-extrabold">
                    {selectedYear}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                @{username}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer"
            aria-label="Cerrar estadísticas"
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Pestañas segmentadas estilo Stitch */}
        <div className="px-5 sm:px-6 pb-3 shrink-0">
          <div className="grid grid-cols-2 p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/60 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={`py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "overview"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">bar_chart</span>
              <span>{t("stats.overview_tab").replace(/^[^\p{L}\p{N}]+/u, "")}</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("wrapped")}
              className={`py-2 rounded-full text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === "wrapped"
                  ? "bg-orange-600 text-white shadow-sm"
                  : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              <span className="material-symbols-outlined text-sm leading-none">featured_seasonal_and_gifts</span>
              <span>{t("stats.wrapped_tab", { year: selectedYear }).replace(/^[^\p{L}\p{N}]+/u, "")}</span>
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="px-5 sm:px-6 pb-6 pt-1 overflow-y-auto flex-1 space-y-4">
          {loading || !stats ? (
            <p className="text-xs text-slate-400 text-center py-12">{t("common.loading")}</p>
          ) : activeTab === "overview" ? (
            <>
              {/* 4 KPIs principales estilo Stitch */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl bg-[#f4f5ff] dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs leading-none">check_circle</span>
                    <span>{t("cards.visited")}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-emerald-700 dark:text-emerald-400 mt-1.5">
                    {stats.visitedCount}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f4f5ff] dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-700 dark:text-amber-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs leading-none">star</span>
                    <span>{t("places.favorites")}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-amber-700 dark:text-amber-400 mt-1.5">
                    {stats.favoritesCount}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f4f5ff] dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600 dark:text-orange-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs leading-none">schedule</span>
                    <span>{t("places.want_to_go")}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-orange-600 dark:text-orange-400 mt-1.5">
                    {stats.pendingCount}
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#f4f5ff] dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs leading-none">emoji_events</span>
                    <span>{t("ui.avg_rating")}</span>
                  </div>
                  <div className="text-3xl sm:text-4xl font-black text-slate-700 dark:text-slate-200 mt-1.5">
                    {stats.averageRating !== null ? `${stats.averageRating}` : "—"}
                    {stats.averageRating !== null && (
                      <span className="text-sm font-bold text-slate-400">/10</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Franja resumen secundaria */}
              <div className="px-4 py-3 rounded-2xl bg-[#f4f5ff] dark:bg-slate-800/50 border border-slate-200/50 dark:border-slate-800 flex items-center justify-around flex-wrap gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-orange-600">restaurant</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                    {stats.contributedPlacesCount}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {t("stats.contributed")}
                  </span>
                </div>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-slate-600 dark:text-slate-400">chat_bubble</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                    {stats.commentsCount}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {t("stats.comments")}
                  </span>
                </div>
                <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
                <div className="flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-base text-emerald-600">location_city</span>
                  <span className="font-black text-slate-900 dark:text-slate-100 text-sm">
                    {stats.topCities.length}
                  </span>
                  <span className="text-slate-500 dark:text-slate-400 font-medium">
                    {t("stats.cities_count")}
                  </span>
                </div>
              </div>

              {/* Gráficas 2x2 estilo Stitch */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <MiniBarList
                  title={t("stats.top_cities")}
                  icon="location_city"
                  items={stats.topCities}
                  topBarClass="bg-orange-600"
                  restBarClass="bg-orange-300 dark:bg-orange-500/40"
                  topLabelClass="text-orange-700 dark:text-orange-400"
                />
                <MiniBarList
                  title={t("stats.top_occasions")}
                  icon="restaurant"
                  items={stats.topOccasions}
                  topBarClass="bg-amber-500"
                  restBarClass="bg-amber-200 dark:bg-amber-500/40"
                  topLabelClass="text-amber-700 dark:text-amber-400"
                />
                <MiniBarList
                  title={t("stats.price_distribution")}
                  icon="payments"
                  items={stats.priceDistribution}
                  topBarClass="bg-emerald-700"
                  restBarClass="bg-emerald-400/70 dark:bg-emerald-500/40"
                  topLabelClass="text-emerald-700 dark:text-emerald-400"
                  footerBadge={
                    predominantPrice
                      ? { label: t("ui.predominant_range"), value: predominantPrice.label }
                      : undefined
                  }
                />
                <MiniBarList
                  title={t("stats.top_tags")}
                  icon="sell"
                  items={stats.topTags}
                  prefix="#"
                  topBarClass="bg-orange-600"
                  restBarClass="bg-orange-300 dark:bg-orange-500/40"
                  topLabelClass="text-orange-700 dark:text-orange-400"
                />
              </div>
            </>
          ) : (
            /* Pestaña Wrapped Anual estilo Stitch */
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                  {t("ui.choose_year")}
                </span>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3.5 py-1.5 rounded-full text-xs font-extrabold bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-slate-100 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500/40"
                >
                  {stats.wrapped.availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tarjeta principal Wrapped */}
              <div className="relative overflow-hidden p-5 sm:p-6 rounded-3xl bg-gradient-to-br from-[#ea580c] via-[#c2410c] to-[#7c2d12] text-white shadow-xl space-y-5">
                {/* Marca de agua decorativa */}
                <span
                  aria-hidden="true"
                  className="material-symbols-outlined pointer-events-none select-none absolute -top-2 right-4 text-[110px] text-white/10"
                >
                  restaurant
                </span>

                <div className="relative flex items-start justify-between gap-2">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/15 backdrop-blur-xs text-[10px] font-black uppercase tracking-widest">
                      <span className="material-symbols-outlined text-xs leading-none">restaurant</span>
                      <span>GastroMap Wrapped</span>
                    </span>
                    <h4 className="text-2xl sm:text-3xl font-black tracking-tight leading-tight">
                      {t("ui.wrapped_year_title", { year: stats.wrapped.year })}
                    </h4>
                    <p className="text-xs text-white/80 font-medium">
                      {t("ui.wrapped_year_subtitle")}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-white/70 shrink-0">
                    #Gastro{stats.wrapped.year}
                  </span>
                </div>

                {/* 4 KPIs translúcidos */}
                <div className="relative grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-xs text-center">
                    <div className="text-3xl font-black leading-none">
                      {stats.wrapped.uniquePlacesVisited}
                    </div>
                    <div className="text-[11px] font-semibold text-white/85 mt-1.5">
                      {t("stats.wrapped_tested")}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-xs text-center">
                    <div className="text-3xl font-black leading-none flex items-center justify-center gap-1">
                      <span>{stats.wrapped.favoritesCount}</span>
                      <span className="text-amber-300 text-lg">★</span>
                    </div>
                    <div className="text-[11px] font-semibold text-white/85 mt-1.5">
                      {t("stats.wrapped_favorites")}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-xs text-center">
                    <div className="text-3xl font-black leading-none">
                      {stats.wrapped.placesAdded}
                    </div>
                    <div className="text-[11px] font-semibold text-white/85 mt-1.5">
                      {t("stats.wrapped_added")}
                    </div>
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white/15 backdrop-blur-xs text-center">
                    <div className="text-3xl font-black leading-none">
                      {stats.wrapped.commentsPosted}
                    </div>
                    <div className="text-[11px] font-semibold text-white/85 mt-1.5">
                      {t("stats.wrapped_comments")}
                    </div>
                  </div>
                </div>

                {/* Tarjetas blancas destacadas */}
                <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                  {stats.wrapped.topCity && (
                    <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-orange-600">
                          Ciudad estrella
                        </span>
                        <span className="material-symbols-outlined text-sm text-orange-500">location_on</span>
                      </div>
                      <div className="font-black text-base mt-1 truncate">
                        {stats.wrapped.topCity}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Donde más has explorado
                      </div>
                    </div>
                  )}

                  {stats.wrapped.topOccasion && (
                    <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-amber-600">
                          Plan predilecto
                        </span>
                        <OccasionIcon icon={stats.wrapped.topOccasion.icon} className="text-sm" msClassName="text-base" />
                      </div>
                      <div className="font-black text-base mt-1 truncate">
                        {stats.wrapped.topOccasion.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        {stats.wrapped.topOccasion.count} locales visitados
                      </div>
                    </div>
                  )}

                  {stats.wrapped.topTag && (
                    <div className="p-3.5 rounded-2xl bg-white text-slate-900 shadow-sm">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                          Especialidad
                        </span>
                        <span className="text-emerald-600 font-black text-xs">#</span>
                      </div>
                      <div className="font-black text-base mt-1 truncate">
                        #{stats.wrapped.topTag.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Repetida en {stats.wrapped.topTag.count} locales
                      </div>
                    </div>
                  )}

                  {stats.wrapped.topRatedPlace && (
                    <div className="sm:col-span-3 p-3.5 rounded-2xl bg-white/95 text-slate-900 shadow-sm flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="inline-flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-orange-600">
                          <span className="material-symbols-outlined text-xs leading-none">emoji_events</span>
                          <span>Tu favorito del año</span>
                        </div>
                        <div className="font-black text-sm mt-0.5 truncate">
                          {stats.wrapped.topRatedPlace.name}
                        </div>
                      </div>
                      <div className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 shrink-0">
                        <span>{stats.wrapped.topRatedPlace.city || "—"} •</span>
                        <span className="material-symbols-outlined text-xs text-amber-500 leading-none">star</span>
                        <span>{stats.wrapped.topRatedPlace.rating}/10</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Pie de tarjeta */}
                <div className="relative pt-1 flex items-center justify-between gap-2 text-[11px] text-white/75 font-medium">
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    GastroMap {stats.wrapped.year}
                  </span>
                  <span className="italic">@{username}</span>
                </div>
              </div>

              {/* Acciones inferiores: Descargar tarjeta + Compartir resumen */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="material-symbols-outlined text-base text-emerald-600">verified</span>
                    <span>
                      {shareFeedback || t("ui.auto_generated_wrapped")}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleDownloadCard}
                      className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base leading-none">download</span>
                      <span>{t("ui.download_card")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleShareWrapped}
                      className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base leading-none">share</span>
                      <span>{t("ui.share_summary")}</span>
                    </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
