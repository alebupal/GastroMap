# GastroMap — Guía Rápida para Agentes de IA y Desarrolladores

> **Propósito:** Esta guía permite a cualquier IA o desarrollador localizar de inmediato los archivos clave, comprender el flujo de datos y ejecutar comandos sin perder tiempo explorando el repositorio.

---

## ⚡ Regla de Oro de Ejecución
Ejecutar siempre los comandos desde el directorio del proyecto `GastroMap`:
```bash
# Directamente en la raíz del proyecto GastroMap:
npm test
npx tsc -p tsconfig.json --noEmit

# O si te encuentras en un directorio superior:
cd GastroMap && <comando>
```

### Comandos Frecuentes
- **Comprobación de tipos TypeScript:** `npx tsc -p tsconfig.json --noEmit`
- **Tests unitarios:** `npm test`
- **Verificar traducciones:** `npm run i18n:check`
- **Exportar traducciones a CSV:** `npm run i18n:export`
- **Importar traducciones desde CSV:** `npm run i18n:import`
- **Build de producción Next.js:** `npm run build`
- **Desarrollo:** `npm run dev`

---

## 🎨 Sistema de Diseño Obligatorio (`DESIGN.md`)
> ⚠️ **REGLA VISUAL:** Antes de crear o modificar cualquier componente, vista, modal o botón, lee y sigue obligatoriamente [**DESIGN.md**](DESIGN.md) (logotipo oficial `GastroMapLogo`, paleta unificada `orange-600` `#ea580c`, superficies `#faf8ff` / `#0b1120`, tipografía `Plus Jakarta Sans`, iconos Material Symbols, radios `rounded-full` / `rounded-2xl` / `rounded-3xl` y patrón de modales `z-[1100]`).

---

## 🗺️ Mapa de Archivos Clave

### 1. Interfaz de Usuario y Vistas Principales (`src/components/`)
| Componente | Ruta | Descripción |
|---|---|---|
| **Explorador Principal** | `src/components/places/PlacesExplorer.tsx` | Vista central con mapa Leaflet, listado filtrable, paginación, filtros de países/ciudades y accesos directos. |
| **Ficha de Sitio** | `src/components/places/PlaceCard.tsx` | Tarjeta individual con fotos, notas, estado, ocasiones, tags, favoritos y comentarios. |
| **Nuevo Sitio** | `src/components/places/NewPlaceForm.tsx` | Formulario de alta con autocompletado por enlace de Google Maps. |
| **Edición de Sitio** | `src/components/places/EditPlaceModal.tsx` | Modal para editar nombre, notas, ocasiones, tags, teléfono, web y visibilidad de un sitio. |
| **Selector de Ubicación** | `src/components/places/LocationPicker.tsx` | Buscador OpenStreetMap/Nominatim, selector de país y selector INE de provincias/municipios españoles. |
| **Selector de Ocasiones** | `src/components/places/OccasionPicker.tsx` | Selector con buscador para planes/ocasiones (ej. Tapear, Comer, Copas). |
| **Selector de Etiquetas** | `src/components/places/TagInput.tsx` | Entrada de tags con autocompletado y creación al vuelo. |
| **Mapa Interactivo** | `src/components/map/MapContainerWrapper.tsx` y `LeafletMap.tsx` | Integración dinámica de Leaflet con clustering y marcadores geolocalizados. |

### 2. Panel de Administración (`src/components/admin/`)
| Componente | Ruta | Descripción |
|---|---|---|
| **Dashboard Admin** | `src/components/admin/AdminDashboard.tsx` | Contenedor con pestañas administrativas. |
| **Tabla de Sitios** | `src/components/admin/PlacesTableManager.tsx` | Gestión masiva de sitios, filtros, fusión de duplicados y borrado. |
| **Gestión de Usuarios** | `src/components/admin/UsersManager.tsx` | Alta, roles, estado, cambio de idioma e invitaciones. |
| **Taxonomía** | `src/components/admin/TaxonomyManager.tsx` | Gestión de categorías/ocasiones y etiquetas. |
| **Configuración & Backup** | `src/components/admin/SettingsManager.tsx` | Descarga y restauración de backup completo en formato JSON de la BD. |
| **Sitios Demo** | `src/components/admin/DemoPlacesManager.tsx` | Botón para sembrar los 50 restaurantes demo de la comunidad. |

### 3. Perfil y Grupos Privados (`src/components/profile/`)
| Componente | Ruta | Descripción |
|---|---|---|
| **Perfil de Usuario** | `src/components/profile/EditProfileModal.tsx` | Edición de nombre, usuario, contraseña e idioma preferido (`es`/`en`). |
| **Grupos Privados** | `src/components/profile/GroupsModal.tsx` | Creación de grupos (ej. Amigos, Pareja), gestión de miembros y enlaces de invitación. |

---

## 💾 Capa de Datos y Backend

### 1. Esquema de Base de Datos (`src/db/schema.ts`)
- **`users`:** `id`, `username`, `email`, `name`, `passwordHash`, `role`, `status`, `locale` (`es` \| `en`).
- **`places`:** `id`, `name`, `address`, `city` (`"Ciudad, País"`), `latitude`, `longitude`, `googleMapsUrl`, `priceRange`, `notes`, `website`, `phone`, `communityPublished`, `createdById`.
- **`occasions`** y **`placeOccasions`**: Planes/categorías (`tapear`, `comer`, etc.).
- **`tags`** y **`placeTags`**: Etiquetas normalizadas (`pescaitofrito`, `michelin`, etc.).
- **`userPlaces`**: Interacciones privadas del usuario (favorito, estado `visited`/`pending`, notas privadas, puntuación).
- **`placeComments`**: Comentarios colaborativos entre usuarios.
- **`sharingGroups`** y **`sharingGroupMembers`**: Grupos privados de compartición.
- **`placeGroupAccess`**: Acceso de sitios compartidos con grupos específicos.
- **`savedFilters`**: Filtros guardados personalizados por usuario.

### 2. Server Actions (`src/lib/actions/`)
- **`places.ts`:** `createPlaceAction`, `updatePlaceAction`, `deletePlaceAction`, `toggleFavoriteAction`, `parseUrlAction`.
- **`auth.ts`:** `loginAction`, `logoutAction`, `updateMyProfileAction`, `setupAdminAction`.
- **`admin.ts`:** `adminUpdateUserAction`, `adminCreateUserAction`, `adminDeleteUserAction`.
- **`groups.ts`:** `createGroupAction`, `deleteGroupAction`, `createGroupInviteAction`, `joinGroupByInviteAction`.
- **`seed.ts`:** `seedDemoPlacesAction` (carga 50 sitios del mundo, usuarios demo, grupos demo y filtros).
- **`backup` API:** `src/app/api/admin/backup/route.ts` (GET exporta JSON completo, POST restaura JSON).

---

## 📝 Regla Estricta de Documentación (.MDs) ante Cambios o Novedades
> ⚠️ **REGLA OBLIGATORIA:** Cada vez que se desarrolle una nueva funcionalidad, se modifique el comportamiento existente o se añada una mejora visible, **ES OBLIGATORIO ACTUALIZAR LOS ARCHIVOS .MD**:
>
> 1. **`CHANGELOG_ES.MD` y `CHANGELOG.MD`**: Registrar los cambios detallados en su versión correspondiente (`[0.1.0]`) bajo la sección adecuada (`### Añadido`, `### Cambiado y Corregido`, etc.) tanto en español como en inglés.
> 2. **`README_ES.MD` y `README.MD`**: Resumen público de lo que hace la aplicación para quien la descubra en GitHub. **No debe incluir detalles técnicos de implementación interna**, sino describir de forma atractiva las capacidades y el valor de la app.
> 3. **`DOCUMENTACION.MD` y `DOCUMENTATION.MD`**: Guía y manual completo sobre **cómo usar la web**, flujos de trabajo, pantallas, importación/exportación y administración, enfocado en el uso práctico del usuario y administrador (sin tecnicismos de código fuente).

---

## 🌐 Internacionalización Obligatoria (i18n)
> ⚠️ **REGLA ESTRICTA:** Siempre que se añada o modifique cualquier texto, botón, mensaje, diálogo, tooltip o elemento visible de la interfaz, **DEBE AÑADIRSE OBLIGATORIAMENTE EN AMBOS IDIOMAS** (`src/locales/es.json` y `src/locales/en.json`) y sincronizarse en `src/locales/translations.csv` ejecutando `npm run i18n:export`. Nunca dejar textos literales hardcodeados en los componentes.

- **Archivos fuente:** `src/locales/es.json` y `src/locales/en.json`.
- **Sincronización:** `npm run i18n:export` actualiza `src/locales/translations.csv`.
- **Consistencia:** Mantener siempre las mismas claves en `es.json` y `en.json`. Ejecutar `npm run i18n:check` para verificar 0 faltantes.
- **Uso en componentes cliente:**
  ```tsx
  import { useT } from "@/lib/i18n/client";
  const { t, locale } = useT();
  <span>{t("places.all")}</span>
  ```

---

## 📍 Manejo de Ubicación y Países
- **`src/data/worldCountries.ts`:** Catálogo de más de 100 países con código ISO, bandera y nombres en español e inglés.
- **`src/data/spanishLocations.ts`:** Provincias y municipios de España según el INE.
- **`src/lib/location.ts`:**
  - `parseCityCountry(rawCity)`: Extrae `{ city, country }` reconociendo formatos como `"Granada, España"` o `"Nueva York, Estados Unidos"`.
  - `formatCityCountry(city, country)`: Normaliza el guardado.
  - `findCountry(query)`: Resuelve país y bandera por nombre o código.
