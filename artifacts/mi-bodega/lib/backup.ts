import * as Crypto from "expo-crypto";
import { Directory, File } from "expo-file-system";
import { Platform } from "react-native";
import {
  BEST_SPEED,
  getUncompressedSize,
  listContents,
  unzip,
  zip,
  type ZipEntry,
} from "react-native-zip-archive";

import type { Wine } from "@/lib/wineData";
import { normalizeWineRecords } from "@/lib/wineData";
import {
  appCacheDirectory,
  deleteManagedPhotos,
  persistPhotos,
  persistRestoredPhoto,
  photoMetadata,
  removeDirectory,
} from "@/lib/photoStorage";

const BACKUP_VERSION = 2;
const MAX_ARCHIVE_ENTRIES = 100_005;
const MAX_PHOTO_COUNT = 100_000;
const MAX_UNCOMPRESSED_BYTES = 2_000_000_000;
const MAX_PHOTO_BYTES = 100_000_000;

type ManifestPhoto = {
  file: string;
  mimeType: string;
  size: number;
  sha256: string;
};

type ManifestWine = Omit<Wine, "photos"> & { photos: ManifestPhoto[] };

type BackupManifest = {
  app: "mi-bodega";
  version: 2;
  exportedAt: string;
  wines: ManifestWine[];
};

export type RestoreMode = "merge" | "replace";

export type BackupPreview = {
  uri: string;
  name: string;
  version: number;
  exportedAt: string | null;
  wineCount: number;
  photoCount: number;
  duplicateCount: number;
  legacy: boolean;
};

export type RestoreResult = {
  wines: Wine[];
  restoredWineCount: number;
  restoredPhotoCount: number;
  skippedWineCount: number;
  missingPhotoCount: number;
  createdPhotoUris: string[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeArchivePath(path: string) {
  const normalized = path.replace(/\\/g, "/");
  return (
    path === normalized &&
    !normalized.startsWith("/") &&
    !normalized.split("/").includes("..") &&
    (normalized === "manifest.json" || normalized.startsWith("photos/"))
  );
}

function validateArchiveEntries(entries: ZipEntry[]) {
  if (entries.length === 0 || entries.length > MAX_ARCHIVE_ENTRIES) {
    throw new Error("La copia contiene un numero de archivos no valido.");
  }
  if (
    !entries.some(
      (entry) => entry.path === "manifest.json" && !entry.isDirectory,
    )
  ) {
    throw new Error("La copia no contiene el manifiesto de Mi Bodega.");
  }
  const paths = new Set<string>();
  for (const entry of entries) {
    if (!isSafeArchivePath(entry.path) || entry.isEncrypted || entry.size < 0) {
      throw new Error("La copia contiene rutas o archivos no permitidos.");
    }
    if (paths.has(entry.path)) {
      throw new Error("La copia contiene archivos duplicados.");
    }
    paths.add(entry.path);
  }
}

function validateManifest(raw: unknown): BackupManifest {
  if (!isRecord(raw) || raw.app !== "mi-bodega") {
    throw new Error("El archivo no es una copia de Mi Bodega.");
  }
  if (raw.version !== BACKUP_VERSION) {
    if (typeof raw.version === "number" && raw.version > BACKUP_VERSION) {
      throw new Error(
        "La copia pertenece a una version mas reciente de Mi Bodega.",
      );
    }
    throw new Error("La version de esta copia no es compatible.");
  }
  if (!Array.isArray(raw.wines) || raw.wines.length > 20_000) {
    throw new Error("La copia no contiene una coleccion valida.");
  }

  const paths = new Set<string>();
  let photoCount = 0;
  for (const candidate of raw.wines) {
    if (!isRecord(candidate) || !Array.isArray(candidate.photos)) {
      throw new Error("La copia contiene un vino no valido.");
    }
    for (const photo of candidate.photos) {
      if (
        !isRecord(photo) ||
        typeof photo.file !== "string" ||
        !/^photos\/[a-zA-Z0-9._-]+$/.test(photo.file) ||
        paths.has(photo.file) ||
        typeof photo.mimeType !== "string" ||
        !/^image\/[a-z0-9.+-]+$/i.test(photo.mimeType) ||
        typeof photo.size !== "number" ||
        !Number.isSafeInteger(photo.size) ||
        photo.size <= 0 ||
        photo.size > MAX_PHOTO_BYTES ||
        typeof photo.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/i.test(photo.sha256)
      ) {
        throw new Error(
          "La copia contiene una referencia de fotografia no valida.",
        );
      }
      paths.add(photo.file);
      photoCount += 1;
      if (photoCount > MAX_PHOTO_COUNT) {
        throw new Error("La copia contiene demasiadas fotografias.");
      }
    }
  }
  return raw as BackupManifest;
}

function parseLegacyBackup(raw: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error("El archivo JSON no se puede leer o esta dañado.");
  }

  if (Array.isArray(parsed)) {
    return {
      wines: normalizeWineRecords(parsed),
      exportedAt: null,
      version: 0,
    };
  }
  if (
    !isRecord(parsed) ||
    parsed.app !== "mi-bodega" ||
    !Array.isArray(parsed.wines)
  ) {
    throw new Error("El archivo no es una copia valida de Mi Bodega.");
  }
  if (typeof parsed.version === "number" && parsed.version > BACKUP_VERSION) {
    throw new Error(
      "La copia pertenece a una version mas reciente de Mi Bodega.",
    );
  }
  return {
    wines: normalizeWineRecords(parsed.wines),
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : null,
    version: typeof parsed.version === "number" ? parsed.version : 1,
  };
}

function isLegacyJson(name: string) {
  return name.toLowerCase().endsWith(".json");
}

function safeNativePath(uri: string) {
  return decodeURIComponent(uri.replace(/^file:\/\//, ""));
}

function countDuplicates(imported: Wine[], current: Wine[]) {
  const currentIds = new Set(current.map((wine) => wine.id));
  return imported.filter((wine) => currentIds.has(wine.id)).length;
}

async function readTextFile(uri: string) {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok) throw new Error("No se pudo leer la copia seleccionada.");
    return response.text();
  }
  const file = new File(uri);
  if (!file.exists) throw new Error("No se encuentra la copia seleccionada.");
  return file.text();
}

async function extractAndReadManifest(uri: string) {
  if (Platform.OS === "web") {
    throw new Error(
      "La copia completa con fotografias se restaura desde la aplicacion movil.",
    );
  }
  const archivePath = safeNativePath(uri);
  const entries = await listContents(archivePath);
  validateArchiveEntries(entries);
  const uncompressedSize = await getUncompressedSize(archivePath);
  if (uncompressedSize > MAX_UNCOMPRESSED_BYTES) {
    throw new Error(
      "La copia es demasiado grande para procesarla con seguridad.",
    );
  }

  const extraction = appCacheDirectory(`restore-${Crypto.randomUUID()}`);
  try {
    await unzip(archivePath, safeNativePath(extraction.uri));
    const manifestFile = new File(extraction, "manifest.json");
    if (!manifestFile.exists)
      throw new Error("No se pudo extraer el manifiesto de la copia.");
    const manifest = validateManifest(JSON.parse(await manifestFile.text()));
    const entryPaths = new Set(
      entries.filter((entry) => !entry.isDirectory).map((entry) => entry.path),
    );
    const expectedPaths = new Set<string>(["manifest.json"]);
    for (const wine of manifest.wines) {
      for (const photo of wine.photos) {
        expectedPaths.add(photo.file);
        if (!entryPaths.has(photo.file)) {
          throw new Error("Falta una fotografia declarada en la copia.");
        }
      }
    }
    if ([...entryPaths].some((path) => !expectedPaths.has(path))) {
      throw new Error("La copia contiene archivos que no estan declarados.");
    }
    return { manifest, extraction };
  } catch (error) {
    removeDirectory(extraction);
    throw error;
  }
}

export async function createBackupArchive(wines: Wine[]) {
  if (Platform.OS === "web") {
    throw new Error(
      "La copia completa con fotografias se crea desde la aplicacion movil.",
    );
  }

  const operationId = Crypto.randomUUID();
  const source = appCacheDirectory(`backup-${operationId}`);
  const photosDirectory = new Directory(source, "photos");
  photosDirectory.create({ idempotent: true });
  const exportDirectory = appCacheDirectory("exports");
  for (const item of exportDirectory.list()) {
    try {
      item.delete();
    } catch {
      // El sistema tambien puede limpiar esta carpeta temporal.
    }
  }
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `mi-bodega-${stamp}.zip`;
  const target = new File(exportDirectory, filename);
  if (target.exists) target.delete();

  try {
    let photoCount = 0;
    const manifestWines: ManifestWine[] = [];

    for (const wine of wines) {
      const manifestPhotos: ManifestPhoto[] = [];
      for (const uri of wine.photos) {
        let metadata;
        try {
          metadata = await photoMetadata(uri);
        } catch {
          throw new Error(
            `No se puede incluir una fotografia de "${wine.name || wine.winery || "vino sin nombre"}". No se ha creado una copia incompleta.`,
          );
        }
        if (metadata.size > MAX_PHOTO_BYTES) {
          throw new Error(
            `Una fotografia de "${wine.name || wine.winery || "vino sin nombre"}" es demasiado grande para incluirla de forma segura.`,
          );
        }
        const photoName = `${Crypto.randomUUID()}${metadata.extension}`;
        const photoFile = new File(photosDirectory, photoName);
        photoFile.create({ intermediates: true });
        photoFile.write(metadata.bytes);
        manifestPhotos.push({
          file: `photos/${photoName}`,
          mimeType: metadata.mimeType,
          size: metadata.size,
          sha256: metadata.sha256,
        });
        photoCount += 1;
        if (photoCount > MAX_PHOTO_COUNT) {
          throw new Error(
            "Hay demasiadas fotografias para crear una sola copia.",
          );
        }
      }
      manifestWines.push({ ...wine, photos: manifestPhotos });
    }

    const manifest: BackupManifest = {
      app: "mi-bodega",
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      wines: manifestWines,
    };
    const manifestFile = new File(source, "manifest.json");
    manifestFile.create({ intermediates: true });
    manifestFile.write(JSON.stringify(manifest, null, 2));

    await zip(
      safeNativePath(source.uri),
      safeNativePath(target.uri),
      BEST_SPEED,
    );
    if (!target.exists || target.size === 0)
      throw new Error("No se pudo crear el archivo de copia.");
    return { uri: target.uri, filename, wineCount: wines.length, photoCount };
  } catch (error) {
    try {
      if (target.exists) target.delete();
    } catch {
      // El archivo incompleto esta en cache y el sistema puede eliminarlo.
    }
    throw error;
  } finally {
    removeDirectory(source);
  }
}

export async function inspectBackup(
  uri: string,
  name: string,
  currentWines: Wine[],
): Promise<BackupPreview> {
  if (isLegacyJson(name)) {
    const legacy = parseLegacyBackup(await readTextFile(uri));
    return {
      uri,
      name,
      version: legacy.version,
      exportedAt: legacy.exportedAt,
      wineCount: legacy.wines.length,
      photoCount: 0,
      duplicateCount: countDuplicates(legacy.wines, currentWines),
      legacy: true,
    };
  }

  const { manifest, extraction } = await extractAndReadManifest(uri);
  try {
    const normalized = normalizeWineRecords(
      manifest.wines.map((wine) => ({ ...wine, photos: [] })),
    );
    return {
      uri,
      name,
      version: manifest.version,
      exportedAt: manifest.exportedAt,
      wineCount: normalized.length,
      photoCount: manifest.wines.reduce(
        (sum, wine) => sum + wine.photos.length,
        0,
      ),
      duplicateCount: countDuplicates(normalized, currentWines),
      legacy: false,
    };
  } finally {
    removeDirectory(extraction);
  }
}

async function restoreLegacy(
  uri: string,
  currentWines: Wine[],
  mode: RestoreMode,
): Promise<RestoreResult> {
  const legacy = parseLegacyBackup(await readTextFile(uri));
  const existingIds = new Set(currentWines.map((wine) => wine.id));
  const selected =
    mode === "merge"
      ? legacy.wines.filter((wine) => !existingIds.has(wine.id))
      : legacy.wines;
  const restored: Wine[] = [];
  const createdPhotoUris: string[] = [];
  let restoredPhotoCount = 0;
  let missingPhotoCount = 0;

  try {
    for (const wine of selected) {
      const photos: string[] = [];
      for (const uri of wine.photos) {
        try {
          const [persisted] = await persistPhotos([uri]);
          photos.push(persisted);
          restoredPhotoCount += 1;
          if (persisted !== uri) createdPhotoUris.push(persisted);
        } catch {
          missingPhotoCount += 1;
        }
      }
      restored.push({ ...wine, photos });
    }
  } catch (error) {
    deleteManagedPhotos(createdPhotoUris);
    throw error;
  }

  return {
    wines: mode === "merge" ? [...restored, ...currentWines] : restored,
    restoredWineCount: restored.length,
    restoredPhotoCount,
    skippedWineCount: legacy.wines.length - restored.length,
    missingPhotoCount,
    createdPhotoUris,
  };
}

export async function restoreBackup(
  preview: BackupPreview,
  currentWines: Wine[],
  mode: RestoreMode,
): Promise<RestoreResult> {
  if (preview.legacy) return restoreLegacy(preview.uri, currentWines, mode);

  const { manifest, extraction } = await extractAndReadManifest(preview.uri);
  const existingIds = new Set(currentWines.map((wine) => wine.id));
  const selected =
    mode === "merge"
      ? manifest.wines.filter((wine) => !existingIds.has(wine.id))
      : manifest.wines;
  const restoredRaw: unknown[] = [];
  const createdPhotoUris: string[] = [];

  try {
    for (const wine of selected) {
      const photos: string[] = [];
      for (const photo of wine.photos) {
        const photoUri = await persistRestoredPhoto(
          new File(extraction, photo.file).uri,
          photo.size,
          photo.sha256,
        );
        photos.push(photoUri);
        createdPhotoUris.push(photoUri);
      }
      restoredRaw.push({ ...wine, photos });
    }
    const restored = normalizeWineRecords(restoredRaw);
    return {
      wines: mode === "merge" ? [...restored, ...currentWines] : restored,
      restoredWineCount: restored.length,
      restoredPhotoCount: createdPhotoUris.length,
      skippedWineCount: manifest.wines.length - restored.length,
      missingPhotoCount: 0,
      createdPhotoUris,
    };
  } catch (error) {
    deleteManagedPhotos(createdPhotoUris);
    throw error;
  } finally {
    removeDirectory(extraction);
  }
}
