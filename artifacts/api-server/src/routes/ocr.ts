import { Router } from "express";
import { logger } from "../lib/logger";

const router = Router();

function parseWineFields(text: string): Record<string, string> {
  const fields: Record<string, string> = {};
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  // Vintage (añada): 4-digit year 1950-2025
  const vintageMatch = normalized.match(/\b(19[5-9]\d|20[0-2]\d)\b/);
  if (vintageMatch) fields["vintage"] = vintageMatch[1];

  // Alcohol
  const alcoholMatch = normalized.match(
    /(\d{1,2}[,.]?\d?)\s*%\s*(vol\.?|alc\.?|alcohol)?/i
  );
  if (alcoholMatch) fields["alcohol"] = alcoholMatch[1].replace(",", ".") + "%";

  // Volume
  const volMatch = normalized.match(/(\d{2,3})\s*ml|75\s*cl/i);
  if (volMatch) fields["volume"] = volMatch[0].toLowerCase().includes("cl") ? "750ml" : volMatch[1] + "ml";

  // Wine type
  if (/\b(tinto|rouge|rosso|red wine|vino tinto)\b/i.test(normalized)) fields["type"] = "tinto";
  else if (/\b(blanco|blanc|bianco|white wine|vino blanco)\b/i.test(normalized)) fields["type"] = "blanco";
  else if (/\b(rosado|ros[eé]|rosato)\b/i.test(normalized)) fields["type"] = "rosado";
  else if (/\b(cava|champagne|espumoso|prosecco|frizzante|sp[ua]mante|cr[eé]mant)\b/i.test(normalized)) fields["type"] = "espumoso";

  // Country
  const countryMap: { pattern: RegExp; country: string }[] = [
    { pattern: /\b(rioja|ribera del duero|priorat|r[ií]as baixas|bierzo|cava|sherry|jerez|toro|somontano|rueda|yecla|jumilla|montsant|navarra|valdepe[nñ]as)\b/i, country: "España" },
    { pattern: /\b(bordeaux|bourgogne|burgundy|champagne|rh[oô]ne|alsace|loire|provence|languedoc)\b/i, country: "Francia" },
    { pattern: /\b(toscana|piemonte|veneto|sicilia|puglia|barolo|chianti|brunello|amarone|soave|gavi)\b/i, country: "Italia" },
    { pattern: /\b(napa valley|sonoma|california|oregon|washington state)\b/i, country: "Estados Unidos" },
    { pattern: /\b(douro|alentejo|vinho verde|d[aã]o|bairrada)\b/i, country: "Portugal" },
    { pattern: /\b(mendoza|patagonia|salta)\b/i, country: "Argentina" },
    { pattern: /\b(maipo|colchagua|casablanca valley|aconcagua)\b/i, country: "Chile" },
    { pattern: /\b(marlborough|hawke|central otago)\b/i, country: "Nueva Zelanda" },
    { pattern: /\b(barossa|coonawarra|hunter valley|margaret river)\b/i, country: "Australia" },
  ];

  for (const { pattern, country } of countryMap) {
    if (pattern.test(normalized)) {
      fields["country"] = country;
      break;
    }
  }

  // Grapes
  const grapeList = [
    "tempranillo", "garnacha", "graciano", "mazuelo", "cabernet sauvignon",
    "cabernet franc", "merlot", "syrah", "shiraz", "chardonnay",
    "sauvignon blanc", "riesling", "pinot noir", "pinot grigio",
    "albar[iī][nñ]o", "menc[ií]a", "monastrell", "bobal", "verdejo",
    "viura", "macabeo", "palomino", "godello", "treixadura", "grenache",
    "mourv[eè]dre", "sangiovese", "nebbiolo", "barbera", "dolcetto",
    "vermentino", "primitivo", "nero d.avola",
  ];
  const foundGrapes: string[] = [];
  for (const grape of grapeList) {
    const rx = new RegExp(`\\b${grape}\\b`, "i");
    if (rx.test(normalized)) {
      foundGrapes.push(grape.charAt(0).toUpperCase() + grape.slice(1));
    }
  }
  if (foundGrapes.length) fields["grapes"] = foundGrapes.join(", ");

  // Denomination
  const doMatch = normalized.match(
    /D\.?O\.?\s*(?:Ca\.?|P\.?|C\.?)?\s*([A-Za-z\u00C0-\u024F\s]+?)(?:\n|,|\.|\d|$)/i
  );
  if (doMatch?.[1]) {
    const doText = doMatch[1].trim();
    if (doText.length > 2 && doText.length < 60) fields["denomination"] = doText;
  }

  // Region from known DOs
  if (!fields["region"]) {
    const regionMap: { pattern: RegExp; region: string }[] = [
      { pattern: /rioja/i, region: "La Rioja" },
      { pattern: /ribera del duero/i, region: "Castilla y León" },
      { pattern: /priorat/i, region: "Cataluña" },
      { pattern: /r[ií]as baixas/i, region: "Galicia" },
      { pattern: /penedès/i, region: "Cataluña" },
      { pattern: /bierzo/i, region: "Castilla y León" },
      { pattern: /rueda/i, region: "Castilla y León" },
      { pattern: /toro/i, region: "Castilla y León" },
      { pattern: /navarra/i, region: "Navarra" },
      { pattern: /somontano/i, region: "Aragón" },
    ];
    for (const { pattern, region } of regionMap) {
      if (pattern.test(normalized)) {
        fields["region"] = region;
        break;
      }
    }
  }

  return fields;
}

router.post("/", async (req, res) => {
  const { imageBase64 } = req.body as { imageBase64?: string };

  if (!imageBase64) {
    res.status(400).json({ error: "imageBase64 is required" });
    return;
  }

  try {
    const formData = new FormData();
    formData.append("apikey", "helloworld");
    formData.append("base64Image", `data:image/jpeg;base64,${imageBase64}`);
    formData.append("language", "spa");
    formData.append("isOverlayRequired", "false");
    formData.append("OCREngine", "2");
    formData.append("scale", "true");

    const response = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`OCR.space returned ${response.status}`);
    }

    const data = await response.json() as {
      ParsedResults?: Array<{ ParsedText: string }>;
      ErrorMessage?: string;
    };

    const rawText = data.ParsedResults?.[0]?.ParsedText ?? "";
    const fields = parseWineFields(rawText);

    res.json({ text: rawText, fields });
  } catch (err) {
    logger.error({ err }, "OCR failed");
    res.status(500).json({ error: "OCR processing failed", fields: {} });
  }
});

export default router;
