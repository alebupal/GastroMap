"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  getAllGroupsAdminAction,
  deleteGroupAction,
  switchActiveSpaceAction,
  type AdminGroupOverviewItem,
} from "@/lib/actions/groups";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { normalizeSearchText } from "@/lib/search";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";

type GroupSortField = "name" | "owner" | "membersCount" | "placesCount" | "createdAt";

export function AdminGroupsManager() {
  const { t, locale } = useT();
  const { toast } = useToast();
  const router = useRouter();

  const [groups, setGroups] = useState<AdminGroupOverviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<GroupSortField>("placesCount");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  async function loadGroups() {
    setLoading(true);
    try {
      const list = await getAllGroupsAdminAction();
      setGroups(list);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadGroups();
  }, []);

  function toggleSort(field: GroupSortField) {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(
        field === "membersCount" || field === "placesCount" || field === "createdAt"
          ? "desc"
          : "asc"
      );
    }
    setCurrentPage(1);
  }

  const filteredGroups = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    const base = !q
      ? [...groups]
      : groups.filter((g) => {
          const hay = normalizeSearchText(
            `${g.name} ${g.description || ""} ${g.ownerName} ${g.ownerUsername || ""}`
          );
          return hay.includes(q);
        });

    const dir = sortDir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      switch (sortField) {
        case "name":
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * dir;
        case "owner":
          return (
            (a.ownerUsername || a.ownerName).localeCompare(
              b.ownerUsername || b.ownerName,
              "es",
              { sensitivity: "base" }
            ) * dir
          );
        case "membersCount":
          return (a.membersCount - b.membersCount) * dir || a.name.localeCompare(b.name, "es");
        case "placesCount":
          return (a.placesCount - b.placesCount) * dir || a.name.localeCompare(b.name, "es");
        case "createdAt":
        default:
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
    });
  }, [groups, searchQuery, sortField, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedGroups = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredGroups.slice(start, start + pageSize);
  }, [filteredGroups, safePage, pageSize]);

  async function handleOpenExplorer(groupId: string) {
    setBusyId(groupId);
    const res = await switchActiveSpaceAction(`group:${groupId}`);
    setBusyId(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      router.push("/");
    }
  }

  async function handleDeleteGroup(group: AdminGroupOverviewItem) {
    if (
      !confirm(
        t("admin_groups.delete_confirm", {
          name: group.name,
          places: String(group.placesCount),
        })
      )
    ) {
      return;
    }

    setBusyId(group.id);
    const res = await deleteGroupAction(group.id);
    setBusyId(null);

    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      toast(t("admin_groups.delete_success", { name: group.name }), { kind: "success" });
    }
  }

  return (
    <div className="w-full space-y-4 text-left">
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl leading-none">diversity_3</span>
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                {t("admin_groups.title")} ({groups.length})
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("admin_groups.subtitle")}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-64">
              <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                search
              </span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder={t("admin_groups.search_placeholder")}
                className="w-full pl-9 pr-8 py-2 rounded-full text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={loadGroups}
              disabled={loading}
              className="inline-flex items-center gap-1 px-3 py-2 rounded-full text-xs font-bold bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer shrink-0"
            >
              <span className={`material-symbols-outlined text-sm leading-none ${loading ? "animate-spin" : ""}`}>
                refresh
              </span>
              <span className="hidden sm:inline">{t("admin_stats.refresh")}</span>
            </button>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="text-xs text-slate-400 text-center py-8">{t("common.loading")}</p>
      ) : paginatedGroups.length === 0 ? (
        <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 bg-white dark:bg-slate-900/40">
          {t("admin_groups.empty")}
        </div>
      ) : (
        <>
          {/* Vista móvil (< md) */}
          <div className="block md:hidden space-y-2.5">
            {paginatedGroups.map((g) => (
              <div
                key={`m-${g.id}`}
                className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 space-y-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="text-xl shrink-0">{g.icon || "🍻"}</span>
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                        {g.name}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        @{g.ownerUsername || g.ownerName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0 text-[11px] font-bold">
                    <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                      👥 {g.membersCount}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300">
                      🍽️ {g.placesCount}
                    </span>
                  </div>
                </div>

                {g.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2">
                    {g.description}
                  </p>
                )}

                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenExplorer(g.id)}
                    disabled={busyId === g.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-xs font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">map</span>
                    <span>{t("admin_groups.open_map")}</span>
                  </button>
                  <Link
                    href={`/group-admin?groupId=${encodeURIComponent(g.id)}`}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">tune</span>
                    <span>{t("admin_groups.manage_btn")}</span>
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDeleteGroup(g)}
                    disabled={busyId === g.id}
                    className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 cursor-pointer"
                    aria-label={t("common.delete")}
                  >
                    <span className="material-symbols-outlined text-sm leading-none block">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tabla escritorio (>= md) */}
          <div className="hidden md:block rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/40 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700 dark:text-slate-300">
                <thead className="bg-slate-50 dark:bg-slate-900/90 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider text-[10px]">
                  <tr>
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("name")}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                          sortField === "name" ? "text-orange-600 dark:text-orange-400" : ""
                        }`}
                      >
                        <span>{t("admin_groups.col_name")}</span>
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {sortField === "name"
                            ? sortDir === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("owner")}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                          sortField === "owner" ? "text-orange-600 dark:text-orange-400" : ""
                        }`}
                      >
                        <span>{t("admin_groups.col_owner")}</span>
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {sortField === "owner"
                            ? sortDir === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("membersCount")}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                          sortField === "membersCount" ? "text-orange-600 dark:text-orange-400" : ""
                        }`}
                      >
                        <span>{t("admin_groups.col_members")}</span>
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {sortField === "membersCount"
                            ? sortDir === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("placesCount")}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                          sortField === "placesCount" ? "text-orange-600 dark:text-orange-400" : ""
                        }`}
                      >
                        <span>{t("admin_groups.col_places")}</span>
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {sortField === "placesCount"
                            ? sortDir === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3">
                      <button
                        type="button"
                        onClick={() => toggleSort("createdAt")}
                        className={`inline-flex items-center gap-1 uppercase tracking-wider cursor-pointer hover:text-orange-600 transition ${
                          sortField === "createdAt" ? "text-orange-600 dark:text-orange-400" : ""
                        }`}
                      >
                        <span>{t("admin_groups.col_created")}</span>
                        <span className="material-symbols-outlined text-[14px] leading-none">
                          {sortField === "createdAt"
                            ? sortDir === "asc"
                              ? "arrow_upward"
                              : "arrow_downward"
                            : "unfold_more"}
                        </span>
                      </button>
                    </th>
                    <th className="p-3 text-right">{t("admin_places.col_action")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-medium">
                  {paginatedGroups.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="p-3 max-w-[260px]">
                        <div className="flex items-center gap-2">
                          <span className="text-base shrink-0">{g.icon || "🍻"}</span>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              {g.name}
                            </div>
                            {g.description && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                                {g.description}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-3 whitespace-nowrap text-slate-600 dark:text-slate-300">
                        @{g.ownerUsername || g.ownerName}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-[11px]">
                          {g.membersCount}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950/60 text-orange-800 dark:text-orange-300 font-bold text-[11px]">
                          {g.placesCount}
                        </span>
                      </td>
                      <td className="p-3 whitespace-nowrap text-[11px] text-slate-500 dark:text-slate-400">
                        {new Date(g.createdAt).toLocaleDateString(
                          locale === "en" ? "en-GB" : "es-ES",
                          { day: "2-digit", month: "short", year: "numeric" }
                        )}
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenExplorer(g.id)}
                            disabled={busyId === g.id}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold transition cursor-pointer"
                            title={t("admin_groups.open_map")}
                          >
                            <span className="material-symbols-outlined text-[14px] leading-none">map</span>
                            <span>{t("admin_groups.open_map")}</span>
                          </button>
                          <Link
                            href={`/group-admin?groupId=${encodeURIComponent(g.id)}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold transition"
                          >
                            <span className="material-symbols-outlined text-[14px] leading-none">tune</span>
                            <span>{t("admin_groups.manage_btn")}</span>
                          </Link>
                          <button
                            type="button"
                            onClick={() => handleDeleteGroup(g)}
                            disabled={busyId === g.id}
                            className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 transition cursor-pointer disabled:opacity-40"
                            title={t("common.delete")}
                            aria-label={t("common.delete")}
                          >
                            <span className="material-symbols-outlined text-[15px] leading-none block">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <PaginationBar
            currentPage={safePage}
            totalItems={filteredGroups.length}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
            itemLabel={t("admin_groups.item_label")}
          />
        </>
      )}
    </div>
  );
}
