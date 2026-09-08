import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import { Platform } from "react-native";

const APP_DIRECTORY = "mi-bodega";
const PHOTO_DIRECTORY = "photos";

function getPhotoDirectory() {
  return new Directory(Paths.document, APP_DIRECTORY, PHOTO_DIRECTORY);
}

function ensurePhotoDirectory() {
  const directory = getPhotoDirectory();
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

function normalizedExtension(source: File) {
  const extension = source.extension.toLowerCase();
  if (/^\.[a-z0-9]{2,5}$/.test(extension)) return extension;

  switch (source.type.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".jpg";
  }
}

function isDataUri(uri: string) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(uri);
}

function parseDataUri(uri: string) {
  const match = uri.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/is);
  if (!match)
    throw new Error("La fotografia incluida no tiene un formato valido.");
  return { mimeType: match[1].toLowerCase(), base64: match[2] };
}

function extensionForMimeType(mimeType: string) {
  switch (mimeType.toLowerCase()) {
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    case "image/heic":
      return ".heic";
    case "image/heif":
      return ".heif";
    default:
      return ".jpg";
  }
}

function bytesToHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function isManagedPhotoUri(uri: string) {
  if (Platform.OS === "web") return false;
  try {
    const root = decodeURIComponent(getPhotoDirectory().uri).replace(/\/?$/, "/");
    return decodeURIComponent(uri).startsWith(root);
  } catch {
    return false;
  }
}

export async function persistPhoto(uri: string): Promise<string> {
  if (!uri || Platform.OS === "web") return uri;
  if (isManagedPhotoUri(uri)) {
    const managed = new File(uri);
    if (!managed.exists)
      throw new Error(
        "Una fotografia guardada ya no existe en el dispositivo.",
      );
    return uri;
  }

  const directory = ensurePhotoDirectory();

  if (isDataUri(uri)) {
    const { mimeType, base64 } = parseDataUri(uri);
    const destination = new File(
      directory,
      `${Crypto.randomUUID()}${extensionForMimeType(mimeType)}`,
    );
    destination.create({ intermediates: true });
    destination.write(base64, { encoding: "base64" });
    return destination.uri;
  }

  const source = new File(uri);
  if (!source.exists) {
    throw new Error(
      "No se puede acceder a una de las fotografias seleccionadas.",
    );
  }
  const destination = new File(
    directory,
    `${Crypto.randomUUID()}${normalizedExtension(source)}`,
  );
  source.copy(destination);
  return destination.uri;
}

export async function persistPhotos(uris: string[]): Promise<string[]> {
  const persisted: string[] = [];
  try {
    for (const uri of uris) persisted.push(await persistPhoto(uri));
    return persisted;
  } catch (error) {
    deleteManagedPhotos(persisted.filter((uri) => !uris.includes(uri)));
    throw error;
  }
}

export function deleteManagedPhotos(uris: string[]) {
  if (Platform.OS === "web") return;
  for (const uri of new Set(uris)) {
    if (!isManagedPhotoUri(uri)) continue;
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // La limpieza nunca debe poner en riesgo los datos ya guardados.
    }
  }
}

export function pruneOrphanPhotos(referencedUris: string[]) {
  if (Platform.OS === "web") return;
  try {
    const directory = getPhotoDirectory();
    if (!directory.exists) return;
    const referenced = new Set(
      referencedUris.map((uri) => decodeURIComponent(uri)),
    );
    for (const item of directory.list()) {
      if (item instanceof File && !referenced.has(decodeURIComponent(item.uri)))
        item.delete();
    }
  } catch {
    // Una limpieza fallida deja como mucho un archivo huerfano.
  }
}

export async function photoMetadata(uri: string) {
  if (Platform.OS === "web") {
    const response = await fetch(uri);
    if (!response.ok)
      throw new Error("No se pudo leer una fotografia para la copia.");
    const bytes = new Uint8Array(await response.arrayBuffer());
    const digest = await Crypto.digest(
      Crypto.CryptoDigestAlgorithm.SHA256,
      bytes,
    );
    return {
      bytes,
      mimeType: response.headers.get("content-type") || "image/jpeg",
      extension: extensionForMimeType(
        response.headers.get("content-type") || "image/jpeg",
      ),
      size: bytes.byteLength,
      sha256: bytesToHex(digest),
    };
  }

  const file = new File(uri);
  if (!file.exists) throw new Error("No se encuentra una fotografia guardada.");
  if (file.size <= 0) throw new Error("Una fotografia guardada esta vacia.");
  const bytes = await file.bytes();
  const digest = await Crypto.digest(
    Crypto.CryptoDigestAlgorithm.SHA256,
    bytes,
  );
  return {
    bytes,
    mimeType: file.type || "image/jpeg",
    extension: normalizedExtension(file),
    size: file.size,
    sha256: bytesToHex(digest),
  };
}

export async function persistRestoredPhoto(
  sourceUri: string,
  expectedSize: number,
  expectedSha256: string,
): Promise<string> {
  const source = new File(sourceUri);
  if (!source.exists || expectedSize <= 0 || source.size !== expectedSize) {
    throw new Error("Una fotografia de la copia esta incompleta.");
  }
  const bytes = await source.bytes();
  const digest = bytesToHex(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bytes),
  );
  if (digest !== expectedSha256.toLowerCase()) {
    throw new Error(
      "Una fotografia de la copia no supera la comprobacion de integridad.",
    );
  }
  return persistPhoto(source.uri);
}

export function appCacheDirectory(name: string) {
  const directory = new Directory(Paths.cache, APP_DIRECTORY, name);
  directory.create({ idempotent: true, intermediates: true });
  return directory;
}

export function removeDirectory(directory: Directory) {
  try {
    if (directory.exists) directory.delete();
  } catch {
    // Las carpetas temporales se volveran a limpiar en una operacion posterior.
  }
}
