# GastroMap 🍽️

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/alebupal/GastroMap/releases)
[![Docker Hub](https://img.shields.io/docker/pulls/alebupal/gastromap.svg)](https://hub.docker.com/r/alebupal/gastromap/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**GastroMap** es una aplicación web privada y autohospedada diseñada para guardar, organizar, descubrir y decidir sitios donde comer, tapear o tomar algo con amigos, pareja o familia.

Diseñada con un enfoque **mobile-first** e instalable como **PWA**, permite añadir lugares en cuestión de segundos (incluso compartiendo directamente desde Google Maps, Instagram o TikTok) y resolver la eterna pregunta de *«¿dónde vamos hoy?»* mediante filtros guiados por cercanía, ocasión, presupuesto o eligiendo al azar con un dado.

---

## ✨ Características Principales

* **➕ Alta ultrarrápida de sitios:**
  * Compatible con **Web Share Target API**: Comparte un enlace desde Google Maps o redes sociales y abre la ficha al instante en el móvil.
  * Extracción y normalización automática de coordenadas y enlaces.
  * Clasificación ágil por planes (*Tapear, Comer comer, Postureo, Copas, Dulce/Café*) y rango de precios (`€` a `€€€€` o `???` para no dejar sitios fuera).

* **🔍 Encontrar un sitio («Asistente de Decisión»):**
  * Filtros por distancia real (*Cerca de mí a 1, 5, 10 o 25 km*) impulsados por **PostGIS**.
  * Búsqueda por ocasión, etiquetas gastronómicas y experiencia (*Visitado*, *Probado por otros*, *Sin estrenar*).
  * **🎲 Botón «Elegir al azar»**: Cuando no hay acuerdo sobre dónde ir, la app selecciona una opción entre los resultados filtrados.

* **🗺️ Mapa interactivo Leaflet:**
  * Teselas ligeras de OpenStreetMap / CartoDB (sin coste ni cuotas de Google Maps API).
  * Clustering dinámico de chinchetas y colores según tu estado personal.

* **🔒 Privacidad y Comunidad:**
  * Despliegue privado bajo servidor propio (Docker).
  * Acceso por invitación para tu círculo cercano (familia, pareja, amigos).
  * Espacios para notas personales privadas y comentarios colaborativos compartidos en cada ficha.

* **📱 Experiencia App Móvil (PWA):**
  * Instalable en la pantalla de inicio de iOS y Android.
  * Interfaz optimizada para uso táctil con una sola mano.

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

* **Frontend & Backend:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, TypeScript)
* **Base de Datos:** [PostgreSQL 16](https://www.postgresql.org/) con extensión geoespacial [PostGIS 3.4](https://postgis.net/)
* **ORM:** [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit para migraciones controladas
* **Diseño e Interfaz:** [Tailwind CSS](https://tailwindcss.com/) + componentes mobile-first
* **Cartografía:** [Leaflet](https://leafletjs.com/) + OpenStreetMap
* **CI/CD:** GitHub Actions con compilación multi-arquitectura (`linux/amd64`, `linux/arm64`) para Docker Hub

---

## 📄 Licencia

Este proyecto está bajo la Licencia MIT. Consulta el archivo [LICENSE](LICENSE) para más detalles.
