# GastroMap 🍽️

[![Version](https://img.shields.io/badge/version-0.2.4-blue.svg)](https://github.com/alebupal/GastroMap/releases)
[![Docker Hub](https://img.shields.io/docker/pulls/alebupal/gastromap.svg)](https://hub.docker.com/r/alebupal/gastromap/)
[![Donate PayPal](https://img.shields.io/badge/Donate-PayPal-orange.svg)](https://www.paypal.me/alebupal)
[![License: GPL-3.0](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)

**GastroMap** es una aplicación web privada y autohospedada diseñada para guardar, organizar, descubrir y decidir sitios donde comer, tapear o tomar algo con amigos, pareja o familia.

Diseñada con un enfoque **mobile-first** e instalable como **PWA**, permite añadir lugares en cuestión de segundos (incluso compartiendo directamente desde Google Maps, Instagram o TikTok) y resolver la eterna pregunta de *«¿dónde vamos hoy?»* mediante filtros guiados por cercanía, ocasión, presupuesto o eligiendo al azar con un dado.

---

## ✨ Características Principales

* **➕ Alta ultrarrápida de sitios:**
  * Compatible con **Web Share Target API**: Comparte un enlace desde Google Maps o redes sociales y abre la ficha al instante en el móvil.
  * Banner superior con el espacio destino (*«Se añadirá a…»*), detección automática si el local ya existe en otro de tus espacios para **importar sus datos básicos**, y validación de enlaces de Google Maps con respaldo directo por coordenadas en móvil y opción **Buscar en Google** en cada tarjeta.
  * Soporte opcional de **Google Places API (New)** con **clave propia cifrada por grupo**, cupos mensuales configurables (`900/mes` global, `50/mes` por grupo), caché global de 30 días y respaldo automático gratuito con OpenStreetMap + Open Graph.
  * Clasificación ágil por 8 planes por defecto (*Desayuno / Brunch, Tapear / Cañas, Comer / Cenar, Informal / Rápido, Café / Merienda, Copas / Cócteles, Cita / Especial, Grupos / Celebración*) personalizables con emojis o iconos **Material Symbols**, y rango de precios (`€` a `€€€€` o `???` para no dejar sitios fuera).

* **🔍 Explorador Principal y Búsqueda Universal (Diseño Stitch UI/UX):**
  * **Barra de búsqueda unificada y Paleta de Comandos (`Ctrl+K` / `⌘+K`)**: Campo de búsqueda redondeado con acceso rápido `⌘K` navegable por teclado para saltar a cualquier sitio o acción, y píldoras integradas (`🎯 Asistente`, `🎲 Al azar`, `📦 Importar`, `📍 Cerca` y `➕ Añadir`).
  * **Filtros por experiencia segmentados (Fila 1) y Enlaces Compartibles**: Selector de estado personal (`Todos`, `⭐ Favoritos`, `🕒 Quiero ir`, `✅ Ya he ido`, `✨ Por descubrir`), sincronización automática de filtros en la URL con botón **«Compartir vista»**, chip de filtro activo (`✕`) y botón `💾 Guardar`.
  * **Segmentación en dos niveles (Fila 2) y Plan con amigos**: Selectores desplegables de países (+195) y ciudades (búsqueda sin distinguir tildes), rangos de precio explícitos (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`), filtro rápido por **nota mínima** (`★ 7+`, `★ 8+`, `★ 9+`), filtro **«Plan con amigos»** para encontrar sitios pendientes o por descubrir para los usuarios con los que quedas, categorías destacadas con panel desplegable animado `+ Filtros` y estado vacío con chips para quitar filtros individuales.
  * **Tarjetas de locales estilo Stitch y ordenación «✨ Para ti»**: Avatar con iniciales, dirección con pin y **copiado rápido de dirección**, badge de precio esmeralda, botón favorito, botones de colección (`Pendiente`, `Ya he ido`, `Mi nota`), **ordenación inteligente «✨ Para ti (Tus gustos)»** basada en tus favoritos y valoraciones, **enlace de ficha pública (`/p/[id]`) con vista previa Open Graph** sin exponer notas ni comentarios privados, y pie completo con autor y acciones.
  * **Paginación moderna y mapa sincronizado**: Botones de página circulares tipo píldora, recuento flotante en mapa y modo **«Deslizar lista»** activado por defecto en móvil para hacer scroll cómodamente sin quedar atrapado en el mapa.

* **🗺️ Mapa interactivo Leaflet:**
  * Teselas ligeras de OpenStreetMap / CartoDB (sin coste ni cuotas de Google Maps API).
  * Clustering dinámico de chinchetas y colores según tu estado personal.

* **🌍 Espacios Independientes, Grupos de Amigos, Mapa Personal y Guías:**
  * Despliegue autohospedado bajo servidor propio (Docker), con **registro público abierto** (`/register`) o **modo cerrado por invitación** configurable desde `/admin > Sistema y Auditoría`.
  * **Arquitectura Multi-Espacio 100 % aislada**: Cada usuario dispone de **🏠 Mi Mapa Personal** (privado) y puede crear (desde plantilla vacía, planes base o clonando otro grupo) o unirse a múltiples **🍻 Grupos de amigos** mediante enlaces mágicos (`/groups/join/[token]`) con aprobación opcional del administrador. Cada grupo funciona como su propia app independiente con sus propios sitios, planes, etiquetas, listas, **panel de administración de grupo (`/group-admin`)** con **cesión de propiedad y salida segura del grupo**, reasignación de autoría y cuenta fantasma **`👻 @usuario_eliminado`**, copia/movimiento masivo de sitios entre espacios con detección de duplicados y **Deshacer**, **Papelera (30 días)** y pestaña **Salud de datos**. Además, dispone de vista combinada **🌍 Todos mis sitios** y buscador rápido de grupos en la cabecera.
  * **Listas / Guías personales compartibles**: Agrupa locales en colecciones temáticas (viajes, rutas de tapas, planes especiales), ordénalos a tu gusto y activa un **enlace público de solo lectura** (`/guide/[slug]`) con mapa interactivo y ruta en Google Maps para compartirlo con amigos sin que tengan que registrarse.
  * Notas personales privadas y comentarios colaborativos en cada ficha de establecimiento. Los autores y administradores del grupo gestionan sus sitios.

* **📊 Estadísticas Personales, «Wrapped» Anual y Panel Admin Escalable (`/admin`):**
  * Panel de estadísticas personales (`📊 Stats`) con **filtro por espacio**, barra de **progreso de exploración** (*Por descubrir* / `% visitado`) y desglose colapsable **Mis grupos**, más resumen anual interactivo **«Wrapped»** por año enfocado en sitios probados, favoritos guardados, aportaciones y reseñas.
  * **Panel de Superadministración en 5 secciones (`/admin`)** con navegación lateral estilo Stitch: **Resumen** (KPIs + Top grupos), **Grupos** (directorio paginado con acceso a `/group-admin`), **Usuarios** (modal *«Grupos y roles»*, leyenda de permisos, baja segura con reasignación e invitaciones de plataforma), **Sitios** (moderación global, copia/movimiento masivo, **Salud de datos** y **Papelera**) y **Sistema y Auditoría** (cupos de API, backups compatibles con `v0.1.x`, datos demo y auditoría).

* **⚖️ Comparador, Filtros Guardados e Importación / Exportación:**
  * Comparador de establecimientos lado a lado (`⚖️`) para hasta 3 sitios.
  * Filtros guardados (`💾`) con etiqueta explícita, ordenación multicriterio, acciones rápidas centradas y taxonomías con buscador en vivo y carga progresiva «Mostrar más».
  * Exportación en **PDF nativo (imprimible A4), JSON, CSV, GeoJSON, KML y GPX** e importación desde **JSON, GeoJSON, Google Takeout (CSV/GeoJSON en español o inglés), KML, GPX y CSV** con deduplicación automática, vista previa y plantillas de ejemplo descargables por formato.
  * Copia de seguridad (backup) en lote de sitios seleccionados desde la tabla de administración.

* **🌐 Sistema Multi-idioma (i18n):**
  * Soporte completo para múltiples idiomas (Español 🇪🇸 / English 🇬🇧) con arquitectura extensible por JSON y CSV.
  * Desplegable de idioma personalizado y escalable (con buscador automático a partir de 6 idiomas) integrado en cabecera, perfil y panel admin, además de scripts CLI (`npm run i18n:export`, `npm run i18n:import`, `npm run i18n:check`).

* **📱 Experiencia Móvil (PWA), Caché Offline Integral y Modo Oscuro / Claro:**
  * Rediseño visual de alta gama con tipografía **Plus Jakarta Sans**, selector dual segmentado de tema, franja de estado PWA y tarjetas con avatares de iniciales gastronómicas.
  * Interfaz móvil nativa estilo Stitch con buscador píldora + botón `Lista / Mapa`, chips horizontales rápidos, **Bottom Sheet** deslizable bajo el mapa («Lugares Destacados»), todos los modales adaptados como **bottom-sheets con cierre deslizable hacia abajo (swipe-to-close)**, botón flotante **FAB «Añadir sitio»** y **barra de navegación inferior fija** (`Explorar`, `Añadir`, `Estadísticas`, `Menú`).
  * Botones de acciones rápidas (`🎯 Asistente`, `🎲 Al azar`, `📦 Importar / Exportar`, `📍 Cerca de mí`) justificados al 100% en cuadrícula adaptable para aprovechar todo el espacio útil en pantalla.
  * Botón flotante discreto «Subir arriba» con estética *glassmorphism* que aparece de forma no invasiva al hacer scroll.
  * Instalable en la pantalla de inicio de iOS y Android como Progressive Web App con **Service Worker, caché offline integral (`/sw.js`) y cola de escritura sin conexión**: puedes marcar favoritos, cambiar estados (`Quiero ir` / `Ya he ido`) y guardar notas privadas sin cobertura, y todo se sincroniza automáticamente al reconectar.
  * Selector interactivo de Modo Claro y Modo Oscuro (☀️ / 🌙) persistente en `localStorage`, sin parpadeo (FOUC).

* **🛡️ Seguridad, Auditoría y Copias de Seguridad:**
  * Rate limiting en memoria para mitigación de ataques de fuerza bruta en inicio de sesión y endpoints críticos.
  * Cabeceras de seguridad estrictas (CSP, X-Frame-Options, HSTS).
  * Descarga y restauración completa de copias de seguridad íntegras de la base de datos en JSON desde el panel de administración (conservando la sesión activa).

* **📚 Documentación y Registro de Cambios Integrado (`/docs`):**
  * Visor oficial de documentación y changelog integrado en la propia aplicación al estilo TVSPY.
  * Selector interactivo de idioma (Español 🇪🇸 / Inglés 🇬🇧) con carga local y fallback a GitHub Raw.
  * **Aviso automático de actualizaciones**: Comprueba GitHub Releases en segundo plano y muestra una píldora interactiva en la cabecera cuando hay una nueva versión disponible, además de botón de comprobación manual en `/admin > Configuración`.

* **🛠️ Panel de Administración y Limpieza:**
  * Gestión completa de usuarios: alta directa manual, edición exhaustiva de perfiles (nombre, @username, email, rol, estado), restablecimiento instantáneo de contraseñas y modo **«Entrar como usuario»** (con alerta superior y retorno en un clic al panel admin).
  * Registro integral de invitaciones privadas: listado con estados en tiempo real (Activa 🟢, Usada ✓, Caducada ⏳), copia de enlaces al portapapeles y revocación anticipada antes de caducar.
  * Tabla paginada de gestión global de establecimientos con fusión de duplicados, eliminación masiva y **registro de auditoría** de acciones críticas.
  * Gestión avanzada de taxonomía con bloques independientes para Categorías y Etiquetas, borrado masivo y botón «🧹 Eliminar vacías» con confirmación.
  * Integridad referencial con borrado en cascada: al eliminar un usuario o local se purgan de forma atómica todos sus comentarios, visitas, reseñas y referencias sin dejar registros huérfanos.

---

## 🚀 Despliegue Rápido con Docker Compose

La forma más sencilla de ejecutar GastroMap en tu servidor es usando Docker Compose:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: gastromap_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: gastromap
      POSTGRES_USER: gastromap
      POSTGRES_PASSWORD: tu_contraseña_segura_aqui
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U gastromap -d gastromap"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: alebupal/gastromap:latest
    container_name: gastromap_app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://gastromap:tu_contraseña_segura_aqui@db:5432/gastromap
      SESSION_SECRET: cambia_este_secreto_por_uno_aleatorio_largo
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

Inicia los contenedores con:
```bash
docker compose up -d
```

---

## 🛠️ Tecnologías Empleadas

* **Frontend & Backend:** [Next.js 16](https://nextjs.org/) (App Router, Server Actions, TypeScript)
* **Base de Datos:** [PostgreSQL 16](https://www.postgresql.org/) con extensión geoespacial [PostGIS 3.4](https://postgis.net/)
* **ORM:** [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit para migraciones controladas
* **Diseño e Interfaz:** [Tailwind CSS](https://tailwindcss.com/) + componentes mobile-first
* **Cartografía:** [Leaflet](https://leafletjs.com/) + OpenStreetMap
* **CI/CD:** GitHub Actions con compilación multi-arquitectura (`linux/amd64`, `linux/arm64`) para Docker Hub

---

## 🤝 Cómo Colaborar (Guía paso a paso para Humanos y Asistentes de IA)

¡Cualquier contribución es bienvenida! Esta guía está redactada con suficiente detalle y precisión técnica para que **cualquier persona pueda pasarla como instrucción a una IA (Cursor, Claude Code, Copilot, ChatGPT, etc.) y que el asistente realice todo el proceso de forma autónoma y correcta**.

### 🤖 Contexto Rápido para Agentes de IA
* **Arquitectura:** Monolito full-stack con Next.js 16 (App Router, TypeScript estricto, Server Actions y Server Components).
* **Base de Datos:** PostgreSQL 16 con PostGIS gestionado mediante Drizzle ORM (`src/db/schema.ts`).
* **Estilos:** Tailwind CSS con diseño mobile-first y componentes accesibles.
* **Autenticación y Seguridad:** Sesiones en base de datos (`sessions`) con cookies `HttpOnly` (`Secure` automático tras HTTPS), contraseñas con Argon2id, protección anti-SSRF en enlaces Maps y cifrado AES-256-GCM para claves API.

---

### 📋 Flujo de Trabajo para Crear una Contribución

#### 1. Clonar el repositorio y crear una rama
Haz un fork del repositorio en GitHub y clónalo en tu equipo:
```bash
git clone https://github.com/TU_USUARIO/GastroMap.git
cd GastroMap
```
Crea una rama descriptiva para tu cambio:
```bash
# Para una nueva funcionalidad:
git checkout -b feature/nombre-de-la-mejora

# Para corregir un error:
git checkout -b fix/descripcion-del-error
```

#### 2. Levantar el entorno local (en 1 solo comando)
Instala las dependencias y arranca el entorno de desarrollo:
```bash
npm install
npm run dev
```
*(Este comando levanta automáticamente la base de datos PostGIS en Docker y arranca Next.js en `http://localhost:3000`)*.

#### 3. Reglas de Código que la IA / Desarrollador debe cumplir
* **Tipado estricto:** Todo el código nuevo debe estar en TypeScript con tipos explícitos. No usar `any` sin justificación.
* **Cambios en base de datos:** Si modificas `src/db/schema.ts`, genera la migración correspondiente ejecutando:
  ```bash
  npm run db:generate
  npm run db:migrate
  ```
* **No subir secretos ni documentación privada:** Nunca añadas archivos `.env`, tokens ni ficheros dentro de `docs/`.
* **Formato de Commits (Conventional Commits):**
  Usa mensajes claros con el prefijo adecuado:
  * `feat: ...` para nuevas funcionalidades.
  * `fix: ...` para corrección de fallos.
  * `docs: ...` para cambios de documentación.
  * `refactor: ...` para refactorizaciones sin cambio de comportamiento.
  * `style: ...` para ajustes de interfaz o Tailwind.

#### 4. Verificación obligatoria antes de enviar la PR
Antes de hacer commit y push, comprueba que el proyecto compila sin errores:
```bash
npm run build
```
*(Si `npm run build` falla por tipos o rutas, corrígelo antes de continuar)*.

---

### 🚀 Cómo abrir la Pull Request (Plantilla Oficial)

1. Sube tu rama a tu repositorio de GitHub:
   ```bash
   git push -u origin feature/nombre-de-la-mejora
   ```
2. Entra en tu repositorio en GitHub y pulsa en **Compare & pull request**.
3. Rellena la descripción siguiendo esta plantilla exacta:

```markdown
### 📝 Descripción del cambio
Explicación clara y concisa de lo que añade o soluciona esta Pull Request.

### 🎯 Motivación y Contexto
¿Por qué es necesario este cambio? ¿Qué problema resuelve o qué caso de uso cubre?

### 🧪 ¿Cómo se ha probado?
- [ ] Compilación verificada con `npm run build` sin errores ni advertencias.
- [ ] Probado en entorno local (`http://localhost:3000`).
- [ ] Verificado en vista móvil / responsive.
- [ ] Migraciones de Drizzle generadas y aplicadas (si aplica cambios de BD).

### 📸 Capturas de pantalla o logs (opcional)
*(Añadir si hay cambios visuales en la interfaz)*
```

---

## ☕ Apoya el Proyecto

Si GastroMap te resulta útil para descubrir y organizar tus sitios gastronómicos favoritos, considera apoyar su desarrollo continuo:

- ☕ **Donar con PayPal**: [paypal.me/alebupal](https://www.paypal.me/alebupal)
- ⭐ **Dar una estrella** al repositorio en GitHub.
- 🐳 **Valorar la imagen** en Docker Hub: [alebupal/gastromap](https://hub.docker.com/r/alebupal/gastromap/)

---

## 📄 Licencia

Este proyecto está bajo la Licencia GNU GPL v3.0. Consulta el archivo [LICENSE](LICENSE) para más detalles.
