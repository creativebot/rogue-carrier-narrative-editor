# Data reference

Every file in `data/`, `icons/` and `worldgen/`, its fields and how the ids link.

## 1. Ids

Ids are stable across both grids. Match by `id`, never by name (names can change, for example Nano Parts became
Composite Panels with the same id). The team sheet uses the same ids for crafted items and buildings, but short ids
for raws: `res_04` there is `res_04_Iron` in the grids. Every grid item carries `teamId` (the team sheet id, or
`null` for the six items that exist only in the outdated v14.3 draft). Many team-sheet tables link by item **name**; turn names into
ids with `UE_ResourcesMerged.tsv`.

| prefix | what | example |
|---|---|---|
| `res_..` | raw resource (and waste); short form `res_NN` in the team sheet | `res_04_Iron` (grid) = `res_04` (team sheet) |
| `processing_`, `synthesis_`, `synthesized_`, `electronics_`, `machinery_`, `ammunition_`, `medres_`, `food_`, `questres_`, `unitres_`, `powercell_`, `extractor_`, `consumer_`, `scineceres_`, `serviceres_`, `cn_`, `craft_...` | crafted items (the prefix is historical, not a category: `electronics_01` is AI Core) | `questres_03` Comm-Link |
| `b_...` | building | `b_fleet_02` Hangar |
| `shipsystem_0N` | ship systems (Power Unit, Sensor System, Engine, Mass Driver, R&D Lab) | `shipsystem_01` Power Unit |

Mycelium has a generated id (`res_mugywkvu5c5`) because it was added in the designer's editor.

## 2. Crafting grids: `data/grid/`

| file | what |
|---|---|
| `grid_prototype.json` | the team prototype grid (in game): **the** crafting grid |
| `draft_v14_3_OUTDATED/grid_v14_3.json` | **OUTDATED DRAFT** v14.3: direction of change only, never a data source (README inside) |
| `items_prototype.csv` | one row per item |
| `recipes_prototype.csv` | one row per recipe option, for items AND building costs (`product_kind`) |
| `buildings_prototype.csv` | one row per building with the recipes it hosts |
| `draft_v14_3_OUTDATED/*.csv` | the same tables for the outdated draft |

Both JSON files share one schema (`schema: "starter-kit-grid/1"`). The draft adds a top-level `warning` field;
fields marked "draft only" below exist only there. The example item is from the draft because it shows every
field; do not read its values as game facts.

```jsonc
{
  "schema": "starter-kit-grid/1",
  "warning": "OUTDATED DRAFT ...", // draft only
  "name": "Grid v14.3 (OUTDATED DRAFT)",
  "status": "...",            // in game / outdated draft
  "notes": ["..."],           // how to read quantities and grades
  "tags": [                   // draft only: branch.*, function.*, rawfn.*
    { "id": "function.powercell", "name": "Power cell", "parent": "function", "description": "..." }
  ],
  "items": [{
    "id": "questres_03", "teamId": "questres_03", "name": "Comm-Link",
    "kind": "craft",           // raw | craft
    "tier": 3,                 // 0 raw ... 5 program
    "class": "consumable",     // raw | component | consumable | unit | program
    "consumable": "rechargeable", // food | medicine | ammo | power_cell | capsule | pulse | rechargeable | implant
    "rarity": "Common",        // raws only (Common, Uncommon, Rare, Exotic, Unique)
    "branch": "electronics",   // draft only: main branch
    "branches": ["electronics", "energy"], // draft only: every branch the item touches
    "functions": ["function.control"],     // draft only: jobs the item can do in a slot
    "startKit": true,          // draft only, on Tech Voxel
    "icon": { "key": "T_Comm_Link", "small": "icons/small/T_Comm_Link.png", "large": "icons/256/T_Comm_Link.png" },
    "recipe": [                // slots; fill each slot with ONE option
      { "job": "embedded-controller", "function": "function.control", "tier": 2,
        "options": [ { "id": "electronics_02", "name": "Microcontrollers", "qty": 1 },
                     { "id": "electronics_03", "name": "Sensors Array", "qty": 1 } ] }
    ],
    "madeIn": [ { "building": "b_production_t3_03", "name": "Smart Tools Plant", "grade": 3 },
                { "building": "b_production_t3_05", "name": "Consumer Goods Plant", "grade": 2 } ],
    "usedIn": [ { "id": "electronics_01", "name": "AI Core", "kind": "recipe", "slot": 1 },
                { "id": "b_service_06", "name": "Holodeck", "kind": "building cost", "slot": 3 } ]
  }],
  "buildings": [{
    "id": "b_fleet_02", "name": "Hangar", "tier": 0,
    "category": "Ship Systems", "type": "Neutral",
    "icon": null,              // 23 buildings have no icon yet
    "hosts": [ { "id": "unitres_01", "name": "Worker Drone", "grade": 3 } ],
    "buildCost": [ { "job": "building-structure", "function": "function.structure", "tier": 1, "use": "construction",
                    "options": [ { "id": "processing_01", "name": "Metal Constructions", "qty": 1 },
                                 { "id": "synthesis_06", "name": "Mycobrick", "qty": 1 } ] } ]
                  // use: construction | purpose (draft only)
  }]
}
```

Field notes:
- `qty`: the prototype has no amounts, so `qty` is always 1 there; in-game amounts are in the team sheet
  (`UE_ResourcesMerged`). In the draft, `qty` is a relative unit.
- `grade`: 3 = best recipe grade (high efficiency), 2 = mid (x1.4 inputs), 1 = low (x1.8). Prototype grades come
  from the team sheet (`UE_BuildingsFunctional`).
- `job`: a short label of what the slot does (draft only); `function`: the tag of that job (draft only).
- `tier` on a slot: the tier of its options (a number, or `[min, max]`).
- Items with no `madeIn` are raws. Items with no `usedIn` are end products (consumables, units, programs).

Buildings without an icon (both grids): Biowaste Dump, Manufactured Waste Dump, Hangar, Power Unit, Sensor
System, Engine, Mass Driver, R&D Lab, Geo Lab, Flamethrower, Health and Care Center, Social dome, Institute,
Power Bolt Emitter, the five race buildings, Alliance Center, Active defense system, Power Barrier, Sonic Pulse
System, Static Field.

## 3. Icons: `icons/`

| path | what |
|---|---|
| `icons/small/<key>.png` | 64 px items and resources, 96 px buildings (as used in the team's sheets) |
| `icons/256/<key>.png` | 256 px, resized from the 1024 px sources |
| `icons/index.json` | `[{ key, small, large, entities: [{ id, name, kind, grids }] }]` |

Item icons keep their art names (`T_Gold`); several names carry no hint of the item (`T_Ore_Tungsten` is
Silicon, `T_Refined_Etilen` is Chlorine), so always go through `index.json` or the item's `icon` field.
Building icons are named `<building id>__<Building Name>`. The Isotope Source icon (`custom_mulmkonuv8e`) exists
only at small size. The waste icons are included for Bio Waste and Manufacturing Waste, which are not in the grids.

## 4. Team sheet snapshot: `data/team_sheet/`

Selected tables of the team workbook *Economy v0.2* (2026-09-29), one TSV per sheet. `UE_*` tables are the ones
exported to Unreal, so they are the game's live settings. `data/team_sheet/INDEX.md` lists every file, its key
columns and how it links to the grids. `04_GAME_SYSTEMS.md` explains the systems they describe.

## 5. World generator: `worldgen/` and `data/world/`

| file | what |
|---|---|
| `worldgen/worldgen.js` | exact JS port of the map generator (node `require` or browser `<script>`) |
| `worldgen/cli.js` | `node worldgen/cli.js map <index>` / `stats <maps>` |
| `worldgen/preview.html` | open in a browser: draws any map by index |
| `worldgen/verify.js` | proves the port equals the team's model (needs the original model files; skips without them) |
| `data/world/worldgen_settings.json` | the current generator settings with descriptions |

`02_WORLD.md` explains the algorithm, the settings and the per-map statistics.
