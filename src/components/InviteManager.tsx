"use client";

import { useState } from "react";
import { createInvitationAction } from "@/lib/actions/auth";

export function InviteManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [createdUrl, setCreatedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setCreatedUrl(null);

    const formData = new FormData(e.currentTarget);
    const result = await createInvitationAction(formData);

    setLoading(false);
    if (result.error) {
      setError(result.error);
    } else if (result.url) {
      const fullUrl = `${window.location.origin}${result.url}`;
      setCreatedUrl(fullUrl);
    }
  }

  function handleCopy() {
    if (!createdUrl) return;
    navigator.clipboard.writeText(createdUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="w-full mt-4 p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 shadow-sm text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎟️</span>
          <div>
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              Invitaciones privadas
            </h3>
            <p className="text-xs text-slate-500">Invita a amigos, pareja o familia a la app</p>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-500 hover:bg-amber-600 text-white transition active:scale-95 cursor-pointer"
        >
          {isOpen ? "Cerrar" : "Crear invitación"}
        </button>
      </div>

      {isOpen && (
        <form onSubmit={handleSubmit} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 text-xs">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
              Email invitado (opcional, déjalo vacío para enlace libre)
            </label>
            <input
              type="email"
              name="email"
              placeholder="amigo@email.com"
              className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Rol
              </label>
              <select
                name="role"
                defaultValue="user"
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="user">Usuario</option>
                <option value="admin">Administrador</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                Validez (días)
              </label>
              <input
                type="number"
                name="days"
                defaultValue={7}
                min={1}
                max={90}
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2 px-3 rounded-lg bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 text-white dark:text-slate-900 text-xs font-semibold transition active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            {loading ? "Generando..." : "Generar enlace"}
          </button>

          {createdUrl && (
            <div className="mt-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
              <p className="text-xs font-medium text-amber-800 dark:text-amber-300 mb-1.5">
                ¡Enlace de invitación generado!
              </p>
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  readOnly
                  value={createdUrl}
                  className="w-full px-2 py-1 text-xs rounded bg-white dark:bg-slate-900 border border-amber-300 dark:border-amber-700 select-all font-mono text-slate-700 dark:text-slate-300"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  className="px-2.5 py-1 text-xs font-semibold rounded bg-amber-500 hover:bg-amber-600 text-white shrink-0 transition"
                >
                  {copied ? "¡Copiado!" : "Copiar"}
                </button>
              </div>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
