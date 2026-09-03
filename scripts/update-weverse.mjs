import fs from "node:fs/promises";
import path from "node:path";

const SOURCE_URL = "https://spot.weverse.io/bts-arirang-tour";
const DATA_PATH = path.resolve("data/weverse-tour.json");
const USER_AGENT = "Mozilla/5.0 (compatible; BTSChileTourSync/1.0; +https://github.com/)";

const monthNames = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];

function decodeEntities(text){
  return text
    .replace(/&nbsp;|&#160;/gi," ")
    .replace(/&amp;/gi,"&")
    .replace(/&quot;/gi,'"')
    .replace(/&#39;|&apos;/gi,"'")
    .replace(/&lt;/gi,"<")
    .replace(/&gt;/gi,">")
    .replace(/&#x27;/gi,"'")
    .replace(/&#x2F;/gi,"/");
}

function htmlToText(html){
  return decodeEntities(
    html
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi," ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi," ")
      .replace(/<[^>]+>/g," ")
  ).replace(/\s+/g," ").trim();
}

async function fetchWithRetry(url, attempts=3){
  let last;
  for(let i=0;i<attempts;i++){
    try{
      const res = await fetch(url,{headers:{"user-agent":USER_AGENT,"accept-language":"en-US,en;q=0.9"}});
      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if(text.length < 500) throw new Error("Respuesta demasiado corta");
      return text;
    }catch(error){
      last=error;
      await new Promise(r=>setTimeout(r,1000*(i+1)));
    }
  }
  throw last;
}

function extractSantiago(text){
  const upper = text.toUpperCase();
  const start = upper.indexOf("SANTIAGO");
  if(start < 0) throw new Error("No encontré SANTIAGO en Weverse Spot");

  // El bloque siguiente es BUENOS AIRES en el calendario actual. Si cambia el orden,
  // se limita igualmente a un tramo corto para no mezclar otras ciudades.
  const nextKnown = upper.indexOf("BUENOS AIRES", start + 10);
  const end = nextKnown > start ? nextKnown : Math.min(text.length, start + 1400);
  const block = text.slice(start, end);

  // Weverse Spot suele escribir la serie así: 2026.10.14 / 10.16 / 10.17.
  // Por eso leemos una fecha completa y también las abreviadas que la siguen.
  const full = block.match(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/);
  if(!full) throw new Error("No encontré una fecha completa de Santiago en el bloque oficial");
  const baseYear = Number(full[1]);
  const baseMonth = Number(full[2]);
  const candidates = [`${baseYear}-${String(baseMonth).padStart(2,"0")}-${String(Number(full[3])).padStart(2,"0")}`];

  const tail = block.slice((full.index || 0) + full[0].length, (full.index || 0) + full[0].length + 180);
  for(const m of tail.matchAll(/(?:^|\s|\/)(\d{1,2})[.\/-](\d{1,2})(?=\s|\/|$)/g)){
    const month = Number(m[1]);
    const day = Number(m[2]);
    if(month >= 1 && month <= 12 && day >= 1 && day <= 31){
      candidates.push(`${baseYear}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`);
    }
  }

  // Incluimos también cualquier fecha completa adicional que aparezca en el mismo bloque.
  for(const m of block.matchAll(/(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/g)){
    candidates.push(`${m[1]}-${String(Number(m[2])).padStart(2,"0")}-${String(Number(m[3])).padStart(2,"0")}`);
  }

  const uniqueDates = [...new Set(candidates)]
    .filter(d => /^20\d{2}-\d{2}-\d{2}$/.test(d))
    .sort();

  if(uniqueDates.length === 0) throw new Error("No encontré fechas de Santiago en el bloque oficial");

  const venue = /ESTADIO\s+NACIONAL/i.test(block) ? "Estadio Nacional" : "Estadio Nacional";
  const shows = uniqueDates.map((date,index) => {
    const [y,m,d] = date.split("-").map(Number);
    return {
      label:`Show ${index+1}`,
      dateISO:`${date}T00:00:00-03:00`,
      pretty:`${d} ${monthNames[m-1]}`,
      venue
    };
  });
  return {venue,shows};
}

function comparable(data){
  return JSON.stringify((data.shows || []).map(({dateISO,venue}) => ({dateISO,venue})));
}

const current = JSON.parse(await fs.readFile(DATA_PATH,"utf8"));
const html = await fetchWithRetry(SOURCE_URL);
const text = htmlToText(html);
const parsed = extractSantiago(text);

const candidate = {
  ...current,
  source: SOURCE_URL,
  sourceLabel: "Weverse Spot · BTS WORLD TOUR ‘ARIRANG’",
  city: "Santiago",
  country: "Chile",
  venue: parsed.venue,
  shows: parsed.shows
};

if(comparable(candidate) === comparable(current)){
  console.log("✓ Weverse revisado: no hay cambios en Santiago.");
  process.exit(0);
}

candidate.lastUpdated = new Date().toISOString();
await fs.writeFile(DATA_PATH, JSON.stringify(candidate,null,2)+"\n","utf8");
console.log("✓ Calendario de Santiago actualizado desde Weverse Spot.");
console.log(candidate.shows.map(s => `${s.pretty} · ${s.venue}`).join("\n"));
