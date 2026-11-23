import { redirect } from "next/navigation";
import { countUsers, getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/auth/LoginForm";
import { GastroMapIcon, GastroMapLogo } from "@/components/ui/GastroMapLogo";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { APP_VERSION } from "@/lib/version";
import { getT } from "@/lib/i18n/server";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const userCount = await countUsers();
  if (userCount === 0) {
    redirect("/setup");
  }

  const currentUser = await getCurrentUser();
  if (currentUser) {
    redirect("/");
  }

  const t = await getT();

  return (
    <div className="min-h-screen bg-[#faf8ff] dark:bg-[#0b1120] text-slate-900 dark:text-slate-100 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden transition-colors duration-200">
      {/* Resplandores ambientales de fondo */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-orange-400/20 dark:bg-orange-600/15 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-amber-400/20 dark:bg-amber-600/10 blur-3xl"
      />

      {/* Selector de tema flotante arriba a la derecha */}
      <div className="fixed top-4 right-4 z-20">
        <ThemeToggle />
      </div>

      {/* Tarjeta principal dividida (Split-Screen en escritorio) */}
      <div className="gm-animate-fade-up relative z-10 w-full max-w-4xl rounded-[2rem] bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xl overflow-hidden grid grid-cols-1 lg:grid-cols-12">
        {/* Panel izquierdo visual animado (Radar Gastronómico) */}
        <div className="hidden lg:flex lg:col-span-6 relative overflow-hidden bg-gradient-to-br from-[#ea580c] via-[#c2410c] to-[#7c2d12] text-white p-8 flex-col justify-between">
          {/* Cuadrícula sutil de mapa */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 opacity-15"
            style={{
              backgroundImage:
                "radial-gradient(circle at 1px 1px, rgba(255,255,255,0.65) 1px, transparent 0)",
              backgroundSize: "24px 24px",
            }}
          />

          {/* Cabecera marca blanca */}
          <div className="relative z-10 flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 flex items-center justify-center shadow-sm">
              <GastroMapIcon className="w-7 h-7 rounded-[28%]" />
            </div>
            <span className="font-extrabold text-xl tracking-tight">
              Gastro<span className="text-amber-200">Map</span>
            </span>
          </div>

          {/* Radar animado central + tarjetas flotantes */}
          <div className="relative z-10 my-8 flex items-center justify-center h-64">
            {/* Ondas del radar */}
            <div className="absolute w-28 h-28 rounded-full border-2 border-white/40 gm-animate-radar" />
            <div className="absolute w-28 h-28 rounded-full border-2 border-white/30 gm-animate-radar-delayed" />
            <div className="absolute w-44 h-44 rounded-full border border-white/15" />
            <div className="absolute w-64 h-64 rounded-full border border-white/10" />

            {/* Núcleo Radar y Plato */}
            <div className="relative z-10 w-20 h-20 rounded-3xl bg-white/20 backdrop-blur-md border border-white/35 flex items-center justify-center shadow-xl">
              <GastroMapIcon className="w-14 h-14 rounded-[28%] shadow-md" />
            </div>

            {/* Tarjeta flotante 1 */}
            <div className="gm-animate-float absolute top-2 left-1 px-3 py-2 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-lg flex items-center gap-2 text-xs">
              <span className="w-7 h-7 rounded-xl bg-white text-orange-600 font-black text-[11px] flex items-center justify-center shrink-0">
                AJ
              </span>
              <div>
                <div className="font-extrabold leading-tight">Tapear en el centro</div>
                <div className="text-[10px] text-white/80">15 - 30 € • Favorito ★</div>
              </div>
            </div>

            {/* Tarjeta flotante 2 */}
            <div className="gm-animate-float-delayed absolute bottom-3 right-0 px-3 py-2 rounded-2xl bg-white/15 backdrop-blur-md border border-white/25 shadow-lg flex items-center gap-2 text-xs">
              <span className="text-base">🎲</span>
              <div>
                <div className="font-extrabold leading-tight">¿Dónde comemos hoy?</div>
                <div className="text-[10px] text-white/80">Modo indecisión activo</div>
              </div>
            </div>

            {/* Tarjeta flotante 3 */}
            <div className="gm-animate-float-slow absolute top-14 right-2 px-2.5 py-1.5 rounded-full bg-emerald-400/20 backdrop-blur-md border border-emerald-200/35 text-[11px] font-bold flex items-center gap-1.5 shadow-md">
              <span className="w-2 h-2 rounded-full bg-emerald-300 animate-pulse" />
              <span>Mapa en vivo</span>
            </div>
          </div>

          {/* Mensaje inferior */}
          <div className="relative z-10 space-y-3">
            <h2 className="text-2xl font-black tracking-tight leading-tight">
              Tu mapa privado de sitios inolvidables.
            </h2>
            <p className="text-xs text-white/80 leading-relaxed">
              Guarda restaurantes desde Google Maps, organiza planes por ocasión y decide al instante con tus amigos.
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1 text-[10px] font-bold">
              <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                🗺️ Mapa interactivo
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                👥 Grupos privados
              </span>
              <span className="px-2.5 py-1 rounded-full bg-white/15 border border-white/20">
                📱 Modo Offline PWA
              </span>
            </div>
          </div>
        </div>

        {/* Panel derecho: Formulario de acceso */}
        <div className="lg:col-span-6 p-7 sm:p-10 flex flex-col justify-between gap-6">
          <div className="space-y-6">
            {/* Logo visible en móvil y encabezado */}
            <div className="text-center lg:text-left space-y-3">
              <div className="flex justify-center lg:justify-start">
                <GastroMapLogo iconClassName="w-11 h-11" textClassName="text-2xl" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {t("auth.login_title")}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {t("auth.login_subtitle")}
                </p>
              </div>
            </div>

            <LoginForm />
          </div>

          <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-slate-400">
            <span>Acceso privado mediante invitación.</span>
            <span className="px-2 py-0.5 rounded-full bg-[#f2f3ff] dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-bold self-center sm:self-auto">
              v{APP_VERSION}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
