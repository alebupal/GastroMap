# Registro de Cambios GastroMap

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

## [0.2.0] - 2026-11-18

### Añadido
- **Scroll Horizontal de Categorías con Ratón (`HorizontalScroll`)**:
  - Desplazamiento horizontal fluido en desktop con la rueda vertical del ratón (`wheel`) y arrastre sostenido (`drag-to-scroll`).
  - Aplicado en la barra de planes/ocasiones, selector de estados de experiencia y etiquetas populares.
- **Alta Manual de Usuarios para Administradores**:
  - Formulario directo en el panel de administración (`UsersManager`) para dar de alta usuarios a mano indicando nombre, @username, correo, contraseña y rol (Usuario o Administrador).
- **Datos de Demostración Enriquecidos (`DemoPlacesSeeder`)**:
  - El seeder de 20 sitios mundiales añade automáticamente para el usuario administrador interacciones completas: favoritos (⭐), estados («Ya he ido» y «Quiero ir»), puntuaciones, notas privadas y comentarios comunitarios.
- **Soporte de Donación PayPal y Repositorio Comunitario**:
  - Botón sutil de donación «Donar con PayPal» (`paypal.me/alebupal`) con icono de corazón tanto en cabecera como en pie de página.
  - Enlaces directos a GitHub, Docker Hub y PayPal al estilo de TVSpy, eliminando textos redundantes.
- **Colección Personal y Estados de Usuario (Fase 4)**:
  - Sistema de favoritos (⭐ / 🤍) con persistencia individual en `user_places`.
  - Estados personales independientes: «Quiero ir (Pendiente 🕒)» y «Ya he ido (Visitado ✅)».
  - Puntuaciones personales de 0 a 10 con decimales e insignias visuales en tarjetas.
  - Notas privadas personales («🔒 Mi nota») editables en modal interactivo, visibles únicamente para su autor.
- **Asistente de Decisión y Selector Aleatorio (Fase 4)**:
  - Asistente guiado «🎯 Encontrar un sitio» (`DecisionAssistantModal`) con 4 ejes de decisión: Plan/Ocasión, Rango de precio (manteniendo `???`), Distancia/Ubicación y Experiencia del grupo.
  - Selector aleatorio interactivo con botón **«🎲 Elegir al azar»** y modal con animación de ruleta (`RandomPickerModal`) sobre el subconjunto de sitios filtrados.
  - Filtro dinámico de Experiencia: «Visitados por mí», «Probados por amigos» y «✨ Sin estrenar».
- **Comentarios Colaborativos y Grupos de Compartición (Fase 5)**:
  - Hilo de recomendaciones y comentarios en cada tarjeta de establecimiento (`PlaceCommentsThread`).
  - Posibilidad de comentar en tiempo real con fecha, autor (`@username`) y control de borrado.
  - Ámbitos de visibilidad: selector en alta rápida entre `🌍 Comunidad (Todos)` y `🔒 Privado (Solo yo)` con control de acceso estricto en servidor.
  - Tablas relacionales para grupos de compartición (`sharing_groups`, `sharing_group_members`).
- **PWA & Web Share Target**:
  - Soporte PWA instalable en móviles y desktop (`manifest.json` y metadatos de aplicación).
  - Web Share Target para recibir enlaces compartidos directamente desde Google Maps, Instagram o navegador al formulario de alta rápida `/new`.

## [0.1.0] - 2026-11-18

### Añadido
- **Arquitectura Base y Docker (Fase 0)**:
  - Next.js 15 (App Router, Server Actions, TypeScript, Tailwind CSS).
  - Compilación multi-etapa optimizada standalone en `Dockerfile` y `docker-compose.yml`.
  - Contenedor de base de datos con PostgreSQL 16 y extensión PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`).
  - Drizzle ORM configurado con esquema inicial (`users`, `sessions`, `invitations`) y migraciones aplicadas.
  - Endpoint de comprobación de salud `/api/health` verificando PostgreSQL y PostGIS.
- **CI/CD y Sistema de Versiones (alineado con TVSPY)**:
  - Workflows de GitHub Actions para Docker Hub multi-arquitectura (`linux/amd64`, `linux/arm64`) en ramas (`main`, `dev`) y releases (`docker-image-branches.yml` y `docker-image-releases.yml`).
  - Servicio de versiones integrado (`versionService.ts`) y endpoint `/api/version` con comprobación automática de actualizaciones frente a GitHub Releases.
  - Registros de versiones en `CHANGELOG.MD` y `CHANGELOG_ES.MD`.
- **Sistema de Autenticación e Invitaciones (Fase 1)**:
  - Asistente de configuración inicial (`/setup`) para inicializar la base de datos y dar de alta al primer administrador.
  - Autenticación mediante sesiones persistentes en base de datos (`sessions`) con hash seguro de contraseñas Argon2id y cookies HTTP-only.
  - Sistema de registro privado por invitaciones con tokens criptográficos únicos y caducidad (`/invite/[token]`).
  - Panel administrativo de gestión de invitaciones (`InviteManager`) para generar, copiar y revocar enlaces.
- **Catálogo Gastronómico y Gestión de Taxonomía (Fase 2)**:
  - Esquema relacional en Drizzle ORM para locales (`places`), ocasiones (`occasions`), etiquetas (`tags`) y tablas intermedias (`place_occasions`, `place_tags`).
  - Formulario de alta rápida de locales (`/new`) con selector de presupuesto estimado (€, €€, €€€, €€€€), puntuaciones y notas personales.
  - Selector visual interactivo por chips/pills para categorización y etiquetado múltiple (sin campos de texto separados por comas).
  - Panel completo de administración de taxonomía (`TaxonomyManager`):
    - Conteo en tiempo real de lugares asociados a cada categoría y etiqueta.
    - Fusión/combinación de categorías y etiquetas duplicadas (`mergeOccasionsAction`, `mergeTagsAction`).
    - Eliminación segura con asistente para reasignar lugares asociados o desvincularlos limpiamente.
  - Categoría predeterminada renombrada a "Comer".
- **Geoposicionamiento y Mapa Interactivo (Fase 3)**:
  - Mapa interactivo integrado con Leaflet y tiles CartoDB Voyager (`MapView.tsx` y `MapContainerWrapper.tsx` con carga dinámica SSR-safe).
  - Pines gastronómicos vectoriales temáticos con `L.divIcon`, colores distintivos por ocasión y emojis centrales (`createPlaceMarkerIcon`).
  - Popups informativos flotantes con nombre, zona, rango de precio, notas y botón directo de indicaciones GPS («Cómo llegar ↗»).
  - Modo «Cerca de mí» con geolocalización en navegador y selector de radio dinámico (1 km, 2 km, 5 km, 10 km o sin límite).
  - Consultas espaciales en PostGIS con cálculo de distancia real (`ST_Distance`) y filtrado geodésico (`ST_DWithin`).
  - Indicador de distancia relativa en metros y kilómetros en tarjetas y popups (`📍 350 m`, `📍 1.4 km`).
  - Explorador unificado (`PlacesExplorer.tsx`) con alternador de vistas («🗺️ Mapa» / «📋 Lista») y sincronización bidireccional (botón «Ver en mapa»).
  - Selector jerárquico de ubicaciones cerradas (Provincia ➔ Población) en `LocationPicker.tsx` con catálogo precargado (`spanishLocations.ts`, ej. Granada ➔ Santa Fe, Armilla, Capital).
  - Buscador inteligente de direcciones con autocompletado en tiempo real mediante la API de OpenStreetMap / Nominatim (`geocoding.ts`) que resuelve calle, población, provincia y coordenadas con un clic.
- **Licencia, Identidad Visual y Guía para IAs**:
  - Licencia GNU General Public License v3.0 ([LICENSE](LICENSE)).
  - Favicon vectorial en formato SVG ([public/icon.svg](public/icon.svg)).
  - Guía detallada de colaboración dirigida a agentes IA y desarrolladores en [README.MD](README.MD) y [README_ES.MD](README_ES.MD).
  - Plantilla oficial estandarizada de Pull Requests ([.github/pull_request_template.md](.github/pull_request_template.md)).
- **Rendimiento de Compilación y Caché en Docker**:
  - Fichero `.dockerignore` para optimizar el contexto de Docker y excluir directorios pesados locales.
  - Montajes de caché BuildKit en `Dockerfile` para descargas de npm (`/root/.npm`) y caché del compilador de Next.js (`/app/.next/cache`).
  - Integración de caché oficial de GitHub Actions (`type=gha`, `mode=max`) en los workflows de CI multi-arquitectura.
