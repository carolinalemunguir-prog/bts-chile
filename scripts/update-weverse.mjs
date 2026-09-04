import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "playwright";

const SOURCE_URL = "https://spot.weverse.io/bts-arirang-tour";
const DATA_PATH = path.resolve("data/weverse-tour.json");

const monthNames = [
  "enero","febrero","marzo","abril","mayo","junio",
  "julio","agosto","septiembre","octubre","noviembre","diciembre"
];

function extractSantiago(text) {
  const upper = text.toUpperCase();

  const start = upper.indexOf("SANTIAGO");

  if (start < 0) {
    throw new Error("No encontré SANTIAGO después de cargar Weverse Spot");
  }

  const nextCity = upper.indexOf("BUENOS AIRES", start + 10);
  const end = nextCity > start ? nextCity : Math.min(text.length, start + 1500);

  const block = text.slice(start, end);

  const full = block.match(
    /(20\d{2})[.\/-](\d{1,2})[.\/-](\d{1,2})/
  );

  if (!full) {
    throw new Error("No encontré la primera fecha de Santiago");
  }

  const year = Number(full[1]);
  const month = Number(full[2]);

  const dates = [
    `${year}-${String(month).padStart(2,"0")}-${String(Number(full[3])).padStart(2,"0")}`
  ];

  const rest = block.slice(
    (full.index ?? 0) + full[0].length
  );

  for (const match of rest.matchAll(
    /\/\s*(\d{1,2})[.\/-](\d{1,2})/g
  )) {
    const m = Number(match[1]);
    const d = Number(match[2]);

    if (m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      dates.push(
        `${year}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`
      );
    }
  }

  const uniqueDates = [...new Set(dates)].sort();

  if (!uniqueDates.length) {
    throw new Error("No encontré fechas de Santiago");
  }

  return {
    venue: /ESTADIO\s+NACIONAL/i.test(block)
      ? "Estadio Nacional"
      : "Estadio Nacional",

    shows: uniqueDates.map((date, index) => {
      const [y, m, d] = date.split("-").map(Number);

      return {
        label: `Show ${index + 1}`,
        dateISO: `${date}T00:00:00-03:00`,
        pretty: `${d} ${monthNames[m - 1]}`,
        venue: "Estadio Nacional"
      };
    })
  };
}

function comparable(data) {
  return JSON.stringify(
    (data.shows || []).map(({ dateISO, venue }) => ({
      dateISO,
      venue
    }))
  );
}

const current = JSON.parse(
  await fs.readFile(DATA_PATH, "utf8")
);

console.log("Abriendo Weverse Spot…");

const browser = await chromium.launch({
  headless: true
});

let parsed;

try {
  const page = await browser.newPage({
    locale: "en-US"
  });

  await page.goto(SOURCE_URL, {
    waitUntil: "domcontentloaded",
    timeout: 60000
  });

  await page.waitForFunction(
    () =>
      document.body?.innerText
        ?.toUpperCase()
        .includes("SANTIAGO"),
    { timeout: 45000 }
  );

  const text = await page.locator("body").innerText();

  parsed = extractSantiago(text);

} finally {
  await browser.close();
}

const candidate = {
  ...current,
  source: SOURCE_URL,
  sourceLabel: "Weverse Spot · BTS WORLD TOUR ‘ARIRANG’",
  city: "Santiago",
  country: "Chile",
  venue: parsed.venue,
  shows: parsed.shows
};

if (comparable(candidate) === comparable(current)) {
  console.log("✓ Weverse revisado: Santiago no tiene cambios.");
  process.exit(0);
}

candidate.lastUpdated = new Date().toISOString();

await fs.writeFile(
  DATA_PATH,
  JSON.stringify(candidate, null, 2) + "\n",
  "utf8"
);

console.log("✓ Calendario actualizado desde Weverse Spot.");

for (const show of candidate.shows) {
  console.log(`${show.pretty} · ${show.venue}`);
}
