import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse bg-slate-200 dark:bg-slate-800/80 rounded-xl ${className}`}
      aria-hidden="true"
    />
  );
}

export function PlaceCardSkeleton() {
  return (
    <div className="w-full p-4 sm:p-5 rounded-3xl border border-slate-200 dark:border-slate-800/80 bg-white/60 dark:bg-slate-900/40 shadow-sm flex flex-col justify-between gap-3.5 animate-pulse">
      <div className="space-y-3">
        {/* Chips superiores */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-14 rounded-lg" />
        </div>

        {/* Título y subtítulo */}
        <div className="space-y-2 pt-1">
          <Skeleton className="h-6 w-3/4 rounded-lg" />
          <Skeleton className="h-4 w-1/2 rounded-md" />
        </div>

        {/* Tags */}
        <div className="flex gap-1.5 pt-1">
          <Skeleton className="h-5 w-16 rounded-full" />
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-5 w-14 rounded-full" />
        </div>

        {/* Platos estrella */}
        <Skeleton className="h-10 w-full rounded-2xl" />
      </div>

      {/* Acciones inferiores */}
      <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
        <Skeleton className="h-8 w-24 rounded-xl" />
        <div className="flex gap-1.5">
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-xl" />
          <Skeleton className="h-8 w-8 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CommentSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800/60 animate-pulse">
      <Skeleton className="w-8 h-8 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-24 rounded-md" />
          <Skeleton className="h-3 w-16 rounded-md" />
        </div>
        <Skeleton className="h-4 w-5/6 rounded-md" />
        <Skeleton className="h-4 w-3/4 rounded-md" />
      </div>
    </div>
  );
}
