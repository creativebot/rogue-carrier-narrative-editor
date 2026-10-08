# The game in one read

What the game is, how a run goes, and the facts every other document builds on.
Status labels used in this kit:

- **in game** — in the current game build or the team's sheet.
- **outdated draft** — grid v14.3, an old draft of the designer's rework; it does not match the game or the
  current design and only shows the general direction of change. Never a source of facts.
- **working assumption** — agreed for planning, still to confirm with the developers.

## 1. Genre and loop

- A roguelite production game, close to *Against the Storm*, but at sea.
- The player's base is a ship, the **Behemoth**. Buildings stand on its deck; the deck has a limited area in
  cells, and buildings can be demolished to free space. The crew (several species) lives and works on board.
- Each run starts on a new procedurally generated map of islands. The ship starts at the map centre.
  The game data calls a run a **variation**.
- The loop: sail, gather raw resources from objects in the sea, craft items in buildings, build more
  buildings, keep the crew fed and healthy, survive hazards, complete quests.
- **Run variety comes from four sources:** the generated world (biomes decide which raws are plentiful),
  hazard and obstacle configurations, the races met on quests, and the quests themselves.
  Quests and hazards shape what the player **needs**; biomes shape what is **available**.
- **Entropy** is a run-wide level from 0 to 10. Extraction, buildings, engine use and waste raise it; a higher
  level brings denser and stronger dangerous events (storms, hailstorms, fog, creature attacks, underwater
  volcanoes and others) and new sickness strains (`04_GAME_SYSTEMS.md`).
- **Buildings are unlocked during a run** through the R&D Lab, which offers buildings for research; research
  needs blueprints. Most buildings (52 of 75) are unlocked this way.

## 2. How a run is won

- A run is won with **experience (XP)**, called **Knowledge** in the game data. It comes from quests and
  events. Knowledge also unlocks meta progression between runs (the "Prism" features and run modifiers).
- **Programs** are a rare, powerful alternative route: one program gives a large share of the XP needed to win
  (the designer's range is 55-70% of a win; exact values are being tuned).
- Design intent: in most runs (about 70-80%) the player crafts nothing at tier 4 or above. Quests "buy" victory
  points with crafted items (for example "deliver 10 Comm-Links"; numbers are placeholders). Consumables and the
  fleet are helper tools and come early, because survival gets hard fast: a bonus that arrives when the run is
  already won or lost is worthless. Programs are a "final boss" for experienced players.

## 3. Programs (tier 5)

Four programs exist. Each is a large XP source.

| program | what it is | form |
|---|---|---|
| Positron Cell | "an endless fuel canister" | crafted item, made in the Advanced Technology Center |
| Satellite | — | crafted item, made in the Satellite Control Complex |
| Transhuman Form | — | crafted item, made in the Evolution Center |
| Antimatter Core Unit | a power plant for the ship and its buildings | a tier-5 **building**, not an item |

Each crafted program also needs its own tier-5 building, so a program is always building + craft.

## 4. The world (details: `02_WORLD.md`)

- The map is a grid of 100 x 100 tiles. A tile is 2.5 km square, so the map is 250 x 250 km. The map edge is a wall.
- The ship moves freely (not tile by tile). It starts in the middle of the centre tile; tiles within one tile of
  it are always empty, so the start is open water.
- Seven biomes: Polar, Rocky, Volcanic, Temperate, Tropical, Shallow, Desert. A biome covers water and land alike.
  A map does not hold every biome in equal measure: Temperate and Tropical dominate, Polar and Desert are small (under
  1% of the map each) and on about 1 map in 10 hold no island (numbers in `02_WORLD.md`). The team sheet also names an eighth biome, Deep Sea (open ocean
  without land); the map generator models the seven above.
- Objects in the sea: **islands** (one tile, or a big 2x2 island), **floating islands** (levitate; the ship sails
  under them), **seaweed** (floats; the ship sails over it, it is under the water and seen only close up) and
  **reefs** (passable, but damage the ship per distance sailed over them). Every object belongs to the biome of
  its tile and carries that biome's resources.
- Sight (working assumption used in planning): islands and floating islands are seen from about 8 tiles, reefs
  from about 6 tiles, seaweed only within about 1.5 tiles. The player plans with what they can see (about
  20-25 km).
- Gathering reach of the ship is 0.5 tile (1.25 km). A passage between obstacles needs a 500 m corridor.
- An island is gathered once; a pass that misses its far side can be finished later. A floating island does not
  come back.
- Costs of travel: food is spent per time, fuel per distance, repairs per damage (reefs, hazards).

## 5. Resources and crafting (details: `03_ECONOMY.md`)

- **Raw resources (tier 0)** come from the sea objects. Rarity classes: Common, Uncommon, Rare, Exotic, Unique.
  Where each raw spawns and in which biome is set by the team sheet (`04_GAME_SYSTEMS.md`, resource sources).
  Two facts that shape the world: the K-IV organics (Plankton, Algae, Krill, Aminoacids) come only from the sea
  (seaweed); Prebiotic Matter comes from land.
- **Crafted items, tiers 1-4.** Each recipe has 1-3 slots; each slot offers one or more alternative ingredients
  (options), and the player fills each slot with one of them. Higher tiers are built from lower ones.
- **Item classes:** components (ingredients), consumables (used up in play: food, medicine, ammunition, power
  cells, capsules, rechargeable devices, an implant), units (vehicles made in the Hangar) and programs.
- **Buildings host recipes.** A production building has up to 4 recipe lines. The same item can often be made in
  two buildings at different recipe grades (grade 3 is the best: fewest inputs, shortest time).
- **Buildings cost items to build**, in slots with options, like recipes.
- **Start resources.** A run starts with a kit of items (team sheet `UE_StartResources`: Metal Constructions,
  Thermoplastic, Basic Toolkits, Personal Defence Kits, extractors, Omni Fruit, Architectural Blueprints and 4 Tech
  Assembly Matrices). The Tech Assembly Matrix pays for the first energy buildings; the designer considers the
  start count undecided.
- **Direction of change (outdated draft v14.3, not in the game):** more alternatives per recipe slot and five
  resource branches (metal, electronics, chemistry, energy, organics), so that the biome mix of a map changes which
  crafting route is cheap. See `03_ECONOMY.md` section 7; do not treat any of its details as fact.
- **Waste:** buildings produce waste (Bio, Manufacturing, Toxic, Radioactive). It accumulates on deck, lowers the
  morale of crew nearby and raises entropy when dumped; some buildings process it.

## 6. Races

- Alien species are met through quests and can join the crew. Crew species in the team sheet: Human, Nasobi,
  Crabari, Knidaria, Aetherid, Mistralid, each with its own health, morale, food use and preferences.
- Five races have their own building: Nasobi, Aetherid, Crabari, Mistralid, Knidaria. Race buildings are not
  available in every run; they host bonus recipes only (race foods). A run must be fully playable without them.
- 18 race trade goods (3 each for Nasobi, Aetheridis, Crabri, Luminid, Auri, Knidaria) cannot be crafted, only
  bought ready-made. They are auxiliary; some appear as options in building costs. Quests also introduce the Auri.
- Traders of the races sell and buy items (profiles in the team sheet). Spellings vary in the data
  (Aetherid / Aetheridis, Crabari / Crabri); match by id.

## 7. Where the truth lives

| topic | source of truth | in this kit |
|---|---|---|
| game data in the engine (quests, events, buildings, resources, crew, traders, settings) | the team's workbook *Economy v0.2* (UE_* sheets are exported to Unreal) | `data/team_sheet/` snapshot, `04_GAME_SYSTEMS.md` |
| crafting grid in the build | the team's prototype grid | `data/grid/grid_prototype.json` |
| direction of change only (OUTDATED DRAFT, not a source of facts) | the designer's old draft grid v14.3 | `data/grid/draft_v14_3_OUTDATED/` |
| map generator | the developer's Unreal C++ (this kit has an exact JS port) | `worldgen/`, `02_WORLD.md` |

When the kit and the team's live sheets disagree, the live sheets win. The kit is a snapshot (2026-10-01).
