import { useState, useEffect, useRef, useCallback } from "react";
import { onTripData, saveTripData } from "./firebase-mundial";

// ========== CONSTANTS ==========

// Google Sheets integration
const SHEETS_URL = "TU_APPS_SCRIPT_URL";

// Weather - changes based on current city (default: NYC as central point)
const WEATHER_LAT = 40.7128;
const WEATHER_LON = -74.0060;
const WEATHER_URL = `https://api.open-meteo.com/v1/forecast?latitude=${WEATHER_LAT}&longitude=${WEATHER_LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weathercode,wind_speed_10m_max,uv_index_max&current=temperature_2m,relative_humidity_2m,wind_speed_10m,weathercode&timezone=America/New_York&forecast_days=10`;

const WMO_CODES = {
  0: { label: "Despejado", icon: "☀️" },
  1: { label: "Mayormente despejado", icon: "🌤️" },
  2: { label: "Parcialmente nublado", icon: "⛅" },
  3: { label: "Nublado", icon: "☁️" },
  45: { label: "Niebla", icon: "🌫️" },
  48: { label: "Niebla helada", icon: "🌫️" },
  51: { label: "Llovizna leve", icon: "🌦️" },
  53: { label: "Llovizna moderada", icon: "🌦️" },
  55: { label: "Llovizna intensa", icon: "🌧️" },
  61: { label: "Lluvia leve", icon: "🌧️" },
  63: { label: "Lluvia moderada", icon: "🌧️" },
  65: { label: "Lluvia intensa", icon: "🌧️" },
  80: { label: "Chubascos leves", icon: "🌦️" },
  81: { label: "Chubascos moderados", icon: "🌧️" },
  82: { label: "Chubascos intensos", icon: "⛈️" },
  95: { label: "Tormenta", icon: "⛈️" },
  96: { label: "Tormenta con granizo", icon: "⛈️" },
  99: { label: "Tormenta fuerte", icon: "⛈️" },
};

const getWeatherInfo = (code) => WMO_CODES[code] || { label: "Desconocido", icon: "🌡️" };
const celsiusToF = (c) => Math.round(c * 9 / 5 + 32);

// US Eastern timezone helper
const getUSNow = () => new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
const getUSToday = () => {
  const m = getUSNow();
  return `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}-${String(m.getDate()).padStart(2, "0")}`;
};

const CATEGORIES = [
  { id: "food", label: "Comida", icon: "🍽️", color: "#FF6B6B" },
  { id: "transport", label: "Transporte", icon: "🚗", color: "#4ECDC4" },
  { id: "shopping", label: "Compras", icon: "🛍️", color: "#FFE66D" },
  { id: "entertainment", label: "Entretenimiento", icon: "🎭", color: "#A78BFA" },
  { id: "hotel", label: "Hotel", icon: "🏨", color: "#60A5FA" },
  { id: "flight", label: "Vuelo", icon: "✈️", color: "#F472B6" },
  { id: "car", label: "Auto", icon: "🚘", color: "#34D399" },
  { id: "other", label: "Otros", icon: "📦", color: "#9CA3AF" },
];

const PAYMENT_METHODS = [
  { id: "visa", label: "Visa", color: "#1A1F71" },
  { id: "mc", label: "Mastercard", color: "#EB001B" },
  { id: "amex", label: "Amex", color: "#2E77BC" },
  { id: "cash", label: "Cash", color: "#16A34A" },
];

const BANKS = [
  { id: "galicia", label: "Galicia", color: "#E35205" },
  { id: "bbva", label: "BBVA", color: "#004481" },
  { id: "icbc", label: "ICBC", color: "#C8102E" },
];

const CITY_COLORS = {
  bsas:   { bg: "#1A3A6B", accent: "#75AADB", label: "Buenos Aires" },
  nyc:    { bg: "#1A2E4A", accent: "#60A5FA", label: "Nueva York 🗽" },
  kc:     { bg: "#2D1A4A", accent: "#A78BFA", label: "Kansas City ⚽" },
  vegas:  { bg: "#4A2A00", accent: "#FFE66D", label: "Las Vegas 🎰" },
  canyon: { bg: "#3D1A00", accent: "#F97316", label: "Grand Canyon 🏜️" },
  sedona: { bg: "#4A1A0A", accent: "#EF4444", label: "Sedona 🔴" },
  dallas: { bg: "#0D2D1A", accent: "#34D399", label: "Dallas ⭐" },
  orlando:{ bg: "#1A2D3D", accent: "#38BDF8", label: "Orlando 🏰" },
  miami:  { bg: "#0D2D2D", accent: "#2DD4BF", label: "Miami 🏖️" },
};
const getCityStyle = (city) => CITY_COLORS[city] || { bg: "rgba(255,255,255,0.04)", accent: "#00D4AA", label: "" };

const ColorDot = ({ color, size = 10 }) => (
  <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0, border: "1.5px solid rgba(255,255,255,0.15)" }} />
);

const DEFAULT_DATA = {
  flights: [
    // IDA: Buenos Aires → Lima → Miami
    { id: "f1", type: "ida", airline: "Aerolineas Argentinas", flightNumber: "", from: "AEP", to: "LIM", date: "2026-06-11", time: "17:10", confirmation: "", status: "pendiente", notes: "Llegada 20:00 · USD 412" },
    { id: "f2", type: "ida", airline: "American Airlines", flightNumber: "", from: "LIM", to: "MIA", date: "2026-06-11", time: "23:59", confirmation: "", status: "pendiente", notes: "Llegada 06:54 (+1) · USD 766" },
    // Miami → NYC
    { id: "f3", type: "interno", airline: "American Airlines", flightNumber: "", from: "MIA", to: "NYC", date: "2026-06-12", time: "09:59", confirmation: "", status: "pendiente", notes: "Llegada 13:01 · Opción 1 - USD 204" },
    // NYC → Kansas City
    { id: "f4", type: "interno", airline: "Southwest", flightNumber: "", from: "NYC", to: "MCI", date: "2026-06-16", time: "08:55", confirmation: "", status: "pendiente", notes: "Llegada 11:05 · USD 310" },
    // Kansas → Las Vegas
    { id: "f5", type: "interno", airline: "Southwest", flightNumber: "", from: "MCI", to: "LAS", date: "2026-06-17", time: "08:45", confirmation: "", status: "pendiente", notes: "Llegada 09:45 · USD 455" },
    // Phoenix → Dallas
    { id: "f6", type: "interno", airline: "Southwest", flightNumber: "", from: "PHX", to: "DFW", date: "2026-06-21", time: "18:55", confirmation: "", status: "pendiente", notes: "Llegada 23:20 · USD 238" },
    // Dallas → Orlando
    { id: "f7", type: "interno", airline: "Southwest", flightNumber: "", from: "DFW", to: "MCO", date: "2026-06-22", time: "18:50", confirmation: "", status: "pendiente", notes: "Llegada 22:15 · USD 160" },
    // VUELTA: Miami → Lima → Buenos Aires
    { id: "f8", type: "vuelta", airline: "American Airlines", flightNumber: "", from: "MIA", to: "LIM", date: "2026-06-28", time: "17:35", confirmation: "", status: "pendiente", notes: "Llegada 22:15 · USD 412" },
    { id: "f9", type: "vuelta", airline: "Aerolineas Argentinas", flightNumber: "", from: "LIM", to: "AEP", date: "2026-06-28", time: "22:40", confirmation: "", status: "pendiente", notes: "Llegada 05:00 (+1) · USD 726" },
  ],
  hotels: [
    { id: "h1", name: "", address: "", city: "NYC", checkIn: "2026-06-12", checkOut: "2026-06-16", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false },
    { id: "h2", name: "", address: "", city: "Kansas City", checkIn: "2026-06-16", checkOut: "2026-06-17", confirmation: "", totalCost: 0, currency: "USD", notes: "Una noche post partido", paid: false },
    { id: "h3", name: "", address: "", city: "Las Vegas", checkIn: "2026-06-17", checkOut: "2026-06-21", confirmation: "", totalCost: 0, currency: "USD", notes: "Base para Grand Canyon", paid: false },
    { id: "h4", name: "", address: "", city: "Dallas", checkIn: "2026-06-21", checkOut: "2026-06-22", confirmation: "", totalCost: 0, currency: "USD", notes: "Una noche, vuelo a Orlando al día siguiente", paid: false },
    { id: "h5", name: "", address: "", city: "Orlando", checkIn: "2026-06-22", checkOut: "2026-06-25", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false },
    { id: "h6", name: "", address: "", city: "Miami / Siesta Key", checkIn: "2026-06-25", checkOut: "2026-06-28", confirmation: "", totalCost: 0, currency: "USD", notes: "Últimos días antes de la vuelta", paid: false },
  ],
  cars: [
    { id: "car1", company: "", city: "Las Vegas", pickUp: "2026-06-17", dropOff: "2026-06-21", confirmation: "", totalCost: 0, currency: "USD", notes: "Las Vegas + Grand Canyon · Devolver en Phoenix", paid: false },
    { id: "car2", company: "", city: "Orlando", pickUp: "2026-06-22", dropOff: "2026-06-25", confirmation: "", totalCost: 0, currency: "USD", notes: "Orlando · Devolver antes de ir a Miami", paid: false },
  ],
  tickets: [],
  expenses: [],
  itinerary: [
    { id: "d1", date: "2026-06-11", title: "Vuelo Buenos Aires → Miami ✈️", city: "bsas", activities: "17:10 - Vuelo AEP → LIM (Aerolíneas Argentinas)\n23:59 - Vuelo LIM → MIA (American Airlines)", notes: "Llegada a Miami 06:54 del 12/6" },
    { id: "d2", date: "2026-06-12", title: "Miami → Nueva York — Llegada 🗽", city: "nyc",
  activities: "06:54 - Llegada a Miami MIA · estirar piernas, café\n09:59 - Vuelo MIA→NYC American Airlines · $204/pax\n13:01 - Llegada a LGA/JFK · AirTrain + subway E al hotel (~$8.50) o taxi (~$55-70)\n14:00 - Check-in DoubleTree Hilton · dejar equipaje aunque no haya cuarto\n14:30 - Almuerzo en Hells Kitchen · 9th Ave entre 45th-55th · Sate Kampar o Danji (cocina coreana)\n15:30 - Times Square · primera impresión · toméense la foto clásica en el centro · entrar al M&Ms World o TKTS para ver precios Broadway\n16:30 - 5th Avenue · caminata desde 42nd hacia el norte · frente al Rockefeller Center · St. Patrick Cathedral · entrada libre\n17:00 - Grand Central Terminal · Main Concourse · techo con constelaciones · Whispering Gallery en la esquina noreste del nivel inferior · acústica increíble · gratis\n18:30 - One World Observatory · reservar ANTES del viaje · ~$45/pax · mejor al atardecer · piso 100 · vistas 360° de Manhattan\n20:30 - Cena en Lower Manhattan · Stone Street (la calle de adoquines más antigua de NYC) · ambiente de pub · buena cerveza\n22:00 - Paseo nocturno por el puente de Brooklyn desde Manhattan si tienen energía",
  notes: "💡 AirTrain desde JFK + subway E/A al centro cuesta $8.50 vs taxi $60+. Reservar One World Observatory ANTES del viaje en oneworldobservatory.com." },
    { id: "d3", date: "2026-06-13", title: "NYC — The Met + Central Park + Brooklyn 🗽", city: "nyc",
  activities: "08:00 - Desayuno americano en diner local · Lexington Candy Shop (Upper East Side) o E.A.T. · huevos, bagel, jugo\n09:30 - The Metropolitan Museum of Art · llegar antes de las 10am · entrada ~$30/pax · impresionismo europeo (sala 800-830) · sala egipcia con el Templo de Dendur · arte medieval · armaduras del siglo XVI · mínimo 2.5hs · azotea abierta en verano con vistas al parque\n12:00 - Almuerzo en el Café del Met o en el parque con algo de la entrada\n13:00 - Central Park desde la 5th Ave ·  Conservatory Garden → Jackie Kennedy Onassis Reservoir (4km de lago) → Bow Bridge (foto icónica · la más fotografiada del parque) → Bethesda Fountain y Terrace → Strawberry Fields (tributo a John Lennon · mosaico Imagine) → Tavern on the Green exterior\n15:30 - Salida del parque hacia el sur · Madison Avenue o Lexington · vidriera de tiendas\n16:30 - Subway a Brooklyn · línea 2/3 a Clark St o A/C a High St\n17:00 - DUMBO (Down Under the Manhattan Bridge Overpass) · foto obligatoria desde Washington St con el puente de Brooklyn y el skyline · Jane's Carousel (carrusel histórico frente al East River · $2)\n17:45 - Brooklyn Bridge caminando · desde el lado de Brooklyn hacia Manhattan · 30-40 min cruzando · mejor con luz del atardecer\n19:30 - Cena en DUMBO o Brooklyn Heights · Juliana's Pizza (rival histórica de Grimaldi's · debajo del puente) o Time Out Market Brooklyn\n21:00 - Westlight Rooftop Bar · William Vale Hotel piso 22 en Williamsburg · vistas increíbles de Manhattan · reservar mesa con anticipación",
  notes: "💡 Tarjeta OMNY semanal ilimitada ~$34/persona — comprar el primer día. The Met: el precio es técnicamente sugerido pero pagar menos puede generar demora en entrada." },
    { id: "d4", date: "2026-06-14", title: "NYC — High Line + Chelsea + Midtown 🗽", city: "nyc",
  activities: "08:30 - Desayuno en West Village · Buvette (bistro francés · Barrow St) o Joe Coffee (tostadas y cortado) · ambiente de neighborhood local\n10:00 - High Line · entrar en la calle Gansevoort St (extremo sur) y caminar hacia el norte hasta 34th St · 2.3km · arte instalado entre las vías · vistas al Hudson River · paseo sobre los techos de Chelsea · completamente gratis\n11:30 - Chelsea Market · entrar por 9th Ave entre 15th y 16th · Los Tacos No.1 (los mejores tacos de NYC según todo el mundo) · The Lobster Place para mariscos · helado de Big Gay Ice Cream · pasar 1hs\n13:00 - Galería de arte en Chelsea · Gagosian Gallery o David Zwirner · entrada libre · arte contemporáneo de primer nivel mundial\n14:00 - MoMA (Museum of Modern Art) · ~$30/pax · Starry Night de Van Gogh · Warhol · Picasso · Water Lilies de Monet · colección de diseño industrial · 2hs mínimo · abre los domingos\n16:30 - Rockefeller Center · Top of the Rock · ~$40/pax · mejor vista del Empire State (lo ves desde afuera) · alternativa al One World si no lo hicieron · reservar online\n18:30 - Radio City Music Hall · exterior · 6th Avenue y 50th St · foto · arquitectura Art Deco\n19:00 - Cena en Koreatown · 32nd St entre 5th y 6th Ave (Koreatown block) · K-BBQ a la mesa · Jongro BBQ o Kang Suh · abiertos hasta tarde\n21:00 - Empire State Building nocturno opcional · ~$44/pax · luces de noche · o caminata por Midtown iluminado",
  notes: "💡 Si ya hicieron One World Observatory, Top of the Rock es distinto: ven el Empire State iluminado. Ambos valen la pena pero son $40 c/u." },
    { id: "d5", date: "2026-06-15", title: "NYC — Financial District + SoHo + Despedida 🗽", city: "nyc",
  activities: "08:30 - Desayuno rápido cerca del hotel · o bagel con salmón en cualquier deli de la 7th Ave · desayuno neoyorquino clásico\n09:15 - Subway al Financial District · línea 1/2/3 a Fulton St\n09:30 - Wall Street · New York Stock Exchange · Charging Bull en Bowling Green · Fearless Girl frente al NYSE · caminata por Nassau St\n10:00 - 9/11 Memorial & Museum · los dos estanques reflectantes donde estaban las Torres Gemelas · los nombres grabados · momento de silencio · entrada al museo ~$30 o solo al memorial gratis · 45min\n11:00 - Oculus (WTC Transportation Hub) · arquitectura de Santiago Calatrava · mariposa de acero abriendo las alas · interior blanco impresionante · gratis · foto interior obligatoria\n11:45 - Brookfield Place / Hudson Eats · vista al Hudson River · ideal para almorzar o tomar algo · terraza exterior\n13:00 - Ferry de East River ($4) desde Pier 11/Wall St hacia Brooklyn Heights o cruzar Manhattan Bridge a pie\n14:00 - SoHo · bajar por Broadway desde Houston St · galerías de arte · arquitectura de hierro fundido del siglo XIX · tiendas · Prince St · Spring St · bueno para compras de último momento\n15:30 - Washington Square Park · Arco de Triunfo · músicos de jazz · jugadores de ajedrez al aire libre · ambiente universitario de NYU · gratis\n16:30 - Little Italy · Mulberry St · caffè y cannoli en Caffe Palermo o Ferrara Bakery (desde 1892) · caminata breve\n17:00 - Chinatown · Canal St · caldos y dim sum · el contraste con Manhattan es brutal\n18:30 - TKTS Times Square · comprar entradas Broadway con 50% descuento para show nocturno · Hamilton · Chicago · Wicked · llegar 30min antes de que abra la boletería\n20:00 - Cena pre-show en Midtown · cena rápida antes del teatro\n21:00 - Show de Broadway (opcional) \n22:30 - Preparar equipaje · vuelo mañana 8:55am",
  notes: "⚠️ Vuelo mañana 8:55am — Uber a las 6:15am MÁXIMO. Preparar todo esta noche. De LGA son ~40min sin tráfico, de JFK ~1hs." },
    { id: "d6", date: "2026-06-16", title: "Kansas City ⚽ PARTIDO 1 🇦🇷", city: "kc", activities: "06:15 - Uber al aeropuerto\n08:55 - Vuelo NYC → Kansas City (Southwest)\n11:05 - Llegada · retirar auto Hertz\n20:00 - ⚽ ARGENTINA 🇦🇷 vs ARGELIA 🇩🇿 · Partido 1 del Mundial", notes: "🏟️ Primer partido. Llegar al estadio a las 18hs." },
    { id: "d7", date: "2026-06-17", title: "Kansas → Las Vegas ✈️🎰", city: "vegas", activities: "08:45 - Vuelo MCI → LAS (Southwest)\n09:45 - Llegada · retirar auto rental\n12:00 - The Strip · MGM, Bellagio, Caesars\n20:00 - Fremont Street Experience · shows LED gratuitos", notes: "Acostarse temprano — viernes 19/6 salida 6:30am." },
    { id: "d8", date: "2026-06-18", title: "Las Vegas 🎰", city: "vegas", activities: "10:00 - Pool day en el hotel · 40°C afuera\n16:00 - Fuentes del Bellagio · show gratuito\n19:30 - Cirque du Soleil O en el Bellagio · ~$100+/pax · RESERVAR", notes: "⚠️ Acostarse temprano — mañana salida 6:30am al Grand Canyon." },
    { id: "d9", date: "2026-06-19", title: "West Rim Skywalk + South Rim 🏜️", city: "canyon", activities: "06:30 - Salida desde Las Vegas\n09:00 - Skywalk Eagle Point · paquete ~$50 + Skywalk ~$60 · grandcanyonwest.com · no entran cámaras\n11:00 - Guano Point · mejor panorámica · almorzar acá\n12:30 - Salida hacia South Rim (~2.5hs)\n15:30 - Visitor Center · Mather Point\n17:00 - Desert View Watchtower · cierra 18hs", notes: "💡 EL DÍA LARGO. Fotos oficiales Skywalk ~$25. Pase South Rim $35/auto." },
    { id: "d10", date: "2026-06-20", title: "Grand Canyon — Trek + Helicóptero 🚁", city: "canyon", activities: "06:00 - Bright Angel Trail · SALIR ANTES DEL CALOR · solo hasta 1.5 Mile Resthouse · 2L agua/persona\n10:00 - Papillon Helicopters · ~30 min · ~$200-250/pax · RESERVAR\n12:30 - Miradores South Rim · shuttle gratuito · Hopi Point\n16:00 - Salida hacia Phoenix (~4hs)", notes: "⚠️ 45°C abajo en junio. NUNCA bajar más del 1.5 Mile Resthouse." },
    { id: "d11", date: "2026-06-21", title: "Sedona + Phoenix → Dallas 🔴✈️", city: "sedona", activities: "08:30 - Airport Mesa Vortex · vistas panorámicas\n09:45 - Cathedral Rock Trail · 2.5km · Red Rock Pass $5\n12:00 - Chapel of the Holy Cross · entrada gratuita\n12:45 - Tlaquepaque Arts Village · almorzar\n15:00 - SALIDA hacia Phoenix\n16:30 - Old Town Scottsdale · cerveza de despedida\n18:55 - Vuelo PHX → Dallas (Southwest)", notes: "Salir de Sedona a las 15hs máximo. Aeropuerto PHX a las 17:15hs." },
    { id: "d12", date: "2026-06-22", title: "Dallas ⚽ PARTIDO 2 🇦🇷", city: "dallas", activities: "09:30 - Salir del Hampton Inn en Uber/Lyft\n⚠️ Ruta: Hampton Inn → I-30 W → TX-360 S → AT&T Way · ~30km · 40-60min\n12:00 - ⚽ ARGENTINA 🇦🇷 vs AUSTRIA 🇦🇹 · AT&T Stadium Arlington\n17:30 - Uber al aeropuerto DFW\n18:50 - Vuelo DFW → Orlando (Southwest)", notes: "⚠️ Vuelo 18:50 — tiempo justo post partido. Tener Uber pedido ANTES de salir del estadio." },
    { id: "d13", date: "2026-06-23", title: "Orlando 🏰", city: "orlando", activities: "Descanso post partido y viaje\nDisney Springs · International Drive · Universal CityWalk", notes: "Día de recuperación. Definir parques." },
    { id: "d14", date: "2026-06-24", title: "Orlando — Parques 🏰", city: "orlando", activities: "Parques temáticos · Universal / Disney / SeaWorld\nReservar tickets online con anticipación", notes: "El parque que elijan el día anterior." },
    { id: "d15", date: "2026-06-25", title: "Miami o Siesta Key 🏖️", city: "miami", activities: "Devolver auto Orlando\nViaje a Miami Beach o Siesta Key\nCheck-in · playa y relax", notes: "⏳ Destino final aún por definir." },
    { id: "d16", date: "2026-06-26", title: "Playa — Relax total 🏖️", city: "miami", activities: "Playa y relax\nRestaurantes · atardecer", notes: "Días de descanso merecidos." },
    { id: "d17", date: "2026-06-27", title: "Último día de playa 🏖️", city: "miami", activities: "Último día de relax\nCena de despedida del viaje", notes: "Penúltimo día." },
    { id: "d18", date: "2026-06-28", title: "Vuelta a Buenos Aires ✈️🇦🇷", city: "bsas", activities: "17:35 - Vuelo MIA → LIM (American Airlines)\n22:40 - Vuelo LIM → AEP (Aerolíneas Argentinas)", notes: "Llegada a Buenos Aires 05:00 del 29/6. ¡Fin del viaje!" },
  ],
  budget: { total: 0, currency: "USD" },
  checklist: [
    { id: "c1", text: "Pasaporte", checked: false },
    { id: "c2", text: "ESTA (autorización viaje USA)", checked: false },
    { id: "c3", text: "Licencia de conducir internacional", checked: false },
    { id: "c4", text: "Seguro de viaje", checked: false },
    { id: "c5", text: "Tarjetas (Visa, BBVA, ICBC)", checked: false },
    { id: "c6", text: "Dólares cash", checked: false },
    { id: "c7", text: "Cargador celular", checked: false },
    { id: "c8", text: "Adaptador enchufe", checked: false },
    { id: "c9", text: "Protector solar", checked: false },
    { id: "c10", text: "Camiseta Argentina 🇦🇷", checked: false },
    { id: "c11", text: "Malla / Short de baño", checked: false },
    { id: "c12", text: "Ojotas", checked: false },
    { id: "c13", text: "Lentes de sol", checked: false },
    { id: "c14", text: "Botiquín básico", checked: false },
    { id: "c15", text: "Entradas partidos Argentina", checked: false },
    { id: "c16", text: "Confirmaciones alojamiento", checked: false },
    { id: "c17", text: "Confirmaciones auto rental", checked: false },
    { id: "c18", text: "Boarding passes descargados", checked: false },
  ],
  notes: "",
};

// ========== HELPER: Extract URLs from text ==========

const extractUrls = (text) => {
  if (!text) return { urls: [], cleanText: text };
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const urls = [];
  let match;
  while ((match = urlRegex.exec(text)) !== null) {
    urls.push(match[1]);
  }
  const cleanText = text.replace(urlRegex, '').replace(/📍\s*/g, '').trim();
  return { urls, cleanText };
};

const isGoogleMapsUrl = (url) => {
  return url.includes('maps.app.goo.gl') || url.includes('google.com/maps') || url.includes('goo.gl/maps');
};

// ========== MAP PREVIEW COMPONENT ==========

function MapPreview({ url, address, lat, lon }) {
  // Use OpenStreetMap static tile for preview
  const mapLat = lat || 26.0112;
  const mapLon = lon || -80.1495;
  const zoom = 15;
  
  // OpenStreetMap embed URL
  const osmEmbedUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${mapLon - 0.008},${mapLat - 0.005},${mapLon + 0.008},${mapLat + 0.005}&layer=mapnik&marker=${mapLat},${mapLon}`;
  
  // Static image fallback using OSM tile server
  const tileX = Math.floor((mapLon + 180) / 360 * Math.pow(2, zoom));
  const tileY = Math.floor((1 - Math.log(Math.tan(mapLat * Math.PI / 180) + 1 / Math.cos(mapLat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom));
  const tileUrl = `https://tile.openstreetmap.org/${zoom}/${tileX}/${tileY}.png`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{ display: "block", textDecoration: "none", marginTop: 12 }}
    >
      <div style={{
        borderRadius: 14,
        overflow: "hidden",
        border: "1px solid rgba(0,212,170,0.2)",
        background: "rgba(0,212,170,0.04)",
        transition: "all 0.25s ease",
        cursor: "pointer",
      }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(0,212,170,0.4)";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,212,170,0.12)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "rgba(0,212,170,0.2)";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >
        {/* Map image area */}
        <div style={{
          position: "relative",
          height: 160,
          background: `url(${tileUrl}) center/cover no-repeat`,
          backgroundColor: "rgba(0,30,40,0.5)",
        }}>
          {/* OSM iframe overlay for better map rendering */}
          <iframe
            src={osmEmbedUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              pointerEvents: "none",
              position: "absolute",
              top: 0,
              left: 0,
            }}
            title="Mapa ubicación"
            loading="lazy"
          />
          {/* Gradient overlay at bottom */}
          <div style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 50,
            background: "linear-gradient(transparent, rgba(10,14,26,0.9))",
          }} />
          {/* Pin icon overlay */}
          <div style={{
            position: "absolute",
            top: 10,
            right: 10,
            background: "rgba(0,212,170,0.9)",
            borderRadius: 8,
            padding: "4px 8px",
            fontSize: 11,
            fontWeight: 700,
            color: "#0A0E1A",
            display: "flex",
            alignItems: "center",
            gap: 4,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
          }}>
            📍 Maps
          </div>
        </div>
        {/* Bottom bar */}
        <div style={{
          padding: "10px 14px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "rgba(0,212,170,0.06)",
        }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#E8ECF4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {address || "Ver ubicación"}
            </div>
            <div style={{ fontSize: 11, color: "#00D4AA", marginTop: 2 }}>
              Abrir en Google Maps ↗
            </div>
          </div>
          <div style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            background: "rgba(0,212,170,0.15)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            flexShrink: 0,
            marginLeft: 10,
          }}>
            🗺️
          </div>
        </div>
      </div>
    </a>
  );
}

// ========== CLICKABLE LINK COMPONENT ==========

function ClickableLink({ url, label }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 12px",
        background: "rgba(0,180,216,0.08)",
        borderRadius: 10,
        textDecoration: "none",
        border: "1px solid rgba(0,180,216,0.15)",
        marginTop: 6,
        transition: "all 0.2s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = "rgba(0,180,216,0.15)";
        e.currentTarget.style.borderColor = "rgba(0,180,216,0.3)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "rgba(0,180,216,0.08)";
        e.currentTarget.style.borderColor = "rgba(0,180,216,0.15)";
      }}
    >
      <span style={{ fontSize: 12, color: "#00B4D8", fontWeight: 600 }}>{label || "Abrir link"} ↗</span>
    </a>
  );
}

// ========== UI COMPONENTS ==========

const Card = ({ children, style, onClick }) => (
  <div onClick={onClick} style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: 18, border: "1px solid rgba(255,255,255,0.06)", cursor: onClick ? "pointer" : "default", transition: "all 0.2s", animation: "fadeIn 0.3s ease", ...style }}>
    {children}
  </div>
);

const Input = ({ label, value, onChange, type = "text", placeholder, style }) => (
  <div style={{ marginBottom: 14, ...style }}>
    {label && <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{label}</label>}
    <input type={type} value={value || ""} onChange={(e) => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#E8ECF4", fontSize: 14, outline: "none", boxSizing: "border-box", transition: "border-color 0.2s" }}
      onFocus={(e) => (e.target.style.borderColor = "rgba(0,212,170,0.4)")}
      onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.1)")} />
  </div>
);

const Btn = ({ children, onClick, variant = "primary", style, small }) => {
  const styles = {
    primary: { background: "linear-gradient(135deg, #00D4AA, #00B4D8)", color: "#0A0E1A", fontWeight: 700 },
    secondary: { background: "rgba(255,255,255,0.08)", color: "#E8ECF4", fontWeight: 600 },
    danger: { background: "rgba(255,107,107,0.15)", color: "#FF6B6B", fontWeight: 600 },
  };
  return (
    <button onClick={onClick} style={{ padding: small ? "6px 14px" : "12px 20px", borderRadius: 10, border: "none", cursor: "pointer", fontSize: small ? 12 : 14, letterSpacing: 0.3, transition: "all 0.2s", ...styles[variant], ...style }}>
      {children}
    </button>
  );
};

const StatusBadge = ({ status }) => {
  const colors = { confirmado: { bg: "rgba(0,212,170,0.15)", text: "#00D4AA" }, pendiente: { bg: "rgba(255,230,109,0.15)", text: "#FFE66D" }, cancelado: { bg: "rgba(255,107,107,0.15)", text: "#FF6B6B" } };
  const c = colors[status] || colors.pendiente;
  return <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: c.bg, color: c.text, textTransform: "uppercase", letterSpacing: 0.8 }}>{status}</span>;
};

const SyncIndicator = ({ synced }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 20, background: synced ? "rgba(0,212,170,0.1)" : "rgba(255,230,109,0.1)", fontSize: 10, fontWeight: 600, color: synced ? "#00D4AA" : "#FFE66D", letterSpacing: 0.5 }}>
    <span style={{ width: 6, height: 6, borderRadius: 3, background: synced ? "#00D4AA" : "#FFE66D", animation: synced ? "none" : "pulse 1.5s infinite" }} />
    {synced ? "SYNC" : "GUARDANDO..."}
  </div>
);

const Tab = ({ active, onClick, icon, label, badge }) => (
  <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, padding: "8px 4px", background: "none", border: "none", cursor: "pointer", color: active ? "#00D4AA" : "#8892A4", fontSize: 10, position: "relative", transition: "color 0.2s", flex: 1 }}>
    <span style={{ fontSize: 20 }}>{icon}</span>
    <span style={{ fontWeight: active ? 700 : 500, letterSpacing: 0.3 }}>{label}</span>
    {badge > 0 && <span style={{ position: "absolute", top: 4, right: "calc(50% - 18px)", background: "#FF6B6B", color: "#fff", borderRadius: 10, fontSize: 9, fontWeight: 700, padding: "1px 5px", minWidth: 14, textAlign: "center" }}>{badge}</span>}
  </button>
);

// ========== WEATHER ==========

function WeatherWidget() {
  const [weather, setWeather] = useState(null);
  const [loading, setLoading] = useState(true);
  const [useFahrenheit, setUseFahrenheit] = useState(false);

  useEffect(() => {
    fetch(WEATHER_URL)
      .then(r => r.json())
      .then(data => { setWeather(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  if (loading) return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center", padding: 20 }}>
        <div style={{ width: 20, height: 20, border: "2px solid rgba(0,212,170,0.3)", borderTopColor: "#00D4AA", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
        <span style={{ fontSize: 13, color: "#8892A4" }}>Cargando clima...</span>
      </div>
    </Card>
  );

  if (!weather?.current) return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ textAlign: "center", padding: 12 }}>
        <span style={{ fontSize: 24 }}>🌐</span>
        <div style={{ fontSize: 13, color: "#8892A4", marginTop: 6 }}>Weather no disponible</div>
      </div>
    </Card>
  );

  const { current, daily } = weather;
  const currentInfo = getWeatherInfo(current.weathercode);
  const tempDisplay = (c) => useFahrenheit ? `${celsiusToF(c)}°F` : `${Math.round(c)}°C`;

  return (
    <div style={{ marginBottom: 16 }}>
      <Card style={{ marginBottom: 10, background: "linear-gradient(135deg, rgba(0,180,216,0.12) 0%, rgba(0,212,170,0.06) 100%)", borderColor: "rgba(0,180,216,0.15)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#00B4D8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.2 }}>🏟️ Nueva York ahora</div>
          <button onClick={() => setUseFahrenheit(!useFahrenheit)} style={{ background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 6, padding: "3px 8px", color: "#8892A4", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>°{useFahrenheit ? "C" : "F"}</button>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 48, lineHeight: 1 }}>{currentInfo.icon}</div>
          <div>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#E8ECF4", lineHeight: 1 }}>{tempDisplay(current.temperature_2m)}</div>
            <div style={{ fontSize: 13, color: "#C8CDD8", marginTop: 4 }}>{currentInfo.label}</div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div style={{ fontSize: 12, color: "#8892A4" }}>💧 {current.relative_humidity_2m}%</div>
            <div style={{ fontSize: 12, color: "#8892A4", marginTop: 4 }}>💨 {Math.round(current.wind_speed_10m)} km/h</div>
          </div>
        </div>
      </Card>
      <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch", scrollbarWidth: "none" }}>
        {daily.time.map((date, i) => {
          const d = new Date(date + "T12:00:00");
          const info = getWeatherInfo(daily.weathercode[i]);
          const isToday = i === 0;
          return (
            <Card key={date} style={{ padding: "10px 12px", textAlign: "center", borderColor: isToday ? "rgba(0,212,170,0.2)" : undefined, background: isToday ? "rgba(0,212,170,0.05)" : undefined, minWidth: 80, flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: isToday ? "#00D4AA" : "#8892A4", fontWeight: 700, textTransform: "uppercase" }}>{isToday ? "Hoy" : dayNames[d.getDay()]}</div>
              <div style={{ fontSize: 9, color: "#6B7280", marginTop: 1 }}>{d.getDate()}/{d.getMonth() + 1}</div>
              <div style={{ fontSize: 26, margin: "6px 0" }}>{info.icon}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E8ECF4" }}>{tempDisplay(daily.temperature_2m_max[i])}</div>
              <div style={{ fontSize: 11, color: "#6B7280" }}>{tempDisplay(daily.temperature_2m_min[i])}</div>
              <div style={{ marginTop: 4, fontSize: 9, color: "#8892A4" }}>🌧 {daily.precipitation_probability_max[i]}%</div>
            </Card>
          );
        })}
      </div>
      <div style={{ textAlign: "right", marginTop: 6, fontSize: 10, color: "#4B5563" }}>Open-Meteo.com</div>
    </div>
  );
}

// ========== SECTIONS ==========

function DashboardSection({ data, updateData }) {
  const totalExpenses = (data.expenses || []).reduce((s, e) => s + (e.amount || 0), 0);
  const byCategory = {};
  (data.expenses || []).forEach((e) => { byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0); });
  const topCategory = Object.entries(byCategory).sort((a, b) => b[1] - a[1])[0];
  const daysUntil = Math.max(0, Math.ceil((new Date("2026-06-11") - getUSNow()) / (1000 * 60 * 60 * 24)));
  const confirmedFlights = (data.flights || []).filter((f) => f.status === "confirmado").length;
  const pendingItems = [
    ...(data.hotels || []).filter(h => !h.confirmation).map(h => `Aloj. ${h.city || h.name || "?"}`),
    ...(data.cars || []).filter(c => !c.confirmation).map(c => `Auto ${c.city || c.company || "?"}`),
    ...(data.flights || []).filter(f => !f.confirmation).map(f => `Vuelo ${f.from}→${f.to}`),
  ];

  return (
    <div>
      <div style={{ textAlign: "center", padding: "30px 20px 20px", background: "linear-gradient(180deg, rgba(0,212,170,0.08) 0%, transparent 100%)", borderRadius: 20, marginBottom: 20 }}>
        <div style={{ fontSize: 13, color: "#8892A4", letterSpacing: 2, textTransform: "uppercase", marginBottom: 8 }}>Mundial 2026 🇦🇷</div>
        <div style={{ fontSize: 64, fontWeight: 800, background: "linear-gradient(135deg, #75AADB, #FFFFFF, #75AADB)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", lineHeight: 1, fontFamily: "'Playfair Display', serif" }}>{daysUntil}</div>
        <div style={{ fontSize: 14, color: "#8892A4", marginTop: 4 }}>días para el viaje</div>
      </div>

      <WeatherWidget />

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <Card>
          <div style={{ fontSize: 11, color: "#8892A4", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Gastos totales</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#00D4AA" }}>${totalExpenses.toLocaleString()}</div>
        </Card>
        <Card>
          <div style={{ fontSize: 11, color: "#8892A4", marginBottom: 4, textTransform: "uppercase", letterSpacing: 1 }}>Vuelos</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: "#60A5FA" }}>{confirmedFlights}/{(data.flights || []).length}</div>
          <div style={{ fontSize: 11, color: "#8892A4", marginTop: 2 }}>confirmados</div>
        </Card>
      </div>

      {pendingItems.length > 0 && (
        <Card style={{ borderColor: "rgba(255,230,109,0.15)", marginBottom: 12 }}>
          <div style={{ fontSize: 12, color: "#FFE66D", fontWeight: 700, marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>⚠️ Pendientes</div>
          {pendingItems.map((item, i) => (
            <div key={i} style={{ fontSize: 13, color: "#C8CDD8", padding: "4px 0", display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "#FFE66D", flexShrink: 0 }} />
              Falta confirmación: {item}
            </div>
          ))}
        </Card>
      )}

      {/* Matches countdown cards */}
      {(() => {
        const matches = [
          { date: "2026-06-16", time: "20:00", rival: "Argelia 🇩🇿", city: "Kansas City", stadium: "Arrowhead Stadium", num: 1 },
          { date: "2026-06-22", time: "12:00", rival: "Austria 🇦🇹", city: "Dallas (Arlington)", stadium: "AT&T Stadium", num: 2 },
        ];
        return matches.map(match => {
          const matchDt = new Date(`${match.date}T${match.time}:00`);
          const now = getUSNow();
          const diffMs = matchDt - now;
          const diffDays = Math.floor(diffMs / 86400000);
          const diffHrs = Math.floor((diffMs % 86400000) / 3600000);
          const passed = diffMs < 0;
          return (
            <div key={match.num} style={{ marginBottom: 12, borderRadius: 16, overflow: "hidden", border: "1px solid rgba(196,160,0,0.25)", background: "linear-gradient(135deg, rgba(26,42,107,0.6) 0%, rgba(40,20,80,0.6) 100%)" }}>
              <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 11, color: "#FFE66D", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1 }}>⚽ Partido {match.num} — {match.city}</div>
                {!passed && <div style={{ fontSize: 12, color: "#00D4AA", fontWeight: 700 }}>{diffDays > 0 ? `${diffDays}d ${diffHrs}h` : diffHrs > 0 ? `${diffHrs}h` : "¡HOY!"}</div>}
                {passed && <div style={{ fontSize: 11, color: "#6B7280" }}>Jugado</div>}
              </div>
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 16 }}>
                <div style={{ fontSize: 36 }}>🇦🇷</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#E8ECF4" }}>Argentina vs {match.rival}</div>
                  <div style={{ fontSize: 12, color: "#8892A4", marginTop: 3 }}>{match.date.slice(8)}/{match.date.slice(5,7)} · {match.time}hs · {match.stadium}</div>
                </div>
              </div>
            </div>
          );
        });
      })()}


      {topCategory && (
        <Card style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: "#8892A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Mayor gasto</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 24 }}>{CATEGORIES.find((c) => c.id === topCategory[0])?.icon || "📦"}</span>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#E8ECF4" }}>{CATEGORIES.find((c) => c.id === topCategory[0])?.label || topCategory[0]}</div>
              <div style={{ fontSize: 13, color: "#00D4AA", fontWeight: 600 }}>${topCategory[1].toLocaleString()}</div>
            </div>
          </div>
        </Card>
      )}

      {/* Daily expense chart */}
      {(data.expenses || []).length > 0 && (() => {
        const byDay = {};
        (data.expenses || []).forEach((e) => { byDay[e.date] = (byDay[e.date] || 0) + (e.amount || 0); });
        const days = Object.entries(byDay).sort((a, b) => a[0].localeCompare(b[0]));
        const maxAmt = Math.max(...days.map(d => d[1]));
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        return (
          <Card style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 11, color: "#8892A4", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Gastos por día</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
              {days.map(([date, amt]) => {
                const d = new Date(date + "T12:00:00");
                const label = dayNames[d.getDay()] + " " + d.getDate();
                const pct = maxAmt > 0 ? (amt / maxAmt) * 100 : 0;
                return (
                  <div key={date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ fontSize: 9, color: "#00D4AA", fontWeight: 700 }}>${amt}</div>
                    <div style={{ width: "100%", maxWidth: 32, height: `${Math.max(pct, 8)}%`, background: "linear-gradient(180deg, #00D4AA, #00B4D8)", borderRadius: "4px 4px 0 0", transition: "height 0.5s", minHeight: 4 }} />
                    <div style={{ fontSize: 9, color: "#6B7280", whiteSpace: "nowrap" }}>{label}</div>
                  </div>
                );
              })}
            </div>
          </Card>
        );
      })()}

    </div>
  );
}

function FlightsSection({ data, updateData }) {
  const update = (id, field, val) => {
    const flights = (data.flights || []).map((f) => (f.id === id ? { ...f, [field]: val } : f));
    updateData({ ...data, flights });
  };

  const AIRLINE_IATA = {
    "latam": "LA", "lan": "LA", "aerolineas": "AR", "aerolineas argentinas": "AR",
    "american": "AA", "american airlines": "AA", "united": "UA", "united airlines": "UA",
    "delta": "DL", "delta airlines": "DL", "avianca": "AV", "copa": "CM", "copa airlines": "CM",
    "gol": "G3", "azul": "AD", "jetsmart": "JA", "flybondi": "FO",
    "iberia": "IB", "air europa": "UX", "british airways": "BA", "lufthansa": "LH",
    "air france": "AF", "klm": "KL", "emirates": "EK", "qatar": "QR", "qatar airways": "QR",
    "turkish": "TK", "turkish airlines": "TK", "tap": "TP", "tap portugal": "TP",
    "spirit": "NK", "frontier": "F9", "jetblue": "B6", "southwest": "WN",
    "sky": "H2", "sky airline": "H2", "volaris": "Y4", "viva": "VB",
  };

  const getFlightLink = (flight) => {
    if (!flight.flightNumber) return null;
    const num = (flight.flightNumber || '').replace(/\s/g, '');
    const airlineKey = (flight.airline || '').toLowerCase().trim();
    const iata = AIRLINE_IATA[airlineKey] || flight.airline?.replace(/\s/g, '') || '';
    const code = iata + num;
    return `https://www.google.com/search?q=${encodeURIComponent(code)}`;
  };

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>✈️ Vuelos</div>
      {(data.flights || []).map((flight) => {
        const flightLink = getFlightLink(flight);
        return (
        <Card key={flight.id} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF4", textTransform: "uppercase" }}>
              {flight.type === "ida" ? "🛫 Ida" : flight.type === "vuelta" ? "🛬 Vuelta" : "✈️ Interno"} — {flight.from} → {flight.to}
            </div>
            <select value={flight.status} onChange={(e) => update(flight.id, "status", e.target.value)}
              style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#E8ECF4", padding: "4px 8px", fontSize: 12 }}>
              <option value="pendiente">Pendiente</option>
              <option value="confirmado">Confirmado</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Aerolínea" value={flight.airline} onChange={(v) => update(flight.id, "airline", v)} />
            <Input label="Nro Vuelo" value={flight.flightNumber} onChange={(v) => update(flight.id, "flightNumber", v)} placeholder="1234" />
            <Input label="Fecha" value={flight.date} onChange={(v) => update(flight.id, "date", v)} type="date" />
            <Input label="Hora" value={flight.time} onChange={(v) => update(flight.id, "time", v)} type="time" />
          </div>
          <Input label="Código Confirmación" value={flight.confirmation} onChange={(v) => update(flight.id, "confirmation", v)} placeholder="ABC123" />
          <Input label="Notas" value={flight.notes} onChange={(v) => update(flight.id, "notes", v)} placeholder="Terminal, gate, etc." />
          {flightLink && (
            <a href={flightLink} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px", background: "rgba(0,180,216,0.08)", borderRadius: 10, textDecoration: "none", border: "1px solid rgba(0,180,216,0.15)", marginTop: 4 }}>
              <span style={{ fontSize: 14 }}>✈️</span>
              <span style={{ fontSize: 13, color: "#00B4D8", fontWeight: 600 }}>Ver estado del vuelo</span>
            </a>
          )}
        </Card>
        );
      })}
    </div>
  );
}

function HotelSection({ data, updateData }) {
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({ name: "", address: "", city: "", checkIn: "", checkOut: "", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const hotels = data.hotels || [];
  const viewHotel = hotels.find(h => h.id === viewing);

  const add = () => {
    if (!form.city && !form.name) return;
    updateData({ ...data, hotels: [...hotels, { ...form, id: Date.now().toString() }] });
    setForm({ name: "", address: "", city: "", checkIn: "", checkOut: "", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false });
    setAdding(false);
  };
  const remove = (id) => { updateData({ ...data, hotels: hotels.filter(h => h.id !== id) }); setViewing(null); setEditing(false); setConfirmDelete(false); };
  const startEdit = () => { if (!viewHotel) return; setEditForm({ ...viewHotel }); setEditing(true); setConfirmDelete(false); };
  const saveEdit = () => { if (!viewing) return; updateData({ ...data, hotels: hotels.map(h => h.id === viewing ? { ...h, ...editForm } : h) }); setEditing(false); };

  const totalCost = hotels.reduce((s, h) => s + (h.totalCost || 0), 0);

  // DETAIL VIEW
  if (viewHotel) {
    const nights = viewHotel.checkIn && viewHotel.checkOut ? Math.max(0, Math.ceil((new Date(viewHotel.checkOut) - new Date(viewHotel.checkIn)) / 86400000)) : 0;
    return (
      <div>
        <button onClick={() => { setViewing(null); setEditing(false); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#00D4AA", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 16px" }}>← Alojamientos</button>
        <Card>
          {!editing ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <StatusBadge status={viewHotel.confirmation ? "confirmado" : "pendiente"} />
                {nights > 0 && <span style={{ fontSize: 13, color: "#8892A4" }}>{nights} noches</span>}
              </div>
              <div style={{ fontSize: 11, color: "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>📍 {viewHotel.city}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#E8ECF4", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>{viewHotel.name || "Sin nombre"}</div>
              {viewHotel.address && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Dirección</div><div style={{ fontSize: 14, color: "#C8CDD8" }}>{viewHotel.address}</div></div>}
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Check-in</div><div style={{ fontSize: 14, color: "#E8ECF4", fontWeight: 600 }}>{viewHotel.checkIn}</div></div>
                <div><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Check-out</div><div style={{ fontSize: 14, color: "#E8ECF4", fontWeight: 600 }}>{viewHotel.checkOut}</div></div>
              </div>
              {viewHotel.confirmation && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Confirmación</div><div style={{ fontSize: 15, color: "#00D4AA", fontWeight: 700 }}>🔑 {viewHotel.confirmation}</div></div>}
              {viewHotel.totalCost > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Costo</div><div style={{ fontSize: 15, color: "#E8ECF4", fontWeight: 700 }}>${viewHotel.totalCost} {viewHotel.paid ? "✅ Pagado" : "⏳ Pendiente"}</div></div>}
              {viewHotel.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notas</div><div style={{ fontSize: 14, color: "#C8CDD8" }}>{viewHotel.notes}</div></div>}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                <Btn onClick={startEdit} variant="secondary" small style={{ flex: 1 }}>✏️ Editar</Btn>
                {!confirmDelete ? <Btn onClick={() => setConfirmDelete(true)} variant="danger" small style={{ flex: 1 }}>🗑 Borrar</Btn> : <Btn onClick={() => remove(viewHotel.id)} variant="danger" small style={{ flex: 1, background: "rgba(255,107,107,0.3)" }}>¿Seguro? Confirmar</Btn>}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Editar alojamiento</div>
              <Input label="Ciudad" value={editForm.city} onChange={(v) => setEditForm({ ...editForm, city: v })} placeholder="NYC, Las Vegas, etc." />
              <Input label="Nombre" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} placeholder="Hotel, Airbnb, etc." />
              <Input label="Dirección" value={editForm.address} onChange={(v) => setEditForm({ ...editForm, address: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Check-in" value={editForm.checkIn} onChange={(v) => setEditForm({ ...editForm, checkIn: v })} type="date" />
                <Input label="Check-out" value={editForm.checkOut} onChange={(v) => setEditForm({ ...editForm, checkOut: v })} type="date" />
              </div>
              <Input label="Confirmación" value={editForm.confirmation} onChange={(v) => setEditForm({ ...editForm, confirmation: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Costo (USD)" value={editForm.totalCost} onChange={(v) => setEditForm({ ...editForm, totalCost: parseFloat(v) || 0 })} type="number" />
                <div style={{ display: "flex", alignItems: "end", paddingBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={editForm.paid || false} onChange={(e) => setEditForm({ ...editForm, paid: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#00D4AA" }} /><span style={{ fontSize: 13, color: "#E8ECF4" }}>Pagado</span></label>
                </div>
              </div>
              <Input label="Notas" value={editForm.notes} onChange={(v) => setEditForm({ ...editForm, notes: v })} />
              <div style={{ display: "flex", gap: 8 }}><Btn onClick={saveEdit} small style={{ flex: 1 }}>✓ Guardar</Btn><Btn onClick={() => setEditing(false)} variant="secondary" small>Cancelar</Btn></div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>🏠 Alojamientos</div>
        <Btn onClick={() => setAdding(!adding)} small>{adding ? "✕ Cerrar" : "+ Agregar"}</Btn>
      </div>

      {totalCost > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8892A4" }}>{hotels.length} alojamientos</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#00D4AA" }}>${totalCost.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 14, borderColor: "rgba(0,212,170,0.2)" }}>
          <Input label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="NYC, Las Vegas, etc." />
          <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Hotel, Airbnb, etc." />
          <Input label="Dirección" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Check-in" value={form.checkIn} onChange={(v) => setForm({ ...form, checkIn: v })} type="date" />
            <Input label="Check-out" value={form.checkOut} onChange={(v) => setForm({ ...form, checkOut: v })} type="date" />
          </div>
          <Input label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <Btn onClick={add} style={{ width: "100%" }}>Guardar Alojamiento</Btn>
        </Card>
      )}

      {hotels.length === 0 && !adding && (
        <Card style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 40, marginBottom: 10 }}>🏠</div><div style={{ fontSize: 14, color: "#8892A4" }}>Agregá tus alojamientos</div></Card>
      )}

      {hotels.map(h => {
        const nights = h.checkIn && h.checkOut ? Math.max(0, Math.ceil((new Date(h.checkOut) - new Date(h.checkIn)) / 86400000)) : 0;
        return (
          <Card key={h.id} onClick={() => { setViewing(h.id); setAdding(false); }} style={{ marginBottom: 8, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(96,165,250,0.12)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 18 }}>🏠</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{h.city || h.name || "Sin nombre"}</div>
                <div style={{ fontSize: 11, color: "#8892A4", marginTop: 2 }}>{nights} noches · {h.checkIn?.slice(5)} → {h.checkOut?.slice(5)}{h.confirmation ? " · ✅" : ""}</div>
              </div>
              <span style={{ color: "#4B5563", fontSize: 14, flexShrink: 0 }}>›</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function CarSection({ data, updateData }) {
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState({ company: "", city: "", pickUp: "", dropOff: "", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const cars = data.cars || [];
  const viewCar = cars.find(c => c.id === viewing);

  const add = () => {
    if (!form.city && !form.company) return;
    updateData({ ...data, cars: [...cars, { ...form, id: Date.now().toString() }] });
    setForm({ company: "", city: "", pickUp: "", dropOff: "", confirmation: "", totalCost: 0, currency: "USD", notes: "", paid: false });
    setAdding(false);
  };
  const remove = (id) => { updateData({ ...data, cars: cars.filter(c => c.id !== id) }); setViewing(null); setEditing(false); setConfirmDelete(false); };
  const startEdit = () => { if (!viewCar) return; setEditForm({ ...viewCar }); setEditing(true); setConfirmDelete(false); };
  const saveEdit = () => { if (!viewing) return; updateData({ ...data, cars: cars.map(c => c.id === viewing ? { ...c, ...editForm } : c) }); setEditing(false); };

  const totalCost = cars.reduce((s, c) => s + (c.totalCost || 0), 0);

  // DETAIL VIEW
  if (viewCar) {
    const days = viewCar.pickUp && viewCar.dropOff ? Math.max(0, Math.ceil((new Date(viewCar.dropOff) - new Date(viewCar.pickUp)) / 86400000)) : 0;
    return (
      <div>
        <button onClick={() => { setViewing(null); setEditing(false); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#00D4AA", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 16px" }}>← Autos</button>
        <Card>
          {!editing ? (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <StatusBadge status={viewCar.confirmation ? "confirmado" : "pendiente"} />
                {days > 0 && <span style={{ fontSize: 13, color: "#8892A4" }}>{days} días</span>}
              </div>
              <div style={{ fontSize: 11, color: "#34D399", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>📍 {viewCar.city}</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#E8ECF4", marginBottom: 16, fontFamily: "'Playfair Display', serif" }}>{viewCar.company || "Sin compañía"}</div>
              <div style={{ display: "flex", gap: 16, marginBottom: 12 }}>
                <div><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Pick-up</div><div style={{ fontSize: 14, color: "#E8ECF4", fontWeight: 600 }}>{viewCar.pickUp}</div></div>
                <div><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Drop-off</div><div style={{ fontSize: 14, color: "#E8ECF4", fontWeight: 600 }}>{viewCar.dropOff}</div></div>
              </div>
              {viewCar.confirmation && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Confirmación</div><div style={{ fontSize: 15, color: "#00D4AA", fontWeight: 700 }}>🔑 {viewCar.confirmation}</div></div>}
              {viewCar.totalCost > 0 && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Costo</div><div style={{ fontSize: 15, color: "#E8ECF4", fontWeight: 700 }}>${viewCar.totalCost} {viewCar.paid ? "✅ Pagado" : "⏳ Pendiente"}</div></div>}
              {viewCar.notes && <div style={{ marginBottom: 12 }}><div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notas</div><div style={{ fontSize: 14, color: "#C8CDD8" }}>{viewCar.notes}</div></div>}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                <Btn onClick={startEdit} variant="secondary" small style={{ flex: 1 }}>✏️ Editar</Btn>
                {!confirmDelete ? <Btn onClick={() => setConfirmDelete(true)} variant="danger" small style={{ flex: 1 }}>🗑 Borrar</Btn> : <Btn onClick={() => remove(viewCar.id)} variant="danger" small style={{ flex: 1, background: "rgba(255,107,107,0.3)" }}>¿Seguro? Confirmar</Btn>}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 11, color: "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Editar auto</div>
              <Input label="Ciudad" value={editForm.city} onChange={(v) => setEditForm({ ...editForm, city: v })} placeholder="Las Vegas, Orlando, etc." />
              <Input label="Compañía" value={editForm.company} onChange={(v) => setEditForm({ ...editForm, company: v })} placeholder="Hertz, Avis, etc." />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Pick-up" value={editForm.pickUp} onChange={(v) => setEditForm({ ...editForm, pickUp: v })} type="date" />
                <Input label="Drop-off" value={editForm.dropOff} onChange={(v) => setEditForm({ ...editForm, dropOff: v })} type="date" />
              </div>
              <Input label="Confirmación" value={editForm.confirmation} onChange={(v) => setEditForm({ ...editForm, confirmation: v })} />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Costo (USD)" value={editForm.totalCost} onChange={(v) => setEditForm({ ...editForm, totalCost: parseFloat(v) || 0 })} type="number" />
                <div style={{ display: "flex", alignItems: "end", paddingBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}><input type="checkbox" checked={editForm.paid || false} onChange={(e) => setEditForm({ ...editForm, paid: e.target.checked })} style={{ width: 18, height: 18, accentColor: "#00D4AA" }} /><span style={{ fontSize: 13, color: "#E8ECF4" }}>Pagado</span></label>
                </div>
              </div>
              <Input label="Notas" value={editForm.notes} onChange={(v) => setEditForm({ ...editForm, notes: v })} />
              <div style={{ display: "flex", gap: 8 }}><Btn onClick={saveEdit} small style={{ flex: 1 }}>✓ Guardar</Btn><Btn onClick={() => setEditing(false)} variant="secondary" small>Cancelar</Btn></div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // LIST VIEW
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>🚘 Autos Rental</div>
        <Btn onClick={() => setAdding(!adding)} small>{adding ? "✕ Cerrar" : "+ Agregar"}</Btn>
      </div>

      {totalCost > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#8892A4" }}>{cars.length} autos</span>
            <span style={{ fontSize: 16, fontWeight: 800, color: "#00D4AA" }}>${totalCost.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 14, borderColor: "rgba(0,212,170,0.2)" }}>
          <Input label="Ciudad" value={form.city} onChange={(v) => setForm({ ...form, city: v })} placeholder="Las Vegas, Orlando, etc." />
          <Input label="Compañía" value={form.company} onChange={(v) => setForm({ ...form, company: v })} placeholder="Hertz, Avis, etc." />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Pick-up" value={form.pickUp} onChange={(v) => setForm({ ...form, pickUp: v })} type="date" />
            <Input label="Drop-off" value={form.dropOff} onChange={(v) => setForm({ ...form, dropOff: v })} type="date" />
          </div>
          <Input label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <Btn onClick={add} style={{ width: "100%" }}>Guardar Auto</Btn>
        </Card>
      )}

      {cars.length === 0 && !adding && (
        <Card style={{ textAlign: "center", padding: 40 }}><div style={{ fontSize: 40, marginBottom: 10 }}>🚘</div><div style={{ fontSize: 14, color: "#8892A4" }}>Agregá tus autos rental</div></Card>
      )}

      {cars.map(c => {
        const days = c.pickUp && c.dropOff ? Math.max(0, Math.ceil((new Date(c.dropOff) - new Date(c.pickUp)) / 86400000)) : 0;
        return (
          <Card key={c.id} onClick={() => { setViewing(c.id); setAdding(false); }} style={{ marginBottom: 8, padding: 14, cursor: "pointer" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(52,211,153,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 18 }}>🚘</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.city || c.company || "Sin nombre"}</div>
                <div style={{ fontSize: 11, color: "#8892A4", marginTop: 2 }}>{days} días · {c.pickUp?.slice(5)} → {c.dropOff?.slice(5)}{c.confirmation ? " · ✅" : ""}</div>
              </div>
              <span style={{ color: "#4B5563", fontSize: 14, flexShrink: 0 }}>›</span>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

function ExpensesSection({ data, updateData }) {
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ description: "", amount: "", category: "food", payment: "visa", bank: "galicia", date: getUSToday(), notes: "" });

  const sendToSheets = async (expense) => {
    if (!SHEETS_URL || SHEETS_URL === "TU_APPS_SCRIPT_URL") return;
    try {
      const cat = CATEGORIES.find(c => c.id === expense.category);
      const pm = PAYMENT_METHODS.find(p => p.id === expense.payment);
      const bank = BANKS.find(b => b.id === expense.bank);
      await fetch(SHEETS_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fecha: expense.date,
          descripcion: expense.description,
          monto: expense.amount,
          categoria: cat?.label || expense.category,
          pago: pm?.label || expense.payment,
          banco: (expense.payment !== "cash" && bank) ? bank.label : "-",
          notas: expense.notes || "",
        }),
      });
    } catch (err) {
      console.error("Error enviando a Sheets:", err);
    }
  };

  const addExpense = () => {
    if (!form.description || !form.amount) return;
    const expense = { ...form, id: Date.now().toString(), amount: parseFloat(form.amount), createdAt: new Date().toISOString() };
    updateData({ ...data, expenses: [expense, ...(data.expenses || [])] });
    sendToSheets(expense);
    setForm({ description: "", amount: "", category: "food", payment: "visa", bank: "galicia", date: getUSToday(), notes: "" });
    setAdding(false);
  };

  const deleteExpense = (id) => updateData({ ...data, expenses: (data.expenses || []).filter((e) => e.id !== id) });

  const expenses = data.expenses || [];
  const totalByCategory = {};
  expenses.forEach((e) => { totalByCategory[e.category] = (totalByCategory[e.category] || 0) + e.amount; });
  const total = expenses.reduce((s, e) => s + e.amount, 0);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>💰 Gastos</div>
        <Btn onClick={() => setAdding(!adding)} small>{adding ? "✕ Cerrar" : "+ Agregar"}</Btn>
      </div>

      {total > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {Object.entries(totalByCategory).sort((a, b) => b[1] - a[1]).map(([cat, amt]) => {
              const catInfo = CATEGORIES.find((c) => c.id === cat);
              return <div key={cat} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", background: `${catInfo?.color || "#9CA3AF"}15`, borderRadius: 20, fontSize: 12, color: catInfo?.color || "#9CA3AF", fontWeight: 600 }}>{catInfo?.icon} ${amt.toLocaleString()}</div>;
            })}
          </div>
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, color: "#8892A4" }}>Total</span>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#00D4AA" }}>${total.toLocaleString()}</span>
          </div>
        </Card>
      )}

      {adding && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(0,212,170,0.2)" }}>
          <Input label="Descripción" value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder="¿En qué gastaste?" />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Monto (USD)" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} type="number" placeholder="0.00" />
            <Input label="Fecha" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Categoría</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {CATEGORIES.map((cat) => (
                <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id })} style={{ padding: "6px 12px", borderRadius: 20, border: form.category === cat.id ? `2px solid ${cat.color}` : "1px solid rgba(255,255,255,0.1)", background: form.category === cat.id ? `${cat.color}20` : "transparent", color: form.category === cat.id ? cat.color : "#8892A4", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Medio de pago</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {PAYMENT_METHODS.map((pm) => (
                <button key={pm.id} onClick={() => setForm({ ...form, payment: pm.id })} style={{ padding: "6px 12px", borderRadius: 20, border: form.payment === pm.id ? `2px solid ${pm.color}` : "1px solid rgba(255,255,255,0.1)", background: form.payment === pm.id ? `${pm.color}25` : "transparent", color: form.payment === pm.id ? "#E8ECF4" : "#8892A4", fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                  <ColorDot color={pm.color} /> {pm.label}
                </button>
              ))}
            </div>
          </div>
          {form.payment !== "cash" && (
            <div style={{ marginBottom: 14 }}>
              <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Banco</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {BANKS.map((bank) => (
                  <button key={bank.id} onClick={() => setForm({ ...form, bank: bank.id })} style={{ padding: "6px 12px", borderRadius: 20, border: form.bank === bank.id ? `2px solid ${bank.color}` : "1px solid rgba(255,255,255,0.1)", background: form.bank === bank.id ? `${bank.color}25` : "transparent", color: form.bank === bank.id ? "#E8ECF4" : "#8892A4", fontSize: 12, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}>
                    <ColorDot color={bank.color} /> {bank.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Input label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Opcional" />
          <Btn onClick={addExpense} style={{ width: "100%" }}>Guardar Gasto</Btn>
        </Card>
      )}

      {expenses.length === 0 && !adding && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>💸</div>
          <div style={{ fontSize: 14, color: "#8892A4" }}>Sin gastos aún. ¡Empezá a trackear!</div>
        </Card>
      )}

      {/* Expenses grouped by day */}
      {expenses.length > 0 && (() => {
        const byDay = {};
        expenses.forEach(exp => {
          if (!byDay[exp.date]) byDay[exp.date] = [];
          byDay[exp.date].push(exp);
        });
        const sortedDays = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]));
        const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

        return sortedDays.map(([date, dayExpenses]) => {
          const dayTotal = dayExpenses.reduce((s, e) => s + e.amount, 0);
          const d = new Date(date + "T12:00:00");
          const label = dayNames[d.getDay()] + " " + d.getDate() + "/" + (d.getMonth() + 1);
          const miamiToday = getUSToday();
          const isToday = date === miamiToday;

          return (
            <div key={date} style={{ marginBottom: 16 }}>
              {/* Day header with subtotal */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, padding: "0 2px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {isToday && <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00D4AA", animation: "pulse 1.5s infinite", flexShrink: 0 }} />}
                  <span style={{ fontSize: 12, color: isToday ? "#00D4AA" : "#8892A4", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                    {isToday ? "Hoy" : label}
                  </span>
                  {isToday && <span style={{ fontSize: 11, color: "#6B7280", fontWeight: 500 }}>({label})</span>}
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#E8ECF4" }}>${dayTotal.toLocaleString()}</span>
              </div>
              {/* Day expenses */}
              {dayExpenses.map(exp => {
                const cat = CATEGORIES.find((c) => c.id === exp.category);
                const pm = PAYMENT_METHODS.find((p) => p.id === exp.payment);
                const bank = BANKS.find((b) => b.id === exp.bank);
                const payLabel = pm?.label || exp.payment;
                const bankLabel = (exp.payment !== "cash" && bank) ? ` · ${bank.label}` : "";
                return (
                  <Card key={exp.id} style={{ marginBottom: 6, padding: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div style={{ display: "flex", gap: 10, alignItems: "center", flex: 1 }}>
                        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat?.color || "#9CA3AF"}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>{cat?.icon || "📦"}</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 600, color: "#E8ECF4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.description}</div>
                          <div style={{ fontSize: 11, color: "#8892A4", marginTop: 2 }}>{payLabel}{bankLabel}</div>
                        </div>
                      </div>
                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: 15, fontWeight: 800, color: "#E8ECF4" }}>${exp.amount?.toLocaleString()}</div>
                        <button onClick={() => deleteExpense(exp.id)} style={{ background: "none", border: "none", color: "#FF6B6B", fontSize: 11, cursor: "pointer", padding: "2px 0", opacity: 0.6 }}>eliminar</button>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          );
        });
      })()}
    </div>
  );
}

const DOC_CATEGORIES = [
  { id: "boarding", label: "Vuelos", icon: "🛫", color: "#F472B6" },
  { id: "airbnb", label: "Airbnb", icon: "🏡", color: "#FF5A5F" },
  { id: "car", label: "Auto Rental", icon: "🚘", color: "#34D399" },
  { id: "insurance", label: "Seguro", icon: "🛡️", color: "#60A5FA" },
  { id: "ticket", label: "Ticket Evento", icon: "🎫", color: "#A78BFA" },
  { id: "other", label: "Otro", icon: "📄", color: "#9CA3AF" },
];

function DocumentsSection({ data, updateData }) {
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null); // doc id being viewed
  const [editing, setEditing] = useState(false); // editing mode within detail
  const [editForm, setEditForm] = useState({ name: "", url: "", category: "boarding", confirmation: "", notes: "" });
  const [form, setForm] = useState({ name: "", url: "", category: "boarding", confirmation: "", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const docs = data.documents || [];
  const viewDoc = docs.find(d => d.id === viewing);

  const add = () => {
    if (!form.name) return;
    updateData({ ...data, documents: [...docs, { ...form, id: Date.now().toString() }] });
    setForm({ name: "", url: "", category: "boarding", confirmation: "", notes: "" });
    setAdding(false);
  };
  const remove = (id) => {
    updateData({ ...data, documents: docs.filter(d => d.id !== id) });
    setViewing(null);
    setEditing(false);
    setConfirmDelete(false);
  };
  const openDetail = (doc) => {
    setViewing(doc.id);
    setEditing(false);
    setConfirmDelete(false);
    setAdding(false);
  };
  const startEdit = () => {
    if (!viewDoc) return;
    setEditForm({ name: viewDoc.name || "", url: viewDoc.url || "", category: viewDoc.category || "boarding", confirmation: viewDoc.confirmation || "", notes: viewDoc.notes || "" });
    setEditing(true);
    setConfirmDelete(false);
  };
  const saveEdit = () => {
    if (!viewing) return;
    const updated = docs.map(d => d.id === viewing ? { ...d, ...editForm } : d);
    updateData({ ...data, documents: updated });
    setEditing(false);
  };
  const goBack = () => {
    setViewing(null);
    setEditing(false);
    setConfirmDelete(false);
  };

  const grouped = {};
  DOC_CATEGORIES.forEach(c => { grouped[c.id] = docs.filter(d => d.category === c.id); });

  // ===== DETAIL VIEW =====
  if (viewDoc) {
    const cat = DOC_CATEGORIES.find(c => c.id === viewDoc.category);
    return (
      <div>
        {/* Back button */}
        <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#00D4AA", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 16px", letterSpacing: 0.3 }}>
          ← Documentos
        </button>

        <Card style={{ borderColor: `${cat?.color || "#9CA3AF"}30` }}>
          {/* Category badge */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: `${cat?.color || "#9CA3AF"}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>
              {cat?.icon || "📄"}
            </div>
            <span style={{ fontSize: 11, color: cat?.color || "#9CA3AF", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{cat?.label || "Documento"}</span>
          </div>

          {!editing ? (
            <>
              {/* Detail view */}
              <div style={{ fontSize: 18, fontWeight: 700, color: "#E8ECF4", marginBottom: 16 }}>{viewDoc.name}</div>

              {viewDoc.confirmation && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Código confirmación</div>
                  <div style={{ fontSize: 15, color: "#00D4AA", fontWeight: 700, letterSpacing: 0.5 }}>🔑 {viewDoc.confirmation}</div>
                </div>
              )}

              {viewDoc.url && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>Link</div>
                  <a href={viewDoc.url} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 14px", background: "rgba(0,180,216,0.08)", borderRadius: 10, textDecoration: "none", border: "1px solid rgba(0,180,216,0.15)", transition: "all 0.2s" }}>
                    <span style={{ fontSize: 16 }}>🔗</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, color: "#00B4D8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewDoc.url.replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</div>
                      <div style={{ fontSize: 11, color: "#6B7280", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{viewDoc.url}</div>
                    </div>
                    <span style={{ color: "#00B4D8", fontSize: 13, flexShrink: 0 }}>↗</span>
                  </a>
                </div>
              )}

              {viewDoc.notes && (
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notas</div>
                  <div style={{ fontSize: 14, color: "#C8CDD8", lineHeight: 1.5 }}>{viewDoc.notes}</div>
                </div>
              )}

              {/* Action buttons at bottom */}
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", gap: 8 }}>
                <Btn onClick={startEdit} variant="secondary" small style={{ flex: 1 }}>✏️ Editar</Btn>
                {!confirmDelete ? (
                  <Btn onClick={() => setConfirmDelete(true)} variant="danger" small style={{ flex: 1 }}>🗑 Borrar</Btn>
                ) : (
                  <Btn onClick={() => remove(viewDoc.id)} variant="danger" small style={{ flex: 1, background: "rgba(255,107,107,0.3)" }}>¿Seguro? Confirmar</Btn>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Edit form */}
              <div style={{ marginTop: 4 }}>
                <Input label="Nombre" value={editForm.name} onChange={(v) => setEditForm({ ...editForm, name: v })} placeholder="Ej: Boarding Pass ida" />
                <Input label="Link (Google Drive, email, web)" value={editForm.url} onChange={(v) => setEditForm({ ...editForm, url: v })} placeholder="https://..." />
                <Input label="Código confirmación" value={editForm.confirmation} onChange={(v) => setEditForm({ ...editForm, confirmation: v })} placeholder="ABC123 (opcional)" />
                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Categoría</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {DOC_CATEGORIES.map(c => (
                      <button key={c.id} onClick={() => setEditForm({ ...editForm, category: c.id })} style={{ padding: "6px 12px", borderRadius: 20, border: editForm.category === c.id ? `2px solid ${c.color}` : "1px solid rgba(255,255,255,0.1)", background: editForm.category === c.id ? `${c.color}20` : "transparent", color: editForm.category === c.id ? c.color : "#8892A4", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                        {c.icon} {c.label}
                      </button>
                    ))}
                  </div>
                </div>
                <Input label="Notas" value={editForm.notes} onChange={(v) => setEditForm({ ...editForm, notes: v })} placeholder="Opcional" />
                <div style={{ display: "flex", gap: 8 }}>
                  <Btn onClick={saveEdit} small style={{ flex: 1 }}>✓ Guardar</Btn>
                  <Btn onClick={() => setEditing(false)} variant="secondary" small>Cancelar</Btn>
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>📁 Documentos</div>
        <Btn onClick={() => setAdding(!adding)} small>{adding ? "✕ Cerrar" : "+ Agregar"}</Btn>
      </div>

      {adding && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(0,212,170,0.2)" }}>
          <Input label="Nombre" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Ej: Boarding Pass ida, Reserva Airbnb" />
          <Input label="Link (Google Drive, email, web)" value={form.url} onChange={(v) => setForm({ ...form, url: v })} placeholder="https://..." />
          <Input label="Código confirmación" value={form.confirmation} onChange={(v) => setForm({ ...form, confirmation: v })} placeholder="ABC123 (opcional)" />
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 8, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Categoría</label>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {DOC_CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setForm({ ...form, category: cat.id })} style={{ padding: "6px 12px", borderRadius: 20, border: form.category === cat.id ? `2px solid ${cat.color}` : "1px solid rgba(255,255,255,0.1)", background: form.category === cat.id ? `${cat.color}20` : "transparent", color: form.category === cat.id ? cat.color : "#8892A4", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          </div>
          <Input label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} placeholder="Opcional" />
          <Btn onClick={add} style={{ width: "100%" }}>Guardar Documento</Btn>
        </Card>
      )}

      {docs.length === 0 && !adding && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>📁</div>
          <div style={{ fontSize: 14, color: "#8892A4" }}>Guardá links a tus confirmaciones y documentos</div>
          <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>Subí los PDFs a Google Drive y pegá el link acá</div>
        </Card>
      )}

      {DOC_CATEGORIES.map(cat => {
        const catDocs = grouped[cat.id];
        if (!catDocs || catDocs.length === 0) return null;
        return (
          <div key={cat.id} style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: cat.color, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
              {cat.icon} {cat.label}
            </div>
            {catDocs.map(doc => (
              <Card key={doc.id} onClick={() => openDetail(doc)} style={{ marginBottom: 8, padding: 14, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#E8ECF4", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{doc.name}</div>
                    {doc.confirmation && (
                      <div style={{ fontSize: 11, color: "#00D4AA", fontWeight: 600, marginTop: 3 }}>🔑 {doc.confirmation}</div>
                    )}
                  </div>
                  <span style={{ color: "#4B5563", fontSize: 14, flexShrink: 0 }}>›</span>
                </div>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ItinerarySection({ data, updateData }) {
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ date: "", title: "", activities: "", notes: "" });
  const [form, setForm] = useState({ date: "", title: "", activities: "", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(false);

  const itinerary = data.itinerary || [];
  const viewDay = itinerary.find(d => d.id === viewing);

  const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const today = getUSToday();

  const add = () => {
    if (!form.date || !form.title) return;
    const item = { ...form, id: Date.now().toString() };
    updateData({ ...data, itinerary: [...itinerary, item].sort((a, b) => a.date.localeCompare(b.date)) });
    setForm({ date: "", title: "", activities: "", notes: "" });
    setAdding(false);
  };
  const remove = (id) => {
    updateData({ ...data, itinerary: itinerary.filter(i => i.id !== id) });
    setViewing(null);
    setEditing(false);
    setConfirmDelete(false);
  };
  const openDetail = (day) => {
    setViewing(day.id);
    setEditing(false);
    setConfirmDelete(false);
    setAdding(false);
  };
  const startEdit = () => {
    if (!viewDay) return;
    setEditForm({ date: viewDay.date || "", title: viewDay.title || "", activities: viewDay.activities || "", notes: viewDay.notes || "" });
    setEditing(true);
    setConfirmDelete(false);
  };
  const saveEdit = () => {
    if (!viewing) return;
    const updated = itinerary.map(d => d.id === viewing ? { ...d, ...editForm } : d).sort((a, b) => a.date.localeCompare(b.date));
    updateData({ ...data, itinerary: updated });
    setEditing(false);
  };
  const goBack = () => {
    setViewing(null);
    setEditing(false);
    setConfirmDelete(false);
  };

  // Helper to render activity lines with clickable URLs
  const renderActivities = (activities) => {
    if (!activities) return null;
    return activities.split("\n").filter(Boolean).map((act, i) => {
      const urlMatch = act.match(/(https?:\/\/[^\s]+)/);
      if (urlMatch) {
        const parts = act.split(urlMatch[0]);
        return (
          <div key={i} style={{ fontSize: 14, color: "#C8CDD8", padding: "5px 0", display: "flex", gap: 10, lineHeight: 1.5 }}>
            <span style={{ color: "#00D4AA", flexShrink: 0, marginTop: 1 }}>›</span>
            <span>{parts[0]}<a href={urlMatch[0]} target="_blank" rel="noopener noreferrer" style={{ color: "#00B4D8", textDecoration: "none", fontWeight: 600 }}>{urlMatch[0].replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</a>{parts[1]}</span>
          </div>
        );
      }
      return (
        <div key={i} style={{ fontSize: 14, color: "#C8CDD8", padding: "5px 0", display: "flex", gap: 10, lineHeight: 1.5 }}>
          <span style={{ color: "#00D4AA", flexShrink: 0, marginTop: 1 }}>›</span>{act}
        </div>
      );
    });
  };

  // ===== DETAIL VIEW =====
  if (viewDay) {
    const d = viewDay.date ? new Date(viewDay.date + "T12:00:00") : null;
    const dayLabel = d ? dayNames[d.getDay()] : "";
    const dayIdx = itinerary.findIndex(i => i.id === viewDay.id);
    const isToday = viewDay.date === today;

    // Navigation between days
    const prevDay = dayIdx > 0 ? itinerary[dayIdx - 1] : null;
    const nextDay = dayIdx < itinerary.length - 1 ? itinerary[dayIdx + 1] : null;

    return (
      <div>
        {/* Back button */}
        <button onClick={goBack} style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", color: "#00D4AA", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: "0 0 16px", letterSpacing: 0.3 }}>
          ← Itinerario
        </button>

        <Card style={{ borderColor: isToday ? "rgba(0,212,170,0.4)" : viewDay.city ? `${getCityStyle(viewDay.city).accent}35` : undefined, background: isToday ? "rgba(0,212,170,0.04)" : viewDay.city ? `${getCityStyle(viewDay.city).bg}30` : undefined }}>
          {isToday && (
            <div style={{ fontSize: 10, color: "#00D4AA", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, marginBottom: 12, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: 3, background: "#00D4AA", animation: "pulse 1.5s infinite" }} /> Hoy
            </div>
          )}

          {!editing ? (
            <>
              {/* Day header */}
              <div style={{ fontSize: 11, color: viewDay.city ? getCityStyle(viewDay.city).accent : "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>
                {viewDay.city ? getCityStyle(viewDay.city).label : ""} — {dayLabel} {viewDay.date?.slice(5)} · Día {dayIdx + 1}
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#E8ECF4", marginBottom: 18, fontFamily: "'Playfair Display', serif" }}>{viewDay.title}</div>

              {/* Activities */}
              {viewDay.activities && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>Actividades</div>
                  {renderActivities(viewDay.activities)}
                </div>
              )}

              {/* Notes */}
              {viewDay.notes && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, color: "#8892A4", fontWeight: 600, textTransform: "uppercase", letterSpacing: 1, marginBottom: 4 }}>Notas</div>
                  <div style={{ fontSize: 14, color: "#C8CDD8", lineHeight: 1.5, fontStyle: "italic" }}>{viewDay.notes}</div>
                </div>
              )}

              {/* Day navigation */}
              <div style={{ display: "flex", gap: 8, marginTop: 16, paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                {prevDay ? (
                  <button onClick={() => openDetail(prevDay)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#8892A4", fontSize: 12 }}>
                    <span>←</span>
                    <div style={{ textAlign: "left", minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Día {dayIdx}</div>
                      <div style={{ fontSize: 12, color: "#C8CDD8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{prevDay.title}</div>
                    </div>
                  </button>
                ) : <div style={{ flex: 1 }} />}
                {nextDay ? (
                  <button onClick={() => openDetail(nextDay)} style={{ flex: 1, display: "flex", alignItems: "center", gap: 6, padding: "10px 12px", background: "rgba(255,255,255,0.04)", borderRadius: 10, border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer", color: "#8892A4", fontSize: 12 }}>
                    <div style={{ textAlign: "right", minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase" }}>Día {dayIdx + 2}</div>
                      <div style={{ fontSize: 12, color: "#C8CDD8", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{nextDay.title}</div>
                    </div>
                    <span>→</span>
                  </button>
                ) : <div style={{ flex: 1 }} />}
              </div>

              {/* Action buttons */}
              <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <Btn onClick={startEdit} variant="secondary" small style={{ flex: 1 }}>✏️ Editar</Btn>
                {!confirmDelete ? (
                  <Btn onClick={() => setConfirmDelete(true)} variant="danger" small style={{ flex: 1 }}>🗑 Borrar</Btn>
                ) : (
                  <Btn onClick={() => remove(viewDay.id)} variant="danger" small style={{ flex: 1, background: "rgba(255,107,107,0.3)" }}>¿Seguro? Confirmar</Btn>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Edit form */}
              <div style={{ fontSize: 11, color: "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>Editar día</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Fecha" value={editForm.date} onChange={(v) => setEditForm({ ...editForm, date: v })} type="date" />
                <Input label="Título" value={editForm.title} onChange={(v) => setEditForm({ ...editForm, title: v })} />
              </div>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Actividades (una por línea)</label>
                <textarea value={editForm.activities} onChange={(e) => setEditForm({ ...editForm, activities: e.target.value })} rows={6}
                  style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#E8ECF4", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
              </div>
              <Input label="Notas" value={editForm.notes} onChange={(v) => setEditForm({ ...editForm, notes: v })} />
              <div style={{ display: "flex", gap: 8 }}>
                <Btn onClick={saveEdit} small style={{ flex: 1 }}>✓ Guardar</Btn>
                <Btn onClick={() => setEditing(false)} variant="secondary" small>Cancelar</Btn>
              </div>
            </>
          )}
        </Card>
      </div>
    );
  }

  // ===== LIST VIEW =====
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>📋 Itinerario</div>
        <Btn onClick={() => setAdding(!adding)} small>{adding ? "✕ Cerrar" : "+ Agregar día"}</Btn>
      </div>

      {adding && (
        <Card style={{ marginBottom: 16, borderColor: "rgba(0,212,170,0.2)" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Fecha" value={form.date} onChange={(v) => setForm({ ...form, date: v })} type="date" />
            <Input label="Título del día" value={form.title} onChange={(v) => setForm({ ...form, title: v })} placeholder="Ej: South Beach" />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 11, color: "#8892A4", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>Actividades (una por línea)</label>
            <textarea value={form.activities} onChange={(e) => setForm({ ...form, activities: e.target.value })} placeholder={"9:00 - Desayuno\n11:00 - South Beach\n13:00 - Almuerzo\n16:00 - Wynwood Walls"} rows={5}
              style={{ width: "100%", padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#E8ECF4", fontSize: 13, outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.6 }} />
          </div>
          <Input label="Notas" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <Btn onClick={add} style={{ width: "100%" }}>Guardar Día</Btn>
        </Card>
      )}

      {itinerary.length === 0 && !adding && (
        <Card style={{ textAlign: "center", padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🗓️</div>
          <div style={{ fontSize: 14, color: "#8892A4" }}>Planificá tu itinerario día por día</div>
        </Card>
      )}

      {itinerary.map((day, idx) => {
        const d = day.date ? new Date(day.date + "T12:00:00") : null;
        const dayLabel = d ? dayNames[d.getDay()] : "";
        const isToday = day.date === today;

        return (
          <Card key={day.id} onClick={() => openDetail(day)} style={{ marginBottom: 10, padding: 14, cursor: "pointer", borderColor: isToday ? "rgba(0,212,170,0.4)" : day.city ? `${getCityStyle(day.city).accent}30` : undefined, background: isToday ? "rgba(0,212,170,0.06)" : day.city ? `${getCityStyle(day.city).bg}40` : undefined }}>
            {isToday && <div style={{ fontSize: 10, color: "#00D4AA", fontWeight: 800, textTransform: "uppercase", letterSpacing: 2, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 3, background: "#00D4AA", animation: "pulse 1.5s infinite" }} /> Hoy</div>}
            {/* Header with date box */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: day.activities ? 10 : 0 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: isToday ? "rgba(0,212,170,0.15)" : day.city ? `${getCityStyle(day.city).accent}20` : "rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <div style={{ fontSize: 9, color: isToday ? "#00D4AA" : day.city ? getCityStyle(day.city).accent : "#6B7280", fontWeight: 700, textTransform: "uppercase", lineHeight: 1 }}>{dayLabel}</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: isToday ? "#00D4AA" : day.city ? getCityStyle(day.city).accent : "#E8ECF4", lineHeight: 1.2 }}>{d ? d.getDate() : "?"}</div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, color: day.city ? getCityStyle(day.city).accent : "#00D4AA", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{day.city ? getCityStyle(day.city).label : `Día ${idx + 1}`}</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#E8ECF4", marginTop: 2 }}>{day.title}</div>
              </div>
              <span style={{ color: "#4B5563", fontSize: 14, flexShrink: 0 }}>›</span>
            </div>
            {/* Activities */}
            {day.activities && (
              <div>
                {day.activities.split("\n").filter(Boolean).map((act, i) => {
                  const urlMatch = act.match(/(https?:\/\/[^\s]+)/);
                  if (urlMatch) {
                    const parts = act.split(urlMatch[0]);
                    return (
                      <div key={i} style={{ fontSize: 13, color: "#C8CDD8", padding: "3px 0", display: "flex", gap: 8 }}>
                        <span style={{ color: "#00D4AA", flexShrink: 0 }}>›</span>
                        <span>{parts[0]}<span style={{ color: "#00B4D8", fontWeight: 600 }}>{urlMatch[0].replace(/https?:\/\/(www\.)?/, '').split('/')[0]}</span>{parts[1]}</span>
                      </div>
                    );
                  }
                  return (
                    <div key={i} style={{ fontSize: 13, color: "#C8CDD8", padding: "3px 0", display: "flex", gap: 8 }}>
                      <span style={{ color: "#00D4AA", flexShrink: 0 }}>›</span>{act}
                    </div>
                  );
                })}
              </div>
            )}
            {day.notes && <div style={{ fontSize: 12, color: "#8892A4", marginTop: 6, fontStyle: "italic" }}>{day.notes}</div>}
          </Card>
        );
      })}
    </div>
  );
}

function ChecklistSection({ data, updateData }) {
  const [newItem, setNewItem] = useState("");
  const checklist = data.checklist || [];
  const checked = checklist.filter(i => i.checked).length;

  const toggle = (id) => {
    const updated = checklist.map(i => i.id === id ? { ...i, checked: !i.checked } : i);
    updateData({ ...data, checklist: updated });
  };
  const add = () => {
    if (!newItem.trim()) return;
    updateData({ ...data, checklist: [...checklist, { id: Date.now().toString(), text: newItem.trim(), checked: false }] });
    setNewItem("");
  };
  const remove = (id) => updateData({ ...data, checklist: checklist.filter(i => i.id !== id) });

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", fontFamily: "'Playfair Display', serif" }}>✅ Equipaje</div>
        <span style={{ fontSize: 13, color: "#00D4AA", fontWeight: 700 }}>{checked}/{checklist.length}</span>
      </div>

      {checklist.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden", marginBottom: 4 }}>
            <div style={{ height: "100%", width: `${checklist.length > 0 ? (checked / checklist.length) * 100 : 0}%`, background: "linear-gradient(90deg, #00D4AA, #00B4D8)", borderRadius: 3, transition: "width 0.5s" }} />
          </div>
          <div style={{ fontSize: 11, color: "#8892A4", textAlign: "right" }}>{Math.round(checklist.length > 0 ? (checked / checklist.length) * 100 : 0)}% listo</div>
        </Card>
      )}

      {checklist.map((item) => (
        <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
          <input type="checkbox" checked={item.checked} onChange={() => toggle(item.id)}
            style={{ width: 20, height: 20, accentColor: "#00D4AA", flexShrink: 0, cursor: "pointer" }} />
          <span style={{ flex: 1, fontSize: 14, color: item.checked ? "#6B7280" : "#E8ECF4", textDecoration: item.checked ? "line-through" : "none", transition: "all 0.2s" }}>{item.text}</span>
          <button onClick={() => remove(item.id)} style={{ background: "none", border: "none", color: "#FF6B6B", fontSize: 11, cursor: "pointer", opacity: 0.4, padding: "4px" }}>✕</button>
        </div>
      ))}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Agregar item..."
          onKeyDown={(e) => e.key === "Enter" && add()}
          style={{ flex: 1, padding: "10px 14px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, color: "#E8ECF4", fontSize: 14, outline: "none" }} />
        <Btn onClick={add} small>+</Btn>
      </div>
    </div>
  );
}

function PendingSection() {
  const PENDING_ITEMS = [
    { cat: "✈️ Vuelo", item: "Dallas → Orlando", detail: "SW 22/6, 6:50pm → 10:15pm · $203/pax", url: "https://www.southwest.com", urgency: "alta" },
    { cat: "🏨 Hotel", item: "Las Vegas (17–19/6)", detail: "MGM Grand $562 / Sheraton $328-457 / Hilton Polo Towers $466", url: null, urgency: "alta" },
    { cat: "🏨 Hotel", item: "Orlando (22–27/6)", detail: "Vistana $580 reembolsable", url: null, urgency: "alta" },

    { cat: "🚁 Actividad", item: "Helicóptero Papillon Grand Canyon", detail: "~$200-250/pax · 20/6 · papillon.com", url: "https://www.papillon.com", urgency: "alta" },
    { cat: "🎪 Actividad", item: "Cirque du Soleil 'O' Las Vegas", detail: "~$100+/pax · 18/6 · en el Bellagio", url: "https://www.cirquedusoleil.com/o", urgency: "media" },
    { cat: "🌉 Actividad", item: "Grand Canyon West Skywalk", detail: "Paquete ~$50 + Skywalk ~$60 · grandcanyonwest.com", url: "https://grandcanyonwest.com", urgency: "alta" },
    { cat: "🌆 Actividad", item: "One World Observatory NYC", detail: "~$45/pax · 12/6 · oneworldobservatory.com", url: "https://www.oneworldobservatory.com", urgency: "media" },
    { cat: "🍹 Actividad", item: "Westlight Rooftop Brooklyn", detail: "Reservar mesa · 13/6", url: "https://www.westlightnyc.com", urgency: "media" },
    { cat: "🏔️ Actividad", item: "Cathedral Rock Trail (Sedona)", detail: "Red Rock Pass $5 · recreation.gov · 21/6", url: "https://www.recreation.gov", urgency: "media" },

    { cat: "✅ Verificar", item: "Duplicado hoteles Dallas", detail: "Hampton Inn + Irving Las Colinas — verificar cuál es el correcto", url: null, urgency: "media" },
  ];

  const alta = PENDING_ITEMS.filter(i => i.urgency === "alta");
  const media = PENDING_ITEMS.filter(i => i.urgency === "media");

  return (
    <div>
      <div style={{ fontSize: 18, fontWeight: 800, color: "#E8ECF4", marginBottom: 4, fontFamily: "'Playfair Display', serif" }}>📌 Pendientes</div>
      <div style={{ fontSize: 12, color: "#8892A4", marginBottom: 16 }}>{PENDING_ITEMS.length} items · {alta.length} urgentes</div>

      <div style={{ fontSize: 12, color: "#FF6B6B", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
        🔴 Urgentes
      </div>
      {alta.map((item, i) => (
        <div key={i} style={{ marginBottom: 8, borderRadius: 14, background: "rgba(255,107,107,0.06)", border: "1px solid rgba(255,107,107,0.15)", padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#FF6B6B", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{item.cat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF4" }}>{item.item}</div>
              <div style={{ fontSize: 12, color: "#8892A4", marginTop: 3, lineHeight: 1.4 }}>{item.detail}</div>
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "6px 12px", background: "rgba(0,212,170,0.12)", border: "1px solid rgba(0,212,170,0.2)", borderRadius: 8, fontSize: 11, color: "#00D4AA", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Reservar →
              </a>
            )}
          </div>
        </div>
      ))}

      <div style={{ fontSize: 12, color: "#FFE66D", fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, margin: "16px 0 8px", display: "flex", alignItems: "center", gap: 6 }}>
        🟡 Media prioridad
      </div>
      {media.map((item, i) => (
        <div key={i} style={{ marginBottom: 8, borderRadius: 14, background: "rgba(255,230,109,0.04)", border: "1px solid rgba(255,230,109,0.12)", padding: "12px 14px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: "#FFE66D", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 3 }}>{item.cat}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#E8ECF4" }}>{item.item}</div>
              <div style={{ fontSize: 12, color: "#8892A4", marginTop: 3, lineHeight: 1.4 }}>{item.detail}</div>
            </div>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, padding: "6px 12px", background: "rgba(255,230,109,0.1)", border: "1px solid rgba(255,230,109,0.2)", borderRadius: 8, fontSize: 11, color: "#FFE66D", fontWeight: 700, textDecoration: "none", whiteSpace: "nowrap" }}>
                Reservar →
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}



export default function App() {
  const [data, setData] = useState(DEFAULT_DATA);
  const [tab, setTab] = useState("dashboard");
  const [synced, setSynced] = useState(false);
  const [firebaseReady, setFirebaseReady] = useState(false);
  const isLocalUpdate = useRef(false);
  const saveTimeout = useRef(null);

  // Connect to Firebase on mount
  useEffect(() => {
    try {
      const unsubscribe = onTripData((firebaseData) => {
        if (!isLocalUpdate.current) {
          setData({ ...DEFAULT_DATA, ...firebaseData });
        }
        isLocalUpdate.current = false;
        setFirebaseReady(true);
        setSynced(true);
      });
      return () => {
        if (typeof unsubscribe === 'function') unsubscribe();
      };
    } catch (err) {
      console.error('Firebase connection error:', err);
      // Fallback to localStorage
      try {
        const local = localStorage.getItem('mundial-2026');
        if (local) setData({ ...DEFAULT_DATA, ...JSON.parse(local) });
      } catch (e) {}
    }
  }, []);

  // Debounced save to Firebase
  const updateData = useCallback((newData) => {
    setData(newData);
    isLocalUpdate.current = true;
    setSynced(false);

    // Save to localStorage as backup
    try { localStorage.setItem('mundial-2026', JSON.stringify(newData)); } catch (e) {}

    // Debounce Firebase save (300ms)
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      saveTripData(newData).then(() => setSynced(true));
    }, 300);
  }, []);

  const sections = {
    dashboard: <DashboardSection data={data} updateData={updateData} />,
    flights: <FlightsSection data={data} updateData={updateData} />,
    hotel: <HotelSection data={data} updateData={updateData} />,
    car: <CarSection data={data} updateData={updateData} />,
    expenses: <ExpensesSection data={data} updateData={updateData} />,
    tickets: <DocumentsSection data={data} updateData={updateData} />,
    itinerary: <ItinerarySection data={data} updateData={updateData} />,
    checklist: <ChecklistSection data={data} updateData={updateData} />,
    pending: <PendingSection />,
  };

  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(180deg, #0A0E1A 0%, #111827 50%, #0D1117 100%)", color: "#E8ECF4", maxWidth: 480, margin: "0 auto", position: "relative", paddingBottom: 80 }}>
      {/* Header */}
      <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(255,255,255,0.04)", position: "sticky", top: 0, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(20px)", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 22 }}>⚽</span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, fontFamily: "'Playfair Display', serif" }}>Mundial 2026</div>
            <div style={{ fontSize: 10, color: "#8892A4", letterSpacing: 1, textTransform: "uppercase" }}>Junio 2026 · USA 🇦🇷</div>
          </div>
        </div>
        <SyncIndicator synced={synced} />
      </div>

      {/* Content */}
      <div style={{ padding: "16px 16px 24px" }}>{sections[tab]}</div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 480, background: "rgba(10,14,26,0.95)", backdropFilter: "blur(20px)", borderTop: "1px solid rgba(255,255,255,0.06)", display: "flex", justifyContent: "space-around", padding: "6px 0 env(safe-area-inset-bottom, 8px)", zIndex: 20, overflowX: "auto" }}>
        <Tab active={tab === "dashboard"} onClick={() => setTab("dashboard")} icon="🏠" label="Home" />
        <Tab active={tab === "flights"} onClick={() => setTab("flights")} icon="✈️" label="Vuelos" />
        <Tab active={tab === "hotel"} onClick={() => setTab("hotel")} icon="🏨" label="Aloj." />
        <Tab active={tab === "car"} onClick={() => setTab("car")} icon="🚘" label="Autos" />
        <Tab active={tab === "expenses"} onClick={() => setTab("expenses")} icon="💰" label="Gastos" badge={(data.expenses || []).length} />
        <Tab active={tab === "itinerary"} onClick={() => setTab("itinerary")} icon="📋" label="Plan" />
        <Tab active={tab === "tickets"} onClick={() => setTab("tickets")} icon="📁" label="Docs" badge={(data.documents || []).length || null} />
        <Tab active={tab === "checklist"} onClick={() => setTab("checklist")} icon="✅" label="Equip." badge={(data.checklist || []).filter(i => !i.checked).length || null} />
        <Tab active={tab === "pending"} onClick={() => setTab("pending")} icon="📌" label="Pend." badge={10} />
      </div>
    </div>
  );
}
