import { WineFormData, WineType } from "@/contexts/WineContext";

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").replace(/^[-.,;:|]+|[-.,;:|]+$/g, "").trim();
}

function removeAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function looksLikeNoise(line: string) {
  const low = removeAccents(line.toLowerCase());
  if (line.length < 3 || line.length > 70) return true;
  if (/^[\d\s.,%/:-]+$/.test(line)) return true;
  return [
    "contains sulfites",
    "contiene sulfitos",
    "contains sulphites",
    "produced by",
    "bottled by",
    "embotellado",
    "imported by",
    "product of",
    "750",
    "ml",
    "vol",
    "alc",
  ].some(term => low.includes(term));
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function parseWineText(text: string): Partial<WineFormData> {
  const fields: Partial<WineFormData> = {};
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const searchable = removeAccents(normalized.toLowerCase());
  const labelLines = normalized
    .split("\n")
    .map(cleanLine)
    .filter(line => line && !looksLikeNoise(line));

  const vintage = searchable.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (vintage) fields.vintage = vintage[1];

  const alcohol = searchable.match(/(\d{1,2}[,.]?\d?)\s*%\s*(vol\.?|alc\.?|alcohol)?/i);
  if (alcohol) fields.alcohol = `${alcohol[1].replace(",", ".")}%`;

  const volume = searchable.match(/(\d{2,3})\s*ml|75\s*cl/i);
  if (volume) fields.volume = volume[0].includes("cl") ? "750ml" : `${volume[1]}ml`;

  const typePatterns: Array<[RegExp, WineType]> = [
    [/\b(tinto|rouge|rosso|red wine|vino tinto)\b/i, "tinto"],
    [/\b(blanco|blanc|bianco|white wine|vino blanco)\b/i, "blanco"],
    [/\b(rosado|rose|rosato)\b/i, "rosado"],
    [/\b(cava|champagne|espumoso|prosecco|frizzante|spumante|cremant)\b/i, "espumoso"],
  ];
  for (const [pattern, type] of typePatterns) {
    if (pattern.test(searchable)) {
      fields.type = type;
      break;
    }
  }

  const countryMap: Array<[RegExp, string]> = [
    [/\b(rioja|ribera del duero|priorat|rias baixas|bierzo|cava|sherry|jerez|toro|somontano|rueda|yecla|jumilla|montsant|navarra|valdepenas)\b/i, "Espana"],
    [/\b(bordeaux|bourgogne|burgundy|champagne|rhone|alsace|loire|provence|languedoc)\b/i, "Francia"],
    [/\b(toscana|piemonte|veneto|sicilia|puglia|barolo|chianti|brunello|amarone|soave|gavi)\b/i, "Italia"],
    [/\b(napa valley|sonoma|california|oregon|washington state)\b/i, "Estados Unidos"],
    [/\b(douro|alentejo|vinho verde|dao|bairrada)\b/i, "Portugal"],
    [/\b(mendoza|patagonia|salta)\b/i, "Argentina"],
    [/\b(maipo|colchagua|casablanca valley|aconcagua)\b/i, "Chile"],
  ];
  for (const [pattern, country] of countryMap) {
    if (pattern.test(searchable)) {
      fields.country = country;
      break;
    }
  }

  const grapes = [
    "tempranillo", "garnacha", "graciano", "mazuelo", "cabernet sauvignon",
    "cabernet franc", "merlot", "syrah", "shiraz", "chardonnay",
    "sauvignon blanc", "riesling", "pinot noir", "pinot grigio",
    "albarino", "mencia", "monastrell", "bobal", "verdejo",
    "viura", "macabeo", "palomino", "godello", "treixadura", "grenache",
    "mourvedre", "sangiovese", "nebbiolo", "barbera", "dolcetto",
    "vermentino", "primitivo", "nero d avola",
  ];
  const found = grapes.filter(grape => new RegExp(`\\b${grape}\\b`, "i").test(searchable));
  if (found.length) fields.grapes = found.map(titleCase).join(", ");

  const denomination = normalized.match(/D\.?O\.?\s*(?:Ca\.?|P\.?|C\.?)?\s*([A-Za-z\u00C0-\u024F\s]+?)(?:\n|,|\.|\d|$)/i);
  if (denomination?.[1]) {
    const value = cleanLine(denomination[1]);
    if (value.length > 2 && value.length < 60) fields.denomination = value;
  }

  const regionMap: Array<[RegExp, string]> = [
    [/rioja/i, "La Rioja"],
    [/ribera del duero/i, "Castilla y Leon"],
    [/priorat/i, "Cataluna"],
    [/rias baixas/i, "Galicia"],
    [/penedes/i, "Cataluna"],
    [/bierzo/i, "Castilla y Leon"],
    [/rueda/i, "Castilla y Leon"],
    [/toro/i, "Castilla y Leon"],
    [/navarra/i, "Navarra"],
    [/somontano/i, "Aragon"],
  ];
  for (const [pattern, region] of regionMap) {
    if (pattern.test(searchable)) {
      fields.region = region;
      break;
    }
  }

  if (labelLines[0]) fields.name = labelLines[0].slice(0, 80);
  if (labelLines.length > 1) {
    const winery = labelLines.slice(1, 7).find(line =>
      /\b(bodega|bodegas|winery|chateau|domaine|cantina|cellar|cellers|vina)\b/i.test(removeAccents(line)),
    );
    fields.winery = (winery ?? labelLines[1]).slice(0, 80);
  }

  return fields;
}
