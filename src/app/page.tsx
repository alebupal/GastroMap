export default function Home() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-lg mx-auto w-full text-center">
      <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center text-3xl mb-6 shadow-sm border border-amber-500/20">
        🍽️
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-slate-100 mb-2">
        GastroMap
      </h1>

      <p className="text-slate-600 dark:text-slate-400 text-sm mb-8 leading-relaxed">
        Nuestra app privada para guardar, descubrir y decidir sitios donde comer y tapear con amigos y familia.
      </p>

      <div className="grid grid-cols-1 gap-3 w-full">
        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm text-left">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
            <span className="text-lg">➕</span> Añadir un sitio
          </div>
          <p className="text-xs text-slate-500">
            Guarda en 10 segundos desde Instagram, TikTok o Google Maps.
          </p>
        </div>

        <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 shadow-sm text-left">
          <div className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-200 mb-1">
            <span className="text-lg">🔍</span> Encontrar un sitio
          </div>
          <p className="text-xs text-slate-500">
            Filtra por plan, distancia, presupuesto o dale al botón «Elegir al azar».
          </p>
        </div>
      </div>

      <div className="mt-8 text-xs text-slate-400">
        Estado del sistema: <span className="text-emerald-600 dark:text-emerald-400 font-medium">Fase 0 (Cimientos)</span>
      </div>
    </main>
  );
}
