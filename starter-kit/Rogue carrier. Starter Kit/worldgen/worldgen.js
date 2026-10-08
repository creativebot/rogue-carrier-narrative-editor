/*
 * WorldGen — the game's map generator, as one dependency-free JavaScript file.
 *
 * Works in node (`const WorldGen = require('./worldgen.js')`) and in a browser
 * (`<script src="worldgen.js">` gives a global `WorldGen`).
 *
 * It reproduces the team's reference model of the generator tile for tile: the same
 * Perlin noise (a port of the developer's Unreal Engine C++), the same seed per layer,
 * the same layers in the same order, the same random choices. `verify.js` proves it.
 *
 * A map is built in layers:
 *
 *   1. Islands     one Perlin noise; a tile above the land threshold is land. Each land
 *                  tile is one small island.
 *   2. Biomes      a second noise, a "heat map" between -1 and 1. The value falls in one
 *                  interval, and the interval names the biome. Biomes cover water and land.
 *   3. Sub-biomes  optional, off by default. Where an interval names two or three biomes,
 *                  a third noise picks one of them per tile.
 *   4. Big islands each biome gets round(Big % x its small-island count) 2x2 stamps, each
 *                  wholly inside that biome, never overlapping another stamp.
 *   5. Groups      island tiles that share an edge form a group; the whole group takes the
 *                  biome that holds most of its tiles (ties: random among the leaders).
 *   6. Water       reefs, seaweed and floating islands, each with its own noise, on water
 *                  tiles only. "competition": one object per tile, highest noise wins.
 *                  "parallel": every object whose noise is high enough stays.
 *
 * The tiles around the start (the centre tile and its neighbours) are always empty.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.WorldGen = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  // =====================================================================
  // Settings
  // =====================================================================

  /** The seven biomes the game has, coldest first. */
  var BIOMES = ['Polar', 'Rocky', 'Volcanic', 'Temperate', 'Tropical', 'Shallow', 'Desert'];

  /** The water modes. competition = what the game does today; parallel = planned mechanic. */
  var MODES = ['competition', 'parallel'];

  /**
   * The current engine settings. Every field is explained in
   * data/world/worldgen_settings.json and docs/02_WORLD.md.
   */
  var DEFAULTS = {
    // Map
    width: 100,               // tiles; one tile is a 2.5 km square
    height: 100,
    startClear: 1,            // tiles within this distance of the centre tile stay empty (1 = 3x3 block)

    // Islands layer
    islandPattern: 1,         // Pattern Scale
    islandNoise: 1.4,         // Noise Scale
    islandOctaves: 12,
    islandOffset: 0,
    islandMultiplier: 1,
    islandThreshold: 0.5,     // "Perlin Modifier": noise above it is land
    bigPercent: 0.15,         // big islands per biome, as a share of that biome's small islands

    // Biomes layer
    biomePattern: 0.5,
    biomeNoise: 8,
    biomeOctaves: 4,
    biomeOffset: 0,
    biomeMultiplier: 1,

    // Sub-biomes layer (off in the game)
    subOn: false,
    subPattern: 0.5,
    subNoise: 8,
    subOctaves: 4,
    subOffset: 0,
    subMultiplier: 1,

    // Water objects
    waterMode: 'competition',

    // Biome intervals of the biome noise: Min inclusive, Max exclusive (the last one
    // also takes values above 1). `names` lists one biome, or two or three for sub-biomes.
    biomes: [
      { min: -1,   max: -0.7, names: ['Polar'] },
      { min: -0.7, max: -0.4, names: ['Rocky'] },
      { min: -0.4, max: -0.2, names: ['Volcanic'] },
      { min: -0.2, max: 0.1,  names: ['Temperate'] },
      { min: 0.1,  max: 0.4,  names: ['Tropical'] },
      { min: 0.4,  max: 0.7,  names: ['Shallow'] },
      { min: 0.7,  max: 1,    names: ['Desert'] }
    ],

    // Water object layers, in table order (the order breaks ties in competition).
    water: [
      { key: 'reef',     name: 'Reef',            noiseScale: 1,   patternScale: 1.1, octaves: 4,
        offset: 0, multiplier: 1, threshold: 0.3, on: true },
      { key: 'seaweed',  name: 'Seaweed',         noiseScale: 1.1, patternScale: 1,   octaves: 4,
        offset: 0, multiplier: 1, threshold: 0.2, on: true },
      { key: 'floating', name: 'Floating island', noiseScale: 1,   patternScale: 1.1, octaves: 4,
        offset: 0, multiplier: 1, threshold: 0.5, on: true }
    ]
  };

  /** Colours the map preview uses: [hue, saturation] per biome. */
  var TONES = {
    polar: [212, 30], rocky: [220, 6], volcanic: [8, 55], temperate: [112, 40],
    tropical: [168, 55], shallow: [190, 60], desert: [43, 65]
  };

  /**
   * A CSS colour for a biome: 'water' (pale), 'island' (strong) or 'big' (dark).
   * Biomes outside the seven get a hue off the colour wheel.
   */
  function colour(name, kind, index) {
    var t = TONES[String(name || '').toLowerCase()] || [((index || 0) * 47) % 360, 45];
    var light = kind === 'big' ? 22 : kind === 'island' ? 38 : 84;
    return 'hsl(' + t[0] + ',' + t[1] + '%,' + light + '%)';
  }

  function clone(v) { return JSON.parse(JSON.stringify(v)); }

  function num(v, def) {
    if (v === null || v === undefined || v === '') return def;
    var x = Number(v);
    return isNaN(x) ? def : x;
  }

  function slug(name) {
    var s = String(name || '').toLowerCase();
    if (s.indexOf('float') >= 0) return 'floating';
    return s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '') || 'object';
  }

  /**
   * Full settings from a partial object: anything left out keeps its default. Biome
   * intervals whose Min equals Max have no room and are dropped (that switches a biome
   * off). Accepts `name` / `biome` instead of `names` in an interval.
   */
  function resolveSettings(settings) {
    var s = clone(DEFAULTS);
    if (settings) {
      for (var k in settings) {
        if (Object.prototype.hasOwnProperty.call(settings, k) && settings[k] !== undefined) s[k] = clone(settings[k]);
      }
    }
    var keys = Object.keys(DEFAULTS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i], def = DEFAULTS[key];
      if (typeof def === 'number') s[key] = num(s[key], def);
    }
    s.width = Math.max(1, Math.round(s.width));
    s.height = Math.max(1, Math.round(s.height));
    s.subOn = s.subOn === true || s.subOn === 'TRUE' || s.subOn === 'true' || s.subOn === 1;
    s.waterMode = String(s.waterMode || '').toLowerCase().trim();
    if (MODES.indexOf(s.waterMode) < 0) s.waterMode = MODES[0];

    var biomes = [];
    for (i = 0; i < (s.biomes || []).length; i++) {
      var iv = s.biomes[i], names = iv.names || [iv.name || iv.biome];
      names = names.filter(function (n) { return n !== undefined && n !== null && String(n).trim() !== ''; })
                   .map(function (n) { return String(n).trim(); });
      if (!names.length) continue;
      var lo = num(iv.min, -1), hi = num(iv.max, 1);
      if (!(Math.abs(hi - lo) > 0)) continue;
      biomes.push({ min: lo, max: hi, names: names });
    }
    if (!biomes.length) throw new Error('WorldGen: no biome interval has room (all blank or Min = Max).');
    s.biomes = biomes;

    s.water = (s.water || []).filter(function (w) { return w && w.name; }).map(function (w) {
      return {
        key: w.key || slug(w.name), name: String(w.name),
        noiseScale: num(w.noiseScale, 1), patternScale: num(w.patternScale, 1), octaves: num(w.octaves, 4),
        offset: num(w.offset, 0), multiplier: num(w.multiplier, 1), threshold: num(w.threshold, 0.5),
        on: w.on === undefined ? true : !(w.on === false || w.on === 'FALSE' || w.on === 'false' || w.on === 0)
      };
    });
    return s;
  }

  /**
   * Settings from data/world/worldgen_settings.json, whose fields are
   * { value, unit, meaning } objects. Plain values are accepted too.
   */
  function settingsFromJson(json) {
    var out = {}, src = json && json.settings ? json.settings : json || {};
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var v = src[k];
      out[k] = v && typeof v === 'object' && !Array.isArray(v) && 'value' in v ? v.value : v;
    }
    if (json && json.biomes) out.biomes = json.biomes;
    if (json && json.waterObjects) out.water = json.waterObjects;
    return resolveSettings(out);
  }

  /** Every biome named in the intervals, in the order they first appear. */
  function biomeNames(intervals) {
    var names = [], seen = {};
    for (var i = 0; i < intervals.length; i++) {
      for (var j = 0; j < intervals[i].names.length; j++) {
        var n = intervals[i].names[j];
        if (!(n in seen)) { seen[n] = names.length; names.push(n); }
      }
    }
    return names;
  }

  /**
   * The interval a biome value falls in: the first that holds it (Min inclusive, Max
   * exclusive). A value no interval holds (off the ends, or in a gap) goes to the
   * nearest interval.
   */
  function intervalOf(intervals, v) {
    var best = 0, gap = Infinity;
    for (var i = 0; i < intervals.length; i++) {
      var lo = Math.min(intervals[i].min, intervals[i].max), hi = Math.max(intervals[i].min, intervals[i].max);
      if (v >= lo && v < hi) return i;
      var d = v < lo ? lo - v : v - hi;
      if (d < gap) { gap = d; best = i; }
    }
    return best;
  }

  // =====================================================================
  // Noise: FMath::PerlinNoise2D and the octave loop, as in the engine
  // =====================================================================
  //
  //   for o in 0 .. Octaves-1:
  //     Shift = 2^o
  //     Sum  += PerlinNoise2D(X * PatternScale * Shift / NoiseScale + Seed,
  //                           Y * PatternScale * Shift / NoiseScale + Seed) / Shift
  //   Value = Sum * Multiplier + Offset
  //
  // X, Y are tile indices. Seed is the layer's seed (the engine cuts it to int16;
  // only the seed modulo 256 changes the noise, so there are 256 seeds per layer).

  var PERM = (function () {
    var base = [
      151,160,137,91,90,15,131,13,201,95,96,53,194,233,7,225,140,36,103,30,69,142,
      8,99,37,240,21,10,23,190,6,148,247,120,234,75,0,26,197,62,94,252,219,203,117,
      35,11,32,57,177,33,88,237,149,56,87,174,20,125,136,171,168,68,175,74,165,71,
      134,139,48,27,166,77,146,158,231,83,111,229,122,60,211,133,230,220,105,92,41,
      55,46,245,40,244,102,143,54,65,25,63,161,1,216,80,73,209,76,132,187,208,89,18,
      169,200,196,135,130,116,188,159,86,164,100,109,198,173,186,3,64,52,217,226,250,
      124,123,5,202,38,147,118,126,255,82,85,212,207,206,59,227,47,16,58,17,182,189,
      28,42,223,183,170,213,119,248,152,2,44,154,163,70,221,153,101,155,167,43,172,9,
      129,22,39,253,19,98,108,110,79,113,224,232,178,185,112,104,218,246,97,228,251,
      34,242,193,238,210,144,12,191,179,162,241,81,51,145,235,249,14,239,107,49,192,
      214,31,181,199,106,157,184,84,204,176,115,121,50,45,127,4,150,254,138,236,205,
      93,222,114,67,29,24,72,243,141,128,195,78,66,215,61,156,180
    ];
    var p = new Int32Array(512);
    for (var i = 0; i < 256; i++) { p[i] = base[i]; p[i + 256] = base[i]; }
    return p;
  })();

  var SEEDS_PER_LAYER = 256;

  function smooth(t) { return t * t * t * (t * (t * 6 - 15) + 10); }

  function grad2(hash, x, y) {
    switch (hash & 7) {
      case 0: return x;
      case 1: return x + y;
      case 2: return y;
      case 3: return -x + y;
      case 4: return -x;
      case 5: return -x - y;
      case 6: return -y;
      default: return x - y;
    }
  }

  /** One noise cell: lattice corner (xi, yi), offsets inside it, and the fade curves. */
  function cell(xi, yi, X, Y, Xm1, Ym1, U, V) {
    var AA = PERM[xi] + yi, AB = AA + 1, BA = PERM[xi + 1] + yi, BB = BA + 1;
    var a = grad2(PERM[AA], X, Y), b = grad2(PERM[BA], Xm1, Y);
    var c = grad2(PERM[AB], X, Ym1), d = grad2(PERM[BB], Xm1, Ym1);
    var top = a + U * (b - a), bottom = c + U * (d - c);
    return top + V * (bottom - top);
  }

  /** FMath::PerlinNoise2D: a value between about -1 and 1, exactly 0 on whole coordinates. */
  function perlin(x, y) {
    var xfl = Math.floor(x), yfl = Math.floor(y);
    var X = x - xfl, Y = y - yfl;
    return cell(xfl & 255, yfl & 255, X, Y, X - 1, Y - 1, smooth(X), smooth(Y));
  }

  /** One axis of one octave, precomputed for coordinates 0 .. n-1. */
  function axis(n, patternScale, octaveScale, seed) {
    var cellIx = new Int32Array(n), frac = new Float64Array(n), curve = new Float64Array(n);
    var lattice = true;
    for (var i = 0; i < n; i++) {
      var c = i * patternScale * octaveScale + seed;
      var fl = Math.floor(c);
      cellIx[i] = fl & 255;
      frac[i] = c - fl;
      curve[i] = smooth(frac[i]);
      if (frac[i] !== 0) lattice = false;
    }
    return { cell: cellIx, frac: frac, curve: curve, lattice: lattice };
  }

  /**
   * A noise layer ready to sample on a w x h map. An octave whose every coordinate
   * lands on the lattice adds exactly 0 and is dropped. `reach` is how far the octaves
   * from one on could still move the sum (each octave is at most 2 / Shift).
   * `params`: { patternScale, noiseScale, octaves, offset, multiplier }.
   */
  function noiseLayer(w, h, params, seed) {
    var ns = Math.max(Number(params.noiseScale) || 0, 1e-8);
    var ps = Number(params.patternScale);
    if (!isFinite(ps)) ps = 1;
    var oc = Math.max(0, Math.min(24, Math.round(Number(params.octaves) || 0)));
    var mult = params.multiplier === undefined || params.multiplier === '' ? 1 : Number(params.multiplier);
    var off = params.offset === undefined || params.offset === '' ? 0 : Number(params.offset);
    var live = [];
    for (var o = 0; o < oc; o++) {
      var shift = 1 << o, scale = shift / ns;
      var ax = axis(w, ps, scale, seed), ay = axis(h, ps, scale, seed);
      if (ax.lattice && ay.lattice) continue;
      live.push({ shift: shift, x: ax, y: ay, reach: 0 });
    }
    var reach = 1e-9;
    for (var k = live.length - 1; k >= 0; k--) { reach += 2 / live[k].shift; live[k].reach = reach; }
    return { octaves: live, multiplier: isFinite(mult) ? mult : 1, offset: isFinite(off) ? off : 0,
             asked: oc, alive: live.length };
  }

  /** The layer's value at a tile: all octaves summed, then Multiplier and Offset. */
  function valueAt(layer, x, y) {
    var live = layer.octaves, sum = 0;
    for (var k = 0; k < live.length; k++) {
      var ax = live[k].x, ay = live[k].y, X = ax.frac[x], Y = ay.frac[y];
      sum += cell(ax.cell[x], ay.cell[y], X, Y, X - 1, Y - 1, ax.curve[x], ay.curve[y]) / live[k].shift;
    }
    return sum * layer.multiplier + layer.offset;
  }

  /** The threshold in the raw sum's units; null when Multiplier is not positive. */
  function rawThreshold(layer, threshold) {
    if (!(layer.multiplier > 0)) return null;
    return (threshold - layer.offset) / layer.multiplier;
  }

  /** Is the tile above the threshold? Stops early once the answer cannot change. */
  function isAbove(layer, x, y, raw, threshold) {
    if (raw === null) return valueAt(layer, x, y) > threshold;
    var live = layer.octaves, sum = 0;
    for (var k = 0; k < live.length; k++) {
      var reach = live[k].reach;
      if (sum - reach > raw) return true;
      if (sum + reach <= raw) return false;
      var ax = live[k].x, ay = live[k].y, X = ax.frac[x], Y = ay.frac[y];
      sum += cell(ax.cell[x], ay.cell[y], X, Y, X - 1, Y - 1, ax.curve[x], ay.curve[y]) / live[k].shift;
    }
    return sum > raw;
  }

  /** The value when the tile is above the threshold, NaN when it is not. */
  function valueAbove(layer, x, y, raw, threshold) {
    if (raw === null) {
      var v = valueAt(layer, x, y);
      return v > threshold ? v : NaN;
    }
    var live = layer.octaves, sum = 0;
    for (var k = 0; k < live.length; k++) {
      if (sum + live[k].reach <= raw) return NaN;
      var ax = live[k].x, ay = live[k].y, X = ax.frac[x], Y = ay.frac[y];
      sum += cell(ax.cell[x], ay.cell[y], X, Y, X - 1, Y - 1, ax.curve[x], ay.curve[y]) / live[k].shift;
    }
    return sum > raw ? sum * layer.multiplier + layer.offset : NaN;
  }

  /** Deterministic random numbers in [0, 1) (mulberry32). */
  function rng(a) {
    a = a >>> 0;
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // =====================================================================
  // Seeds
  // =====================================================================
  //
  // In the game every layer draws its own random seed, and only the seed modulo 256
  // matters, so each layer has 256 possible seeds and there are 256^layers distinct
  // worlds. Map numbers here pick one combination:
  //
  //   index 0..255   "the even walk": layer L gets seed (index * a_L + b_L) mod 256 with a
  //                  different odd a_L per layer. Over these 256 maps every layer meets
  //                  each of its 256 seeds exactly once (islands take the index itself).
  //   index 256+     every layer's seed drawn at random from the index, the way
  //                  independent seeds would pair up in the game.

  var STAMP_SEED = 1337;
  var STAMP_TRIES = 64;
  var MAX_INDEX = 4095;
  var LAYER_SCRAMBLE = [[1, 0], [167, 71], [29, 113], [101, 13], [57, 199], [211, 37],
                        [83, 151], [139, 89], [45, 3], [233, 181], [119, 57], [7, 229]];
  var LAYER_ISLANDS = 0, LAYER_BIOMES = 1, LAYER_SUB = 2, LAYER_WATER = 3;

  function layerSeed(base, layer) {
    var s = LAYER_SCRAMBLE[layer % LAYER_SCRAMBLE.length];
    return (((base * s[0] + s[1]) % SEEDS_PER_LAYER) + SEEDS_PER_LAYER) % SEEDS_PER_LAYER;
  }

  function wholeIndex(index) {
    var n = Number(index);
    if (!(n >= 0) || Math.floor(n) !== n) throw new Error('WorldGen: a map index is a whole number from 0 (got ' + index + ').');
    return n;
  }

  /**
   * The seed of every layer for map number `index` (0..4095 in the team's tools; any
   * whole number works). `waterCount` = number of water object rows (default 3).
   * Returns { index, base, islands, biomes, sub, water: [one per water row] }.
   * `base` seeds the random tie-break of the group rule.
   */
  function mapSeeds(index, waterCount) {
    index = wholeIndex(index);
    var W = waterCount === undefined ? DEFAULTS.water.length : waterCount;
    var out = { index: index, base: index, islands: 0, biomes: 0, sub: 0, water: [] }, k;
    if (index < SEEDS_PER_LAYER) {
      out.islands = layerSeed(index, LAYER_ISLANDS);
      out.biomes = layerSeed(index, LAYER_BIOMES);
      out.sub = layerSeed(index, LAYER_SUB);
      for (k = 0; k < W; k++) out.water.push(layerSeed(index, LAYER_WATER + k));
      return out;
    }
    var rand = rng(STAMP_SEED * 97 + index * 7919);
    var pick = function () { return Math.floor(rand() * SEEDS_PER_LAYER); };
    out.islands = pick(); out.biomes = pick(); out.sub = pick();
    for (k = 0; k < W; k++) out.water.push(pick());
    return out;
  }

  /** Explicit seeds: missing layers come from mapSeeds(base); every seed is cut to 0..255. */
  function seedsFrom(given, waterCount) {
    var wrap = function (v) { return ((Math.round(Number(v) || 0) % 256) + 256) % 256; };
    var base = given.base !== undefined ? Math.round(Number(given.base) || 0)
             : given.islands !== undefined ? wrap(given.islands) : 0;
    var fill = mapSeeds(Math.max(0, base), waterCount);
    var out = { index: given.index !== undefined ? given.index : null, base: base,
                islands: wrap(given.islands !== undefined ? given.islands : fill.islands),
                biomes: wrap(given.biomes !== undefined ? given.biomes : fill.biomes),
                sub: wrap(given.sub !== undefined ? given.sub : fill.sub), water: [] };
    for (var k = 0; k < waterCount; k++) {
      out.water.push(wrap(given.water && given.water[k] !== undefined ? given.water[k] : fill.water[k]));
    }
    return out;
  }

  // =====================================================================
  // Layers
  // =====================================================================

  /** The start tile (the ship starts in its middle). */
  function startTile(w, h) { return { x: Math.floor(w / 2), y: Math.floor(h / 2) }; }

  /** Tiles kept empty round the start: within `radius` steps of a king's move (1 = 3x3). */
  function startArea(w, h, radius) {
    var out = new Uint8Array(w * h), r = Math.round(Number(radius) || 0);
    if (r < 1) return out;
    var c = startTile(w, h);
    for (var y = Math.max(0, c.y - r); y <= Math.min(h - 1, c.y + r); y++) {
      for (var x = Math.max(0, c.x - r); x <= Math.min(w - 1, c.x + r); x++) out[y * w + x] = 1;
    }
    return out;
  }

  /**
   * Big islands for biome `b`: up to `count` 2x2 stamps with all four tiles in `b`, not on
   * another stamp, not on the start area. A random spot is tried up to 64 times; then the
   * free spots inside the biome are listed and one is drawn. Returns the anchors (top-left).
   */
  function stampIn(w, h, count, rand, big, biome, b, empty) {
    var anchors = [];
    if (w < 2 || h < 2 || count < 1) return anchors;
    var aw = w - 1, ah = h - 1;
    function fits(c) {
      if (empty && (empty[c] || empty[c + 1] || empty[c + w] || empty[c + w + 1])) return false;
      return !big[c] && !big[c + 1] && !big[c + w] && !big[c + w + 1] &&
             biome[c] === b && biome[c + 1] === b && biome[c + w] === b && biome[c + w + 1] === b;
    }
    function put(c) { big[c] = 1; big[c + 1] = 1; big[c + w] = 1; big[c + w + 1] = 1; anchors.push(c); }
    for (var n = 0; n < count; n++) {
      var done = false;
      for (var t = 0; t < STAMP_TRIES && !done; t++) {
        var c = Math.floor(rand() * ah) * w + Math.floor(rand() * aw);
        if (fits(c)) { put(c); done = true; }
      }
      if (done) continue;
      var spots = [];
      for (var ay = 0; ay < ah; ay++) for (var ax = 0; ax < aw; ax++) if (fits(ay * w + ax)) spots.push(ay * w + ax);
      if (!spots.length) break;
      put(spots[Math.floor(rand() * spots.length)]);
    }
    return anchors;
  }

  /**
   * Island groups: island tiles sharing an edge are one group, and the group takes the
   * biome holding most of its tiles; a tie is a random pick among the leaders only.
   * Rewrites `biome` on island tiles, fills `groupOf`, returns the groups.
   */
  function groupBiomes(w, h, isLand, biome, biomeCount, rand, groupOf) {
    var area = w * h, stack = [], tally = new Int32Array(biomeCount), groups = [], moved = 0;
    for (var start = 0; start < area; start++) {
      if (!isLand[start] || groupOf[start] >= 0) continue;
      var id = groups.length, members = [];
      stack.push(start);
      groupOf[start] = id;
      while (stack.length) {
        var i = stack.pop(), x = i % w;
        members.push(i);
        if (x > 0 && isLand[i - 1] && groupOf[i - 1] < 0) { groupOf[i - 1] = id; stack.push(i - 1); }
        if (x < w - 1 && isLand[i + 1] && groupOf[i + 1] < 0) { groupOf[i + 1] = id; stack.push(i + 1); }
        if (i >= w && isLand[i - w] && groupOf[i - w] < 0) { groupOf[i - w] = id; stack.push(i - w); }
        if (i + w < area && isLand[i + w] && groupOf[i + w] < 0) { groupOf[i + w] = id; stack.push(i + w); }
      }
      members.sort(function (a, b) { return a - b; });
      groups.push({ id: id, tiles: members, biomeIndex: biome[members[0]] });
      if (members.length === 1) continue;
      for (var t = 0; t < biomeCount; t++) tally[t] = 0;
      for (var m = 0; m < members.length; m++) tally[biome[members[m]]]++;
      var best = 0, leaders = [];
      for (t = 0; t < biomeCount; t++) {
        if (tally[t] > best) { best = tally[t]; leaders = [t]; }
        else if (tally[t] === best && best > 0) leaders.push(t);
      }
      if (leaders.length === 1 && best === members.length) continue;
      var pick = leaders.length === 1 ? leaders[0] : leaders[Math.floor(rand() * leaders.length)];
      for (m = 0; m < members.length; m++) {
        if (biome[members[m]] !== pick) { biome[members[m]] = pick; moved++; }
      }
      groups[id].biomeIndex = pick;
    }
    return { groups: groups, moved: moved };
  }

  // =====================================================================
  // One map
  // =====================================================================

  /**
   * Builds one map.
   *
   *   indexOrSeeds  a map number (see mapSeeds), or explicit seeds
   *                 { base?, islands, biomes, sub?, water?: [...] }
   *   settings      optional, partial; missing fields keep DEFAULTS
   *
   * Tile arrays are indexed by i = y * width + x.
   */
  function generate(indexOrSeeds, settings) {
    var S = resolveSettings(settings);
    var w = S.width, h = S.height, area = w * h, water = S.water, W = water.length;
    var seeds = typeof indexOrSeeds === 'object' && indexOrSeeds !== null ? seedsFrom(indexOrSeeds, W)
              : mapSeeds(indexOrSeeds === undefined ? 0 : indexOrSeeds, W);
    var names = biomeNames(S.biomes), B = names.length;
    var on = [];
    for (var l = 0; l < W; l++) if (water[l].on) on.push(l);

    var landNoise = new Uint8Array(area), big = new Uint8Array(area);
    var biome = new Int16Array(area), obj = new Int32Array(area);
    var empty = startArea(w, h, S.startClear);
    var i, x, y, n, k, q;

    // 1. Islands: land where the islands noise is above the Perlin Modifier; none on the start area.
    var isl = noiseLayer(w, h, { patternScale: S.islandPattern, noiseScale: S.islandNoise, octaves: S.islandOctaves,
                                 offset: S.islandOffset, multiplier: S.islandMultiplier }, seeds.islands);
    var islRaw = rawThreshold(isl, S.islandThreshold);
    for (y = 0, i = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++) landNoise[i] = !empty[i] && isAbove(isl, x, y, islRaw, S.islandThreshold) ? 1 : 0;
    }

    // 2. Biomes: the heat-map value picks an interval; 3. sub-biomes split a multi-name interval.
    var bio = noiseLayer(w, h, { patternScale: S.biomePattern, noiseScale: S.biomeNoise, octaves: S.biomeOctaves,
                                 offset: S.biomeOffset, multiplier: S.biomeMultiplier }, seeds.biomes);
    var multi = S.biomes.some(function (iv) { return iv.names.length > 1; });
    var useSub = S.subOn && multi;
    var sub = useSub ? noiseLayer(w, h, { patternScale: S.subPattern, noiseScale: S.subNoise, octaves: S.subOctaves,
                                          offset: S.subOffset, multiplier: S.subMultiplier }, seeds.sub) : null;
    var byName = {};
    for (n = 0; n < B; n++) byName[names[n]] = n;
    for (y = 0, i = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++) {
        var iv = S.biomes[intervalOf(S.biomes, valueAt(bio, x, y))];
        var pick = 0;
        if (useSub && iv.names.length > 1) {
          var band = Math.floor((valueAt(sub, x, y) + 1) / 2 * iv.names.length);
          pick = Math.max(0, Math.min(iv.names.length - 1, band));
        }
        biome[i] = byName[iv.names[pick]];
      }
    }

    // 4. Big islands: per biome, round(Big % x its land tiles) 2x2 stamps wholly inside it.
    var landIn = new Array(B).fill(0);
    for (i = 0; i < area; i++) if (landNoise[i]) landIn[biome[i]]++;
    var stampRand = rng(STAMP_SEED + seeds.islands), anchors = [];
    for (n = 0; n < B; n++) {
      anchors = anchors.concat(stampIn(w, h, Math.round(S.bigPercent * landIn[n]), stampRand, big, biome, n, empty));
    }

    // 5. Groups: touching island tiles share one biome.
    var isLand = new Uint8Array(area);
    for (i = 0; i < area; i++) isLand[i] = landNoise[i] || big[i] ? 1 : 0;
    var groupOf = new Int32Array(area).fill(-1);
    var grouped = groupBiomes(w, h, isLand, biome, B, rng(STAMP_SEED * 7 + seeds.base), groupOf);

    // 6. Water objects, on water tiles only.
    var layers = [], raws = [];
    for (k = 0; k < W; k++) {
      var live = noiseLayer(w, h, water[k], seeds.water[k]);
      layers.push(live);
      raws.push(rawThreshold(live, water[k].threshold));
    }
    var claims = new Array(W).fill(0), kept = new Array(W).fill(0), lost = new Array(W).fill(0);
    var contested = 0, bare = 0, parallel = S.waterMode === 'parallel', values = [];
    for (y = 0, i = 0; y < h; y++) {
      for (x = 0; x < w; x++, i++) {
        if (isLand[i]) continue;
        if (empty[i]) { bare++; continue; }
        var hits = 0, best = -1, bestVal = 0;
        for (q = 0; q < on.length; q++) {
          var idx = on[q];
          var v = valueAbove(layers[idx], x, y, raws[idx], water[idx].threshold);
          values[idx] = v;
          if (v === v) { // not NaN: this object claims the tile
            claims[idx]++;
            hits++;
            if (best < 0 || v > bestVal) { best = idx; bestVal = v; }
          }
        }
        if (!hits) { bare++; continue; }
        if (hits > 1) contested++;
        if (parallel) {
          for (q = 0; q < on.length; q++) {
            idx = on[q];
            if (values[idx] === values[idx]) { obj[i] |= 1 << idx; kept[idx]++; }
          }
        } else {
          obj[i] |= 1 << best; // highest noise wins; a tie goes to the earlier row
          kept[best]++;
          for (q = 0; q < on.length; q++) {
            idx = on[q];
            if (idx !== best && values[idx] === values[idx]) lost[idx]++;
          }
        }
      }
    }

    return describe(S, seeds, names, { landNoise: landNoise, big: big, isLand: isLand, biome: biome, obj: obj,
      groupOf: groupOf, anchors: anchors, groups: grouped.groups, moved: grouped.moved, claims: claims, kept: kept,
      lost: lost, contested: contested, bare: bare, live: { islands: isl.alive, biomes: bio.alive,
      sub: sub ? sub.alive : 0, water: layers.map(function (t) { return t.alive; }) } });
  }

  /** Turns the raw layers into the map object tools consume. */
  function describe(S, seeds, names, r) {
    var w = S.width, h = S.height, area = w * h, B = names.length, water = S.water, W = water.length, i, k, b;
    var anchorAt = new Int32Array(area).fill(-1);
    for (k = 0; k < r.anchors.length; k++) anchorAt[r.anchors[k]] = k;

    // Islands, ordered by their top-left tile: a 2x2 big island, or one small-island tile.
    var islandOf = new Int32Array(area).fill(-1), bigOf = new Int32Array(area).fill(-1);
    var islands = [], bigIslands = [];
    for (i = 0; i < area; i++) {
      if (anchorAt[i] >= 0) {
        var tiles = [i, i + 1, i + w, i + w + 1], bigId = bigIslands.length;
        var isle = { id: islands.length, type: 'big', x: i % w, y: Math.floor(i / w), size: 2, tiles: tiles,
                     biome: names[r.biome[i]], biomeIndex: r.biome[i], group: r.groupOf[i], bigId: bigId };
        for (k = 0; k < 4; k++) { islandOf[tiles[k]] = isle.id; bigOf[tiles[k]] = bigId; }
        islands.push(isle);
        bigIslands.push(isle);
      } else if (r.landNoise[i] && !r.big[i]) {
        islandOf[i] = islands.length;
        islands.push({ id: islands.length, type: 'small', x: i % w, y: Math.floor(i / w), size: 1, tiles: [i],
                       biome: names[r.biome[i]], biomeIndex: r.biome[i], group: r.groupOf[i] });
      }
    }

    // Groups: tiles, islands, biome, bounding box.
    var groups = r.groups.map(function (g) {
      var x0 = w, y0 = h, x1 = -1, y1 = -1, ids = {};
      for (var t = 0; t < g.tiles.length; t++) {
        var gx = g.tiles[t] % w, gy = Math.floor(g.tiles[t] / w);
        if (gx < x0) x0 = gx; if (gx > x1) x1 = gx; if (gy < y0) y0 = gy; if (gy > y1) y1 = gy;
        ids[islandOf[g.tiles[t]]] = 1;
      }
      var list = Object.keys(ids).map(Number).sort(function (a, b2) { return a - b2; });
      return { id: g.id, biome: names[g.biomeIndex], biomeIndex: g.biomeIndex, size: g.tiles.length,
               tiles: g.tiles, islands: list, box: { x0: x0, y0: y0, x1: x1, y1: y1 } };
    });

    // Water objects by kind, and the per-biome tally.
    var objLists = {};
    for (k = 0; k < W; k++) objLists[water[k].key] = [];
    var perBiome = names.map(function (name) {
      var row = { name: name, tiles: 0, share: 0, islandTiles: 0, islands: 0, small: 0, big: 0, groups: 0,
                  waterTiles: 0, water: {} };
      for (var k2 = 0; k2 < W; k2++) row.water[water[k2].key] = 0;
      return row;
    });
    for (i = 0; i < area; i++) {
      var row = perBiome[r.biome[i]];
      row.tiles++;
      if (r.isLand[i]) { row.islandTiles++; if (!r.big[i]) row.small++; continue; }
      row.waterTiles++;
      if (!r.obj[i]) continue;
      for (k = 0; k < W; k++) {
        if (r.obj[i] & (1 << k)) {
          row.water[water[k].key]++;
          objLists[water[k].key].push({ x: i % w, y: Math.floor(i / w), i: i, biome: names[r.biome[i]] });
        }
      }
    }
    for (k = 0; k < r.anchors.length; k++) perBiome[r.biome[r.anchors[k]]].big++;
    for (k = 0; k < groups.length; k++) perBiome[groups[k].biomeIndex].groups++;
    for (b = 0; b < B; b++) { perBiome[b].islands = perBiome[b].small + perBiome[b].big; perBiome[b].share = perBiome[b].tiles / area; }

    var smallTiles = 0;
    for (i = 0; i < area; i++) if (r.landNoise[i] && !r.big[i]) smallTiles++;
    var bigTiles = 4 * r.anchors.length;
    var start = startTile(w, h);

    return {
      index: seeds.index, width: w, height: h, tileKm: 2.5, mode: S.waterMode, seeds: seeds,
      start: { x: start.x, y: start.y, clear: Math.max(0, Math.round(S.startClear)) },
      biomeNames: names,
      biomesPresent: perBiome.filter(function (p) { return p.tiles > 0; }).map(function (p) { return p.name; }),
      waterObjects: water.map(function (o) { return { key: o.key, name: o.name, on: o.on }; }),
      tiles: {
        land: r.isLand,        // 1 = island tile (small or big)
        landNoise: r.landNoise, // 1 = the islands noise alone made land here (before big islands)
        island: islandOf,      // id in `islands`, or -1
        bigIsland: bigOf,      // index in `bigIslands`, or -1
        biome: r.biome,        // index in `biomeNames` (island tiles carry their group's biome)
        group: r.groupOf,      // id in `groups`, or -1 for water
        water: r.obj           // bit k set = water object row k is on this tile
      },
      islands: islands,
      bigIslands: bigIslands,
      groups: groups,
      water: objLists,
      counts: {
        islandTiles: bigTiles + smallTiles, smallIslands: smallTiles, bigIslands: r.anchors.length,
        islands: smallTiles + r.anchors.length, groups: groups.length, waterTiles: area - bigTiles - smallTiles,
        bareWater: r.bare, objectTiles: area - bigTiles - smallTiles - r.bare, contested: r.contested,
        movedByGroups: r.moved,
        water: water.map(function (o, k3) {
          return { key: o.key, name: o.name, on: o.on, tiles: r.kept[k3], claims: r.claims[k3], lost: r.lost[k3] };
        }),
        biomes: perBiome
      },
      liveOctaves: r.live
    };
  }

  // =====================================================================
  // Statistics over many maps
  // =====================================================================

  /** A quantile by linear interpolation between the sorted values. */
  function quantile(sorted, q) {
    if (!sorted.length) return null;
    if (sorted.length === 1) return sorted[0];
    var at = q * (sorted.length - 1), lo = Math.floor(at), hi = Math.ceil(at);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (at - lo);
  }

  /** mean, P10, median, P90, min, max, and `none` = share of maps where the value is 0. */
  function spread(list) {
    var n = list.length, sum = 0, none = 0;
    for (var i = 0; i < n; i++) { sum += list[i]; if (!(list[i] > 0)) none++; }
    var sorted = list.slice().sort(function (a, b) { return a - b; });
    return { mean: n ? sum / n : 0, p10: quantile(sorted, 0.1), median: quantile(sorted, 0.5),
             p90: quantile(sorted, 0.9), min: n ? sorted[0] : 0, max: n ? sorted[n - 1] : 0, none: n ? none / n : 0 };
  }

  /**
   * The map numbers a run of `nMaps` uses: up to 256 maps spread evenly over the even
   * walk (indices 0, 256/n, 2*256/n ...); more than 256 maps are indices 0 .. n-1.
   */
  function statsIndices(nMaps) {
    var out = [];
    for (var r = 0; r < nMaps; r++) out.push(nMaps <= SEEDS_PER_LAYER ? Math.floor(r * SEEDS_PER_LAYER / nMaps) : r);
    return out;
  }

  /**
   * Averages and spreads over `nMaps` maps (1..4096; 1024 is a good default).
   * Pass { samples: true } as `options` to also get the per-map values.
   */
  function stats(nMaps, settings, options) {
    nMaps = Math.max(1, Math.round(Number(nMaps) || 1024));
    var S = resolveSettings(settings), names = biomeNames(S.biomes), B = names.length, W = S.water.length;
    var keys = S.water.map(function (o) { return o.key; });
    var idx = statsIndices(nMaps);
    var map = { islandTiles: [], islands: [], smallIslands: [], bigIslands: [], groups: [], waterTiles: [],
                bareWater: [], objectTiles: [], contested: [], movedByGroups: [], biomesPresent: [] };
    var per = names.map(function () {
      var o = { share: [], tiles: [], islands: [], small: [], big: [], groups: [], water: {} };
      keys.forEach(function (kk) { o.water[kk] = []; });
      return o;
    });
    var obj = keys.map(function () { return { tiles: [], lost: [], shareOfWater: [] }; });
    for (var r = 0; r < nMaps; r++) {
      var m = generate(idx[r], S), c = m.counts;
      map.islandTiles.push(c.islandTiles); map.islands.push(c.islands); map.smallIslands.push(c.smallIslands);
      map.bigIslands.push(c.bigIslands); map.groups.push(c.groups); map.waterTiles.push(c.waterTiles);
      map.bareWater.push(c.bareWater); map.objectTiles.push(c.objectTiles); map.contested.push(c.contested);
      map.movedByGroups.push(c.movedByGroups); map.biomesPresent.push(m.biomesPresent.length);
      for (var b = 0; b < B; b++) {
        var t = c.biomes[b], p = per[b];
        p.share.push(t.share); p.tiles.push(t.tiles); p.islands.push(t.islands); p.small.push(t.small);
        p.big.push(t.big); p.groups.push(t.groups);
        for (var k = 0; k < W; k++) p.water[keys[k]].push(t.water[keys[k]]);
      }
      for (k = 0; k < W; k++) {
        obj[k].tiles.push(c.water[k].tiles); obj[k].lost.push(c.water[k].lost);
        obj[k].shareOfWater.push(c.waterTiles ? c.water[k].tiles / c.waterTiles : 0);
      }
    }
    function spreadAll(o) {
      var out = {};
      for (var key in o) out[key] = Array.isArray(o[key]) ? spread(o[key]) : spreadAll(o[key]);
      return out;
    }
    var result = {
      maps: nMaps, indices: nMaps <= SEEDS_PER_LAYER ? 'even walk over 0..255' : '0..' + (nMaps - 1),
      width: S.width, height: S.height, mode: S.waterMode, subBiomes: S.subOn,
      map: spreadAll(map),
      biomes: names.map(function (name, b) {
        var s = spreadAll(per[b]);
        s.name = name;
        // Share of maps where the biome is missing: no tile at all / no island / no big island.
        s.missing = { tiles: s.tiles.none, islands: s.islands.none, bigIslands: s.big.none, water: {} };
        keys.forEach(function (kk) { s.missing.water[kk] = s.water[kk].none; });
        return s;
      }),
      water: S.water.map(function (o, k) {
        var s = spreadAll(obj[k]);
        s.key = o.key; s.name = o.name; s.on = o.on;
        return s;
      })
    };
    if (options && options.samples) result.samples = { indices: idx, map: map, biomes: per, water: obj };
    return result;
  }

  // =====================================================================
  // Small helpers for tools
  // =====================================================================

  function tileIndex(map, x, y) { return y * map.width + x; }
  function tileXY(map, i) { return { x: i % map.width, y: Math.floor(i / map.width) }; }

  /** Everything known about one tile, in plain words. */
  function tileInfo(map, x, y) {
    var i = tileIndex(map, x, y), T = map.tiles, objs = [];
    for (var k = 0; k < map.waterObjects.length; k++) if (T.water[i] & (1 << k)) objs.push(map.waterObjects[k].name);
    var dx = Math.abs(x - map.start.x), dy = Math.abs(y - map.start.y);
    return { x: x, y: y, i: i, biome: map.biomeNames[T.biome[i]], land: !!T.land[i],
             island: T.island[i], bigIsland: T.bigIsland[i], group: T.group[i], water: objs,
             start: dx === 0 && dy === 0, startArea: map.start.clear > 0 && Math.max(dx, dy) <= map.start.clear };
  }

  /** A JSON-friendly copy of a map: typed arrays become plain arrays. */
  function toJSON(map) {
    var out = {};
    for (var k in map) out[k] = map[k];
    out.tiles = {};
    for (var t in map.tiles) out.tiles[t] = Array.prototype.slice.call(map.tiles[t]);
    return out;
  }

  return {
    VERSION: '1.0.0',
    DEFAULTS: DEFAULTS,
    BIOMES: BIOMES,
    MODES: MODES,
    SEEDS_PER_LAYER: SEEDS_PER_LAYER,
    MAX_INDEX: MAX_INDEX,
    TILE_KM: 2.5,
    settings: resolveSettings,
    settingsFromJson: settingsFromJson,
    mapSeeds: mapSeeds,
    statsIndices: statsIndices,
    generate: generate,
    stats: stats,
    spread: spread,
    colour: colour,
    tileIndex: tileIndex,
    tileXY: tileXY,
    tileInfo: tileInfo,
    toJSON: toJSON,
    // The raw noise, for tools that want to draw a single layer.
    noise: { perlin: perlin, layer: noiseLayer, value: valueAt, rng: rng, layerSeed: layerSeed, intervalOf: intervalOf }
  };
});
