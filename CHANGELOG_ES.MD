# Registro de Cambios GastroMap

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

## [0.2.0] - 2026-11-26

Evolución multi-espacio de **GastroMap**: registro público configurable, **Mapa Personal privado** para cada cuenta y **grupos de amigos 100 % aislados** donde cada grupo funciona como su propia app independiente con sus sitios, categorías, etiquetas, listas y administradores propios.

### 🌍 Espacios Independientes, Grupos de Amigos y Mapa Personal
- **Arquitectura Multi-Espacio con Aislamiento Total**:
  - **🏠 Mi Mapa Personal**: Espacio estrictamente privado (`group_id = NULL`) para guardar sitios, notas y planes propios sin compartirlos con nadie.
  - **🍻 Grupos de Amigos Aislados**: Cualquier usuario puede crear tantos grupos como quiera (con nombre, emoji y descripción) e invitar amigos mediante enlaces mágicos (`/groups/join/[token]`). Cada grupo mantiene su propio catálogo, sus 8 planes base personalizables, sus etiquetas (`scope_key`), listas y filtros guardados sin mezclar datos ni miembros entre grupos.
  - **🌍 Todos mis sitios**: Vista combinada de lectura para consultar de un vistazo tu Mapa Personal junto con todos tus grupos, con insignia del espacio en cada tarjeta y filtro exclusivo por espacio.
- **Selector Rápido de Espacio (Workspace Switcher)**: Conmutador en la cabecera estilo Slack/Notion para saltar en un clic entre cualquiera de tus grupos, tu Mapa Personal o la vista combinada *Todos mis sitios*.
- **Copiar Sitio a Otro Espacio (`📋 Copiar a otro espacio…`)**: Crea una copia independiente de cualquier restaurante en otro grupo o en tu Mapa Personal conservando tu valoración personal, sin vincular ni exponer comentarios de otros grupos.
- **Migración Automática al Grupo «Pinono»**: Migración transparente de todos los usuarios, establecimientos, ocasiones, etiquetas, listas y filtros previos de `v0.1.0` dentro del grupo **«Pinono»**.
- **Eliminación de «Grupos Privados» Heredados v1**: Retiradas las antiguas tablas de compartición cruzada por ficha (`place_group_access` y `place_user_access`) y simplificada `getAllPlaces` a 4 consultas paralelas en bloque.

### 🔓 Registro Público Abierto (`/register`) y Control en `/admin`
- **Página de Registro Público (`/register`)**: Alta abierta con validación, *rate limiting*, soporte de redirección directa a invitaciones de grupo (`callbackUrl`) e inicialización automática del Mapa Personal.
- **Modo de Registro Configurable por Superadmin**: Conmutador instantáneo en `/admin > Configuración` para alternar entre **Registro Abierto** y **Solo por Invitación**.

### 🛡️ Administración por Grupo (`/group-admin`) y Panel `/admin` Escalable en 5 Secciones
- **Panel Dedicado `/group-admin` para Administradores de Grupo**: El creador del grupo y los co-administradores designados cuentan con su propio panel para consultar estadísticas del grupo, editar/fusionar duplicados, gestionar miembros/roles (`Creador` / `Admin grupo` / `Miembro`), aprobar solicitudes de unión, configurar enlaces de invitación revocables, gestionar la **Papelera de sitios (30 días)**, **Exportar el grupo completo**, configurar una **clave propia de Google Places API** y administrar planes/etiquetas propios del grupo (plegados por defecto).
- **Copia Masiva entre Espacios con Detección de Duplicados, Mover y Deshacer**: Desde `/admin > Sitios` y `/group-admin > Sitios` (y al copiar una tarjeta individual) puedes copiar o **mover** varios sitios a otro grupo o Mapa Personal eligiendo entre *Conservar ambos* (`(copia)`), *Reemplazar existente* o *Omitir*, con opción **Deshacer** durante 10 minutos, además de una pestaña **Salud de datos** para corregir enlaces no válidos, coordenadas o campos vacíos.
- **Detectar e Importar al Añadir Locales**: Si el establecimiento ya existe en otro de tus espacios, el formulario `/new` ofrece importar sus datos básicos (nombre, dirección, ciudad, coordenadas y enlace) conservando independientes los planes, etiquetas y comentarios de cada grupo, además de un banner superior con el espacio destino.
- **Baja Segura de Usuarios**: Al eliminar una cuenta con aportaciones en grupos compartidos, el administrador elige si reasignar sus sitios y comentarios al creador de cada grupo o eliminarlos, impidiendo borrar creadores de grupo sin transferir antes la propiedad.
- **API de Google Places por Grupo, Cupos y Caché**: Cada grupo puede usar su propia clave cifrada; sin ella, comparte la clave del proyecto con cupo mensual configurable (`900/mes` global de margen seguro bajo el tope gratuito de 1.000, `50/mes` por grupo), caché global de 30 días y respaldo automático en OpenStreetMap.
- **Compatibilidad de Backups `v0.1.x` y Escalabilidad**: La restauración de copias de seguridad antiguas migra automáticamente los sitios comunitarios a un «Grupo Principal» y filtra columnas eliminadas; además, el selector de espacios en cabecera incluye buscador automático cuando perteneces a más de 5 grupos.
- **Validación de Enlaces Maps y «Buscar en Google»**: Validación en `/new` y edición con opciones *Quitar enlace* / *Mantener igualmente*, enlace efectivo por coordenadas en móvil y acción **Buscar en Google** en el menú `⋮` de cada tarjeta.
- **Estadísticas Personales por Espacio y `SegmentedTabs` Animado**: Selector de espacio y desglose *Mis grupos* en `StatsModal`, leyenda compacta de roles y componente unificado `SegmentedTabs` en todas las pestañas de la app.
- **Reestructuración Escalable de `/admin` en 5 Secciones**:
  - **📊 Resumen** (vista por defecto): KPIs globales, insignia del modo de registro y tarjeta **Top grupos activos** con acceso directo a `/group-admin`.
  - **🍻 Grupos**: Directorio paginado, buscable y ordenable con filtros rápidos (`Todos`, `Con sitios`, `Vacíos`), contador de planes/etiquetas, creación inline de grupos y botón `Administrar →` para gestionar cada grupo y su taxonomía de forma aislada.
  - **👥 Usuarios**: Sub-pestañas **Usuarios** e **Invitaciones de plataforma**, filas compactas con botón **`🍻 N grupos`** que abre el modal **«Grupos y roles de @usuario»** (cambiar rol, expulsar o añadir a grupos) y **leyenda desplegable de permisos** (`SUPERADMIN`, `USUARIO`, `CREADOR`, `ADMIN GRUPO`, `MIEMBRO`).
  - **📍 Sitios**: Moderación global con filtro buscable de **Espacio / Grupo**, país y ciudad, más columna dedicada y ordenable de **Fecha**.
  - **⚙️ Sistema y Auditoría**: Sub-pestañas unificadas para **General y Acceso**, **Datos Demo** y **Auditoría**.
- **Ordenación Alfabética y Columnas Ordenables en Admin**:
  - Selector de **fusionar y reasignar etiquetas/categorías** ordenado estrictamente por orden alfabético (`A-Z`) con contador de sitios.
  - Cabeceras clicables de ordenación ascendente/descendente (`↑`/`↓`) por título/nombre, espacio, ciudad, precio, planes, autor, rol, estado o fecha en todas las tablas de administración.
- **Mejoras de Usabilidad Multi-Grupo y Tarjetas**:
  - **Selectores buscables (`SearchableSelect`)** ordenados alfabéticamente y ajustados al ancho del selector en `/new`, `GroupsModal`, `/group-admin`, `/admin`, `StatsModal`, cabecera y copia individual/masiva (`CopyPlaceModal` / `BulkCopyPlacesModal`).
  - **Modal de Grupos en Acordeón (`GroupsModal`)**: Formulario de creación colapsable, buscador en vivo y tarjetas plegadas por defecto para gestionar decenas de grupos sin scroll interminable.
  - **Tarjetas (`PlaceCard`) Compactas**: Chips de contexto (insignia de grupo y estado *Por descubrir* con borde discontinuo) unificados en la misma fila que categorías y `#tags` con separador vertical, y límite de 5 etiquetas visibles con botón **`+N más` / `Ver menos`**.
  - **Estadísticas Mejoradas en los 3 Niveles**: Progreso de exploración (*Por descubrir* y `% visitado`), desglose colapsable *Mis grupos* y filtro estricto por espacio en `StatsModal`; pulso de 30 días, salud del grupo y distribuciones en `/group-admin`; consumo de Google Places API y grupos activos/vacíos en `/admin`.
  - **Ancho Completo en `/docs` y `/new`**, y pie de página unificado en `/admin` y `/group-admin` con la web principal.

## [0.1.0] - 2026-11-25

Lanzamiento inicial completo de **GastroMap**, plataforma web privada y autohospedada para guardar, organizar, descubrir y decidir sitios donde comer, tapear o tomar algo.

### ✨ Explorador, Búsqueda y Filtros Inteligentes
- **Búsqueda Universal Insensible a Tildes**: Busca instantáneamente por nombre, ciudad, dirección, descripción, notas privadas, etiquetas, planes/ocasiones, comentarios, grupos compartidos y autores (cruzando nombre real, `username` y `@username` tanto del creador como de quienes comentan).
- **Paleta de Comandos (`Ctrl+K` / `⌘+K`)**: Navegación completa por teclado (`↑`/`↓`, `Enter`, `Esc`) para saltar a cualquier sitio (en lista o mapa) o lanzar acciones rápidas.
- **Barra de Experiencia Segmentada con Píldora Deslizante**: Filtra por `Todos`, `Favoritos`, `Quiero ir`, `Ya he ido` y `Por descubrir`, con sincronización bidireccional en la URL y botón **«Compartir vista»**.
- **Filtros Avanzados, Nota Mínima y «Plan con amigos»**:
  - Selectores buscables de países (+195) y ciudades, rangos de precio explícitos (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`, `???`), nota mínima (`★ 7+`, `★ 8+`, `★ 9+`), 8 planes/ocasiones por defecto personalizables y etiquetas.
  - **Filtro «Plan con amigos»**: Elige con qué usuarios sales y filtra locales con **11 modos** (con iconos y descripción dinámica): *Pendiente o por descubrir*, *Todos quieren ir*, *Alguno quiere ir sin probar*, *Alguno quiere ir aunque otro ya fue*, *Favorito de alguno*, *Favorito de todos*, *Favorito de alguno, nuevo para otros*, *Bien valorado por alguno (8+)*, *Probado por alguno, nuevo para otros*, *Visitado por todos* y *Añadidos por el grupo*.
  - **Filtros guardados (`💾`)**, estado vacío accionable con chips removibles, **Asistente de Decisión** paso a paso, **Modo Indecisión (`🎲 Al azar`)** y **Comparador lado a lado (`⚖️`)** de hasta 3 locales con ruta multi-parada en Google Maps.

### 🗺️ Mapa Interactivo, Geolocalización y Scraper de Enlaces
- **Mapa Leaflet con OpenStreetMap / PostGIS**: Clustering espacial dinámico, pines con estado personal, cálculo de distancia **«Cerca de mí»** (radio configurable), liberación inmediata de foco al pinchar en el mapa y modo **«Deslizar lista»** por defecto en móvil.
- **Alta Ultrarrápida (`/new`) y Web Share Target**: Comparte enlaces directamente desde Google Maps, Instagram o TikTok; resuelve redirecciones (`maps.app.goo.gl`, `g.co/kgs`, `share.google`), extrae coordenadas, sugiere planes automáticamente, evita descripciones genéricas (`"Bar"`, `"Restaurante"`) y detecta direcciones para no usarlas como nombre del local.
- **Enriquecimiento Opcional con Google Places API**: Clave configurable desde `/admin > Configuración` con guía integrada y botón de prueba en vivo, manteniendo OpenStreetMap / Nominatim como respaldo gratuito.

### 🔖 Colección Personal, Listas Compartibles y Comentarios
- **Colección Privada por Usuario**: Favoritos, estado personal (`Pendiente` / `Ya he ido`), valoración privada (`Mi nota`, 1 al 10) y notas privadas editables inline visibles únicamente para su autor.
- **Comentarios Colaborativos**: Hilo de reseñas con formato enriquecido, detección automática de enlaces, pestañas animadas (`Todos`, `Privadas`, `Comunidad`) y compositor desplegable en móvil. Los administradores pueden editar o eliminar cualquier comentario para moderación.
- **Listas / Colecciones Compartibles (Guías Personales)**: Crea listas temáticas (*«Ruta de tapas por Granada»*, *«Viaje a Lisboa»*), reordena paradas (`↑`/`↓`) y activa un **enlace público de solo lectura (`/guide/[slug]`)** accesible sin registro con mapa interactivo, paradas numeradas, metadatos Open Graph y botón **«Ruta en Google Maps»**.

### 👥 Grupos Privados, Invitaciones y Privacidad
- **Acceso Cerrado por Invitación**: Asistente inicial `/setup` para el primer administrador y registro posterior solo mediante enlaces de invitación privados (`/invite/[token]`) con caducidad y revocación anticipada.
- **Grupos Privados de Compartición**: Crea grupos cerrados con enlaces de unión (`/groups/join/[token]`), límite de usos, caducidad configurable y matriz acumulativa de permisos en servidor.

### 📱 Experiencia Móvil (PWA), Modo Offline y Micro-interacciones
- **Diseño Stitch Mobile-First**: Cabecera compacta, buscador píldora con conmutador `Lista / Mapa`, mapa superior + *Bottom Sheet* superpuesto, botón flotante **FAB «Añadir sitio»**, barra de navegación inferior fija (`Explorar`, `Añadir`, `Estadísticas`, `Menú`) y todos los modales unificados como **bottom-sheets con tirador superior y cierre deslizable (swipe-to-close)**.
- **PWA con Caché Offline y Cola de Escritura (IndexedDB)**: Instalable en iOS/Android con Service Worker (`/sw.js`), cola offline idempotente para favoritos, estados y valoraciones con sincronización automática al reconectar, y botón **«Limpiar caché»**.
- **Modo Claro / Oscuro y Micro-interacciones**: Cambio de tema con **View Transitions API**, tipografía **Plus Jakarta Sans**, iconografía unificada en **Google Material Symbols Outlined**, píldoras deslizantes, contadores animados y respeto a `prefers-reduced-motion`.

### 📊 Estadísticas Personales, «Wrapped» Anual e Importación / Exportación
- **Panel de Estadísticas y «Wrapped» Anual**: KPIs personales, ciudades favoritas, especialidades y tarjeta resumen anual descargable y compartible.
- **Importación y Exportación Multi-formato**: Exportación en **PDF nativo (A4 imprimible), JSON, CSV, GeoJSON, KML y GPX**; importación desde **JSON, GeoJSON, Google Takeout, KML, GPX y CSV** con detector de duplicados, vista previa y plantillas descargables.

### 🛠️ Panel de Administración (`/admin`), Auditoría y Backups
- **Panel Dedicado `/admin`**: Analítica global en tiempo real, tabla paginada de establecimientos (con edición, fusión de duplicados, borrado y backup por lote), gestión completa de usuarios, taxonomía (categorías con selector de emojis + Material Symbols, etiquetas, fusión y limpieza de vacías), invitaciones y generador/borrador selectivo de datos demo.
- **Entrar como Usuario (Suplantación Segura)**: Botón **«Entrar como»** en `/admin > Usuarios` con barra superior fija (**Top Alert**) indicando la cuenta activa y retorno en un clic a tu sesión de administrador.
- **Registro de Auditoría Completo y Limpieza**: Trazabilidad de acciones críticas (sitios, comentarios, usuarios, invitaciones, grupos, listas, ajustes, backups y suplantaciones) con buscador avanzado, etiquetas legibles y botones de purga (`Limpiar > 30d`, `Limpiar > 90d`, `Vaciar todo`).
- **Backups y Restauración Integral JSON (`/api/admin/backup`)**: Descarga y restauración completa de todas las tablas conservando la sesión activa del administrador (incluso al migrar entre instalaciones con distinto UUID) y zona de peligro para reseteo completo.

### 🌐 Internacionalización (i18n), Documentación y Versionado
- **Multi-idioma Extensible (Español / Inglés)**: Más de 1.000 claves sincronizadas entre `es.json`, `en.json` y `translations.csv` (`npm run i18n:export`, `i18n:import`, `i18n:check`) y selector escalable `LanguageSelector`.
- **Centro de Documentación Integrado (`/docs`)**: Visor Markdown completo (badges, tablas, enlaces, anclas, bloques de código y pestañas con píldora deslizante) para *Guía de uso*, *Changelog* y *README* en español e inglés.
- **Aviso Automático de Nueva Versión**: Comprobación en segundo plano contra GitHub Releases (`/api/version`) con píldora interactiva en la cabecera y tarjeta de versión con botón **«Comprobar ahora»** en `/admin > Configuración`.

### 🛡️ Seguridad y Arquitectura
- **Stack Moderno y Alto Rendimiento sin N+1**: Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL + PostGIS (Docker) y Tailwind CSS, con carga de catálogo en 5 consultas paralelas `inArray`, deduplicación por petición (`React.cache`), `UPSERT` atómico e interfaz instantánea (`0 ms` sin revalidación completa de ruta) en micro-interacciones personales, *code-splitting* dinámico (`next/dynamic`) de todos los modales y renderizado optimizado con `React.memo` + `useDeferredValue`.
- **Seguridad Reforzada y Suite de Tests**: Contraseñas hasheadas con **Argon2id**, sesiones en cookies `HttpOnly`, *rate limiting* en memoria para login/registro, cabeceras HTTP estrictas (CSP, HSTS, X-Frame-Options) y batería de tests automatizados de unidad, calidad de ingeniería, backups, auditoría, suplantación y guías públicas.
