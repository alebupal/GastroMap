# GastroMap — Sistema de Diseño (DESIGN.md)

> **Propósito:** Esta es la guía oficial de diseño UI/UX de **GastroMap**. Cualquier IA o desarrollador que cree o modifique componentes, modales, vistas o páginas DEBE seguir estos patrones para mantener una identidad visual 100% coherente en modo claro y modo oscuro.

---

## 1. Identidad de Marca y Logotipo

- **Nombre:** `GastroMap` (`Gastro` en tinta oscura/clara + `Map` en naranja oficial `#ea580c`).
- **Isotipo oficial («Radar y Plato»):** Cuadrado redondeado (`rx="18"` sobre `viewBox="0 0 64 64"`) en `#ea580c` con aro exterior blanco al 45%, aro interior blanco sólido y punto central blanco.
- **Componente reutilizable obligatorio:** Usar siempre `<GastroMapLogo />` o `<GastroMapIcon />` desde `src/components/ui/GastroMapLogo.tsx` (y `public/icon.svg` para favicon/PWA). **Nunca** sustituirlo por emojis (`🍽️`) ni iconos genéricos en cabeceras, pies de página, login o modales de marca.

---

## 2. Paleta de Colores Oficial y Semántica

Tokens definidos en `src/app/globals.css`:

| Rol | Modo Claro | Modo Oscuro | Clases Tailwind recomendadas |
|---|---|---|---|
| **Primario de Marca (CTA / Activo)** | `#ea580c` | `#ea580c` | `bg-orange-600 hover:bg-orange-700 text-white` |
| **Primario Tinte Suave** | `#fff7ed` / `#ffedd5` | `rgba(234,88,12,0.15)` | `bg-orange-50 dark:bg-orange-950/50 text-orange-700 dark:text-orange-300` |
| **Fondo Principal (Canvas)** | `#faf8ff` | `#0b1120` | `bg-[#faf8ff] dark:bg-[#0b1120]` |
| **Superficie Elevada (Tarjetas / Modales)** | `#ffffff` | `#0f172a` | `bg-white dark:bg-slate-900` |
| **Superficie Secundaria (Inputs / Píldoras / Sidebar)** | `#f2f3ff` / `#f8f9ff` | `#1e293b` | `bg-[#f2f3ff] dark:bg-slate-800` |
| **Texto Principal** | `#131b2e` / `#0f172a` | `#f1f5f9` | `text-slate-900 dark:text-slate-100` |
| **Texto Secundario / Metadatos** | `#64748b` | `#94a3b8` | `text-slate-500 dark:text-slate-400` |
| **Bordes Sutiles** | `slate-200/70` | `slate-800` | `border border-slate-200/70 dark:border-slate-800` |

### Regla Estricta de Colores Semánticos
- **Naranja (`orange-600` / `#ea580c`):** Reservado para **todos los botones principales (CTA)**, pestañas activas, elementos seleccionados del sidebar admin, filtros activos y enlaces/acentos de marca. **No usar `amber-500` ni hexadecimales sueltos (`#a33900`, `#c2410c`) para botones primarios.**
- **Esmeralda (`emerald-600` / `emerald-700`):** Precios (`< 15 €`, `15 - 30 €`), estado **Ya he ido**, confirmaciones de éxito y sincronización activa.
- **Ámbar (`amber-500` / `amber-400`):** Exclusivo para estado **Pendiente / Quiero ir**, estrellas de **Favoritos / Valoración** e insignias destacadas tipo *Destino Recomendado*.
- **Rojo / Rosa (`rose-600` / `rose-700`):** Acciones destructivas (eliminar, resetear aplicación), corazón de favoritos y botón de donación (`Donar`).

---

## 3. Tipografía e Iconografía

- **Fuente principal:** `Plus Jakarta Sans` (cargada en `src/app/layout.tsx`).
  - **Títulos de sección / modal:** `text-lg sm:text-xl font-extrabold tracking-tight` (o `text-2xl font-black` en héroes/modales destacados).
  - **Eyebrows / Etiquetas de sección:** `text-[10px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400`.
  - **Cuerpo / Controles:** `text-xs` o `text-sm`, pesos `font-medium`, `font-semibold` o `font-bold`.
  - **KPIs / Cifras grandes:** `text-3xl sm:text-4xl font-black`.
- **Iconografía:** Preferir **Google Material Symbols Outlined** (`<span className="material-symbols-outlined text-base leading-none">nombre_icono</span>`) para navegación, acciones de barra de herramientas, cierre, edición, borrado y controles. Emojis solo como complemento semántico en categorías/ocasiones o etiquetas de estado.

---

## 4. Radios, Bordes y Sombras

- **Contenedores grandes (Modales, tarjetas principales):** `rounded-3xl` con `shadow-2xl` (modales) o `shadow-xs` (tarjetas en página).
- **Tarjetas internas / Bloques secundarios / Inputs:** `rounded-2xl` o `rounded-xl`.
- **Botones principales, chips, pestañas segmentadas, filtros y paginación:** `rounded-full` (estética *pill*).
- **Botón de cierre de modales:** Círculo uniforme `w-9 h-9 rounded-full bg-[#f2f3ff] dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center justify-center`.
- **Avatares de iniciales (locales y usuarios):**
  - Locales: cuadrado redondeado `w-11 h-11 rounded-2xl` (o `w-16 h-16` en destacados) con 2 iniciales en `font-black` sobre fondo naranja suave (`bg-orange-100/90 text-orange-700`) o sólido (`bg-orange-600 text-white`).
  - Usuarios: círculo `rounded-full` con iniciales y `border`.

---

## 5. Patrones de Componentes

### Botones
- **Primario (CTA):**
  ```tsx
  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-full bg-orange-600 hover:bg-orange-700 text-white font-bold text-xs shadow-sm transition active:scale-[0.98] disabled:opacity-50 cursor-pointer"
  ```
- **Secundario / Suave:**
  ```tsx
  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-[#f2f3ff] hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-bold text-xs transition cursor-pointer"
  ```
- **Destructivo:**
  ```tsx
  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-full bg-rose-700 hover:bg-rose-800 text-white font-bold text-xs shadow-sm transition cursor-pointer"
  ```

### Pestañas Segmentadas (Segmented Control)
**Regla obligatoria:** Toda navegación por pestañas (en paneles, modales o sub-vistas) **DEBE** usar el componente `<SegmentedTabs>` (`src/components/ui/SegmentedTabs.tsx`) con su píldora deslizante animada (`translateX`), soporte de teclado (`ArrowLeft`/`ArrowRight`) y respeto a `prefers-reduced-motion`, acompañado de la animación `gm-tab-in` en el contenedor de contenido de cada pestaña. **Prohibido** usar botones sueltos sin animación para simular pestañas.

- Pista redondeada `p-1 rounded-full bg-[#f2f3ff] dark:bg-slate-800/80 border border-slate-200/70 dark:border-slate-700/70`:
- Variante `primary` (por defecto): píldora activa `bg-orange-600 text-white shadow-sm`.
- Variante `neutral`: píldora activa `bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-xs`.
- Variante `dark`: píldora activa `bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-xs`.

### Inputs y Buscadores
- Fondo suave `bg-[#f2f3ff] dark:bg-slate-800/70` (o `bg-white dark:bg-slate-900` con borde `border-slate-200/80 dark:border-slate-700`).
- Foco siempre en marca: `focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500`.

### Modales
- **Siempre** sobre backdrop `fixed inset-0 z-[1100] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm` (usar `createPortal(..., document.body)` si el modal se monta dentro de una tarjeta con `overflow` o `z-index` propio).
- **Cierre accesible:** Cerrar al pulsar `Escape` y al hacer clic en el backdrop.
- **Estructura en 3 zonas:**
  1. Cabecera fija (`shrink-0`) con icono/avatar + título + subtítulo + botón circular `close`.
  2. Cuerpo con scroll (`overflow-y-auto flex-1`).
  3. Pie fijo (`shrink-0`) con metadato de estado a la izquierda y acciones (`Cerrar` + CTA naranja) a la derecha.

### Arquitectura de Páginas
- **Explorador (`/`):** Ancho máximo `max-w-[1720px]`, cabecera limpia (sin barra de estado PWA en escritorio; el botón `Instalar App` solo aparece en móvil `sm:hidden` cuando el navegador dispara `beforeinstallprompt`), buscador con píldoras en línea, barra de filtros de 2 filas (con categorías/etiquetas ocultas por defecto hasta pulsar `+ Filtros`), listado + mapa lado a lado y pie de página minimalista (`GastroMap • © ...` | `Documentación`, `GitHub`, `Donar`).
- **Panel de Administración (`/admin`):** Ruta dedicada con menú lateral fijo (`w-64 bg-[#f2f3ff] dark:bg-slate-900/90`) y cajón móvil, ítem activo en `bg-orange-600 text-white`, tarjeta de usuario y `Cerrar Sesión` fijada abajo, y acceso directo `Ver Explorador` (`/`).

---

## 6. Checklist Rápido antes de Entregar Cualquier Componente Nuevo

1. ¿Usa `orange-600` / `orange-700` con `text-white` como color primario (sin `amber-500` ni hexadecimales sueltos)?
2. ¿Se ve perfectamente tanto en **modo claro** (`#faf8ff` / `bg-white`) como en **modo oscuro** (`#0b1120` / `bg-slate-900`)?
3. ¿Es **responsive** en móvil (`375px`), tablet y escritorio sin desbordamientos horizontales?
4. ¿Usa `rounded-full` en botones/pills y `rounded-2xl` / `rounded-3xl` en tarjetas/modales?
5. ¿Todos los textos visibles están en `es.json`, `en.json` y sincronizados en `translations.csv`?
6. ¿Los modales cierran con `Escape`, clic fuera y usan `z-[1100]` para quedar siempre encima del mapa Leaflet?
