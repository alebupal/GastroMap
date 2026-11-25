"use client";

import { useRef, useState, useCallback, type TouchEvent, type CSSProperties } from "react";

interface UseSwipeToCloseOptions {
  /** Píxeles mínimos hacia abajo para cerrar al soltar */
  thresholdPx?: number;
  /** Velocidad mínima (px/ms) para cerrar con un gesto rápido */
  velocityThreshold?: number;
  /** Desactivar temporalmente (p.ej. mientras guarda) */
  disabled?: boolean;
}

/**
 * Busca si algún ancestro scrollable entre `target` y `root` tiene `scrollTop > 0`.
 * Si lo tiene, dejamos que el usuario haga scroll normal hacia arriba sin activar swipe-to-close.
 */
function hasScrolledParent(target: EventTarget | null, root: HTMLElement | null): boolean {
  let el = target instanceof HTMLElement ? target : null;
  while (el && el !== root) {
    if (el.scrollHeight > el.clientHeight + 1 && el.scrollTop > 0) {
      return true;
    }
    el = el.parentElement;
  }
  if (root && root.scrollHeight > root.clientHeight + 1 && root.scrollTop > 0) {
    return true;
  }
  return false;
}

/**
 * Hook ligero para cerrar bottom-sheets móviles deslizando hacia abajo.
 * Solo actúa en viewports móviles (< 640px) y respeta el scroll interno del modal.
 */
export function useSwipeToClose(
  onClose: () => void,
  options: UseSwipeToCloseOptions = {}
) {
  const { thresholdPx = 95, velocityThreshold = 0.45, disabled = false } = options;

  const sheetRef = useRef<HTMLDivElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const draggingRef = useRef<boolean>(false);
  const forceHandleRef = useRef<boolean>(false);

  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const isMobileViewport = () =>
    typeof window !== "undefined" && window.innerWidth < 640;

  const onTouchStart = useCallback(
    (e: TouchEvent<HTMLElement>, fromHandle = false) => {
      if (disabled || isClosing || !isMobileViewport()) return;
      if (e.touches.length !== 1) return;

      // No interceptar si el usuario tocó un input/textarea/select/range
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (!fromHandle && (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT")) {
        return;
      }

      if (!fromHandle && hasScrolledParent(e.target, sheetRef.current)) {
        return;
      }

      startYRef.current = e.touches[0].clientY;
      startXRef.current = e.touches[0].clientX;
      startTimeRef.current = Date.now();
      draggingRef.current = false;
      forceHandleRef.current = fromHandle;
    },
    [disabled, isClosing]
  );

  const onTouchMove = useCallback(
    (e: TouchEvent<HTMLElement>) => {
      if (startYRef.current === null || startXRef.current === null || isClosing) return;
      if (e.touches.length !== 1) return;

      const dy = e.touches[0].clientY - startYRef.current;
      const dx = e.touches[0].clientX - startXRef.current;

      // Si aún no entramos en modo arrastre, comprobar dirección del gesto
      if (!draggingRef.current) {
        if (dy < 6) {
          // Moviéndose hacia arriba: cancelar swipe y dejar scroll normal
          if (dy < -8) {
            startYRef.current = null;
            startXRef.current = null;
          }
          return;
        }
        // Si es más horizontal que vertical (ej. carrusel), no interceptar
        if (!forceHandleRef.current && Math.abs(dx) > dy) {
          startYRef.current = null;
          startXRef.current = null;
          return;
        }
        draggingRef.current = true;
        setIsDragging(true);
      }

      if (dy > 0) {
        setDragY(dy);
      } else {
        setDragY(0);
      }
    },
    [isClosing]
  );

  const onTouchEnd = useCallback(() => {
    if (startYRef.current === null) return;

    const wasDragging = draggingRef.current;
    const elapsed = Math.max(1, Date.now() - startTimeRef.current);
    const velocity = dragY / elapsed;

    startYRef.current = null;
    startXRef.current = null;
    draggingRef.current = false;
    forceHandleRef.current = false;
    setIsDragging(false);

    if (!wasDragging) {
      setDragY(0);
      return;
    }

    if (dragY >= thresholdPx || (dragY > 36 && velocity >= velocityThreshold)) {
      setIsClosing(true);
      setDragY(typeof window !== "undefined" ? window.innerHeight : 600);
      setTimeout(() => {
        setIsClosing(false);
        setDragY(0);
        onClose();
      }, 190);
    } else {
      setDragY(0);
    }
  }, [dragY, thresholdPx, velocityThreshold, onClose]);

  const sheetStyle: CSSProperties | undefined =
    isDragging || isClosing || dragY > 0
      ? {
          transform: `translateY(${dragY}px)`,
          transition: isDragging
            ? "none"
            : "transform 220ms cubic-bezier(0.16, 1, 0.3, 1)",
          willChange: "transform",
        }
      : undefined;

  const backdropOpacity =
    isClosing ? 0 : dragY > 0 ? Math.max(0.2, 1 - dragY / 360) : undefined;

  const backdropStyle: CSSProperties | undefined =
    backdropOpacity !== undefined
      ? {
          opacity: backdropOpacity,
          transition: isDragging ? "none" : "opacity 200ms ease-out",
        }
      : undefined;

  return {
    sheetRef,
    sheetStyle,
    backdropStyle,
    sheetHandlers: {
      onTouchStart: (e: TouchEvent<HTMLElement>) => onTouchStart(e, false),
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
    handleHandlers: {
      onTouchStart: (e: TouchEvent<HTMLElement>) => {
        e.stopPropagation();
        onTouchStart(e, true);
      },
      onTouchMove,
      onTouchEnd,
      onTouchCancel: onTouchEnd,
    },
  };
}

/**
 * Tirador visual superior estilo app nativa para bottom-sheets en móvil (< 640px).
 */
export function SheetHandle({
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onTouchCancel,
}: {
  onTouchStart?: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchMove?: (e: TouchEvent<HTMLDivElement>) => void;
  onTouchEnd?: () => void;
  onTouchCancel?: () => void;
}) {
  return (
    <div
      aria-hidden="true"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="sm:hidden flex items-center justify-center pt-2.5 pb-1 shrink-0 touch-none cursor-grab active:cursor-grabbing"
    >
      <span className="w-10 h-1.5 rounded-full bg-slate-300/90 dark:bg-slate-700" />
    </div>
  );
}
