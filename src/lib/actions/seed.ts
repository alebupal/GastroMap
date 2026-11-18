"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  places,
  placeOccasions,
  placeTags,
  tags,
  users,
} from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

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
}

const DEMO_PLACES: DemoPlace[] = [
  // --- ESPAÑA ---
  {
    name: "Los Diamantes",
    city: "Granada",
    address: "Calle Navas, 28",
    latitude: 37.1738,
    longitude: -3.5985,
    googleMapsUrl: "https://maps.google.com/?q=37.1738,-3.5985",
    priceRange: "€",
    notes: "Imprescindible el pescadito frito recién sacado y las gambas con cada caña.",
    occasions: ["tapear"],
    tags: ["pescaitofrito", "tapas", "marisco", "granada"],
  },
  {
    name: "Bodegas Castañeda",
    city: "Granada",
    address: "Calle Almireceros, 1-3",
    latitude: 37.1772,
    longitude: -3.5978,
    googleMapsUrl: "https://maps.google.com/?q=37.1772,-3.5978",
    priceRange: "€",
    notes: "Pedir un vermut de grifo con montadito caliente o una tabla combinada.",
    occasions: ["tapear"],
    tags: ["vermut", "montaditos", "taberna", "granada"],
  },
  {
    name: "Restaurante Chikito",
    city: "Granada",
    address: "Plaza del Campillo, 9",
    latitude: 37.1717,
    longitude: -3.5977,
    googleMapsUrl: "https://maps.google.com/?q=37.1717,-3.5977",
    priceRange: "€€€",
    notes: "Sitio histórico donde se reunía Federico García Lorca. Ricos los habas con jamón y la cola de toro.",
    occasions: ["comer"],
    tags: ["andaluz", "tradicional", "historia", "granada"],
  },
  {
    name: "Bar La Campana",
    city: "Madrid",
    address: "Calle Botoneras, 6",
    latitude: 40.415,
    longitude: -3.7077,
    googleMapsUrl: "https://maps.google.com/?q=40.4150,-3.7077",
    priceRange: "€",
    notes: "El bocadillo de calamares más famoso junto a la Plaza Mayor. Barato, crujiente y rápido.",
    occasions: ["tapear", "comer"],
    tags: ["calamares", "bocadillos", "madrid", "clasico"],
  },
  {
    name: "DiverXO",
    city: "Madrid",
    address: "Calle de Padre Damián, 23",
    latitude: 40.4578,
    longitude: -3.6896,
    googleMapsUrl: "https://maps.google.com/?q=40.4578,-3.6896",
    priceRange: "€€€€",
    notes: "Experiencia 3 estrellas Michelin de Dabiz Muñoz. Vanguardia gastronómica absoluta.",
    occasions: ["comer", "postureo"],
    tags: ["estrellamichelin", "vanguardia", "exclusivo", "madrid"],
  },
  {
    name: "La Cova Fumada",
    city: "Barcelona",
    address: "Carrer del Baluard, 56",
    latitude: 41.3789,
    longitude: 2.1892,
    googleMapsUrl: "https://maps.google.com/?q=41.3789,2.1892",
    priceRange: "€",
    notes: "La cuna de la auténtica 'bomba' de la Barceloneta. Sardinas a la plancha y ambiente marinero.",
    occasions: ["tapear"],
    tags: ["bombas", "barceloneta", "marisco", "tapas"],
  },
  {
    name: "El Xampanyet",
    city: "Barcelona",
    address: "Carrer de Montcada, 22",
    latitude: 41.385,
    longitude: 2.1818,
    googleMapsUrl: "https://maps.google.com/?q=41.3850,2.1818",
    priceRange: "€€",
    notes: "Taberna icónica del Born desde 1929. Cava propio de la casa, anchoas del Cantábrico y tortilla rellena.",
    occasions: ["tapear", "copas"],
    tags: ["cava", "anchoas", "elborn", "ambiente"],
  },
  {
    name: "El Rinconcillo",
    city: "Sevilla",
    address: "Calle Gerona, 40",
    latitude: 37.3934,
    longitude: -5.9882,
    googleMapsUrl: "https://maps.google.com/?q=37.3934,-5.9882",
    priceRange: "€€",
    notes: "El bar más antiguo de España (1670). Apuntan la cuenta con tiza en la barra. Pedir espinacas con garbanzos.",
    occasions: ["tapear"],
    tags: ["masantiguo", "sevilla", "espinacascongarbanzos", "solera"],
  },
  {
    name: "Pastelería La Viña",
    city: "San Sebastián",
    address: "Calle 31 de Agosto, 3",
    latitude: 43.3235,
    longitude: -1.9845,
    googleMapsUrl: "https://maps.google.com/?q=43.3235,-1.9845",
    priceRange: "€€",
    notes: "La tarta de queso quemada más famosa del planeta. Suave, cremosa y recién horneada.",
    occasions: ["dulce", "cafe"],
    tags: ["tartadequeso", "postres", "sansebastian", "mitico"],
  },
  {
    name: "Casa Carmela",
    city: "Valencia",
    address: "Calle Isabel de Villena, 155",
    latitude: 39.4812,
    longitude: -0.3236,
    googleMapsUrl: "https://maps.google.com/?q=39.4812,-0.3236",
    priceRange: "€€€",
    notes: "Auténtica paella valenciana cocinada a leña de naranjo frente a la playa de la Malvarrosa.",
    occasions: ["comer"],
    tags: ["paella", "arroz", "valencia", "leña"],
  },

  // --- INTERNACIONAL (MUNDIAL) ---
  {
    name: "Trattoria Da Enzo al 29",
    city: "Roma, Italia",
    address: "Via dei Vascellari, 29",
    latitude: 41.8876,
    longitude: 12.4774,
    googleMapsUrl: "https://maps.google.com/?q=41.8876,12.4774",
    priceRange: "€€",
    notes: "La mejor carbonara y cacio e pepe de Roma en el corazón del Trastevere. Ir temprano porque siempre hay cola.",
    occasions: ["comer"],
    tags: ["pasta", "carbonara", "roma", "trastevere", "italiana"],
  },
  {
    name: "L'Antica Pizzeria Da Michele",
    city: "Nápoles, Italia",
    address: "Via Cesare Sersale, 1",
    latitude: 40.8498,
    longitude: 14.2633,
    googleMapsUrl: "https://maps.google.com/?q=40.8498,14.2633",
    priceRange: "€",
    notes: "Solo dos pizzas: Margherita y Marinara. Masa fina, borde aireado y tomate San Marzano perfecto.",
    occasions: ["comer"],
    tags: ["pizza", "pizzanapoletana", "napoles", "margherita"],
  },
  {
    name: "All'Antico Vinaio",
    city: "Florencia, Italia",
    address: "Via dei Neri, 74",
    latitude: 43.7684,
    longitude: 11.258,
    googleMapsUrl: "https://maps.google.com/?q=43.7684,11.2580",
    priceRange: "€",
    notes: "Schiacciatas toscanas gigantescas con crema de trufa, porchetta y sbriciolona recién cortada.",
    occasions: ["tapear", "comer"],
    tags: ["schiacciata", "focaccia", "florencia", "streetfood"],
  },
  {
    name: "Le Relais de l'Entrecôte",
    city: "París, Francia",
    address: "15 Rue Marbeuf",
    latitude: 48.8687,
    longitude: 2.306,
    googleMapsUrl: "https://maps.google.com/?q=48.8687,2.3060",
    priceRange: "€€€",
    notes: "Solo sirven un plato: ensalada de nueces y entrecôte con su salsa secreta de mantequilla y patatas ilimitadas.",
    occasions: ["comer"],
    tags: ["entrecote", "paris", "salsasecreta", "bistrot"],
  },
  {
    name: "Katz's Delicatessen",
    city: "Nueva York, Estados Unidos",
    address: "205 E Houston St",
    latitude: 40.7222,
    longitude: -73.9874,
    googleMapsUrl: "https://maps.google.com/?q=40.7222,-73.9874",
    priceRange: "€€",
    notes: "El sandwich de pastrami ahumado más legendario de Manhattan desde 1888. Guardar el ticket al entrar.",
    occasions: ["comer"],
    tags: ["pastrami", "newyork", "deli", "iconico"],
  },
  {
    name: "Joe's Pizza",
    city: "Nueva York, Estados Unidos",
    address: "7 Carmine St",
    latitude: 40.7306,
    longitude: -74.0021,
    googleMapsUrl: "https://maps.google.com/?q=40.7306,-74.0021",
    priceRange: "€",
    notes: "La porción de pizza neoyorquina clásica por excelencia en Greenwich Village.",
    occasions: ["comer", "tapear"],
    tags: ["nypizza", "slices", "newyork", "clasico"],
  },
  {
    name: "Ichiran Ramen Shibuya",
    city: "Tokio, Japón",
    address: "1-22-7 Jinnan, Shibuya",
    latitude: 35.66,
    longitude: 139.7011,
    googleMapsUrl: "https://maps.google.com/?q=35.6600,139.7011",
    priceRange: "€€",
    notes: "Tonkotsu ramen individual en cabinas privadas. Personalizas textura del fideo, picante y ajo en el papel.",
    occasions: ["comer"],
    tags: ["ramen", "tonkotsu", "tokio", "shibuya", "japonesa"],
  },
  {
    name: "Sukiyabashi Jiro",
    city: "Tokio, Japón",
    address: "Tsukamoto Sogyo Building B1, Ginza",
    latitude: 35.6719,
    longitude: 139.7644,
    googleMapsUrl: "https://maps.google.com/?q=35.6719,139.7644",
    priceRange: "€€€€",
    notes: "El templo del sushi de Jiro Ono. Menú omakase de 20 piezas ejecutadas con maestría inigualable.",
    occasions: ["comer", "postureo"],
    tags: ["sushi", "omakase", "ginza", "tokio", "lujo"],
  },
  {
    name: "Parrilla Don Julio",
    city: "Buenos Aires, Argentina",
    address: "Guatemala 4699, Palermo",
    latitude: -34.5888,
    longitude: -58.4239,
    googleMapsUrl: "https://maps.google.com/?q=-34.5888,-58.4239",
    priceRange: "€€€€",
    notes: "Una de las mejores parrillas del mundo. Ojo de bife de raza Aberdeen Angus alimentada a pastura y mollejas crocantes.",
    occasions: ["comer"],
    tags: ["asado", "parrilla", "buenosaires", "ojodebife", "argentina"],
  },
  {
    name: "Jay Fai",
    city: "Bangkok, Tailandia",
    address: "327 Maha Chai Rd, Samran Rat",
    latitude: 13.7525,
    longitude: 100.5048,
    googleMapsUrl: "https://maps.google.com/?q=13.7525,100.5048",
    priceRange: "€€€",
    notes: "La reina del wok con gafas de esquí. Su tortilla rellena de cangrejo real es crujiente por fuera y jugosísima por dentro.",
    occasions: ["comer"],
    tags: ["streetfood", "crabomelette", "bangkok", "tailandesa"],
  },
];

/**
 * Inserta 20 restaurantes de demostración reales y variados
 */
export async function seedDemoPlacesAction() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    return { error: "Debes iniciar sesión para cargar sitios de prueba." };
  }

  let insertedCount = 0;

  for (const item of DEMO_PLACES) {
    // Comprobar si ya existe por nombre
    const [existing] = await db
      .select({ id: places.id })
      .from(places)
      .where(eq(places.name, item.name))
      .limit(1);

    if (existing) continue;

    // 1. Insertar place
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
        communityPublished: true,
        createdById: currentUser.id,
      })
      .returning();

    // 2. Insertar ocasiones
    if (item.occasions.length > 0) {
      await db.insert(placeOccasions).values(
        item.occasions.map((occ) => ({
          placeId: newPlace.id,
          occasion: occ,
        }))
      );
    }

    // 3. Insertar tags
    if (item.tags.length > 0) {
      for (const t of item.tags) {
        // Asegurar que tag existe en catalogo
        await db.insert(tags).values({ id: t, name: t }).onConflictDoNothing();
      }

      await db.insert(placeTags).values(
        item.tags.map((t) => ({
          placeId: newPlace.id,
          tag: t,
        }))
      );
    }

    insertedCount++;
  }

  revalidatePath("/");
  return { success: true, count: insertedCount };
}
