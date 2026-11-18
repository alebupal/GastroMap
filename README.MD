# GastroMap 🍽️

[Versión en Español](README_ES.MD)

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/alebupal/GastroMap/releases)
[![Docker Hub](https://img.shields.io/docker/pulls/alebupal/gastromap.svg)](https://hub.docker.com/r/alebupal/gastromap/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**GastroMap** is a private, self-hosted web application to save, organize, discover, and decide where to eat, have tapas, or grab drinks with friends, partner, or family.

Built with a **mobile-first** approach and installable as a **PWA**, it lets you add places in seconds (even by sharing directly from Google Maps, Instagram, or TikTok) and solves the everyday question of *“Where should we go today?”* with guided distance, occasion, and budget filters, or by rolling a dice.

---

## ✨ Key Features

* **➕ Ultra-Fast Place Ingestion:**
  * Compatible with the **Web Share Target API**: Share a link directly from Google Maps or social networks and open the place card instantly on your phone.
  * Automatic coordinate and link normalization.
  * Fast classification by occasion (*Tapas, Full Meal, Trendy/Rooftops, Drinks, Coffee/Dessert*) and price range (`€` to `€€€€` or `???` so unknown places aren't left out).

* **🔍 Decision Assistant:**
  * Real distance filters (*Nearby within 1, 5, 10, or 25 km*) powered by **PostGIS**.
  * Filter by occasion, culinary tags, and past experience (*Visited*, *Tried by others*, *Untested*).
  * **🎲 Random Picker Button**: When nobody can agree, let the app pick a spot from your filtered list.

* **🗺️ Interactive Leaflet Map:**
  * Free, lightweight OpenStreetMap / CartoDB tiles (zero Google Maps API billing or quotas).
  * Dynamic marker clustering and color-coded status badges.

* **🔒 Privacy & Community:**
  * Self-hosted on your own infrastructure (Docker).
  * Invitation-only access for your inner circle.
  * Space for private personal notes as well as collaborative shared comments on each place.

* **📱 Mobile App Experience (PWA):**
  * Installable on iOS and Android home screens.
  * Touch-optimized interface designed for single-hand usage.

---

## 🚀 Quick Deployment with Docker Compose

The easiest way to run GastroMap is using Docker Compose:

```yaml
services:
  db:
    image: postgis/postgis:16-3.4-alpine
    container_name: gastromap_db
    restart: unless-stopped
    environment:
      POSTGRES_DB: gastromap
      POSTGRES_USER: gastromap
      POSTGRES_PASSWORD: your_secure_password_here
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
      DATABASE_URL: postgres://gastromap:your_secure_password_here@db:5432/gastromap
      SESSION_SECRET: change_this_secret_to_a_long_random_string
      PORT: 3000
    depends_on:
      db:
        condition: service_healthy

volumes:
  pgdata:
```

Start the stack with:
```bash
docker compose up -d
```

---

## 🛠️ Tech Stack

* **Frontend & Backend:** [Next.js 15](https://nextjs.org/) (App Router, Server Actions, TypeScript)
* **Database:** [PostgreSQL 16](https://www.postgresql.org/) with [PostGIS 3.4](https://postgis.net/) extension
* **ORM:** [Drizzle ORM](https://orm.drizzle.team/) + Drizzle Kit
* **UI & Styling:** [Tailwind CSS](https://tailwindcss.com/)
* **Maps:** [Leaflet](https://leafletjs.com/) + OpenStreetMap
* **CI/CD:** GitHub Actions with multi-arch building (`linux/amd64`, `linux/arm64`) for Docker Hub

---

## 📄 License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
