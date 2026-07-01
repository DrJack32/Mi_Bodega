import { WineFormData } from "@/contexts/WineContext";

type OCRResponse = {
  error?: string;
  fields?: Partial<WineFormData>;
  text?: string;
};

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

export async function callOCR(base64: string): Promise<Partial<WineFormData>> {
  if (!base64) {
    throw new Error("La imagen no incluye datos para analizar.");
  }

  const url = OCR_URL || (API_BASE ? `${API_BASE}/api/ocr` : "");

  if (!url) {
    throw new Error("La app no tiene configurado el servidor de OCR.");
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
