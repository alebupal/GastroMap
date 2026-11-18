#!/usr/bin/env bash
set -e

# Asegurar que estamos en el directorio del proyecto
cd "$(dirname "$0")"

echo "🐘 Levantando contenedor de base de datos PostGIS..."
docker compose up -d db

export WATCHPACK_POLLING=true

echo "🚀 Iniciando GastroMap en http://localhost:3000..."
npm run dev:only
