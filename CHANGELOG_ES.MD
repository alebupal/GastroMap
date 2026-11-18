# Registro de Cambios GastroMap

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

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
- **Licencia, Identidad Visual y Guía para IAs**:
  - Licencia GNU General Public License v3.0 ([LICENSE](LICENSE)).
  - Favicon vectorial en formato SVG ([public/icon.svg](public/icon.svg)).
  - Guía detallada de colaboración dirigida a agentes IA y desarrolladores en [README.MD](README.MD) y [README_ES.MD](README_ES.MD).
  - Plantilla oficial estandarizada de Pull Requests ([.github/pull_request_template.md](.github/pull_request_template.md)).
- **Rendimiento de Compilación y Caché en Docker**:
  - Fichero `.dockerignore` para optimizar el contexto de Docker y excluir directorios pesados locales.
  - Montajes de caché BuildKit en `Dockerfile` para descargas de npm (`/root/.npm`) y caché del compilador de Next.js (`/app/.next/cache`).
  - Integración de caché oficial de GitHub Actions (`type=gha`, `mode=max`) en los workflows de CI multi-arquitectura.
