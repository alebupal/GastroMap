"use client";

import { useT } from "@/lib/i18n/client";

interface DecisionAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  occasions: Array<{ id: string; name: string; icon: string }>;
  selectedOccasions: string[];
  onSelectOccasions: (occs: string[]) => void;
  selectedPrice: string | null;
  onSelectPrice: (price: string | null) => void;
  experienceFilter: "all" | "visited_by_me" | "visited_by_others" | "untried" | "favorite" | "pending";
  onSelectExperience: (exp: "all" | "visited_by_me" | "visited_by_others" | "untried" | "favorite" | "pending") => void;
  nearMeActive: boolean;
  onToggleNearMe: () => void;
  radiusKm: number;
  onChangeRadius: (km: number) => void;
  onReset: () => void;
}

export function DecisionAssistantModal({
  isOpen,
  onClose,
  occasions,
  selectedOccasions,
  onSelectOccasions,
  selectedPrice,
  onSelectPrice,
  experienceFilter,
  onSelectExperience,
  nearMeActive,
  onToggleNearMe,
  radiusKm,
  onChangeRadius,
  onReset,
}: DecisionAssistantModalProps) {
  const { t } = useT();
  if (!isOpen) return null;

  function toggleOccasion(id: string) {
    if (selectedOccasions.includes(id)) {
      onSelectOccasions(selectedOccasions.filter((o) => o !== id));
    } else {
      onSelectOccasions([...selectedOccasions, id]);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col text-left max-h-[90vh] overflow-y-auto">
        {/* Cabecera */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🎯</span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {t("assistant.title")}
              </h3>
              <p className="text-xs text-slate-400">
                {t("assistant.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* 1. ¿Qué plan te apetece hoy? */}
        <div className="mt-4">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
            {t("assistant.step1_title")}
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {occasions.map((occ) => {
              const active = selectedOccasions.includes(occ.id);
              return (
                <button
                  key={occ.id}
                  type="button"
                  onClick={() => toggleOccasion(occ.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex items-center gap-2 transition cursor-pointer ${active
                    ? "bg-amber-500/10 border-amber-500 text-amber-500 font-bold dark:bg-amber-950/40"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                >
                  <span className="text-base">{occ.icon}</span>
                  <span className="truncate">{occ.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Rango de precio */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
            {t("assistant.step2_title")}
          </label>
          <div className="flex gap-2">
            {[
              { id: "€", label: "< 15 €" },
              { id: "€€", label: "15 - 30 €" },
              { id: "€€€", label: "30 - 50 €" },
              { id: "€€€€", label: "> 50 €" },
            ].map((p) => {
              const active = selectedPrice === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelectPrice(active ? null : p.id)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${active
                    ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                    : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                    }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 mt-1 italic">
            {t("assistant.step2_hint")}
          </p>
        </div>

        {/* 3. Localización */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
            {t("assistant.step3_title")}
          </label>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleNearMe}
              className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition cursor-pointer ${nearMeActive
                ? "bg-blue-600 border-blue-600 text-white"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
            >
              <span>📍</span>
              <span>{nearMeActive ? t("assistant.step3_active") : t("assistant.step3_inactive")}</span>
            </button>

            {nearMeActive && (
              <select
                value={radiusKm}
                onChange={(e) => onChangeRadius(Number(e.target.value))}
                className="py-2 px-3 rounded-xl text-xs font-semibold bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200"
              >
                <option value={1}>1 km</option>
                <option value={5}>5 km</option>
                <option value={10}>10 km</option>
                <option value={25}>25 km</option>
              </select>
            )}
          </div>
        </div>

        {/* 4. Experiencia y Novedades del grupo */}
        <div className="mt-5">
          <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 block mb-2">
            {t("assistant.step4_title")}
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              type="button"
              onClick={() => onSelectExperience(experienceFilter === "untried" ? "all" : "untried")}
              className={`p-2.5 rounded-xl border font-semibold flex items-center gap-1.5 transition cursor-pointer ${experienceFilter === "untried"
                ? "bg-violet-600 border-violet-600 text-white shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
            >
              <span>✨</span>
              <span>{t("assistant.untried")}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectExperience(experienceFilter === "visited_by_others" ? "all" : "visited_by_others")}
              className={`p-2.5 rounded-xl border font-semibold flex items-center gap-1.5 transition cursor-pointer ${experienceFilter === "visited_by_others"
                ? "bg-cyan-600 border-cyan-600 text-white shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
            >
              <span>👥</span>
              <span>{t("assistant.friends")}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectExperience(experienceFilter === "visited_by_me" ? "all" : "visited_by_me")}
              className={`p-2.5 rounded-xl border font-semibold flex items-center gap-1.5 transition cursor-pointer ${experienceFilter === "visited_by_me"
                ? "bg-emerald-600 border-emerald-600 text-white shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
            >
              <span>✅</span>
              <span>{t("assistant.visited_by_me")}</span>
            </button>

            <button
              type="button"
              onClick={() => onSelectExperience(experienceFilter === "favorite" ? "all" : "favorite")}
              className={`p-2.5 rounded-xl border font-semibold flex items-center gap-1.5 transition cursor-pointer ${experienceFilter === "favorite"
                ? "bg-amber-500 border-amber-500 text-slate-950 font-bold shadow-sm"
                : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300"
                }`}
            >
              <span>⭐</span>
              <span>{t("assistant.favorites_only")}</span>
            </button>
          </div>
        </div>

        {/* Botones de acción */}
        <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onReset}
            className="py-2.5 px-4 rounded-xl text-xs font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
          >
            {t("assistant.reset")}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer shadow-md shadow-amber-500/20"
          >
            {t("assistant.view_results")}
          </button>
        </div>
      </div>
    </div>
  );
}
