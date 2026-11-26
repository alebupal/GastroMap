"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n/client";

interface RoleLegendCardProps {
  scope?: "all" | "group";
  defaultOpen?: boolean;
  variant?: "default" | "compact";
}

export function RoleLegendCard({
  scope = "all",
  defaultOpen = false,
  variant = "default",
}: RoleLegendCardProps) {
  const { t } = useT();
  const [open, setOpen] = useState(defaultOpen);

  const globalRoles = [
    {
      badge: "SUPERADMIN",
      badgeClass:
        "bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/30",
      desc: t("role_legend.superadmin_desc"),
    },
    {
      badge: t("admin_users.role_user").toUpperCase(),
      badgeClass:
        "bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300/70 dark:border-slate-600",
      desc: t("role_legend.user_desc"),
    },
  ];

  const groupRoles = [
    {
      badge: t("group_admin.owner_badge").toUpperCase(),
      badgeClass: "bg-orange-600 text-white border-orange-600",
      desc: t("role_legend.owner_desc"),
    },
    {
      badge: t("spaces.group_admin_badge").toUpperCase(),
      badgeClass:
        "bg-amber-500/20 text-amber-800 dark:text-amber-300 border-amber-500/30",
      desc: t("role_legend.group_admin_desc"),
    },
    {
      badge: t("group_admin.member_badge").toUpperCase(),
      badgeClass:
        "bg-slate-200/80 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-slate-300/60 dark:border-slate-600",
      desc: t("role_legend.member_desc"),
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-[#f8f9ff] dark:bg-slate-900/50 text-left overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-100/70 dark:hover:bg-slate-800/50 transition cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          <span className="material-symbols-outlined text-base text-orange-600 leading-none">
            info
          </span>
          <span>{t("role_legend.title")}</span>
        </span>
        <span className="material-symbols-outlined text-base text-slate-400 leading-none">
          {open ? "expand_less" : "expand_more"}
        </span>
      </button>

      {open && (
        <div className="px-3.5 pb-3.5 pt-2.5 border-t border-slate-200/70 dark:border-slate-800 space-y-3 text-xs gm-tab-in">
          {scope === "all" && (
            <div className="space-y-1.5">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {t("role_legend.global_section")}
              </div>
              <div className={`grid grid-cols-1 ${variant === "compact" ? "" : "md:grid-cols-2"} gap-2`}>
                {globalRoles.map((r) => (
                  <div
                    key={r.badge}
                    className={`p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-start ${
                      variant === "compact" ? "flex-col gap-1.5" : "gap-2"
                    }`}
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 whitespace-nowrap ${r.badgeClass}`}
                    >
                      {r.badge}
                    </span>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                      {r.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {t("role_legend.group_section")}
            </div>
            <div className={`grid grid-cols-1 ${variant === "compact" ? "" : "md:grid-cols-3"} gap-2`}>
              {groupRoles.map((r) => (
                <div
                  key={r.badge}
                  className={`p-2.5 rounded-xl bg-white dark:bg-slate-950/60 border border-slate-200/70 dark:border-slate-800 flex items-start ${
                    variant === "compact" ? "flex-col gap-1.5" : "gap-2"
                  }`}
                >
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-extrabold border shrink-0 whitespace-nowrap ${r.badgeClass}`}
                  >
                    {r.badge}
                  </span>
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-snug">
                    {r.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
