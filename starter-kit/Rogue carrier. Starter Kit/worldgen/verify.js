// Proves that worldgen.js builds exactly the maps of the team's reference model.
//
//   node worldgen/verify.js
//
// The reference is a Google Apps Script model (the .gs files in the project's WorldGen
// folder). This script loads those files in a node sandbox, builds the same maps with
// both, and compares them tile by tile. The kit travels without the .gs files; when
// they are not found the comparison is skipped (the self-checks still run).
//
// Where to look for the .gs files: the WORLDGEN_GS_DIR environment variable, else the
// project's own folder.

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WorldGen = require('./worldgen.js');

const GS_DIR = process.env.WORLDGEN_GS_DIR || path.join(__dirname, '..', '..', 'WorldGen');
// Only the noise, the model and the statistics sampler are needed.
const GS_FILES = ['01_WorldNoise.gs', '02_WorldModel.gs', '05_WorldReports.gs'];

let failures = 0, checks = 0;
function check(label, ok, detail) {
  checks++;
  if (!ok) { failures++; console.log('FAIL  ' + label + (detail ? '   ' + detail : '')); }
  else console.log('ok    ' + label + (detail ? '   ' + detail : ''));
  return ok;
}
const near = (a, b, tol) => Math.abs(a - b) < tol;

// ---------------------------------------------------------------- self-checks ---
console.log('=== Self-checks (no reference needed) ===');
{
  const m = WorldGen.generate(0);
  check('a default map is 100 x 100 with 7 biomes and 3 water objects',
        m.width === 100 && m.height === 100 && m.biomeNames.length === 7 && m.waterObjects.length === 3);
  let dirty = 0;
  for (let y = m.start.y - 1; y <= m.start.y + 1; y++) for (let x = m.start.x - 1; x <= m.start.x + 1; x++) {
    const i = y * m.width + x;
    if (m.tiles.land[i] || m.tiles.water[i]) dirty++;
  }
  check('the 3x3 block round the start tile (50, 50) is empty', m.start.x === 50 && m.start.y === 50 && dirty === 0);
  let onLand = 0;
  for (let i = 0; i < m.tiles.land.length; i++) if (m.tiles.land[i] && m.tiles.water[i]) onLand++;
  check('no water object on an island tile', onLand === 0);
  let mixed = 0;
  for (const g of m.groups) for (const t of g.tiles) if (m.tiles.biome[t] !== g.biomeIndex) mixed++;
  check('every group lies in one biome', mixed === 0);
  check('the same index always gives the same map',
        JSON.stringify(WorldGen.toJSON(WorldGen.generate(77))) === JSON.stringify(WorldGen.toJSON(WorldGen.generate(77))));
  const covered = [0, 1, 2, 3, 4, 5].every(layer => {
    const hit = new Set();
    for (let b = 0; b < 256; b++) hit.add(WorldGen.noise.layerSeed(b, layer));
    return hit.size === 256;
  });
  check('over indices 0..255 every layer meets each of its 256 seeds once', covered);
}

// ---------------------------------------------------------------- the reference ---
const missing = GS_FILES.filter(f => !fs.existsSync(path.join(GS_DIR, f)));
if (missing.length) {
  console.log('\nSKIPPED the comparison with the reference model: ' + missing.join(', ') + ' not found in ' + GS_DIR +
              '.\nSet WORLDGEN_GS_DIR to the folder holding the WorldGen .gs files to run it.');
  finish();
  return;
}

const G = vm.createContext({ console });
for (const f of GS_FILES) vm.runInContext(fs.readFileSync(path.join(GS_DIR, f), 'utf8'), G, { filename: f });
console.log('\nReference loaded from ' + GS_DIR);
// The reference checks `x.constructor === Array`, so its tables must be arrays of its own realm.
const CTX_JSON = vm.runInContext('JSON', G);
const inRef = v => CTX_JSON.parse(JSON.stringify(v));

// The reference's settings, built from its own defaults and tables.
function refSetup(over, biomeRows) {
  const opts = G.wg_defaults_();
  Object.assign(opts, over || {});
  const biomes = G.wg_biomes_(inRef([G.WG_BIOME_COLUMNS].concat(biomeRows || G.WG_BIOME_ROWS)));
  const water = G.wg_water_(inRef([G.WG_WATER_COLUMNS].concat(G.WG_WATER_ROWS)));
  return { opts, biomes, water };
}
// The same settings for the kit.
function kitSettings(over, biomeRows) {
  const s = Object.assign({}, over || {});
  if (biomeRows) s.biomes = biomeRows.map(r => ({ min: r[0], max: r[1], names: r.slice(2).filter(Boolean) }));
  return s;
}

console.log('\n=== Defaults are the reference defaults ===');
{
  const ref = G.wg_defaults_(), kit = WorldGen.DEFAULTS, diff = [];
  for (const k of Object.keys(kit)) {
    if (k === 'biomes' || k === 'water') continue;
    if (ref[k] !== kit[k]) diff.push(k + ': kit ' + kit[k] + ', reference ' + ref[k]);
  }
  check('every map, islands, biomes, sub-biome and water-mode setting', diff.length === 0, diff.join('; '));
  const refBiomes = JSON.stringify(G.WG_BIOME_ROWS.map(r => [r[0], r[1], r.slice(2).filter(Boolean)]));
  const kitBiomes = JSON.stringify(kit.biomes.map(b => [b.min, b.max, b.names]));
  check('the biome intervals', refBiomes === kitBiomes);
  const refWater = JSON.stringify(G.wg_water_(inRef([G.WG_WATER_COLUMNS].concat(G.WG_WATER_ROWS))).map(w =>
    [w.name, w.noiseScale, w.patternScale, w.octaves, w.offset, w.multiplier, w.threshold, w.on]));
  const kitWater = JSON.stringify(kit.water.map(w =>
    [w.name, w.noiseScale, w.patternScale, w.octaves, w.offset, w.multiplier, w.threshold, w.on]));
  check('the water object rows', refWater === kitWater);
  check('the biome list', JSON.stringify(G.WG_BIOME_NAMES) === JSON.stringify(WorldGen.BIOMES));
}

console.log('\n=== The noise ===');
{
  const rand = G.wg_rng_(99);
  let worst = 0;
  for (let n = 0; n < 20000; n++) {
    const x = rand() * 600 - 300, y = rand() * 600 - 300;
    worst = Math.max(worst, Math.abs(G.wg_perlin_(x, y) - WorldGen.noise.perlin(x, y)));
  }
  check('PerlinNoise2D equal at 20,000 random points', worst === 0, 'largest difference ' + worst);
  let same = true;
  const layers = [{ patternScale: 1, noiseScale: 1.4, octaves: 12 }, { patternScale: 0.5, noiseScale: 8, octaves: 4, offset: 0.1, multiplier: 1.5 },
                  { patternScale: 1.1, noiseScale: 1, octaves: 4 }, { patternScale: 1, noiseScale: 2, octaves: 12 }];
  for (const L of layers) for (const seed of [0, 37, 255]) {
    const a = G.wg_live_(60, 40, L, seed), b = WorldGen.noise.layer(60, 40, L, seed);
    if (a.alive !== b.alive) same = false;
    for (let y = 0; y < 40 && same; y++) for (let x = 0; x < 60; x++) {
      if (G.wg_value_(a, x, y) !== WorldGen.noise.value(b, x, y)) { same = false; break; }
    }
  }
  check('octave sums equal on four layers x three seeds, value for value', same);
}

console.log('\n=== Seeds ===');
{
  let same = true;
  for (let index = 0; index < 4096; index++) {
    const ref = G.wg_mapSeeds_(index, 4096, 3), kit = WorldGen.mapSeeds(index);
    if (ref.base !== kit.base || ref.seeds.islands !== kit.islands || ref.seeds.biomes !== kit.biomes ||
        ref.seeds.sub !== kit.sub || JSON.stringify(ref.seeds.water) !== JSON.stringify(kit.water)) { same = false; break; }
  }
  check('per-layer seeds equal for map indices 0..4095', same);
}

// One map, compared tile by tile.
function compareMap(index, over, biomeRows) {
  const R = refSetup(over, biomeRows);
  const pick = G.wg_mapSeeds_(index, 4096, R.water.length);
  const ref = G.wg_build_(R.opts, R.biomes, R.water, pick.base, pick.seeds);
  const kit = WorldGen.generate(index, kitSettings(over, biomeRows));
  const T = kit.tiles, bad = [];
  for (let i = 0; i < ref.area; i++) {
    if (T.landNoise[i] !== ref.land[i]) { bad.push('land@' + i); break; }
    if ((T.bigIsland[i] >= 0 ? 1 : 0) !== ref.big[i]) { bad.push('big@' + i); break; }
    if (T.land[i] !== (ref.land[i] || ref.big[i] ? 1 : 0)) { bad.push('island@' + i); break; }
    if (T.biome[i] !== ref.biome[i]) { bad.push('biome@' + i); break; }
    if (T.water[i] !== ref.obj[i]) { bad.push('water@' + i); break; }
  }
  const c = kit.counts;
  if (JSON.stringify(kit.bigIslands.map(b => b.tiles[0]).sort((a, b) => a - b)) !==
      JSON.stringify(Array.from(ref.anchors).sort((a, b) => a - b))) bad.push('anchors');
  if (c.bigIslands !== ref.bigIslands || c.smallIslands !== ref.smallIslands || c.islandTiles !== ref.islandTiles ||
      c.waterTiles !== ref.waterTiles) bad.push('island counts');
  if (c.groups !== ref.groups || c.movedByGroups !== ref.moved) bad.push('groups');
  if (c.bareWater !== ref.bareWater || c.contested !== ref.contested) bad.push('water counts');
  if (JSON.stringify(c.water.map(o => o.tiles)) !== JSON.stringify(Array.from(ref.kept)) ||
      JSON.stringify(c.water.map(o => o.claims)) !== JSON.stringify(Array.from(ref.claims)) ||
      JSON.stringify(c.water.map(o => o.lost)) !== JSON.stringify(Array.from(ref.lost))) bad.push('object counts');
  const tally = G.wg_biomeTally_(ref, R.water);
  for (let b = 0; b < tally.length; b++) {
    const k = c.biomes[b];
    if (k.name !== tally[b].name || k.tiles !== tally[b].tiles || k.small !== tally[b].small || k.big !== tally[b].big ||
        k.waterTiles !== tally[b].water || JSON.stringify(Object.values(k.water)) !== JSON.stringify(tally[b].obj)) {
      bad.push('biome tally ' + tally[b].name); break;
    }
  }
  return bad;
}

const INDICES = [];
for (let i = 0; i < 48; i++) INDICES.push(i * 5 + 1);                 // 1, 6, ... 236 (the even walk)
for (let i = 0; i < 24; i++) INDICES.push(256 + i * 159);             // 256 .. 3913 (random pairings)
INDICES.push(0, 255, 4095);
// Sub-biomes need an interval that names more than one biome.
const SPLIT_ROWS = G.WG_BIOME_ROWS.map(r => r.slice());
SPLIT_ROWS[3] = [-0.2, 0.1, 'Temperate', 'Tropical', ''];
SPLIT_ROWS[1] = [-0.7, -0.4, 'Rocky', 'Polar', 'Volcanic'];

const CASES = [
  { label: 'competition, sub-biomes off (the game today)', over: {} },
  { label: 'parallel, sub-biomes off', over: { waterMode: 'parallel' } },
  { label: 'competition, sub-biomes on, split intervals', over: { subOn: true }, rows: SPLIT_ROWS },
  { label: 'parallel, sub-biomes on, split intervals', over: { subOn: true, waterMode: 'parallel' }, rows: SPLIT_ROWS },
  { label: 'competition, sub-biomes off, split intervals', over: {}, rows: SPLIT_ROWS },
  { label: 'start area off, Big island 30%, Perlin Modifier 0.4', over: { startClear: 0, bigPercent: 0.3, islandThreshold: 0.4 } }
];

console.log('\n=== Maps, tile by tile (' + INDICES.length + ' map indices per case) ===');
for (const cs of CASES) {
  const t0 = Date.now(), bad = [];
  const list = cs.label.indexOf('start area off') === 0 ? INDICES.slice(0, 24) : INDICES;
  for (const index of list) {
    const b = compareMap(index, cs.over, cs.rows);
    if (b.length) bad.push(index + ': ' + b.join(', '));
  }
  check(cs.label + ': ' + list.length + ' maps identical', bad.length === 0,
        bad.length ? bad.slice(0, 3).join(' | ') : (Date.now() - t0) + ' ms');
}

console.log('\n=== Statistics sampling ===');
for (const n of [64, 300]) {
  const R = refSetup({ iterations: n });
  const ref = G.wg_samples_(R.opts, R.biomes, R.water);
  const kit = WorldGen.stats(n, {}, { samples: true }).samples;
  const eq = (a, b) => JSON.stringify(Array.from(a)) === JSON.stringify(Array.from(b));
  const bad = [];
  if (!eq(ref.map.islandTiles, kit.map.islandTiles)) bad.push('island tiles');
  if (!eq(ref.map.bigIslands, kit.map.bigIslands)) bad.push('big islands');
  if (!eq(ref.map.groups, kit.map.groups)) bad.push('groups');
  if (!eq(ref.map.bareWater, kit.map.bareWater)) bad.push('bare water');
  for (let b = 0; b < ref.names.length; b++) {
    if (!eq(ref.share[b], kit.biomes[b].share)) bad.push('share ' + ref.names[b]);
    if (!eq(ref.islands[b], kit.biomes[b].islands)) bad.push('islands ' + ref.names[b]);
    if (!eq(ref.big[b], kit.biomes[b].big)) bad.push('big ' + ref.names[b]);
    R.water.forEach((w, k) => { if (!eq(ref.objIn[b][k], Object.values(kit.biomes[b].water)[k])) bad.push(w.name + ' in ' + ref.names[b]); });
  }
  R.water.forEach((w, k) => { if (!eq(ref.objTiles[k], kit.water[k].tiles)) bad.push(w.name + ' tiles'); });
  check(n + ' maps: every per-map number equals the reference report\'s sample', bad.length === 0, bad.slice(0, 4).join(', '));
}

console.log('\n=== Pinned island numbers (256 maps, one biome, no water) ===');
{
  const one = { biomes: [{ min: -1, max: 1, names: ['All'] }], water: [] };
  const off = WorldGen.stats(256, Object.assign({ startClear: 0 }, one)).map;
  check('big islands 76.3', near(off.bigIslands.mean, 76.3, 0.05), off.bigIslands.mean.toFixed(3));
  check('small islands 493.0', near(off.smallIslands.mean, 493.0, 0.05), off.smallIslands.mean.toFixed(3));
  check('water tiles 9201.8', near(off.waterTiles.mean, 9201.8, 0.05), off.waterTiles.mean.toFixed(3));
  check('island tiles 798.2 with the start area off', near(off.islandTiles.mean, 798.2, 0.05), off.islandTiles.mean.toFixed(3));
  const on = WorldGen.stats(256, one).map;
  check('island tiles about 797.6 with the start area on', near(on.islandTiles.mean, 797.6, 0.05), on.islandTiles.mean.toFixed(3));
  const R = refSetup({ startClear: 1 }, [[-1, 1, 'All', '', '']]);
  let refTiles = 0;
  for (let r = 0; r < 256; r++) refTiles += G.wg_build_(R.opts, R.biomes, [], r).islandTiles / 256;
  check('and the reference gives the same', near(refTiles, on.islandTiles.mean, 1e-9), refTiles.toFixed(3));
}

finish();

function finish() {
  console.log('\n' + (failures ? failures + ' of ' + checks + ' checks FAILED' : 'PASSED: all ' + checks + ' checks'));
  process.exitCode = failures ? 1 : 0;
}
