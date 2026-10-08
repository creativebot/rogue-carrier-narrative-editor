# 02 · The world: how a map is generated

This page explains the game's map generator for someone who has never seen it. The game is built in
Unreal Engine. The team keeps an exact model of the generator; `worldgen/worldgen.js` is that model as one
JavaScript file. Its noise is a line-by-line port of the developer's C++.

Everything here describes **what the generator does today**. It is not a design proposal.

Files:

| file | what it is |
|---|---|
| `worldgen/worldgen.js` | the generator: `generate`, `stats`, `mapSeeds`, `DEFAULTS` (node and browser) |
| `worldgen/cli.js` | command line: one map summary, or statistics over many maps |
| `worldgen/preview.html` | double-click to see any map in a browser |
| `worldgen/verify.js` | proves the file builds the same maps as the team's reference model |
| `data/world/worldgen_settings.json` | the current settings, each with its unit and meaning |

---

## 1. What a map is

- A map is a grid of **tiles**: **100 x 100**.
- One tile is a square of **2.5 km**. The whole map is 250 x 250 km.
- A tile is either **water** or **island** (land).
- Every tile belongs to exactly one **biome**. Biomes cover water and islands alike.
- Water tiles may hold **water objects**: reef, seaweed, floating island.
- Coordinates: `x` is the column (0..99, left to right), `y` is the row (0..99, top to bottom, as the
  preview draws it). In code a tile is often one number: `i = y * 100 + x`.
- **The start.** The ship starts in the middle of the centre tile, **(50, 50)**. Every tile within 1 tile of
  it (the 3x3 block from (49, 49) to (51, 51)) is **always empty**: no island, no big island, no water
  object. So the ship always starts on open water.

## 2. The noise

Every layer below uses the same Perlin noise loop, each with its own settings and its own seed:

```
for o = 0 .. Octaves-1:
    Sum += PerlinNoise2D( X * PatternScale * 2^o / NoiseScale + Seed,
                          Y * PatternScale * 2^o / NoiseScale + Seed ) / 2^o
Value = Sum * Multiplier + Offset
```

- `X`, `Y` are the tile's column and row.
- `Seed` is the layer's seed. The engine cuts it to int16 and adds it to **both** axes.
- Octave `o` has weight `1 / 2^o`: the first octave draws the big shapes, the later ones add finer detail.
- `PerlinNoise2D` is Unreal's `FMath::PerlinNoise2D`. Its value is about -1..1 and is exactly 0 on whole
  coordinates. So an octave whose step `PatternScale * 2^o / NoiseScale` is a whole number adds nothing.
  With the current settings every octave counts (islands 12 of 12, biomes 4 of 4, each water object 4 of 4).
- Only `PatternScale / NoiseScale` matters. A larger Noise Scale means larger shapes.
- **Threshold layers** (islands, water objects) compare `Value` with a threshold: above it = yes.

## 3. The layers, in order

### Layer 1 · Islands

- Noise: Pattern Scale 1, Noise Scale 1.4, 12 octaves, Offset 0, Multiplier 1.
- A tile whose value is above the **Perlin Modifier (0.5)** is land. The Perlin Modifier *is* the land
  threshold.
- **Each land tile is one small island.** Two touching land tiles are two islands (they form a group, layer 5).
- No land on the start area.

### Layer 2 · Biomes

- A second noise: Pattern Scale 0.5, Noise Scale 8, 4 octaves, Offset 0, Multiplier 1. Think of it as a
  heat map. Its large, smooth shapes are the biome areas.
- The value falls into one interval, and the interval names the biome:

| biome | interval of the biome noise |
|---|---|
| Polar | -1 to -0.7 |
| Rocky | -0.7 to -0.4 |
| Volcanic | -0.4 to -0.2 |
| Temperate | -0.2 to 0.1 |
| Tropical | 0.1 to 0.4 |
| Shallow | 0.4 to 0.7 |
| Desert | 0.7 to 1 |

- Min is inclusive, Max exclusive. A value below -1 counts as Polar, above 1 as Desert.
- The biome covers **water and islands alike**. Because the noise is smooth, a biome borders almost only
  its neighbours on the list (99.7% of border edges; the rest skip one narrow biome, mostly Volcanic).
  Polar never touches Desert.
- The middle values are the most common, so Temperate and Tropical are large and the two ends (Polar,
  Desert) are small.

### Layer 3 · Sub-biomes (off)

- Optional and **off** in the game. When on, an interval that names two or three biomes is split between
  them by a third noise (same settings as the biome noise by default), in equal bands of its range.
- The current table names one biome per interval, so this layer has no effect even if switched on.

### Layer 4 · Big islands

- Placed after the biome borders are known, **biome by biome**.
- Each biome gets `round(Big island % x the biome's small-island count)` big islands. Big island % = **15%**.
- A big island is a **2x2 stamp** (4 tiles). All four tiles lie in its own biome: a big island is never half
  one biome and half another.
- Stamps never overlap each other and never touch the start area. A stamp **may cover water or small
  islands**; a small island under a stamp becomes part of the big island.
- A big island counts as **one** island.
- If a biome has no room for a 2x2, it gets fewer big islands (or none).

### Layer 5 · Island groups

- Island tiles that share an **edge** (not just a corner) form one **group**. A single island alone is a
  group of one.
- A group lies in **one biome**: the biome that holds most of its tiles. A tie is settled at random, between
  the leaders only (4 + 4 + 2 tiles is a coin toss between the two 4s, never the 2).
- So an island tile's final biome can differ from the biome noise under it (about 24 island tiles per map
  change biome this way).
- **This rule is the team's working guess** (agreed 2026-09-18), to confirm with the developer.

### Layer 6 · Water objects

- Three objects, each with its **own noise and own seed**, 4 octaves each:

| object | Noise Scale | Pattern Scale | Octaves | Offset | Multiplier | Threshold |
|---|---|---|---|---|---|---|
| Reef | 1 | 1.1 | 4 | 0 | 1 | 0.3 |
| Seaweed | 1.1 | 1 | 4 | 0 | 1 | 0.2 |
| Floating island | 1 | 1.1 | 4 | 0 | 1 | 0.5 |

- An object **claims** a tile where its value is above its threshold.
- Objects go on **water tiles only**, never on islands, never on the start area.
- When several objects claim one tile, the **water mode** decides:
  - **competition** — what the game does **today**. The highest noise value takes the tile; the others
    lose it. One object per tile at most. (A tie goes to the earlier row: Reef, Seaweed, Floating island.)
  - **parallel** — the **planned** mechanic. Every claimant keeps the tile; one tile can hold all three.
- An object **belongs to the biome of its tile**: a reef on a Tropical tile is a tropical reef.
- In this model one claimed tile = one object of that kind on that tile.

## 4. Seeds and map variety

- In the game **every layer draws its own random seed**: islands, biomes, sub-biomes, reef, seaweed,
  floating island.
- Only the seed **modulo 256** changes the noise (the noise repeats every 256 units and the seed is a whole
  number). So each layer has **256 possible seeds**.
- The layers are independent, so the number of distinct worlds is **256 to the power of the layers**
  (256^5 with sub-biomes off), not 256.
- The game has no "map number". The kit gives each world a **map index** so tools can name and reproduce it:
  - `WorldGen.mapSeeds(index)` returns the seed of every layer for that index.
  - **Indices 0..255** walk every layer seed exactly once: layer L gets `(index * a_L + b_L) mod 256`, with a
    different odd `a_L` per layer (the islands take the index itself). So the first 256 indices show each
    island layout once, each biome layout once, and so on, each time paired differently.
  - **Indices 256..4095** draw every layer's seed at random from the index, the way the game's independent
    seeds would pair up.
  - The same index always gives the same map.
- You can also pass explicit seeds: `WorldGen.generate({ islands: 12, biomes: 200, water: [5, 6, 7] })`.
- Big-island positions and group tie-breaks use the model's own random numbers (seeded from the map). The
  rules and counts match the game; the exact spot a big island lands on may differ from the engine's.

## 5. Settings

Current values (also in `data/world/worldgen_settings.json`, and `WorldGen.DEFAULTS` in code).

| setting (code key) | value | meaning | raising it |
|---|---|---|---|
| Width, Height (`width`, `height`) | 100, 100 | map size in tiles | bigger map |
| Empty tiles around the start (`startClear`) | 1 | tiles within this distance of the centre tile stay empty (1 = 3x3) | larger empty area |
| Islands: Pattern Scale (`islandPattern`) | 1 | noise frequency | smaller, denser islands |
| Islands: Noise Scale (`islandNoise`) | 1.4 | size of island shapes | bigger, clumpier islands |
| Islands: Octaves (`islandOctaves`) | 12 | layers of detail | more ragged coasts, more specks |
| Islands: Offset (`islandOffset`) | 0 | added to the value | more land |
| Islands: Multiplier (`islandMultiplier`) | 1 | stretches the value | more extreme values (with threshold 0.5: more land) |
| Islands: Perlin Modifier (`islandThreshold`) | 0.5 | land threshold | fewer islands |
| Big island % (`bigPercent`) | 0.15 (15%) | big islands per biome, as a share of its small islands | more big islands |
| Biomes: Pattern Scale (`biomePattern`) | 0.5 | noise frequency | smaller biome areas |
| Biomes: Noise Scale (`biomeNoise`) | 8 | size of biome areas | wider biome areas |
| Biomes: Octaves (`biomeOctaves`) | 4 | layers of detail | more ragged borders |
| Biomes: Offset (`biomeOffset`) | 0 | added to the value | whole map shifts towards Desert |
| Biomes: Multiplier (`biomeMultiplier`) | 1 | stretches the value | more room for Polar and Desert |
| Use sub-biomes (`subOn`) | false | splits multi-biome intervals | — |
| Sub-biomes: Pattern, Noise, Octaves, Offset, Multiplier | 0.5, 8, 4, 0, 1 | the sub-biome noise | only used when on |
| Water objects mode (`waterMode`) | competition | competition (today) or parallel (planned) | — |
| Biome intervals (`biomes`) | see layer 2 | value range of each biome | a wider interval = a bigger biome |
| Water object rows (`water`) | see layer 6 | each object's noise | higher threshold = fewer tiles |

## 6. Measured statistics

Measured with `WorldGen.stats(1024)` on the current settings: map indices 0..1023 (the 256-map even walk
plus 768 random pairings), water mode **competition** unless stated. "P10..P90" means 8 maps in 10 fall in
that range. "None" is the share of maps where the count is 0. These are facts about the generator's output.

### Whole map

| per map | average | P10..P90 | min..max |
|---|---|---|---|
| Island tiles | 797.7 | 758..834 | 709..881 |
| Islands (a big island counts as one) | 568.9 | 540..594 | 505..629 |
| Small islands (1 tile) | 492.6 | 467..515 | 437..545 |
| Big islands (2x2) | 76.3 | 72..80 | 67..84 |
| Island groups | 489.6 | 466..512 | 444..540 |
| Water tiles | 9202.3 | 9166..9242 | 9119..9291 |
| Water tiles with an object | 3741.7 | 3692..3793 | 3431..3886 |
| Water tiles claimed by 2+ objects | 541.1 | 515..566 | 462..756 |
| Biomes on the map | 7 | 7..7 | 7..7 |

Islands cover about 8% of the map. Every one of the 1024 maps has all seven biomes on it.

### Biomes

| biome | share of map | islands | big islands | island groups | no island | no big island |
|---|---|---|---|---|---|---|
| Polar | 0.7% (0.2..1.2%) | 3.7 (0..8) | 0.5 (0..1) | 3.2 (0..7) | **11.8%** of maps | **58.4%** |
| Rocky | 8.4% (6.8..10.3%) | 47.8 (35..62) | 6.4 (5..8) | 41.3 (31..53) | 0% | 0% |
| Volcanic | 15.9% (14.2..17.5%) | 90.7 (75..106) | 12.2 (10..14) | 78.2 (65..91) | 0% | 0% |
| Temperate | 38.7% (35.8..41.4%) | 220.0 (195..244) | 29.6 (26..33) | 189.4 (169..210) | 0% | 0% |
| Tropical | 27.1% (24.9..29.4%) | 154.5 (134..176) | 20.7 (18..24) | 132.9 (116..150) | 0% | 0% |
| Shallow | 8.3% (6.7..10.2%) | 47.8 (35..62) | 6.4 (5..8) | 40.9 (30..52) | 0% | 0% |
| Desert | 0.8% (0.3..1.3%) | 4.4 (1..9) | 0.5 (0..1) | 3.8 (1..7) | **7.7%** of maps | **50.4%** |

Values are average (P10..P90).

What this means for content that depends on a biome:

- **Polar and Desert are small on every map.** Polar averages 67 tiles, Desert 77 (out of 10,000); about
  35% of maps have fewer than 50 Polar tiles, 28% fewer than 50 Desert tiles.
- They are **never missing as an area** in these 1024 maps (smallest: Polar 1 tile, Desert 13 tiles), but
  they are often **without islands**: no Polar island on 11.8% of maps, no Desert island on 7.7%.
  Both lack islands on the same map about 1% of the time.
- About **half the maps have no big island** in Polar (58%) or Desert (50%).
- The other five biomes always have islands and big islands.

### Water objects

Tiles per map, whole map:

| object | competition (today) | share of water | parallel (planned) |
|---|---|---|---|
| Reef | 1315.1 (1278..1351) | 14.3% | 1501.1 (1464..1535) |
| Seaweed | 1997.2 (1957..2037) | 21.7% | 2345.9 (2307..2388) |
| Floating island | 429.3 (408..455) | 4.7% | 458.0 (434..481) |

The water tiles holding at least one object are the same in both modes (3741.7); parallel only lets a
tile hold more than one.

By biome (competition), average (P10..P90), and the share of maps with none:

| biome | reef | seaweed | floating island |
|---|---|---|---|
| Polar | 8.9 (2..17), none 2.1% | 13.6 (4..24), none 1.5% | 2.9 (0..6), **none 14.5%** |
| Rocky | 111.3 (86..137) | 169.0 (133..207) | 36.1 (26..47) |
| Volcanic | 209.2 (181..236) | 316.8 (279..353) | 68.4 (56..81) |
| Temperate | 508.5 (463..555) | 773.4 (706..840) | 166.3 (147..187) |
| Tropical | 356.9 (321..393) | 542.2 (492..591) | 116.5 (101..134) |
| Shallow | 110.2 (85..136) | 167.0 (131..206) | 35.7 (25..47) |
| Desert | 10.2 (3..19), none 1.1% | 15.3 (5..27), none 0.1% | 3.4 (1..7), **none 9.3%** |

- **No floating island on 1 map in about 256 (competition only).** Reef and Floating island use the same
  scales. When both layers draw the same seed, their noise is identical; the reef has the lower threshold and
  the earlier row, so it takes every tile. In the 1024 maps this happened 7 times (0.7%); over 4096 indices,
  19 times (0.46%). Map index 44 is one. In parallel mode these maps keep their floating islands.

## 7. What the generator does not cover

- **Resources.** What a reef, seaweed patch, island or floating island yields is spawned by the game per
  resource source and biome. That is not part of the generator and not modelled here (see
  `docs/04_GAME_SYSTEMS.md` for resource sources).
- Anything placed on top of the map by the game: events, quests, traders, wrecks, the ship's route.
- The game's own random numbers for big-island spots and group ties (see section 4).

**Working guesses to confirm with the developer:**

1. The group rule (layer 5): majority biome, random tie among the leaders.
2. Water-object octaves = 4 each (the team's answer; the engine panel does not show it).
3. In competition, a tie in noise value goes to the earlier row (practically only matters when two
   objects with the same scales draw the same seed, as above).
4. How the big-island stamps pick their spots (random spot, 64 tries, then a random free spot in the biome).

Settled: each land tile is one small island; biomes cover water and land; big islands follow the per-biome
15% rule, wholly inside one biome, never overlapping; objects only on water; competition is today's mode,
parallel is planned; the start area is empty; sub-biomes are off.

## 8. Using the module

Node:

```js
const WorldGen = require('./worldgen/worldgen.js');

const map = WorldGen.generate(17);                  // map index 17, current settings
map.biomesPresent;                                  // ['Polar', 'Rocky', ...]
map.counts.biomes.find(b => b.name === 'Polar');    // { tiles, share, islands, small, big, groups, water: {...} }
map.islands.filter(i => i.biome === 'Desert');      // [{ id, type: 'small'|'big', x, y, tiles, biome, group }]
map.water.floating;                                 // [{ x, y, i, biome }] one per tile
map.groups[0];                                      // { id, biome, size, tiles, islands, box }
WorldGen.tileInfo(map, 12, 40);                     // everything about one tile
```

Browser (also works from `file://`):

```html
<script src="worldgen/worldgen.js"></script>
<script> const map = WorldGen.generate(17); </script>
```

Branching content by map:

```js
// A quest that needs a Polar island: fall back when this map has none.
function polarQuestVariant(index) {
  const map = WorldGen.generate(index);
  const polar = map.islands.filter(i => i.biome === 'Polar');
  if (!polar.length) return { variant: 'no-polar-island' };
  // Nearest one to the start, in km (straight line between tile centres).
  const km = i => Math.hypot(i.x - map.start.x, i.y - map.start.y) * WorldGen.TILE_KM;
  const target = polar.reduce((a, b) => (km(b) < km(a) ? b : a));
  return { variant: 'polar', island: target.id, at: [target.x, target.y], km: km(target) };
}
```

Other calls:

| call | returns |
|---|---|
| `WorldGen.mapSeeds(index)` | `{ index, base, islands, biomes, sub, water: [reef, seaweed, floating] }` |
| `WorldGen.generate(index or seeds, settings?)` | one map (below) |
| `WorldGen.stats(nMaps, settings?)` | average, p10, median, p90, min, max, none for every number; `biomes[b].missing` |
| `WorldGen.settings(partial)` | full settings with defaults filled in |
| `WorldGen.settingsFromJson(json)` | settings from `data/world/worldgen_settings.json` |
| `WorldGen.colour(biome, 'water' or 'island' or 'big')` | the preview's CSS colour |
| `WorldGen.toJSON(map)` | the map with plain arrays, ready for `JSON.stringify` |

Settings are partial: `WorldGen.generate(17, { waterMode: 'parallel' })` changes only the water mode.

The map object:

- `width`, `height`, `tileKm` (2.5), `mode`, `seeds`, `start: { x, y, clear }`
- `biomeNames` (index = biome id), `biomesPresent`, `waterObjects: [{ key, name, on }]`
- `tiles` — one entry per tile, `i = y * width + x`:
  - `land` 1 = island tile; `island` island id or -1; `bigIsland` big-island id or -1
  - `biome` biome id (island tiles carry their group's biome); `group` group id or -1
  - `water` bit mask: bit 0 reef, bit 1 seaweed, bit 2 floating island
  - `landNoise` 1 where the islands noise alone made land (before big islands)
- `islands` (ordered by top-left tile), `bigIslands`, `groups`, `water: { reef, seaweed, floating }`
- `counts`: whole-map numbers, `water` per object (tiles, claims, lost), `biomes` per biome

Command line:

```
node worldgen/cli.js map 17                      # summary of map 17
node worldgen/cli.js map 17 --out map17.json     # the whole map as JSON
node worldgen/cli.js stats 1024                  # the statistics above (about 15 s)
node worldgen/cli.js stats 256 --mode parallel
node worldgen/verify.js                          # equality with the reference model (needs its .gs files)
```

Speed: about 7 ms per map in node.
