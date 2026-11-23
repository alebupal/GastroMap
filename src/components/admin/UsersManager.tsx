"use client";

import { useState, useEffect, useMemo } from "react";
import {
  getAllUsersAction,
  updateUserRoleAction,
  toggleUserStatusAction,
  resetUserPasswordAction,
  deleteUserAction,
  deleteMultipleUsersAction,
  createUserDirectlyAction,
  updateUserByAdminAction,
  type SafeUser,
} from "@/lib/actions/users";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { useT } from "@/lib/i18n/client";

interface UsersManagerProps {
  currentUserId?: string;
}

export function UsersManager({ currentUserId }: UsersManagerProps) {
  const { t } = useT();
  const [isOpen, setIsOpen] = useState(true);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Búsqueda, paginación y selección múltiple
  const [filterQuery, setFilterQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());
  const [deletingMultiple, setDeletingMultiple] = useState(false);

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
      const data = await getAllUsersAction();
      setUsersList(data);
    } catch {
      setError("No se pudieron cargar los usuarios.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  // Filtrar lista de usuarios reactivamente por nombre, email o username
  const filteredUsers = useMemo(() => {
    const q = filterQuery.toLowerCase().trim();
    if (!q) return usersList;
    return usersList.filter(
      (u) =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.username && u.username.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersList, filterQuery]);

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
    } else {
      setSuccess(`${res.count || count} usuarios eliminados con éxito.`);
      setSelectedUserIds(new Set());
      await loadUsers();
    }
    setDeletingMultiple(false);
  }

  async function handleToggleRole(user: SafeUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    if (
      !confirm(
        `¿Cambiar el rol de @${user.username || user.name} a ${newRole === "admin" ? "Administrador" : "Usuario"
        }?`
      )
    )
      return;

    setError(null);
    setSuccess(null);
    const res = await updateUserRoleAction(user.id, newRole);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Rol de @${user.username || user.name} actualizado.`);
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

  async function handleDeleteUser(user: SafeUser) {
    if (!confirm(`¿Eliminar definitivamente al usuario @${user.username || user.name}?`))
      return;

    setError(null);
    setSuccess(null);
    const res = await deleteUserAction(user.id);
    if (res.error) {
      setError(res.error);
    } else {
      setSuccess(`Usuario @${user.username || user.name} eliminado.`);
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
    <div className="w-full p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">👥</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {t("admin_users.title")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("admin_users.subtitle")}
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-orange-600 hover:bg-orange-700 text-white transition active:scale-95 cursor-pointer"
        >
          {isOpen ? t("common.collapse") : t("common.manage")}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs font-medium">
              ⚠️ {error}
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
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold transition cursor-pointer shrink-0"
            >
              <span>{isAddUserOpen ? "✕" : `➕ ${t("admin_users.add_user")}`}</span>
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
                    <option value="user">Usuario estándar (puede ver y añadir sitios)</option>
                    <option value="admin">Administrador (acceso total a configuración y gestión)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    {t("common.language")}
                  </label>
                  <select
                    value={addLocale}
                    onChange={(e) => setAddLocale(e.target.value)}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                  >
                    <option value="es">🇪🇸 Español (es)</option>
                    <option value="en">🇬🇧 English (en)</option>
                  </select>
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
            <div className="flex items-center gap-2">
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
                  <span>🗑️</span>
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
                            className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold whitespace-nowrap ${u.role === "admin"
                              ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                              : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                              }`}
                          >
                            {u.role.toUpperCase()}
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
                      </div>
                    </div>

                    <div className="flex items-center justify-end sm:justify-start gap-1.5 flex-wrap pt-2.5 border-t border-slate-200/70 dark:border-slate-800 sm:pt-0 sm:border-0 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(u)}
                        disabled={isMe}
                        className={`px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 text-[11px] font-semibold transition ${isMe
                          ? "opacity-40 cursor-not-allowed text-slate-500"
                          : "hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer"
                          }`}
                        title={isMe ? t("admin_users.role") : t("admin_users.role")}
                      >
                        {u.role === "admin" ? t("admin_users.make_user") : t("admin_users.make_admin")}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleToggleStatus(u)}
                        disabled={isMe}
                        className={`px-2 py-1 rounded-lg border text-[11px] font-semibold transition ${isMe
                          ? "opacity-30 cursor-not-allowed border-slate-300 dark:border-slate-700 text-slate-500"
                          : u.status === "disabled"
                            ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 cursor-pointer"
                            : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-100 cursor-pointer"
                          }`}
                        title={t("admin_users.btn_toggle_status")}
                      >
                        {u.status === "disabled" ? "▶️" : "⏸️"}
                      </button>

                      <button
                        type="button"
                        onClick={() => handleStartEdit(u)}
                        className="px-2 py-1 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-[11px] font-semibold text-amber-700 dark:text-amber-300 transition cursor-pointer hover:bg-amber-100 dark:hover:bg-amber-900/60"
                        title={t("admin_users.edit_tooltip")}
                      >
                        ✏️
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setPasswordUserId(u.id);
                          setNewPassword("");
                        }}
                        className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-blue-300 transition cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/60"
                        title={t("admin_users.reset_password_btn_title")}
                      >
                        🔑
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u)}
                        disabled={isMe}
                        className={`px-2 py-1 rounded-lg text-xs transition ${isMe
                          ? "opacity-30 cursor-not-allowed text-slate-600"
                          : "text-slate-400 hover:text-red-500 cursor-pointer"
                          }`}
                        title={isMe ? t("admin_users.cannot_delete_self") : t("admin_users.delete_user_btn")}
                      >
                        🗑️
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
      )}

      {/* Modal para resetear contraseña */}
      {passwordUserId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleResetPassword}
            className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col text-left"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveEdit}
            className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 flex flex-col text-left space-y-4"
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <span className="text-xl">✏️</span>
                <div>
                  <h3 className="font-bold text-base text-slate-900 dark:text-slate-100">
                    {t("admin_users.edit_title")}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {t("admin_users.edit_subtitle")}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-xs font-bold p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
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
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                  {t("admin_users.username")}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs text-slate-400 font-bold">@</span>
                  <input
                    type="text"
                    required
                    value={editUsername}
                    onChange={(e) => setEditUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}
                    placeholder={t("admin_users.username_placeholder")}
                    className="w-full pl-7 pr-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
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
                    disabled={editingUser.id === currentUserId}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
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
                    className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 disabled:opacity-50"
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
                <select
                  value={editLocale}
                  onChange={(e) => setEditLocale(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
                >
                  <option value="es">🇪🇸 Español (es)</option>
                  <option value="en">🇬🇧 English (en)</option>
                </select>
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
                  className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-orange-500"
                />
                <span className="text-[10px] text-slate-400">
                  {t("admin_users.new_password_hint")}
                </span>
              </div>
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition cursor-pointer disabled:opacity-50 shadow-xs"
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
