import { NativeModules, Platform } from "react-native";

import type { WineFormData } from "@/contexts/WineContext";
import { parseWineText } from "@/lib/wineTextParser";

type MlKitOcrModule = {
  recognize: (uri: string) => Promise<string>;
};

const localOcr = NativeModules.MiBodegaMlKitOcr as MlKitOcrModule | undefined;

export async function callOCR(
  imageUri: string,
): Promise<Partial<WineFormData>> {
  return callOCRForPhotos([imageUri]);
}

export async function callOCRForPhotos(
  imageUris: string[],
): Promise<Partial<WineFormData>> {
  if (Platform.OS !== "android") {
    throw new Error("El OCR local solo esta disponible en la APK de Android.");
  }
  if (!localOcr?.recognize) {
    throw new Error(
      "El modulo OCR no esta incluido en esta instalacion. Instala una APK actualizada.",
    );
  }
  if (imageUris.length === 0) return {};

  try {
    const recognized = await Promise.all(
      imageUris.map((imageUri) => localOcr.recognize(imageUri)),
    );
    return parseWineText(recognized.filter(Boolean).join("\n"));
  } catch (error) {
    const detail =
      error instanceof Error
        ? error.message
        : "Prueba con otra foto mas clara.";
    throw new Error(
      `No se pudo leer la etiqueta en este dispositivo. ${detail}`,
    );
  }
}
