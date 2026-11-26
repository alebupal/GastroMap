# Guía y Documentación de GastroMap 🍽️

Bienvenido a la guía oficial de usuario, administración y arquitectura de **GastroMap**, la plataforma colaborativa y privada para guardar, explorar, decidir y compartir recomendaciones gastronómicas con amigos y familia.

---

## 📋 Índice
1. [Requisitos Previos](#1-requisitos-previos)
2. [Despliegue Rápido con Docker](#2-despliegue-rápido-con-docker)
3. [Configuración Inicial y Primer Administrador](#3-configuración-inicial-y-primer-administrador)
4. [Módulos y Funcionalidades](#4-módulos-y-funcionalidades)
5. [Grupos Privados e Invitaciones](#5-grupos-privados-e-invitaciones)
6. [Mapa Interactivo y Geolocalización (PostGIS)](#6-mapa-interactivo-y-geolocalización-postgis)
7. [Importación, Exportación y Copias de Seguridad](#7-importación-exportación-y-copias-de-seguridad)
8. [Internacionalización y Multi-idioma (i18n)](#8-internacionalización-y-multi-idioma-i18n)
9. [Seguridad y Control de Acceso](#9-seguridad-y-control-de-acceso)
10. [Arquitectura Técnica y Escalabilidad](#10-arquitectura-técnica-y-escalabilidad)
11. [Preguntas Frecuentes (FAQ)](#11-preguntas-frecuentes-faq)

---

## 1. Requisitos Previos

- Un servidor, mini-PC, NAS o VPS con **Docker Engine** (24+) y **Docker Compose**.
- 512 MB de memoria RAM libre mínima (1 GB recomendado).
- Puertos disponibles en el host:
  - `3000` (o el puerto externo que elijas en el compose, ej. `3007:3000`).
- Opcional: Un proxy inverso como **Nginx Proxy Manager**, **Traefik** o **Caddy** para SSL/HTTPS automático y acceso con dominio DuckDNS / personalizado.

---

## 2. Despliegue Rápido con Docker

La forma recomendada de desplegar GastroMap en producción es mediante `docker-compose.yml`:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: gastromap_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: ${POSTGRES_DB:-gastromap}
      POSTGRES_USER: ${POSTGRES_USER:-gastromap}
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-gastromap_secret}
    volumes:
      - ./data/pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER:-gastromap} -d ${POSTGRES_DB:-gastromap}"]
      interval: 5s
      timeout: 5s
      retries: 5

  app:
    image: alebupal/gastromap:latest
    container_name: gastromap_app
    restart: unless-stopped
    ports:
      - "3007:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://${POSTGRES_USER:-gastromap}:${POSTGRES_PASSWORD:-gastromap_secret}@db:5432/${POSTGRES_DB:-gastromap}
      SESSION_SECRET: ${SESSION_SECRET:-tu_secreto_aleatorio_muy_largo_de_minimo_32_caracteres}
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy
```

Inicia los contenedores en segundo plano:
```bash
docker compose up -d
```

Accede desde tu navegador a `http://IP_DE_TU_SERVIDOR:3007` o a través de tu proxy con HTTPS.

---

## 3. Configuración Inicial y Primer Administrador

Al acceder por primera vez a una instancia limpia:

1. La aplicación detecta automáticamente que la base de datos no tiene usuarios y te redirige a `/setup`.
2. Define las credenciales del **Administrador Principal**:
   - Nombre completo.
   - Nombre de usuario (`@usuario`).
   - Correo electrónico.
   - Contraseña segura (hasheada internamente con **Argon2id**).
3. Una vez completado el asistente, por defecto queda habilitado el **Registro Público Abierto (`/register`)**, de modo que cualquier persona puede crearse una cuenta con su propio **Mapa Personal** y crear o unirse a grupos de amigos. Si prefieres una instancia cerrada, desde `/admin > Configuración > Modo de Registro` puedes cambiar en cualquier momento a **Solo por Invitación**.

---

## 4. Módulos y Funcionalidades

### 🍽️ Explorador Gastronómico (Vista Principal - Diseño Stitch UI/UX)
- **Barra de Búsqueda, Paleta de Comandos (`Ctrl+K` / `⌘+K`) y Acciones Rápidas**: Campo de búsqueda en vivo con botón `⌘K` para abrir la paleta flotante navegable con teclado (`↑`/`↓`, `Enter`, `Esc`), botón de borrado rápido y píldoras de acción integradas en línea (`🎯 Asistente`, `🎲 Al azar`, `📦 Importar`, `📍 Cerca` y botón destacado `➕ Añadir`).
- **Selector de Experiencia Segmentado (Fila 1) y Vistas Compartibles**:
  - `🌐 Todos`: Catálogo global visible según tus permisos.
  - `⭐ Favoritos`: Sitios marcados con estrella para acceso rápido.
  - `🕒 Quiero ir`: Establecimientos pendientes en tu lista de deseos.
  - `✅ Ya he ido`: Locales que ya has visitado.
  - `✨ Por descubrir`: Locales del catálogo que aún no has visitado.
  - Chip de filtro activo con eliminación directa (`✕`), botón **«Compartir vista»** (copia la URL sincronizada con los filtros activos `q`, `city`, `country`, `price`, `exp`, `occ`, `tag`) y botón `💾 Guardar`.
- **Modo Offline con Cola de Escritura y Sincronización Automática**:
  - Si pierdes la cobertura mientras usas la app, puedes seguir marcando favoritos, cambiando estados personales (`Quiero ir` / `Ya he ido`) y guardando tu nota o puntuación privada.
  - Los cambios se guardan en una cola local persistente (`IndexedDB`), se muestra un banner discreto con el contador pendiente y todo se sincroniza automáticamente en orden al volver a estar en línea (o manualmente con `Sincronizar ahora`).
- **Filtros de Segmentación y Taxonomías (Fila 2)**:
  - `Países (+195)` y `Ciudades`: Selectores desplegables con buscador integrado.
  - `Rangos de Precio Numéricos`: Botones píldora para rangos explícitos (`< 20 €`, `20-30 €`, `30-40 €`, `> 40 €`).
  - `Nota mínima`: Filtro rápido (`★ 7+`, `★ 8+`, `★ 9+`) dentro del panel animado `+ Filtros`, junto a ocasiones y etiquetas gastronómicas (8 planes por defecto personalizables con emojis o iconos **Material Symbols** desde `/admin > Taxonomía`).
  - `Plan con amigos`: Selecciona con qué usuarios vas a salir (en `+ Filtros` o en el Asistente/Filtros móvil) y elige entre 11 modos con descripción dinámica (*Pendiente o por descubrir*, *Todos quieren ir*, *Alguno quiere ir sin probar*, *Alguno quiere ir aunque otro ya fue*, *Favorito de alguno*, *Favorito de todos*, *Favorito de alguno, nuevo para otros*, *Bien valorado por alguno (8+)*, *Probado por alguno, nuevo para otros*, *Visitado por todos* o *Añadidos por el grupo*). Combina a la perfección con **🎲 Al azar** y el mapa.
  - **Estado vacío accionable**: Si una combinación de filtros no devuelve resultados, aparecen chips clicables para retirar un filtro individual sin reiniciar toda la búsqueda.
- **Tarjetas de Locales Estilo Stitch**:
  - Avatar con iniciales del establecimiento, dirección con pin, badge de rango de precios esmeralda y botón de favorito interactivo (`favorite`).
  - Botones horizontales de colección rápida (`Pendiente`, `Ya he ido`, `Mi nota`) con micro-interacciones táctiles.
  - Pie de tarjeta con autor y botones de acción completos (`Comentarios`, `Comparar`, `Mapa`, `Google Maps`, **copiado rápido de datos del sitio**, `Editar`, `Eliminar`).
- **Mapa Interactivo Sincronizado**:
  - Insignia flotante superior derecha con recuento local en tiempo real y pulso radar en el pin seleccionado.
  - Modo **«Deslizar lista»** activado por defecto en móvil para hacer scroll sin quedar atrapado dentro del mapa.
  - Ventanas emergentes (popups) de mapa traducidas y con diseño unificado con las tarjetas.
- **Micro-interacciones, View Transitions y Paginación Moderna**:
  - Transición suave de tema Claro/Oscuro vía **View Transitions API**, píldora deslizante en selectores segmentados, contadores animados en KPIs, barras crecientes, skeletons *shimmer* y botones de paginación circulares con selectores desplegables personalizados (`CustomSelect`). Todo respetando `prefers-reduced-motion`.

### 📱 Experiencia Móvil Optimizada (Diseño Stitch)
- **Cabecera Compacta + Barra Inferior Fija (`MobileBottomNav`)**: Navegación con el pulgar (`Explorar`, `Añadir`, `Estadísticas`, `Menú`), lupa rápida en cabecera para abrir la paleta de comandos y botón flotante **FAB `Añadir sitio`**.
- **Mapa + Bottom Sheet Superpuesto y Modales Deslizables**: Buscador píldora con icono de filtros y conmutador naranja `Lista / Mapa`, carrusel horizontal de chips con contadores, panel blanco redondeado («Lugares Destacados») integrado bajo el mapa y **todos los modales presentados como bottom-sheets con tirador superior y gesto de arrastre hacia abajo (swipe-to-close)**.
- **Tarjeta Flotante Inferior y Salto Sincronizado**: Al pulsar cualquier chincheta en el mapa móvil, se despliega una tarjeta resumen inferior (*Bottom Card*) con nombre, rango de precio, botón de navegación directa en Google Maps (`🗺️ Cómo llegar`) y acceso a la ficha completa. Al pulsar *"Ver ficha completa →"*, la aplicación calcula automáticamente la página de paginación correcta, cambia a la lista y hace un scroll suave y centrado resaltando la tarjeta con un halo dorado.
- **Botón Flotante «Subir Arriba»**: Botón circular sutil y minimalista con estética *glassmorphism* que aparece de forma no invasiva al desplazarse más de 300px hacia abajo para volver inmediatamente a la parte superior.
- **Paginación Inteligente**: En modo lista los locales se muestran paginados con selector de tamaño configurable (10, 20, 50 o Todos) y selector de página para navegación ultra ágil.

### 🎲 Asistente de Decisión y Elección al Azar
- **🎲 Al azar (Selector Aleatorio)**: Cuando el grupo no se pone de acuerdo, selecciona al azar entre los locales que cumplan los filtros activos, con opciones para ver en el mapa, abrir en Google Maps o navegar directamente al establecimiento seleccionado en el listado de resultados (`Ver en el listado`).
- **Asistente de Decisión**: Guía paso a paso para definir presupuesto, tipo de plan, país, ciudad, distancia máxima y estado de visita.

### 💬 Comentarios Colaborativos, Valoración y Ficha Enriquecida
- **Comentarios y Nota Privada Unificados**: El modal de comentarios agrupa las reseñas de la comunidad y tu nota privada (solo visible para ti) con pestañas animadas (`Todos`, `Privadas`, `Comunidad`), edición inline de tu nota privada y compositor desplegable optimizado para móvil. Los administradores pueden editar o eliminar cualquier comentario para moderar o corregir erratas (con registro en auditoría).
- **Valoración Privada (`Mi nota`, 1 al 10)**: Modal rápido dedicado para asignar tu puntuación personal del 1 al 10 a cualquier restaurante.
- **Acciones Rápidas y Menú `⋮`**: Cada tarjeta cuenta con botones claros en su parte inferior (`Comentarios`, `Comparar`, `Mapa`, `Maps`, `Compartir`) y un menú `⋮` con **Guardar en lista**, `Editar` y `Eliminar` (este último reservado a administradores).
- **Comparador Lado a Lado (`⚖️`)**: Compara hasta 3 establecimientos simultáneamente por precio, distancia, servicios y notas.

### 🔖 Listas / Colecciones Compartibles (Guías Personales)
- **Organización Temática**: Desde el menú de usuario (*Mis listas y guías*) o pulsando `⋮ > Guardar en lista` en cualquier establecimiento, puedes crear colecciones temáticas como *«Ruta de tapas por Granada»*, *«Viaje a Lisboa»* o *«Cenas especiales»*.
- **Orden de Paradas Personalizable**: Expande cualquier lista en *Mis listas y guías* para reordenar las paradas (`↑`/`↓`) o retirar locales sin eliminarlos del catálogo general.
- **Enlace Público de Solo Lectura (`/guide/[slug]`)**: Activa el modo **Pública** en cualquier lista para generar un enlace compartible (con copia rápida o envío directo a WhatsApp). Tus amigos podrán ver la guía completa con mapa interactivo, paradas numeradas y botón **«Ruta en Google Maps»** sin necesidad de registrarse ni iniciar sesión. Puedes volver a poner la lista en modo **Privada** en cualquier momento para desactivar el enlace al instante.

---

## 5. Espacios Independientes, Grupos de Amigos y Mapa Personal

GastroMap organiza la experiencia en **espacios 100 % aislados**, de forma que cada grupo de amigos funciona como una aplicación propia sin mezclar sitios ni miembros con otros grupos:

- **Conmutador de Espacio en la Cabecera (Workspace Switcher)**:
  - **🏠 Mi Mapa Personal**: Espacio privado exclusivo para ti (`group_id = NULL`). Nadie más puede ver los sitios que guardes aquí.
  - **🍻 Mis Grupos de Amigos**: Espacios colaborativos independientes (con nombre, emoji y descripción). Al cambiar de grupo, el mapa, los filtros, el selector de amigos, las listas y las categorías/etiquetas cambian automáticamente a los de ese grupo.
  - **🌍 Todos mis sitios**: Vista combinada de solo lectura que reúne tu Mapa Personal y todos tus grupos, mostrando en cada tarjeta la insignia del espacio al que pertenece y habilitando el filtro rápido por **Espacios**.
- **Copiar Sitio a Otro Espacio**: Desde el menú `⋮ > Copiar a otro espacio…` de cualquier tarjeta puedes crear una copia independiente del restaurante en otro grupo o en tu Mapa Personal (conservando tu valoración personal, sin exponer comentarios ni reseñas de otros grupos).
- **Enlaces de Invitación a Grupos (`/groups/join/[token]`)**:
  - Genera enlaces compartibles con **caducidad configurable** (7 días, 30 días o sin caducidad), **límite de usos (`maxUses`)** y **revocación anticipada**.
  - Si quien abre el enlace aún no tiene cuenta, tras registrarse en `/register` o iniciar sesión vuelve automáticamente a la invitación para unirse al grupo.
- **Panel de Administración por Grupo (`/group-admin`)**:
  - El creador de cada grupo es su propietario + administrador y puede ascender a otros integrantes como **co-administradores (`Admin`)**.
  - Los administradores de un grupo acceden a `/group-admin` (desde el icono de ajustes junto al selector de espacio o *Mis grupos*) para gestionar **Estadísticas del grupo**, **Tabla de sitios y fusión de duplicados** (con columnas ordenables), **Miembros, roles e invitaciones**, **Planes y etiquetas propios del grupo** (con selector de fusión ordenado alfabéticamente) y **Ajustes / eliminación del grupo**.
  - El panel global `/admin` queda reservado exclusivamente al **Superadministrador** de la instancia e incluye la pestaña global **Grupos** y cabeceras de ordenación en todas sus tablas.

---

## 6. Mapa Interactivo y Geolocalización (PostGIS)

- **Motor Geoespacial PostGIS**: Almacena las ubicaciones con el tipo nativo `geography(Point, 4326)`, permitiendo búsquedas espaciales indexadas por radio de distancia ultra rápidas.
- **Cálculo de Distancia «Cerca de mí»**: Con un solo clic en *Cerca de mí*, el navegador solicita tu ubicación GPS y calcula la distancia exacta en metros o kilómetros utilizando la fórmula esférica de Haversine en cliente y PostGIS en servidor.
- **Clustering Espacial Dinámico**: Cuando hay muchos locales concentrados en una misma zona urbana, el mapa los agrupa automáticamente en clústeres numéricos interactivos que se expanden al hacer zoom.
- **Tiles sin Coste**: Por defecto utiliza OpenStreetMap oficial sin marcas de agua ni costes de API. Si dispones de una clave de CartoDB Voyager, puedes configurarla en el Panel de Administración.
- **Importador Inteligente desde Google Maps**: Al pegar un enlace acortado (`maps.app.goo.gl`, `g.co/kgs`, `share.google`), el servidor sigue las redirecciones, extrae las coordenadas reales, el nombre del establecimiento y rellena la ficha automáticamente.

---

## 7. Importación, Exportación y Copias de Seguridad

En el modal de **Importar / Exportar** (`📦`) dispones de herramientas completas para migrar o respaldar tu catálogo:

### 📤 Formatos de Exportación
- **PDF (Estándar 1.4)**: Generador nativo que produce un catálogo imprimible en A4 con tipografía Helvetica, cabecera formal, paginación dinámica, enlace directo a Google Maps (`[Ver en Google Maps]`), rangos de precio limpios y soporte completo de acentos y caracteres especiales.
- **JSON**: Volcado estructurado con todas las propiedades, etiquetas y categorías.
- **CSV**: Compatible con Excel, Google Sheets y LibreOffice Calc.
- **GeoJSON**: Formato estándar para SIG (Sistemas de Información Geográfica) como QGIS o ArcGIS.
- **KML**: Compatible con Google Earth y Google My Maps.
- **GPX**: Formato GPS estándar con waypoints para dispositivos Garmin, OsmAnd o wikiloc.

### 📥 Formatos de Importación
- Archivos `.json`, `.geojson`, `.kml`, `.gpx` y `.csv`.
- **Plantillas y Archivos de Ejemplo Descargables**: La pestaña de importación incluye botones de descarga con un clic para obtener documentos de ejemplo completos y funcionales para cada uno de los formatos aceptados (`JSON`, `CSV`, `GeoJSON`, `KML`, `GPX`), facilitando preparar y verificar la estructura antes de importar.
- Detección automática de duplicados por nombre y proximidad de coordenadas con vista previa interactiva antes de confirmar la importación.
- **Auto-creación de Ocasiones y Tags**: Al importar datos que contengan categorías u ocasiones temáticas, el sistema las registra automáticamente en el catálogo de `occasions` y `tags`, auto-sincronizando los selectores y filtros.
- **Detección Automática de Enlaces (LinkifiedText)**: Cualquier URL presente en notas personales o comentarios se transforma automáticamente en un enlace web seguro clicable.

### 🛡️ Copia de Seguridad y Administración Avanzada (Panel Admin `/admin`)
- **Ruta Dedicada `/admin` Escalable en 5 Secciones**: El panel de Superadministración vive en su propia ruta protegida (`/admin`) con menú lateral fijo en escritorio (y desplegable en móvil) organizado en 5 áreas claras: **Resumen** (KPIs + Top grupos activos), **Grupos** (directorio paginado con acceso directo a `/group-admin` para gestionar sitios, miembros y taxonomía de cada grupo), **Usuarios** (cuentas + sub-pestaña de Invitaciones de plataforma, modal «Grupos y roles» y leyenda de permisos), **Sitios** (moderación global con filtro por Espacio/Grupo) y **Sistema y Auditoría** (sub-pestañas General y Acceso, Datos Demo y Auditoría).
- **Roles Claros con Leyenda Integrada**: El primer usuario creado en `/setup` es **SUPERADMIN** (control global de la plataforma). Los usuarios posteriores se registran como **USUARIO** (con su Mapa Personal privado) y adquieren rol de **CREADOR** o **ADMIN GRUPO** únicamente en los grupos que creen o donde sean promovidos. Tanto `/admin > Usuarios` como `/group-admin > Miembros` incluyen una leyenda desplegable explicando qué hace cada rol.
- **Analítica Global en Tiempo Real**: Panel con 6 indicadores KPI, pulso de actividad de los últimos 30 días, ranking de top contribuidores, sitios más populares y distribuciones por ciudades, planes, precios y etiquetas.
- **Backup por Lote de Sitios**: Desde la tabla de establecimientos, los administradores pueden seleccionar casillas de verificación de sitios específicos y descargar una copia de seguridad JSON exclusiva de los mismos.
- **Borrado Selectivo de Datos Demo**: Permite limpiar los 50 establecimientos y usuarios predefinidos de la semilla de prueba sin alterar los sitios propios ni los grupos creados por el usuario.
- **Zona de Peligro — Resetear Aplicación**: Herramienta irreversible para vaciar completamente la base de datos (sitios, comentarios, grupos, miembros e invitaciones) conservando únicamente la cuenta del administrador actual.
- **Copia de Seguridad y Restauración Integral**: En el Panel de Administración > Ajustes > Copia de Seguridad, puedes descargar un volcado íntegro en JSON de todas las tablas relacionales y **restaurarlo** en cualquier momento (incluso en una nueva instalación tras `/setup`, conservando automáticamente tu sesión activa y todas las referencias del backup).
- **Entrar como Usuario (Suplantación Segura)**: Desde `/admin > Usuarios`, los administradores pueden pulsar **«Entrar como»** en cualquier cuenta activa para ver GastroMap exactamente como ese usuario. Un banner superior fijo indica en todo momento la cuenta activa e incluye un botón **«Cerrar sesión»** para regresar al panel de administración con registro automático en auditoría.
- **Versión y Actualizaciones Automáticas**: La aplicación consulta automáticamente GitHub Releases (`/api/version`) y muestra una píldora interactiva en la cabecera cuando hay una versión más reciente disponible. Desde `/admin > Configuración` puedes ver la versión instalada y forzar una comprobación inmediata con **«Comprobar ahora»**.

---

## 8. Internacionalización y Multi-idioma (i18n)

GastroMap cuenta con un sistema de traducción dinámico y extensible inspirado en el flujo de trabajo de TVSpy:

- **Idiomas Soportados**: Español (`es`) e Inglés (`en`).
- **Selector en la Cabecera y Perfil**: Menú desplegable en la barra superior y selector en la edición de perfil, con persistencia tanto en cookie segura (`gastromap_lang`) como en la base de datos de usuario (`users.locale`).
- **Sincronización Bidireccional por Hoja de Cálculo**:
  - `src/locales/es.json` y `src/locales/en.json`: Diccionarios estructurados consumidos por la aplicación.
  - `src/locales/translations.csv`: Hoja de cálculo tabular donde cada columna representa un idioma.
  - **Añadir un nuevo idioma** es tan sencillo como añadir una columna al archivo CSV y ejecutar el conversor.
- **Comandos CLI disponibles**:
  ```bash
  npm run i18n:export   # Exporta todos los JSON a translations.csv
  npm run i18n:import   # Regenera los archivos JSON desde translations.csv
  npm run i18n:check    # Audita claves que falten en algún idioma
  ```

---

## 9. Seguridad y Control de Acceso

- **Cifrado de Contraseñas con Argon2id**: Los hashes de contraseñas emplean el algoritmo ganador de la Password Hashing Competition (PHC) con salt aleatorio y resistencia a ataques GPU/ASIC.
- **Rate Limiting en Memoria**: Protección automática contra ataques de fuerza bruta en los endpoints de autenticación (`/login`), registro y validación de tokens de grupo.
- **Cabeceras de Seguridad HTTP (Strict Security Headers)**:
  - `X-Frame-Options: SAMEORIGIN` (protección contra Clickjacking).
  - `X-Content-Type-Options: nosniff` (protección contra MIME-sniffing).
  - `Referrer-Policy: strict-origin-when-cross-origin`.
  - `Permissions-Policy: geolocation=(self), camera=(), microphone=()`.
  - `Content-Security-Policy`: Restricción estricta de orígenes autorizados para scripts, estilos, fuentes, imágenes y conexiones de tiles.
- **Aislamiento de Grupos y Permisos**: Las Server Actions validan en cada consulta la pertenencia del usuario a los grupos privados antes de exponer datos o permitir operaciones.
- **Registro de Auditoría (`audit_logs`)**: Registro histórico en base de datos de acciones administrativas críticas (borrados masivos, reseteos de claves, descargas de backups).

---

## 10. Arquitectura Técnica y Escalabilidad

GastroMap está construido bajo los principios de modularidad, tipado estricto y alto rendimiento:

```
┌────────────────────────────────────────────────────────┐
│                   Cliente Web (PWA)                    │
│   Next.js 15 App Router • Tailwind CSS • Leaflet Maps  │
└───────────────────────────▲────────────────────────────┘
                            │ Server Actions / REST API
┌───────────────────────────▼────────────────────────────┐
│                    Servidor Node.js                    │
│   i18n Engine • Rate Limiting • Argon2 • Geo Parser    │
└───────────────────────────▲────────────────────────────┘
                            │ Drizzle ORM
┌───────────────────────────▼────────────────────────────┐
│              PostgreSQL 16 + PostGIS 3.4               │
│   Índices GiST espaciales • Relaciones en Cascada      │
└────────────────────────────────────────────────────────┘
```

- **Single Source of Truth de Versión**: La versión de la aplicación se centraliza en `package.json` y se consume en cliente y servidor a través de `src/lib/version.ts`.
- **Diseño Visual e Identidad (Stitch UI/UX)**: Interfaz construida con la tipografía geométrica Plus Jakarta Sans, paleta gastronómica cálida, avatares de iniciales y conmutador segmentado para temas claro y oscuro.
- **Drizzle ORM con TypeScript**: Migraciones versionadas en `drizzle/` aplicables de forma determinista y tipos inferidos para el 100% de los esquemas.
- **Caché Offline Integral y PWA**: Service Worker (`/sw.js`) con almacenamiento local que precachea la aplicación, almacena en caché las teselas de mapas (`gastromap-tiles-v1`) y ofrece respaldo completo sin conexión a internet para consultar el catálogo y mapas guardados en movilidad, sótanos o zonas rurales.
- **Tests Automatizados**: Suite de pruebas nativas con `npm test` verificando consistencia de traducciones, fórmulas espaciales, seguridad y parsers.

---

## 11. Preguntas Frecuentes (FAQ)

### ¿Cómo cambio la versión de la aplicación?
Solo necesitas cambiar el campo `"version"` en [package.json](package.json). La cabecera, el pie de página, los servicios y la API adoptarán la nueva versión de manera automática.

### ¿Cómo añado un nuevo idioma (por ejemplo, Francés o Alemán)?
1. Ejecuta `npm run i18n:export` para generar `src/locales/translations.csv`.
2. Añade una nueva columna (ej. `fr` o `de`) con las traducciones en tu hoja de cálculo o editor de texto.
3. Ejecuta `npm run i18n:import` para generar automáticamente el nuevo archivo `.json`.
4. Registra el nuevo código de idioma en `src/lib/i18n/config.ts`.

### ¿Se pueden exportar e importar las rutas gastronómicas a dispositivos GPS?
Sí. El sistema soporta el estándar GPX (`.gpx`) tanto en exportación como en importación, permitiendo cargar tus sitios directamente en relojes deportivos, GPS de coche o aplicaciones como OsmAnd.
