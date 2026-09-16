import assert from "node:assert/strict";
import test from "node:test";

import {
  fieldsFromOpenFoodFactsProduct,
  hasValidGtinChecksum,
  lookupFromLocalWine,
  lookupOpenFoodFacts,
  normalizeBarcode,
} from "../lib/wineLookup";
import { normalizeWineRecord } from "../lib/wineData";

test("valida códigos EAN y rechaza errores de escritura", () => {
  assert.equal(hasValidGtinChecksum("8410036002015"), true);
  assert.equal(normalizeBarcode("8410 0360 0201 5"), "8410036002015");
  assert.equal(hasValidGtinChecksum("8410036002014"), false);
  assert.throws(() => normalizeBarcode("8410036002014"), /comprobación/);
});

test("convierte un producto de Open Food Facts en datos editables del vino", () => {
  const fields = fieldsFromOpenFoodFactsProduct({
    product_name_es: "Alceño Cepas Viejas",
    brands: "Bodegas Alceño",
    countries_tags: ["en:spain"],
    categories_tags: ["en:red-wines"],
    origins: "Jumilla, Murcia",
    quantity: "75 cl",
    nutriments: { alcohol_100g: 14.5 },
    labels: "Monastrell, DOP Jumilla",
  });

  assert.equal(fields.name, "Alceño Cepas Viejas");
  assert.equal(fields.winery, "Bodegas Alceño");
  assert.equal(fields.type, "tinto");
  assert.equal(fields.country, "España");
  assert.equal(fields.region, "Murcia");
  assert.equal(fields.denomination, "DOP Jumilla");
  assert.equal(fields.grapes, "Monastrell");
  assert.equal(fields.alcohol, "14.5%");
  assert.equal(fields.volume, "750ml");
  assert.equal(fields.vintage, undefined);
});

test("una consulta inexistente no inventa un vino", async () => {
  const result = await lookupOpenFoodFacts("8410036002015", async () =>
    new Response(JSON.stringify({ status: "failure" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
  assert.equal(result, null);
});

test("la consulta conserva código, fuente y enlace de procedencia", async () => {
  const result = await lookupOpenFoodFacts("8410036002015", async () =>
    new Response(
      JSON.stringify({
        status: "success",
        product: { product_name: "Vino de prueba", quantity: "750 ml" },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ),
  );

  assert.equal(result?.barcode, "8410036002015");
  assert.equal(result?.source, "Open Food Facts");
  assert.equal(result?.fields.name, "Vino de prueba");
  assert.match(result?.sourceUrl ?? "", /8410036002015/);
});

test("reutiliza una ficha local sin copiar su añada", () => {
  const wine = normalizeWineRecord({
    id: "local-1",
    name: "Alceño Cepas Viejas",
    winery: "Bodegas Alceño",
    vintage: "2024",
    barcode: "8410036002015",
  });
  const result = lookupFromLocalWine(wine, wine.barcode);

  assert.equal(result.source, "Mi Bodega");
  assert.equal(result.localWineId, "local-1");
  assert.equal(result.fields.name, "Alceño Cepas Viejas");
  assert.equal(result.fields.vintage, undefined);
});
