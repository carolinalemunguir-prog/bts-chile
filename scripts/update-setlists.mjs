import fs from "node:fs/promises";
import path from "node:path";

const API_KEY = process.env.SETLISTFM_API_KEY || "";
const BTS_MBID = "0d79fe8e-ba27-4859-bb8c-2f255f346853";
const TOUR = "ARIRANG";
const YEAR = 2026;
const DATA_PATH = path.resolve("data/setlists.json");

// IMPORTANTE: setlist.fm usa /rest/ en la URL real de la API.
const API_URL = "https://api.setlist.fm/rest/1.0/search/setlists";

const CORE_THRESHOLD = 0.68;

const monthNames = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre"
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseEventDate(value) {
  const m = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!m) return null;

  const [, dd, mm, yyyy] = m;

  return new Date(`${yyyy}-${mm}-${dd}T12:00:00Z`);
}

function prettyDate(value) {
  const m = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);

  if (!m) return value || "";

  return `${Number(m[1])} ${monthNames[Number(m[2]) - 1]}`;
}

function isoDate(value) {
  const m = String(value || "").match(/^(\d{2})-(\d{2})-(\d{4})$/);

  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
}

function normalizeSong(song) {
  return String(song || "")
    .toLocaleLowerCase("en")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function flattenSongs(setlist) {
  const sets = Array.isArray(setlist?.set) ? setlist.set : [];
  const songs = [];

  for (const block of sets) {
    const blockSongs = Array.isArray(block?.song) ? block.song : [];

    for (const song of blockSongs) {
      if (!song?.name || song?.tape) continue;

      songs.push(song.name.trim());
    }
  }

  return songs;
}

async function fetchPage(page) {
  const params = new URLSearchParams({
    artistMbid: BTS_MBID,
    tourName: TOUR,
    year: String(YEAR),
    p: String(page)
  });

  const url = `${API_URL}?${params.toString()}`;

  console.log(`Consultando setlist.fm · página ${page}...`);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "Accept-Language": "es",
      "x-api-key": API_KEY,
      "User-Agent":
        "BTSChileARMYTracker/1.0 (non-commercial BTS Chile fan project)"
    }
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");

    throw new Error(
      `setlist.fm HTTP ${response.status}: ${body.slice(0, 400)}`
    );
  }

  return response.json();
}

async function fetchAll() {
  const all = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total && page <= 20) {
    const data = await fetchPage(page);

    const rows = Array.isArray(data.setlist) ? data.setlist : [];

    total = Number(data.total || rows.length || 0);

    all.push(...rows);

    console.log(
      `Página ${page}: ${rows.length} setlists · acumulados ${all.length}/${total}`
    );

    if (rows.length === 0) break;

    page += 1;

    if (all.length < total) {
      await sleep(400);
    }
  }

  return all;
}

if (!API_KEY) {
  throw new Error(
    "SETLISTFM_API_KEY no está configurada en GitHub Repository Secrets."
  );
}

console.log("🎵 Iniciando actualización del Song Tracker...");
console.log(`Tour buscado: ${TOUR} ${YEAR}`);

const today = new Date();

const all = await fetchAll();

console.log(`Setlists recibidos desde setlist.fm: ${all.length}`);

const completed = all
  .filter(
    (show) =>
      String(show?.tour?.name || "").toUpperCase() === TOUR.toUpperCase()
  )
  .filter((show) => {
    const date = parseEventDate(show.eventDate);
    const songs = flattenSongs(show);

    return date && date <= today && songs.length > 0;
  })
  .sort(
    (a, b) =>
      parseEventDate(a.eventDate) - parseEventDate(b.eventDate)
  );

if (completed.length === 0) {
  throw new Error(
    "La API respondió correctamente, pero no encontré conciertos ARIRANG 2026 ya realizados con canciones cargadas."
  );
}

console.log(`Shows completos encontrados: ${completed.length}`);

// Calcula cuántos conciertos contienen cada canción.
// Una canción cuenta máximo una vez por concierto.
const songMeta = new Map();

for (const show of completed) {
  const uniqueSongs = new Map();

  for (const name of flattenSongs(show)) {
    const key = normalizeSong(name);

    if (key && !uniqueSongs.has(key)) {
      uniqueSongs.set(key, name);
    }
  }

  for (const [key, name] of uniqueSongs) {
    const current = songMeta.get(key) || {
      name,
      count: 0
    };

    current.count += 1;

    if (!current.name) {
      current.name = name;
    }

    songMeta.set(key, current);
  }
}

// Canciones presentes en al menos el 68% de los shows:
// se consideran parte estable/base del set.
const coreSongs = [...songMeta.values()]
  .filter(
    (song) =>
      song.count / completed.length >= CORE_THRESHOLD
  )
  .map((song) => song.name)
  .sort((a, b) => a.localeCompare(b));

const coreKeys = new Set(
  coreSongs.map((song) => normalizeSong(song))
);

// Canciones variables/especiales + ciudad/fecha.
const specialOccurrences = [];

for (const show of completed) {
  const city =
    show?.venue?.city?.name ||
    show?.venue?.name ||
    "Ciudad";

  const country =
    show?.venue?.city?.country?.name || "";

  const date = prettyDate(show.eventDate);
  const dateISO = isoDate(show.eventDate);

  const seen = new Set();

  for (const song of flattenSongs(show)) {
    const key = normalizeSong(song);

    if (!key) continue;
    if (seen.has(key)) continue;
    if (coreKeys.has(key)) continue;

    seen.add(key);

    specialOccurrences.push({
      song,
      city,
      country,
      date,
      dateISO,
      venue: show?.venue?.name || "",
      setlistId: show.id || "",
      versionId: show.versionId || "",
      url: show.url || ""
    });
  }
}

// Guardamos también cada concierto completo.
const shows = completed.map((show) => ({
  id: show.id || "",
  versionId: show.versionId || "",
  eventDate: show.eventDate || "",
  dateISO: isoDate(show.eventDate),
  city: show?.venue?.city?.name || "",
  country: show?.venue?.city?.country?.name || "",
  venue: show?.venue?.name || "",
  url: show.url || "",
  songs: flattenSongs(show)
}));

const output = {
  source: "https://api.setlist.fm/",
  sourceLabel: "setlist.fm API",
  artist: "BTS",
  artistMbid: BTS_MBID,
  tour: TOUR,
  year: YEAR,
  lastUpdated: new Date().toISOString(),
  completedShows: completed.length,
  coreThreshold: CORE_THRESHOLD,
  coreSongs,
  specialOccurrences,
  shows
};

await fs.writeFile(
  DATA_PATH,
  JSON.stringify(output, null, 2) + "\n",
  "utf8"
);

console.log("");
console.log("✅ Song Tracker actualizado correctamente.");
console.log(`Shows procesados: ${completed.length}`);
console.log(`Canciones base: ${coreSongs.length}`);
console.log(
  `Apariciones de canciones especiales: ${specialOccurrences.length}`
);
