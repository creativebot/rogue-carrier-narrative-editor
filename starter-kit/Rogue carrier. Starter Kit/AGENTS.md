# Game context kit — instructions for AI agents

This folder is the shared context of our game: what the game is, how its world is generated, how its economy
works, the current data and the icons. It is a snapshot taken on **2026-10-01**. Load it before you build any
tool or content for the game (narrative, quests, rewards, UI, analytics).

> **WARNING: grid v14.3 is an OUTDATED DRAFT.** It is a rough draft of the designer's rework of the crafting grid
> and no longer matches the game or the current design. Read it only to see the general direction in which the
> economy is changing. Never take items, recipes, buildings, tiers or numbers from it. The economy of the game is
> the team prototype grid (`data/grid/grid_prototype.json`) plus the team sheet (`data/team_sheet/`).

## Read in this order

1. `docs/01_GAME.md` — the game, a run, how it is won, the world in short, races. (10 min)
2. `docs/03_ECONOMY.md` — resources, tiers, item classes, recipes, grades, buildings (the game build; the
   outdated v14.3 draft only in its last section).
3. `docs/02_WORLD.md` — the map generator: layers, settings, statistics, how to generate a map by index.
4. `docs/04_GAME_SYSTEMS.md` — quests, rewards, events, biomes, resource sources, crew, traders, settings
   (from the team sheet).
5. `docs/05_DATA.md` — every data file, its schema and how the ids link.
6. `docs/GLOSSARY.md` — terms.

Look up details in `docs/catalog/` (every item: recipe, made in, used in) and in `data/`.

## Folder map

```
AGENTS.md            this file (CLAUDE.md points here)
README.md            for people: what the kit is and how to hand it to an agent
docs/                explanations (start here)
  catalog/           item and building catalogs: CATALOG_prototype.md (the game) and
                     CATALOG_v14_3_DRAFT_OUTDATED.md (outdated draft, direction only)
data/
  grid/              the crafting grid of the game (prototype): JSON + CSV
    draft_v14_3_OUTDATED/  OUTDATED DRAFT grid v14.3: direction of change only, never a data source
  world/             current map generator settings
  team_sheet/        snapshot of the team workbook's game tables (TSV) + INDEX.md
worldgen/            exact JS port of the map generator, CLI, browser preview, verifier
icons/               item and building icons (small and 256 px) + index.json
```

## Rules for working with this kit

- **Ids are the keys.** Link items, buildings, quests and rewards by `id`, not by name.
- **Use the prototype grid for the economy.** `data/grid/grid_prototype.json` (with the team sheet) is what the
  game has. `data/grid/draft_v14_3_OUTDATED/grid_v14_3.json` is an **outdated draft**: it does not match the game
  or the current design. Read it only to understand the general direction of change; never build on it, never
  quote it as fact, and label anything taken from it "outdated draft v14.3, direction only". Keep tools
  schema-driven (both files share one schema), so a future official grid can replace the prototype.
- **The live sources win.** The team workbook (*Economy v0.2*, its `UE_*` tables go to Unreal) and the engine
  are the truth; this kit is a copy. If something looks outdated, say so and ask; do not "fix" the data silently.
- **Do not invent game facts.** If the kit does not say it, it is unknown: mark it as an assumption and ask the
  team. Several values in the team sheet are placeholders or work in progress; `04_GAME_SYSTEMS.md` flags the ones
  we know.
- **Balance is out of scope of this kit.** The kit holds what the game has, not why the numbers are what they
  are. Do not derive prices, item values or "best routes" from it and present them as the design. Questions about
  balance go to the game designer.
- **Map content is reproducible.** A world is identified by its map index (or its per-layer seeds); the same
  index always gives the same map in `worldgen/worldgen.js`. Use that when content must branch by world variant.
- **Language.** Game data, UI text, tags and file notes are in English. Explanations for the team may be in
  Ukrainian if asked. Write plainly, in short sentences.

## Facts to keep in mind

1. Roguelite production game at sea, close to *Against the Storm*; the base is a ship.
2. A run is won with XP (called Knowledge in the data) from quests and events; a program is a rare, big XP source
   (55-70% of a win). The ship is the Behemoth; a run is a "variation".
3. Most runs never craft tier 4+; quests ask for crafted items (mostly T1-T3) and pay XP.
4. Tiers: T0 raws (21), T1-T4 crafted, T5 programs (Positron Cell, Satellite, Transhuman Form, and the Antimatter
   Core Unit, which is a building).
5. A recipe has up to 3 slots; a slot may offer alternatives; the player fills each slot with one option.
6. Buildings host recipes (up to 4 lines); the same item is often made in two buildings at different grades.
7. The map: 100 x 100 tiles of 2.5 km, seven biomes, islands, floating islands, seaweed, reefs; start at the
   centre, always on open water.
8. Biomes decide which raws are plentiful; K-IV organics come only from seaweed, Prebiotic Matter from land.
9. Polar and Desert are small (under 1% of a map each) and hold no island on about 1 map in 10; content tied to
   them must handle "not on this map".
10. Alien species join the crew and trade; five have race buildings (Nasobi, Aetherid, Crabari, Mistralid,
    Knidaria), which are not in every run.
11. Entropy (0-10) rises with extraction, buildings, engine and waste and drives dangerous events.
12. Raw ids differ: `res_04_Iron` in the grids, `res_04` in the team sheet; use the `teamId` field to join.
13. The team's quest table (89 quests) holds texts and choices only. Costs, conditions, reward ids and quest
    chains live in the engine; reward presets exist, but nothing in the data says which quest uses which.
14. Grid v14.3 is an OUTDATED DRAFT (direction of change only). The economy of the game is the prototype grid
    plus the team sheet.

## Typical tasks and where to start

| task | start with |
|---|---|
| list what a quest can ask for or give | `data/grid/items_prototype.csv` (class, tier), `docs/04_GAME_SYSTEMS.md` (quests, reward presets) |
| show an item with its icon | item `icon.small` / `icon.large`, or `icons/index.json` |
| what does item X need / unlock | `recipe`, `madeIn`, `usedIn` in `grid_prototype.json`, or `docs/catalog/CATALOG_prototype.md` |
| where is the economy heading | `docs/03_ECONOMY.md` section 7 (outdated draft v14.3, direction only) |
| branch a story by world variant | `worldgen.generate(index)` gives biomes, islands, groups, water objects per map |
| how likely is a biome on a map | `docs/02_WORLD.md` statistics, or `worldgen.stats(n)` |
| what exists in the engine today (events, crew, traders, settings) | `data/team_sheet/INDEX.md` |
