export type WineType =
  | "tinto"
  | "blanco"
  | "rosado"
  | "espumoso"
  | "generoso"
  | "dulce"
  | "orange"
  | "otro";

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
  date: string;
  location: string;
  price: string;
  rating: number;
  wouldRepeat: boolean | null;
  notes: string;
  isFavorite: boolean;
  createdAt: string;
  ocrUsed: boolean;
}

export type WineFormData = Omit<Wine, "id" | "createdAt">;

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
  "date",
  "location",
  "price",
  "notes",
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

export function normalizeWineRecord(
  value: unknown,
  usedIds: Set<string> = new Set(),
): Wine {
  if (!isRecord(value)) {
    throw new Error("La copia contiene una entrada de vino no valida.");
  }

  const rawId = asString(value.id).trim();
  let id = rawId || createId();
  while (usedIds.has(id)) id = createId();
  usedIds.add(id);

  const createdAtCandidate = asString(value.createdAt);
  const createdAt = Number.isNaN(Date.parse(createdAtCandidate))
    ? new Date().toISOString()
    : createdAtCandidate;
  const rawRating = Number(value.rating);
  const rating = Number.isFinite(rawRating)
    ? Math.max(0, Math.min(10, Math.round(rawRating)))
    : 0;
  const type = WINE_TYPES.has(value.type as WineType)
    ? (value.type as WineType)
    : "otro";

  const wine = {
    id,
    photos: Array.isArray(value.photos)
      ? value.photos.filter(
          (photo): photo is string =>
            typeof photo === "string" && photo.length > 0,
        )
      : [],
    type,
    rating,
    wouldRepeat:
      typeof value.wouldRepeat === "boolean" ? value.wouldRepeat : null,
    isFavorite: value.isFavorite === true,
    createdAt,
    ocrUsed: value.ocrUsed === true,
  } as Wine;

  for (const field of STRING_FIELDS) {
    wine[field] = asString(value[field]);
  }

  return wine;
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
