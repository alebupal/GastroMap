"use client";

import { useState, useMemo } from "react";
import { getOccasions, getTagsWithCount } from "@/lib/actions/taxonomy";
import type { AdminGroupOverviewItem } from "@/lib/actions/groups";
import type { Occasion } from "@/db/schema";
import { TaxonomyManager } from "./TaxonomyManager";
import { normalizeSearchText } from "@/lib/search";
import { useT } from "@/lib/i18n/client";

interface AdminTaxonomyWorkspaceProps {
  groups: AdminGroupOverviewItem[];
  personalPlacesCount: number;
  initialSpaceId: string; // '<groupId>' | 'personal'
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: Array<{ id: string; name: string; placesCount: number }>;
}

export function AdminTaxonomyWorkspace({
  groups,
  personalPlacesCount,
  initialSpaceId,
  initialOccasions,
  initialTags,
}: AdminTaxonomyWorkspaceProps) {
  const { t } = useT();
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(initialSpaceId);
  const [occasionsList, setOccasionsList] = useState(initialOccasions);
  const [tagsList, setTagsList] = useState(initialTags);
  const [loadingSpace, setLoadingSpace] = useState(false);
  const [groupQuery, setGroupQuery] = useState("");

  const spaceCards = useMemo(() => {
    const list = [
      ...groups.map((g) => ({
        id: g.id,
        name: g.name,
        icon: g.icon || "🍻",
        subtitle: `@${g.ownerUsername || g.ownerName} · ${g.membersCount} ${t("spaces.members_short")}`,
        placesCount: g.placesCount,
        isPersonal: false,
      })),
      {
        id: "personal",
        name: t("spaces.personal_map"),
        icon: "🏠",
        subtitle: t("spaces.personal_subtitle"),
        placesCount: personalPlacesCount,
        isPersonal: true,
      },
    ];

    const q = normalizeSearchText(groupQuery);
    if (!q) return list;
    return list.filter((item) =>
      normalizeSearchText(`${item.name} ${item.subtitle}`).includes(q)
    );
  }, [groups, personalPlacesCount, groupQuery, t]);

  const activeSpaceMeta = useMemo(() => {
    if (selectedSpaceId === "personal") {
      return { name: t("spaces.personal_map"), icon: "🏠" };
    }
    const g = groups.find((x) => x.id === selectedSpaceId);
    return g ? { name: g.name, icon: g.icon || "🍻" } : { name: "Grupo", icon: "🍻" };
  }, [selectedSpaceId, groups, t]);

  async function reloadSpaceTaxonomy(spaceId: string) {
    const targetGroupId = spaceId === "personal" ? null : spaceId;
    const [occs, tgs] = await Promise.all([
      getOccasions(targetGroupId),
      getTagsWithCount(targetGroupId),
    ]);
    setOccasionsList(occs);
    setTagsList(tgs);
  }

  async function handleSelectSpace(spaceId: string) {
    if (spaceId === selectedSpaceId && !loadingSpace) return;
    setSelectedSpaceId(spaceId);
    setLoadingSpace(true);
    try {
      await reloadSpaceTaxonomy(spaceId);
    } finally {
      setLoadingSpace(false);
    }
  }

  const explicitGroupId = selectedSpaceId === "personal" ? null : selectedSpaceId;

  return (
    <div className="w-full space-y-5 text-left">
      {/* Selector visual de Grupo / Espacio */}
      <div className="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/70 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl leading-none">workspaces</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {t("admin_taxonomy.space_selector_title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("admin_taxonomy.space_selector_desc")}
              </p>
            </div>
          </div>

          {groups.length > 3 && (
            <div className="relative sm:w-64">
              <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                search
              </span>
              <input
                type="text"
                value={groupQuery}
                onChange={(e) => setGroupQuery(e.target.value)}
                placeholder={t("admin_places.search_space_placeholder")}
                className="w-full pl-9 pr-8 py-2 rounded-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {groupQuery && (
                <button
                  type="button"
                  onClick={() => setGroupQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
          )}
        </div>

        {/* Tarjetas visuales de espacios */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {spaceCards.map((sp) => {
            const active = sp.id === selectedSpaceId;
            return (
              <button
                key={sp.id}
                type="button"
                onClick={() => handleSelectSpace(sp.id)}
                className={`p-3 rounded-2xl border text-left transition flex items-center justify-between gap-2.5 cursor-pointer ${
                  active
                    ? "bg-orange-50 dark:bg-orange-950/40 border-orange-500 ring-2 ring-orange-500/20 shadow-xs"
                    : "bg-[#f8f9ff] dark:bg-slate-800/50 border-slate-200/80 dark:border-slate-800 hover:border-orange-300 dark:hover:border-slate-700"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shrink-0 ${
                      active
                        ? "bg-orange-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700"
                    }`}
                  >
                    {sp.icon}
                  </div>
                  <div className="min-w-0">
                    <div className="font-extrabold text-xs text-slate-900 dark:text-slate-100 truncate">
                      {sp.name}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      {sp.subtitle}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
                      active
                        ? "bg-orange-600 text-white"
                        : "bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 border border-slate-200/70 dark:border-slate-700"
                    }`}
                  >
                    🍽️ {sp.placesCount}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        {/* Cinta informativa del espacio en edición */}
        <div className="px-3.5 py-2.5 rounded-xl bg-[#f2f3ff] dark:bg-slate-800/70 border border-slate-200/70 dark:border-slate-700/70 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-200">
            <span>{activeSpaceMeta.icon}</span>
            <span>
              {t("admin_taxonomy.editing_space_banner", { name: activeSpaceMeta.name })}
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-600 dark:text-slate-300">
            {loadingSpace ? (
              <span className="text-orange-600 dark:text-orange-400 animate-pulse">
                {t("common.loading")}
              </span>
            ) : (
              <>
                <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700">
                  {occasionsList.length} {t("admin_taxonomy.title_occasions")}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-700">
                  {tagsList.length} {t("admin_taxonomy.title_tags")}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Gestores aislados del espacio elegido */}
      <div className={loadingSpace ? "opacity-50 pointer-events-none transition" : "space-y-5 transition"}>
        <TaxonomyManager
          key={`occasions-${selectedSpaceId}`}
          section="occasions"
          defaultOpen={true}
          explicitGroupId={explicitGroupId}
          initialOccasions={occasionsList}
          initialTags={tagsList}
          onChanged={() => reloadSpaceTaxonomy(selectedSpaceId)}
        />
        <TaxonomyManager
          key={`tags-${selectedSpaceId}`}
          section="tags"
          defaultOpen={true}
          explicitGroupId={explicitGroupId}
          initialOccasions={occasionsList}
          initialTags={tagsList}
          onChanged={() => reloadSpaceTaxonomy(selectedSpaceId)}
        />
      </div>
    </div>
  );
}
