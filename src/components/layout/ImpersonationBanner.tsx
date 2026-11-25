"use client";

import { useTransition } from "react";
import { stopImpersonationAction } from "@/lib/actions/auth";
import { useT } from "@/lib/i18n/client";

interface ImpersonationBannerProps {
  targetName: string;
  targetUsername: string | null;
}

export function ImpersonationBanner({
  targetName,
  targetUsername,
}: ImpersonationBannerProps) {
  const { t } = useT();
  const [isPending, startTransition] = useTransition();

  const displayTarget = targetUsername
    ? `${targetName} (@${targetUsername})`
    : targetName;

  function handleStop() {
    startTransition(async () => {
      await stopImpersonationAction();
    });
  }

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
          <p className="font-bold truncate">
            {t("impersonation.banner_text", { user: displayTarget })}
          </p>
        </div>

        <button
          type="button"
          onClick={handleStop}
          disabled={isPending}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950 hover:bg-slate-800 text-white font-extrabold text-[11px] transition cursor-pointer shrink-0 shadow-xs disabled:opacity-60 active:scale-95"
        >
          <span className="material-symbols-outlined text-sm leading-none">logout</span>
          <span>{isPending ? t("common.loading") : t("impersonation.stop_btn")}</span>
        </button>
      </div>
    </div>
  );
}
