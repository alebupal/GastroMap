"use client";

import { useState, useEffect } from "react";
import {
  getMyGroupsAction,
  getActiveUsersForSharingAction,
  createGroupAction,
  renameGroupAction,
  addGroupMemberAction,
  removeGroupMemberAction,
  deleteGroupAction,
  type SharingGroupWithMembers,
  type SimpleUserOption,
} from "@/lib/actions/groups";

interface GroupsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

export function GroupsModal({ isOpen, onClose, currentUserId }: GroupsModalProps) {
  const [groups, setGroups] = useState<SharingGroupWithMembers[]>([]);
  const [availableUsers, setAvailableUsers] = useState<SimpleUserOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [addingMemberGroupId, setAddingMemberGroupId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  async function loadData() {
    setLoading(true);
    try {
      const [gList, uList] = await Promise.all([
        getMyGroupsAction(),
        getActiveUsersForSharingAction(),
      ]);
      setGroups(gList);
      setAvailableUsers(uList);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

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

  async function handleAddMember(groupId: string) {
    if (!selectedUserId) return;
    setError(null);
    const res = await addGroupMemberAction(groupId, selectedUserId);
    if (res.error) {
      setError(res.error);
    } else {
      setSelectedUserId("");
      setAddingMemberGroupId(null);
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
                Mis Grupos Privados
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Crea grupos como Pareja, Amigos o Familia para compartir sitios en privado
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

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="p-2.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs">
              ⚠️ {error}
            </div>
          )}

          {/* Crear nuevo grupo */}
          <form onSubmit={handleCreateGroup} className="flex gap-2">
            <input
              type="text"
              value={newGroupName}
              onChange={(e) => setNewGroupName(e.target.value)}
              placeholder="Nuevo grupo (ej. Pareja, Amigos, Familia...)"
              className="flex-1 px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
            <button
              type="submit"
              disabled={creating || newGroupName.trim().length < 2}
              className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer disabled:opacity-40 shrink-0"
            >
              {creating ? "..." : "+ Crear"}
            </button>
          </form>

          {/* Listado de grupos */}
          {loading ? (
            <p className="text-xs text-slate-400 text-center py-6">Cargando grupos...</p>
          ) : groups.length === 0 ? (
            <div className="p-6 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400">
              Todavía no perteneces a ningún grupo privado. ¡Crea el primero arriba!
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((g) => {
                const memberIds = new Set(g.members.map((m) => m.userId));
                const candidatesToAdd = availableUsers.filter((u) => !memberIds.has(u.id));

                return (
                  <div
                    key={g.id}
                    className="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      {renamingGroupId === g.id ? (
                        <div className="flex items-center gap-1.5 flex-1">
                          <input
                            type="text"
                            value={renameValue}
                            onChange={(e) => setRenameValue(e.target.value)}
                            className="flex-1 px-2.5 py-1 rounded-lg text-xs bg-white dark:bg-slate-950 border border-amber-400 text-slate-900 dark:text-slate-100"
                          />
                          <button
                            type="button"
                            onClick={() => handleRename(g.id)}
                            className="px-2 py-1 rounded-lg bg-amber-500 text-slate-950 font-bold text-[11px] cursor-pointer"
                          >
                            Guardar
                          </button>
                          <button
                            type="button"
                            onClick={() => setRenamingGroupId(null)}
                            className="text-[11px] text-slate-400 cursor-pointer"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-bold text-sm text-slate-900 dark:text-slate-100 truncate">
                            {g.name}
                          </span>
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                            {g.members.length} {g.members.length === 1 ? "miembro" : "miembros"}
                          </span>
                          {g.isOwner && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300">
                              Propietario
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-1.5 shrink-0">
                        {g.isOwner ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingGroupId(g.id);
                                setRenameValue(g.name);
                              }}
                              className="p-1 text-slate-400 hover:text-amber-500 text-xs cursor-pointer"
                              title="Renombrar grupo"
                            >
                              ✏️
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(g)}
                              className="p-1 text-slate-400 hover:text-red-500 text-xs cursor-pointer"
                              title="Eliminar grupo"
                            >
                              🗑️
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(g.id, currentUserId, "ti mismo")}
                            className="px-2 py-0.5 rounded-lg text-[11px] font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40 cursor-pointer"
                          >
                            Abandonar
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Miembros */}
                    <div className="flex flex-wrap gap-1.5">
                      {g.members.map((m) => (
                        <span
                          key={m.userId}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[11px] text-slate-700 dark:text-slate-300 font-medium"
                        >
                          <span>@{m.username || m.name}</span>
                          {g.isOwner && m.userId !== g.ownerUserId && (
                            <button
                              type="button"
                              onClick={() =>
                                handleRemoveMember(g.id, m.userId, `@${m.username || m.name}`)
                              }
                              className="text-slate-400 hover:text-red-500 cursor-pointer text-[10px] ml-0.5"
                              title="Expulsar del grupo"
                            >
                              ✕
                            </button>
                          )}
                        </span>
                      ))}
                    </div>

                    {/* Añadir miembro (solo propietario) */}
                    {g.isOwner && (
                      <div className="pt-1">
                        {addingMemberGroupId === g.id ? (
                          <div className="flex items-center gap-1.5">
                            <select
                              value={selectedUserId}
                              onChange={(e) => setSelectedUserId(e.target.value)}
                              className="flex-1 px-2.5 py-1.5 rounded-xl text-xs bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100"
                            >
                              <option value="">Selecciona un usuario...</option>
                              {candidatesToAdd.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name} (@{u.username || u.name})
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => handleAddMember(g.id)}
                              disabled={!selectedUserId}
                              className="px-2.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs cursor-pointer disabled:opacity-40"
                            >
                              Añadir
                            </button>
                            <button
                              type="button"
                              onClick={() => setAddingMemberGroupId(null)}
                              className="text-xs text-slate-400 px-1 cursor-pointer"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          candidatesToAdd.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                setAddingMemberGroupId(g.id);
                                setSelectedUserId("");
                              }}
                              className="text-[11px] font-bold text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
                            >
                              + Añadir miembro
                            </button>
                          )
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
