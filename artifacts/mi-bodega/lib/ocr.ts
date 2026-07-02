import { WineFormData } from "@/contexts/WineContext";
import { parseWineText } from "@/lib/wineTextParser";
import { NativeModules, Platform } from "react-native";

type OCRResponse = {
  error?: string;
  fields?: Partial<WineFormData>;
  text?: string;
};

type MlKitOcrModule = {
  recognize: (uri: string) => Promise<string>;
};

const localOcr = NativeModules.MiBodegaMlKitOcr as MlKitOcrModule | undefined;

function normalizeApiBase() {
  const configured = process.env.EXPO_PUBLIC_DOMAIN?.trim();

  if (!configured) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(configured)
    ? configured
    : `https://${configured}`;

  return withProtocol.replace(/\/+$/, "");
}

export const API_BASE = normalizeApiBase();
const OCR_URL = process.env.EXPO_PUBLIC_OCR_URL?.trim();

async function callRemoteOCR(base64: string): Promise<Partial<WineFormData>> {
  const url = OCR_URL || (API_BASE ? `${API_BASE}/api/ocr` : "");

  if (!url) {
    throw new Error("La app no tiene configurado el servidor de OCR.");
  }

  if (!base64) {
    throw new Error("La imagen no incluye datos para analizar.");
  }

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageBase64: base64 }),
  });

  let data: OCRResponse | undefined;
  try {
    data = (await response.json()) as OCRResponse;
  } catch {
    data = undefined;
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("El servidor de OCR configurado no esta disponible.");
    }
    throw new Error(data?.error || `OCR HTTP ${response.status}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.fields ?? {};
}

async function callLocalOCR(imageUri: string): Promise<Partial<WineFormData>> {
  if (Platform.OS !== "android" || !localOcr?.recognize) {
    throw new Error("El OCR local solo esta disponible en la APK de Android.");
  }

  const text = await localOcr.recognize(imageUri);
  return parseWineText(text);
}

export async function callOCR(base64: string, imageUri?: string): Promise<Partial<WineFormData>> {
  if (imageUri && Platform.OS === "android" && localOcr?.recognize) {
    try {
      return await callLocalOCR(imageUri);
    } catch (error) {
      const hasRemoteFallback = OCR_URL || API_BASE;
      if (!hasRemoteFallback) {
        const detail = error instanceof Error ? error.message : "Prueba con otra foto mas clara.";
        throw new Error(`No se pudo leer la etiqueta en este dispositivo. ${detail}`);
      }
    }
  }

  return callRemoteOCR(base64);
}
