"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { joinGroupWithTokenAction } from "@/lib/actions/groups";
import { useT } from "@/lib/i18n/client";

interface JoinGroupClientProps {
  token: string;
  groupName: string;
  isAlreadyMember: boolean;
}

export function JoinGroupClient({
  token,
  groupName,
  isAlreadyMember,
}: JoinGroupClientProps) {
  const router = useRouter();
  const { t } = useT();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleJoin() {
    setLoading(true);
    setError(null);
    const res = await joinGroupWithTokenAction(token);
    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.push("/");
    }
  }

  if (isAlreadyMember) {
    return (
      <div className="space-y-4">
        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold bg-emerald-50 dark:bg-emerald-950/40 p-3 rounded-2xl border border-emerald-200 dark:border-emerald-800">
          ✓ {t("groups.join_already_member", { name: groupName })}
        </p>
        <button
          type="button"
          onClick={() => router.push("/")}
          className="w-full py-3 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs transition cursor-pointer shadow-md"
        >
          {t("groups.join_go_to_map")}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <div className="p-3 text-xs bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 rounded-2xl">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={handleJoin}
        disabled={loading}
        className="w-full py-3.5 px-4 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-sm transition cursor-pointer shadow-lg shadow-amber-500/20 active:scale-98 disabled:opacity-50"
      >
        {loading ? t("groups.join_joining") : t("groups.join_accept")}
      </button>

      <Link
        href="/"
        className="inline-block text-xs font-semibold text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
      >
        {t("groups.join_reject")}
      </Link>
    </div>
  );
}
