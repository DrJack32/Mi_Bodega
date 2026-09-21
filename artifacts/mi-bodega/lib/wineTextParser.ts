import { WineFormData, WineType } from "@/contexts/WineContext";

function cleanLine(line: string) {
  return line
    .replace(/\s+/g, " ")
    .replace(/^[-.,;:|]+|[-.,;:|]+$/g, "")
    .trim();
}

function removeAccents(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function romanYear(value: string) {
  const roman = value.toUpperCase();
  if (!/^[MDCLXVI]+$/.test(roman) || roman.length < 4) return null;
  const values: Record<string, number> = {
    M: 1000,
    D: 500,
    C: 100,
    L: 50,
    X: 10,
    V: 5,
    I: 1,
  };
  let total = 0;
  for (let index = 0; index < roman.length; index += 1) {
    const current = values[roman[index]];
    const next = values[roman[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }
  const maxYear = new Date().getFullYear() + 1;
  return total >= 1950 && total <= maxYear ? String(total) : null;
}

function looksLikeNoise(line: string) {
  const low = removeAccents(line.toLowerCase());
  if (line.length < 3 || line.length > 70 || !/[a-z]{3}/i.test(low))
    return true;
  if (
    /\b(sulfitos?|sulfites?|sulphites?|embotellado|imported by|product of|750\s*ml|\d+[,.]?\d*\s*%\s*(?:vol|alc))\b/i.test(
      low,
    )
  )
    return true;
  return false;
}

function looksLikeDescription(line: string) {
  const low = removeAccents(line.toLowerCase());
  return (
    Boolean(romanYear(line)) ||
    /^(?:vino|wine|vin|tinto|blanco|rosado|red wine|white wine|reserva|gran reserva|crianza|joven|denominacion|appellation|indicacion|protegida|espana|france|italia|bodega|bodegas|winery|chateau|domaine|elaborado|producido|seleccion|cosecha|organic|ecologico|contiene)\b/i.test(
      low,
    ) ||
    /^(?:rioja|ribera del duero|rueda|priorat|rias baixas|cava|champagne|toro|somontano|bierzo|navarra|jerez)$/i.test(
      low,
    ) ||
    /\b(?:d\.?o\.?c?a?\.?|denominacion de origen|appellation d.origine|\d{4}|\d+\s*(?:ml|cl)|\d+\s*%|www\.)\b/i.test(
      low,
    ) ||
    /[.!?]/.test(line) ||
    line.split(/\s+/).length > 6
  );
}

function titleCase(value: string) {
  return value
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

type AppellationMatch = {
  pattern: RegExp;
  denomination: string;
  region: string;
  country: string;
};

const APPELLATIONS: AppellationMatch[] = [
  {
    pattern: /\b(?:vino de la tierra de|i\.?g\.?p\.?)\s+castilla y le[oó]n\b/i,
    denomination: "IGP Vino de la Tierra de Castilla y León",
    region: "Castilla y León",
    country: "España",
  },
  {
    pattern: /\bjumilla\b/i,
    denomination: "DOP Jumilla",
    region: "Murcia",
    country: "España",
  },
  {
    pattern: /\byecla\b/i,
    denomination: "DOP Yecla",
    region: "Murcia",
    country: "España",
  },
  {
    pattern: /\bbullas\b/i,
    denomination: "DOP Bullas",
    region: "Murcia",
    country: "España",
  },
  {
    pattern: /\brioja\b/i,
    denomination: "DOCa Rioja",
    region: "La Rioja",
    country: "España",
  },
  {
    pattern: /\bribera del duero\b/i,
    denomination: "DOP Ribera del Duero",
    region: "Castilla y León",
    country: "España",
  },
  {
    pattern: /\brias baixas\b/i,
    denomination: "DOP Rías Baixas",
    region: "Galicia",
    country: "España",
  },
  {
    pattern: /\bpriorat\b/i,
    denomination: "DOCa Priorat",
    region: "Cataluña",
    country: "España",
  },
  {
    pattern: /\bpenedes\b/i,
    denomination: "DOP Penedès",
    region: "Cataluña",
    country: "España",
  },
  {
    pattern: /\bbierzo\b/i,
    denomination: "DOP Bierzo",
    region: "Castilla y León",
    country: "España",
  },
  {
    pattern: /\brueda\b/i,
    denomination: "DOP Rueda",
    region: "Castilla y León",
    country: "España",
  },
  {
    pattern: /\btoro\b/i,
    denomination: "DOP Toro",
    region: "Castilla y León",
    country: "España",
  },
  {
    pattern: /\bsomontano\b/i,
    denomination: "DOP Somontano",
    region: "Aragón",
    country: "España",
  },
  {
    pattern: /\bnavarra\b/i,
    denomination: "DOP Navarra",
    region: "Navarra",
    country: "España",
  },
];

function cleanWinery(value: string) {
  return cleanLine(value)
    .replace(/\s+S\.?\s*[AL]\.?\s*(?:U\.?)?\b.*$/i, "")
    .replace(/\s+(?:R\.?\s*E\.?|registro)\s*[:.-]?\s*[A-Z0-9-]+.*$/i, "")
    .trim();
}

function wineryBrand(value: string) {
  return value
    .replace(/^(?:bodegas?|winery|ch[aâ]teau|domaine|cantina|cellers?)\s+/i, "")
    .trim();
}

function editDistance(a: string, b: string) {
  const previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      diagonal = above;
    }
  }
  return previous[b.length];
}

export function parseWineText(text: string): Partial<WineFormData> {
  const fields: Partial<WineFormData> = {};
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const searchable = removeAccents(normalized.toLowerCase());
  const allLines = normalized.split("\n").map(cleanLine).filter(Boolean);
  const labelLines = allLines.filter((line) => !looksLikeNoise(line));

  const numericVintage = searchable
    .match(/\b(19[5-9]\d|20[0-3]\d)\b/g)
    ?.find((value) => Number(value) <= new Date().getFullYear() + 1);
  const romanVintage = normalized
    .match(/\b[MDCLXVI]{4,}\b/gi)
    ?.map(romanYear)
    .find((value): value is string => Boolean(value));
  const vintage = numericVintage || romanVintage;
  if (vintage) fields.vintage = vintage;

  const alcohol = searchable.match(
    /\b(\d{1,2}(?:[,.]\d)?)\s*%\s*(?:vol\.?|alc\.?)?/i,
  );
  if (alcohol && Number(alcohol[1].replace(",", ".")) <= 25)
    fields.alcohol = `${alcohol[1].replace(",", ".")}%`;

  const volume = searchable.match(
    /\b(\d{2,4})\s*m\s*l\b|\b(\d{2,3})\s*c\s*l\b|\b(\d[,.]\d{1,2})\s*l\b/i,
  );
  if (volume) {
    const ml = volume[1]
      ? Number(volume[1])
      : volume[2]
        ? Number(volume[2]) * 10
        : Math.round(Number(volume[3].replace(",", ".")) * 1000);
    if (ml >= 187 && ml <= 3000) fields.volume = `${ml}ml`;
  }

  const typePatterns: Array<[RegExp, WineType]> = [
    [/\b(tinto|rouge|rosso|red wine|vino tinto)\b/i, "tinto"],
    [/\b(blanco|blanc|bianco|white wine|vino blanco)\b/i, "blanco"],
    [/\b(rosado|rose|rosato)\b/i, "rosado"],
    [
      /\b(cava|champagne|espumoso|prosecco|frizzante|spumante|cremant)\b/i,
      "espumoso",
    ],
  ];
  for (const [pattern, type] of typePatterns) {
    if (pattern.test(searchable)) {
      fields.type = type;
      break;
    }
  }

  const countryMap: Array<[RegExp, string]> = [
    [
      /\b(rioja|ribera del duero|priorat|rias baixas|bierzo|cava|sherry|jerez|toro|somontano|rueda|yecla|jumilla|montsant|navarra|valdepenas)\b/i,
      "España",
    ],
    [
      /\b(bordeaux|bourgogne|burgundy|champagne|rhone|alsace|loire|provence|languedoc)\b/i,
      "Francia",
    ],
    [
      /\b(toscana|piemonte|veneto|sicilia|puglia|barolo|chianti|brunello|amarone|soave|gavi)\b/i,
      "Italia",
    ],
    [
      /\b(napa valley|sonoma|california|oregon|washington state)\b/i,
      "Estados Unidos",
    ],
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
    "tempranillo",
    "garnacha",
    "graciano",
    "mazuelo",
    "cabernet sauvignon",
    "cabernet franc",
    "merlot",
    "syrah",
    "shiraz",
    "chardonnay",
    "sauvignon blanc",
    "riesling",
    "pinot noir",
    "pinot grigio",
    "albarino",
    "mencia",
    "monastrell",
    "bobal",
    "verdejo",
    "viura",
    "macabeo",
    "palomino",
    "godello",
    "treixadura",
    "grenache",
    "mourvedre",
    "sangiovese",
    "nebbiolo",
    "barbera",
    "dolcetto",
    "vermentino",
    "primitivo",
    "nero d avola",
  ];
  const found = grapes.filter((grape) =>
    new RegExp(`\\b${grape}\\b`, "i").test(searchable),
  );
  if (found.length) fields.grapes = found.map(titleCase).join(", ");

  const agingPatterns: Array<[RegExp, string]> = [
    [/\bgran reserva\b/i, "Gran Reserva"],
    [/\breserva especial\b/i, "Reserva Especial"],
    [/\bcrianza biologica\b/i, "Crianza biológica"],
    [/\bcrianza oxidativa\b/i, "Crianza oxidativa"],
    [/\bcriaderas? y solera\b|\bsolera\b/i, "Criaderas y solera"],
    [/\bsobre lias\b/i, "Sobre lías"],
    [/\breserva\b/i, "Reserva"],
    [/\bcrianza\b/i, "Crianza"],
    [/\broble\b|\boak aged\b/i, "Roble"],
    [/\bjoven\b|\bsin crianza\b/i, "Joven / Sin crianza"],
  ];
  const aging = agingPatterns.find(([pattern]) => pattern.test(searchable));
  if (aging) fields.agingCategory = aging[1];

  const agingMonths = searchable.match(
    /\b(\d{1,3})\s*meses?(?:\s+de)?(?:\s+(?:crianza|envejecimiento|barrica))?\b|\b(?:aged|ageing)\s+(\d{1,3})\s*months?\b/i,
  );
  if (agingMonths) fields.agingMonths = agingMonths[1] || agingMonths[2];

  const appellation = APPELLATIONS.find(({ pattern }) =>
    pattern.test(searchable),
  );
  if (appellation) {
    fields.denomination = appellation.denomination;
    fields.region = appellation.region;
    fields.country = appellation.country;
  } else {
    // No dejamos que \s atraviese un salto de línea: un encabezado genérico de
    // "Denominación de origen" no debe capturar como valor la línea siguiente.
    const denomination = normalized.match(
      /\b(?:D\.?O\.?[ \t]*(?:Ca\.?|P\.?|C\.?)?|Denominaci[oó]n de Origen(?: Calificada| Protegida)?)[ \t]*[:.-]?[ \t]+([^\n,.;\d]+)/i,
    );
    if (denomination?.[1]) {
      const value = cleanLine(denomination[1]);
      const low = removeAccents(value.toLowerCase());
      if (
        value.length > 2 &&
        value.length < 60 &&
        !/^(?:protegida|calificada|protected|appellation)$/i.test(low)
      ) {
        fields.denomination = value;
      }
    }
  }

  // El OCR devuelve líneas en un orden visual imperfecto. Nunca inferimos la bodega
  // de la segunda línea: suele ser la añada, el tipo o la denominación.
  const rawWineryLine = allLines.find((line) =>
    /\b(?:bodegas?|winery|ch[aâ]teau|domaine|cantina|cellers?)\s+\S+/i.test(
      line,
    ),
  );
  const rawWinery = rawWineryLine?.match(
    /\b(?:bodegas?|winery|ch[aâ]teau|domaine|cantina|cellers?)\s+.+/i,
  )?.[0];
  const winery = rawWinery ? cleanWinery(rawWinery) : undefined;
  if (winery) fields.winery = winery.slice(0, 80);

  let name = labelLines
    .slice(0, 12)
    .find(
      (line) =>
        line.length >= 3 &&
        line.length <= 48 &&
        !looksLikeDescription(line) &&
        line !== rawWinery &&
        !/^(?:cepas viejas|old vines|desde\s+\d{4})$/i.test(
          removeAccents(line),
        ),
    );

  // Si el OCR confunde una sola letra del nombre pero la contraetiqueta contiene
  // la bodega correctamente (Alceñe / Bodegas Alceño), usamos la grafía fiable.
  if (name && winery) {
    const brand = wineryBrand(winery);
    const comparableName = removeAccents(name.toLowerCase()).replace(
      /[^a-z0-9]/g,
      "",
    );
    const comparableBrand = removeAccents(brand.toLowerCase()).replace(
      /[^a-z0-9]/g,
      "",
    );
    if (
      comparableBrand.length >= 4 &&
      comparableName.length >= 4 &&
      editDistance(comparableName, comparableBrand) <= 1
    ) {
      name = brand;
    }
  }
  if (name) fields.name = name.slice(0, 80);

  return fields;
}
