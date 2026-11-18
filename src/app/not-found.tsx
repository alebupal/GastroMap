import Link from "next/link";

export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-6xl font-black text-amber-500 mb-2">404</h1>
        <h2 className="text-2xl font-bold mb-4">Página no encontrada</h2>
        <p className="text-slate-400 mb-6 text-sm">
          El plato o rincón que buscas no existe o ha sido movido.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition-colors shadow-lg shadow-amber-500/20"
        >
          Volver al mapa
        </Link>
      </div>
    </div>
  );
}
