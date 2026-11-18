"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type MapViewType from "./MapView";

const DynamicMapView = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[60vh] sm:h-[500px] rounded-2xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center text-slate-400">
      <div className="flex flex-col items-center gap-2">
        <span className="text-2xl animate-spin">🧭</span>
        <span className="text-xs font-medium">Cargando mapa interactivo...</span>
      </div>
    </div>
  ),
});

export function MapContainerWrapper(props: ComponentProps<typeof MapViewType>) {
  return <DynamicMapView {...props} />;
}
