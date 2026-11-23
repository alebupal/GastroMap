import fs from "node:fs";
import path from "node:path";
import postgres from "postgres";

const envPath = path.resolve(process.cwd(), ".env");
const env = fs.existsSync(envPath) ? fs.readFileSync(envPath, "utf8") : "";
const dbUrl =
  process.env.DATABASE_URL ||
  (env.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim().replace(/^["']|["']$/g, "");

if (!dbUrl) {
  console.error("DATABASE_URL no encontrada");
  process.exit(1);
}

const sql = postgres(dbUrl);

function norm(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

const ALIASES = {
  chequia: "República Checa",
  czechia: "República Checa",
  "czech republic": "República Checa",
  "estados unidos": "Estados Unidos",
  "united states": "Estados Unidos",
  usa: "Estados Unidos",
  mexico: "México",
  japon: "Japón",
  japan: "Japón",
  tailandia: "Tailandia",
  thailand: "Tailandia",
  espana: "España",
  spain: "España",
  francia: "Francia",
  france: "Francia",
  italia: "Italia",
  italy: "Italia",
  portugal: "Portugal",
  "reino unido": "Reino Unido",
  uk: "Reino Unido",
  alemania: "Alemania",
  germany: "Alemania",
  "paises bajos": "Países Bajos",
  holanda: "Países Bajos",
};

const CITIES = {
  praga: "República Checa",
  "nueva york": "Estados Unidos",
  "ciudad de mexico": "México",
  tokio: "Japón",
  tokyo: "Japón",
  kyoto: "Japón",
  kioto: "Japón",
  fukuoka: "Japón",
  bangkok: "Tailandia",
  "chiang mai": "Tailandia",
  paris: "Francia",
  londres: "Reino Unido",
  roma: "Italia",
  lisboa: "Portugal",
  oporto: "Portugal",
  amsterdam: "Países Bajos",
  berlin: "Alemania",
};

function inferCountry(city, addr) {
  if (addr) {
    const segs = addr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const ordered = segs.length
      ? [segs[segs.length - 1], segs[0], ...segs.slice(1, -1)]
      : [];
    for (const seg of ordered) {
      const m = ALIASES[norm(seg)];
      if (m) return m;
    }
  }
  if (city) {
    const c = norm(city.split(",")[0]);
    if (CITIES[c]) return CITIES[c];
  }
  return "España";
}

async function main() {
  await sql.unsafe(`ALTER TABLE "occasions" ALTER COLUMN "icon" SET DATA TYPE varchar(50);`);
  await sql.unsafe(`ALTER TABLE "places" ADD COLUMN IF NOT EXISTS "country" varchar(100);`);

  const allPlaces = await sql`SELECT id, city, address, country FROM places`;
  let updatedCountries = 0;
  for (const p of allPlaces) {
    const inferred = inferCountry(p.city, p.address);
    if (!p.country || p.country !== inferred) {
      await sql`UPDATE places SET country = ${inferred} WHERE id = ${p.id}`;
      updatedCountries++;
    }
  }

  const NEW_OCCASIONS = [
    { id: "desayuno", name: "Desayuno / Brunch", icon: "🥐" },
    { id: "tapear", name: "Tapear / Cañas", icon: "🍢" },
    { id: "comer", name: "Comer / Cenar", icon: "🍽️" },
    { id: "informal", name: "Informal / Rápido", icon: "🍔" },
    { id: "cafe", name: "Café / Merienda", icon: "☕" },
    { id: "copas", name: "Copas / Cócteles", icon: "🍸" },
    { id: "cita", name: "Cita / Especial", icon: "🕯️" },
    { id: "grupos", name: "Grupos / Celebración", icon: "👥" },
  ];
  for (const o of NEW_OCCASIONS) {
    await sql`
      INSERT INTO occasions (id, name, icon)
      VALUES (${o.id}, ${o.name}, ${o.icon})
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon = EXCLUDED.icon
    `;
  }

  const legacyRows = await sql`
    SELECT place_id, occasion FROM place_occasions
    WHERE occasion IN ('casual', 'dulce', 'postureo', 'terraza')
  `;
  for (const row of legacyRows) {
    let targetOcc = null;
    let extraTag = null;
    if (row.occasion === "casual") targetOcc = "informal";
    else if (row.occasion === "dulce") {
      targetOcc = "cafe";
      extraTag = "dulce";
    } else if (row.occasion === "postureo") {
      targetOcc = "cita";
      extraTag = "postureo";
    } else if (row.occasion === "terraza") {
      extraTag = "terraza";
    }

    if (targetOcc) {
      const ex = await sql`
        SELECT id FROM place_occasions
        WHERE place_id = ${row.place_id} AND occasion = ${targetOcc}
        LIMIT 1
      `;
      if (!ex.length) {
        await sql`INSERT INTO place_occasions (place_id, occasion) VALUES (${row.place_id}, ${targetOcc})`;
      }
    }
    if (extraTag) {
      await sql`INSERT INTO tags (id, name) VALUES (${extraTag}, ${extraTag}) ON CONFLICT (id) DO NOTHING`;
      const exT = await sql`
        SELECT id FROM place_tags
        WHERE place_id = ${row.place_id} AND tag = ${extraTag}
        LIMIT 1
      `;
      if (!exT.length) {
        await sql`INSERT INTO place_tags (place_id, tag) VALUES (${row.place_id}, ${extraTag})`;
      }
    }
  }

  await sql`DELETE FROM place_occasions WHERE occasion IN ('casual', 'dulce', 'postureo', 'terraza')`;
  await sql`DELETE FROM occasions WHERE id IN ('casual', 'dulce', 'postureo', 'terraza')`;

  const countryStats = await sql`SELECT country, count(*)::int as c FROM places GROUP BY country ORDER BY c DESC`;
  const occStats = await sql`SELECT o.id, o.name, o.icon, count(po.id)::int as c FROM occasions o LEFT JOIN place_occasions po ON po.occasion = o.id GROUP BY o.id ORDER BY c DESC`;

  console.log("updatedCountries:", updatedCountries);
  console.log("countries:", countryStats);
  console.log("occasions:", occStats);
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
