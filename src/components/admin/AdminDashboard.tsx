"use client";

import { useState } from "react";
import { UsersManager } from "./UsersManager";
import { TaxonomyManager } from "./TaxonomyManager";
import { InviteManager } from "@/components/InviteManager";
import { SettingsManager } from "./SettingsManager";
import { DemoPlacesSeeder } from "./DemoPlacesSeeder";
import { PlacesTableManager } from "./PlacesTableManager";
import { AuditLogViewer } from "./AuditLogViewer";
import type { Occasion } from "@/db/schema";
import type { PlaceWithDetails } from "@/lib/actions/places";

interface AdminDashboardProps {
  initialOccasions: Array<Occasion & { placesCount: number }>;
  initialTags: { id: string; name: string; placesCount: number }[];
  allPlaces?: PlaceWithDetails[];
  cartoApiKey?: string | null;
  currentUserId?: string;
}

export function AdminDashboard({
  initialOccasions,
  initialTags,
  allPlaces = [],
  cartoApiKey,
  currentUserId,
}: AdminDashboardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "places" | "users" | "taxonomy" | "invites" | "audit" | "settings" | "demo"
  >("places");

  return (
    <div className="w-full mt-10 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-900/40 backdrop-blur-sm overflow-hidden text-left shadow-xl transition-colors duration-200">
      {/* Barra de cabecera del panel */}
      <div className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-900/60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center text-lg shadow-inner shrink-0">
            🛠️
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-800 dark:text-slate-100 flex items-center gap-2">
              Panel de Administración
              <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30">
                PRO
              </span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Gestión centralizada de usuarios, taxonomía, invitaciones, API keys y datos de prueba
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className="self-end sm:self-auto px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 transition cursor-pointer flex items-center gap-1.5 shrink-0"
        >
          <span>{isOpen ? "Plegar panel" : "Abrir herramientas"}</span>
          <span>{isOpen ? "▲" : "▼"}</span>
        </button>
      </div>

      {isOpen && (
        <div className="p-4 sm:p-6 space-y-4">
          {/* Navegación por pestañas */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs border-b border-slate-200 dark:border-slate-800/60">
            {[
              { id: "places", label: `📋 Tabla Sitios (${allPlaces.length})` },
              { id: "users", label: "👥 Usuarios" },
              { id: "taxonomy", label: "🏷️ Taxonomía" },
              { id: "invites", label: "🎟️ Invitaciones" },
              { id: "audit", label: "📜 Auditoría" },
              { id: "settings", label: "🔑 API Keys" },
              { id: "demo", label: "🌱 Sitios Demo" },
            ].map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`px-3.5 py-2 font-bold rounded-t-xl transition cursor-pointer border-b-2 shrink-0 ${
                    active
                      ? "border-amber-500 text-amber-600 dark:text-amber-400 bg-amber-500/10"
                      : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Contenido de la pestaña activa */}
          <div className="pt-2">
            {activeTab === "places" && <PlacesTableManager places={allPlaces} />}
            {activeTab === "users" && <UsersManager currentUserId={currentUserId} />}
            {activeTab === "taxonomy" && (
              <div className="space-y-4">
                <TaxonomyManager
                  key="occasions"
                  section="occasions"
                  initialOccasions={initialOccasions}
                  initialTags={initialTags}
                />
                <TaxonomyManager
                  key="tags"
                  section="tags"
                  initialOccasions={initialOccasions}
                  initialTags={initialTags}
                />
              </div>
            )}
            {activeTab === "invites" && <InviteManager />}
            {activeTab === "audit" && <AuditLogViewer />}
            {activeTab === "settings" && <SettingsManager initialCartoApiKey={cartoApiKey} />}
            {activeTab === "demo" && <DemoPlacesSeeder />}
          </div>
        </div>
      )}
    </div>
  );
}
