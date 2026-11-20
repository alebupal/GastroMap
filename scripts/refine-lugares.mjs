import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const txtPath = path.join(rootDir, "lugares", "lugares.txt");
const jsonPath = path.join(rootDir, "lugares", "lugares_import.json");

const txtContent = fs.readFileSync(txtPath, "utf8");
const places = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

// 1. Extraer comentarios explícitos de alebupal desde lugares.txt
const commentMap = new Map();
const blocks = txtContent.split(/\n\s*\n/);

for (const b of blocks) {
  const m = b.match(/Comentario para todos de alebupal\s*-\s*["“]?([^"”\n]+)["”]?/i);
  if (m) {
    const comment = m[1].trim();
    const urlMatch = b.match(/https?:\/\/[^\s\n]+/);
    const firstLine = b.trim().split("\n")[0].trim();
    if (urlMatch) {
      commentMap.set(urlMatch[0], comment);
    }
    commentMap.set(firstLine, comment);
  }
}

// Conjunto de tags ruidosos o irrelevantes a descartar
const bannedTags = new Set([
  "granada", "barcelona", "bilbao", "sevilla", "madrid", "kyoto", "fukuoka", "tokio",
  "bangkok", "chiangmai", "praga", "nuevayork", "cdmx", "ciudaddemexico", "elborn",
  "poblenou", "chamberi", "salamanca", "arganzuela", "greenwich", "manhattan", "huelva",
  "costadelaluz", "elportil", "canarias", "grancanaria", "moya", "frigiliana", "malaga",
  "aljarafe", "bormujos", "condesa", "centrohistorico", "coyoacan", "teotihuacan",
  "sanfranciscomazapa", "hakata", "ginza", "salesas", "lalatina", "santillanadelmar",
  "cantabria", "lazubia", "jerezdelmarquesado", "pinosgenil", "pulianas", "nivar",
  "capileira", "romilla", "fuentevaqueros", "colomera", "padul", "pampaneira",
  "güejarsierra", "campillodearenas", "fuensanta", "albolote", "lamalaha", "guadix",
  "calahonda", "caparacena", "armilla", "maracena", "churrianadelavega", "monachil",
  "durcal", "txakoli", "peldanyos", "dabizmuñoz", "viral", "turismo", "espectacular",
  "abundante", "leche", "canasybarril", "tapasgratis", "centro"
]);

// Limpiezas específicas de nombres y notas
const cleanNameMap = {
  "Restaurante Asador Txakoli Simón - Especialidad chuletón": "Restaurante Asador Txakoli Simón",
  "La Cantina Mexicana.": "La Cantina Mexicana",
  "Restaurante Borneo Plaza. “Cocina de producto”.": "Restaurante Borneo Plaza",
  "La Abuela Pepa.Restaurante": "Restaurante La Abuela Pepa",
  "Kaisen Experience - Granada": "Kaisen Experience",
  "Santoro Pizzeria Granada": "Santoro Pizzeria",
  "Pizzería Verace | Pizzería Granada": "Pizzería Verace",
  "Casa Julio | Pampaneira": "Casa Julio",
  "Esquinita de Trini - Panadería": "Esquinita de Trini",
  "Cafetería - Pastelería Sierra": "Cafetería Pastelería Sierra",
  "Hotel restaurante el ancla": "Restaurante El Ancla",
};

// Descripciones objetivas (notas) para los sitios que tenían su comentario en notes
const objectiveNotesMap = {
  "Grasshopper Ramen Bar": "Bar de ramen japonés artesanal con fideos caseros y caldo cocinado a fuego lento en El Born.",
  "Bulka Bakery": "Pastelería y panadería artesana especializada en repostería tradicional del este de Europa y tarta Napoleón.",
  "Pork's Mostecka": "Taberna checa tradicional especializada en codillo asado crujiente (koleno) y cerveza Pilsner de grifo.",
  "Bagel Pub": "Bagels estilo neoyorquino horneados a diario con gran variedad de quesos crema y rellenos.",
  "Gray's Papaya": "Puesto histórico neoyorquino famoso por sus perritos calientes clásicos y zumos tropicales.",
  "Levain Bakery": "Panadería célebre de Manhattan por sus galletas gigantes recién horneadas con interior cremoso.",
  "Shake Shack Herald Square": "Cadena icónica de hamburguesas smash en pan de patata y batidos artesanales.",
  "Pastelerías Martina de Zuricalday Bilbao": "La pastelería artesanal más antigua de Euskadi (desde 1830), famosa por sus bollos de mantequilla.",
  "Restaurante Asador Txakoli Simón": "Asador tradicional en el monte Artxanda con gran terraza y parrilla de carbón para chuletón madurado.",
  "Mesón La Tablita": "Mesón costero tradicional con marisco fresco de la costa onubense, coquinas y pescado frito.",
  "Taberna La Trastienda de Moya Quesos y Vinos": "Taberna canaria tradicional con tabla de quesos de la isla y vinos del país.",
  "Restaurante El Acebuchal": "Cocina tradicional de monte en la aldea de Frigiliana con carnes de caza y pan artesanal.",
  "La Cantina Mexicana": "Comida mexicana casera, tacos al pastor y margaritas en el centro de Sevilla.",
  "La Choza de Manuela": "Mesón rústico del Aljarafe conocido por sus generosas bandejas de carne a la brasa y raciones.",
  "Sonora Taco Fish Ave Coyoacán": "Tacos al estilo de la costa sonorense con camarón y pescado capeado con salsas caseras.",
  "El Vilsito": "Taller mecánico de día y una de las taquerías nocturnas de tacos al pastor al carbón más famosas de CDMX.",
  "Restaurante El Cardenal": "Institución gastronómica de Ciudad de México dedicada a la cocina tradicional de cazuela y convento.",
  "La Coyoacana": "Cantina tradicional mexicana en el barrio de Coyoacán con música en directo y platillos típicos.",
  "La Gruta": "Restaurante ubicado dentro de una cavidad volcánica prehispánica junto a las pirámides de Teotihuacán.",
  "Ramen Sen-no-Kaze Kyoto": "Restaurante de ramen en Kioto reconocido por su intenso caldo paitan de cerdo y marisco con chashu tostado.",
  "Curry Nile": "Puesto histórico de curry japonés con receta secreta de especias en la estación de Hakata.",
  "Age.3 GINZA": "Local especializado en sándwiches fritos de pan shokupan rellenos de crema dulce en Ginza.",
  "Bami Jae Hua Chinese noodle": "Local tradicional de noodles al huevo hechos a mano al estilo chino-tailandés con cerdo asado char siu.",
  "The Island Bangkok": "Restaurante ribereño en Bangkok célebre por su sopa de fideos al curry del norte (Khao Soi).",
  "Toto e Peppino": "Pizzería napolitana con horno de leña tradicional y masa de larga fermentación.",
  "Sushiaoi": "Restaurante japonés con modalidad buffet a la carta de alta calidad en el barrio de Salamanca.",
  "Pizza Pronto": "Pizzería artesanal italiana de barrio con pizzas al corte y enteras de masa ligera.",
  "Cesar's Burgers": "Hamburguesería artesanal conocida por sus smash burgers jugosas, salsas de la casa y patatas sazonadas.",
  "Casa Quevedo": "Despacho tradicional en Santillana del Mar con sobaos pasiegos de mantequilla pura, quesadas y leche fresca.",
  "Coctelería Alexander": "Coctelería clásica de atmósfera íntima donde preparan cócteles a medida según las preferencias del cliente.",
  "Restaurante Los Manueles - García Lorca": "Casa histórica de gastronomía andaluza famosa por sus albóndigas de ternera en salsa y sus croquetones gigantes.",
  "Restaurante Los Manueles - Bib Rambla": "Terraza en la plaza Bib-Rambla con cocina andaluza tradicional, croquetas caseras y tapeo.",
  "Santoro Pizzeria": "Pizzería con masa fermentada lentamente, ingredientes italianos DOP y bordes alveolados.",
  "Restaurante Borneo Plaza": "Cocina de producto centrada en conservas prémium, degustación de anchoas del Cantábrico y pan artesanal.",
  "Restaurante la Vaca en Llamas": "Restaurante asador especializado en cortes de ternera a la parrilla, chuletas y guarniciones caseras.",
  "La Buhardilla": "Taberna tradicional de tapas con platos contundentes de cocina casera y raciones para compartir.",
  "Restaurante La Abuela Pepa": "Restaurante de cocina norteña y tradicional conocido por su cachopo asturiano crujiente y carnes selectas.",
  "Kaisen Experience": "Buffet japonés con pedidos mediante tablet de sushi variado, gyozas, tatakis y platos calientes.",
  "Restaurante It's Vietnam": "Restaurante de cocina vietnamita informal con rollitos nem, sopa pho tradicional y fideos de arroz.",
  "Restaurante El Gallo": "Asador y restaurante campestre en Nívar con terraza, vistas panorámicas y jornadas gastronómicas periódicas.",
  "El Corral del Castaño": "Restaurante gastronómico en la Alpujarra con cocina creativa de producto local y postres de autor.",
  "Mesón Casa David": "Restaurante de cocina china tradicional y auténtica con platos caseros.",
  "Sintapujos Taberna Manuel Adame": "Taberna marinera de cocina de mercado especializada en atún rojo de almadraba y mariscos frescos.",
  "MITICO BAR": "Bar de tapas moderno y dinámico con propuestas de cocina fusión y raciones para compartir.",
  "Restaurante La bolera": "Restaurante tradicional famoso por sus arroces marineros caldosos con bogavante y menús del día generosos.",
  "Sabanera 99": "Cafetería y confitería artesana destacada por sus tartas de queso de sabores y repostería creativa.",
  "Camino De La Huerta": "Restaurante campestre con terraza de verano, carnes a la brasa y ambiente relajado entre huertos.",
  "TRESCERO": "Local de ambiente vanguardista en el centro de Granada con tapas de autor y coctelería selecta.",
  "Pizzería Verace": "Auténtica pizza napolitana elaborada según la disciplina tradicional con ingredientes importados de Italia.",
  "La Sitarilla": "Emblemático bar de tapas granadino caracterizado por tapas muy generosas y guisos de cuchara.",
  "Restaurante La Cantina de Diego": "Restaurante rústico junto a la garganta de Monachil con cocina casera, embutidos y carnes a la brasa.",
  "La barra de SAN REMO": "Céntrico bar de tapas popular por sus patatas bravas, hamburguesas de la casa y albóndigas en salsa.",
  "Casa Julio": "Mesón de cocina alpujarreña tradicional con terraza agradable en el pueblo blanco de Pampaneira.",
  "Ruta de la Seda Gin & Cóctel Premium Club": "Coctelería premium con amplia carta de ginebras internacionales, destilados selectos y ambiente lounge.",
  "Casa Damián": "Bar de barrio mítico reconocido por sus bocadillos crujientes de jamón asado recién hecho en salsa.",
  "Esquinita de Trini": "Panadería y confitería de barrio con panes tradicionales de masa madre y bollería recién horneada.",
  "Valle Secreto": "Restaurante y merendero en plena naturaleza de Güéjar Sierra con terraza junto al río y cocina a la brasa.",
  "Shawarmita": "Puesto de comida callejera árabe especializado en shawarmas al estilo sirio-libanés con pan pita caliente.",
  "GOALE": "Local de comida rápida artesanal con smash burgers, patatas fritas sazonadas y entrantes crujientes.",
  "Restaurante Casa Enrique": "Restaurante de carretera en Fuensanta conocido por sus abundantes carnes a la brasa y guisos caseros.",
  "Origami Fusion Kitchen": "Restaurante de sushi y cocina asiática de fusión con rolls de autor, baos y gyozas crujientes.",
  "Mesón Baño Frio": "Mesón rural en La Malahá con terraza fresca en verano, comida casera andaluza y carnes a la brasa.",
  "Restaurante Alqueria de Los Lentos": "Alquería histórica con molino harinero del siglo XVI rodeada de jardines y gastronomía mediterránea pausada.",
  "Cafetería Pastelería Sierra": "Cafetería y confitería en Guadix destacada por sus desayunos completos con tostadas variadas y repostería artesana.",
  "Restaurante El Ancla": "Restaurante costero frente a la playa en Calahonda especializado en fritura de pescado y mariscos.",
  "Restaurante Los Nogales": "Restaurante tradicional con amplios salones y terraza en la vega granadina para arroces y carnes a la brasa.",
  "La taberna del Kosmonauta": "Taberna cosmopolita en el barrio del Realejo con tapas vanguardistas, vinos singulares y platos de mercado.",
  "Casa Caparacena": "Bar de pueblo con terraza famoso por sus tapas colosales que acompañan a cada bebida a precio popular.",
  "Sexitana Ultramarinos": "Tienda gourmet y ultramarinos especializada en quesos artesanos de Granada y embutidos ibéricos.",
};

const refined = places.map((place) => {
  const originalName = place.name;
  const cleanName = cleanNameMap[originalName] || originalName;

  // Buscar comentario de alebupal correspondiente a este lugar
  let userComment =
    commentMap.get(place.googleMapsUrl) ||
    commentMap.get(originalName) ||
    null;

  if (!userComment) {
    for (const [key, val] of commentMap.entries()) {
      if (originalName.toLowerCase().includes(key.toLowerCase().slice(0, 15)) || key.toLowerCase().includes(originalName.toLowerCase().slice(0, 15))) {
        userComment = val;
        break;
      }
    }
  }

  // Distinción entre notas públicas y comentarios de alebupal
  let notes = objectiveNotesMap[cleanName] || place.notes;
  const comments = userComment ? [userComment] : [];

  // Si no había comentario en lugares.txt pero la nota actual suena a comentario personal:
  if (!userComment && place.notes) {
    const isPersonalOpinion =
      /recomienda|favorito|mejores|según|probé|increíble|cola|mama|madre|antonio|beba|lucia/i.test(place.notes) ||
      place.notes.includes("http");
    if (isPersonalOpinion) {
      comments.push(place.notes);
      notes = objectiveNotesMap[cleanName] || null;
    }
  }

  // Limpieza de tags (eliminar bannedTags y normalizar)
  const rawTags = (place.tags || []).map((t) => t.trim().toLowerCase());
  const cleanTags = Array.from(new Set(rawTags.filter((t) => !bannedTags.has(t) && t.length > 1)));

  // Asegurar que no quede sin tags esenciales
  if (cleanTags.length === 0) {
    cleanTags.push("tapas");
  }

  return {
    name: cleanName,
    city: place.city,
    address: place.address,
    latitude: place.latitude,
    longitude: place.longitude,
    priceRange: place.priceRange || "???",
    googleMapsUrl: place.googleMapsUrl,
    notes: notes || null,
    comments: comments,
    occasions: place.occasions || ["comer"],
    tags: cleanTags,
    personalStatus: place.personalStatus || "pending",
  };
});

fs.writeFileSync(jsonPath, JSON.stringify(refined, null, 2), "utf8");

// Si existe lugares_import.json en raíz, mantener sincronizado
const rootJson = path.join(rootDir, "lugares_import.json");
if (fs.existsSync(rootJson)) {
  fs.writeFileSync(rootJson, JSON.stringify(refined, null, 2), "utf8");
}

console.log(`✅ Procesados con éxito ${refined.length} lugares en ${jsonPath}`);
const withComments = refined.filter((p) => p.comments && p.comments.length > 0).length;
const withNotes = refined.filter((p) => Boolean(p.notes)).length;
console.log(`   💬 Lugares con comentarios de alebupal: ${withComments}`);
console.log(`   📝 Lugares con notas descriptivas: ${withNotes}`);
