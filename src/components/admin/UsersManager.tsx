"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getAllUsersAction,
  updateUserRoleAction,
  toggleUserStatusAction,
  resetUserPasswordAction,
  deleteUserAction,
  deleteMultipleUsersAction,
  getUserDeletionImpactAction,
  createUserDirectlyAction,
  updateUserByAdminAction,
  type SafeUser,
} from "@/lib/actions/users";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { impersonateUserAction } from "@/lib/actions/auth";
import {
  addGroupMemberAction,
  getAllGroupsAdminAction,
  removeGroupMemberAction,
  setGroupMemberRoleAction,
  type AdminGroupOverviewItem,
} from "@/lib/actions/groups";
import { InviteManager } from "@/components/InviteManager";
import { RoleLegendCard } from "./RoleLegendCard";
import { SegmentedTabs } from "@/components/ui/SegmentedTabs";
import { normalizeSearchText } from "@/lib/search";
import { LanguageSelector } from "@/components/ui/LanguageSelector";
import { useT } from "@/lib/i18n/client";
import { useToast } from "@/components/ui/Toast";
import type { Locale } from "@/lib/i18n/config";

interface UsersManagerProps {
  currentUserId?: string;
  allGroups?: AdminGroupOverviewItem[];
  initialSubTab?: "users" | "invites";
}

export function UsersManager({
  currentUserId,
  allGroups: initialAllGroups,
  initialSubTab = "users",
}: UsersManagerProps) {
  const { t } = useT();
  const { toast } = useToast();
  const [subTab, setSubTab] = useState<"users" | "invites">(initialSubTab);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [allGroupsList, setAllGroupsList] = useState<AdminGroupOverviewItem[]>(
    initialAllGroups || []
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Modal de gestión de grupos y roles de un usuario
  const [managingGroupsUserId, setManagingGroupsUserId] = useState<string | null>(null);
  const [groupModalSearch, setGroupModalSearch] = useState("");
  const [selectedNewGroupId, setSelectedNewGroupId] = useState("");
  const [busyGroupAction, setBusyGroupAction] = useState<string | null>(null);

  // Búsqueda, ordenación, paginación y selección múltiple
  const [filterQuery, setFilterQuery] = useState("");
  const [sortField, setSortField] = useState<"username" | "name" | "email" | "role" | "status" | "createdAt">("username");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  function toggleSort(field: "username" | "name" | "email" | "role" | "status" | "createdAt") {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir(field === "createdAt" ? "desc" : "asc");
    }
    setCurrentPage(1);
  }
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);
  const [impersonatingUserId, setImpersonatingUserId] = useState<string | null>(null);

  async function handleImpersonate(u: SafeUser) {
    if (u.id === currentUserId || u.status === "disabled") return;
    setImpersonatingUserId(u.id);
    try {
      const res = await impersonateUserAction(u.id);
      if (res.error) {
        toast(res.error, { kind: "error" });
        setImpersonatingUserId(null);
      } else {
        window.location.href = "/";
      }
    } catch {
      setImpersonatingUserId(null);
    }
  }

  // Formulario de añadir usuario a mano
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"user" | "admin">("user");
  const [addLocale, setAddLocale] = useState<string>("es");
  const [addingUser, setAddingUser] = useState(false);

  // Modal para cambiar contraseña
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  // Modal completo para editar usuario por el admin
  const [editingUser, setEditingUser] = useState<SafeUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editStatus, setEditStatus] = useState<"active" | "disabled">("active");
  const [editLocale, setEditLocale] = useState<string>("es");
  const [editPassword, setEditPassword] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  function handleStartEdit(u: SafeUser) {
    setEditingUser(u);
    setEditName(u.name);
    setEditUsername(u.username || "");
    setEditEmail(u.email);
    setEditRole(u.role === "admin" ? "admin" : "user");
    setEditStatus(u.status === "disabled" ? "disabled" : "active");
    setEditLocale(u.locale || "es");
    setEditPassword("");
    setError(null);
    setSuccess(null);
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingUser) return;
    setSavingEdit(true);
    setError(null);
    setSuccess(null);

    const res = await updateUserByAdminAction(editingUser.id, {
      name: editName,
      username: editUsername,
      email: editEmail,
      role: editRole,
      status: editStatus,
      locale: editLocale,
      newPassword: editPassword.trim() || undefined,
    });

    setSavingEdit(false);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Usuario @${editUsername || editName} actualizado correctamente.`);
      setEditingUser(null);
      loadUsers();
    }
  }

  async function loadUsers() {
    setLoading(true);
    try {
      const [data, groupsData] = await Promise.all([
        getAllUsersAction(),
        allGroupsList.length === 0 ? getAllGroupsAdminAction() : Promise.resolve(null),
      ]);
      setUsersList(data);
      if (groupsData) setAllGroupsList(groupsData);
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const managingGroupsUser = useMemo(
    () => (managingGroupsUserId ? usersList.find((u) => u.id === managingGroupsUserId) || null : null),
    [managingGroupsUserId, usersList]
  );

  const availableGroupsForModalUser = useMemo(() => {
    if (!managingGroupsUser) return [];
    const memberGroupIds = new Set((managingGroupsUser.groups || []).map((g) => g.groupId));
    return allGroupsList
      .filter((g) => !memberGroupIds.has(g.id))
      .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }));
  }, [managingGroupsUser, allGroupsList]);

  const filteredModalUserGroups = useMemo(() => {
    if (!managingGroupsUser?.groups) return [];
    const q = normalizeSearchText(groupModalSearch);
    const list = [...managingGroupsUser.groups].sort((a, b) =>
      a.groupName.localeCompare(b.groupName, "es", { sensitivity: "base" })
    );
    if (!q) return list;
    return list.filter((g) => normalizeSearchText(g.groupName).includes(q));
  }, [managingGroupsUser, groupModalSearch]);

  async function handleAddUserToGroup() {
    if (!managingGroupsUser || !selectedNewGroupId) return;
    setBusyGroupAction(`add:${selectedNewGroupId}`);
    const res = await addGroupMemberAction(selectedNewGroupId, managingGroupsUser.id);
    setBusyGroupAction(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("group_admin.member_added_toast"), { kind: "success" });
      setSelectedNewGroupId("");
      await loadUsers();
    }
  }

  async function handleRemoveUserFromGroup(userId: string, groupId: string, groupName: string) {
    if (!confirm(t("admin_users.confirm_remove_from_group", { group: groupName }))) return;
    setBusyGroupAction(`rm:${groupId}`);
    const res = await removeGroupMemberAction(groupId, userId);
    setBusyGroupAction(null);
    if (res.error) {
      toast(res.error, { kind: "error" });
    } else {
      toast(t("group_admin.member_removed_toast"), { kind: "success" });
      await loadUsers();
    }
  }

  // Filtrar y ordenar lista de usuarios reactivamente por nombre, email, username, rol o estado
  const filteredUsers = useMemo(() => {
    const q = normalizeSearchText(filterQuery);
    const base = !q
      ? [...usersList]
      : usersList.filter(
          (u) =>
            normalizeSearchText(u.name).includes(q) ||
            normalizeSearchText(u.email).includes(q) ||
            (u.username && normalizeSearchText(u.username).includes(q)) ||
            normalizeSearchText(u.role).includes(q)
        );

    const dir = sortDir === "asc" ? 1 : -1;
    return base.sort((a, b) => {
      switch (sortField) {
        case "username":
          return (
            (a.username || a.name).localeCompare(b.username || b.name, "es", {
              sensitivity: "base",
            }) * dir
          );
        case "name":
          return a.name.localeCompare(b.name, "es", { sensitivity: "base" }) * dir;
        case "email":
          return a.email.localeCompare(b.email, "es", { sensitivity: "base" }) * dir;
        case "role": {
          const cmp = a.role.localeCompare(b.role) * dir;
          return cmp !== 0
            ? cmp
            : (a.username || a.name).localeCompare(b.username || b.name, "es");
        }
        case "status": {
          const cmp = a.status.localeCompare(b.status) * dir;
          return cmp !== 0
            ? cmp
            : (a.username || a.name).localeCompare(b.username || b.name, "es");
        }
        case "createdAt":
        default:
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
      }
    });
  }, [usersList, filterQuery, sortField, sortDir]);

  // Paginación de usuarios
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const safePage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedUsers = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredUsers.slice(start, start + pageSize);
  }, [filteredUsers, safePage, pageSize]);

  // Usuarios seleccionables en la vista actual (excluyendo la cuenta propia del admin)
  const selectableUsers = useMemo(() => {
    return paginatedUsers.filter((u) => u.id !== currentUserId);
  }, [paginatedUsers, currentUserId]);

  const allSelectableAreSelected =
    selectableUsers.length > 0 &&
    selectableUsers.every((u) => selectedUserIds.has(u.id));

  function handleToggleSelectAll() {
    if (allSelectableAreSelected) {
      // Deseleccionar los visibles
      const next = new Set(selectedUserIds);
      selectableUsers.forEach((u) => next.delete(u.id));
      setSelectedUserIds(next);
    } else {
      // Seleccionar todos los visibles elegibles
      const next = new Set(selectedUserIds);
      selectableUsers.forEach((u) => next.add(u.id));
      setSelectedUserIds(next);
    }
  }

  function handleToggleUser(userId: string) {
    if (userId === currentUserId) return;
    const next = new Set(selectedUserIds);
    if (next.has(userId)) {
      next.delete(userId);
    } else {
      next.add(userId);
    }
    setSelectedUserIds(next);
  }

  async function handleToggleStatus(user: SafeUser) {
    const isCurrentlyDisabled = user.status === "disabled";
    if (
      !isCurrentlyDisabled &&
      !confirm(
        `¿Desactivar la cuenta de @${user.username || user.name}? Sus sesiones activas se cerrarán inmediatamente, pero se conservarán sus datos.`
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    const res = await toggleUserStatusAction(user.id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(
        res.status === "disabled"
          ? `Cuenta de @${user.username || user.name} desactivada.`
          : `Cuenta de @${user.username || user.name} reactivada.`
      );
      loadUsers();
    }
  }

  async function handleDeleteMultiple() {
    const count = selectedUserIds.size;
    if (count === 0) return;

    if (
      !confirm(
        `¿Eliminar definitivamente a los ${count} usuarios seleccionados?\n\nEsta acción eliminará sus cuentas de forma permanente.`
      )
    ) {
      return;
    }

    setDeletingMultiple(true);
    setError(null);
    setSuccess(null);

    const res = await deleteMultipleUsersAction(Array.from(selectedUserIds));
    if (res.error) {
      setError(res.error);
      toast(res.error, { kind: "error" });
    } else {
      const msg = `${res.count || count} usuarios eliminados con éxito.`;
      setSuccess(msg);
      toast(msg, { kind: "success" });
      setSelectedUserIds(new Set());
      await loadUsers();
    }
    setDeletingMultiple(false);
  }

  async function handleToggleRole(user: SafeUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    if (
      !confirm(
        `¿Cambiar el rol global de @${user.username || user.name} a ${
          newRole === "admin" ? "Superadministrador" : "Usuario"
        }?`
      )
    )
      return;

    setError(null);
    setSuccess(null);
    const res = await updateUserRoleAction(user.id, newRole);
    if (res.error) {
      setError(res.error);
      toast(res.error, { kind: "error" });
    } else {
      const msg = `Rol global de @${user.username || user.name} actualizado.`;
      setSuccess(msg);
      toast(msg, { kind: "success" });
      loadUsers();
    }
  }

  async function handleChangeUserGroupRole(
    userId: string,
    groupId: string,
    newRole: "owner" | "admin" | "member"
  ) {
    setError(null);
    setSuccess(null);
    const res = await setGroupMemberRoleAction(groupId, userId, newRole);
    if (res.error) {
      setError(res.error);
      toast(res.error, { kind: "error" });
    } else {
      toast(t("group_admin.role_updated_toast"), { kind: "success" });
      loadUsers();
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!passwordUserId || !newPassword) return;
    setSavingPassword(true);
    setError(null);

    const res = await resetUserPasswordAction(passwordUserId, newPassword);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Contraseña restablecida con éxito.");
      setPasswordUserId(null);
      setNewPassword("");
    }
    setSavingPassword(false);
  }

  // Modal de baja segura de usuario (Punto 13)
  const [deleteImpactUser, setDeleteImpactUser] = useState<{
    user: SafeUser;
    ownedGroups: Array<{ id: string; name: string; icon: string }>;
    groupPlacesCount: number;
    groupCommentsCount: number;
    personalPlacesCount: number;
  } | null>(null);
  const [deletingWithStrategy, setDeletingWithStrategy] = useState(false);

  async function handleDeleteUser(user: SafeUser) {
    const impact = await getUserDeletionImpactAction(user.id);
    if (
      impact &&
      (impact.ownedGroups.length > 0 ||
        impact.groupPlacesCount > 0 ||
        impact.groupCommentsCount > 0)
    ) {
      setDeleteImpactUser({ user, ...impact });
      return;
    }

    if (!confirm(`¿Eliminar definitivamente al usuario @${user.username || user.name}?`))
      return;

    await executeUserDeletion(user, "reassign_owner");
  }

  async function executeUserDeletion(
    user: SafeUser,
    strategy: "reassign_owner" | "delete"
  ) {
    setDeletingWithStrategy(true);
    setError(null);
    setSuccess(null);
    const res = await deleteUserAction(user.id, { groupDataStrategy: strategy });
    setDeletingWithStrategy(false);
    if (res.error) {
      setError(res.error);
      toast(res.error, { kind: "error" });
    } else {
      const msg = `Usuario @${user.username || user.name} eliminado.`;
      setSuccess(msg);
      toast(msg, { kind: "success" });
      setDeleteImpactUser(null);
      setSelectedUserIds((prev) => {
        const next = new Set(prev);
        next.delete(user.id);
        return next;
      });
      loadUsers();
    }
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    setAddingUser(true);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("name", addName);
    formData.append("username", addUsername);
    formData.append("email", addEmail);
    formData.append("password", addPassword);
    formData.append("role", addRole);
    formData.append("locale", addLocale);

    const res = await createUserDirectlyAction(formData);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Usuario @${addUsername || addName} creado con éxito.`);
      setAddName("");
      setAddUsername("");
      setAddEmail("");
      setAddPassword("");
      setAddRole("user");
      setAddLocale("es");
      setIsAddUserOpen(false);
      loadUsers();
    }
    setAddingUser(false);
  }

  return (
    <div className="space-y-4 text-left">
      {/* Sub-pestañas: Usuarios | Invitaciones de plataforma */}
      <SegmentedTabs
        value={subTab}
        onChange={setSubTab}
        ariaLabel={t("admin_users.title")}
        items={[
          {
            id: "users",
            label: t("admin_users.tab_users"),
            icon: "group",
            badge: usersList.length,
          },
          {
            id: "invites",
            label: t("admin_users.tab_invites"),
            icon: "confirmation_number",
          },
        ]}
      />

      <div key={subTab} className="gm-tab-in">
      {subTab === "invites" ? (
        <InviteManager />
      ) : (
        <div className="w-full p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-xl leading-none">group</span>
              </div>
              <div>
                <h3 className="text-sm font-extrabold text-slate-900 dark:text-slate-100">
                  {t("admin_users.title")}
                </h3>
                <p className="text-xs text-slate-500">
                  {t("admin_users.subtitle")}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
            <RoleLegendCard scope="all" />
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium flex items-center gap-1.5">
              <span className="material-symbols-outlined text-sm leading-none shrink-0">warning</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
              ✓ {success}
            </div>
          )}

          {/* Barra de cabecera con buscador y botón de añadir usuario */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 w-full sm:max-w-sm">
              <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                search
              </span>
              <input
                type="text"
                value={filterQuery}
                onChange={(e) => setFilterQuery(e.target.value)}
                placeholder={t("admin_users.search_placeholder").replace(/^🔍\s*/, "")}
                className="w-full pl-9 pr-8 py-2 rounded-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              {filterQuery && (
                <button
                  type="button"
                  onClick={() => setFilterQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsAddUserOpen(!isAddUserOpen)}
              className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer shrink-0 shadow-xs"
            >
              <span className="material-symbols-outlined text-sm leading-none">
                {isAddUserOpen ? "close" : "person_add"}
              </span>
              <span>{isAddUserOpen ? t("common.cancel") : t("admin_users.add_user")}</span>
            </button>
          </div>

          {/* Formulario para añadir usuario directamente */}
          {isAddUserOpen && (
            <form
              onSubmit={handleCreateUser}
              className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3 animate-in fade-in duration-150"
            >
              <h4 className="text-xs font-bold text-amber-500 uppercase tracking-wider">
                Nuevo usuario manual
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Nombre completo
                  </label>
                  <input
                    type="text"
                    required
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    placeholder="Ej. Carlos Gómez"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Nombre de usuario (@username)
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-500 font-bold">@</span>
                    <input
                      type="text"
                      required
                      value={addUsername}
                      onChange={(e) => setAddUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                      placeholder="carlosg"
                      className="w-full pl-6 pr-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Correo electrónico
                  </label>
                  <input
                    type="email"
                    required
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    placeholder="carlos@ejemplo.com"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Contraseña inicial
                  </label>
                  <input
                    type="password"
                    required
                    minLength={4}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Mínimo 4 caracteres (ej. 1234)"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Rol en la aplicación
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "user" | "admin")}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="user">Usuario estándar (acceso a su mapa personal y sus grupos)</option>
                    <option value="admin">Superadministrador (acceso global a toda la plataforma)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {t("common.language")}
                  </label>
                  <LanguageSelector
                    value={(addLocale as Locale) || "es"}
                    onChange={(next) => setAddLocale(next)}
                    fullWidth
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  {t("admin_users.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer disabled:opacity-50"
                >
                  {addingUser ? t("common.loading") : t("admin_users.create_user")}
                </button>
              </div>
            </form>
          )}

          {/* Barra de acción para selección múltiple */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={allSelectableAreSelected}
                  onChange={handleToggleSelectAll}
                  disabled={selectableUsers.length === 0}
                  className="rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500 cursor-pointer w-4 h-4"
                />
                <span>
                  {t("admin_places.col_select_all")} ({selectableUsers.length})
                </span>
              </label>

              {selectedUserIds.size > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40">
                  {selectedUserIds.size} {t("admin_places.delete_selected")}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap text-[11px]">
              {(
                [
                  { id: "username", label: "@Usuario" },
                  { id: "name", label: t("common.sort_title") },
                  { id: "email", label: "Email" },
                  { id: "role", label: t("admin_users.role") },
                  { id: "status", label: t("common.sort_status") },
                  { id: "createdAt", label: t("common.sort_date") },
                ] as const
              ).map((col) => {
                const active = sortField === col.id;
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => toggleSort(col.id)}
                    className={`inline-flex items-center gap-0.5 px-2 py-1 rounded-lg font-bold transition cursor-pointer ${
                      active
                        ? "bg-orange-600 text-white shadow-xs"
                        : "bg-white dark:bg-slate-900/70 text-slate-600 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700 hover:border-orange-400"
                    }`}
                  >
                    <span>{col.label}</span>
                    <span className="material-symbols-outlined text-[13px] leading-none">
                      {active ? (sortDir === "asc" ? "arrow_upward" : "arrow_downward") : "unfold_more"}
                    </span>
                  </button>
                );
              })}
            </div>

            {selectedUserIds.size > 0 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserIds(new Set())}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-300 transition cursor-pointer"
                >
                  {t("places.reset_filters")}
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMultiple}
                  disabled={deletingMultiple}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs transition cursor-pointer shadow-sm disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-sm leading-none">delete</span>
                  <span>
                    {deletingMultiple
                      ? t("common.loading")
                      : `${t("admin_users.delete_selected")} (${selectedUserIds.size})`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {loading ? (
            <p className="text-xs text-slate-400 py-3 text-center">{t("admin_users.loading_users")}</p>
          ) : filteredUsers.length === 0 ? (
            <p className="text-xs text-slate-500 py-4 text-center italic">
              {t("admin_users.no_users_found", {
                query: filterQuery ? t("admin_users.matching_query", { query: filterQuery }) : "",
              })}
            </p>
          ) : (
            <div className="space-y-2">
              {paginatedUsers.map((u) => {
                const isMe = u.id === currentUserId;
                const isSelected = selectedUserIds.has(u.id);

                return (
                  <div
                    key={u.id}
                    className={`p-3.5 rounded-2xl border transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs ${isSelected
                      ? "border-amber-500/60 bg-amber-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40"
                      }`}
                  >
                    <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                      {/* Checkbox para borrado masivo (deshabilitado para el propio usuario admin) */}
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleUser(u.id)}
                        disabled={isMe}
                        title={isMe ? t("admin_users.cannot_select_self") : t("admin_users.select_user")}
                        className={`mt-0.5 sm:mt-0 rounded border-slate-300 dark:border-slate-700 text-amber-500 focus:ring-orange-500 w-4 h-4 shrink-0 ${isMe ? "opacity-30 cursor-not-allowed" : "cursor-pointer"
                          }`}
                      />

                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-slate-100 break-all">
                            @{u.username || u.name}
                          </span>
                          {isMe && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 whitespace-nowrap">
                              {t("common.you").toUpperCase()}
                            </span>
                          )}
                          <span
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold whitespace-nowrap border ${
                              u.role === "admin"
                                ? "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30"
                                : "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300/60 dark:border-slate-600"
                            }`}
                          >
                            {u.role === "admin" ? "SUPERADMIN" : t("admin_users.role_user").toUpperCase()}
                          </span>
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 whitespace-nowrap">
                            {u.locale === "en" ? "🇬🇧 EN" : "🇪🇸 ES"}
                          </span>
                          {u.status === "disabled" && (
                            <span className="px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-red-500/15 text-red-500 border border-red-500/30 whitespace-nowrap">
                              {t("common.inactive").toUpperCase()}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {u.name} • {u.email}
                        </div>

                        {/* Resumen compacto escalable: botón para gestionar grupos y contador de sitios */}
                        <div className="flex items-center gap-1.5 flex-wrap pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setManagingGroupsUserId(u.id);
                              setGroupModalSearch("");
                              setSelectedNewGroupId("");
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#f2f3ff] dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:border-orange-400 hover:text-orange-600 dark:hover:text-orange-400 transition cursor-pointer"
                          >
                            <span className="material-symbols-outlined text-xs leading-none text-orange-600">
                              diversity_3
                            </span>
                            <span>
                              {t("admin_users.groups_btn", { count: u.groups?.length ?? 0 })}
                            </span>
                            <span className="material-symbols-outlined text-xs leading-none text-slate-400">
                              chevron_right
                            </span>
                          </button>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400">
                            <span className="material-symbols-outlined text-xs leading-none">
                              storefront
                            </span>
                            <span>{t("admin_users.places_badge", { count: u.placesCount ?? 0 })}</span>
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-end sm:justify-start gap-1.5 flex-wrap pt-2.5 border-t border-slate-200/70 dark:border-slate-800 sm:pt-0 sm:border-0 shrink-0">
                      {!isMe && u.status !== "disabled" && (
                        <button
                          type="button"
                          onClick={() => handleImpersonate(u)}
                          disabled={impersonatingUserId !== null}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-950/50 border border-orange-200/80 dark:border-orange-800/60 text-orange-700 dark:text-orange-300 hover:bg-orange-100 dark:hover:bg-orange-900/50 text-[11px] font-bold transition cursor-pointer disabled:opacity-50"
                          title={t("impersonation.btn_login_as")}
                        >
                          <span className="material-symbols-outlined text-[15px] leading-none">login</span>
                          <span>
                            {impersonatingUserId === u.id
                              ? t("common.loading")
                              : t("impersonation.btn_login_as")}
                          </span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleToggleRole(u)}
                        disabled={isMe && usersList.filter((x) => x.role === "admin").length <= 1}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-bold transition ${
                          isMe && usersList.filter((x) => x.role === "admin").length <= 1
                            ? "opacity-40 cursor-not-allowed border-slate-300 dark:border-slate-700 text-slate-500"
                            : u.role === "admin"
                              ? "border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                              : "border-violet-300 dark:border-violet-800 bg-violet-50/70 dark:bg-violet-950/40 hover:bg-violet-100 dark:hover:bg-violet-900/50 text-violet-700 dark:text-violet-300 cursor-pointer"
                        }`}
                        title={t("admin_users.role")}
                      >
                        {u.role === "admin" ? t("admin_users.make_user") : t("admin_users.make_admin")}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        disabled={isMe}
                        className={`p-1.5 rounded-lg border text-[11px] font-semibold transition inline-flex items-center justify-center ${isMe
                          ? "opacity-30 cursor-not-allowed border-slate-300 dark:border-slate-700 text-slate-500"
                          : u.status === "disabled"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                          }`}
                        title={t("admin_users.btn_toggle_status")}
                        aria-label={t("admin_users.btn_toggle_status")}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none">
                          {u.status === "disabled" ? "play_arrow" : "pause"}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(u)}
                        className="p-1.5 rounded-lg bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer hover:bg-slate-300 dark:hover:bg-slate-600 inline-flex items-center justify-center"
                        title={t("admin_users.edit_tooltip")}
                        aria-label={t("admin_users.edit_tooltip")}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none">edit</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasswordUserId(u.id);
                          setNewPassword("");
                        }}
                        className="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300 transition cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60 inline-flex items-center justify-center"
                        title={t("admin_users.reset_password_btn_title")}
                        aria-label={t("admin_users.reset_password_btn_title")}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none">key</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        disabled={isMe}
                        className={`p-1.5 rounded-lg transition inline-flex items-center justify-center ${isMe
                          ? "opacity-30 cursor-not-allowed bg-slate-100 dark:bg-slate-800 text-slate-400"
                          : "bg-red-100 dark:bg-red-950/60 text-red-700 dark:text-red-300 hover:bg-red-200 cursor-pointer"
                          }`}
                        title={isMe ? t("admin_users.cannot_delete_self") : t("admin_users.delete_user_btn")}
                        aria-label={isMe ? t("admin_users.cannot_delete_self") : t("admin_users.delete_user_btn")}
                      >
                        <span className="material-symbols-outlined text-[15px] leading-none">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })}
              <PaginationBar
                currentPage={safePage}
                totalItems={filteredUsers.length}
                pageSize={pageSize}
                onPageChange={setCurrentPage}
                onPageSizeChange={setPageSize}
                itemLabel="usuarios"
              />
            </div>
          )}
          </div>
        </div>
      )}
      </div>

      {/* Modal para gestionar los grupos y roles de un usuario */}
      {managingGroupsUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in">
          <div className="w-full max-w-lg max-h-[92dvh] sm:max-h-[86dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col text-left overflow-hidden gm-modal-in">
            <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl leading-none">diversity_3</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                    {t("admin_users.groups_modal_title", {
                      username: `@${managingGroupsUser.username || managingGroupsUser.name}`,
                    })}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {t("admin_users.groups_modal_subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setManagingGroupsUserId(null)}
                className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={t("common.close")}
              >
                <span className="material-symbols-outlined text-lg leading-none">close</span>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
              {/* Buscador si pertenece a varios grupos */}
              {(managingGroupsUser.groups?.length ?? 0) > 4 && (
                <div className="relative">
                  <span className="material-symbols-outlined text-base text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none leading-none">
                    search
                  </span>
                  <input
                    type="text"
                    value={groupModalSearch}
                    onChange={(e) => setGroupModalSearch(e.target.value)}
                    placeholder={t("admin_groups.search_placeholder")}
                    className="w-full pl-9 pr-3 py-2 rounded-full text-xs bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              )}

              {/* Lista de grupos actuales del usuario */}
              {filteredModalUserGroups.length === 0 ? (
                <div className="p-4 rounded-2xl bg-[#f8f9ff] dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 text-xs text-slate-500 text-center italic">
                  {t("admin_users.groups_modal_empty")}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredModalUserGroups.map((gm) => (
                    <div
                      key={gm.groupId}
                      className="p-3 rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-800/40 flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-base shrink-0">{gm.groupIcon}</span>
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">
                          {gm.groupName}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <select
                          value={gm.role}
                          onChange={(e) =>
                            handleChangeUserGroupRole(
                              managingGroupsUser.id,
                              gm.groupId,
                              e.target.value as "owner" | "admin" | "member"
                            )
                          }
                          aria-label={`${gm.groupName} role`}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border focus:outline-none cursor-pointer ${
                            gm.role === "owner"
                              ? "bg-orange-50 dark:bg-orange-950/50 border-orange-300 dark:border-orange-800 text-orange-800 dark:text-orange-200"
                              : gm.role === "admin"
                                ? "bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
                                : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300"
                          }`}
                        >
                          <option value="member" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                            {t("group_admin.member_badge")}
                          </option>
                          <option value="admin" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                            {t("spaces.group_admin_badge")}
                          </option>
                          <option value="owner" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-200">
                            {t("group_admin.owner_badge")}
                          </option>
                        </select>

                        {gm.role !== "owner" && (
                          <button
                            type="button"
                            onClick={() =>
                              handleRemoveUserFromGroup(
                                managingGroupsUser.id,
                                gm.groupId,
                                gm.groupName
                              )
                            }
                            disabled={busyGroupAction === `rm:${gm.groupId}`}
                            className="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/70 transition cursor-pointer disabled:opacity-40"
                            title={t("admin_users.remove_from_group")}
                            aria-label={t("admin_users.remove_from_group")}
                          >
                            <span className="material-symbols-outlined text-sm leading-none">
                              person_remove
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Añadir a otro grupo existente */}
              {availableGroupsForModalUser.length > 0 && (
                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 space-y-2">
                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-400">
                    {t("admin_users.add_to_group_label")}
                  </label>
                  <div className="flex items-center gap-2">
                    <SearchableSelect
                      value={selectedNewGroupId}
                      onChange={setSelectedNewGroupId}
                      options={availableGroupsForModalUser
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name, "es", { sensitivity: "base" }))
                        .map((g) => ({
                          value: g.id,
                          label: g.name,
                          icon: <span>{g.icon}</span>,
                        }))}
                      placeholder={t("admin_users.add_to_group_placeholder")}
                      searchPlaceholder={t("admin_groups.search_placeholder")}
                      ariaLabel={t("admin_users.add_to_group_label")}
                      className="flex-1 min-w-0"
                      buttonClassName="w-full justify-between !rounded-xl !px-3 !py-2 !text-xs bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={handleAddUserToGroup}
                      disabled={!selectedNewGroupId || busyGroupAction !== null}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-40 shrink-0"
                    >
                      <span className="material-symbols-outlined text-sm leading-none">add</span>
                      <span>{t("admin_users.add_to_group_btn")}</span>
                    </button>
                  </div>
                </div>
              )}

              {/* Leyenda explicativa de roles dentro de grupos */}
              <RoleLegendCard scope="group" variant="compact" />
            </div>

            <div className="px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 flex justify-end border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setManagingGroupsUserId(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition cursor-pointer"
              >
                {t("common.close")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación segura al eliminar usuario con datos en grupos */}
      {deleteImpactUser && (
        <div className="fixed inset-0 z-[1100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 space-y-4 text-left gm-modal-in">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900/50 text-rose-600 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl leading-none">person_off</span>
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-slate-900 dark:text-slate-100">
                    {t("admin_users.safe_delete_title", {
                      username: `@${deleteImpactUser.user.username || deleteImpactUser.user.name}`,
                    })}
                  </h3>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t("admin_users.safe_delete_subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteImpactUser(null)}
                className="w-8 h-8 rounded-full bg-[#f2f3ff] dark:bg-slate-800 flex items-center justify-center text-slate-500 cursor-pointer"
              >
                <span className="material-symbols-outlined text-base leading-none">close</span>
              </button>
            </div>

            {deleteImpactUser.ownedGroups.length > 0 ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <p className="font-bold">{t("admin_users.safe_delete_owner_block")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {deleteImpactUser.ownedGroups.map((g) => (
                    <span
                      key={g.id}
                      className="px-2 py-0.5 rounded-full bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 text-[11px] font-bold"
                    >
                      {g.icon} {g.name}
                    </span>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const uId = deleteImpactUser.user.id;
                    setDeleteImpactUser(null);
                    setManagingGroupsUserId(uId);
                  }}
                  className="px-3.5 py-1.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold cursor-pointer transition"
                >
                  {t("admin_users.safe_delete_transfer_btn")}
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs">
                <div className="p-3 rounded-2xl bg-[#f8f9ff] dark:bg-slate-800/50 border border-slate-200/70 dark:border-slate-800 space-y-1">
                  <div>
                    • {t("admin_users.safe_delete_group_places", { count: deleteImpactUser.groupPlacesCount })}
                  </div>
                  <div>
                    • {t("admin_users.safe_delete_group_comments", { count: deleteImpactUser.groupCommentsCount })}
                  </div>
                  <div>
                    • {t("admin_users.safe_delete_personal_places", { count: deleteImpactUser.personalPlacesCount })}
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    disabled={deletingWithStrategy}
                    onClick={() => executeUserDeletion(deleteImpactUser.user, "reassign_owner")}
                    className="w-full py-2.5 px-4 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {t("admin_users.safe_delete_reassign_btn")}
                  </button>
                  <button
                    type="button"
                    disabled={deletingWithStrategy}
                    onClick={() => executeUserDeletion(deleteImpactUser.user, "delete")}
                    className="w-full py-2.5 px-4 rounded-full bg-rose-100 hover:bg-rose-200 dark:bg-rose-950/60 dark:hover:bg-rose-900/70 text-rose-700 dark:text-rose-300 font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    {t("admin_users.safe_delete_purge_btn")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal para resetear contraseña */}
      {passwordUserId && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in">
          <form
            onSubmit={handleResetPassword}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 p-5 sm:p-6 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] sm:pb-6 flex flex-col text-left gm-modal-in"
          >
            <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 mb-2">
              {t("admin_users.reset_password_title")}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              {t("admin_users.reset_password_desc")}
            </p>

            <input
              type="password"
              required
              minLength={4}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("admin_users.reset_password_input_placeholder")}
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasswordUserId(null)}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? t("common.saving") : t("admin_users.reset_password_update_btn")}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal interactivo para edición completa de usuario por el Admin */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-sm gm-backdrop-in">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md max-h-[94dvh] sm:max-h-[90dvh] bg-white dark:bg-slate-900 rounded-t-3xl sm:rounded-3xl shadow-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col text-left overflow-hidden gm-modal-in"
          >
            <div className="px-5 sm:px-6 py-4 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-2xl bg-orange-50 dark:bg-orange-950/50 border border-orange-200/70 dark:border-orange-900/50 text-orange-600 dark:text-orange-400 flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-xl leading-none">manage_accounts</span>
                </div>
                <div className="min-w-0">
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100 truncate">
                    {t("admin_users.edit_title")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {t("admin_users.edit_subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 dark:text-slate-300 flex items-center justify-center shrink-0 cursor-pointer"
                aria-label={t("common.close")}
              >
                <span className="material-symbols-outlined text-lg leading-none">close</span>
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-3 overflow-y-auto flex-1 min-h-0">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("admin_users.full_name")}
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder={t("admin_users.full_name_placeholder")}
                  className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("admin_users.username")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 sm:top-2 text-xs text-slate-400 font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder={t("admin_users.username_placeholder")}
                    className="w-full pl-7 pr-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("admin_users.email")}
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value.toLowerCase())}
                  placeholder={t("admin_users.email_placeholder")}
                  className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t("admin_users.role")}
                  </label>
                  <select
                    value={editRole}
                    onChange={(e) => setEditRole(e.target.value as "user" | "admin")}
                    disabled={
                      editingUser.id === currentUserId &&
                      usersList.filter((x) => x.role === "admin").length <= 1
                    }
                    className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  >
                    <option value="user">{t("admin_users.role_user_option")}</option>
                    <option value="admin">{t("admin_users.role_admin_option")}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {t("admin_users.account_status")}
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as "active" | "disabled")}
                    disabled={editingUser.id === currentUserId}
                    className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
                  >
                    <option value="active">{t("admin_users.status_active_option")}</option>
                    <option value="disabled">{t("admin_users.status_disabled_option")}</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("common.language")}
                </label>
                <LanguageSelector
                  value={(editLocale as Locale) || "es"}
                  onChange={(next) => setEditLocale(next)}
                  fullWidth
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("admin_users.new_password_optional")}
                </label>
                <input
                  type="password"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder={t("admin_users.new_password_leave_blank")}
                  className="w-full px-3 py-2 rounded-xl text-base sm:text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-[10px] text-slate-400">
                  {t("admin_users.new_password_hint")}
                </span>
              </div>
            </div>

            <div className="px-5 sm:px-6 pt-3 pb-[calc(0.875rem+env(safe-area-inset-bottom,0px))] sm:py-3.5 flex gap-2 border-t border-slate-100 dark:border-slate-800 shrink-0 bg-white dark:bg-slate-900">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 py-2.5 sm:py-2 px-3 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer disabled:opacity-50 shadow-xs"
              >
                {savingEdit ? t("common.saving") : t("admin_users.save_changes_btn")}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
