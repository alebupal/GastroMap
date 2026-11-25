# Registro de Cambios GastroMap

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

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
- **Stack Moderno**: Next.js 15 (App Router), TypeScript, Drizzle ORM, PostgreSQL + PostGIS (Docker) y Tailwind CSS.
- **Seguridad Reforzada**: Contraseñas hasheadas con **Argon2id**, sesiones en cookies `HttpOnly`, *rate limiting* en memoria para login/registro y cabeceras HTTP estrictas (CSP, HSTS, X-Frame-Options).
