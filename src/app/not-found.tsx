import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-4">
      <span className="text-5xl">🧭</span>
      <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
        404 - Página no encontrada
      </h2>
      <p className="text-sm text-slate-500 max-w-md">
        La página que buscas no existe o ha sido movida.
      </p>
      <Link
        href="/"
        className="px-4 py-2 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs hover:bg-amber-400 transition"
      >
        Volver al inicio
      </Link>
    </div>
  );
}
