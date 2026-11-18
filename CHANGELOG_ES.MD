# Registro de Cambios GastroMap

Todos los cambios notables de este proyecto serán documentados en este archivo.

El formato se basa en [Keep a Changelog](https://keepachangelog.com/es-ES/1.0.0/)
y este proyecto se adhiere a [Versionado Semántico (SemVer)](https://semver.org/lang/es/).

## [0.1.0] - 2026-11-18

### Añadido
- **Arquitectura Base y Docker**:
  - Next.js 15 (App Router, Server Actions, TypeScript, Tailwind CSS).
  - Compilación multi-etapa optimizada standalone en `Dockerfile` y `docker-compose.yml`.
  - Contenedor de base de datos con PostgreSQL 16 y extensión PostGIS 3.4 (`postgis/postgis:16-3.4-alpine`).
  - Drizzle ORM configurado con esquema inicial (`users`, `sessions`, `invitations`) y migración aplicada.
  - Endpoint de comprobación de salud `/api/health` verificando PostgreSQL y PostGIS.
- **CI/CD y Sistema de Versiones (alineado con TVSPY)**:
  - Workflows de GitHub Actions para Docker Hub multi-arquitectura (`linux/amd64`, `linux/arm64`) en ramas (`main`, `dev`) y releases (`docker-image-branches.yml` y `docker-image-releases.yml`).
  - Servicio de versiones integrado (`versionService.ts`) y endpoint `/api/version` con comprobación automática de actualizaciones frente a GitHub Releases.
  - Registros de versiones en `CHANGELOG.MD` y `CHANGELOG_ES.MD`.
