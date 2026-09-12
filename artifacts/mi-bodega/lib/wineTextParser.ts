import { WineFormData, WineType } from "@/contexts/WineContext";

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").replace(/^[-.,;:|]+|[-.,;:|]+$/g, "").trim();
}

function removeAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function looksLikeNoise(line: string) {
  const low = removeAccents(line.toLowerCase());
  if (line.length < 3 || line.length > 70 || !/[a-z]{3}/i.test(low)) return true;
  if (/\b(sulfitos?|sulfites?|sulphites?|embotellado|imported by|product of|750\s*ml|\d+[,.]?\d*\s*%\s*(?:vol|alc))\b/i.test(low)) return true;
  return false;
}

function looksLikeDescription(line: string) {
  const low = removeAccents(line.toLowerCase());
  return /^(?:vino|wine|vin|tinto|blanco|rosado|red wine|white wine|reserva|gran reserva|crianza|joven|denominacion|appellation|indicacion|protegida|espana|france|italia|bodega|bodegas|winery|chateau|domaine|elaborado|producido|seleccion|cosecha|organic|ecologico|contiene)\b/i.test(low)
    || /^(?:rioja|ribera del duero|rueda|priorat|rias baixas|cava|champagne|toro|somontano|bierzo|navarra|jerez)$/i.test(low)
    || /\b(?:d\.?o\.?c?a?\.?|denominacion de origen|appellation d.origine|\d{4}|\d+\s*(?:ml|cl)|\d+\s*%|www\.)\b/i.test(low)
    || /[.!?]/.test(line)
    || line.split(/\s+/).length > 6;
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

  const vintage = searchable.match(/\b(19[5-9]\d|20[0-3]\d)\b/g)?.find(value => Number(value) <= new Date().getFullYear() + 1);
  if (vintage) fields.vintage = vintage;

  const alcohol = searchable.match(/\b(\d{1,2}(?:[,.]\d)?)\s*%\s*(?:vol\.?|alc\.?)?/i);
  if (alcohol && Number(alcohol[1].replace(',', '.')) <= 25) fields.alcohol = `${alcohol[1].replace(",", ".")}%`;

  const volume = searchable.match(/\b(\d{2,4})\s*m\s*l\b|\b(\d{2,3})\s*c\s*l\b|\b(\d[,.]\d{1,2})\s*l\b/i);
  if (volume) {
    const ml = volume[1] ? Number(volume[1]) : volume[2] ? Number(volume[2]) * 10 : Math.round(Number(volume[3].replace(',', '.')) * 1000);
    if (ml >= 187 && ml <= 3000) fields.volume = `${ml}ml`;
  }

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
    [/\b(rioja|ribera del duero|priorat|rias baixas|bierzo|cava|sherry|jerez|toro|somontano|rueda|yecla|jumilla|montsant|navarra|valdepenas)\b/i, "España"],
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

  const denomination = normalized.match(/\b(?:D\.?O\.?\s*(?:Ca\.?|P\.?|C\.?)?|Denominaci[oó]n de Origen(?: Calificada)?)\s*[:.-]?\s*([^\n,.;\d]+)/i);
  if (denomination?.[1]) {
    const value = cleanLine(denomination[1]);
    if (value.length > 2 && value.length < 60) fields.denomination = value;
  }

  const regionMap: Array<[RegExp, string]> = [
    [/rioja/i, "La Rioja"],
    [/ribera del duero/i, "Castilla y León"],
    [/priorat/i, "Cataluña"],
    [/rias baixas/i, "Galicia"],
    [/penedes/i, "Cataluña"],
    [/bierzo/i, "Castilla y León"],
    [/rueda/i, "Castilla y León"],
    [/toro/i, "Castilla y León"],
    [/navarra/i, "Navarra"],
    [/somontano/i, "Aragón"],
  ];
  for (const [pattern, region] of regionMap) {
    if (pattern.test(searchable)) {
      fields.region = region;
      break;
    }
  }

  // El OCR devuelve líneas en un orden visual imperfecto. Nunca inferimos la bodega
  // de la segunda línea: suele ser la añada, el tipo o la denominación.
  const winery = labelLines.find(line =>
    /^(?:bodegas?|winery|ch[aâ]teau|domaine|cantina|cellers?)\s+\S+/i.test(line),
  );
  if (winery) fields.winery = winery.slice(0, 80);

  const name = labelLines.slice(0, 8).find(line =>
    line.length >= 3 && line.length <= 48 && !looksLikeDescription(line) && line !== winery,
  );
  if (name) fields.name = name.slice(0, 80);

  return fields;
}
