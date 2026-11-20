#!/usr/bin/env node

/**
 * Script para importar directamente los 146 lugares de alebupal a la base de datos PostgreSQL.
 * Uso: node scripts/import-user-places.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import postgres from "postgres";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
let jsonPath = path.join(rootDir, "lugares", "lugares_import.json");
if (!fs.existsSync(jsonPath)) {
  jsonPath = path.join(rootDir, "lugares_import.json");
}

// Leer variables de entorno de .env
const envPath = path.join(rootDir, ".env");
let databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl && fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("DATABASE_URL=")) {
      databaseUrl = trimmed.split("=")[1].replace(/["']/g, "").trim();
      break;
    }
  }
}

if (!databaseUrl) {
  databaseUrl = "postgres://gastromap:gastromap@localhost:5432/gastromap";
}

if (!fs.existsSync(jsonPath)) {
  console.error("❌ No se encontró el archivo lugares_import.json");
  process.exit(1);
}

const placesData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
console.log(`📦 Leídos ${placesData.length} lugares desde lugares_import.json`);

const KNOWN_OCCASIONS = {
  tapear: { name: "Tapear", icon: "🍢" },
  comer: { name: "Comer", icon: "🍽️" },
  desayuno: { name: "Desayuno / Brunch", icon: "🥞" },
  dulce: { name: "Un dulce", icon: "🍰" },
  cafe: { name: "Café", icon: "☕" },
  copas: { name: "Copas", icon: "🍸" },
  postureo: { name: "Postureo", icon: "✨" },
  casual: { name: "Casual / Rápido", icon: "🍔" },
  cita: { name: "Cita / Especial", icon: "🕯️" },
  terraza: { name: "Terraza / Vistas", icon: "☀️" },
  bar: { name: "Bar / Tapas", icon: "🍻" },
  restaurante: { name: "Restaurante", icon: "🍽️" },
};

const sql = postgres(databaseUrl, { max: 1 });

async function main() {
  try {
    // 1. Buscar usuario alebupal o primer administrador
    let [targetUser] = await sql`
      SELECT id, username, name FROM users 
      WHERE username = 'alebupal' OR role = 'admin' 
      ORDER BY CASE WHEN username = 'alebupal' THEN 0 ELSE 1 END, created_at ASC 
      LIMIT 1
    `;

    if (!targetUser) {
      console.error("❌ No se encontró ningún usuario en la base de datos. Inicia la app y completa el setup inicial.");
      process.exit(1);
    }

    console.log(`👤 Asignando lugares a usuario: @${targetUser.username} (${targetUser.name || 'Admin'}) [ID: ${targetUser.id}]`);

    let imported = 0;
    let updated = 0;

    for (const item of placesData) {
      const {
        name,
        city,
        address,
        latitude,
        longitude,
        priceRange,
        googleMapsUrl,
        notes,
        occasions = [],
        tags = [],
        personalStatus,
      } = item;

      // Buscar si ya existe por nombre y ciudad
      const [existing] = await sql`
        SELECT id FROM places 
        WHERE name = ${name} AND (city = ${city} OR city IS NULL)
        LIMIT 1
      `;

      let placeId;

      if (existing) {
        placeId = existing.id;
        await sql`
          UPDATE places 
          SET 
            address = ${address},
            latitude = ${latitude},
            longitude = ${longitude},
            price_range = ${priceRange || '???'},
            google_maps_url = ${googleMapsUrl},
            notes = ${notes},
            updated_at = NOW()
          WHERE id = ${placeId}
        `;
        updated++;
      } else {
        const [inserted] = await sql`
          INSERT INTO places (
            name,
            city,
            address,
            latitude,
            longitude,
            price_range,
            google_maps_url,
            notes,
            community_published,
            created_by_id
          ) VALUES (
            ${name},
            ${city},
            ${address},
            ${latitude},
            ${longitude},
            ${priceRange || '???'},
            ${googleMapsUrl},
            ${notes},
            true,
            ${targetUser.id}
          )
          RETURNING id
        `;
        placeId = inserted.id;
        imported++;
      }

      // Ocasiones
      if (occasions.length > 0) {
        for (const occ of occasions) {
          const cleanOcc = typeof occ === "string" ? occ.trim().toLowerCase() : "";
          if (!cleanOcc) continue;
          const known = KNOWN_OCCASIONS[cleanOcc];
          const occName = known
            ? known.name
            : cleanOcc.charAt(0).toUpperCase() + cleanOcc.slice(1).replace(/[-_]/g, " ");
          const occIcon = known ? known.icon : "🍽️";

          await sql`
            INSERT INTO occasions (id, name, icon)
            VALUES (${cleanOcc}, ${occName}, ${occIcon})
            ON CONFLICT (id) DO NOTHING
          `;

          await sql`
            INSERT INTO place_occasions (place_id, occasion)
            VALUES (${placeId}, ${cleanOcc})
            ON CONFLICT DO NOTHING
          `;
        }
      }

      // Tags
      if (tags.length > 0) {
        for (const tag of tags) {
          const cleanTag = tag.trim().toLowerCase();
          if (cleanTag) {
            await sql`
              INSERT INTO tags (id, name)
              VALUES (${cleanTag}, ${cleanTag})
              ON CONFLICT DO NOTHING
            `;
            await sql`
              INSERT INTO place_tags (place_id, tag)
              VALUES (${placeId}, ${cleanTag})
              ON CONFLICT DO NOTHING
            `;
          }
        }
      }

      // Estado personal (He estado / No he estado)
      if (personalStatus === "visited" || personalStatus === "pending") {
        await sql`
          INSERT INTO user_places (user_id, place_id, personal_status)
          VALUES (${targetUser.id}, ${placeId}, ${personalStatus})
          ON CONFLICT (user_id, place_id)
          DO UPDATE SET personal_status = ${personalStatus}
        `;
      }

      // Comentarios colaborativos de alebupal
      const rawComments = [];
      if (typeof item.comment === "string" && item.comment.trim()) {
        rawComments.push(item.comment.trim());
      }
      if (Array.isArray(item.comments)) {
        for (const c of item.comments) {
          if (typeof c === "string" && c.trim()) {
            rawComments.push(c.trim());
          }
        }
      }
      for (const content of rawComments) {
        const [existingComment] = await sql`
          SELECT id FROM place_comments 
          WHERE place_id = ${placeId} AND user_id = ${targetUser.id} AND content = ${content}
          LIMIT 1
        `;
        if (!existingComment) {
          await sql`
            INSERT INTO place_comments (place_id, user_id, content, created_at, updated_at)
            VALUES (${placeId}, ${targetUser.id}, ${content}, NOW(), NOW())
          `;
        }
      }
    }

    console.log(`\n🎉 ¡Importación completada con éxito!`);
    console.log(`   ➕ Nuevos creados: ${imported}`);
    console.log(`   🔄 Actualizados: ${updated}`);
    console.log(`   📊 Total procesados: ${placesData.length}`);
  } catch (err) {
    console.error("❌ Error durante la importación:", err);
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
