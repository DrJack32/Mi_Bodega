import type { Wine, WineFormData, WineType } from "@/lib/wineData";
import { parseWineText } from "@/lib/wineTextParser";

export const LOOKUP_FIELD_KEYS = [
  "name",
  "winery",
  "type",
  "country",
  "region",
  "denomination",
  "grapes",
  "agingCategory",
  "agingMonths",
  "alcohol",
  "volume",
] as const;

export type LookupFieldKey = (typeof LOOKUP_FIELD_KEYS)[number];

export type WineLookupResult = {
  barcode: string;
  fields: Partial<WineFormData>;
  source: "Open Food Facts" | "UPCitemdb" | "Mi Bodega";
  sourceUrl: string;
  fetchedAt: string;
  localWineId?: string;
};

type OpenFoodFactsProduct = {
  product_name?: unknown;
  product_name_es?: unknown;
  generic_name?: unknown;
  generic_name_es?: unknown;
  brands?: unknown;
  countries?: unknown;
  countries_tags?: unknown;
  origins?: unknown;
  origins_tags?: unknown;
  categories?: unknown;
  categories_tags?: unknown;
  labels?: unknown;
  labels_tags?: unknown;
  quantity?: unknown;
  nutriments?: unknown;
};

type OpenFoodFactsResponse = {
  code?: unknown;
  product?: unknown;
  status?: unknown;
};

type UpcItemDbItem = {
  title?: unknown;
  brand?: unknown;
  description?: unknown;
  category?: unknown;
  size?: unknown;
};

type UpcItemDbResponse = {
  code?: unknown;
  total?: unknown;
  items?: unknown;
};

const PRODUCT_FIELDS = [
  "code",
  "product_name",
  "product_name_es",
  "generic_name",
  "generic_name_es",
  "brands",
  "countries",
  "countries_tags",
  "origins",
  "origins_tags",
  "categories",
  "categories_tags",
  "labels",
  "labels_tags",
  "quantity",
  "nutriments",
].join(",");

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function textList(value: unknown) {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string").join(" ")
    : text(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function normalizeBarcode(value: string) {
  const barcode = value.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(barcode)) {
    throw new Error("El código de barras solo puede contener números.");
  }
  if (![8, 12, 13, 14].includes(barcode.length)) {
    throw new Error("Introduce un código EAN o UPC de 8, 12, 13 o 14 cifras.");
  }
  if (!hasValidGtinChecksum(barcode)) {
    throw new Error("El código no supera la comprobación de seguridad. Revísalo e inténtalo de nuevo.");
  }
  return barcode;
}

export function hasValidGtinChecksum(barcode: string) {
  if (!/^\d+$/.test(barcode) || ![8, 12, 13, 14].includes(barcode.length)) {
    return false;
  }
  const digits = [...barcode].map(Number);
  const check = digits.pop() ?? -1;
  const sum = digits
    .reverse()
    .reduce((total, digit, index) => total + digit * (index % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

function countryFromProduct(product: OpenFoodFactsProduct) {
  const raw = `${text(product.countries)} ${textList(product.countries_tags)}`.toLowerCase();
  if (/spain|españa|en:spain|es:espana/.test(raw)) return "España";
  if (/france|francia|en:france/.test(raw)) return "Francia";
  if (/italy|italia|en:italy/.test(raw)) return "Italia";
  if (/portugal|en:portugal/.test(raw)) return "Portugal";
  if (/germany|alemania|en:germany/.test(raw)) return "Alemania";
  if (/argentina|en:argentina/.test(raw)) return "Argentina";
  if (/chile|en:chile/.test(raw)) return "Chile";
  if (/united states|estados unidos|en:united-states/.test(raw)) return "Estados Unidos";
  return text(product.countries).split(",")[0]?.trim() ?? "";
}

function typeFromCategories(product: OpenFoodFactsProduct): WineType | undefined {
  const raw = `${text(product.categories)} ${textList(product.categories_tags)}`.toLowerCase();
  if (/sparkling|espumoso|champagne|cava/.test(raw)) return "espumoso";
  if (/ros[eé]|rosado|pink-wine/.test(raw)) return "rosado";
  if (/white-wine|vino blanco|vin blanc/.test(raw)) return "blanco";
  if (/red-wine|vino tinto|vin rouge/.test(raw)) return "tinto";
  if (/dessert-wine|vino dulce/.test(raw)) return "dulce";
  if (/fortified-wine|vino generoso|sherry|jerez/.test(raw)) return "generoso";
  if (/orange-wine/.test(raw)) return "orange";
  return undefined;
}

function normalizedVolume(value: unknown) {
  const raw = text(value).toLowerCase().replace(",", ".");
  const match = raw.match(/(\d+(?:\.\d+)?)\s*(ml|cl|l)\b/);
  if (!match) return "";
  const amount = Number(match[1]);
  if (!Number.isFinite(amount) || amount <= 0) return "";
  const millilitres =
    match[2] === "l" ? amount * 1000 : match[2] === "cl" ? amount * 10 : amount;
  return `${Math.round(millilitres)}ml`;
}

function alcoholFromProduct(product: OpenFoodFactsProduct) {
  const nutriments = asRecord(product.nutriments);
  const candidate = nutriments?.alcohol_100g ?? nutriments?.alcohol_value;
  const amount = typeof candidate === "number" ? candidate : Number(candidate);
  return Number.isFinite(amount) && amount > 0 && amount < 100 ? `${amount}%` : "";
}

export function fieldsFromOpenFoodFactsProduct(
  product: OpenFoodFactsProduct,
): Partial<WineFormData> {
  const name = text(product.product_name_es) || text(product.product_name);
  const winery = text(product.brands).split(",")[0]?.trim() ?? "";
  const description = [
    name,
    winery,
    text(product.generic_name_es),
    text(product.generic_name),
    text(product.categories),
    textList(product.categories_tags),
    text(product.labels),
    textList(product.labels_tags),
    text(product.origins),
    textList(product.origins_tags),
    text(product.countries),
  ]
    .filter(Boolean)
    .join("\n");
  const inferred = parseWineText(description);
  const type = typeFromCategories(product) ?? inferred.type;
  const country = inferred.country || countryFromProduct(product);
  const alcohol = inferred.alcohol || alcoholFromProduct(product);
  const volume = inferred.volume || normalizedVolume(product.quantity);

  const fields: Partial<WineFormData> = {
    name,
    winery,
    type,
    country,
    region: inferred.region,
    denomination: inferred.denomination,
    grapes: inferred.grapes,
    agingCategory: inferred.agingCategory,
    agingMonths: inferred.agingMonths,
    alcohol,
    volume,
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<WineFormData>;
}

export function fieldsFromUpcItemDbItem(
  item: UpcItemDbItem,
): Partial<WineFormData> {
  const name = text(item.title);
  const winery = text(item.brand);
  const description = [
    name,
    winery,
    text(item.description),
    text(item.category),
    text(item.size),
  ]
    .filter(Boolean)
    .join("\n");
  const inferred = parseWineText(description);

  const fields: Partial<WineFormData> = {
    name,
    winery,
    type: inferred.type,
    country: inferred.country,
    region: inferred.region,
    denomination: inferred.denomination,
    grapes: inferred.grapes,
    agingCategory: inferred.agingCategory,
    agingMonths: inferred.agingMonths,
    alcohol: inferred.alcohol,
    volume: inferred.volume || normalizedVolume(item.size),
  };

  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined && value !== ""),
  ) as Partial<WineFormData>;
}

export function lookupFromLocalWine(wine: Wine, barcode: string): WineLookupResult {
  const fields = Object.fromEntries(
    LOOKUP_FIELD_KEYS.map((key) => [key, wine[key]]).filter(([, value]) => value !== ""),
  ) as Partial<WineFormData>;
  return {
    barcode,
    fields,
    source: "Mi Bodega",
    sourceUrl: wine.dataSourceUrl,
    fetchedAt: new Date().toISOString(),
    localWineId: wine.id,
  };
}

export async function lookupOpenFoodFacts(
  rawBarcode: string,
  fetcher: typeof fetch = fetch,
): Promise<WineLookupResult | null> {
  const barcode = normalizeBarcode(rawBarcode);
  const endpoint = `https://world.openfoodfacts.org/api/v3.6/product/${barcode}.json?fields=${encodeURIComponent(PRODUCT_FIELDS)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetcher(endpoint, {
      headers: {
        Accept: "application/json",
        "User-Agent": "MiBodega/1.5.1 (github.com/DrJack32/Mi_Bodega)",
      },
      signal: controller.signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new Error(`La base de datos respondió con el error ${response.status}.`);
    }
    const payload = (await response.json()) as OpenFoodFactsResponse;
    const product = asRecord(payload.product) as OpenFoodFactsProduct | null;
    if (!product || payload.status === "failure" || payload.status === 0) return null;

    const fields = fieldsFromOpenFoodFactsProduct(product);
    if (Object.keys(fields).length === 0) return null;

    return {
      barcode,
      fields,
      source: "Open Food Facts",
      sourceUrl: `https://world.openfoodfacts.org/product/${barcode}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La consulta ha tardado demasiado. Comprueba la conexión e inténtalo de nuevo.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export async function lookupUpcItemDb(
  rawBarcode: string,
  fetcher: typeof fetch = fetch,
): Promise<WineLookupResult | null> {
  const barcode = normalizeBarcode(rawBarcode);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const response = await fetcher(
      `https://api.upcitemdb.com/prod/trial/lookup?upc=${encodeURIComponent(barcode)}`,
      { headers: { Accept: "application/json" }, signal: controller.signal },
    );
    // La modalidad gratuita puede agotar temporalmente sus 100 consultas diarias.
    // No debe impedir que la app continúe con OCR o entrada manual.
    if (response.status === 404 || response.status === 429) return null;
    if (!response.ok) {
      throw new Error(`La segunda base de datos respondió con el error ${response.status}.`);
    }
    const payload = (await response.json()) as UpcItemDbResponse;
    const items = Array.isArray(payload.items) ? payload.items : [];
    const item = asRecord(items[0]) as UpcItemDbItem | null;
    if (!item || payload.code === "INVALID_UPC" || payload.code === "NOT_FOUND") return null;

    const fields = fieldsFromUpcItemDbItem(item);
    if (Object.keys(fields).length === 0) return null;

    return {
      barcode,
      fields,
      source: "UPCitemdb",
      sourceUrl: `https://www.upcitemdb.com/upc/${barcode}`,
      fetchedAt: new Date().toISOString(),
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("La segunda consulta ha tardado demasiado.");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

/** Consulta fuentes independientes; una caída no anula el resultado de la otra. */
export async function lookupWineByBarcode(
  rawBarcode: string,
  fetcher: typeof fetch = fetch,
): Promise<WineLookupResult | null> {
  const barcode = normalizeBarcode(rawBarcode);
  let reachableSources = 0;
  let lastError: unknown;

  try {
    const result = await lookupOpenFoodFacts(barcode, fetcher);
    reachableSources += 1;
    if (result) return result;
  } catch (error) {
    lastError = error;
  }

  try {
    const result = await lookupUpcItemDb(barcode, fetcher);
    reachableSources += 1;
    if (result) return result;
  } catch (error) {
    lastError = error;
  }

  if (reachableSources === 0) {
    throw lastError instanceof Error
      ? lastError
      : new Error("No se pudo conectar con las bases de datos.");
  }
  return null;
}
