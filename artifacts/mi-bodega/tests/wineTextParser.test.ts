import assert from 'node:assert/strict';
import test from 'node:test';

import { parseWineText } from '../lib/wineTextParser';

test('reconoce nombre, bodega y detalles de una etiqueta frontal', () => {
  const fields = parseWineText(`2021
VIÑA DEL SOL
Bodegas Las Lomas
Denominación de Origen Rioja
Tempranillo
13,5% vol
75 cl`);

  assert.equal(fields.name, 'VIÑA DEL SOL');
  assert.equal(fields.winery, 'Bodegas Las Lomas');
  assert.equal(fields.vintage, '2021');
  assert.equal(fields.denomination, 'DOCa Rioja');
  assert.equal(fields.country, 'España');
  assert.equal(fields.grapes, 'Tempranillo');
  assert.equal(fields.alcohol, '13.5%');
  assert.equal(fields.volume, '750ml');
});

test('no inventa bodega ni toma año, DO, tipo o volumen como nombre', () => {
  const fields = parseWineText(`2020
D.O.Ca. Rioja
Vino tinto
Reserva
El Mirador
0,75 L
14% vol`);

  assert.equal(fields.name, 'El Mirador');
  assert.equal(fields.winery, undefined);
  assert.equal(fields.denomination, 'DOCa Rioja');
  assert.equal(fields.volume, '750ml');
  assert.equal(fields.type, 'tinto');
});

test('no fabrica nombre ni bodega si solo hay texto genérico o ilegible', () => {
  const fields = parseWineText(`VINO TINTO
DENOMINACIÓN DE ORIGEN
CONTIENE SULFITOS
750 ML
13% VOL`);

  assert.equal(fields.name, undefined);
  assert.equal(fields.winery, undefined);
});

test('no descarta un nombre que contiene las letras ml', () => {
  assert.equal(parseWineText('Alma de Vino').name, 'Alma de Vino');
});

test('combina frontal y contraetiqueta de Alceño sin arrastrar códigos registrales', () => {
  const fields = parseWineText(`12
Alceñe
DESDE 1870
MONASTRELL
JUMILLA
DENOMINACION DE ORIGEN PROTEGIDA
CEPAS VIEJAS
VINO TINTO ECOLOGICO
MONASTRELL 2024
Producido y embotellado por:
Bodegas Alceño S.A. RE 0425-MU-U
Ctra. Jumilla-Venta del Olivo km. 3,5
30520 Jumilla. Murcia. España
750 ml alc. 14,5% vol.`);

  assert.equal(fields.name, 'Alceño');
  assert.equal(fields.winery, 'Bodegas Alceño');
  assert.equal(fields.vintage, '2024');
  assert.equal(fields.country, 'España');
  assert.equal(fields.region, 'Murcia');
  assert.equal(fields.denomination, 'DOP Jumilla');
  assert.equal(fields.grapes, 'Monastrell');
  assert.equal(fields.alcohol, '14.5%');
  assert.equal(fields.volume, '750ml');
});

test('un encabezado genérico de denominación no captura basura de la línea siguiente', () => {
  const fields = parseWineText(`Viña Clara
DENOMINACION DE ORIGEN PROTEGIDA
s_ucos|n b
13% vol`);

  assert.equal(fields.denomination, undefined);
});

test('reconoce categoría y meses de crianza cuando figuran en la etiqueta', () => {
  const fields = parseWineText(`FINCA ANTIGUA
RESERVA
Crianza durante 18 meses en barrica de roble
Tempranillo
14% vol`);

  assert.equal(fields.agingCategory, 'Reserva');
  assert.equal(fields.agingMonths, '18');
});
