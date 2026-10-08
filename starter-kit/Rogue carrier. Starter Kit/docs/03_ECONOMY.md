# Economy: resources, crafting, buildings

How items, recipes and buildings fit together, as they are **in the game today**. Read `01_GAME.md` first.

> **Source for this page: the team prototype grid (`data/grid/grid_prototype.json`) and the team sheet.**
> The kit also holds an old draft rework, grid v14.3. **It is an OUTDATED DRAFT that does not match the current
> state of the game or of the design.** It may be read only to see the general direction of change (section 7).
> Never use it as a source of items, recipes, buildings, tiers or numbers.

Full list of every item with its recipe, where it is made and where it is used: `docs/catalog/CATALOG_prototype.md`.
Data: `data/grid/` (schema in `05_DATA.md`).

## 1. The grid and the team sheet

| | |
|---|---|
| grid file | `data/grid/grid_prototype.json` (+ `items_prototype.csv`, `recipes_prototype.csv`, `buildings_prototype.csv`) |
| status | **in game**: the crafting grid of the current build (team exports, 2026-09-23) |
| items | 80: 21 raws, 59 crafted |
| buildings | 75, of which 41 host recipes |
| quantities | not in the grid; in the team sheet (`UE_ResourcesMerged.tsv`: `Amount1..3` per slot at the best grade, `Result Amount`) |
| grades | `madeIn.grade` taken from the team sheet (`UE_BuildingsFunctional.tsv`) |

The team sheet (2026-09-29) is a little newer than the grid: some of its recipes also accept race goods as options
(for example Comm-Link accepts a Luminid Chip). When the two differ, the team sheet wins.

Ids: crafted items and buildings have the same id in the grid and in the team sheet. Raws carry a name suffix in the
grid (`res_04_Iron`) and a short id in the team sheet (`res_04`); every grid item has `teamId` for the join.

## 2. Raw resources (tier 0)

21 raws. Rarity: Common, Uncommon, Rare, Exotic, Unique.

| raw | grid id | team id | rarity |
|---|---|---|---|
| Iron | `res_04_Iron` | `res_04` | Common |
| Aluminum | `res_07_Alum` | `res_07` | Common |
| Titanium | `res_08_Titan` | `res_08` | Uncommon |
| Tungsten | `res_10_Tung` | `res_10` | Uncommon |
| Chromium | `res_06_Chrom` | `res_06` | Uncommon |
| Copper | `res_03_Copper` | `res_03` | Uncommon |
| Silicon | `res_17_Silicon` | `res_17` | Common |
| Carbon | `res_28_Carbon` | `res_28` | Common |
| Gold | `res_01_Gold` | `res_01` | Exotic |
| Sulfur | `res_14_Sulfur` | `res_14` | Common |
| Chlorine | `res_12_Chlor` | `res_12` | Common |
| Phosphorus | `res_13_Phosph` | `res_13` | Common |
| Hydrocarbons | `res_27_HydroCarb` | `res_27` | Common |
| Sodium | `res_15_Sodium` | `res_15` | Common |
| Lithium | `res_16_Lithium` | `res_16` | Rare |
| Eldritium | `res_19_Eldrit` | `res_19` | Unique |
| Prebiotic Matter | `res_38_Prebiotic` | `res_38` | Common |
| K-IV Plankton | `res_24_k_Plankton` | `res_24` | Common |
| K-IV Algae | `res_31_k_Algae` | `res_31` | Common |
| K-IV Krill | `res_39_k_Krill` | `res_39` | Common |
| K-IV Aminoacids | `res_40_k_AminoAc` | `res_40` | Uncommon |

Facts about sources:
- K-IV organics come only from the sea (seaweed). Prebiotic Matter comes from land.
- Eldritium is unique and special; it has uses outside crafting.
- Where every raw spawns (island surface, underground deposits, floating islands, seaweed) and in which biome is
  defined in the team sheet; see `04_GAME_SYSTEMS.md` (resource sources) and `data/team_sheet/`.
- Waste (Bio, Manufacturing, Toxic, Radioactive) is a resource kind too, produced by buildings; it is not in the
  crafting grid.

## 3. Crafted items

Tiers: T1-T4 crafted, T5 programs. A higher tier is made from lower tiers.
Counts: T1 17, T2 21, T3 12, T4 6, T5 3 (+ the Antimatter Core Unit, a tier-5 building).

**Classes** (field `class` and `consumable` in the data):

| class | meaning | items |
|---|---|---|
| component | used only as an ingredient or building material | Alloyed Metal, Basic Toolkit, Biochem Compounds, Biopolymer, Chemical Fuel, Composite Enzymes, Conductive Materials, Electronic Components, Metal Constructions, Mycobrick, Nanomaterials, Thermoplastic (T1); Microcontrollers, Nano Parts, Propulsion Kit, Sensors Array (T2); Multi-Tool, Tech Voxel (T3); AI Core, Tech Assembly Matrix (T4) |
| consumable: food | eaten by the crew | Cultured Meat, Grain, Omni Fruit, Protein Mass (T1); Algae Preserves, Energy Bar, Fruit Paste, Krill Paste, Krill Preserves, Nutrient Paste (T2); Omni-Meal (T3) |
| consumable: medicine | crew health | Med Gel, Stem Tissue (T2); Med Kit (T3) |
| consumable: ammo | ammunition | Standard Ammunition Pack (T1); Explosive Charges (T2); Smart Ammunition Pack (T3) |
| consumable: power cell | portable power | Battery Block, Bio Cell, Fuel Cell (T2); Fusion Cell (T4) |
| consumable: capsule | launched capsules | Basic Extractor (T2); D.A.R.T., Underground Deposit Extractor (T3); Surveying Probe (T4) |
| consumable: pulse | one-shot scan | Basic Scanner (T2) |
| consumable: rechargeable | reusable devices | Modular Container, Personal Defence Kit (T2); Comm-Link, Portable Force Shield, Tricoder (T3) |
| consumable: implant | crew implant | Cyberware (T4) |
| unit | vehicles, built in the Hangar; never an ingredient | Worker Drone (T2); Deep-Sea Trawler, Freighter (T3); Recon Craft (T4) |
| program | tier-5 win items | Positron Cell, Satellite, Transhuman Form |

Some consumables are also ingredients (for example Battery Block, Comm-Link). Fixed fiction to respect: a food
stays food; D.A.R.T. scouts information (it does not gather resources); the Deep-Sea Trawler is a bigger and more
valuable craft than the Recon Craft. Race foods (Algae Preserves, Krill Preserves, Krill Paste, Fruit Paste) are
made only in race buildings. Usable items and foods have charges and effects in the team sheet (`UE_Consumables`,
`UE_Food`).

Programs in the game build:

| program | recipe (one option per slot) | made in |
|---|---|---|
| Positron Cell | Fusion Cell + Tech Assembly Matrix | Advanced Technology Center |
| Satellite | Tricoder + Tech Voxel + AI Core | Satellite Control Complex |
| Transhuman Form | Cyberware + AI Core | Evolution Center |
| Antimatter Core Unit (building) | build cost: (Metal Constructions \| Mycobrick) + Portable Force Shield + Tech Assembly Matrix | — |

## 4. Recipes

- A recipe is a list of up to 3 **slots**. The player fills **each** slot with **one** of its **options**.
  Example: Comm-Link = (Microcontrollers) + (Battery Block | Basic Scanner). In the team sheet a slot reads
  "Battery Block, Basic Scanner", meaning one or the other.
- Ingredients are of the same tier or lower.
- **Recipe grades.** One item can be made in several buildings at different grades (the game data calls them high,
  mid and low efficiency). Grade 3 is the best: fewest inputs, shortest craft time. Lower grades use the same
  ingredients in larger amounts (game settings: x1.4 for grade 2, x1.8 for grade 1) and take longer.
  Example: Comm-Link is made in the Smart Tools Plant (grade 3), the Consumer Goods Plant (grade 2) and the
  Knidaria Building (grade 1).

## 5. Buildings

75 buildings. 41 of them are **production buildings**: they host recipes (up to 4 lines each).

| category | count | production (hosts recipes) |
|---|---|---|
| Workshop | 11 | all 11, T1: Tools, Electronics, Repairs, Processing, Synthesis, Compounds, Chemistry, Bioengineering workshops, Farm, Plantation, Universum |
| Factory | 10 | all 10, T2 |
| Plant | 10 | all 10, T3: five plants and the five race buildings |
| Advanced Tech | 8 | 7: Hi-Tech, Experimental Materials, Robotics and Advanced Wares facilities (T4); the three T5 program buildings. Artifacts Lab hosts none |
| Services | 11 | 2: Bioconversion Lab, Geo Lab (T1); the rest are quarters, medical, social, institute, holodeck, alliance center |
| Ship Systems | 6 | 1: Hangar (all units); also Power Unit, Sensor System, Engine, Mass Driver, R&D Lab |
| Energy | 8 | 0: generators, accumulators, turbines, reactors, the Antimatter Core Unit |
| Defense | 9 | 0: guns, emitters, barriers |
| Other | 2 | 0: Biowaste Dump, Manufactured Waste Dump |

- **Build costs** are slots with options, like recipes (`buildCost` in the data; `UE_BuildingsRecipes` in the team
  sheet, where some options are race goods).
- **Race buildings** (Nasobi, Aetherid, Crabari, Mistralid, Knidaria) are not available in every run and host only
  bonus recipes. The **Bioconversion Lab** is likewise auxiliary.
- **Start resources** include 4 Tech Assembly Matrices (team sheet `UE_StartResources`); the Matrix appears in the
  build costs of the energy buildings (Generator, Solar Panels, Cyclone Energy Turbine, Solar Reactor, Fusion Core
  Unit, Antimatter Core Unit) and in the Positron Cell. The designer considers the start count undecided.
- Building attributes used by the game (description, energy use, personnel, size in cells, storage, services, waste,
  R&D unlock, construction time) are in the team sheet (`UE_BuildingsFunctional` and related files).
- 23 buildings have no icon yet (listed in `05_DATA.md`).

## 6. Reading the economy for content

Useful entry points for narrative or quest work (all from the prototype grid and the team sheet):
- Items a quest can ask for: any crafted item, most naturally consumables and components of T1-T3 (most runs do
  not reach T4).
- An item's ingredients and the buildings it needs: `recipe` and `madeIn` of that item.
- What an item is good for: `usedIn` (recipes and building costs).
- Biome-dependent content: which raws a biome is rich in (team sheet, `04_GAME_SYSTEMS.md`), then which items use
  those raws (`usedIn` of the raw).

## 7. OUTDATED DRAFT: grid v14.3 (direction of change only)

> **Grid v14.3 is a rough draft of the game designer's rework (2026-10-01) and is already out of date. It does NOT
> match the current state of the game or of the design.** Read it only to see the general direction in which the
> economy is changing. Do not take items, recipes, buildings, tiers, quantities or start items from it, and do not
> build tools or content on it. Files: `data/grid/draft_v14_3_OUTDATED/` (with its own README) and
> `docs/catalog/CATALOG_v14_3_DRAFT_OUTDATED.md`.

The general direction the draft shows (not decisions):
- **More real choices in recipes:** almost every slot offers 2-3 alternatives (the game build has single-option
  slots in 41 of 59 crafted items).
- **Five resource branches** (metal, electronics, chemistry, energy, organics) as a reading layer: slots offer
  options from different branches, so the biome mix of a map changes which crafting route is cheap. The biome mix
  changes **how** the player builds; quests and hazards change **what** they need.
- **Slot functions as tags:** options in one slot do the same job by different means.
- **Some new items and tier moves**, a start item other than the Tech Assembly Matrix for the first buildings, and
  every crafted item made in two buildings at different grades.

The draft's items without a team id (`teamId: null`) do not exist in the game.
