#!/usr/bin/env node
import fs from "fs";
import postgres from "postgres";

if (!process.env.DATABASE_URL && fs.existsSync(".env")) {
  for (const line of fs.readFileSync(".env", "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
}

function isValidGoogleMapsUrl(rawUrl) {
  const clean = (rawUrl || "").trim();
  if (!clean) return true;
  const match = clean.match(/https?:\/\/[^\s<>"]+/i);
  const extracted = match ? match[0].replace(/[),.;]+$/, "") : clean;
  try {
    const parsed = new URL(extracted);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();
    if (host === "maps.app.goo.gl") return true;
    if (host === "share.google") return true;
    if (host === "goo.gl" && path.startsWith("/maps")) return true;
    if (host === "g.co" && (path.startsWith("/kgs") || path.startsWith("/maps"))) return true;
    if (host.startsWith("maps.google.")) return true;
    if (/^(www\.)?google\.[a-z.]+$/.test(host) && path.startsWith("/maps")) return true;
    return false;
  } catch {
    return false;
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("Falta DATABASE_URL en el entorno.");
    process.exit(1);
  }
  const sql = postgres(connectionString);
  try {
    const rows = await sql`
      SELECT p.id, p.name, p.city, p.google_maps_url, p.latitude, p.longitude, g.name AS group_name
      FROM places p
      LEFT JOIN sharing_groups g ON g.id = p.group_id
      WHERE p.deleted_at IS NULL
      ORDER BY p.created_at DESC
    `;

    const invalid = rows.filter((r) => r.google_maps_url && !isValidGoogleMapsUrl(r.google_maps_url));
    const missingBoth = rows.filter(
      (r) => !r.google_maps_url && (r.latitude == null || r.longitude == null)
    );

    console.log(`Total sitios analizados: ${rows.length}`);
    console.log(`Enlaces no válidos de Google Maps: ${invalid.length}`);
    for (const r of invalid) {
      console.log(`  - [${r.group_name || "Mapa Personal"}] ${r.name} (${r.city || "?"}) -> ${r.google_maps_url}`);
    }
    console.log(`Sin enlace ni coordenadas: ${missingBoth.length}`);
    for (const r of missingBoth) {
      console.log(`  - [${r.group_name || "Mapa Personal"}] ${r.name} (${r.city || "?"})`);
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
