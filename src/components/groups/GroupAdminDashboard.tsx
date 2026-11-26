"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  switchActiveSpaceAction,
  updateGroupSettingsAction,
  setGroupMemberRoleAction,
  addGroupMemberAction,
  removeGroupMemberAction,
  createGroupInviteAction,
  revokeGroupInviteAction,
  deleteGroupAction,
  getGroupJoinRequestsAction,
  decideGroupJoinRequestAction,
  updateGroupApiSettingsAction,
  getGroupApiUsageAction,
  type SharingGroupWithMembers,
  type GroupInviteItem,
  type GroupJoinRequestItem,
} from "@/lib/actions/groups";
import type { PlaceWithDetails } from "@/lib/actions/places";
import type { GroupStatsData } from "@/lib/actions/stats";
import type { Occasion } from "@/db/schema";
import { PlacesTableManager } from "@/components/admin/PlacesTableManager";
import { TaxonomyManager } from "@/components/admin/TaxonomyManager";
import { RoleLegendCard } from "@/components/admin/RoleLegendCard";
import { ExportImportModal } from "@/components/places/ExportImportModal";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { GastroMapIcon, GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { AnimatedNumber } from "@/components/ui/AnimatedNumber";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import { copyText } from "@/lib/clipboard";
import { APP_VERSION } from "@/lib/version";

type GroupAdminTab = "stats" | "places" | "members" | "taxonomy" | "settings";

const VALID_TABS: GroupAdminTab[] = ["stats", "places", "members", "taxonomy", "settings"];

const GROUP_ICONS = ["🍻", "🍷", "🍕", "🍔", "🍣", "🌮", "🥘", "☕", "🍰", "🌍", "🎉", "🔥"];

interface GroupAdminDashboardProps {
  group: SharingGroupWithMembers;
  adminGroups: Array<{ id: string; name: string; icon: string }>;
  places: PlaceWithDetails[];
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: Array<{ id: string; name: string; placesCount: number }>;
  stats: GroupStatsData | null;
  initialInvites: GroupInviteItem[];
  currentUser: {
    id: string;
    username: string | null;
    name: string;
    email: string;
    role: string;
  };
  initialTab?: string;
}

export function GroupAdminDashboard({
  group,
  adminGroups,
  places,
  initialOccasions,
  initialTags,
  stats,
  initialInvites,
  currentUser,
  initialTab,
}: GroupAdminDashboardProps) {
  const { t, locale } = useT();
  const { toast } = useToast();
  const router = useRouter();

  const resolvedInitialTab: GroupAdminTab =
    initialTab && VALID_TABS.includes(initialTab as GroupAdminTab)
      ? (initialTab as GroupAdminTab)
      : "stats";

  const [activeTab, setActiveTab] = useState<GroupAdminTab>(resolvedInitialTab);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Estado local de miembros e invitaciones
  const [members, setMembers] = useState(group.members);
  const [memberSortField, setMemberSortField] = useState<"name" | "role">("role");
  const [memberSortDir, setMemberSortDir] = useState<"asc" | "desc">("asc");
  const [newMemberUsername, setNewMemberUsername] = useState("");
  const [addingMember, setAddingMember] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const [invites, setInvites] = useState<GroupInviteItem[]>(initialInvites);
  const [inviteDays, setInviteDays] = useState<number>(7);
  const [inviteMaxUses, setInviteMaxUses] = useState<string>("");
  const [creatingInvite, setCreatingInvite] = useState(false);

  // Configuración del grupo
  const [groupName, setGroupName] = useState(group.name);
  const [groupIcon, setGroupIcon] = useState(group.icon || "🍻");
  const [groupDescription, setGroupDescription] = useState(group.description || "");
  const [requireJoinApproval, setRequireJoinApproval] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deletingGroup, setDeletingGroup] = useState(false);

  // Solicitudes de unión, API propia y Exportación
  const [joinRequests, setJoinRequests] = useState<GroupJoinRequestItem[]>([]);
  const [decidingReqId, setDecidingReqId] = useState<string | null>(null);
  const [groupApiKeyInput, setGroupApiKeyInput] = useState("");
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [apiUsage, setApiUsage] = useState<{
    period: string;
    requests: number;
    cacheHits: number;
    blocked: number;
    limit: number | null;
    hasOwnKey: boolean;
    maskedKey: string | null;
  } | null>(null);
  const [showExportGroupModal, setShowExportGroupModal] = useState(false);

  useEffect(() => {
    getGroupJoinRequestsAction(group.id).then(setJoinRequests);
    getGroupApiUsageAction(group.id).then((u) => {
      if (u) setApiUsage(u);
    });
  }, [group.id]);

  const canDeleteGroup = group.isOwner || currentUser.role === "admin";

  function selectTab(tab: GroupAdminTab) {
    setActiveTab(tab);
    setMobileMenuOpen(false);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }

  async function handleOpenGroupMap() {
    await switchActiveSpaceAction(`group:${group.id}`);
    router.push("/");
  }

  const sortedMembers = useMemo(() => {
    const dir = memberSortDir === "asc" ? 1 : -1;
    return [...members].sort((a, b) => {
      if (memberSortField === "role") {
        const ra = a.isOwner ? 0 : a.role === "admin" ? 1 : 2;
        const rb = b.isOwner ? 0 : b.role === "admin" ? 1 : 2;
        if (ra !== rb) return (ra - rb) * dir;
      }
      return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * dir;
    });
  }, [members, memberSortField, memberSortDir]);

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault();
    if (!newMemberUsername.trim() || addingMember) return;
    setAddingMember(true);
    const res = await addGroupMemberAction(group.id, newMemberUsername);
    setAddingMember(false);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      setNewMemberUsername("");
      toast(t("group_admin.member_added_toast"), { kind: "success" });
      router.refresh();
    }
  }

  async function handleChangeMemberRole(
    userId: string,
    nextRole: "owner" | "admin" | "member"
  ) {
    setBusyMemberId(userId);
    const res = await setGroupMemberRoleAction(group.id, userId, nextRole);
    setBusyMemberId(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      setMembers((prev) =>
        prev.map((m) => {
          if (nextRole === "owner") {
            return m.userId === userId
              ? { ...m, role: "admin", isOwner: true }
              : { ...m, isOwner: false };
          }
          if (m.userId === userId) {
            return { ...m, role: nextRole, isOwner: nextRole === "admin" ? m.isOwner : false };
          }
          return m;
        })
      );
      toast(t("group_admin.role_updated_toast"), { kind: "success" });
      router.refresh();
    }
  }

  async function handleRemoveMember(userId: string, name: string) {
    if (!confirm(t("group_admin.kick_confirm", { name }))) return;
    setBusyMemberId(userId);
    const res = await removeGroupMemberAction(group.id, userId);
    setBusyMemberId(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      toast(t("group_admin.member_removed_toast", { name }), { kind: "success" });
    }
  }

  async function handleCreateInvite() {
    setCreatingInvite(true);
    const parsedMax = inviteMaxUses.trim() ? parseInt(inviteMaxUses.trim(), 10) : null;
    const res = await createGroupInviteAction(
      group.id,
      inviteDays,
      parsedMax && parsedMax > 0 ? parsedMax : null
    );
    setCreatingInvite(false);
    if (res.error || !res.token) {
      toast(res.error || "Error", { kind: "error" });
    } else {
      const link =
        typeof window !== "undefined"
          ? `${window.location.origin}/groups/join/${res.token}`
          : `/groups/join/${res.token}`;
      await copyText(link);
      toast(t("group_admin.invite_copied_toast"), { kind: "success" });
      router.refresh();
      setInvites((prev) => [
        {
          id: res.token!,
          token: res.token!,
          groupId: group.id,
          expiresAt: new Date(
            Date.now() + (inviteDays <= 0 ? 365 * 50 : inviteDays) * 86400000
          ),
          usedCount: 0,
          maxUses: parsedMax && parsedMax > 0 ? parsedMax : null,
          neverExpires: inviteDays <= 0,
          createdAt: new Date(),
        },
        ...prev,
      ]);
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    const res = await revokeGroupInviteAction(inviteId);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      toast(t("group_admin.invite_revoked_toast"), { kind: "success" });
    }
  }

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    if (!groupName.trim() || savingSettings) return;
    setSavingSettings(true);
    const res = await updateGroupSettingsAction(group.id, {
      name: groupName,
      icon: groupIcon,
      description: groupDescription,
      requireJoinApproval,
    });
    setSavingSettings(false);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("group_admin.settings_saved_toast"), { kind: "success" });
      router.refresh();
    }
  }

  async function handleDeleteEntireGroup() {
    if (
      !confirm(
        t("admin_groups.delete_confirm", {
          name: group.name,
          places: String(places.length),
        })
      )
    ) {
      return;
    }
    setDeletingGroup(true);
    const res = await deleteGroupAction(group.id);
    setDeletingGroup(false);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("admin_groups.delete_success", { name: group.name }), { kind: "success" });
      router.push("/");
    }
  }

  const navItems: Array<{ id: GroupAdminTab; label: string; icon: string; badge?: number }> = [
    { id: "stats", label: t("group_admin.tab_stats"), icon: "analytics" },
    { id: "places", label: t("group_admin.tab_places"), icon: "storefront", badge: places.length },
    { id: "members", label: t("group_admin.tab_members"), icon: "group", badge: members.length },
    { id: "taxonomy", label: t("group_admin.tab_taxonomy"), icon: "sell" },
    { id: "settings", label: t("group_admin.tab_settings"), icon: "tune" },
  ];

  const sidebarContent = (
    <div className="flex flex-col h-full justify-between p-4 gap-4">
      <div className="space-y-5">
        <div className="flex items-center justify-between gap-2 px-1 pt-1">
          <Link href="/" className="flex items-center gap-2">
            <GastroMapLogo iconClassName="w-8 h-8" textClassName="text-base" />
          </Link>
          <button
            type="button"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-800 cursor-pointer"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        {/* Selector de grupo administrado */}
        <div className="p-3 rounded-2xl bg-white dark:bg-slate-950/70 border border-slate-200/80 dark:border-slate-800 space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xl shrink-0">{groupIcon}</span>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 truncate">
                {groupName}
              </div>
              <div className="text-[10px] font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">
                {t("group_admin.badge")}
              </div>
            </div>
          </div>

          {adminGroups.length > 1 && (
            <SearchableSelect
              value={group.id}
              onChange={(val) => {
                router.push(`/group-admin?groupId=${encodeURIComponent(val)}&tab=${activeTab}`);
              }}
              options={[...adminGroups]
                .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
                .map((ag) => ({
                  value: ag.id,
                  label: ag.name,
                  icon: <span>{ag.icon}</span>,
                }))}
              searchPlaceholder={t("admin_groups.search_placeholder")}
              ariaLabel={t("group_admin.switch_group")}
              className="w-full"
              buttonClassName="w-full justify-between !rounded-xl !py-1.5 !px-2.5 !text-xs bg-[#f8f9ff] dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200"
            />
          )}
        </div>

        <nav className="space-y-1">
          {navItems.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => selectTab(item.id)}
                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-xl text-xs transition cursor-pointer ${
                  active
                    ? "bg-orange-600 text-white font-bold shadow-sm shadow-orange-900/20"
                    : "text-slate-600 dark:text-slate-300 hover:bg-white/80 dark:hover:bg-slate-800/70 font-medium"
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`material-symbols-outlined text-[18px] leading-none shrink-0 ${
                      active ? "text-white" : "text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    {item.icon}
                  </span>
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.badge === "number" && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold shrink-0 ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="my-3 border-t border-slate-200/80 dark:border-slate-800" />

          <button
            type="button"
            onClick={handleOpenGroupMap}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/40 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px] leading-none">map</span>
            <span>{t("group_admin.open_group_map")}</span>
          </button>

          {currentUser.role === "admin" && (
            <Link
              href="/admin?tab=groups"
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-white/70 dark:hover:bg-slate-800/60 transition"
            >
              <span className="material-symbols-outlined text-[18px] leading-none">shield_person</span>
              <span>{t("nav.admin")}</span>
            </Link>
          )}
        </nav>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 transition-colors duration-200">
      <aside className="hidden lg:block w-64 shrink-0 bg-[#f2f3ff] dark:bg-slate-900/90 border-r border-slate-200/70 dark:border-slate-800/80 sticky top-0 h-screen overflow-y-auto">
        {sidebarContent}
      </aside>

      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative z-10 w-64 max-w-[82vw] h-full bg-[#f2f3ff] dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 shadow-2xl overflow-y-auto pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)]">
            {sidebarContent}
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 bg-[#faf8ff]/90 dark:bg-[#0b1120]/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-800/80 px-3 sm:px-6 lg:px-8 pt-[calc(0.75rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer shrink-0"
              aria-label="Menu"
            >
              <span className="material-symbols-outlined text-lg leading-none block">menu</span>
            </button>
            <span className="text-base shrink-0">{groupIcon}</span>
            <div className="text-xs font-extrabold text-slate-800 dark:text-slate-200 truncate">
              {groupName} · {navItems.find((n) => n.id === activeTab)?.label}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggle />
            <LanguageSelector />
          </div>
        </header>

        <main
          key={activeTab}
          className="flex-1 w-full max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] space-y-6 gm-tab-in"
        >
          {/* ==================== 1. ESTADÍSTICAS DEL GRUPO ==================== */}
          {activeTab === "stats" && stats && (
            <div className="space-y-5 text-left">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-orange-600">restaurant</span>
                    <span>{t("admin_stats.kpi_places")}</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    <AnimatedNumber value={stats.placesCount} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-orange-600">group</span>
                    <span>{t("group_admin.tab_members")}</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    <AnimatedNumber value={stats.membersCount} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-blue-600">chat</span>
                    <span>{t("admin_stats.kpi_comments")}</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    <AnimatedNumber value={stats.commentsCount} />
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs">
                  <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm text-emerald-600">check_circle</span>
                    <span>{t("admin_stats.kpi_visits")}</span>
                  </div>
                  <div className="text-3xl font-black text-slate-900 dark:text-slate-100 mt-2">
                    <AnimatedNumber value={stats.visitedMarksCount} />
                  </div>
                </div>
              </div>

              {/* Actividad últimos 30 días + Salud del grupo */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
                <div className="px-4 py-3.5 rounded-2xl bg-orange-50/80 dark:bg-orange-950/25 border border-orange-200/70 dark:border-orange-900/50 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-orange-200">
                    <span className="w-7 h-7 rounded-full bg-orange-600 text-white flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-base leading-none">bolt</span>
                    </span>
                    <span>{t("admin_stats.pulse_title")}</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap font-bold">
                    <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-orange-700 dark:text-orange-300 border border-orange-200/60 dark:border-orange-900/50">
                      +{stats.last30Days.places} {t("admin_stats.pulse_places")}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-300 border border-slate-200/70 dark:border-slate-800">
                      +{stats.last30Days.comments} {t("admin_stats.pulse_comments")}
                    </span>
                    <span className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 text-emerald-700 dark:text-emerald-300 border border-slate-200/70 dark:border-slate-800">
                      +{stats.last30Days.visits} {t("admin_stats.pulse_visits")}
                    </span>
                  </div>
                </div>

                <div className="px-4 py-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 shadow-xs flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <span className="font-extrabold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-base text-emerald-600 leading-none">
                      health_and_safety
                    </span>
                    <span>{t("admin_stats.group_health_title")}</span>
                  </span>
                  {stats.health.invalidLinks === 0 &&
                  stats.health.missingCoords === 0 &&
                  stats.health.pendingRequests === 0 &&
                  stats.health.trashCount === 0 ? (
                    <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                      {t("admin_stats.health_all_ok")}
                    </span>
                  ) : (
                    <div className="flex items-center gap-1.5 flex-wrap font-bold text-[11px]">
                      {stats.health.invalidLinks > 0 && (
                        <button
                          type="button"
                          onClick={() => selectTab("places")}
                          className="px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200/70 dark:border-rose-800 cursor-pointer hover:bg-rose-100 transition"
                        >
                          {t("admin_stats.health_invalid_links", { count: stats.health.invalidLinks })}
                        </button>
                      )}
                      {stats.health.missingCoords > 0 && (
                        <button
                          type="button"
                          onClick={() => selectTab("places")}
                          className="px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-800 cursor-pointer hover:bg-amber-100 transition"
                        >
                          {t("admin_stats.health_missing_coords", { count: stats.health.missingCoords })}
                        </button>
                      )}
                      {stats.health.pendingRequests > 0 && (
                        <button
                          type="button"
                          onClick={() => selectTab("members")}
                          className="px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 border border-indigo-200/70 dark:border-indigo-800 cursor-pointer hover:bg-indigo-100 transition"
                        >
                          {t("admin_stats.health_pending_requests", { count: stats.health.pendingRequests })}
                        </button>
                      )}
                      {stats.health.trashCount > 0 && (
                        <button
                          type="button"
                          onClick={() => selectTab("places")}
                          className="px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 cursor-pointer hover:bg-slate-200 transition"
                        >
                          {t("admin_stats.health_trash", { count: stats.health.trashCount })}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    🏅 {t("admin_stats.top_contributors")}
                  </h4>
                  {stats.topContributors.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">{t("admin_stats.no_data")}</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topContributors.map((c, idx) => (
                        <div
                          key={c.userId}
                          className="p-2.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs"
                        >
                          <span className="font-bold text-slate-900 dark:text-slate-100 truncate">
                            #{idx + 1} @{c.username || c.name}
                          </span>
                          <span className="text-[11px] font-bold text-orange-600 dark:text-orange-400 shrink-0">
                            🍽️ {c.placesCount} · 💬 {c.commentsCount}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3">
                  <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                    🔥 {t("admin_stats.top_places")}
                  </h4>
                  {stats.topPopularPlaces.length === 0 ? (
                    <p className="text-xs text-slate-400 italic">{t("admin_stats.no_data")}</p>
                  ) : (
                    <div className="space-y-2">
                      {stats.topPopularPlaces.map((p, idx) => (
                        <div
                          key={p.placeId}
                          className="p-2.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                        >
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 dark:text-slate-100 truncate">
                              #{idx + 1} {p.name}
                            </div>
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                              {p.city || "—"} · {p.priceRange}
                            </div>
                          </div>
                          <div className="text-[11px] font-bold text-amber-600 dark:text-amber-400 shrink-0">
                            ★ {p.favoritesCount} · ✓ {p.visitedCount}
                            {p.avgRating !== null ? ` · ${p.avgRating}/10` : ""}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Distribuciones del grupo: Ciudades, Planes, Precios y Etiquetas */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {[
                  { title: t("admin_stats.by_city"), icon: "location_city", items: stats.topCities, prefix: "", color: "bg-orange-600" },
                  { title: t("admin_stats.by_occasion"), icon: "restaurant_menu", items: stats.topOccasions, prefix: "", color: "bg-amber-500" },
                  { title: t("admin_stats.by_price"), icon: "payments", items: stats.priceDistribution, prefix: "", color: "bg-emerald-600" },
                  { title: t("admin_stats.top_tags"), icon: "sell", items: stats.topTags, prefix: "#", color: "bg-orange-600" },
                ]
                  .filter((card) => card.items.length > 0)
                  .map((card) => {
                    const max = Math.max(...card.items.map((i) => i.count), 1);
                    return (
                      <div
                        key={card.title}
                        className="p-4 sm:p-5 rounded-2xl border border-slate-200/70 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs space-y-3"
                      >
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-base text-orange-600 dark:text-orange-400">
                            {card.icon}
                          </span>
                          <h4 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300">
                            {card.title}
                          </h4>
                        </div>
                        <div className="space-y-2.5">
                          {card.items.map((item) => (
                            <div key={item.label} className="space-y-1">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-slate-800 dark:text-slate-200 truncate">
                                  {item.icon ? `${item.icon} ` : ""}
                                  {card.prefix}
                                  {item.label}
                                </span>
                                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400 shrink-0 ml-2">
                                  {item.count}
                                </span>
                              </div>
                              <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${card.color}`}
                                  style={{ width: `${Math.max(8, Math.round((item.count / max) * 100))}%` }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* ==================== 2. SITIOS Y DUPLICADOS DEL GRUPO ==================== */}
          {activeTab === "places" && (
            <PlacesTableManager
              places={places}
              occasionsList={initialOccasions}
              showSpaceColumn={false}
              groupId={group.id}
            />
          )}

          {/* ==================== 3. MIEMBROS, ROLES E INVITACIONES ==================== */}
          {activeTab === "members" && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 text-left">
              <div className="lg:col-span-7 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {t("group_admin.members_title")} ({members.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("group_admin.members_subtitle")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1 text-[11px]">
                    <button
                      type="button"
                      onClick={() => {
                        if (memberSortField === "name") {
                          setMemberSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setMemberSortField("name");
                          setMemberSortDir("asc");
                        }
                      }}
                      className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-bold cursor-pointer ${
                        memberSortField === "name"
                          ? "bg-orange-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span>{t("common.sort_title")}</span>
                      <span className="material-symbols-outlined text-[13px] leading-none">
                        {memberSortField === "name"
                          ? memberSortDir === "asc"
                            ? "arrow_upward"
                            : "arrow_downward"
                          : "unfold_more"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (memberSortField === "role") {
                          setMemberSortDir((d) => (d === "asc" ? "desc" : "asc"));
                        } else {
                          setMemberSortField("role");
                          setMemberSortDir("asc");
                        }
                      }}
                      className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-bold cursor-pointer ${
                        memberSortField === "role"
                          ? "bg-orange-600 text-white"
                          : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      <span>{t("admin_users.role")}</span>
                      <span className="material-symbols-outlined text-[13px] leading-none">
                        {memberSortField === "role"
                          ? memberSortDir === "asc"
                            ? "arrow_upward"
                            : "arrow_downward"
                          : "unfold_more"}
                      </span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleAddMember} className="flex gap-2">
                  <input
                    type="text"
                    value={newMemberUsername}
                    onChange={(e) => setNewMemberUsername(e.target.value)}
                    placeholder={t("group_admin.add_username_placeholder")}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                  <button
                    type="submit"
                    disabled={addingMember || !newMemberUsername.trim()}
                    className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {t("group_admin.add_member_btn")}
                  </button>
                </form>

                <div className="space-y-2">
                  {sortedMembers.map((m) => {
                    const isSuperAdminViewer = currentUser.role === "admin";
                    const canManageRole = isSuperAdminViewer || !m.isOwner;
                    const effectiveSelectRole: "owner" | "admin" | "member" = m.isOwner
                      ? "owner"
                      : m.role === "admin"
                        ? "admin"
                        : "member";

                    return (
                      <div
                        key={m.userId}
                        className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 flex flex-wrap items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-bold text-slate-900 dark:text-slate-100">
                              @{m.username || m.name}
                            </span>
                            {m.isOwner ? (
                              <span className="px-1.5 py-0.5 rounded bg-orange-600 text-white text-[10px] font-black uppercase">
                                {t("group_admin.owner_badge")}
                              </span>
                            ) : m.role === "admin" ? (
                              <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase">
                                {t("spaces.group_admin_badge")}
                              </span>
                            ) : (
                              <span className="px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px] font-bold uppercase">
                                {t("group_admin.member_badge")}
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {m.name}
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {canManageRole && (
                            <select
                              value={effectiveSelectRole}
                              disabled={busyMemberId === m.userId}
                              onChange={(e) =>
                                handleChangeMemberRole(
                                  m.userId,
                                  e.target.value as "owner" | "admin" | "member"
                                )
                              }
                              aria-label={t("admin_users.role")}
                              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-[11px] font-bold text-slate-700 dark:text-slate-200 cursor-pointer focus:outline-none focus:ring-1 focus:ring-orange-500"
                            >
                              <option value="member">{t("group_admin.member_badge")}</option>
                              <option value="admin">{t("spaces.group_admin_badge")}</option>
                              {(isSuperAdminViewer || group.isOwner) && (
                                <option value="owner">{t("group_admin.owner_badge")}</option>
                              )}
                            </select>
                          )}

                          {!m.isOwner && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMember(m.userId, m.username || m.name)}
                              disabled={busyMemberId === m.userId}
                              className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 transition cursor-pointer"
                              title={t("group_admin.kick_btn")}
                            >
                              <span className="material-symbols-outlined text-[15px] leading-none block">
                                person_remove
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <RoleLegendCard scope="group" />

                {joinRequests.length > 0 && (
                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <div className="text-xs font-extrabold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-base text-orange-600 leading-none">
                        person_add
                      </span>
                      <span>
                        {t("group_admin.join_requests_title")} ({joinRequests.length})
                      </span>
                    </div>
                    <div className="space-y-1.5">
                      {joinRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2 text-xs"
                        >
                          <span className="font-bold text-slate-800 dark:text-slate-100 truncate">
                            @{req.username || req.name} ({req.name})
                          </span>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              disabled={decidingReqId === req.id}
                              onClick={async () => {
                                setDecidingReqId(req.id);
                                const res = await decideGroupJoinRequestAction(req.id, "approve");
                                setDecidingReqId(null);
                                if (!res.error) {
                                  setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
                                  toast(t("group_admin.join_approved_toast"), { kind: "success" });
                                  router.refresh();
                                }
                              }}
                              className="px-2.5 py-1 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                            >
                              {t("group_admin.approve_btn")}
                            </button>
                            <button
                              type="button"
                              disabled={decidingReqId === req.id}
                              onClick={async () => {
                                setDecidingReqId(req.id);
                                const res = await decideGroupJoinRequestAction(req.id, "reject");
                                setDecidingReqId(null);
                                if (!res.error) {
                                  setJoinRequests((prev) => prev.filter((r) => r.id !== req.id));
                                  toast(t("group_admin.join_rejected_toast"), { kind: "info" });
                                }
                              }}
                              className="px-2.5 py-1 rounded-full bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 text-[11px] font-bold cursor-pointer"
                            >
                              {t("group_admin.reject_btn")}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Invitaciones por enlace */}
              <div className="lg:col-span-5 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {t("group_admin.invites_title")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("group_admin.invites_subtitle")}
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        {t("group_admin.invite_expiry")}
                      </label>
                      <select
                        value={inviteDays}
                        onChange={(e) => setInviteDays(Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value={7}>7 {t("group_admin.days")}</option>
                        <option value={30}>30 {t("group_admin.days")}</option>
                        <option value={0}>{t("group_admin.never_expires")}</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                        {t("group_admin.invite_max_uses")}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={1000}
                        value={inviteMaxUses}
                        onChange={(e) => setInviteMaxUses(e.target.value)}
                        placeholder="∞"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleCreateInvite}
                    disabled={creatingInvite}
                    className="w-full py-2 px-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs transition cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    <span className="material-symbols-outlined text-sm leading-none">add_link</span>
                    <span>{t("group_admin.generate_invite_btn")}</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {invites.length === 0 ? (
                    <p className="text-xs text-slate-400 italic text-center py-3">
                      {t("group_admin.no_active_invites")}
                    </p>
                  ) : (
                    invites.map((inv) => (
                      <div
                        key={inv.id}
                        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="font-mono text-[11px] font-bold text-slate-700 dark:text-slate-300 truncate">
                            .../groups/join/{inv.token.slice(0, 10)}…
                          </div>
                          <div className="text-[10px] text-slate-400">
                            {t("group_admin.uses_label")}: {inv.usedCount}
                            {inv.maxUses ? `/${inv.maxUses}` : ""} ·{" "}
                            {inv.neverExpires
                              ? t("group_admin.never_expires")
                              : new Date(inv.expiresAt).toLocaleDateString(
                                  locale === "en" ? "en-GB" : "es-ES"
                                )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={async () => {
                              const url = `${window.location.origin}/groups/join/${inv.token}`;
                              await copyText(url);
                              toast(t("group_admin.invite_copied_toast"), { kind: "success" });
                            }}
                            className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 cursor-pointer"
                            title={t("common.copy")}
                          >
                            <span className="material-symbols-outlined text-sm leading-none block">
                              content_copy
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevokeInvite(inv.id)}
                            className="p-1.5 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 cursor-pointer"
                            title={t("common.delete")}
                          >
                            <span className="material-symbols-outlined text-sm leading-none block">
                              link_off
                            </span>
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ==================== 4. TAXONOMÍA AISLADA DEL GRUPO ==================== */}
          {activeTab === "taxonomy" && (
            <div className="space-y-5">
              <TaxonomyManager
                key={`occ-${group.id}`}
                section="occasions"
                defaultOpen={false}
                explicitGroupId={group.id}
                initialOccasions={initialOccasions}
                initialTags={initialTags}
              />
              <TaxonomyManager
                key={`tag-${group.id}`}
                section="tags"
                defaultOpen={false}
                explicitGroupId={group.id}
                initialOccasions={initialOccasions}
                initialTags={initialTags}
              />
            </div>
          )}

          {/* ==================== 5. AJUSTES DEL GRUPO ==================== */}
          {activeTab === "settings" && (
            <div className="max-w-2xl space-y-5 text-left">
              <form
                onSubmit={handleSaveSettings}
                className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-4"
              >
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {t("group_admin.settings_title")}
                </h3>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t("group_admin.group_name_label")}
                  </label>
                  <input
                    type="text"
                    required
                    minLength={2}
                    maxLength={100}
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    {t("group_admin.group_icon_label")}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {GROUP_ICONS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setGroupIcon(emoji)}
                        className={`w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition cursor-pointer ${
                          groupIcon === emoji
                            ? "border-orange-600 bg-orange-50 dark:bg-orange-950/60 shadow-xs"
                            : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800"
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    {t("group_admin.group_desc_label")}
                  </label>
                  <textarea
                    rows={3}
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    placeholder={t("group_admin.group_desc_placeholder")}
                    className="w-full px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 resize-none"
                  />
                </div>

                <label className="flex items-center gap-2.5 p-3 rounded-xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-700 cursor-pointer text-xs">
                  <input
                    type="checkbox"
                    checked={requireJoinApproval}
                    onChange={(e) => setRequireJoinApproval(e.target.checked)}
                    className="rounded border-slate-300 text-orange-600 focus:ring-orange-500 w-4 h-4"
                  />
                  <span className="font-semibold text-slate-700 dark:text-slate-200">
                    {t("group_admin.require_join_approval")}
                  </span>
                </label>

                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingSettings || !groupName.trim()}
                    className="px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-extrabold transition cursor-pointer disabled:opacity-50"
                  >
                    {savingSettings ? t("common.saving") : t("form.save_changes")}
                  </button>
                </div>
              </form>

              {/* API de Google Places propia del grupo (Punto 6) */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                      {t("api_usage.group_api_title")}
                    </h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t("api_usage.group_api_recommend")}
                    </p>
                  </div>
                  {apiUsage && (
                    <span className="px-2.5 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300 text-[11px] font-bold">
                      {apiUsage.limit !== null
                        ? t("api_usage.requests_badge", {
                            used: apiUsage.requests,
                            limit: apiUsage.limit,
                          })
                        : t("api_usage.own_key_requests_badge", { used: apiUsage.requests })}
                    </span>
                  )}
                </div>

                {apiUsage?.hasOwnKey && apiUsage.maskedKey && (
                  <div className="p-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 flex items-center justify-between gap-2 text-xs text-emerald-800 dark:text-emerald-200">
                    <span className="font-bold">
                      {t("api_usage.own_key_active", { key: apiUsage.maskedKey })}
                    </span>
                    <button
                      type="button"
                      disabled={savingApiKey}
                      onClick={async () => {
                        setSavingApiKey(true);
                        await updateGroupApiSettingsAction(group.id, { clearKey: true });
                        const u = await getGroupApiUsageAction(group.id);
                        if (u) setApiUsage(u);
                        setSavingApiKey(false);
                        toast(t("api_usage.key_cleared_toast"), { kind: "info" });
                      }}
                      className="px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-emerald-300 dark:border-emerald-700 text-[11px] font-bold cursor-pointer"
                    >
                      {t("api_usage.clear_key_btn")}
                    </button>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="password"
                    value={groupApiKeyInput}
                    onChange={(e) => setGroupApiKeyInput(e.target.value)}
                    placeholder="AIza..."
                    autoComplete="off"
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-[#f8f9ff] dark:bg-slate-950 text-xs"
                  />
                  <button
                    type="button"
                    disabled={savingApiKey || !groupApiKeyInput.trim()}
                    onClick={async () => {
                      setSavingApiKey(true);
                      const res = await updateGroupApiSettingsAction(group.id, {
                        apiKey: groupApiKeyInput,
                      });
                      const u = await getGroupApiUsageAction(group.id);
                      if (u) setApiUsage(u);
                      setGroupApiKeyInput("");
                      setSavingApiKey(false);
                      if (!res.error) toast(t("api_usage.key_saved_toast"), { kind: "success" });
                    }}
                    className="px-4 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {t("api_usage.save_key_btn")}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t("api_usage.restrict_hint")}
                </p>
              </div>

              {/* Exportar grupo completo (Punto 16) */}
              <div className="p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                    {t("group_admin.export_group_title")}
                  </h4>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("group_admin.export_group_desc", { count: places.length })}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowExportGroupModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs font-bold cursor-pointer shrink-0 transition"
                >
                  <span className="material-symbols-outlined text-base leading-none">download</span>
                  <span>{t("group_admin.export_group_btn")}</span>
                </button>
              </div>

              <ExportImportModal
                isOpen={showExportGroupModal}
                onClose={() => setShowExportGroupModal(false)}
                places={places}
              />

              {canDeleteGroup && (
                <div className="p-5 rounded-2xl border border-red-200 dark:border-red-900/60 bg-red-50/60 dark:bg-red-950/20 space-y-3">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-red-700 dark:text-red-400">
                    {t("group_admin.danger_zone_title")}
                  </h4>
                  <p className="text-xs text-red-700/90 dark:text-red-300/90">
                    {t("group_admin.danger_zone_desc", { count: String(places.length) })}
                  </p>
                  <button
                    type="button"
                    onClick={handleDeleteEntireGroup}
                    disabled={deletingGroup}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {t("group_admin.delete_group_btn")}
                  </button>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="w-full bg-[#f2f3ff] dark:bg-slate-900/60 border-t border-slate-200/60 dark:border-slate-800/60 py-6 mt-auto">
          <div className="max-w-[1720px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-500 dark:text-slate-400">
            <div className="flex items-center gap-2">
              <GastroMapIcon className="w-6 h-6 shrink-0 shadow-xs rounded-[28%]" />
              <span className="font-bold text-slate-900 dark:text-slate-100">
                Gastro<span className="text-[#ea580c]">Map</span>
              </span>
              <span className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200/70 dark:border-slate-700 text-[10px] font-bold text-slate-500 dark:text-slate-400">
                v{APP_VERSION}
              </span>
            </div>
            <div className="flex items-center gap-4 font-semibold flex-wrap justify-center">
              <Link href="/docs" className="hover:text-orange-600 transition">
                {t("nav.documentation")}
              </Link>
              <a
                href="https://github.com/alebupal/GastroMap"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-orange-600 transition"
              >
                GitHub
              </a>
              <a
                href="https://www.paypal.me/alebupal"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-100 font-bold transition shadow-xs"
              >
                <span className="material-symbols-outlined text-sm leading-none">favorite</span>
                <span>{t("nav.donate")}</span>
              </a>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
