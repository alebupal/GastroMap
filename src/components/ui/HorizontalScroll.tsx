"use client";

import React, { useRef, useEffect } from "react";

interface HorizontalScrollProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
}

export function HorizontalScroll({ children, className = "", ...props }: HorizontalScrollProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // 1. Scroll horizontal con la rueda vertical del ratón
    const handleWheel = (e: WheelEvent) => {
      // Si el contenido excede el ancho visible
      if (el.scrollWidth > el.clientWidth) {
        if (e.deltaY !== 0) {
          e.preventDefault();
          el.scrollLeft += e.deltaY * 1.1;
        }
      }
    };

    // 2. Arrastre horizontal con clic sostenido del ratón
    let isDown = false;
    let startX = 0;
    let scrollLeft = 0;
    let hasDragged = false;

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // Solo clic principal
      isDown = true;
      hasDragged = false;
      startX = e.pageX - el.offsetLeft;
      scrollLeft = el.scrollLeft;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDown) return;
      const x = e.pageX - el.offsetLeft;
      const walk = (x - startX) * 1.2;
      if (Math.abs(walk) > 4) {
        hasDragged = true;
        el.scrollLeft = scrollLeft - walk;
      }
    };

    const handleMouseUp = () => {
      isDown = false;
    };

    // Prevenir el clic de elementos hijos si el usuario estaba arrastrando
    const handleClickCapture = (e: MouseEvent) => {
      if (hasDragged) {
        e.stopPropagation();
        e.preventDefault();
        hasDragged = false;
      }
    };

    el.addEventListener("wheel", handleWheel, { passive: false });
    el.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
    el.addEventListener("click", handleClickCapture, true);

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      el.removeEventListener("click", handleClickCapture, true);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`overflow-x-auto no-scrollbar scroll-smooth ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
