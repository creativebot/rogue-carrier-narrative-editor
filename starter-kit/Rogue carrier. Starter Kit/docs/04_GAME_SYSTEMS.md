# 04 · Game systems (from the team sheet)

This page says what the team's workbook `Economy v0.2.xlsx` (export of 2026-09-29) defines about the game.
Every file named here is in `data/team_sheet/`. `INDEX.md` there lists all files, their columns and how they link.

How to read it:
- Files named `UE_...` are exported to the Unreal project. They are the game's settings today.
- Other files are the team's design sheets. They can be ahead of the game, behind it, or unfinished.
- Many links between files use the item **name**, not the id. Turn names into ids with `UE_ResourcesMerged.tsv`.
- This page states what the tables say. Where a table is a placeholder or work in progress, it says so.
  It gives no balance opinions.

---

## 1. Quests

**Files:** `UE_QuestDescription.tsv` (all texts), `QuestStrings.tsv` (reward notes).

### How a quest is stored
A quest is a block of text rows. The first row carries the `QuestID`; the rows below belong to it until the next `QuestID`.
Each row is one stage or one choice:

| Field | Meaning |
|---|---|
| `RowID` | Running number, unique. |
| `QuestID` | Quest key, e.g. `BaseQuest_T_Bioharvest`. Only on the first row of the block. |
| `NameID` | The stage: `Intro`, `Quest Main`, `Choice A`..`Choice F`, `Choice X Result` (sometimes `Result 1` / `Result 2`), `Inaction`. Spelling varies by family (`_Choice_A`, `_ChoiseA_Result`). |
| `LongDescription` | The story text. |
| `ShortDescription` | Title on Intro rows, button label on Choice rows. |
| `ImagePath` | Quest picture (Unreal path) or `None`. |

What the table does **not** hold: costs, conditions, timers, links to the next quest, reward ids or amounts.
Those live in the game assets, not in the workbook. The only mechanics visible here are:
- **Reward notes** in `QuestStrings.tsv` for 34 choices. They are categories, not ids: Blueprints, Energy, Knowledge, Food, Crew (Human / Knidaria), Raw organic, Medicine, Metals common, Nonmetals common/uncommon, Building mats, Machinery, Extractors, Electronics.
- **Asks written into the choice text**, e.g. `PRODUCE: 2 FUEL CELLS`, `REQUIRED ENERGY: 300`, `Donate Iron`, `PROVIDE Microcontrollers`, `Provide MultiTool`.

### Families (89 quests, 721 rows)
| Family (QuestID prefix) | Quests | What they are |
|---|---|---|
| `BaseQuest_T_...` | 25 | Island encounters: Alien Crash Site, Anomaly, Bioharvest, Cave System, Fossil, Primordial Ruins, Supply Beacon, Zephyrus Lifepod, Zephyrus Wreckage, Crew Hiring, Deserted Outpost, Deserted Settlement, Distress Call. |
| `SurpriseQuest_...` | 5 | Short encounters with three choices (Bioharvest Ruin, Cave System Hive, Primordial Ruins Beacon, Zephyrus Lifepod, Zephyrus Wreck). |
| `SpeciesIntro_...` | 16 | First contact with a species. Nasobi has a full branching chain (11 quests); Nasobi, Aetherids, Crabari, Knidaria and Auri each have one `AIQ` intro. |
| `Nasobi_L2-...` | 7 | Nasobi critical chain (stage names start with `CriticalQuest_`). |
| `FateOfZephyrus_L1-...` + `FoZ_SE_L1_...` | 8 + 5 | "Fate of Zephyrus" critical chain and its side quests. |
| `DeckQuest_...` | 5 | Requests from R&D or the ship AI on deck: donate, produce or build something. |
| Generic events | 18 | `FlyingCubeGenericEvent` (2), `GiantGenericEvent` (1), `OnionGenericEvent` (1), `ZephyrusDebrisGenericEvent` (7), `Generic_T1_AlienResourceStash` (3), `Generic_T1_AlienReplicator` (4). |

Name patterns, as found (the sheet does not define them):
- `_T<n>_E<n>` in base quests, e.g. `Anomaly_T2_E5`, `DesertedOutpost_T4_E4`.
- `L<n>-V<n>-Q<n>-<stage><branch>` in critical chains, e.g. `Nasobi_L2-V1-Q1-2B`.

### Chains
The table has no "next quest" column. Chains show only through ids and titles:
- `SpeciesIntro_Nasobi_0A` → `1A`, `1B`, `1C` → `2A`..`2F` → `3A`. Titles repeat with a number: "Helping Hand" (1B) → "Helping Hand II" (2A, 2B) → "Helping Hand III" (3A); "A Pleasure doing Business" (1A) → "... II" (2C, 2D); "A Gift from the Heart" (1C) → "... II" (2E, 2F).
- `FateOfZephyrus_L1-V1-Q1-0A` → `1A`, `1B` → `2A`..`2D` → `3B`. Same shape for `Nasobi_L2-V1-Q1-...`.

### Examples (texts shortened)
| Quest | Choices → reward note |
|---|---|
| `BaseQuest_T_AlienCrashSite` "Impact Crater" | Analyze → Blueprints; Extract → Energy; Investigate → Knowledge |
| `BaseQuest_T_Bioharvest` "Unknown Bio Signatures" | Prepare → Food; Study → Knowledge; Observe → Blueprints; Contact → Crew (Knidaria); Collect → Raw organic; Process → Medicine |
| `BaseQuest_T_SupplyBeacon_T1_E0` "Supply Beacon" | Open → Food; Disable → Energy; Scan → Blueprints |
| `BaseQuest_T_ZephyrusLifepod` "Crashed Lifepod" | Open → Energy; Inspect → Food; Recover → Crew (Human); Salvage → Knowledge; Search → Machinery; Bury → Electronics |
| `DeckQuest_Resource_Request` | Choice text asks: produce 2 Fuel Cells / 2 Extractor Capsules / 5 Nutrient Paste. No reward note; the result texts speak of a new blueprint or prototype. |

### Items quests talk about
- Quest texts name these items (by name): Iron, Titanium, Gold, Eldritium, Prebiotic, Fuel Cell, Nutrient Paste, Chemical Fuel, Thermoplastic, Microcontrollers, Comm-Link, Cyberware, Portable Force Shield ("PFS"), Propulsion Kit, Basic Scanner, Sensors Array, Tricoder, Multi-Tool, Med Kit, Worker Drone, Recon Craft, and others. Some names in texts match no item exactly: "Extractor Capsules", "Nanostructured Sheets", "Metal Construction Material(s)", "Biomods", "BVR".
- `UE_ResourcesMerged.tsv` has 22 items of type **Quest Resource**: `questres_01` Modular Container, `questres_03` Comm-Link, `questres_05` Tricoder, `questitem_01` Nasobi Wares, and 18 species goods (3 each for Nasobi, Aetheridis, Crabri, Luminid, Auri, Knidaria; ids like `nasobires_01`). The species goods are also OR-options in some building costs (`UE_BuildingsRecipes.tsv`).

### Knowledge (XP)
- `UE_GlobalSettings`: `MaxKnowledgePerRun = 1000`.
- `Tips.tsv` tip 24 "Knowledge/Win Condition": the player collects Knowledge to finish a variation (a run) and to make progress in unlocking the Prism features. The tip shows on the first Knowledge from any event.
- Knowledge is what this kit elsewhere calls XP.
- `DimensionalVariables.tsv` prices run modifiers in Knowledge (1500-6500).

---

## 2. Reward presets

**Files:** `UE_ResourcePreset.tsv` (exported), `ResourceRewardPresets.tsv` (design copy), `UE_SubmarineRewardPool.tsv`.

A preset is a named, random bundle of resources. It is keyed by `PresetName` and lists entries.
In all 26 presets one entry is drawn (`EntryCountMin = EntryCountMax = 1`), duplicates are off, the empty weight is 0 and every entry weight is 1.
So each preset gives **one** of its entries, with an amount between `ResourceAmountMin` and `ResourceAmountMax` in steps of `ResourceAmountStep`.
(This reading comes from the column names; the drawing code is in the engine.)

| PresetName | Gives one of (amount range) |
|---|---|
| `Cons_Energy_T3_V2` | Bio Cell 1-2, Fuel Cell 1-2 |
| `Cons_Food_T1_V2` | Grain 40-60, Omni Fruit 40-60, Cultured Meat 40-60 |
| `Cons_Food_T3_V2` | Nutrient Paste 24-40, Energy Bar 20-40, Omni-Meal 12-24 |
| `Raw_Metals_Common_A_V2` | Titanium, Sodium, Lithium, Silicon, Aluminum: 70-140 |
| `Raw_Metals_Common_B_V2` | Iron, Tungsten, Nickel, Chromium, Copper: 70-140 |
| `Raw_Metals_Exotic_V2` | Gold 20-30 |
| `Elditrium` | Eldritium 10-20 |
| `Raw_Nonmetal_V2` | Chlorine, Phosphorus, Sulfur, Hydrocarbons, Carbon: 70-140 |
| `Raw_Organic_A_V2` | K-IV Algae, Prebiotic Matter, K-IV Aminoacids: 70-140 |
| `Raw_Organic_B_V2` | K-IV Plankton, K-IV Algae, K-IV Krill: 70-140 |
| `Prod_Extraction_T3_V2` | Basic Extractor 3-4, Underground Deposit Extractor 1-2 |
| `Special_Blueprints_V2` | Architectural Blueprint 3-4 |
| `Prod_Construction_T2A_V2` | Metal Constructions, Alloyed Metal, Conductive Materials: 20-30 |
| `Prod_Construction_T2B_V2` | Biopolymer, Thermoplastic, Mycobrick: 20-30 |
| `Prod_Production_T2A_V2` | Composite Enzymes, Biochem Compounds, Chemical Fuel: 20-30 |
| `Prod_Production_T2B_V2` | Nanomaterials, Basic Toolkit, Electronic Components: 20-30 |
| `Prod_Production_T3A_V2` | Microcontrollers, Basic Scanner, Sensors Array, Personal Defence Kit: 5-8 |
| `Prod_Production_T3B_V2` | Nano Parts, Battery Block, Modular Container, Propulsion Kit: 5-8 |
| `Prod_Medicine_T3_V2` | Med Gel 9-18, Stem Tissue 12-24, Med Kit 2-4 |
| `Prod_Ammo_T2` | Standard Ammunition Pack 8-16, Chemical Fuel 8-16 |
| `Prod_Ammo_T3T4` | Explosive Charges 4-12, Smart Ammunition Pack 1-3 |
| `T4_Items_V1` | Tech Voxel, Multi-Tool, Comm-Link, Tricoder: 3-5 |
| `T4_Items_V2` | Smart Ammunition Pack, Portable Force Shield, D.A.R.T.: 3-5 |
| `T5_Items_V1` | Cyberware 2-3, AI Core 2-3 |
| `T5_Items_V2` | Tech Assembly Matrix 1-2, Surveying Probe 1-2 |
| `T5_Energy_V1` | Fusion Cell 1 |

Facts to know:
- **No table in the workbook says which quest or event uses which preset.** That link is in the engine.
- Presets name items by **name**. "Nickel" (in `Raw_Metals_Common_B_V2`) matches no item in the workbook or the grids.
- The design copy has one more entry, Protein Mass in `Cons_Food_T1_V2`, without a RowID (not exported).
- The preset name `Elditrium` is spelled differently from the item `Eldritium`.
- The workbook's table of contents calls `UE_ResourcePreset` "presets for starting resources" and `ResourceRewardPresets` "presets for rewards from events". Both hold the same presets.

**Submarine dives** (`UE_SubmarineRewardPool.tsv`): 4 stages. Deeper stages have a lower chance to avoid damage (0.9, 0.65, 0.4, 0.15) and higher damage (5-30 up to 50-100).
Rewards are per crew member: T1 resources (5, 10, 15, 20; chance 1.0 down to 0.5), T2 resources (stages 3-4), a Blueprint (chance 0.1, stages 2-4), a Tier B artifact (chance 0.1, stage 4).

---

## 3. Events, hazards and weather

**Files:** `UE_GameEvents.tsv`, `UE_EntropyInfo.tsv`, `UE_Storm.tsv`, `UE_Hailstorm.tsv`, `UE_UnderwaterVolcano.tsv`, `UE_StormAccidents.tsv`, `DE_*.tsv`, `Weather.tsv`, `UE_WindSetup.tsv`, `UE_Creature_*.tsv`.

### The seven dangerous events (`UE_GameEvents.tsv`)
| Event | Max cycles | Base chance multiplier | Biomes |
|---|---|---|---|
| Storm | 10 | 1 | all 8 |
| Hailstorm | 5 | 0.2 | all 8 |
| Aggressive Creature Attack | 5 | 0 | Tropical, Rocky, Desert, Deep Sea, Temperate |
| Tsunami | 1 | 0 | Tropical, Volcanic, Temperate, Deep Sea, Desert, Rocky |
| Thick Fog | 5 | 0 | Tropical, Volcanic, Temperate, Shallow |
| EM Anomaly Zones | 5 | 0 | all 8 |
| Underwater Volcano | 1 | 0.1 | Tropical, Volcanic, Shallow, Rocky (biome multipliers 0.4, 0.6, 0.4, 0.4) |

`AllowedOverlapEvents` lists which events may overlap. A base chance of 0 means the event does not spawn by chance with these values.
Global settings: `EventCycleDuration = 4`, `AllowEventOverlapping = 1`, `EventsHaveSleepState = 0`.

### Entropy drives events (`UE_EntropyInfo.tsv`)
Entropy is a run-wide level from 0 to 10. It rises from extraction, buildings, engine use and waste (`Tips.tsv` tip 16; `ExtractionEntropyRate`, `DisposalEntropy` per item).
Per level the table sets event density (40-60 at level 1, 120-150 at level 10), the event **category** range (1 at level 1, 4-5 at levels 9-10) and creature spawn chance (10% at level 1, 95% at level 10).

### Category effects
- **Storm** (`UE_Storm`, `DE_Storms`): per category 1-5, chance to injure an unsheltered crew member 0.1-0.5, chance to kill 0.01-0.2, morale debuff 2-8 per hour, wave height 5-20, lightning. `UE_StormAccidents`: 5/10/15% chances of unit loss, unit damage, thunder strike, contamination break, cargo loss (categories 1-3).
- **Hailstorm** (`UE_Hailstorm`, `DE_Hailstorm`): density 1000-8000, ship damage 5, building damage 0.05-0.35 per hit (the sheet calls it percent), small crew kill/injure chances.
- **Underwater Volcano** (`UE_UnderwaterVolcano`, `DE_UnderwaterVolcano`): 20-60 volcanoes, ship damage 5-35, debris damage 30 to hull and 15% to buildings.
- **EM Anomaly** (`DE_EMAnomaly`, design only): ball lightning 4-20, damage 5-40, chance to shut down ship systems 10-50%.
- **Thick Fog** (`DE_Fog`, `DE_Fog_Units`, design only): chance of toxic cloud / acid rain 0.1-1.0; unit hazards (Ghost Ship, Contamination Break, Memetic Regression, Unit Damaged, Unit Lost) 2-10%. The team marks the unit table "needs review".

### Creatures (`UE_Creature_Configs`, `UE_Creature_SpawnParams`)
Two sea creatures: **Dreadlot** (health 800, damage 150, spawns 0-24 h) and **Aetherfin** (health 450, damage 0, spawns 6-18 h). Both spawn in all biomes and give 15 entropy on death.

### Weather
- `UE_WindSetup.tsv`: wind states Calm / Normal / Gale with transition chances (start: 0.3 / 0.5 / 0.2).
- `Weather.tsv` is a **prototype**: wind transitions per entropy stage, clouds (Fog, Clear, Scattered, Broken, Overcast), rain (none to heavy), sea state (Calm, Waves 1, Waves 2), and a sample 48-hour run.
- Global settings: `CalmWindStateModifier 0.3`, `NormalWindStateModifier 1`, `GaleWindStateModifier 1.5`, `StormWindStateModifier 1.5`, `UpdateWindStateTime 3`.

---

## 4. Biomes and world tiles

**Files:** `Biome_Types.tsv`, `World_Tiles.tsv`, `BiomSetup.tsv`.

The sheet names **8 biomes**: Tropical, Volcanic, Polar, Rocky, Desert, Deep Sea, Temperate, Shallow ("Deep Sea" = regions without land, only floating or sea objects).
`Biome_Types.tsv` says which may border which. Polar borders only Polar, Rocky and Deep Sea. Deep Sea borders Polar, Deep Sea and Temperate.
(The map generator in `docs/02_WORLD.md` has its own biome model; this section only reports the sheet.)

`World_Tiles.tsv` lists 37 live tile types (`Biome_01`..`Biome_37`) and 9 removed ones.
Sub types: Island 24, Sea 6, Buoyant 5, Hovering 2. Rarity: Common 9, Uncommon 9, Rare 14, Exotic 3, Unique 2.

| Id | Name | Sub type | Biomes | Rarity |
|---|---|---|---|---|
| Biome_01 | Multi-shelved island | Island | Desert | Common |
| Biome_02 | Swamp Island | Island | Temperate | Common |
| Biome_03 | Pointy rocks | Island | Rocky, Temperate | Exotic |
| Biome_04 | Plateaus | Island | Rocky, Temperate | Common |
| Biome_05 | Purple island | Island | Temperate, Shallow | Exotic |
| Biome_06 | Sandstone Rock Pillar | Island | Desert, Tropical | Rare |
| Biome_07 | Spire Islands | Island | Tropical, Desert | Rare |
| Biome_08 | Old volcano Island | Island | Rocky, Volcanic, Tropical | Common |
| Biome_09 | Desert islands | Island | Desert | Common |
| Biome_10 | Red Rocks Island | Island | Desert | Common |
| Biome_11 | Volcanic islands | Island | Volcanic, Rocky, Tropical | Uncommon |
| Biome_12 | Asteroidal island | Island | Rocky | Rare |
| Biome_13 | Reefs | Sea | Rocky, Shallow, Temperate, Volcanic | Rare |
| Biome_14 | Great depths | Sea | Deep Sea | Common |
| Biome_15 | Glaciers | Island | Polar | Uncommon |
| Biome_16 | Iceberg | Buoyant | Polar | Uncommon |
| Biome_17 | Icy Water | Sea | (none given) | Common |
| Biome_18 | Floating cubes | Hovering | all 8 | Rare |
| Biome_19 | Ocean Trenches | Sea | Deep Sea | Uncommon |
| Biome_20 | Half-drowned ship | Buoyant | Shallow | Rare |
| Biome_21 | Large-scale metal veins | Sea | Deep Sea | Uncommon |
| Biome_22 | Shipwreck | Sea | Deep Sea | Rare |
| Biome_23 | Rainforest islands | Island | Tropical, Shallow | Rare |
| Biome_24 | Estuary islands | Island | Shallow | Uncommon |
| Biome_25 | Atolls | Island | Tropical | Common |
| Biome_26 | Mangrove-style tree islands | Island | Tropical, Shallow | Rare |
| Biome_27 | Necroterra Island | Buoyant | Temperate, Shallow, Rocky | Uncommon |
| Biome_28 | Arborial Roots | Buoyant | Temperate, Rocky | Rare |
| Biome_29 | Mud volcanoes | Island | Volcanic | Rare |
| Biome_30 | Ragnam Island | Island | Temperate, Deep Sea, Rocky | Uncommon |
| Biome_31 | Supergravitational islands | Hovering | Temperate, Shallow, Deep Sea, Rocky | Rare |
| Biome_32 | Cavern Island | Island | Rocky | Unique |
| Biome_33 | Crystal island | Island | Polar, Rocky | Rare |
| Biome_34 | Buoyant city | Buoyant | Tropical, Desert, Temperate | Rare |
| Biome_35 | Single-ore island | Island | Volcanic, Polar | Uncommon |
| Biome_36 | Canyon island | Island | Desert | Unique |
| Biome_37 | Fjords | Island | Rocky | Exotic |

The `Description` and `Notes` columns hold story hooks, e.g. Floating cubes "a potential place for a quest", Ocean Trenches "knidaria habitat", Cavern Island "a little adventure inside the cave", Buoyant city "Event".
Removed tiles: High currents, Stormy waters, Windy planes, Hydrothermal Vents, Deep sea cave systems, "Whale Falls", Centers of gyres, Anemone fields, Sea river.
`BiomSetup.tsv` is an asset checklist: which Unreal map files exist for which tile; it also lists event maps (Wreckage 1-3, Ancient Rings, Motionless Giant 1-2) and the main goal tile (`Polar_1x1_1`).
`UE_Artifacts.tsv` names islands where artifacts are found; some names there ("Onion", "Statue", "Water Spikes") are not tile names in `World_Tiles.tsv`.

---

## 5. Resource sources (deposits)

**Files:** `UE_Deposits.tsv`, `DepositsResourceData.tsv`, `ResourceTables.tsv`, `WIP_Deposits_per_biome.tsv`.

- **21 raw resources spawn as deposits** (`UE_Deposits.tsv`): 9 metals, 4 nonmetals, Silicon, Eldritium, Hydrocarbons, Carbon, Prebiotic Matter and 4 K-IV organics. Each has a rarity and an amount range (e.g. Iron 120-160, Gold 40-60, Eldritium 25-40).
- **Rarity chance** of a deposit: Common 45, Uncommon 22, Rare 16, Exotic 12, Unique 5 (`DepositsResourceData.tsv`, same values as `ResourceRarityChance...` in `UE_GlobalSettings`).
- **Clusters** (`ClusterName`) are ore types that hold several elements, e.g. Polymetallic Sulfide Ore = Copper, Iron, Titanium, Sulfur. `DepositsResourceData.tsv` gives each cluster's biomes and a density per biome, for the surface and underground (header note "ResAmountMult x5").
- **Special sources:** K-IV Aminoacids, Plankton, Algae and Krill come from "Deep Sea Organic Source" (Deep Sea only). Prebiotic Matter comes from "Biomaterial Source". Eldritium comes from "EM Anomaly Source". Gold comes from "Gold Deposits" (Polar).
- **Per biome:** `ResourceTables.tsv` (team design table, not exported) gives each raw a weight per biome, surface and underground. `WIP_Deposits_per_biome.tsv` is **work in progress**: it covers 5 biomes and all 5 blocks are identical.
- Extractors: `Basic Extractor` (`extractor_01`) and `Underground Deposit Extractor` (`extractor_03`); `ExtractorBasicRadius 15000`, `ExtractorShallowDepth 20000` in global settings.

---

## 6. Items

**File:** `UE_ResourcesMerged.tsv` (102 items).
Tiers: T0 24, T1 26, T2 27, T3 14, T4 8, T5 3. Main types: Quest Resource 22, Food 11, Metal 9, Processed 6, Synthesized 6, Electronics 5, Organic 5, and smaller groups (Medicine, Energy, Fleet, Machinery, Ammunition, Waste, Blueprint, ...).
- **T5:** Satellite (`cn_43`, made in Satellite Control Complex), Transhuman Form (`serviceres_02`, Evolution Center), Positron Cell (`powercell_05`, Advanced Technology Center). The fourth program, the **Antimatter Core Unit**, is a T5 building (`b_energyprogram_t5_01`), not an item.
- **Food** (`UE_Food.tsv`): 11 foods with charges and health / morale / immunity buffs.
- **Usable items** (`UE_Consumables.tsv`): Tricoder, Comm-Link, Cyberware, Portable Force Shield, Modular Container, Med Gel, Med Kit, Stem Tissue, Personal Defence Kit, with charges and effects.
- Recipes: up to 3 ingredient slots; a slot like `Iron, Aluminum` means "Iron or Aluminum" (`Rules.tsv`). Only ingredients of the same or lower tier are used.

### Start resources (`UE_StartResources.tsv`)
| id | Item | Qty |
|---|---|---|
| processing_06 | Basic Toolkit | 5 |
| medres_04 | Personal Defence Kit | 5 |
| processing_01 | Metal Constructions | 15 |
| processing_03 | Thermoplastic | 15 |
| machinery_02 | Tech Assembly Matrix | 4 |
| extractor_01 | Basic Extractor | 10 |
| extractor_03 | Underground Deposit Extractor | 2 |
| res_30 | Omni Fruit | 160 |
| blueprint_02 | Architectural Blueprint | 6 |
| old_04 | HibernationCapsule | 10 |

`old_04` HibernationCapsule is not in the item list.

---

## 7. Buildings and services

**Files:** `UE_BuildingsFunctional.tsv`, `UE_BuildingsRecipes.tsv`, `UE_BuidingsCategories.tsv`, `Buildings_High_Level.tsv`, `Services.tsv`, `ServicesInBuildings.tsv`, `Synergy_Buffs_Debuffs.tsv`, `Waste_managment.tsv`.

- **75 buildings.** Categories: Ship Systems 6, Services 11, Workshop 11, Factory 10, Plant 10, Advanced Tech 8, Energy 8, Defense 9, Other 2. Tiers: T0 9, T1 18, T2 17, T3 20, T4 7, T5 4.
- 52 buildings are unlocked through the R&D lab (`UnlockableInRnD = 1`); the rest are available from the start or otherwise.
- Each production building lists the items it makes at high, mid and low efficiency. Low efficiency costs more input (`BuildingMidEfficiencyRecipeMultiplier 1.4`, `BuildingsLowEfficiencyRecipeMultiplier 1.8`).
- **Programs (T5):** Satellite Control Complex, Antimatter Core Unit, Advanced Technology Center, Evolution Center.
- **Species buildings (T3 Plant):** `b_locals_t3_01`..`05` = Nasobi, Aetherid, Crabari, Mistralid, Knidaria Building.
- **Construction costs** (`UE_BuildingsRecipes.tsv`) use item names, with OR-options; some options are species quest goods (Crabri Bioframe, Nasobi Metal Work, Aetheridis Wire Weaving, Auri Fiber Tissue).
- **Services** (`ServicesInBuildings.tsv`): medical (Unfreezing Crew, Regeneration, Treatment, Vaccination), social (Recreation, Teambuilding Event, E.T. Communications, Arrange a Meeting with Aliens), Technology Exchange, Technical Support, Add Specialization, recycling (Bio, Manufactured), Research. `Services.tsv` is marked "needs to be updated" by the team.
- **Status list** (`Buildings_High_Level.tsv`): implementation status per building "as of June 25" (e.g. Submarine Hangar, Weather Station, the Ritual Sites: not implemented).
- **Waste** (`Waste_managment.tsv`): Bio, Toxic, Manufacturing, Radioactive waste lower crew morale nearby (-8, -10, -6, -4) and add entropy when dumped. Its ids (`res_35..38`) do not match the item list.

---

## 8. Crew, species, health and buffs

**Files:** `UE_CrewStats.tsv`, `UE_CrewParameters.tsv`, `Crew_Parameters.tsv`, `UE_CrewEfficiency.tsv`, `Species_Bonuses.tsv`, `UE_Sickness.tsv`, `BuffsDebuffs.tsv`.

| Species (`UE_CrewStats`) | Max health | Base morale | Food use | Susceptibility | Trait bonus |
|---|---|---|---|---|---|
| Human | 100 | 50 | 1 | 5 | 0 |
| Nasobi | 80 | 60 | 1 | 7 | 10 |
| Crabari | 130 | 40 | 2 | 4 | 25 |
| Knidaria | 70 | 55 | 1 | 8 | 10 |
| Aetherids | 60 | 70 | 2 | 6 | 30 |
| Mistralids | 90 | 50 | 1 | 5 | 1 |

- `UE_CrewParameters.tsv` (HP, stamina, sleep hours, specialization chances) is marked **outdated** by the team. `Crew_Parameters.tsv` adds each species' food and consumer-product preferences.
- **Morale states** (`UE_CrewEfficiency`, global settings): Striking, Desperate (1-20), Unhappy (21-40), Neutral (41-60), Happy (61-80), Elated (81-100). Work efficiency by state in global settings: 25 / 50 / 75 / 100 / 100%. Health states: Feeble, Frail, Unwell, Healthy.
- **Species bonuses** (`Species_Bonuses.tsv`): which species suits which building category. The team marks it "old sheet, needs discussion"; it holds an old and a new version.
- **Sickness** (`UE_Sickness.tsv`): Respiratory Ecotvirus, Xenoenteritis, Keeling Cryptoencephalitis, each in strains A, B, C. Strains B and C appear from entropy 4 and 7. The Biomes and Treatment columns are empty placeholders.
- **Buffs and debuffs** (`BuffsDebuffs.tsv`): 48 named effects in groups Food, Morale, Immunity, HP, Production, Hull/building, Energy, Trade (e.g. "Angry {SpeciesName} traders": prices x3), Waste. Effects use "N hours"; the value and time columns are **empty** (placeholders).
- **Synergy** (`Synergy_Buffs_Debuffs.tsv`): which buildings boost or harm neighbours (e.g. food buildings linked by "Conveyor Belt").

---

## 9. Traders

**File:** `UE_TraderProfiles.tsv`. 5 profiles: `Nasobi_merchant` (6 items offered), `Nasobi_outpost` (4), `Aetherid_merchant` (6), `Aetherid_outpost` (4), `crabari_outpost` (4).
Each profile lists the same 80 items (by id) with amount range, chance, required game stage (1-4), "interesting in" / "not interesting in" flags and a fixed price.
**Only the two Nasobi profiles are filled in.** The Aetherid and Crabari profiles have prices only (placeholders).
`UE_TraderProfiles_v2` was dropped: its export is broken (`#REF!` ids, `#N/A` prices).
Global settings: trader fees (`TraderDefaultResourceFee 0.3`, interesting / not interesting 0.2), traveling trader spawn (3-5 tiles away, 1-5 game hours delay, available 2 game hours).
Artifacts can also be found at traders of a given species (`UE_Artifacts.tsv`, "Found on Traders").

---

## 10. Units and defence

- `UE_Units.tsv`: **Worker** (no crew), **Scout** (2-5 crew), **Cargo** (2-3 crew) with charge, health, transfer amount and time, storage, speed.
- `UE_Turrets.tsv`: Gatling Gun (`b_survival_02`) and Photon Gun (`b_survival_03`).
- Fleet items in the item list: Worker Drone (`unitres_01`), Recon Craft (`unitres_03`), Deep-Sea Trawler (`unitres_05`) and others.

---

## 11. R&D pool

`UE_RnDPoolPossibility.tsv`: the R&D lab offers buildings; the tier odds depend on the roll number.
Rolls 0-5: 100% tier 1. Rolls 6-11: 75 / 25. Rolls 12-16: 45 / 35 / 20. Rolls 17-20: 30 / 35 / 25 / 10. Roll 21+: 20 / 25 / 35 / 15 / 5.
Related global settings: `FreeRnDRerollAmount 3`, `BaseRnDRerollPrice 1`, `RnDLabResearchDuration 1`, `SecondTierBuildingsToUnlockNextTier 5`, `ThirdTierBuildingsToUnlockNextTier 4`. Research needs blueprints (`Tips.tsv` tip 20).

---

## 12. Artifacts

`UE_Artifacts.tsv`: 26 artifacts `art_01`..`art_26`, tiers S (3), A (12), B (9), two without tier.
Each has an effect (e.g. Art of Trade: trader items 50% cheaper; Stamets: crew can't get sick; Black Goo: +100% integrity), the building kinds it fits (Power unit, Engine, ..., Submarine), the islands where it is found and the species whose traders carry it. All are "Unlocked" at game start.

---

## 13. Run modifiers

- `DimensionalVariables.tsv`: 68 modifiers the player buys with Knowledge (1500-6500) before a run: start packs (fuel cells, extractors, food, exploration kit), crew changes (e.g. replace 10 crew with Nasobi), unlocked building sets, buffs. Code names like `DV_GiveFusionCell_x1`.
- `RevisedDimensionalConstants.tsv`: 40 run-level modifiers of the world and ship (starting entropy, day length, biome mix, island distance, wind, cluster density, trader count, entropy gain, quest entropy x1.5, R&D slots, hull damage, ...). Column `State` says which are "technically implemented". Code names like `DC_StartingEntropy_1`.

---

## 14. Notifications and tips

- `UE_Notifications.tsv`: 77 in-game notifications with text templates (`{0} has joined the crew.`) and categories (`Crew.*` 24, `Exploration.*` 17, `Production.*` 15, `Survival.*` 10, `Energy.*` 9, `GameEvent.*` 2).
- `Notifications.tsv` adds the trigger condition, timing (one-time / ongoing), click action and status. Status is mixed: 17 "implemented", 25 "need to be deleted", 13 "changed (needs to be implemented)", others.
- `Tips.tsv`: 24 tutorial tips with their triggers (camera, reefs, R&D reroll, capsules, power, entropy, active scan, blueprints, morale, food, knowledge).

---

## 15. Global settings

**File:** `UE_GlobalSettings.tsv` (304 name-value pairs). Settings that shape play:

| Setting | Value |
|---|---|
| `SecondsInGameHour` | 60 |
| `DayLenghtInGameHour` / `DawnTimeInGameHour` / `StartGameTimeInGameHour` | 15 / 6 / 10 |
| `GameSpeedLevel1..3` | 1, 2, 4 |
| `MinShipSpeed` / `MaxShipSpeed` | 1 / 10 (knots; `KnotToGameUnits 825`) |
| `EngineBaseEnergyUseRate` | 50 |
| Engine cell use rates | Bio 0.08, Fuel 0.08, Fission 0.01, Fusion 0.01, Positron 0.001 |
| Cell capacities | Bio 1200, Fuel 1600, Fission 3500, Fusion 4000, Positron 125000 |
| Building construction time T1..T5 | 0.25, 0.5, 1, 2, 4 |
| `MaxKnowledgePerRun` | 1000 |
| `RequiredMealsNumber` / `StarvingThreshold` | 3 / 25 |
| `CrewDayCycle...` | work 8 h, sleep 8 h, eat 1 h, idle 1-4 h, entertainment 1-4 h |
| `MaxSpecializationsForOneCrewMember` | 3 |
| `BuildingDemolitionResourceReturnRate` | 50 |
| `CrewStrikeChance` / `TimeToCheckCrewStriking` | 5 / 5 |

The rest, by group (look them up by name): waste rates and debuffs; resource rarity chances and discounts; morale states and modifiers (quarters, food, entertainment, storm, combat); health, stamina and rest thresholds; sickness and immunity (`BaseSicknessDuration`, `BaseContagiousness`, susceptibility levels); medical and other service slots, times and bonuses; connector bonuses; notification thresholds (ship tilt, health, energy); R&D pool and rerolls; extractor radius and duration; wind; battery; repair costs and damage states; traders and traveling traders; underwater volcano timing; dialog timing.

---

## 16. Placeholders and work in progress (as found)

- `WIP_Deposits_per_biome.tsv`: work in progress; 5 identical biome blocks.
- `UE_TraderProfiles.tsv`: Aetherid and Crabari profiles have prices only.
- `UE_Sickness.tsv`: Biomes and Treatment columns empty.
- `BuffsDebuffs.tsv`: value and time columns empty.
- `UE_CrewParameters.tsv`: marked outdated by the team. `Species_Bonuses.tsv`: old, under discussion. `Services.tsv`: needs update. `Weather.tsv`: prototype. `DE_Fog_Units.tsv`: needs review.
- `UE_Artifacts.tsv`: two artifacts (`art_08`, `art_26`) have no tier.
- Quests: no mechanics in the table (costs, conditions, reward ids, chain links are in the engine).
- Reward preset entry "Nickel" matches no item.
- `Waste_managment.tsv` ids `res_35..38` clash with the item list.
- `Buildings_High_Level.tsv`: statuses are "as of June 25".
