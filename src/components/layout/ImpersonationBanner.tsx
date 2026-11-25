import { stopImpersonationAction } from "@/lib/actions/auth";

interface ImpersonationBannerProps {
  bannerText: string;
  stopLabel: string;
}

export function ImpersonationBanner({
  bannerText,
  stopLabel,
}: ImpersonationBannerProps) {
  return (
    <div
      role="alert"
      className="sticky top-0 z-[95] w-full bg-amber-500 dark:bg-amber-500 text-slate-950 border-b border-amber-600/40 shadow-sm"
    >
      <div className="max-w-[1720px] mx-auto px-3 sm:px-6 py-2 flex items-center justify-between gap-2 sm:gap-4 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="material-symbols-outlined text-base leading-none shrink-0">
            admin_panel_settings
          </span>
          <p className="font-bold truncate">{bannerText}</p>
        </div>

        <form action={stopImpersonationAction} className="shrink-0">
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-[11px] transition cursor-pointer shadow-xs active:scale-95"
          >
            <span className="material-symbols-outlined text-sm leading-none">logout</span>
            <span>{stopLabel}</span>
          </button>
        </form>
      </div>
    </div>
  );
}
