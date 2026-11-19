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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/75 backdrop-blur-sm animate-in fade-in duration-150 text-left">
      <div className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Cabecera */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <span className="text-xl">👥</span>
            <div>
              <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                {t("groups.title")}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crea grupos (ej. Pareja, Amigos o Familia) y genera enlaces de invitación para compartir
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer text-sm font-bold"
          >
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {successMessage && (
            <div className="p-3.5 text-xs bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200 rounded-2xl flex items-center justify-between gap-2 shadow-xs animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-2">
                <span className="text-base">📋</span>
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
            <div className="p-3 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl">
              {error}
            </div>
          )}

          {/* Formulario nuevo grupo */}
          <form onSubmit={handleCreateGroup} className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder={`${t("groups.name")}...`}
              className="flex-1 px-3.5 py-2 rounded-2xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={creating || !newGroupName.trim()}
              className="px-4 py-2 rounded-2xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 disabled:opacity-40 transition cursor-pointer shrink-0 shadow-xs"
            >
              {creating ? t("common.loading") : t("groups.create")}
            </button>
          </form>

          {/* Listado de grupos */}
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-6">{t("groups.loading")}</p>
          ) : groups.length === 0 ? (
            <div className="text-center py-8 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-3xl">
              <span className="text-3xl block mb-2">🤝</span>
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                {t("groups.empty_title")}
              </p>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs mx-auto">
                {t("groups.empty_desc")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const isExpanded = expandedInvitesGroupId === g.id;
                const invites = groupInvites[g.id] || [];

                return (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-2xl bg-slate-50/80 dark:bg-slate-800/40 border border-slate-200/80 dark:border-slate-800 flex flex-col gap-2.5 transition"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        {renamingGroupId === g.id ? (
                          <div className="flex items-center gap-1.5 flex-1">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              autoFocus
                              className="px-2 py-1 text-xs rounded-xl bg-white dark:bg-slate-950 border border-amber-500 text-slate-900 dark:text-slate-100 flex-1"
                            />
                            <button
                              type="button"
                              onClick={() => handleRename(g.id)}
                              className="px-2 py-1 rounded-xl bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                            >
                              ✓
                            </button>
                            <button
                              type="button"
                              onClick={() => setRenamingGroupId(null)}
                              className="text-xs text-slate-400 px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-extrabold text-sm text-slate-900 dark:text-slate-100 truncate">
                              {g.name}
                            </h4>
                            {g.isOwner && (
                              <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                {t("groups.owner_badge")}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      <div className="flex items-center gap-1">
                        {g.isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingGroupId(g.id);
                                setRenameValue(g.name);
                              }}
                              className="p-1.5 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-xs cursor-pointer rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                              title={t("groups.rename_group")}
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g)}
                              className="p-1.5 text-slate-400 hover:text-red-500 text-xs cursor-pointer rounded-lg hover:bg-slate-200/60 dark:hover:bg-slate-700"
                              title={t("groups.delete_group")}
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(g.id, currentUserId, t("groups.yourself"))}
                            className="px-2 py-1 rounded-xl text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            {t("groups.leave_group")}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Miembros del grupo */}
                    <div className="space-y-1">
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        {t("groups.members_label", { count: String(g.members.length) })}
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {g.members.map((m) => (
                          <span
                            key={m.userId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-medium shadow-2xs"
                          >
                            <span>@{m.username || m.name}</span>
                            {m.userId === g.ownerUserId && (
                              <span className="text-[9px] text-amber-500 font-bold" title={t("groups.owner_star")}>
                                ★
                              </span>
                            )}
                            {g.isOwner && m.userId !== g.ownerUserId && (
                              <button
                                type="button"
                                onClick={() =>
                                  handleRemoveMember(g.id, m.userId, `@${m.username || m.name}`)
                                }
                                className="text-slate-400 hover:text-red-500 cursor-pointer text-[10px] ml-0.5"
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
                      <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        <div className="flex items-center justify-between">
                          <button
                            type="button"
                            onClick={() => toggleInvitesSection(g.id)}
                            className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1"
                          >
                            <span>🔗 {t("groups.invite_links_title")}</span>
                            <span>{isExpanded ? "▲" : "▼"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCreateInvite(g.id)}
                            disabled={generatingInviteForGroup === g.id}
                            className="px-2.5 py-1 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 font-bold text-[11px] transition cursor-pointer flex items-center gap-1"
                          >
                            <span>{generatingInviteForGroup === g.id ? t("common.loading") : t("groups.new_link_btn")}</span>
                          </button>
                        </div>

                        {/* Desplegable de enlaces activos */}
                        {isExpanded && (
                          <div className="mt-2.5 space-y-2 bg-white dark:bg-slate-900/80 p-2.5 rounded-xl border border-slate-200/80 dark:border-slate-700/80">
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
                                    className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between gap-2"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[11px] font-mono text-slate-700 dark:text-slate-300 truncate">
                                        .../groups/join/{inv.token.slice(0, 10)}...
                                      </p>
                                      <p className="text-[10px] text-slate-400">
                                        {t("groups.expires_prefix")}{" "}
                                        {new Date(inv.expiresAt).toLocaleDateString(locale === "en" ? "en-US" : "es-ES", {
                                          day: "numeric",
                                          month: "short",
                                        })}{" "}
                                        • {t("groups.uses_prefix")} {inv.usedCount}
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => copyToClipboard(inv.token)}
                                        className={`px-2 py-1 rounded-lg text-[10px] font-bold transition cursor-pointer ${
                                          isCopied
                                            ? "bg-emerald-600 text-white"
                                            : "bg-amber-500 hover:bg-amber-600 text-slate-950"
                                        }`}
                                      >
                                        {isCopied ? t("groups.copied_btn") : t("groups.copy_btn")}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleRevokeInvite(g.id, inv.id)}
                                        className="p-1 text-slate-400 hover:text-red-500 text-xs cursor-pointer"
                                        title={t("groups.revoke_link")}
                                      >
                                        ✕
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
      </div>
    </div>
  );
}
