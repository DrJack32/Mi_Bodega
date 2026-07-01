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

export async function callOCR(base64: string): Promise<Partial<WineFormData>> {
  if (!base64) {
    throw new Error("La imagen no incluye datos para analizar.");
  }

  if (!API_BASE) {
    throw new Error("La app no tiene configurado el servidor de OCR.");
  }

  const response = await fetch(`${API_BASE}/api/ocr`, {
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
    throw new Error(data?.error || `OCR HTTP ${response.status}`);
  }

  if (data?.error) {
    throw new Error(data.error);
  }

  return data?.fields ?? {};
}
