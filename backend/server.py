import re
import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import httpx

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mi-bodega-api")

app = FastAPI(title="Mi Bodega API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OCR_SPACE_URL = "https://api.ocr.space/parse/image"


class OCRRequest(BaseModel):
    imageBase64: str | None = None


def parse_wine_fields(text: str) -> dict:
    fields: dict[str, str] = {}
    normalized = text.replace("\r\n", "\n").replace("\r", "\n")

    vintage = re.search(r"\b(19[5-9]\d|20[0-2]\d)\b", normalized)
    if vintage:
        fields["vintage"] = vintage.group(1)

    alcohol = re.search(r"(\d{1,2}[,.]?\d?)\s*%\s*(vol\.?|alc\.?|alcohol)?", normalized, re.I)
    if alcohol:
        fields["alcohol"] = alcohol.group(1).replace(",", ".") + "%"

    vol = re.search(r"(\d{2,3})\s*ml|75\s*cl", normalized, re.I)
    if vol:
        fields["volume"] = "750ml" if "cl" in vol.group(0).lower() else vol.group(1) + "ml"

    if re.search(r"\b(tinto|rouge|rosso|red wine|vino tinto)\b", normalized, re.I):
        fields["type"] = "tinto"
    elif re.search(r"\b(blanco|blanc|bianco|white wine|vino blanco)\b", normalized, re.I):
        fields["type"] = "blanco"
    elif re.search(r"\b(rosado|ros[eé]|rosato)\b", normalized, re.I):
        fields["type"] = "rosado"
    elif re.search(r"\b(cava|champagne|espumoso|prosecco|frizzante|sp[ua]mante|cr[eé]mant)\b", normalized, re.I):
        fields["type"] = "espumoso"

    country_map = [
        (r"\b(rioja|ribera del duero|priorat|r[ií]as baixas|bierzo|cava|sherry|jerez|toro|somontano|rueda|yecla|jumilla|montsant|navarra|valdepe[nñ]as)\b", "España"),
        (r"\b(bordeaux|bourgogne|burgundy|champagne|rh[oô]ne|alsace|loire|provence|languedoc)\b", "Francia"),
        (r"\b(toscana|piemonte|veneto|sicilia|puglia|barolo|chianti|brunello|amarone|soave|gavi)\b", "Italia"),
        (r"\b(napa valley|sonoma|california|oregon|washington state)\b", "Estados Unidos"),
        (r"\b(douro|alentejo|vinho verde|d[aã]o|bairrada)\b", "Portugal"),
        (r"\b(mendoza|patagonia|salta)\b", "Argentina"),
        (r"\b(maipo|colchagua|casablanca valley|aconcagua)\b", "Chile"),
        (r"\b(marlborough|hawke|central otago)\b", "Nueva Zelanda"),
        (r"\b(barossa|coonawarra|hunter valley|margaret river)\b", "Australia"),
    ]
    for pattern, country in country_map:
        if re.search(pattern, normalized, re.I):
            fields["country"] = country
            break

    grape_list = [
        "tempranillo", "garnacha", "graciano", "mazuelo", "cabernet sauvignon",
        "cabernet franc", "merlot", "syrah", "shiraz", "chardonnay",
        "sauvignon blanc", "riesling", "pinot noir", "pinot grigio",
        "albar[iī][nñ]o", "menc[ií]a", "monastrell", "bobal", "verdejo",
        "viura", "macabeo", "palomino", "godello", "treixadura", "grenache",
        "mourv[eè]dre", "sangiovese", "nebbiolo", "barbera", "dolcetto",
        "vermentino", "primitivo", "nero d.avola",
    ]
    found = []
    for grape in grape_list:
        if re.search(rf"\b{grape}\b", normalized, re.I):
            found.append(grape[0].upper() + grape[1:])
    if found:
        fields["grapes"] = ", ".join(found)

    do_match = re.search(
        r"D\.?O\.?\s*(?:Ca\.?|P\.?|C\.?)?\s*([A-Za-z\u00C0-\u024F\s]+?)(?:\n|,|\.|\d|$)",
        normalized, re.I,
    )
    if do_match and do_match.group(1):
        do_text = do_match.group(1).strip()
        if 2 < len(do_text) < 60:
            fields["denomination"] = do_text

    if "region" not in fields:
        region_map = [
            (r"rioja", "La Rioja"),
            (r"ribera del duero", "Castilla y León"),
            (r"priorat", "Cataluña"),
            (r"r[ií]as baixas", "Galicia"),
            (r"penedès", "Cataluña"),
            (r"bierzo", "Castilla y León"),
            (r"rueda", "Castilla y León"),
            (r"toro", "Castilla y León"),
            (r"navarra", "Navarra"),
            (r"somontano", "Aragón"),
        ]
        for pattern, region in region_map:
            if re.search(pattern, normalized, re.I):
                fields["region"] = region
                break

    return fields


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/ocr")
async def ocr(payload: OCRRequest):
    if not payload.imageBase64:
        return {"error": "imageBase64 is required", "fields": {}}

    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                OCR_SPACE_URL,
                data={
                    "apikey": "helloworld",
                    "base64Image": f"data:image/jpeg;base64,{payload.imageBase64}",
                    "language": "spa",
                    "isOverlayRequired": "false",
                    "OCREngine": "2",
                    "scale": "true",
                },
            )
            response.raise_for_status()
            data = response.json()
            raw_text = ""
            results = data.get("ParsedResults") or []
            if results:
                raw_text = results[0].get("ParsedText", "")
            fields = parse_wine_fields(raw_text)
            return {"text": raw_text, "fields": fields}
    except Exception as err:
        logger.error("OCR failed: %s", err)
        return {"error": "OCR processing failed", "fields": {}}
