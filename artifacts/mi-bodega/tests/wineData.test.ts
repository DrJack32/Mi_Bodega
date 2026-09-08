import assert from "node:assert/strict";
import test from "node:test";

import { normalizePriceNumber, normalizeWineRecords } from "../lib/wineData";

test("normaliza precios escritos con coma o separador de miles", () => {
  assert.equal(normalizePriceNumber("12,50"), 12.5);
  assert.equal(normalizePriceNumber("1.234,56"), 1234.56);
  assert.equal(normalizePriceNumber(" 24.90 "), 24.9);
  assert.equal(normalizePriceNumber("sin precio"), 0);
  assert.equal(normalizePriceNumber("-10"), 0);
});

test("normaliza una copia antigua sin descartar el vino", () => {
  const [wine] = normalizeWineRecords([
    {
      name: "Reserva",
      photos: ["file:///foto.jpg", null],
      rating: 14,
      type: "desconocido",
      wouldRepeat: "si",
    },
  ]);

  assert.ok(wine.id);
  assert.equal(wine.name, "Reserva");
  assert.deepEqual(wine.photos, ["file:///foto.jpg"]);
  assert.equal(wine.rating, 10);
  assert.equal(wine.type, "otro");
  assert.equal(wine.wouldRepeat, null);
});

test("rechaza estructuras que no son una coleccion de vinos", () => {
  assert.throws(() => normalizeWineRecords({ wines: [] }), /lista valida/);
  assert.throws(() => normalizeWineRecords([null]), /entrada de vino/);
});
