"use client";

import { useState, useEffect, useCallback } from "react";
import {
  createInvitationAction,
  getAllInvitationsAction,
  deleteInvitationAction,
  type SafeInvitation,
} from "@/lib/actions/auth";

export function InviteManager() {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [invitations, setInvitations] = useState<SafeInvitation[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadInvitations = useCallback(async () => {
    setLoadingList(true);
    try {
      const data = await getAllInvitationsAction();
      setInvitations(data);
    } catch {
      // Ignorar si no hay permisos
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    loadInvitations();
  }, [loadInvitations]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);
    setCreatedUrl(null);

    const form = e.currentTarget;
    const formData = new FormData(form);
    const result = await createInvitationAction(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      const fullUrl = `${window.location.origin}${result.url}`;
      setCreatedUrl(fullUrl);
      setSuccess("¡Enlace de invitación generado con éxito!");
      form.reset();
      loadInvitations();
    }
  }

  function handleCopy(url: string, tokenId: string) {
    navigator.clipboard.writeText(url);
    setCopiedToken(tokenId);
    setTimeout(() => setCopiedToken(null), 2500);
  }

  async function handleDelete(invitation: SafeInvitation) {
    const isUsed = invitation.usedAt !== null;
    const isExpired = new Date(invitation.expiresAt) < new Date();
    const promptText = isUsed
      ? "¿Eliminar este registro de invitación ya utilizada?"
      : isExpired
      ? "¿Eliminar esta invitación caducada?"
      : "¿Revocar y eliminar esta invitación activa antes de su vencimiento? El enlace dejará de ser válido inmediatamente.";

    if (!confirm(promptText)) return;

    setDeletingId(invitation.id);
    setError(null);
    setSuccess(null);

    const res = await deleteInvitationAction(invitation.id);
    setDeletingId(null);

    if (res.error) {
      setError(res.error);
    } else {
      setSuccess("Invitación eliminada correctamente.");
      loadInvitations();
    }
  }

  const now = new Date();

  return (
    <div className="w-full mt-4 p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-xl">🎟️</span>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <span>Invitaciones privadas</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                {invitations.length} {invitations.length === 1 ? "enlace" : "enlaces"}
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Genera enlaces de acceso exclusivo para amigos, pareja o familia y revócalos en cualquier momento.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold transition cursor-pointer self-start sm:self-center shadow-xs"
        >
          <span>{isFormOpen ? "✕ Cerrar formulario" : "➕ Crear nueva invitación"}</span>
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 text-xs font-medium">
          ⚠️ {error}
        </div>
      )}

      {success && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 text-xs font-medium">
          ✓ {success}
        </div>
      )}

      {/* Formulario desplegable para generar invitación */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 space-y-3.5 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">
              Nueva invitación
            </h4>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
              Email del invitado (opcional, déjalo vacío para enlace libre reutilizable)
            </label>
            <input
              type="email"
              name="email"
              placeholder="amigo@email.com (o vacío para cualquiera con el enlace)"
              className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder:text-slate-400 dark:placeholder:text-slate-600 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Rol otorgado
              </label>
              <select
                name="role"
                defaultValue="user"
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="user">Usuario estándar</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                Tiempo de validez (días hasta caducidad)
              </label>
              <input
                type="number"
                name="days"
                defaultValue={7}
                min={1}
                max={90}
                className="w-full px-3 py-2 rounded-xl text-xs bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-black transition active:scale-[0.99] disabled:opacity-50 cursor-pointer shadow-xs"
          >
            {loading ? "Generando invitación..." : "Generar enlace de invitación"}
          </button>

          {createdUrl && (
            <div className="p-3 rounded-xl bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 space-y-1.5">
              <p className="text-xs font-bold text-amber-900 dark:text-amber-200">
                ¡Enlace generado listo para compartir!
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={createdUrl}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 select-all font-mono text-slate-800 dark:text-slate-200"
                />
                <button
                  type="button"
                  onClick={() => handleCopy(createdUrl, "new-token")}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 shrink-0 transition cursor-pointer"
                >
                  {copiedToken === "new-token" ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}
        </form>
      )}

      {/* Lista de invitaciones existentes */}
      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
        <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 flex items-center justify-between">
          <span>Enlaces de invitación registrados</span>
          <button
            type="button"
            onClick={loadInvitations}
            disabled={loadingList}
            className="text-[11px] text-amber-600 dark:text-amber-400 hover:underline cursor-pointer"
          >
            {loadingList ? "Actualizando..." : "🔄 Refrescar"}
          </button>
        </h4>

        {loadingList && invitations.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">Cargando invitaciones...</p>
        ) : invitations.length === 0 ? (
          <div className="p-6 text-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-xs text-slate-400 italic">
            No hay ninguna invitación registrada actualmente. Pulsa «➕ Crear nueva invitación» para generar la primera.
          </div>
        ) : (
          <div className="space-y-2">
            {invitations.map((inv) => {
              const isUsed = inv.usedAt !== null;
              const isExpired = !isUsed && new Date(inv.expiresAt) < now;
              const isActive = !isUsed && !isExpired;

              const fullInviteUrl = typeof window !== "undefined"
                ? `${window.location.origin}/invite/${inv.token}`
                : `/invite/${inv.token}`;

              return (
                <div
                  key={inv.id}
                  className={`p-3 rounded-xl border transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs ${
                    isActive
                      ? "border-emerald-500/30 bg-emerald-50/20 dark:bg-emerald-950/10"
                      : isUsed
                      ? "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 opacity-75"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 opacity-60"
                  }`}
                >
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                          ACTIVA 🟢
                        </span>
                      )}
                      {isUsed && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                          UTILIZADA ✓
                        </span>
                      )}
                      {isExpired && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-800 text-slate-500">
                          CADUCADA ⏳
                        </span>
                      )}

                      <span className="font-mono text-[11px] font-bold text-slate-800 dark:text-slate-200 truncate">
                        {inv.email || "🌐 Enlace abierto"}
                      </span>

                      <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase">
                        {inv.role}
                      </span>
                    </div>

                    <div className="text-[11px] text-slate-400 flex items-center gap-2 flex-wrap">
                      <span>
                        Creada por @{inv.createdByUsername || inv.createdByName || "admin"} el{" "}
                        {new Date(inv.createdAt).toLocaleDateString()}
                      </span>
                      <span>•</span>
                      <span>
                        {isUsed
                          ? `Usada el ${new Date(inv.usedAt!).toLocaleDateString()}`
                          : isExpired
                          ? `Caducó el ${new Date(inv.expiresAt).toLocaleDateString()}`
                          : `Vence el ${new Date(inv.expiresAt).toLocaleDateString()}`}
                      </span>
                    </div>
                  </div>

                  {/* Acciones */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    {isActive && (
                      <button
                        type="button"
                        onClick={() => handleCopy(fullInviteUrl, inv.id)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-[11px] font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition cursor-pointer"
                        title="Copiar enlace de invitación"
                      >
                        <span>{copiedToken === inv.id ? "✓ ¡Copiado!" : "📋 Copiar enlace"}</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleDelete(inv)}
                      disabled={deletingId === inv.id}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/50 text-[11px] font-bold transition cursor-pointer disabled:opacity-40"
                      title={isActive ? "Revocar y eliminar invitación antes de vencer" : "Eliminar registro"}
                    >
                      <span>🗑️</span>
                      <span>{deletingId === inv.id ? "Eliminando..." : isActive ? "Revocar" : "Eliminar"}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
