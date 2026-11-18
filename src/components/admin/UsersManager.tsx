"use client";

import { useState, useEffect } from "react";
import {
  getAllUsersAction,
  updateUserRoleAction,
  resetUserPasswordAction,
  deleteUserAction,
  createUserDirectlyAction,
  type SafeUser,
} from "@/lib/actions/users";

export function UsersManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [usersList, setUsersList] = useState<SafeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Formulario de añadir usuario a mano
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addUsername, setAddUsername] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addRole, setAddRole] = useState<"user" | "admin">("user");
  const [addingUser, setAddingUser] = useState(false);

  // Modal para cambiar contraseña
  const [passwordUserId, setPasswordUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

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

  async function handleToggleRole(user: SafeUser) {
    const newRole = user.role === "admin" ? "user" : "admin";
    if (
      !confirm(
        `¿Cambiar el rol de @${user.username || user.name} a ${
          newRole === "admin" ? "Administrador" : "Usuario"
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
              Gestión de Usuarios
            </h3>
            <p className="text-xs text-slate-500">
              Administra roles, accesos y añade usuarios a mano directamente
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-slate-950 transition active:scale-95 cursor-pointer"
        >
          {isOpen ? "Ocultar" : "Gestionar"}
        </button>
      </div>

      {isOpen && (
        <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          {success && (
            <div className="p-2.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 text-xs">
              ✓ {success}
            </div>
          )}

          {/* Botón para desplegar formulario de añadir usuario */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              Usuarios ({usersList.length})
            </span>
            <button
              type="button"
              onClick={() => setIsAddUserOpen(!isAddUserOpen)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 border border-amber-500/30 text-xs font-bold transition cursor-pointer"
            >
              <span>{isAddUserOpen ? "✕ Cerrar formulario" : "➕ Añadir usuario a mano"}</span>
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
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                      className="w-full pl-6 pr-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Contraseña inicial
                  </label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                    Rol en la aplicación
                  </label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as "user" | "admin")}
                    className="w-full px-3 py-1.5 rounded-lg text-xs bg-slate-900 border border-slate-700 text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="user">Usuario estándar (puede ver y añadir sitios)</option>
                    <option value="admin">Administrador (acceso total a configuración y gestión)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingUser}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer disabled:opacity-50"
                >
                  {addingUser ? "Creando usuario..." : "Guardar usuario"}
                </button>
              </div>
            </form>
          )}

          {loading ? (
            <p className="text-xs text-slate-400 py-3 text-center">Cargando usuarios...</p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {usersList.map((u) => (
                <div
                  key={u.id}
                  className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-bold text-slate-900 dark:text-slate-100">
                        @{u.username || u.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                          u.role === "admin"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            : "bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                        }`}
                      >
                        {u.role.toUpperCase()}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 truncate">
                      {u.name} • {u.email}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggleRole(u)}
                      className="px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 text-[11px] font-semibold text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      title="Cambiar rol"
                    >
                      {u.role === "admin" ? "Hacer User" : "Hacer Admin"}
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setPasswordUserId(u.id);
                        setNewPassword("");
                      }}
                      className="px-2 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-[11px] font-semibold text-blue-700 dark:text-blue-300 transition cursor-pointer"
                      title="Restablecer contraseña"
                    >
                      🔑
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteUser(u)}
                      className="px-2 py-1 rounded-lg text-slate-400 hover:text-red-500 text-xs transition cursor-pointer"
                      title="Eliminar usuario"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
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
              🔑 Restablecer contraseña
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Introduce la nueva contraseña temporal para este usuario.
            </p>

            <input
              type="password"
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 6 caracteres)"
              className="w-full px-3 py-2 rounded-xl text-xs bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-amber-500 mb-4"
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPasswordUserId(null)}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={savingPassword}
                className="flex-1 py-2 px-3 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-slate-950 transition cursor-pointer disabled:opacity-50"
              >
                {savingPassword ? "Guardando..." : "Actualizar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
