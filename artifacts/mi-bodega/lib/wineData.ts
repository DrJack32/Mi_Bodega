export type WineType =
  | "tinto"
  | "blanco"
  | "rosado"
  | "espumoso"
  | "generoso"
  | "dulce"
  | "orange"
  | "otro";

export interface WineTasting {
  id: string;
  date: string;
  location: string;
  price: string;
  rating: number;
  wouldRepeat: boolean | null;
  notes: string;
  quantity: number;
  fromStock: boolean;
  createdAt: string;
}

export interface WineStock {
  id: string;
  location: string;
  quantity: number;
  purchasedQuantity: number;
  price: string;
  addedAt: string;
}

export interface Wine {
  id: string;
  photos: string[];
  name: string;
  winery: string;
  vintage: string;
  type: WineType;
  country: string;
  region: string;
  denomination: string;
  grapes: string;
  alcohol: string;
  volume: string;
  /** Resumen de la cata más reciente. Se conserva para copias antiguas. */
  date: string;
  location: string;
  price: string;
  rating: number;
  wouldRepeat: boolean | null;
  notes: string;
  tastings: WineTasting[];
  stock: WineStock[];
  isFavorite: boolean;
  createdAt: string;
  ocrUsed: boolean;
}

export type WineFormData = Omit<
  Wine,
  "id" | "createdAt" | "tastings" | "stock"
>;

export type TastingFormData = Omit<WineTasting, "id" | "createdAt">;
export type StockFormData = Omit<
  WineStock,
  "id" | "addedAt" | "purchasedQuantity"
>;

export type InitialWineEntry =
  | { kind: "tasted" }
  | { kind: "cellar"; location: string; quantity: number; price: string };

const WINE_TYPES = new Set<WineType>([
  "tinto",
  "blanco",
  "rosado",
  "espumoso",
  "generoso",
  "dulce",
  "orange",
  "otro",
]);

const STRING_FIELDS = [
  "name",
  "winery",
  "vintage",
  "country",
  "region",
  "denomination",
  "grapes",
  "alcohol",
  "volume",
] as const;

function createId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

function asDate(value: unknown) {
  const candidate = asString(value);
  return Number.isNaN(Date.parse(candidate))
    ? new Date().toISOString()
    : candidate;
}

function asQuantity(value: unknown, fallback = 1) {
  const quantity = Number(value);
  if (!Number.isFinite(quantity)) return fallback;
  return Math.max(0, Math.min(100_000, Math.floor(quantity)));
}

function asRating(value: unknown) {
  const rating = Number(value);
  return Number.isFinite(rating)
    ? Math.max(0, Math.min(10, Math.round(rating)))
    : 0;
}

function uniqueId(value: unknown, usedIds: Set<string>) {
  const rawId = asString(value).trim();
  let id = rawId || createId();
  while (usedIds.has(id)) id = createId();
  usedIds.add(id);
  return id;
}

export function normalizePriceNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value !== "string") return 0;

  const normalized = value
    .trim()
    .replace(/\s/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const amount = Number.parseFloat(normalized);
  return Number.isFinite(amount) && amount > 0 ? amount : 0;
}

export function createTasting(
  data: Omit<TastingFormData, "fromStock"> & { fromStock?: boolean },
): WineTasting {
  return {
    ...data,
    quantity: asQuantity(data.quantity, 1) || 1,
    rating: asRating(data.rating),
    fromStock: data.fromStock === true,
    id: createId(),
    createdAt: new Date().toISOString(),
  };
}

export function createStock(data: StockFormData): WineStock {
  const quantity = asQuantity(data.quantity, 1) || 1;
  return {
    ...data,
    location: data.location.trim(),
    quantity,
    purchasedQuantity: quantity,
    id: createId(),
    addedAt: new Date().toISOString(),
  };
}

function normalizeTasting(value: unknown, usedIds: Set<string>): WineTasting {
  if (!isRecord(value)) {
    throw new Error("La copia contiene una cata no valida.");
  }
  return {
    id: uniqueId(value.id, usedIds),
    date: asString(value.date),
    location: asString(value.location),
    price: asString(value.price),
    rating: asRating(value.rating),
    wouldRepeat:
      typeof value.wouldRepeat === "boolean" ? value.wouldRepeat : null,
    notes: asString(value.notes),
    quantity: asQuantity(value.quantity, 1) || 1,
    fromStock: value.fromStock === true,
    createdAt: asDate(value.createdAt),
  };
}

function normalizeStock(value: unknown, usedIds: Set<string>): WineStock {
  if (!isRecord(value)) {
    throw new Error("La copia contiene una entrada de bodega no valida.");
  }
  const quantity = asQuantity(value.quantity, 0);
  return {
    id: uniqueId(value.id, usedIds),
    location: asString(value.location).trim(),
    quantity,
    purchasedQuantity: Math.max(
      quantity,
      asQuantity(value.purchasedQuantity, quantity),
    ),
    price: asString(value.price),
    addedAt: asDate(value.addedAt),
  };
}

export function getLatestTasting(wine: Pick<Wine, "tastings">) {
  return wine.tastings[0];
}

export function getWineStockCount(wine: Pick<Wine, "stock">) {
  return wine.stock.reduce((sum, entry) => sum + entry.quantity, 0);
}

export function getWineTastedBottleCount(wine: Pick<Wine, "tastings">) {
  return wine.tastings.reduce((sum, tasting) => sum + tasting.quantity, 0);
}

export function getWineAverageRating(wine: Pick<Wine, "tastings">) {
  const rated = wine.tastings.filter((tasting) => tasting.rating > 0);
  if (rated.length === 0) return 0;
  return rated.reduce((sum, tasting) => sum + tasting.rating, 0) / rated.length;
}

function normalizeWineIdentity(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(?:bodegas?|s a|s l)\b/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function areSameWineFamily(a: Pick<Wine, "name" | "winery">, b: Pick<Wine, "name" | "winery">) {
  const aName = normalizeWineIdentity(a.name);
  const bName = normalizeWineIdentity(b.name);
  if (!aName || aName !== bName) return false;

  const aWinery = normalizeWineIdentity(a.winery);
  const bWinery = normalizeWineIdentity(b.winery);
  return !aWinery || !bWinery || aWinery === bWinery;
}

export function getWineVintageFamily(wines: Wine[], target: Wine) {
  return wines
    .filter((wine) => areSameWineFamily(wine, target))
    .sort((a, b) => {
      const vintageDifference = Number(b.vintage || 0) - Number(a.vintage || 0);
      return vintageDifference || b.createdAt.localeCompare(a.createdAt);
    });
}

export function syncWineSummary(wine: Wine): Wine {
  const latest = getLatestTasting(wine);
  return {
    ...wine,
    date: latest?.date ?? "",
    location: latest?.location ?? "",
    price: latest?.price ?? "",
    rating: latest?.rating ?? 0,
    wouldRepeat: latest?.wouldRepeat ?? null,
    notes: latest?.notes ?? "",
  };
}

export function normalizeWineRecord(
  value: unknown,
  usedIds: Set<string> = new Set(),
): Wine {
  if (!isRecord(value)) {
    throw new Error("La copia contiene una entrada de vino no valida.");
  }

  const id = uniqueId(value.id, usedIds);
  const type = WINE_TYPES.has(value.type as WineType)
    ? (value.type as WineType)
    : "otro";
  const tastingIds = new Set<string>();
  const stockIds = new Set<string>();
  const rawTastings = value.tastings;
  const rawStock = value.stock;
  const hasTastingHistory = Array.isArray(rawTastings);
  const tastings = hasTastingHistory
    ? rawTastings.map((item) => normalizeTasting(item, tastingIds))
    : [
        normalizeTasting(
          {
            date: value.date,
            location: value.location,
            price: value.price,
            rating: value.rating,
            wouldRepeat: value.wouldRepeat,
            notes: value.notes,
            quantity: 1,
            fromStock: false,
            createdAt: value.createdAt,
          },
          tastingIds,
        ),
      ];
  const stock = Array.isArray(rawStock)
    ? rawStock.map((item) => normalizeStock(item, stockIds))
    : [];

  const wine = {
    id,
    photos: Array.isArray(value.photos)
      ? value.photos.filter(
          (photo): photo is string =>
            typeof photo === "string" && photo.length > 0,
        )
      : [],
    type,
    tastings,
    stock,
    date: "",
    location: "",
    price: "",
    rating: 0,
    wouldRepeat: null,
    notes: "",
    isFavorite: value.isFavorite === true,
    createdAt: asDate(value.createdAt),
    ocrUsed: value.ocrUsed === true,
  } as Wine;

  for (const field of STRING_FIELDS) {
    wine[field] = asString(value[field]);
  }

  return syncWineSummary(wine);
}

export function normalizeWineRecords(value: unknown): Wine[] {
  if (!Array.isArray(value)) {
    throw new Error("El archivo no contiene una lista valida de vinos.");
  }
  if (value.length > 20_000) {
    throw new Error(
      "La copia contiene demasiadas entradas para procesarla con seguridad.",
    );
  }

  const usedIds = new Set<string>();
  return value.map((item) => normalizeWineRecord(item, usedIds));
}

export function normalizeStorageLocations(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const locations: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const location = item.trim();
    const key = location.toLocaleLowerCase("es");
    if (!location || seen.has(key)) continue;
    seen.add(key);
    locations.push(location);
    if (locations.length >= 100) break;
  }
  return locations;
}
