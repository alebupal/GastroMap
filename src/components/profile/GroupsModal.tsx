"use client";

import { useState, useEffect } from "react";
import { copyText } from "@/lib/clipboard";
import { useT } from "@/lib/i18n/client";
import {
  getMyGroupsAction,
  createGroupAction,
  renameGroupAction,
  removeGroupMemberAction,
  deleteGroupAction,
  createGroupInviteAction,
  getGroupInvitesAction,
  revokeGroupInviteAction,
  type SharingGroupWithMembers,
  type GroupInviteItem,
} from "@/lib/actions/groups";

interface GroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function GroupsModal({ isOpen, onClose, currentUserId }: GroupsModalProps) {
  const { t, locale } = useT();
  const [groups, setGroups] = useState<SharingGroupWithMembers[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Estado para gestión de invitaciones por grupo
  const [expandedInvitesGroupId, setExpandedInvitesGroupId] = useState<string | null>(null);
  const [groupInvites, setGroupInvites] = useState<Record<string, GroupInviteItem[]>>({});
  const [generatingInviteForGroup, setGeneratingInviteForGroup] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function loadData() {
    setLoading(true);
    try {
      const gList = await getMyGroupsAction();
      setGroups(gList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  async function loadInvitesForGroup(groupId: string) {
    const res = await getGroupInvitesAction(groupId);
    if (res.invites) {
      setGroupInvites((prev) => ({ ...prev, [groupId]: res.invites || [] }));
    }
  }

  function toggleInvitesSection(groupId: string) {
    if (expandedInvitesGroupId === groupId) {
      setExpandedInvitesGroupId(null);
    } else {
      setExpandedInvitesGroupId(groupId);
      loadInvitesForGroup(groupId);
    }
  }

  async function handleCreateInvite(groupId: string) {
    setGeneratingInviteForGroup(groupId);
    setError(null);
    setSuccessMessage(null);
    const res = await createGroupInviteAction(groupId, 7);
    setGeneratingInviteForGroup(null);
    if (res.error) {
      setError(res.error);
    } else {
      // Desplegar automáticamente los enlaces del grupo para que se vean de inmediato
      setExpandedInvitesGroupId(groupId);
      await loadInvitesForGroup(groupId);
      if (res.token) {
        copyToClipboard(res.token);
        setSuccessMessage(t("groups.invite_copied_banner"));
        setTimeout(() => setSuccessMessage(null), 5000);
      }
    }
  }

  async function handleRevokeInvite(groupId: string, inviteId: string) {
    if (!confirm("¿Revocar este enlace de invitación? Nadie más podrá unirse con él.")) return;
    setError(null);
    const res = await revokeGroupInviteAction(inviteId);
    if (res.error) {
      setError(res.error);
    } else {
      loadInvitesForGroup(groupId);
    }
  }

  function copyToClipboard(token: string) {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const fullUrl = `${origin}/groups/join/${token}`;
    copyText(fullUrl).then((ok) => {
      if (ok) {
        setCopiedToken(token);
        setTimeout(() => setCopiedToken(null), 3000);
      } else {
        // Último recurso: mostrar el enlace para copiarlo a mano
        window.prompt("Copia el enlace de invitación:", fullUrl);
      }
    });
  }

  if (!isOpen) return null;

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!newGroupName.trim() || creating) return;
    setCreating(true);
    setError(null);
    const res = await createGroupAction(newGroupName);
    setCreating(false);
    if (res.error) {
      setError(res.error);
    } else {
      setNewGroupName("");
      loadData();
    }
  }

  async function handleRemoveMember(groupId: string, userId: string, label: string) {
    if (!confirm(`¿Seguro que quieres quitar a ${label} del grupo?`)) return;
    setError(null);
    const res = await removeGroupMemberAction(groupId, userId);
    if (res.error) {
      setError(res.error);
    } else {
      loadData();
    }
  }

  async function handleRename(groupId: string) {
    if (!renameValue.trim()) return;
    setError(null);
    const res = await renameGroupAction(groupId, renameValue);
    if (res.error) {
      setError(res.error);
    } else {
      setRenamingGroupId(null);
      loadData();
    }
  }

  async function handleDeleteGroup(group: SharingGroupWithMembers) {
    if (
      !confirm(
        `¿Eliminar definitivamente el grupo «${group.name}»? Los sitios compartidos con este grupo dejarán de ser visibles por esta vía.`
      )
    ) {
      return;
    }
    setError(null);
    const res = await deleteGroupAction(group.id);
    if (res.error) {
      setError(res.error);
    } else {
      loadData();
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-150 text-left"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200/80 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera estilo DESIGN.md */}
        <div className="px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/60 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-xl">group</span>
            </div>
            <div>
              <h3 className="font-extrabold text-base sm:text-lg text-slate-900 dark:text-slate-100 tracking-tight">
                {t("groups.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {t("groups.subtitle")}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center transition cursor-pointer shrink-0"
            aria-label={t("common.close")}
          >
            <span className="material-symbols-outlined text-lg leading-none">close</span>
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {successMessage && (
            <div className="p-3.5 text-xs bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-base text-emerald-600 leading-none">
                  check_circle
                </span>
                <span className="font-bold">{successMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setSuccessMessage(null)}
                className="text-emerald-700 dark:text-emerald-300 font-bold px-1 hover:text-emerald-900 cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="p-3.5 text-xs bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 rounded-2xl font-semibold flex items-center gap-2">
              <span className="material-symbols-outlined text-base shrink-0">error</span>
              <span>{error}</span>
            </div>
          )}

          {/* Formulario nuevo grupo */}
          <form onSubmit={handleCreateGroup} className="flex gap-2">
            <div className="relative flex-1">
              <span className="material-symbols-outlined text-base text-slate-400 absolute left-3.5 top-2.5 pointer-events-none">
                group_add
              </span>
              <input
                type="text"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder={`${t("groups.name")}...`}
                className="w-full pl-10 pr-4 py-2.5 rounded-full text-xs bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={creating || !newGroupName.trim()}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-full text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-40 transition cursor-pointer shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-sm leading-none">add</span>
              <span>{creating ? t("common.loading") : t("groups.create")}</span>
            </button>
          </form>

          {/* Listado de grupos */}
          {loading ? (
            <div className="py-10 text-center text-slate-400 space-y-2">
              <span className="material-symbols-outlined text-2xl text-orange-600 animate-spin inline-block">
                progress_activity
              </span>
              <p className="text-xs font-medium">{t("groups.loading")}</p>
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center py-10 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl bg-[#f8f9ff] dark:bg-slate-800/30">
              <span className="material-symbols-outlined text-4xl text-orange-500/60 block mb-2">
                diversity_3
              </span>
              <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                {t("groups.empty_title")}
              </p>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                {t("groups.empty_desc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const isExpanded = expandedInvitesGroupId === g.id;
                const invites = groupInvites[g.id] || [];
                const groupInitials = g.name
                  .split(/\s+/)
                  .map((w) => w[0])
                  .join("")
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <div
                    key={g.id}
                    className="p-4 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 flex flex-col gap-3 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 flex-1 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-orange-100/90 dark:bg-orange-950/60 text-orange-700 dark:text-orange-300 font-black text-xs flex items-center justify-center shrink-0">
                          {groupInitials}
                        </div>

                        {renamingGroupId === g.id ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                              className="px-3 py-1.5 text-xs rounded-full bg-white dark:bg-slate-900 border border-orange-500 text-slate-900 dark:text-slate-100 flex-1 focus:outline-none"
                            />
                            <button
                              type="button"
                              onClick={() => handleRename(g.id)}
                              className="px-3 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-[11px] cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingGroupId(null)}
                              className="w-7 h-7 rounded-full hover:bg-slate-200 dark:hover:bg-slate-700 text-xs text-slate-500 flex items-center justify-center cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 min-w-0 flex-wrap">
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {g.name}
                            </h4>
                            {g.isOwner && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-100 dark:bg-orange-950/70 text-orange-700 dark:text-orange-300">
                                {t("groups.owner_badge")}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        {g.isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingGroupId(g.id);
                                setRenameValue(g.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-slate-700 rounded-full transition cursor-pointer"
                              title={t("groups.rename_group")}
                            >
                              <span className="material-symbols-outlined text-base leading-none">
                                edit
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-full transition cursor-pointer"
                              title={t("groups.delete_group")}
                            >
                              <span className="material-symbols-outlined text-base leading-none">
                                delete
                              </span>
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveMember(g.id, currentUserId, t("groups.yourself"))
                            }
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              logout
                            </span>
                            <span>{t("groups.leave_group")}</span>
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Miembros del grupo */}
                    <div className="space-y-1.5">
                      <span className="text-[10px] uppercase font-extrabold tracking-wider text-slate-400">
                        {t("groups.members_label", { count: String(g.members.length) })}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.members.map((m) => (
                          <span
                            key={m.userId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-semibold"
                          >
                            <span>@{m.username || m.name}</span>
                            {m.userId === g.ownerUserId && (
                              <span
                                className="text-[10px] text-amber-500 font-bold"
                                title={t("groups.owner_star")}
                              >
                                ★
                              </span>
                            )}
                            {g.isOwner && m.userId !== g.ownerUserId && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(g.id, m.userId, `@${m.username || m.name}`)
                                }
                                className="text-slate-400 hover:text-rose-600 cursor-pointer text-[10px] ml-0.5"
                                title={t("groups.kick_member")}
                              >
                                ✕
                              </button>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Sección Enlaces de Invitación (Solo propietario) */}
                    {g.isOwner && (
                      <div className="pt-2.5 border-t border-slate-200/70 dark:border-slate-700/60">
                        <div className="flex items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => toggleInvitesSection(g.id)}
                            className="text-xs font-bold text-orange-600 dark:text-orange-400 hover:underline cursor-pointer inline-flex items-center gap-1"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              link
                            </span>
                            <span>{t("groups.invite_links_title")}</span>
                            <span className="material-symbols-outlined text-sm leading-none">
                              {isExpanded ? "expand_less" : "expand_more"}
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCreateInvite(g.id)}
                            disabled={generatingInviteForGroup === g.id}
                            className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-orange-50 dark:bg-orange-950/50 hover:bg-orange-600 hover:text-white text-orange-700 dark:text-orange-300 border border-orange-200/80 dark:border-orange-800/60 font-bold text-[11px] transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              add_link
                            </span>
                            <span>
                              {generatingInviteForGroup === g.id
                                ? t("common.loading")
                                : t("groups.new_link_btn")}
                            </span>
                          </button>
                        </div>

                        {/* Desplegable de enlaces activos */}
                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 bg-white dark:bg-slate-900/90 p-3 rounded-2xl border border-slate-200/80 dark:border-slate-700/80">
                            {invites.length === 0 ? (
                              <p className="text-[11px] text-slate-400 italic text-center py-1">
                                {t("groups.no_active_links")}
                              </p>
                            ) : (
                              invites.map((inv) => {
                                const isCopied = copiedToken === inv.token;
                                return (
                                  <div
                                    key={inv.id}
                                    className="p-2.5 rounded-xl bg-[#f8f9ff] dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                                        .../groups/join/{inv.token.slice(0, 10)}...
                                      </p>
                                      <p className="text-[10px] text-slate-400 mt-0.5">
                                        {t("groups.expires_prefix")}{" "}
                                        {new Date(inv.expiresAt).toLocaleDateString(
                                          locale === "en" ? "en-US" : "es-ES",
                                          { day: "numeric", month: "short" }
                                        )}{" "}
                                        • {t("groups.uses_prefix")} {inv.usedCount}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(inv.token)}
                                        className={`px-3 py-1 rounded-full text-[10px] font-bold transition cursor-pointer ${
                                          isCopied
                                            ? "bg-emerald-600 text-white"
                                            : "bg-orange-600 hover:bg-orange-700 text-white"
                                        }`}
                                      >
                                        {isCopied ? t("groups.copied_btn") : t("groups.copy_btn")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeInvite(g.id, inv.id)}
                                        className="w-6 h-6 rounded-full hover:bg-rose-100 dark:hover:bg-rose-950/60 text-slate-400 hover:text-rose-600 flex items-center justify-center transition cursor-pointer"
                                        title={t("groups.revoke_link")}
                                      >
                                        <span className="material-symbols-outlined text-sm leading-none">
                                          close
                                        </span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pie del modal */}
        <div className="px-5 sm:px-6 py-3.5 bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
          >
            {t("common.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
