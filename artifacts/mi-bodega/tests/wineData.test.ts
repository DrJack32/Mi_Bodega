import assert from "node:assert/strict";
import test from "node:test";

import {
  getWineAverageRating,
  getWineStockCount,
  getWineTastedBottleCount,
  getWineVintageFamily,
  normalizePriceNumber,
  normalizeStorageLocations,
  normalizeWineRecords,
} from "../lib/wineData";

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
  assert.equal(wine.tastings.length, 1);
  assert.equal(getWineTastedBottleCount(wine), 1);
  assert.equal(getWineStockCount(wine), 0);
});

test("mantiene separado el inventario y el historial de botellas", () => {
  const [wine] = normalizeWineRecords([
    {
      id: "wine-1",
      name: "Reserva",
      type: "tinto",
      createdAt: "2026-09-13T10:00:00.000Z",
      photos: [],
      tastings: [
        {
          id: "tasting-1",
          date: "12/09/2026",
          location: "Casa",
          rating: 8,
          quantity: 2,
          createdAt: "2026-09-13T10:00:00.000Z",
        },
        {
          id: "tasting-2",
          date: "01/08/2026",
          rating: 10,
          quantity: 1,
          createdAt: "2026-08-01T10:00:00.000Z",
        },
      ],
      stock: [
        {
          id: "stock-1",
          location: "Botellero principal",
          quantity: 3,
          purchasedQuantity: 4,
          price: "15,50",
          addedAt: "2026-09-13T10:00:00.000Z",
        },
      ],
    },
  ]);

  assert.equal(getWineTastedBottleCount(wine), 3);
  assert.equal(getWineStockCount(wine), 3);
  assert.equal(getWineAverageRating(wine), 9);
  assert.equal(wine.date, "12/09/2026");
  assert.equal(wine.rating, 8);
});

test("un vino guardado sin cata no se convierte en consumido", () => {
  const [wine] = normalizeWineRecords([
    {
      name: "Crianza",
      type: "tinto",
      photos: [],
      tastings: [],
      stock: [{ location: "Nevera", quantity: 2 }],
    },
  ]);

  assert.equal(wine.tastings.length, 0);
  assert.equal(getWineTastedBottleCount(wine), 0);
  assert.equal(getWineStockCount(wine), 2);
  assert.equal(wine.date, "");
});

test("normaliza ubicaciones preparadas sin duplicados", () => {
  assert.deepEqual(
    normalizeStorageLocations([
      " Botellero principal ",
      "botellero principal",
      "Nevera de vinos",
      null,
    ]),
    ["Botellero principal", "Nevera de vinos"],
  );
});

test("rechaza estructuras que no son una coleccion de vinos", () => {
  assert.throws(() => normalizeWineRecords({ wines: [] }), /lista valida/);
  assert.throws(() => normalizeWineRecords([null]), /entrada de vino/);
});

test("agrupa las añadas del mismo vino aunque cambien mayúsculas o acentos", () => {
  const wines = normalizeWineRecords([
    { id: "2024", name: "Alceño", winery: "Bodegas Alceño", vintage: "2024", photos: [], tastings: [], stock: [] },
    { id: "2022", name: "ALCENO", winery: "Alceño S.A.", vintage: "2022", photos: [], tastings: [], stock: [] },
    { id: "other", name: "Otro vino", winery: "Bodegas Alceño", vintage: "2023", photos: [], tastings: [], stock: [] },
  ]);

  assert.deepEqual(getWineVintageFamily(wines, wines[0]).map((wine) => wine.id), ["2024", "2022"]);
});
