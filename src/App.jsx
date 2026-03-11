import { useState, useEffect, useCallback } from "react";
import { onTripData, saveTripData } from "./firebase-mundial";

// ─── FONTS (injected once) ────────────────────────────────────────────────────
const FONT_LINK = document.createElement("link");
FONT_LINK.rel = "stylesheet";
FONT_LINK.href = "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;900&family=DM+Sans:wght@300;400;500;600&family=JetBrains+Mono:wght@400;600&display=swap";
document.head.appendChild(FONT_LINK);

// ─── THEME ────────────────────────────────────────────────────────────────────
const T = {
  bg:      "#F4F1EC",       // warm off-white parchment
  card:    "#FFFFFF",
  ink:     "#1A1612",       // near-black warm
  muted:   "#8A8278",
  border:  "#E2DDD6",
  accent:  "#C4391A",       // vermillion red
  accentL: "#FBE8E3",
  gold:    "#C49A1A",
  goldL:   "#FBF4E3",
  green:   "#1A6B3A",
  greenL:  "#E3F4E9",
  blue:    "#1A3A6B",
  blueL:   "#E3EBF9",
  stamp:   "#C4391A",
};

// ─── CITY PALETTE ─────────────────────────────────────────────────────────────
const CITIES = {
  bsas:    { color: "#1A3A6B", bg: "#E3EBF9", emoji: "🇦🇷", name: "Buenos Aires" },
  nyc:     { color: "#1A1612", bg: "#F0EDEA", emoji: "🗽", name: "Nueva York" },
  kc:      { color: "#6B1A6B", bg: "#F4E3F4", emoji: "⚽", name: "Kansas City" },
  vegas:   { color: "#C49A1A", bg: "#FBF4E3", emoji: "🎰", name: "Las Vegas" },
  canyon:  { color: "#C4391A", bg: "#FBE8E3", emoji: "🏜️", name: "Grand Canyon" },
  sedona:  { color: "#A0401A", bg: "#FAE8DC", emoji: "🔴", name: "Sedona" },
  dallas:  { color: "#1A6B3A", bg: "#E3F4E9", emoji: "⭐", name: "Dallas" },
  orlando: { color: "#1A3A6B", bg: "#E3EBF9", emoji: "🏰", name: "Orlando" },
  miami:   { color: "#0A6B6B", bg: "#E3F4F4", emoji: "🏖️", name: "Miami" },
};
const getCity = (id) => CITIES[id] || { color: T.muted, bg: T.border, emoji: "📍", name: "" };

// ─── DATA ────────────────────────────────────────────────────────────────────
const DEFAULT_DATA = {
  flights: [
    { id: "f1", airline: "Aerolíneas Argentinas", flightNumber: "", from: "AEP", to: "LIM", date: "2026-06-11", time: "17:10", status: "pendiente", notes: "Llegada 20:00 · USD 412" },
    { id: "f2", airline: "American Airlines",     flightNumber: "", from: "LIM", to: "MIA", date: "2026-06-11", time: "23:59", status: "pendiente", notes: "Llegada 06:54 (+1) · USD 766" },
    { id: "f3", airline: "American Airlines",     flightNumber: "", from: "MIA", to: "NYC", date: "2026-06-12", time: "09:59", status: "pendiente", notes: "Llegada 13:01 · USD 204" },
    { id: "f4", airline: "Southwest",             flightNumber: "", from: "NYC", to: "MCI", date: "2026-06-16", time: "08:55", status: "reservado", notes: "Llegada 11:05 · $319 total x4" },
    { id: "f5", airline: "Southwest",             flightNumber: "", from: "MCI", to: "LAS", date: "2026-06-17", time: "08:45", status: "reservado", notes: "Llegada 09:45 · $510 total x4" },
    { id: "f6", airline: "Southwest",             flightNumber: "", from: "PHX", to: "DFW", date: "2026-06-21", time: "18:55", status: "reservado", notes: "Llegada 23:20 · $252 total x4" },
    { id: "f7", airline: "Southwest",             flightNumber: "", from: "DFW", to: "MCO", date: "2026-06-22", time: "18:50", status: "pendiente", notes: "Llegada 22:15 · $203/pax" },
    { id: "f8", airline: "American Airlines",     flightNumber: "", from: "MIA", to: "LIM", date: "2026-06-28", time: "17:35", status: "pendiente", notes: "Llegada 22:15" },
    { id: "f9", airline: "Aerolíneas Argentinas", flightNumber: "", from: "LIM", to: "AEP", date: "2026-06-28", time: "22:40", status: "pendiente", notes: "Llegada 05:00 (+1)" },
  ],
  hotels: [
    { id: "h1", name: "DoubleTree Hilton", city: "Nueva York",    checkIn: "2026-06-12", checkOut: "2026-06-16", confirmation: "", cost: 2025, notes: "Reembolsable · o $1,507 con puntos", status: "reservado" },
    { id: "h2", name: "Ramada by Wyndham", city: "Kansas City",  checkIn: "2026-06-16", checkOut: "2026-06-17", confirmation: "", cost: 217,  notes: "Una noche post partido", status: "reservado" },
    { id: "h3", name: "",                   city: "Las Vegas",    checkIn: "2026-06-17", checkOut: "2026-06-19", confirmation: "", cost: 0,    notes: "MGM $562 / Sheraton $328 / Hilton $466", status: "pendiente" },
    { id: "h4", name: "Grand Canyon IHG",   city: "Grand Canyon", checkIn: "2026-06-19", checkOut: "2026-06-21", confirmation: "", cost: 509,  notes: "", status: "reservado" },
    { id: "h5", name: "Hampton Inn & Suites", city: "Dallas",     checkIn: "2026-06-21", checkOut: "2026-06-22", confirmation: "", cost: 129,  notes: "3051 N Stemmons Fwy", status: "reservado" },
    { id: "h6", name: "Vistana",            city: "Orlando",      checkIn: "2026-06-22", checkOut: "2026-06-27", confirmation: "", cost: 580,  notes: "Reembolsable", status: "pendiente" },
    { id: "h7", name: "",                   city: "Miami",        checkIn: "2026-06-27", checkOut: "2026-06-28", confirmation: "", cost: 0,    notes: "A definir", status: "pendiente" },
  ],
  cars: [
    { id: "car1", company: "", city: "Las Vegas → Phoenix", pickUp: "2026-06-17", dropOff: "2026-06-21", confirmation: "", cost: 0, notes: "Grand Canyon y Sedona · devolver en PHX", status: "reservado" },
    { id: "car2", company: "", city: "Orlando",             pickUp: "2026-06-22", dropOff: "2026-06-25", confirmation: "", cost: 0, notes: "Devolver antes de ir a Miami", status: "pendiente" },
  ],
  expenses: [],
  checklist: [
    { id: "c1",  text: "Pasaporte",                       done: false },
    { id: "c2",  text: "ESTA (autorización USA)",          done: false },
    { id: "c3",  text: "Licencia internacional",           done: false },
    { id: "c4",  text: "Seguro de viaje",                  done: false },
    { id: "c5",  text: "Tarjetas (Visa, BBVA, ICBC)",      done: false },
    { id: "c6",  text: "Dólares cash",                     done: false },
    { id: "c7",  text: "Cargador + powerbank",             done: false },
    { id: "c8",  text: "Adaptador enchufe",                done: false },
    { id: "c9",  text: "Protector solar",                  done: false },
    { id: "c10", text: "Camiseta Argentina 🇦🇷",           done: false },
    { id: "c11", text: "Malla / short de baño",            done: false },
    { id: "c12", text: "Lentes de sol",                    done: false },
    { id: "c13", text: "Botiquín básico",                  done: false },
    { id: "c14", text: "Entradas partidos Argentina",      done: false },
    { id: "c15", text: "Boarding passes descargados",      done: false },
  ],
  itinerary: [
    { id:"d1",  date:"2026-06-11", city:"bsas",   title:"Partida — Buenos Aires",         activities:"17:10 · Vuelo AEP → LIM (Aerolíneas)\n23:59 · Vuelo LIM → MIA (American Airlines)", notes:"Llegada Miami 06:54 del 12/6" },
    { id:"d2",  date:"2026-06-12", city:"nyc",    title:"Llegada — Nueva York",           activities:"06:54 · Llegada MIA · café\n09:59 · Vuelo MIA → NYC · $204/pax\n13:01 · Llegada JFK/LGA · AirTrain+subway $8.50 o taxi $60\n14:00 · Check-in DoubleTree Hilton\n14:30 · Almuerzo Hell's Kitchen · 9th Ave\n15:30 · Times Square · fotos · TKTS Broadway\n16:30 · 5th Ave · Rockefeller Center · St. Patrick\n17:00 · Grand Central · Whispering Gallery\n18:30 · One World Observatory · ~$45/pax · reservar online\n20:30 · Cena Stone Street (la calle más antigua de NYC)\n22:00 · Paseo Brooklyn Bridge nocturno (opcional)", notes:"💡 Reservar One World Observatory: oneworldobservatory.com" },
    { id:"d3",  date:"2026-06-13", city:"nyc",    title:"The Met + Central Park + Brooklyn", activities:"08:00 · Desayuno en diner · Lexington Candy Shop\n09:30 · The Met · sala egipcia + impresionismo + armaduras · ~$30/pax\n12:00 · Almuerzo en el Café del Met\n13:00 · Central Park · Reservoir → Bow Bridge → Bethesda Fountain → Strawberry Fields\n16:30 · Subway a Brooklyn\n17:00 · DUMBO · foto desde Washington St con el puente y el skyline\n17:45 · Cruzar Brooklyn Bridge caminando\n19:30 · Cena en DUMBO · Juliana's Pizza\n21:00 · Westlight Rooftop · William Vale Hotel piso 22", notes:"💡 Tarjeta OMNY semanal ~$34/persona. Westlight reservar mesa." },
    { id:"d4",  date:"2026-06-14", city:"nyc",    title:"High Line + Chelsea + MoMA",     activities:"08:30 · Desayuno West Village · Buvette\n10:00 · High Line desde Gansevoort St hasta 34th St · gratis\n11:30 · Chelsea Market · Los Tacos No.1 + The Lobster Place\n13:00 · Galería de arte Chelsea · Gagosian (entrada libre)\n14:00 · MoMA · Starry Night · Warhol · Monet · ~$30/pax\n16:30 · Top of the Rock · ~$40/pax · mejor vista del Empire State\n19:00 · Cena Koreatown · 32nd St · K-BBQ\n21:00 · Empire State nocturno (opcional)", notes:"💡 Top of the Rock vs One World: vistas distintas, ambos valen la pena." },
    { id:"d5",  date:"2026-06-15", city:"nyc",    title:"Financial District + SoHo + Despedida", activities:"08:30 · Desayuno · bagel con salmón en deli de 7th Ave\n09:30 · Wall Street · Charging Bull · Fearless Girl\n10:00 · 9/11 Memorial (gratis) o Museo ~$30\n11:00 · Oculus (Calatrava) · arquitectura impresionante · gratis\n13:00 · Ferry East River $4 · vista de Manhattan desde el agua\n14:00 · SoHo · Broadway desde Houston St\n15:30 · Washington Square Park\n16:30 · Little Italy · cannoli en Ferrara Bakery (desde 1892)\n18:30 · TKTS Times Square · 50% off Broadway\n22:30 · Preparar equipaje · vuelo mañana 8:55am", notes:"⚠️ Vuelo mañana 8:55am — Uber a las 6:15am MÁXIMO." },
    { id:"d6",  date:"2026-06-16", city:"kc",     title:"PARTIDO 1 — Argentina vs Argelia ⚽", activities:"06:15 · Uber al aeropuerto\n08:55 · Vuelo NYC → Kansas City (Southwest)\n11:05 · Llegada · retirar auto Hertz\n12:00 · Almuerzo BBQ · Joe's Kansas City\n16:00 · Traslado al Arrowhead Stadium\n18:00 · Llegada al estadio · Fan Zone\n20:00 · ⚽ ARGENTINA 🇦🇷 vs ARGELIA 🇩🇿", notes:"🏟️ Primer partido del Mundial 2026. Llegar 2hs antes." },
    { id:"d7",  date:"2026-06-17", city:"vegas",  title:"Kansas City → Las Vegas",        activities:"08:45 · Vuelo MCI → LAS (Southwest)\n09:45 · Llegada · retirar auto rental\n12:00 · Check-in hotel · descanso\n14:00 · The Strip · Bellagio · Caesars · Venetian\n17:00 · Fuentes del Bellagio (cada 15 min · gratis)\n20:00 · Fremont Street Experience · show LED", notes:"Guardar energía — viernes 19/6 salida 6:30am." },
    { id:"d8",  date:"2026-06-18", city:"vegas",  title:"Las Vegas — Día libre",          activities:"10:00 · Pool day · 40°C afuera\n13:00 · Almuerzo Strip · In-N-Out Burger clásico\n15:00 · The Neon Museum · ~$20/pax\n17:00 · Fuentes Bellagio al atardecer · mejor luz\n19:30 · Cena buffet casino · Bacchanal Caesars\n21:00 · Cirque du Soleil 'O' · ~$100+/pax · RESERVAR", notes:"⚠️ Acostarse temprano — mañana salida 6:30am Grand Canyon." },
    { id:"d9",  date:"2026-06-19", city:"canyon", title:"West Rim Skywalk + South Rim",   activities:"06:30 · Salida desde Las Vegas\n09:00 · Skywalk Eagle Point · ~$50 paquete + ~$60 Skywalk · grandcanyonwest.com\n11:00 · Guano Point · mejores panorámicas · almuerzo\n12:30 · Salida hacia South Rim (2.5hs)\n15:30 · Visitor Center · Mather Point\n17:00 · Desert View Watchtower · cierra 18hs", notes:"💡 No entran cámaras al Skywalk. Fotos oficiales ~$25. Pase South Rim $35/auto." },
    { id:"d10", date:"2026-06-20", city:"canyon", title:"Grand Canyon — Trek + Helicóptero", activities:"06:00 · Bright Angel Trail · solo hasta 1.5 Mile Resthouse · 2L agua/persona\n10:00 · Papillon Helicopters · ~30 min · ~$200-250/pax · papillon.com\n12:30 · Miradores South Rim · shuttle gratuito · Hopi Point\n16:00 · Salida hacia Phoenix (4hs)", notes:"⚠️ 45°C abajo en junio. NUNCA bajar del 1.5 Mile Resthouse." },
    { id:"d11", date:"2026-06-21", city:"sedona", title:"Sedona + Phoenix → Dallas",      activities:"08:30 · Airport Mesa Vortex · vistas 360°\n09:45 · Cathedral Rock Trail · 2.5km · Red Rock Pass $5\n12:00 · Chapel of the Holy Cross · gratis\n12:45 · Tlaquepaque Arts Village · almuerzo\n15:00 · SALIDA MÁXIMA hacia Phoenix\n16:30 · Old Town Scottsdale\n18:55 · Vuelo PHX → Dallas (Southwest)", notes:"⚠️ Salir de Sedona 15hs máximo para llegar al aeropuerto." },
    { id:"d12", date:"2026-06-22", city:"dallas", title:"PARTIDO 2 — Argentina vs Austria ⚽", activities:"09:30 · Uber al AT&T Stadium · Hampton Inn → I-30W → TX-360S · 40-60min\n10:30 · Fan Zone AT&T Stadium · Arlington\n12:00 · ⚽ ARGENTINA 🇦🇷 vs AUSTRIA 🇦🇹\n17:30 · Uber al aeropuerto DFW\n18:50 · Vuelo DFW → Orlando (Southwest)", notes:"⚠️ Tiempo muy justo. Pedir Uber ANTES de salir del estadio." },
    { id:"d13", date:"2026-06-23", city:"orlando", title:"Orlando — Llegada y relax",     activities:"Descanso post partidos · International Drive · Disney Springs", notes:"Día de recuperación." },
    { id:"d14", date:"2026-06-24", city:"orlando", title:"Orlando — Parques temáticos",   activities:"Universal / Disney / SeaWorld\nReservar tickets online con anticipación", notes:"El parque que elijan el día anterior." },
    { id:"d15", date:"2026-06-25", city:"miami",   title:"Miami / Siesta Key — Playa 🏖️", activities:"Devolver auto Orlando\nViaje a Miami Beach o Siesta Key\nCheck-in · playa y relax", notes:"⏳ Destino final por definir." },
    { id:"d16", date:"2026-06-26", city:"miami",   title:"Playa — Relax total",           activities:"Playa y relax\nRestaurantes · atardecer", notes:"Días de descanso." },
    { id:"d17", date:"2026-06-27", city:"miami",   title:"Último día de playa",           activities:"Último día de relax\nCena de despedida del viaje", notes:"Penúltimo día." },
    { id:"d18", date:"2026-06-28", city:"bsas",    title:"Vuelta a Buenos Aires 🇦🇷",     activities:"17:35 · Vuelo MIA → LIM (American Airlines)\n22:40 · Vuelo LIM → AEP (Aerolíneas Argentinas)", notes:"Llegada BUE 05:00 del 29/6. ¡Fin del viaje!" },
  ],
};

const PENDING = [
  { id:"p1",  urgency:"alta",  emoji:"✈️", text:"Vuelo Dallas → Orlando",        detail:"Southwest · 22/6 · 18:50 · $203/pax · southwest.com" },
  { id:"p2",  urgency:"alta",  emoji:"🏨", text:"Hotel Las Vegas",               detail:"17–19/6 · Sheraton $328 / MGM $562 / Hilton $466" },
  { id:"p3",  urgency:"alta",  emoji:"🏨", text:"Hotel Orlando",                 detail:"22–27/6 · Vistana $580 reembolsable" },
  { id:"p4",  urgency:"alta",  emoji:"🚁", text:"Papillon Helicopters",          detail:"20/6 · ~$200-250/pax · papillon.com · se agotan" },
  { id:"p5",  urgency:"alta",  emoji:"🌉", text:"Grand Canyon West Skywalk",     detail:"19/6 · paquete ~$50 + Skywalk ~$60 · grandcanyonwest.com" },
  { id:"p6",  urgency:"media", emoji:"🚗", text:"Auto Orlando",                  detail:"22–25/6 · retirar MCO · devolver antes de Miami" },
  { id:"p7",  urgency:"media", emoji:"🎪", text:"Cirque du Soleil 'O'",         detail:"18/6 · ~$100+/pax · Bellagio · cirquedusoleil.com/o" },
  { id:"p8",  urgency:"media", emoji:"🌆", text:"One World Observatory NYC",     detail:"12/6 · ~$45/pax · oneworldobservatory.com" },
  { id:"p9",  urgency:"media", emoji:"🍸", text:"Westlight Rooftop Brooklyn",    detail:"13/6 noche · William Vale Hotel piso 22 · westlightnyc.com" },
  { id:"p10", urgency:"media", emoji:"🏔️", text:"Red Rock Pass Sedona",         detail:"21/6 · $5/auto · Cathedral Rock · recreation.gov" },
];

// ─── CATEGORIES ───────────────────────────────────────────────────────────────
const CATS = [
  { id:"food",  icon:"🍽️", label:"Comida",        color:"#C4391A" },
  { id:"trans", icon:"🚗",  label:"Transporte",   color:"#1A3A6B" },
  { id:"shop",  icon:"🛍️", label:"Compras",       color:"#C49A1A" },
  { id:"ent",   icon:"🎭",  label:"Entretenim.",  color:"#6B1A6B" },
  { id:"hotel", icon:"🏨",  label:"Hotel",        color:"#1A6B3A" },
  { id:"other", icon:"📦",  label:"Otros",        color:"#8A8278" },
];

// ─── SMALL COMPONENTS ─────────────────────────────────────────────────────────

const css = (styles) => Object.entries(styles).reduce((s,[k,v]) => ({...s,[k]:v}), {});

const Badge = ({ text, color = T.accent, bg }) => (
  <span style={{ display:"inline-flex", alignItems:"center", padding:"2px 8px", borderRadius:4, fontSize:11, fontWeight:600, letterSpacing:"0.05em", textTransform:"uppercase", background: bg || color+"18", color, border:`1px solid ${color}30` }}>
    {text}
  </span>
);

const Pill = ({ children, active, onClick, color = T.accent }) => (
  <button onClick={onClick} style={{ border:`1.5px solid ${active ? color : T.border}`, background: active ? color+"12" : "transparent", color: active ? color : T.muted, borderRadius:20, padding:"5px 14px", fontSize:12, fontWeight:600, cursor:"pointer", letterSpacing:"0.03em", transition:"all .15s" }}>
    {children}
  </button>
);

const StatusDot = ({ status }) => {
  const map = { reservado:[T.green,"Reservado"], pendiente:[T.gold,"Pendiente"], pagado:[T.blue,"Pagado"] };
  const [color, label] = map[status] || [T.muted, status];
  return <Badge text={label} color={color} />;
};

const Divider = () => <div style={{ height:1, background:T.border, margin:"16px 0" }} />;

const SectionHeader = ({ title, subtitle, action }) => (
  <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:20 }}>
    <div>
      <h2 style={{ fontFamily:"'Playfair Display',serif", fontSize:22, fontWeight:700, color:T.ink, margin:0 }}>{title}</h2>
      {subtitle && <p style={{ margin:"2px 0 0", fontSize:13, color:T.muted, fontFamily:"'DM Sans',sans-serif" }}>{subtitle}</p>}
    </div>
    {action}
  </div>
);

const Card = ({ children, style = {}, onClick, hover = true }) => {
  const [h, setH] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => hover && setH(true)}
      onMouseLeave={() => setH(false)}
      style={{ background:T.card, border:`1px solid ${T.border}`, borderRadius:12, padding:20, transition:"all .2s", cursor: onClick?"pointer":"default", boxShadow: h ? "0 4px 20px rgba(26,22,18,0.08)" : "0 1px 4px rgba(26,22,18,0.04)", transform: h && onClick ? "translateY(-1px)" : "none", ...style }}>
      {children}
    </div>
  );
};

const EmptyState = ({ icon, text }) => (
  <div style={{ textAlign:"center", padding:"48px 24px", color:T.muted }}>
    <div style={{ fontSize:36, marginBottom:12 }}>{icon}</div>
    <p style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14 }}>{text}</p>
  </div>
);

// ─── BOARDING PASS FLIGHT CARD ────────────────────────────────────────────────
const FlightCard = ({ flight, onClick }) => {
  const city = flight.status === "reservado" ? T.green : T.gold;
  const date = new Date(flight.date + "T12:00:00");
  const weekdays = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months = ["ENE","FEB","MAR","ABR","MAY","JUN","JUL","AGO","SEP","OCT","NOV","DIC"];

  return (
    <div onClick={onClick} style={{ cursor:"pointer", background:T.card, border:`1px solid ${T.border}`, borderRadius:12, overflow:"hidden", display:"flex", transition:"all .2s", boxShadow:"0 1px 4px rgba(26,22,18,0.04)" }}
      onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 4px 20px rgba(26,22,18,0.1)"; e.currentTarget.style.transform = "translateY(-1px)"; }}
      onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 1px 4px rgba(26,22,18,0.04)"; e.currentTarget.style.transform = "none"; }}>
      {/* Date stamp */}
      <div style={{ width:64, background: flight.status === "reservado" ? T.greenL : T.goldL, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"12px 8px", flexShrink:0 }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600, color: city, lineHeight:1 }}>{String(date.getDate()).padStart(2,"0")}</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight:600, color: city, letterSpacing:"0.1em" }}>{months[date.getMonth()]}</span>
        <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color: city, marginTop:2 }}>{weekdays[date.getDay()]}</span>
      </div>
      {/* Content */}
      <div style={{ flex:1, padding:"12px 16px", display:"flex", alignItems:"center", gap:12 }}>
        <div style={{ textAlign:"center", minWidth:44 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600, color:T.ink }}>{flight.from}</div>
          <div style={{ fontSize:10, color:T.muted, fontFamily:"'DM Sans',sans-serif" }}>{flight.time}</div>
        </div>
        <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
          <div style={{ width:"100%", display:"flex", alignItems:"center", gap:4 }}>
            <div style={{ flex:1, height:1, background:T.border }} />
            <span style={{ fontSize:14 }}>✈️</span>
            <div style={{ flex:1, height:1, background:T.border }} />
          </div>
          <span style={{ fontSize:11, color:T.muted, fontFamily:"'DM Sans',sans-serif", textAlign:"center" }}>{flight.airline}</span>
          {flight.flightNumber && <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:T.accent }}>{flight.flightNumber}</span>}
        </div>
        <div style={{ textAlign:"center", minWidth:44 }}>
          <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600, color:T.ink }}>{flight.to}</div>
        </div>
      </div>
      {/* Status bar */}
      <div style={{ width:6, background: flight.status === "reservado" ? T.green : T.gold, flexShrink:0 }} />
    </div>
  );
};

// ─── HOTEL CARD ───────────────────────────────────────────────────────────────
const HotelCard = ({ hotel, onClick }) => {
  const nights = Math.round((new Date(hotel.checkOut) - new Date(hotel.checkIn)) / 86400000);
  const fmtDate = (d) => { const dt = new Date(d+"T12:00:00"); return `${dt.getDate()}/${dt.getMonth()+1}`; };
  return (
    <Card onClick={onClick} style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
      <div style={{ width:48, height:48, borderRadius:10, background: hotel.status === "reservado" ? T.greenL : T.goldL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🏨</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, color:T.ink }}>{hotel.name || hotel.city}</span>
          <StatusDot status={hotel.status} />
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.muted, marginTop:3 }}>
          {hotel.city} · {fmtDate(hotel.checkIn)} → {fmtDate(hotel.checkOut)} · {nights} noche{nights !== 1 ? "s" : ""}
          {hotel.cost > 0 && <span style={{ marginLeft:8, fontFamily:"'JetBrains Mono',monospace", color:T.ink, fontWeight:600 }}>${hotel.cost.toLocaleString()}</span>}
        </div>
        {hotel.notes && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.muted, marginTop:4, fontStyle:"italic" }}>{hotel.notes}</div>}
      </div>
    </Card>
  );
};

// ─── ITINERARY DAY CARD ───────────────────────────────────────────────────────
const DayCard = ({ day, isMatch, onClick, isToday }) => {
  const c = getCity(day.city);
  const dt = new Date(day.date + "T12:00:00");
  const weekdays = ["Dom","Lun","Mar","Mié","Jue","Vie","Sáb"];
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

  return (
    <div onClick={onClick} style={{ cursor:"pointer", display:"flex", gap:0, transition:"all .2s" }}
      onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
      {/* Date column */}
      <div style={{ width:52, flexShrink:0, paddingTop:2, textAlign:"right", paddingRight:16 }}>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:20, fontWeight:600, color: isToday ? T.accent : T.ink, lineHeight:1 }}>{String(dt.getDate()).padStart(2,"0")}</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.muted, letterSpacing:"0.05em" }}>{months[dt.getMonth()].toUpperCase()}</div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.muted }}>{weekdays[dt.getDay()]}</div>
      </div>
      {/* Timeline dot + line */}
      <div style={{ width:24, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", gap:0, paddingTop:6 }}>
        <div style={{ width:10, height:10, borderRadius:"50%", background: isMatch ? T.accent : c.color, flexShrink:0, border:`2px solid ${T.bg}`, zIndex:1 }} />
        <div style={{ flex:1, width:1.5, background:T.border, marginTop:4 }} />
      </div>
      {/* Content */}
      <div style={{ flex:1, paddingBottom:20, paddingLeft:4 }}>
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, color: isMatch ? T.accent : T.ink }}>{day.title}</span>
          {isMatch && <Badge text="⚽ PARTIDO" color={T.accent} />}
          {isToday && <Badge text="HOY" color={T.accent} />}
        </div>
        <div style={{ display:"inline-flex", alignItems:"center", gap:4, marginBottom:6 }}>
          <span style={{ fontSize:13 }}>{c.emoji}</span>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:c.color, fontWeight:500 }}>{c.name}</span>
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.muted, lineHeight:1.6, whiteSpace:"pre-line" }}>
          {day.activities}
        </div>
        {day.notes && (
          <div style={{ marginTop:8, padding:"6px 10px", background: day.notes.includes("⚠️") ? T.accentL : T.goldL, borderLeft:`3px solid ${day.notes.includes("⚠️") ? T.accent : T.gold}`, borderRadius:"0 6px 6px 0", fontSize:12, color: day.notes.includes("⚠️") ? T.accent : "#7A5800", fontFamily:"'DM Sans',sans-serif" }}>
            {day.notes}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── SECTIONS ─────────────────────────────────────────────────────────────────

function FlightsSection({ data, update }) {
  const [filter, setFilter] = useState("all");
  const flights = data.flights || [];
  const shown = filter === "all" ? flights : flights.filter(f => f.status === filter);
  const reserved = flights.filter(f => f.status === "reservado").length;

  return (
    <div>
      <SectionHeader title="Vuelos" subtitle={`${reserved}/${flights.length} reservados`} />
      <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
        {[["all","Todos"],["reservado","Reservados"],["pendiente","Pendientes"]].map(([v,l]) => (
          <Pill key={v} active={filter===v} onClick={() => setFilter(v)}>{l}</Pill>
        ))}
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {shown.map(f => <FlightCard key={f.id} flight={f} onClick={() => {}} />)}
      </div>
    </div>
  );
}

function HotelsSection({ data, update }) {
  const hotels = data.hotels || [];
  const cars = data.cars || [];
  const reserved = hotels.filter(h => h.status === "reservado").length;
  const totalCost = hotels.reduce((s,h) => s + (h.cost || 0), 0);

  return (
    <div>
      <SectionHeader title="Alojamiento" subtitle={`${reserved}/${hotels.length} confirmados · $${totalCost.toLocaleString()} total`} />
      <div style={{ display:"flex", flexDirection:"column", gap:10, marginBottom:28 }}>
        {hotels.map(h => <HotelCard key={h.id} hotel={h} onClick={() => {}} />)}
      </div>
      <SectionHeader title="Autos" subtitle={`${cars.filter(c=>c.status==="reservado").length}/${cars.length} confirmados`} />
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {cars.map(car => (
          <Card key={car.id} style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
            <div style={{ width:48, height:48, borderRadius:10, background: car.status === "reservado" ? T.greenL : T.goldL, display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>🚗</div>
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>
                <span style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:15, color:T.ink }}>{car.city}</span>
                <StatusDot status={car.status} />
              </div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.muted, marginTop:3 }}>
                {car.company || "Empresa pendiente"} · {car.pickUp} → {car.dropOff}
              </div>
              {car.notes && <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.muted, marginTop:4, fontStyle:"italic" }}>{car.notes}</div>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ItinerarySection({ data }) {
  const MATCH_IDS = new Set(["d6","d12"]);
  const getToday = () => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  };
  const today = getToday();
  const itinerary = data.itinerary || [];

  return (
    <div>
      <SectionHeader title="Itinerario" subtitle={`${itinerary.length} días · 11 jun – 28 jun 2026`} />
      <div>
        {itinerary.map((day, i) => (
          <DayCard
            key={day.id}
            day={day}
            isMatch={MATCH_IDS.has(day.id)}
            isToday={day.date === today}
            onClick={() => {}}
          />
        ))}
      </div>
    </div>
  );
}

function ExpensesSection({ data, update }) {
  const [form, setForm] = useState({ desc:"", amount:"", cat:"food", date: new Date().toISOString().slice(0,10) });
  const expenses = data.expenses || [];
  const total = expenses.reduce((s,e) => s + (Number(e.amount)||0), 0);

  const add = () => {
    if (!form.desc || !form.amount) return;
    const newExpenses = [...expenses, { id: Date.now()+"", ...form, amount: Number(form.amount) }];
    update({ ...data, expenses: newExpenses });
    setForm(f => ({ ...f, desc:"", amount:"" }));
  };

  const byCity = expenses.reduce((acc, e) => {
    const cat = CATS.find(c=>c.id===e.cat) || CATS[CATS.length-1];
    acc[cat.id] = (acc[cat.id]||0) + Number(e.amount);
    return acc;
  }, {});

  return (
    <div>
      <SectionHeader title="Gastos" subtitle={total > 0 ? `$${total.toLocaleString("es-AR")} total` : "Sin gastos registrados"} />

      {/* Add form */}
      <Card style={{ marginBottom:24, background: "#FAFAF8" }}>
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 }}>
          <div style={{ gridColumn:"1/-1" }}>
            <input value={form.desc} onChange={e=>setForm(f=>({...f,desc:e.target.value}))} placeholder="Descripción"
              style={{ width:"100%", border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif", color:T.ink, background:"white", boxSizing:"border-box" }} />
          </div>
          <input value={form.amount} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} placeholder="USD" type="number"
            style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif", color:T.ink, background:"white" }} />
          <select value={form.cat} onChange={e=>setForm(f=>({...f,cat:e.target.value}))}
            style={{ border:`1px solid ${T.border}`, borderRadius:8, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif", color:T.ink, background:"white" }}>
            {CATS.map(c => <option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
          </select>
        </div>
        <button onClick={add} style={{ width:"100%", background:T.accent, color:"white", border:"none", borderRadius:8, padding:"10px", fontSize:14, fontWeight:600, fontFamily:"'DM Sans',sans-serif", cursor:"pointer", letterSpacing:"0.02em" }}>
          + Registrar gasto
        </button>
      </Card>

      {/* Category summary */}
      {Object.keys(byCity).length > 0 && (
        <div style={{ display:"flex", gap:8, flexWrap:"wrap", marginBottom:20 }}>
          {Object.entries(byCity).sort((a,b)=>b[1]-a[1]).map(([catId, amt]) => {
            const cat = CATS.find(c=>c.id===catId);
            return (
              <div key={catId} style={{ background:cat.color+"14", border:`1px solid ${cat.color}30`, borderRadius:8, padding:"6px 12px" }}>
                <span style={{ fontSize:13 }}>{cat.icon}</span>
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, fontWeight:600, color:cat.color, marginLeft:6 }}>${amt.toLocaleString()}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* List */}
      {expenses.length === 0 ? <EmptyState icon="💰" text="Registrá el primer gasto del viaje" /> : (
        <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
          {[...expenses].reverse().map(exp => {
            const cat = CATS.find(c=>c.id===exp.cat) || CATS[CATS.length-1];
            return (
              <div key={exp.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.card, border:`1px solid ${T.border}`, borderRadius:10 }}>
                <span style={{ width:32, height:32, borderRadius:8, background:cat.color+"18", display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, flexShrink:0 }}>{cat.icon}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:500, fontSize:14, color:T.ink, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{exp.desc}</div>
                  <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.muted }}>{exp.date}</div>
                </div>
                <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:15, fontWeight:600, color:T.ink, flexShrink:0 }}>
                  ${Number(exp.amount).toLocaleString()}
                </div>
                <button onClick={() => update({...data, expenses: expenses.filter(e=>e.id!==exp.id)})}
                  style={{ background:"none", border:"none", color:T.muted, cursor:"pointer", fontSize:18, padding:4, lineHeight:1 }}>×</button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChecklistSection({ data, update }) {
  const items = data.checklist || [];
  const done = items.filter(i=>i.done).length;
  const pct = items.length ? Math.round(done/items.length*100) : 0;

  const toggle = (id) => {
    const newItems = items.map(i => i.id === id ? {...i, done: !i.done} : i);
    update({ ...data, checklist: newItems });
  };

  return (
    <div>
      <SectionHeader title="Equipaje" subtitle={`${done}/${items.length} preparado · ${pct}%`} />

      {/* Progress bar */}
      <div style={{ marginBottom:24 }}>
        <div style={{ height:6, background:T.border, borderRadius:3, overflow:"hidden" }}>
          <div style={{ height:"100%", width:`${pct}%`, background: pct===100 ? T.green : T.accent, borderRadius:3, transition:"width .4s ease" }} />
        </div>
      </div>

      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(item => (
          <div key={item.id} onClick={() => toggle(item.id)}
            style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 16px", background:T.card, border:`1.5px solid ${item.done ? T.green+"40" : T.border}`, borderRadius:10, cursor:"pointer", transition:"all .15s" }}>
            <div style={{ width:20, height:20, borderRadius:5, border:`2px solid ${item.done ? T.green : T.border}`, background:item.done ? T.green : "transparent", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, transition:"all .15s" }}>
              {item.done && <span style={{ color:"white", fontSize:12, fontWeight:700, lineHeight:1 }}>✓</span>}
            </div>
            <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color: item.done ? T.muted : T.ink, textDecoration: item.done ? "line-through" : "none", transition:"all .15s" }}>
              {item.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PendingSection() {
  const alta = PENDING.filter(p => p.urgency === "alta");
  const media = PENDING.filter(p => p.urgency === "media");

  const Group = ({ items, label, color }) => (
    <div style={{ marginBottom:24 }}>
      <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color, letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:12 }}>{label} — {items.length} items</div>
      <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
        {items.map(p => (
          <Card key={p.id} hover={false} style={{ display:"flex", gap:12, alignItems:"flex-start", borderLeft:`3px solid ${color}` }}>
            <span style={{ fontSize:20, flexShrink:0 }}>{p.emoji}</span>
            <div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:600, fontSize:14, color:T.ink }}>{p.text}</div>
              <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.muted, marginTop:3 }}>{p.detail}</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  return (
    <div>
      <SectionHeader title="Pendientes" subtitle={`${PENDING.length} items · ${alta.length} urgentes`} />
      <Group items={alta} label="🔴 Urgente" color={T.accent} />
      <Group items={media} label="🟡 Media prioridad" color={T.gold} />
    </div>
  );
}

// ─── DASHBOARD ────────────────────────────────────────────────────────────────
function Dashboard({ data }) {
  const TRIP_START = new Date("2026-06-11T00:00:00");
  const TRIP_END   = new Date("2026-06-29T00:00:00");
  const MATCHES = [
    { date: new Date("2026-06-16T20:00:00"), rival: "Argelia 🇩🇿", venue: "Arrowhead Stadium, Kansas City" },
    { date: new Date("2026-06-22T12:00:00"), rival: "Austria 🇦🇹",  venue: "AT&T Stadium, Arlington Dallas" },
  ];

  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(t); }, []);

  const daysToTrip = Math.ceil((TRIP_START - now) / 86400000);
  const onTrip = now >= TRIP_START && now <= TRIP_END;
  const tripDay = onTrip ? Math.floor((now - TRIP_START) / 86400000) + 1 : null;

  const Countdown = ({ target, label }) => {
    const diff = target - now;
    if (diff < 0) return <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:12, color:T.green }}>✓ Completado</span>;
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    return (
      <div>
        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:13, color:T.accent, letterSpacing:"0.05em" }}>
          {d > 0 && `${d}d `}{String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
        </div>
        <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.muted }}>{label}</div>
      </div>
    );
  };

  const flights = data.flights || [];
  const hotels = data.hotels || [];
  const checklist = data.checklist || [];
  const expenses = data.expenses || [];
  const totalExp = expenses.reduce((s,e) => s+(Number(e.amount)||0), 0);
  const reservedFlights = flights.filter(f=>f.status==="reservado").length;
  const reservedHotels = hotels.filter(h=>h.status==="reservado").length;
  const checkDone = checklist.filter(c=>c.done).length;

  return (
    <div>
      {/* Hero */}
      <div style={{ marginBottom:28, padding:"28px 24px", background:T.ink, borderRadius:16, position:"relative", overflow:"hidden" }}>
        {/* Decorative */}
        <div style={{ position:"absolute", top:-20, right:-20, width:120, height:120, borderRadius:"50%", border:`2px solid ${T.accent}22`, pointerEvents:"none" }} />
        <div style={{ position:"absolute", top:10, right:10, width:60, height:60, borderRadius:"50%", border:`2px solid ${T.accent}33`, pointerEvents:"none" }} />

        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:12, flexWrap:"wrap" }}>
          <div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:"rgba(255,255,255,0.5)", letterSpacing:"0.12em", textTransform:"uppercase", marginBottom:6 }}>Mundial 2026 · USA 🇺🇸</div>
            <h1 style={{ fontFamily:"'Playfair Display',serif", fontSize:28, fontWeight:900, color:"white", margin:"0 0 4px", lineHeight:1.1 }}>
              {onTrip ? `Día ${tripDay} del viaje` : daysToTrip > 0 ? `Faltan ${daysToTrip} días` : "¡Ya volvieron!"}
            </h1>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:14, color:"rgba(255,255,255,0.55)" }}>
              11 jun – 28 jun 2026 · 4 personas 🇦🇷
            </div>
          </div>
          <div style={{ display:"flex", gap:4 }}>
            <div style={{ fontFamily:"'Playfair Display',serif", fontSize:32 }}>⚽</div>
          </div>
        </div>
      </div>

      {/* Match countdowns */}
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:20 }}>
        {MATCHES.map((m, i) => (
          <Card key={i} hover={false} style={{ borderLeft:`4px solid ${T.accent}` }}>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, color:T.muted, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:6 }}>Partido {i+1}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontWeight:700, fontSize:14, color:T.ink, marginBottom:4 }}>🇦🇷 vs {m.rival}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.muted, marginBottom:8 }}>{m.venue}</div>
            <Countdown target={m.date} label={`${m.date.getDate()}/${m.date.getMonth()+1} · ${String(m.date.getHours()).padStart(2,"0")}:00hs KC`} />
          </Card>
        ))}
      </div>

      {/* Stats grid */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(2, 1fr)", gap:10, marginBottom:20 }}>
        {[
          { label:"Vuelos reservados", value:`${reservedFlights}/${flights.length}`, icon:"✈️", color:reservedFlights===flights.length?T.green:T.gold },
          { label:"Hoteles confirmados", value:`${reservedHotels}/${hotels.length}`, icon:"🏨", color:reservedHotels===hotels.length?T.green:T.gold },
          { label:"Equipaje listo",      value:`${checkDone}/${checklist.length}`, icon:"✅", color:checkDone===checklist.length?T.green:T.accent },
          { label:"Gastos registrados",  value:totalExp>0?`$${totalExp.toLocaleString()}`:"—", icon:"💰", color:T.blue },
        ].map((s,i) => (
          <Card key={i} hover={false} style={{ textAlign:"center", padding:"16px 12px" }}>
            <div style={{ fontSize:24, marginBottom:6 }}>{s.icon}</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:18, fontWeight:600, color:s.color }}>{s.value}</div>
            <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.muted, marginTop:2 }}>{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Pending urgent */}
      {PENDING.filter(p=>p.urgency==="alta").length > 0 && (
        <Card hover={false} style={{ background:T.accentL, border:`1px solid ${T.accent}30` }}>
          <div style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, fontWeight:700, color:T.accent, textTransform:"uppercase", letterSpacing:"0.1em", marginBottom:10 }}>
            🔴 {PENDING.filter(p=>p.urgency==="alta").length} pendientes urgentes
          </div>
          {PENDING.filter(p=>p.urgency==="alta").slice(0,3).map(p => (
            <div key={p.id} style={{ fontFamily:"'DM Sans',sans-serif", fontSize:13, color:T.ink, padding:"4px 0", borderBottom:`1px solid ${T.accent}15`, display:"flex", gap:8 }}>
              <span>{p.emoji}</span><span style={{ fontWeight:500 }}>{p.text}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

// ─── BOTTOM NAV ───────────────────────────────────────────────────────────────
const NAV = [
  { id:"dashboard", icon:"🏠", label:"Inicio" },
  { id:"itinerary", icon:"📅", label:"Días" },
  { id:"flights",   icon:"✈️", label:"Vuelos" },
  { id:"hotels",    icon:"🏨", label:"Hoteles" },
  { id:"expenses",  icon:"💰", label:"Gastos" },
  { id:"checklist", icon:"✅", label:"Equip." },
  { id:"pending",   icon:"📌", label:"Pend." },
];

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("dashboard");
  const [data, setData] = useState(DEFAULT_DATA);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    const unsub = onTripData((fbData) => {
      if (fbData && Object.keys(fbData).length > 0) {
        setData({ ...DEFAULT_DATA, ...fbData });
      }
      setSynced(true);
    });
    return unsub;
  }, []);

  const update = useCallback((newData) => {
    setData(newData);
    saveTripData(newData);
  }, []);

  const pendingCount = PENDING.filter(p=>p.urgency==="alta").length;
  const checkPending = (data.checklist||[]).filter(c=>!c.done).length;
  const expCount = (data.expenses||[]).length;

  const SECTIONS = {
    dashboard: <Dashboard data={data} />,
    itinerary: <ItinerarySection data={data} />,
    flights:   <FlightsSection data={data} update={update} />,
    hotels:    <HotelsSection data={data} update={update} />,
    expenses:  <ExpensesSection data={data} update={update} />,
    checklist: <ChecklistSection data={data} update={update} />,
    pending:   <PendingSection />,
  };

  const badges = { pending: pendingCount, checklist: checkPending, expenses: expCount };

  return (
    <div style={{ background:T.bg, minHeight:"100vh", fontFamily:"'DM Sans',sans-serif" }}>
      {/* Top bar */}
      <div style={{ position:"sticky", top:0, zIndex:100, background:T.bg, borderBottom:`1px solid ${T.border}`, padding:"12px 20px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <span style={{ fontFamily:"'Playfair Display',serif", fontSize:18, fontWeight:700, color:T.ink }}>Mundial 2026</span>
          <span style={{ fontSize:16 }}>⚽</span>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ width:7, height:7, borderRadius:"50%", background: synced ? T.green : T.gold }} />
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:11, color:T.muted }}>
            {synced ? "Sincronizado" : "Conectando..."}
          </span>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth:560, margin:"0 auto", padding:"24px 16px 100px" }}>
        {SECTIONS[tab]}
      </div>

      {/* Bottom nav */}
      <div style={{ position:"fixed", bottom:0, left:0, right:0, background:T.card, borderTop:`1px solid ${T.border}`, display:"flex", justifyContent:"space-around", padding:"8px 0 env(safe-area-inset-bottom,8px)", zIndex:100 }}>
        {NAV.map(n => {
          const active = tab === n.id;
          const badge = badges[n.id];
          return (
            <button key={n.id} onClick={() => setTab(n.id)}
              style={{ background:"none", border:"none", padding:"4px 8px", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:2, position:"relative", minWidth:44 }}>
              {badge > 0 && (
                <span style={{ position:"absolute", top:0, right:4, background:T.accent, color:"white", borderRadius:8, fontSize:9, fontWeight:700, padding:"1px 4px", minWidth:14, textAlign:"center", lineHeight:"14px" }}>
                  {badge}
                </span>
              )}
              <span style={{ fontSize:18, opacity: active ? 1 : 0.5 }}>{n.icon}</span>
              <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:10, fontWeight: active ? 700 : 400, color: active ? T.accent : T.muted, letterSpacing:"0.02em" }}>
                {n.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
