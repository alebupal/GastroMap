"use server";

import { revalidatePath } from "next/cache";
import { eq, and, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  placeOccasions,
  placeTags,
  tags,
  users,
  userPlaces,
  placeComments,
  sharingGroups,
  sharingGroupMembers,
  placeGroupAccess,
  savedFilters,
} from "@/db/schema";
import { getCurrentUser, hashPassword } from "@/lib/auth";

interface DemoComment {
  author?: string; // username del autor (ej. 'lauragourmet') o el admin si no se indica
  content: string;
}

interface DemoPlace {
  name: string;
  city: string;
  address: string;
  latitude: number;
  longitude: number;
  googleMapsUrl: string;
  priceRange: string;
  notes: string;
  occasions: string[];
  tags: string[];
  status?: "active" | "temporarily_closed" | "permanently_closed";
  createdByUser?: string; // username creador
  favorite?: boolean;
  personalStatus?: "pending" | "visited" | null;
  rating?: number | null;
  privateNotes?: string | null;
  comments?: DemoComment[];
}

/**
 * Usuarios comunitarios demo para dar vida y colaboración a la plataforma
 */
const DEMO_USERS = [
  {
    username: "lauragourmet",
    name: "Laura Gourmet",
    email: "laura@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "marcos_foodie",
    name: "Marcos Foodie",
    email: "marcos@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "elena_tapas",
    name: "Elena Tapas",
    email: "elena@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "carlos_chef",
    name: "Carlos Chef",
    email: "carlos@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "sofia_viajera",
    name: "Sofía Gómez",
    email: "sofia@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "david_dulces",
    name: "David Obrador",
    email: "david@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "marta_bcn",
    name: "Marta BCN",
    email: "marta@gastromap.local",
    role: "user",
    locale: "es",
  },
  {
    username: "javier_asador",
    name: "Javier Asador",
    email: "javier@gastromap.local",
    role: "user",
    locale: "en",
  },
];

const DEMO_PLACES: DemoPlace[] = [
  // ==========================================
  // --- ESPAÑA (24 sitios) ---
  // ==========================================
  {
    name: "Los Diamantes",
    city: "Granada, España",
    address: "Calle Navas, 28",
    latitude: 37.1738,
    longitude: -3.5985,
    googleMapsUrl: "https://maps.google.com/?q=37.1738,-3.5985",
    priceRange: "€",
    notes: "Imprescindible el pescadito frito recién sacado y las gambas con cada caña.",
    occasions: ["tapear"],
    tags: ["pescaitofrito", "tapas", "marisco", "granada"],
    status: "active",
    createdByUser: "elena_tapas",
    favorite: true,
    personalStatus: "visited",
    rating: 9.5,
    privateNotes: "Ir sobre las 13:00 para coger sitio en la barra de Calle Navas.",
    comments: [
      { author: "elena_tapas", content: "¡El mejor pescadito frito de toda Granada! Con cada consumición te ponen una tapa generosa de gambitas o boquerones al limón." },
      { author: "carlos_chef", content: "La fritura es impecable, aceite limpiecísimo y punto crocante perfecto sin gota de grasa pesada." },
    ],
  },
  {
    name: "Bodegas Castañeda",
    city: "Granada, España",
    address: "Calle Almireceros, 1-3",
    latitude: 37.1772,
    longitude: -3.5978,
    googleMapsUrl: "https://maps.google.com/?q=37.1772,-3.5978",
    priceRange: "€",
    notes: "Pedir un vermut de grifo con montadito caliente o una tabla combinada.",
    occasions: ["tapear"],
    tags: ["vermut", "montaditos", "taberna", "granada"],
    status: "active",
    createdByUser: "elena_tapas",
    favorite: true,
    personalStatus: "visited",
    rating: 9.0,
    privateNotes: "El 'calicasas' es mítico, pedir la tabla caliente para compartir.",
    comments: [
      { author: "elena_tapas", content: "Ambiente tabernero único. El vermut casero es insuperable y los montaditos salen ardiendo." },
      { author: "marcos_foodie", content: "Parada obligada antes de cenar. Si pides la tabla caliente prepárate para no cenar luego." },
    ],
  },
  {
    name: "Restaurante Chikito",
    city: "Granada, España",
    address: "Plaza del Campillo, 9",
    latitude: 37.1717,
    longitude: -3.5977,
    googleMapsUrl: "https://maps.google.com/?q=37.1717,-3.5977",
    priceRange: "€€€",
    notes: "Sitio histórico donde se reunía Federico García Lorca. Ricos los habas con jamón y la cola de toro.",
    occasions: ["comer"],
    tags: ["andaluz", "tradicional", "historia", "granada"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: false,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Tengo pendiente reservar junto al rincón de la peña de Lorca.",
    comments: [
      { author: "lauragourmet", content: "Templo histórico de la cocina granadina. Muy recomendable la sopa sefardí y el rabo de toro." },
    ],
  },
  {
    name: "Taberna La Tana",
    city: "Granada, España",
    address: "Placeta del Agua, 3",
    latitude: 37.1724,
    longitude: -3.5968,
    googleMapsUrl: "https://maps.google.com/?q=37.1724,-3.5968",
    priceRange: "€€",
    notes: "Una de las mejores bodegas de vino por copa de España con embutidos selectos y quesos afinados.",
    occasions: ["tapear", "copas"],
    tags: ["vinos", "quesos", "embutidos", "granada"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "visited",
    rating: 9.8,
    privateNotes: "Dejarse aconsejar siempre por Jesús con el vino blanco o natural.",
    comments: [
      { author: "carlos_chef", content: "El conocimiento de vinos que tienen en esta barra no tiene rival en toda Andalucía." },
      { author: "lauragourmet", content: "Los tomates aliñados y la morcilla que ponen de tapa con vinos de autor son pura gloria." },
    ],
  },
  {
    name: "Bar La Campana",
    city: "Madrid, España",
    address: "Calle Botoneras, 6",
    latitude: 40.415,
    longitude: -3.7077,
    googleMapsUrl: "https://maps.google.com/?q=40.4150,-3.7077",
    priceRange: "€",
    notes: "El bocadillo de calamares más famoso junto a la Plaza Mayor. Barato, crujiente y rápido.",
    occasions: ["tapear", "comer"],
    tags: ["calamares", "bocadillos", "castizo", "madrid"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: false,
    personalStatus: "visited",
    rating: 8.0,
    privateNotes: "Pedirlo con mayonesa o alioli si apetece, con un doble bien tirado.",
    comments: [
      { author: "marcos_foodie", content: "Clásico entre clásicos de Madrid. Siempre hay cola pero va rapidísimo." },
      { author: "sofia_viajera", content: "El pan crujiente y los calamares tiernos, nada gomosos." },
    ],
  },
  {
    name: "Casa Lucio",
    city: "Madrid, España",
    address: "Calle de la Cava Baja, 35",
    latitude: 40.4128,
    longitude: -3.71,
    googleMapsUrl: "https://maps.google.com/?q=40.4128,-3.7100",
    priceRange: "€€€",
    notes: "Cuna de los auténticos huevos estrellados en La Latina.",
    occasions: ["comer"],
    tags: ["huevosestrellados", "tradicional", "madrid", "castizo"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 8.7,
    privateNotes: "Mítico sitio en Cava Baja, pedir también los callos a la madrileña.",
    comments: [
      { author: "lauragourmet", content: "La textura de la patata pochada con la yema líquida rompiéndose en mesa sigue siendo magia pura." },
      { author: "javier_asador", content: "Muy buen solomillo también, aunque el plato estrella indiscutible son los huevos." },
    ],
  },
  {
    name: "Chocolatería San Ginés",
    city: "Madrid, España",
    address: "Pasadizo de San Ginés, 5",
    latitude: 40.417,
    longitude: -3.7072,
    googleMapsUrl: "https://maps.google.com/?q=40.4170,-3.7072",
    priceRange: "€",
    notes: "Churros y porras con chocolate espeso desde 1894. Abierto casi 24h.",
    occasions: ["dulce", "cafe"],
    tags: ["churros", "chocolate", "desayuno", "madrid"],
    status: "active",
    createdByUser: "david_dulces",
    favorite: true,
    personalStatus: "visited",
    rating: 9.0,
    privateNotes: "Ideal de madrugada o temprano en la mañana para evitar colas de turistas.",
    comments: [
      { author: "david_dulces", content: "El chocolate tiene el punto exacto de densidad y amargor, y las porras están siempre recién fritas." },
      { author: "elena_tapas", content: "Bajar a sus salones subterráneos de mármol blanco es como viajar en el tiempo al siglo XIX." },
    ],
  },
  {
    name: "Sala de Despiece",
    city: "Madrid, España",
    address: "Calle de Ponzano, 11",
    latitude: 40.4385,
    longitude: -3.699,
    googleMapsUrl: "https://maps.google.com/?q=40.4385,-3.6990",
    priceRange: "€€€",
    notes: "Tapeo vanguardista y concepto industrial de lonja de carnicería en plena calle Ponzano.",
    occasions: ["tapear", "postureo"],
    tags: ["ponzaning", "creativo", "tartar", "madrid"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.2,
    privateNotes: "Imprescindible el Chuletón cenital y el Rollito de trufa y calabacín.",
    comments: [
      { author: "marcos_foodie", content: "La puesta en escena simulando un matadero gourmet y los emplatados con pinzas son un espectáculo total." },
    ],
  },
  {
    name: "DiverXO",
    city: "Madrid, España",
    address: "Calle de Padre Damián, 23",
    latitude: 40.4578,
    longitude: -3.6874,
    googleMapsUrl: "https://maps.google.com/?q=40.4578,-3.6874",
    priceRange: "€€€€",
    notes: "3 Estrellas Michelin de Dabiz Muñoz. Una montaña rusa culinaria sin reglas.",
    occasions: ["comer", "postureo"],
    tags: ["michelin", "altacocina", "vanguardia", "dabizmuñoz", "madrid"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Intentar reserva con 3 meses de antelación el día 1 a las 00:00.",
    comments: [
      { author: "carlos_chef", content: "La experiencia gastronómica más radical y potente de Europa. Dabiz juega en otra liga." },
    ],
  },
  {
    name: "El Xampanyet",
    city: "Barcelona, España",
    address: "Carrer de Montcada, 22",
    latitude: 41.3852,
    longitude: 2.1818,
    googleMapsUrl: "https://maps.google.com/?q=41.3852,2.1818",
    priceRange: "€€",
    notes: "Bodega histórica en El Born. Copas de cava espumoso dulce artesanal y anchoas del Cantábrico.",
    occasions: ["tapear", "copas"],
    tags: ["cava", "anchoas", "elborn", "barcelona"],
    status: "active",
    createdByUser: "marta_bcn",
    favorite: true,
    personalStatus: "visited",
    rating: 9.3,
    privateNotes: "Pedir las alcachofas marinadas y la butifarra negra.",
    comments: [
      { author: "marta_bcn", content: "Puro ambiente barcelonés de toda la vida junto al museo Picasso. El cava de la casa entra como agua." },
      { author: "elena_tapas", content: "Las anchoas con pan con tomate son insuperables." },
    ],
  },
  {
    name: "Can Culleretes",
    city: "Barcelona, España",
    address: "Carrer d'en Quintana, 5",
    latitude: 41.3813,
    longitude: 2.1746,
    googleMapsUrl: "https://maps.google.com/?q=41.3813,2.1746",
    priceRange: "€€",
    notes: "El restaurante más antiguo de Cataluña (fundado en 1786). Cocina catalana de cuchara en el Gótico.",
    occasions: ["comer"],
    tags: ["tradicional", "catalan", "antiguo", "barcelona"],
    status: "active",
    createdByUser: "marta_bcn",
    favorite: false,
    personalStatus: "visited",
    rating: 8.5,
    privateNotes: "Los canelones caseros de la abuela y la butifarra con mongetes son obligatorios.",
    comments: [
      { author: "marta_bcn", content: "Comer aquí es como comer en casa de tu abuela en pleno centro gótico. Las raciones son muy generosas." },
    ],
  },
  {
    name: "Pastisseria Escribà",
    city: "Barcelona, España",
    address: "Gran Via de les Corts Catalanes, 546",
    latitude: 41.3831,
    longitude: 2.1589,
    googleMapsUrl: "https://maps.google.com/?q=41.3831,2.1589",
    priceRange: "€€",
    notes: "Templo del chocolate y alta pastelería de Christian Escribà desde 1906.",
    occasions: ["dulce", "cafe"],
    tags: ["pasteleria", "chocolate", "croissants", "barcelona"],
    status: "active",
    createdByUser: "david_dulces",
    favorite: true,
    personalStatus: "visited",
    rating: 9.6,
    privateNotes: "Los croissants de mantequilla y los labios de chocolate rojo son icónicos.",
    comments: [
      { author: "david_dulces", content: "Christian Escribà es un artista del azúcar. El pastel de mousse de chocolate y maracuyá es un escándalo." },
    ],
  },
  {
    name: "Bar Nestor",
    city: "San Sebastián, España",
    address: "Artekale, 11",
    latitude: 43.3236,
    longitude: -1.9845,
    googleMapsUrl: "https://maps.google.com/?q=43.3236,-1.9845",
    priceRange: "€€€",
    notes: "La 'Santísima Trinidad': chuleta de buey vieja a la brasa, ensalada de tomate y tortilla de patatas.",
    occasions: ["comer", "tapear"],
    tags: ["chuleta", "tortilla", "pintxos", "sansebastian"],
    status: "active",
    createdByUser: "javier_asador",
    favorite: true,
    personalStatus: "visited",
    rating: 9.9,
    privateNotes: "Apuntarse a las 12:00 o a las 19:00 en la lista de papel para conseguir un trozo de tortilla.",
    comments: [
      { author: "javier_asador", content: "La mejor chuleta que he comido en mi vida. Solo hacen 2 tortillas al día y vuelan en 3 minutos." },
      { author: "carlos_chef", content: "El tomate con sal gorda y aceite virgen te hace llorar de lo bueno que está." },
    ],
  },
  {
    name: "La Cuchara de San Telmo",
    city: "San Sebastián, España",
    address: "Santa Korda Kalea, 4",
    latitude: 43.3242,
    longitude: -1.9836,
    googleMapsUrl: "https://maps.google.com/?q=43.3242,-1.9836",
    priceRange: "€€",
    notes: "Pintxos calientes de alta cocina en pizarra: carrillera melosa, foie a la plancha y cochinillo crocante.",
    occasions: ["tapear", "comer"],
    tags: ["pintxos", "gourmet", "caliente", "sansebastian"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 9.7,
    privateNotes: "Pedir el foie con compota de manzana y la carrillera al vino tinto.",
    comments: [
      { author: "lauragourmet", content: "Aquí no hay barra fría, todo se cocina al momento cuando lo pides. El foie es de ensueño." },
    ],
  },
  {
    name: "El Rinconcillo",
    city: "Sevilla, España",
    address: "Calle Gerona, 40",
    latitude: 37.3934,
    longitude: -5.9877,
    googleMapsUrl: "https://maps.google.com/?q=37.3934,-5.9877",
    priceRange: "€€",
    notes: "La taberna más antigua de Sevilla (fundada en 1670). Apuntan la cuenta con tiza en la barra de caoba.",
    occasions: ["tapear"],
    tags: ["historico", "espinacascongarbanzos", "jamon", "sevilla"],
    status: "active",
    createdByUser: "elena_tapas",
    favorite: true,
    personalStatus: "visited",
    rating: 9.1,
    privateNotes: "Espinacas con garbanzos y pavías de bacalao con una manzanilla bien fría.",
    comments: [
      { author: "elena_tapas", content: "Más de 350 años de historia intacta. Ver al camarero apuntar la cuenta con tiza blanca no tiene precio." },
    ],
  },
  {
    name: "Bodeguita Romero",
    city: "Sevilla, España",
    address: "Calle Harinas, 10",
    latitude: 37.3881,
    longitude: -5.9961,
    googleMapsUrl: "https://maps.google.com/?q=37.3881,-5.9961",
    priceRange: "€",
    notes: "El mejor montadito de pringá de toda Sevilla. Jugoso, crujiente y casero.",
    occasions: ["tapear"],
    tags: ["pringá", "montadito", "tapas", "sevilla"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.4,
    privateNotes: "La pringá y el carrillón con patatas caseras son obligatorios.",
    comments: [
      { author: "marcos_foodie", content: "El montadito de pringá es religión. Calentito, sabroso y perfecto para arrancar la ruta." },
    ],
  },
  {
    name: "Casa Carmela",
    city: "Valencia, España",
    address: "Calle Isabel de Villena, 155",
    latitude: 39.4828,
    longitude: -0.3255,
    googleMapsUrl: "https://maps.google.com/?q=39.4828,-0.3255",
    priceRange: "€€€",
    notes: "Auténtica paella valenciana tradicional cocinada con leña de naranjo frente a la playa de la Malvarrosa.",
    occasions: ["comer"],
    tags: ["paella", "leña", "arroz", "valencia"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "visited",
    rating: 9.6,
    privateNotes: "Reservar con semanas de antelación para el turno de comida a las 14:00.",
    comments: [
      { author: "carlos_chef", content: "El socarrat fino crujiente conseguido con la leña de naranjo es la definición absoluta de la verdadera paella." },
    ],
  },
  {
    name: "Casa Pepe de la Judería",
    city: "Córdoba, España",
    address: "Calle Romero, 1",
    latitude: 37.8804,
    longitude: -4.7811,
    googleMapsUrl: "https://maps.google.com/?q=37.8804,-4.7811",
    priceRange: "€€",
    notes: "Salmorejo cordobés denso con jamón ibérico y berenjenas fritas con miel de caña.",
    occasions: ["comer", "tapear"],
    tags: ["salmorejo", "berenjenas", "cordoba", "andaluz"],
    status: "active",
    createdByUser: "elena_tapas",
    favorite: false,
    personalStatus: "visited",
    rating: 8.9,
    privateNotes: "Pedir mesa en el patio cordobés interior lleno de macetas.",
    comments: [
      { author: "elena_tapas", content: "El salmorejo tiene la textura perfecta, sin exceso de ajo y con un aceite de oliva virgen extra de diez." },
    ],
  },
  {
    name: "A Taberna do Bispo",
    city: "Santiago de Compostela, España",
    address: "Rúa do Franco, 37",
    latitude: 42.8778,
    longitude: -8.5457,
    googleMapsUrl: "https://maps.google.com/?q=42.8778,-8.5457",
    priceRange: "€€",
    notes: "Pulpo á feira en tabla de madera, zamburiñas a la plancha y pimientos de Padrón.",
    occasions: ["tapear", "comer"],
    tags: ["marisco", "pulpo", "galicia", "santiago"],
    status: "active",
    createdByUser: "sofia_viajera",
    favorite: true,
    personalStatus: "visited",
    rating: 9.3,
    privateNotes: "Acompañar siempre con una jarra de Ribeiro en cunca de barro.",
    comments: [
      { author: "sofia_viajera", content: "Terminar el Camino de Santiago y meterse entre pecho y espalda estas zamburiñas y el pulpo no tiene precio." },
    ],
  },
  {
    name: "Café Iruña",
    city: "Bilbao, España",
    address: "Calle Berástegui, 4",
    latitude: 43.2625,
    longitude: -2.9283,
    googleMapsUrl: "https://maps.google.com/?q=43.2625,-2.9283",
    priceRange: "€",
    notes: "Café histórico neobarroco frente a los Jardines de Albia. Famosos por sus pintxos morunos al carbón.",
    occasions: ["cafe", "tapear"],
    tags: ["cafe", "pintxomoruno", "historico", "bilbao"],
    status: "active",
    createdByUser: "javier_asador",
    favorite: false,
    personalStatus: "visited",
    rating: 8.8,
    privateNotes: "El rincón mudéjar del café es una joya arquitectónica.",
    comments: [
      { author: "javier_asador", content: "Los pintxos morunos asados al momento en la esquinita son irresistibles." },
    ],
  },
  {
    name: "Bodega El Pimpi",
    city: "Málaga, España",
    address: "Calle Granada, 62",
    latitude: 36.7225,
    longitude: -4.4178,
    googleMapsUrl: "https://maps.google.com/?q=36.7225,-4.4178",
    priceRange: "€€",
    notes: "Barriles de vino dulce firmados por Antonio Banderas y Picasso junto al Teatro Romano.",
    occasions: ["tapear", "copas"],
    tags: ["vinos", "malaga", "jamon", "postureo"],
    status: "active",
    createdByUser: "elena_tapas",
    favorite: false,
    personalStatus: "visited",
    rating: 8.4,
    privateNotes: "Vino dulce Málaga Virgen con plato de jamón de bellota en la terraza.",
    comments: [
      { author: "elena_tapas", content: "Aunque tenga muchos turistas, las vistas a la Alcazaba y la solera de los barriles hacen que valga la pena." },
    ],
  },
  {
    name: "El Campero",
    city: "Barbate, Cádiz, España",
    address: "Avenida Constitución, 5",
    latitude: 36.1912,
    longitude: -5.9221,
    googleMapsUrl: "https://maps.google.com/?q=36.1912,-5.9221",
    priceRange: "€€€€",
    notes: "El templo mundial del Atún Rojo Salvaje de Almadraba. Cortes únicos: morrillo, ventresca, facera y tartar.",
    occasions: ["comer"],
    tags: ["atunrojo", "almadraba", "cadiz", "marisco"],
    status: "temporarily_closed",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "visited",
    rating: 9.9,
    privateNotes: "Pedir el sashimi de ventresca y el morrillo a la sal. Una religión.",
    comments: [
      { author: "carlos_chef", content: "No hay ningún sitio en el planeta tierra donde traten el atún de almadraba con semejante maestría." },
      { author: "lauragourmet", content: "La textura de la tosta de atún y trufa es algo que se queda grabado en la memoria." },
    ],
  },
  {
    name: "Mesón de Cándido",
    city: "Segovia, España",
    address: "Plaza del Azoguejo, 5",
    latitude: 40.9479,
    longitude: -4.1184,
    googleMapsUrl: "https://maps.google.com/?q=40.9479,-4.1184",
    priceRange: "€€€",
    notes: "Cochinillo asado al horno de leña cortado con plato a los pies del Acueducto Romano.",
    occasions: ["comer"],
    tags: ["cochinillo", "asado", "acueducto", "segovia"],
    status: "active",
    createdByUser: "javier_asador",
    favorite: false,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Hacer coincidir la comida con una escapada de fin de semana.",
    comments: [
      { author: "javier_asador", content: "Piel cristalina crujiente y carne mantecosa. El espectáculo de romper el plato es todo un ritual." },
    ],
  },
  {
    name: "La Viña",
    city: "San Sebastián, España",
    address: "Calle 31 de Agosto, 3",
    latitude: 43.3238,
    longitude: -1.9841,
    googleMapsUrl: "https://maps.google.com/?q=43.3238,-1.9841",
    priceRange: "€",
    notes: "La tarta de queso quemada más copiada del mundo (Basque Burnt Cheesecake). Cremosa, templada y sin base.",
    occasions: ["dulce", "tapear"],
    tags: ["tartadequeso", "cheesecake", "dulce", "sansebastian"],
    status: "active",
    createdByUser: "david_dulces",
    favorite: true,
    personalStatus: "visited",
    rating: 9.8,
    privateNotes: "Pedir dos raciones de tarta con un vino dulce de Pedro Ximénez.",
    comments: [
      { author: "david_dulces", content: "El corazón cremoso y el tostado caramelo superior son inimitables. La auténtica original." },
    ],
  },

  // ==========================================
  // --- EUROPA (11 sitios) ---
  // ==========================================
  {
    name: "L'Antica Pizzeria Da Michele",
    city: "Nápoles, Italia",
    address: "Via Cesare Sersale, 1",
    latitude: 40.8498,
    longitude: 14.2633,
    googleMapsUrl: "https://maps.google.com/?q=40.8498,14.2633",
    priceRange: "€",
    notes: "La meca de la pizza napolitana desde 1870. Solo sirven dos tipos: Margherita y Marinara.",
    occasions: ["comer"],
    tags: ["pizza", "margherita", "napoles", "italia"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.8,
    privateNotes: "Coger ticket de papel en la puerta temprano; la rotación de mesas es muy rápida.",
    comments: [
      { author: "marcos_foodie", content: "La masa es ligera como una nube, masa elástica con motas de leopardo y tomate de San Marzano dulce." },
      { author: "sofia_viajera", content: "Por 5 euros comes una de las mejores pizzas del planeta. Insuperable." },
    ],
  },
  {
    name: "Osteria Francescana",
    city: "Módena, Italia",
    address: "Via Stella, 22",
    latitude: 44.6446,
    longitude: 10.9215,
    googleMapsUrl: "https://maps.google.com/?q=44.6446,10.9215",
    priceRange: "€€€€",
    notes: "Massimo Bottura. Tres estrellas Michelin y dos veces elegido mejor restaurante del mundo.",
    occasions: ["comer", "postureo"],
    tags: ["michelin", "altacocina", "italia", "bottura"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Probar las Cinco edades del Parmigiano Reggiano en distintas temperaturas y texturas.",
    comments: [
      { author: "carlos_chef", content: "Una oda a la cultura culinaria italiana desde una mirada poética y contemporánea." },
    ],
  },
  {
    name: "Trattoria Da Enzo al 29",
    city: "Roma, Italia",
    address: "Via dei Vascellari, 29",
    latitude: 41.8876,
    longitude: 12.4777,
    googleMapsUrl: "https://maps.google.com/?q=41.8876,12.4777",
    priceRange: "€€",
    notes: "Auténtica trattoria en el Trastevere. La mejor Carbonara romana y Cacio e Pepe de la ciudad.",
    occasions: ["comer"],
    tags: ["pasta", "carbonara", "roma", "trattoria"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 9.6,
    privateNotes: "No admiten reservas para cenar; ponerse a la cola a las 19:15.",
    comments: [
      { author: "lauragourmet", content: "Guanciale crujiente, yema cremosa y pecorino romano sin una sola gota de nata. Perfección." },
      { author: "marcos_foodie", content: "De postre el tiramisú en vaso y la tarta de ricotta con cerezas silvestres son obligatorios." },
    ],
  },
  {
    name: "All'Antico Vinaio",
    city: "Florencia, Italia",
    address: "Via dei Neri, 76R",
    latitude: 43.7686,
    longitude: 11.2587,
    googleMapsUrl: "https://maps.google.com/?q=43.7686,11.2587",
    priceRange: "€",
    notes: "Schiacciata toscana gigante rellena de finocchiona, porchetta caliente, crema de trufa y pecorino.",
    occasions: ["tapear", "comer"],
    tags: ["panino", "schiacciata", "streetfood", "florencia"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.3,
    privateNotes: "Pedir 'La Paradiso' con crema de pistacho y stracciatella.",
    comments: [
      { author: "marcos_foodie", content: "La masa cruje por fuera y está calentita. El tamaño es descomunal y el precio ridículo." },
    ],
  },
  {
    name: "Le Relais de l'Entrecôte",
    city: "París, Francia",
    address: "15 Rue Marbeuf",
    latitude: 48.8682,
    longitude: 2.3023,
    googleMapsUrl: "https://maps.google.com/?q=48.8682,2.3023",
    priceRange: "€€€",
    notes: "Solo sirven un plato: ensalada de nueces y lomo de buey en finas lonchas con su salsa secreta verde y patatas fritas ilimitadas.",
    occasions: ["comer"],
    tags: ["entrecote", "paris", "clasico", "frances"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 9.2,
    privateNotes: "Te sirven dos tandas de carne caliente para que nunca se enfríe.",
    comments: [
      { author: "lauragourmet", content: "La salsa verde secreta con mantequilla de hierbas es una adicción. Las patatas fritas son perfectas." },
    ],
  },
  {
    name: "Du Pain et des Idées",
    city: "París, Francia",
    address: "34 Rue Yves Toudic",
    latitude: 48.8712,
    longitude: 2.3629,
    googleMapsUrl: "https://maps.google.com/?q=48.8712,2.3629",
    priceRange: "€",
    notes: "Boulangerie tradicional de 1875 cerca del Canal Saint-Martin. Famosa por el 'Escargot Pistache Chocolat'.",
    occasions: ["dulce", "cafe"],
    tags: ["croissant", "boulangerie", "paris", "desayuno"],
    status: "active",
    createdByUser: "david_dulces",
    favorite: true,
    personalStatus: "visited",
    rating: 9.7,
    privateNotes: "Comer el caracol de pistacho caliente sentado en el banco exterior.",
    comments: [
      { author: "david_dulces", content: "El hojaldre tiene más de mil capas crujientes y mantequilla pura de Normandía." },
    ],
  },
  {
    name: "Bouillon Chartier",
    city: "París, Francia",
    address: "7 Rue du Faubourg Montmartre",
    latitude: 48.8719,
    longitude: 2.3431,
    googleMapsUrl: "https://maps.google.com/?q=48.8719,2.3431",
    priceRange: "€",
    notes: "Gran bouillon popular de la Belle Époque desde 1896. Caracoles bourguignon y confit de pato a precios imbatibles.",
    occasions: ["comer"],
    tags: ["bouillon", "paris", "belleepoque", "frances"],
    status: "active",
    createdByUser: "sofia_viajera",
    favorite: false,
    personalStatus: "visited",
    rating: 8.6,
    privateNotes: "Te escriben la comanda con lápiz en el mantel de papel.",
    comments: [
      { author: "sofia_viajera", content: "Comer en París bajo una cúpula art nouveau histórica por 15 euros es algo que no se encuentra en ningún otro sitio." },
    ],
  },
  {
    name: "Cervejaria Ramiro",
    city: "Lisboa, Portugal",
    address: "Av. Almirante Reis, 1",
    latitude: 38.7208,
    longitude: -9.1348,
    googleMapsUrl: "https://maps.google.com/?q=38.7208,-9.1348",
    priceRange: "€€€",
    notes: "Templo del marisco fresco: percebes, carabineros gigantes, gambas al ajillo y el tradicional 'prego' de ternera de postre.",
    occasions: ["comer", "tapear"],
    tags: ["marisco", "percebes", "lisboa", "portugal"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "visited",
    rating: 9.5,
    privateNotes: "Terminar la mariscada pidiendo el 'Prego no Pão' (bocadillo de lomo de ternera con mostaza), como manda la tradición portuguesa.",
    comments: [
      { author: "carlos_chef", content: "Los carabineros a la plancha con la cabeza para chupar son estratosféricos." },
    ],
  },
  {
    name: "Pastéis de Belém",
    city: "Lisboa, Portugal",
    address: "Rua de Belém, 84-92",
    latitude: 38.6976,
    longitude: -9.2032,
    googleMapsUrl: "https://maps.google.com/?q=38.6976,-9.2032",
    priceRange: "€",
    notes: "Pasteles de nata originales con receta secreta monacal de 1837. Calientes con canela y azúcar glas.",
    occasions: ["dulce", "cafe"],
    tags: ["pasteisdenata", "lisboa", "dulce", "portugal"],
    status: "active",
    createdByUser: "david_dulces",
    favorite: true,
    personalStatus: "visited",
    rating: 9.8,
    privateNotes: "Entrar al salón interior para comerlos recién salidos del horno con un bica bien cargado.",
    comments: [
      { author: "david_dulces", content: "El hojaldre cruje como cristal fino y la crema pastelera no empalaga nada. Una maravilla." },
    ],
  },
  {
    name: "Dishoom Covent Garden",
    city: "Londres, Reino Unido",
    address: "12 Upper St Martin's Ln",
    latitude: 51.5126,
    longitude: -0.1264,
    googleMapsUrl: "https://maps.google.com/?q=51.5126,-0.1264",
    priceRange: "€€",
    notes: "Tributo a los antiguos cafés iraníes de Bombay. Legendario Black Daal cocinado durante 24h y rollos de Naan recién horneados.",
    occasions: ["comer"],
    tags: ["indio", "curry", "naan", "londres"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.4,
    privateNotes: "El desayuno con Bacon Naan Roll con queso crema y mermelada picante de tomate es insuperable.",
    comments: [
      { author: "marcos_foodie", content: "El Black Daal es el mejor plato de legumbres del mundo. Sabor profundo, sedoso y aromático." },
    ],
  },
  {
    name: "Ta Karamanlidika tou Fani",
    city: "Atenas, Grecia",
    address: "Sokratous, 1",
    latitude: 37.9806,
    longitude: 23.7258,
    googleMapsUrl: "https://maps.google.com/?q=37.9806,23.7258",
    priceRange: "€€",
    notes: "Charcutería y taberna tradicional bizantina. Embutidos artesanales ahumados, pastirma y cazuelitas de saganaki caliente.",
    occasions: ["tapear", "comer"],
    tags: ["griego", "mezedes", "pastirma", "atenas"],
    status: "active",
    createdByUser: "sofia_viajera",
    favorite: true,
    personalStatus: "visited",
    rating: 9.3,
    privateNotes: "Pedir las salchichas kavourmas con huevos fritos y tomate.",
    comments: [
      { author: "sofia_viajera", content: "Comer rodeado de jamones curados colgados del techo en el corazón del mercado ateniense es una delicia." },
    ],
  },

  // ==========================================
  // --- ASIA Y ÁFRICA (6 sitios) ---
  // ==========================================
  {
    name: "Sukiyabashi Jiro",
    city: "Tokio, Japón",
    address: "Tsukamoto Sogyo Building, Ginza",
    latitude: 35.6719,
    longitude: 139.764,
    googleMapsUrl: "https://maps.google.com/?q=35.6719,139.7640",
    priceRange: "€€€€",
    notes: "El legendario maestro de sushi Jiro Ono. Menú omakase de 20 piezas en 30 minutos.",
    occasions: ["comer"],
    tags: ["sushi", "omakase", "tokio", "japon", "michelin"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Imprescindible reserva a través del conserje de un hotel 5 estrellas en Ginza.",
    comments: [
      { author: "carlos_chef", content: "La perfección milimétrica del arroz atemperado con el vinagre y el corte del pescado salvaje." },
    ],
  },
  {
    name: "Ichiran Ramen Shibuya",
    city: "Tokio, Japón",
    address: "1 Chome-22-7 Jinnan, Shibuya",
    latitude: 35.6617,
    longitude: 139.7013,
    googleMapsUrl: "https://maps.google.com/?q=35.6617,139.7013",
    priceRange: "€",
    notes: "Tonkotsu ramen artesanal en cabinas individuales para máxima concentración sensorial.",
    occasions: ["comer"],
    tags: ["ramen", "tonkotsu", "tokio", "japon"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.1,
    privateNotes: "Personalizar la dureza del fideo a 'firm' y caldo rico con huevo cocido con yema blanda.",
    comments: [
      { author: "marcos_foodie", content: "El caldo de cerdo blanco tras 18 horas de cocción tiene un umami que no se olvida." },
      { author: "sofia_viajera", content: "La cabina individual con persiana de bambú por donde te sirven el bol es una experiencia japonesa única." },
    ],
  },
  {
    name: "Gyukatsu Motomura",
    city: "Tokio, Japón",
    address: "3 Chome-32-2 Shinjuku",
    latitude: 35.6908,
    longitude: 139.7028,
    googleMapsUrl: "https://maps.google.com/?q=35.6908,139.7028",
    priceRange: "€€",
    notes: "Carne de wagyu empanada en panko ultra fino, servida semicruda para terminarla al gusto sobre una piedra caliente personal.",
    occasions: ["comer"],
    tags: ["gyukatsu", "wagyu", "shinjuku", "tokio"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 9.6,
    privateNotes: "Pedir el menú de 260g con té verde y cebolleta fresca picada.",
    comments: [
      { author: "lauragourmet", content: "Se derrite en la boca con un poco de wasabi fresco y sal de roca." },
    ],
  },
  {
    name: "Jay Fai",
    city: "Bangkok, Tailandia",
    address: "327 Maha Chai Rd, Samran Rat",
    latitude: 13.7525,
    longitude: 100.5048,
    googleMapsUrl: "https://maps.google.com/?q=13.7525,100.5048",
    priceRange: "€€€",
    notes: "La reina del wok callejero con gafas de esquí y Estrella Michelin. Su tortilla rellena de cangrejo real gigante es histórica.",
    occasions: ["comer"],
    tags: ["streetfood", "crabomelette", "bangkok", "tailandesa"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "visited",
    rating: 9.7,
    privateNotes: "Pedir también los fideos drunken noodles marisqueros ('Drunken Crab').",
    comments: [
      { author: "carlos_chef", content: "Ver a Supinya a sus 78 años salteando sobre carbón al rojo vivo es historia viva de la gastronomía mundial." },
      { author: "sofia_viajera", content: "Cuesta unos 40€ la tortilla, pero vienen más de 400 gramos de carne de cangrejo dulce puro sin una sola cáscara." },
    ],
  },
  {
    name: "Thip Samai Pad Thai",
    city: "Bangkok, Tailandia",
    address: "313 Maha Chai Rd",
    latitude: 13.7529,
    longitude: 100.5047,
    googleMapsUrl: "https://maps.google.com/?q=13.7529,100.5047",
    priceRange: "€",
    notes: "Considerado el mejor Pad Thai de Tailandia. Fideos envueltos en una finísima tortilla de huevo al wok.",
    occasions: ["comer"],
    tags: ["padthai", "streetfood", "bangkok", "fideos"],
    status: "active",
    createdByUser: "sofia_viajera",
    favorite: false,
    personalStatus: "visited",
    rating: 9.0,
    privateNotes: "Acompañar con su zumo de naranja natural con pulpa gigante (el precio cambia a diario según el mercado).",
    comments: [
      { author: "sofia_viajera", content: "La textura de los fideos con aceite de cabeza de gamba y tamarindo es irrepetible." },
    ],
  },
  {
    name: "Café Clock Marrakech",
    city: "Marrakech, Marruecos",
    address: "224 Derb Chtouka, Kasbah",
    latitude: 31.6167,
    longitude: -7.9869,
    googleMapsUrl: "https://maps.google.com/?q=31.6167,-7.9869",
    priceRange: "€€",
    notes: "Café cultural en la medina con terraza panorámica. Famosos por su hamburguesa de camello y té moruno a la menta.",
    occasions: ["cafe", "comer", "copas"],
    tags: ["marrakech", "te", "camello", "medina"],
    status: "active",
    createdByUser: "sofia_viajera",
    favorite: false,
    personalStatus: "visited",
    rating: 8.7,
    privateNotes: "Subir al atardecer para escuchar la llamada a la oración con vistas al minarete.",
    comments: [
      { author: "sofia_viajera", content: "Un remanso de paz en la Kasbah. La hamburguesa de camello es sorprendentemente tierna y sabrosa." },
    ],
  },

  // ==========================================
  // --- AMÉRICA (9 sitios) ---
  // ==========================================
  {
    name: "Parrilla Don Julio",
    city: "Buenos Aires, Argentina",
    address: "Guatemala 4699, Palermo",
    latitude: -34.5888,
    longitude: -58.4239,
    googleMapsUrl: "https://maps.google.com/?q=-34.5888,-58.4239",
    priceRange: "€€€€",
    notes: "Una de las mejores parrillas del mundo. Ojo de bife de raza Aberdeen Angus alimentado a pastura y mollejas crocantes.",
    occasions: ["comer"],
    tags: ["asado", "parrilla", "buenosaires", "ojodebife", "argentina"],
    status: "active",
    createdByUser: "javier_asador",
    favorite: true,
    personalStatus: "visited",
    rating: 9.9,
    privateNotes: "Pedir las mollejas de corazón con limón y acompañar con vino Malbec reserva.",
    comments: [
      { author: "javier_asador", content: "Insuperable. La textura de la carne, el punto exacto de brasa y la atención son de otro nivel." },
      { author: "lauragourmet", content: "La cava subterránea de vinos y el pan recién horneado con grasa de pella completan una comida perfecta." },
    ],
  },
  {
    name: "Pizzería Güerrín",
    city: "Buenos Aires, Argentina",
    address: "Av. Corrientes 1368",
    latitude: -34.6045,
    longitude: -58.386,
    googleMapsUrl: "https://maps.google.com/?q=-34.6045,-58.3860",
    priceRange: "€",
    notes: "Pizza porteña al molde desde 1932. La fugazzeta rellena de queso derretido y cebolla dorada es una locura.",
    occasions: ["comer", "tapear"],
    tags: ["pizza", "fugazzeta", "porteño", "buenosaires"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.2,
    privateNotes: "Comer dos porciones de dorapa (de pie) en la barra con moscato y fainá arriba.",
    comments: [
      { author: "marcos_foodie", content: "Kilos de queso mozzarella cayendo por los costados. Una bomba calórica imprescindible." },
    ],
  },
  {
    name: "Katz's Delicatessen",
    city: "Nueva York, Estados Unidos",
    address: "205 E Houston St, Lower East Side",
    latitude: 40.7223,
    longitude: -73.9874,
    googleMapsUrl: "https://maps.google.com/?q=40.7223,-73.9874",
    priceRange: "€€€",
    notes: "Bocadillos de Pastrami legendarios cortados a mano desde 1888. Templo cinematográfico de Manhattan.",
    occasions: ["comer"],
    tags: ["pastrami", "sandwich", "nuevayork", "deli"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.5,
    privateNotes: "Dejar 2 dólares de propina en el bote del cortador de carne y te da a probar una loncha caliente en el acto.",
    comments: [
      { author: "marcos_foodie", content: "El pastrami curado y ahumado se deshace literalmente en la boca. Con mostaza picante sobre pan de centeno." },
      { author: "lauragourmet", content: "No perder nunca el ticket de papel de la entrada o te multan al salir." },
    ],
  },
  {
    name: "Joe's Pizza",
    city: "Nueva York, Estados Unidos",
    address: "7 Carmine St, Greenwich Village",
    latitude: 40.7306,
    longitude: -74.0021,
    googleMapsUrl: "https://maps.google.com/?q=40.7306,-74.0021",
    priceRange: "€",
    notes: "El 'slice' de pizza neoyorquina definitivo. Masa crujiente que se dobla por la mitad sin romperse.",
    occasions: ["tapear", "comer"],
    tags: ["pizza", "slice", "streetfood", "nuevayork"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: false,
    personalStatus: "visited",
    rating: 9.0,
    privateNotes: "Pedir un slice de pepperoni con salsa picante y orégano.",
    comments: [
      { author: "marcos_foodie", content: "El estándar dorado de la pizza al corte de Nueva York desde 1975." },
    ],
  },
  {
    name: "Peter Luger Steak House",
    city: "Brooklyn, Nueva York, Estados Unidos",
    address: "178 Broadway, Williamsburg",
    latitude: 40.7099,
    longitude: -73.9625,
    googleMapsUrl: "https://maps.google.com/?q=40.7099,-73.9625",
    priceRange: "€€€€",
    notes: "El Steakhouse de dry-aged beef más influyente desde 1887. Porterhouse steak servido en plato hirviendo con mantequilla.",
    occasions: ["comer"],
    tags: ["porterhouse", "carne", "brooklyn", "steakhouse"],
    status: "active",
    createdByUser: "javier_asador",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Solo aceptan efectivo o tarjeta de débito local. Pedir el bacon grueso de aperitivo.",
    comments: [
      { author: "javier_asador", content: "La maduración en seco y el tostado en horno cerámico a 800 grados crean una costra única." },
    ],
  },
  {
    name: "Taquería Los Cocuyos",
    city: "Ciudad de México, México",
    address: "Calle Simón Bolívar, 57, Centro Histórico",
    latitude: 19.4312,
    longitude: -99.1384,
    googleMapsUrl: "https://maps.google.com/?q=19.4312,-99.1384",
    priceRange: "€",
    notes: "Tacos de suadero, tripa dorada, longaniza y lengua confitados lentamente en cazo de manteca las 24 horas del día.",
    occasions: ["tapear", "comer"],
    tags: ["tacos", "suadero", "cdmx", "mexicana"],
    status: "active",
    createdByUser: "marcos_foodie",
    favorite: true,
    personalStatus: "visited",
    rating: 9.6,
    privateNotes: "Pedir dos de suadero y uno de tripa dorada bien planchada con salsa verde y limón.",
    comments: [
      { author: "marcos_foodie", content: "El aroma que sale de ese cazo de cobre te hipnotiza desde la esquina. Los mejores tacos del centro histórico." },
      { author: "sofia_viajera", content: "La tripa doradita cruje y el suadero está jugosísimo." },
    ],
  },
  {
    name: "Pujol",
    city: "Ciudad de México, México",
    address: "Tennyson, 133, Polanco",
    latitude: 19.4308,
    longitude: -99.1983,
    googleMapsUrl: "https://maps.google.com/?q=19.4308,-99.1983",
    priceRange: "€€€€",
    notes: "Enrique Olvera. Alta cocina mexicana de raíz indígena. Su 'Mole Madre' lleva más de 3.000 días de fermentación continua.",
    occasions: ["comer", "postureo"],
    tags: ["molemadre", "michelin", "mexico", "altacocina"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Reservar la barra de omakase de tacos para una experiencia dinámica.",
    comments: [
      { author: "carlos_chef", content: "El contraste del Mole Madre añejo con el Mole Nuevo recién elaborado es una de las grandes lecciones de cocina mundial." },
    ],
  },
  {
    name: "Central Restaurante",
    city: "Lima, Perú",
    address: "Av. Pedro de Osma, 301, Barranco",
    latitude: -12.1524,
    longitude: -77.0223,
    googleMapsUrl: "https://maps.google.com/?q=-12.1524,-77.0223",
    priceRange: "€€€€",
    notes: "Virgilio Martínez y Pía León. Nombrado mejor restaurante del mundo en The World's 50 Best. Menú por ecosistemas y alturas andinas.",
    occasions: ["comer"],
    tags: ["peruano", "altacocina", "50best", "lima", "biodiversidad"],
    status: "active",
    createdByUser: "carlos_chef",
    favorite: true,
    personalStatus: "pending",
    rating: null,
    privateNotes: "Viaje gastronómico desde los -15 metros del Océano Pacífico hasta los 4.200 metros de los Andes.",
    comments: [
      { author: "carlos_chef", content: "La mayor expedición botánica y gastronómica jamás servida en un plato." },
    ],
  },
  {
    name: "La Mar Cebichería",
    city: "Lima, Perú",
    address: "Av. Mariscal La Mar, 770, Miraflores",
    latitude: -12.1158,
    longitude: -77.0422,
    googleMapsUrl: "https://maps.google.com/?q=-12.1158,-77.0422",
    priceRange: "€€€",
    notes: "Gastón Acurio. Solo abre al mediodía para garantizar la frescura de la pesca del día: cebiches, tiraditos y arroces con marisco.",
    occasions: ["comer"],
    tags: ["cebiche", "tiradito", "lima", "peru", "marisco"],
    status: "active",
    createdByUser: "lauragourmet",
    favorite: true,
    personalStatus: "visited",
    rating: 9.7,
    privateNotes: "Pedir el cebiche clásico con pesca del día y un pisco sour catedral.",
    comments: [
      { author: "lauragourmet", content: "La leche de tigre tiene un equilibrio ácido y picante perfecto con choclo tierno y camote glaseado." },
    ],
  },
];

export async function seedDemoPlacesAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para ejecutar la carga de demostración." };
  }

  // 1. Crear usuarios de la comunidad demo si no existen, o actualizar su contraseña a 1234
  const userMap: Record<string, string> = {
    [currentUser.username || "admin"]: currentUser.id,
  };

  const defaultPasswordHash = await hashPassword("1234");

  for (const demoUser of DEMO_USERS) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, demoUser.username))
      .limit(1);

    if (existing) {
      userMap[demoUser.username] = existing.id;
      // Actualizar siempre la contraseña a 1234 para que puedan iniciar sesión
      await db
        .update(users)
        .set({
          passwordHash: defaultPasswordHash,
          locale: demoUser.locale || "es",
          updatedAt: new Date(),
        })
        .where(eq(users.id, existing.id));
    } else {
      const [newUser] = await db
        .insert(users)
        .values({
          username: demoUser.username,
          name: demoUser.name,
          email: demoUser.email,
          passwordHash: defaultPasswordHash,
          role: demoUser.role,
          locale: demoUser.locale || "es",
        })
        .returning({ id: users.id });

      userMap[demoUser.username] = newUser.id;
    }
  }

  // Limpiar cualquier comentario previo con texto vacío o corrupto
  await db.delete(placeComments).where(eq(placeComments.content, ""));

  let insertedCount = 0;

  for (const item of DEMO_PLACES) {
    // Determinar autor del lugar (usuario demo o admin actual)
    const creatorId =
      (item.createdByUser && userMap[item.createdByUser]) || currentUser.id;

    // Comprobar si ya existe por nombre y ciudad
    const [existing] = await db
      .select({ id: places.id })
      .from(places)
      .where(and(eq(places.name, item.name), eq(places.city, item.city)))
      .limit(1);

    let placeId: string;

    if (existing) {
      placeId = existing.id;
      // Actualizar datos del lugar
      await db
        .update(places)
        .set({
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          googleMapsUrl: item.googleMapsUrl,
          priceRange: item.priceRange,
          notes: item.notes,
          status: item.status ?? "active",
          communityPublished: true,
          updatedAt: new Date(),
        })
        .where(eq(places.id, placeId));
    } else {
      const [newPlace] = await db
        .insert(places)
        .values({
          name: item.name,
          city: item.city,
          address: item.address,
          latitude: item.latitude,
          longitude: item.longitude,
          googleMapsUrl: item.googleMapsUrl,
          priceRange: item.priceRange,
          notes: item.notes,
          status: item.status ?? "active",
          communityPublished: true,
          createdById: creatorId,
        })
        .returning();

      placeId = newPlace.id;
      insertedCount++;
    }

    // 2. Insertar ocasiones (evitando duplicados)
    if (item.occasions.length > 0) {
      for (const occ of item.occasions) {
        const [existingOcc] = await db
          .select({ id: placeOccasions.id })
          .from(placeOccasions)
          .where(and(eq(placeOccasions.placeId, placeId), eq(placeOccasions.occasion, occ)))
          .limit(1);

        if (!existingOcc) {
          await db.insert(placeOccasions).values({
            placeId,
            occasion: occ,
          });
        }
      }
    }

    // 3. Insertar tags (y asegurar que existen en catálogo)
    if (item.tags.length > 0) {
      for (const t of item.tags) {
        await db.insert(tags).values({ id: t, name: t }).onConflictDoNothing();

        const [existingTag] = await db
          .select({ id: placeTags.id })
          .from(placeTags)
          .where(and(eq(placeTags.placeId, placeId), eq(placeTags.tag, t)))
          .limit(1);

        if (!existingTag) {
          await db.insert(placeTags).values({
            placeId,
            tag: t,
          });
        }
      }
    }

    // 4. Interacción personal para el usuario admin actual
    const [existingInteraction] = await db
      .select({ id: userPlaces.id })
      .from(userPlaces)
      .where(and(eq(userPlaces.placeId, placeId), eq(userPlaces.userId, currentUser.id)))
      .limit(1);

    if (!existingInteraction) {
      await db.insert(userPlaces).values({
        userId: currentUser.id,
        placeId,
        favorite: item.favorite ?? false,
        personalStatus: item.personalStatus ?? null,
        rating: item.rating ?? null,
        privateNotes: item.privateNotes ?? null,
      });
    } else {
      await db
        .update(userPlaces)
        .set({
          favorite: item.favorite ?? false,
          personalStatus: item.personalStatus ?? null,
          rating: item.rating ?? null,
          privateNotes: item.privateNotes ?? null,
          updatedAt: new Date(),
        })
        .where(eq(userPlaces.id, existingInteraction.id));
    }

    // 5. Interacción de otros usuarios de la comunidad para alimentar filtros (ej. visited_by_others)
    if (item.createdByUser && userMap[item.createdByUser] && userMap[item.createdByUser] !== currentUser.id) {
      const otherUserId = userMap[item.createdByUser];
      const [otherInter] = await db
        .select({ id: userPlaces.id })
        .from(userPlaces)
        .where(and(eq(userPlaces.placeId, placeId), eq(userPlaces.userId, otherUserId)))
        .limit(1);

      if (!otherInter) {
        await db.insert(userPlaces).values({
          userId: otherUserId,
          placeId,
          favorite: true,
          personalStatus: "visited",
          rating: 9.0,
        });
      }
    }

    // 6. Comentarios comunitarios colaborativos con diferentes autores
    if (item.comments && item.comments.length > 0) {
      for (const comment of item.comments) {
        const commentAuthorId =
          (comment.author && userMap[comment.author]) || currentUser.id;

        const [existingComment] = await db
          .select({ id: placeComments.id })
          .from(placeComments)
          .where(
            and(
              eq(placeComments.placeId, placeId),
              eq(placeComments.userId, commentAuthorId),
              eq(placeComments.content, comment.content)
            )
          )
          .limit(1);

        if (!existingComment) {
          await db.insert(placeComments).values({
            placeId,
            userId: commentAuthorId,
            content: comment.content,
          });
        }
      }
    }
  }

  // 7. Grupos compartidos demo para mostrar la funcionalidad de grupos privados
  const [existingGroup] = await db
    .select({ id: sharingGroups.id })
    .from(sharingGroups)
    .where(and(eq(sharingGroups.ownerUserId, currentUser.id), eq(sharingGroups.name, "Tapeo & Amigos")))
    .limit(1);

  let demoGroupId: string;
  if (!existingGroup) {
    const [createdGroup] = await db
      .insert(sharingGroups)
      .values({
        name: "Tapeo & Amigos",
        ownerUserId: currentUser.id,
      })
      .returning({ id: sharingGroups.id });
    demoGroupId = createdGroup.id;
  } else {
    demoGroupId = existingGroup.id;
  }

  // Añadir miembros demo al grupo
  const demoMembers = ["elena_tapas", "lauragourmet", "carlos_chef"];
  for (const username of demoMembers) {
    const memberId = userMap[username];
    if (memberId) {
      await db
        .insert(sharingGroupMembers)
        .values({
          groupId: demoGroupId,
          userId: memberId,
        })
        .onConflictDoNothing();
    }
  }

  // 8. Filtros guardados demo para el usuario actual
  const demoSavedFiltersList = [
    {
      name: "Tapas en Granada",
      criteria: {
        country: "España",
        city: "Granada",
        occasions: ["tapear"],
      },
    },
    {
      name: "Alta Cocina Internacional",
      criteria: {
        prices: ["€€€€"],
        tags: ["michelin", "50best"],
      },
    },
  ];

  for (const sf of demoSavedFiltersList) {
    const [existingSf] = await db
      .select({ id: savedFilters.id })
      .from(savedFilters)
      .where(and(eq(savedFilters.userId, currentUser.id), eq(savedFilters.name, sf.name)))
      .limit(1);

    if (!existingSf) {
      await db.insert(savedFilters).values({
        userId: currentUser.id,
        name: sf.name,
        criteria: sf.criteria,
      });
    }
  }

  revalidatePath("/");
  return { success: true, count: DEMO_PLACES.length, insertedCount };
}

export async function deleteDemoPlacesAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser || currentUser.role !== "admin") {
    return { error: "No autorizado. Solo los administradores pueden eliminar los datos de demostración." };
  }

  const demoPlaceNames = DEMO_PLACES.map((p) => p.name);
  const demoUsernames = DEMO_USERS.map((u) => u.username);

  // 1. Obtener IDs de los lugares demo existentes
  const existingDemoPlaces = await db
    .select({ id: places.id })
    .from(places)
    .where(inArray(places.name, demoPlaceNames));

  const demoPlaceIds = existingDemoPlaces.map((p) => p.id);

  if (demoPlaceIds.length > 0) {
    // Limpieza en cascada de los lugares de la demo
    await db.delete(placeOccasions).where(inArray(placeOccasions.placeId, demoPlaceIds));
    await db.delete(placeTags).where(inArray(placeTags.placeId, demoPlaceIds));
    await db.delete(userPlaces).where(inArray(userPlaces.placeId, demoPlaceIds));
    await db.delete(placeComments).where(inArray(placeComments.placeId, demoPlaceIds));
    await db.delete(placeGroupAccess).where(inArray(placeGroupAccess.placeId, demoPlaceIds));
    await db.delete(places).where(inArray(places.id, demoPlaceIds));
  }

  // 2. Obtener IDs de los usuarios demo
  const existingDemoUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.username, demoUsernames));

  const demoUserIds = existingDemoUsers.map((u) => u.id);

  if (demoUserIds.length > 0) {
    await db.delete(placeComments).where(inArray(placeComments.userId, demoUserIds));
    await db.delete(userPlaces).where(inArray(userPlaces.userId, demoUserIds));
    await db.delete(sharingGroupMembers).where(inArray(sharingGroupMembers.userId, demoUserIds));
    await db.delete(users).where(inArray(users.id, demoUserIds));
  }

  // 3. Eliminar grupo demo "Tapeo & Amigos"
  const demoGroups = await db
    .select({ id: sharingGroups.id })
    .from(sharingGroups)
    .where(eq(sharingGroups.name, "Tapeo & Amigos"));

  for (const dg of demoGroups) {
    await db.delete(sharingGroupMembers).where(eq(sharingGroupMembers.groupId, dg.id));
    await db.delete(sharingGroups).where(eq(sharingGroups.id, dg.id));
  }

  // 4. Eliminar filtros guardados demo
  await db
    .delete(savedFilters)
    .where(
      and(
        eq(savedFilters.userId, currentUser.id),
        inArray(savedFilters.name, ["Tapas en Granada", "Alta Cocina Internacional"])
      )
    );

  revalidatePath("/");
  return { success: true, count: demoPlaceIds.length };
}
