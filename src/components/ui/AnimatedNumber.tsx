"use client";

import { useEffect, useRef, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  durationMs?: number;
  decimals?: number;
}

/**
 * Contador numérico suave (ease-out cúbico) que respeta `prefers-reduced-motion`.
 */
export function AnimatedNumber({
  value,
  durationMs = 380,
  decimals = 0,
}: AnimatedNumberProps) {
  const [display, setDisplay] = useState(value);
  const prevRef = useRef<number>(0);

  useEffect(() => {
    if (
      typeof window === "undefined" ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      prevRef.current = value;
      return;
    }

    const startValue = prevRef.current;
    const diff = value - startValue;
    if (diff === 0) {
      setDisplay(value);
      return;
    }

    let rafId = 0;
    const startTime = performance.now();

    const tick = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / durationMs);
      // ease-out cúbico
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * eased;
      setDisplay(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(tick);
      } else {
        setDisplay(value);
        prevRef.current = value;
      }
    };

    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [value, durationMs]);

  if (decimals > 0) {
    return <>{display.toFixed(decimals)}</>;
  }
  return <>{Math.round(display)}</>;
}
