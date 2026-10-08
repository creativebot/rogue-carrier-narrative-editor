#!/usr/bin/env node
// Command line for the map generator.
//
//   node worldgen/cli.js map <index> [--out map.json] [--mode competition|parallel] [--settings file.json]
//   node worldgen/cli.js stats <nMaps> [--out stats.json] [--mode ...] [--settings file.json]
//
// `map` prints a short summary of map number <index> (0..4095) and, with --out, writes
// the whole map as JSON (tile arrays, islands, groups, water objects, counts).
// `stats` builds <nMaps> maps (1..4096) and prints averages and P10 / median / P90.
// --settings reads data/world/worldgen_settings.json or any file in that shape.

'use strict';
const fs = require('fs');
const path = require('path');
const WorldGen = require('./worldgen.js');

function usage(msg) {
  if (msg) console.error(msg + '\n');
  console.error('Usage:\n  node worldgen/cli.js map <index> [--out file.json] [--mode competition|parallel] [--settings file.json]\n' +
                '  node worldgen/cli.js stats <nMaps> [--out file.json] [--mode competition|parallel] [--settings file.json]');
  process.exit(1);
}

const args = process.argv.slice(2);
const flags = {}, rest = [];
for (let i = 0; i < args.length; i++) {
  if (args[i].indexOf('--') === 0) { flags[args[i].slice(2)] = args[i + 1]; i++; } else rest.push(args[i]);
}
const cmd = rest[0], arg = rest[1];

let settings = {};
if (flags.settings) settings = WorldGen.settingsFromJson(JSON.parse(fs.readFileSync(flags.settings, 'utf8')));
if (flags.mode) settings.waterMode = flags.mode;

const r1 = v => (Math.round(v * 10) / 10).toFixed(1);
const pct = v => (Math.round(v * 1000) / 10).toFixed(1) + '%';
const pad = (s, n) => String(s).padEnd(n);
const lpad = (s, n) => String(s).padStart(n);

function write(file, data) {
  fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data));
  console.log('\nWritten: ' + path.resolve(file));
}

if (cmd === 'map') {
  if (arg === undefined || !/^\d+$/.test(arg)) usage('map needs a whole map index, 0..4095.');
  const m = WorldGen.generate(Number(arg), settings), c = m.counts, s = m.seeds;
  console.log('Map ' + arg + ': ' + m.width + ' x ' + m.height + ' tiles (' + m.tileKm + ' km each), water objects: ' + m.mode);
  console.log('Seeds: islands ' + s.islands + ', biomes ' + s.biomes + ', sub-biomes ' + s.sub + ', water ' +
              m.waterObjects.map((o, k) => o.name + ' ' + s.water[k]).join(', '));
  console.log('Start: tile (' + m.start.x + ', ' + m.start.y + '), tiles within ' + m.start.clear + ' kept empty');
  console.log('Islands: ' + c.islands + ' (' + c.smallIslands + ' small, ' + c.bigIslands + ' big 2x2), ' +
              c.islandTiles + ' island tiles, ' + c.groups + ' groups');
  console.log('Water: ' + c.waterTiles + ' tiles, ' + c.objectTiles + ' with an object, ' + c.bareWater + ' empty');
  console.log('\n' + pad('Biome', 11) + lpad('Share', 7) + lpad('Islands', 9) + lpad('Big', 5) + lpad('Groups', 8) +
              m.waterObjects.map(o => lpad(o.name.split(' ')[0], 10)).join(''));
  for (const b of c.biomes) {
    console.log(pad(b.name, 11) + lpad(pct(b.share), 7) + lpad(b.islands, 9) + lpad(b.big, 5) + lpad(b.groups, 8) +
                m.waterObjects.map(o => lpad(b.water[o.key], 10)).join(''));
  }
  const absent = m.biomeNames.filter(n => m.biomesPresent.indexOf(n) < 0);
  console.log('\nBiomes on this map: ' + m.biomesPresent.join(', ') + (absent.length ? '   (missing: ' + absent.join(', ') + ')' : ''));
  if (flags.out) write(flags.out, WorldGen.toJSON(m));
} else if (cmd === 'stats') {
  const n = Number(arg);
  if (!(n >= 1 && n <= 4096 && Math.floor(n) === n)) usage('stats needs a number of maps, 1..4096.');
  const t0 = Date.now(), st = WorldGen.stats(n, settings);
  console.log(n + ' maps (' + st.indices + '), water objects: ' + st.mode + ', ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
  const row = (label, sp, f) => console.log(pad(label, 26) + [sp.mean, sp.p10, sp.median, sp.p90].map(v => lpad(f(v), 9)).join('') +
                                             lpad(pct(sp.none), 9));
  const head = first => console.log('\n' + pad(first, 26) + ['Average', 'P10', 'Median', 'P90', 'None'].map(h => lpad(h, 9)).join(''));
  head('Whole map');
  row('Island tiles', st.map.islandTiles, r1); row('Islands', st.map.islands, r1); row('Big islands', st.map.bigIslands, r1);
  row('Groups', st.map.groups, r1); row('Water tiles with an object', st.map.objectTiles, r1);
  row('Biomes present', st.map.biomesPresent, r1);
  head('Biome: share of the map'); st.biomes.forEach(b => row(b.name, b.share, pct));
  head('Biome: islands'); st.biomes.forEach(b => row(b.name, b.islands, r1));
  head('Biome: big islands'); st.biomes.forEach(b => row(b.name, b.big, r1));
  head('Biome: island groups'); st.biomes.forEach(b => row(b.name, b.groups, r1));
  for (const o of st.water) { head('Biome: ' + o.name.toLowerCase() + ' tiles'); st.biomes.forEach(b => row(b.name, b.water[o.key], r1)); }
  head('Water object tiles'); st.water.forEach(o => row(o.name, o.tiles, r1));
  console.log('\n"None" = share of maps where the number is 0 (for a biome share: the biome is not on the map at all).');
  if (flags.out) write(flags.out, st);
} else {
  usage();
}
