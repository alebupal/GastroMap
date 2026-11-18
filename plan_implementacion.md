# GastroMap - Plan de Implementación y Bitácora de Progreso

Documento vivo de seguimiento del proyecto **GastroMap**. Aquí se registran las fases de desarrollo, las decisiones técnicas y el histórico de tareas completadas.

---

## 1. Información General y Repositorio

* **Proyecto:** GastroMap (Gestor Gastronómico colaborativo y privado)
* **Repositorio:** [https://github.com/alebupal/GastroMap](https://github.com/alebupal/GastroMap)
* **Autor / Commits:** `Alejandro Bueno Palma <alebupal@gmail.com>`
* **Colaborador único:** `alebupal`
* **Naturaleza:** Proyecto personal autohospedado (Docker).

---

## 2. Stack Tecnológico Acordado

* **Frontend y Backend (Monolito):** Next.js 15 (App Router, Server Actions, TypeScript).
* **Estilos e Interfaz:** Tailwind CSS + shadcn/ui (diseño táctil y mobile-first).
* **Base de Datos:** PostgreSQL 16 con extensión **PostGIS 3.4** (`postgis/postgis:16-3.4-alpine`).
* **ORM & Migraciones:** Drizzle ORM + Drizzle Kit.
* **Autenticación y Seguridad:** Sesiones nativas en base de datos con cookies seguras `HttpOnly` y hash de contraseñas con `argon2` / `bcrypt` (sin dependencias complejas de terceros).
* **Mapas y Geoespacial:** Leaflet (`react-leaflet`, `leaflet.markercluster`) con teselas OpenStreetMap / CartoDB. Búsquedas geoespaciales con PostGIS (`ST_DWithin`, `ST_Distance`) y fuzzy search con `pg_trgm`.
* **Móvil / PWA:** Manifest PWA con soporte para Web Share Target (recibir enlaces desde Android) y campo universal para pegar URLs (iOS / web).
* **Infraestructura:** Docker Compose (servicios `app` y `db`).

---

## 3. Hoja de Ruta por Fases

### Fase 0: Cimientos y Entorno Docker (Completada ✅)
- [x] Configuración de repositorio Git local y remoto.
- [x] Definición del stack tecnológico y plan de implementación.
- [x] Inicialización del proyecto Next.js 15 con TypeScript y Tailwind CSS.
- [x] Configuración de `docker-compose.yml` (PostGIS 16 + App en standalone).
- [x] Configuración de Drizzle ORM, schema inicial y conexión a base de datos.
- [x] Creación de contenedor `gastromap_db` con PostGIS 3.4 y aplicación de migración inicial.
- [x] Verificación de compilación de producción y healthcheck (`/api/health`).

### Fase 1: Autenticación, Usuarios e Invitaciones (Próxima)
- [ ] Helpers de sesión y hashing de contraseñas (`argon2`).
- [ ] Flujo de inicialización / creación del primer usuario Administrador.
- [ ] Formulario y acción de login/logout con cookies seguras `HttpOnly`.
- [ ] Generación y consumo de enlaces de invitación para amigos y familiares.

### Fase 2: Catálogo Básico y Alta Rápida de Sitios
- [ ] Esquema Drizzle para establecimientos, planes (`Tapear`, `Comer`, `Copas`...) y precios (`€` a `€€€€` o `???`).
- [ ] Formulario de alta rápida móvil (Nombre, enlace de Google Maps, dirección, coordenadas, plan, precio).
- [ ] Extracción y normalización básica de URLs de Google Maps.
- [ ] Listado de sitios en formato tarjetas y vista de ficha detallada.

### Fase 3: Geoposicionamiento y Mapa Interactivo
- [ ] Componente de mapa con Leaflet y clustering de marcadores.
- [ ] Filtro geográfico "Cerca de mí" con cálculo de distancias reales mediante PostGIS.
- [ ] Sincronización bidireccional entre filtros de lista y pines en el mapa.

### Fase 4: Colección Personal, Asistente de Decisión y PWA
- [ ] Esquema de estados personales (Guardado, Favorito, Pendiente/Visitado, notas privadas, nota 0-10).
- [ ] Asistente interactivo «Encontrar un sitio» con filtros guiados.
- [ ] Selector aleatorio: botón **«🎲 Elegir al azar»**.
- [ ] Configuración de PWA (`manifest.json`, iconos, Service Worker y Web Share Target).

### Fase 5: Compartición, Grupos y Comentarios Colaborativos
- [ ] Ámbitos de visibilidad (Comunidad general, Grupos privados, Acceso directo).
- [ ] Hilos de comentarios y recomendaciones colaborativas en cada ficha.
- [ ] Panel de administración básico (gestión de etiquetas y mantenimiento).

---

## 4. Bitácora de Acciones Realizadas

### [2026-11-18]
* **Git:** Repositorio inicializado en `/home/abueno/Proyectos/alebupal/GastroMap`.
  * Configurado committer: `Alejandro Bueno Palma <alebupal@gmail.com>`.
  * Configurada clave SSH dedicada: `~/.ssh/id_ed25519_alebupal`.
  * Rama principal fijada a `main`.
* **Análisis de requerimientos:** Revisada la especificación técnica completa (`gestor_gastronomico_especificacion.md`) y el resumen funcional (`gestor_gastronomico_resumen_amigos.md`).
* **Decisión de arquitectura:** Acordado stack tecnológico simplificando la autenticación a sesiones en base de datos para máxima fiabilidad en despliegue privado.
* **Documentación:** Creado `plan_implementacion.md` para seguimiento continuo.
* **Fase 0 (Cimientos completada):**
  * Estructurado el proyecto en Next.js 15 (App Router, TypeScript, Tailwind CSS, Autoprefixer).
  * Creado `docker-compose.yml` con `postgis/postgis:16-3.4-alpine` y `Dockerfile` multi-stage optimizado para standalone.
  * Configurado Drizzle ORM (`schema.ts`, `drizzle.config.ts`), generada y aplicada la primera migración `0000_mixed_bedlam.sql` con las tablas `users`, `sessions` e `invitations`.
  * Verificada la compilación (`next build`) y la conectividad real con PostgreSQL 16.4 y PostGIS 3.4.3.
  * Implementado endpoint de comprobación de salud `/api/health`.
