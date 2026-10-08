# Team sheet: index

Source: the team's economy workbook `Economy v0.2.xlsx`, exported 2026-09-29 (cached cell values).
Its own `Version` sheet says "LastUpdated" = 2026-03-30 18:14 (Excel serial 46111.76).

Sheets named `UE_...` are the tables the team exports to the Unreal project. They are the game's actual settings.
The other sheets are design sheets of the team. Where a design sheet and a `UE_` sheet say the same thing, only one is kept (see "Dropped").

How the files were cleaned:
- UTF-8, tab-separated, one file per sheet. File name = sheet name, spaces to `_`, emoji removed.
- Empty trailing rows and columns removed. Cells trimmed.
- Excel error values (`#N/A`, `#REF!`, ...) replaced by an empty cell.
- Ids and names are kept exactly as in the workbook, typos included (`UE_BuidingsCategories`, `Waste_managment`, `Crabri ...`).
- Numbers are cached values, so many integers look like `1.0`.

## How the files link

- **Items** (raw resources and crafted items) have ids like `res_04` (raw), `processing_01`, `electronics_02`, `questres_03`, `unitres_01`, `food_01`, `medres_02`, `powercell_05`, `cn_43`. The master list is `UE_ResourcesMerged.tsv` (column `Resource ID`).
- **Most links between files use the item NAME, not the id.** Recipes (`Resources1..3`), reward presets (`ResourceName`), food, consumables, services and `ProducedIn` all use names. Use `UE_ResourcesMerged.tsv` (`Resource` column) to turn a name into an id. A recipe cell like `Iron, Aluminum` means "Iron OR Aluminum".
- **Buildings** have ids like `shipsystem_01`, `b_production_t2_03`, `b_fleet_02`. The master list is `UE_BuildingsFunctional.tsv` (first column, no header). `ProducedIn` in the item list uses building NAMES.
- **Quests** are keyed by `QuestID` (filled only on the first row of each quest; the rows below belong to it until the next `QuestID`).
- **Reward presets** are keyed by `PresetName` (filled only on the first row of each preset). No table in the workbook names a preset; the game assets that use them are not in the workbook.
- **Biomes** are referenced by name (Tropical, Volcanic, Polar, Rocky, Desert, Deep Sea, Temperate, Shallow).
- **Species**: Human, Nasobi, Crabari, Knidaria, Aetherids, Mistralids (plus Auri and Luminid in item and quest names).

## Files

### Quests and rewards
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_QuestDescription.tsv | 721 | All quest and event texts, one row per stage or choice. 89 quests. | `RowID`, `QuestID`, `NameID` (stage: Intro, Quest Main, Choice A..F, Choice X Result, Inaction), `LongDescription`, `ShortDescription` (title or button text), `ImagePath`. No mechanics (no costs, conditions or reward ids). |
| QuestStrings.tsv | 34 | Only what the design copy adds to the quest table: a coarse `Reward` note for 34 choices (e.g. "Blueprints", "Crew (Human)", "Metals, common"). The rest of the design copy is identical to UE_QuestDescription and was not repeated. | `RowId` joins to `RowID` in UE_QuestDescription. `QuestID_block` was filled down by the kit. |
| UE_ResourcePreset.tsv | 73 | Reward presets (random resource bundles), 26 presets. | `PresetName`, `EntryCountMin/Max` (how many entries are drawn), `bAllowDuplicated`, `EmptyGenerationWeight`, `EntryIndex`, `ResourceName` (item NAME), `ResourceAmountMin/Max/Step`, `EntryWeight`. |
| ResourceRewardPresets.tsv | 74 | Design copy of the same presets. Differs only by one extra entry (Protein Mass in `Cons_Food_T1_V2`, no RowID, so not exported) and two all-1 multiplier columns. Value-calculation columns were dropped. | Same as above. |
| UE_SubmarineRewardPool.tsv | 8 | Submarine dive: 4 stages, each with chance to avoid damage, damage range, and reward types per crew member (T1 resources, T2 resources, Blueprint, Tier B artifact). | Two header rows; read as a small grid. |

### Events, hazards, weather
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_GameEvents.tsv | 7 | The 7 dangerous events: Storm, Hailstorm, Aggressive Creature Attack, Tsunami, Thick Fog, EM Anomaly Zones, Underwater Volcano. | `MaxCycles`, `BaseChanceMultiplier`, `InherentBiomes`, `AllowedOverlapEvents`, `CenterRadius`, steps. |
| UE_EntropyInfo.tsv | 11 | Per entropy level 0..10: event density, event category range, creature spawn chance. | `EntropyLevel`. |
| UE_Storm.tsv, UE_Hailstorm.tsv, UE_UnderwaterVolcano.tsv | 5 each | Exported hazard values per event category 1..5 (crew injury/death chance, damage, morale debuff). | `Category`. |
| UE_StormAccidents.tsv | 3 | Storm accident chances (unit loss, unit damage, thunder strike, contamination break, cargo loss) for categories 1..3. | |
| DE_Storms, DE_Hailstorm, DE_UnderwaterVolcano, DE_EMAnomaly, DE_Fog, DE_Fog_Units (.tsv) | 6-16 | Design-side parameter grids per category 1..5. EM Anomaly and Fog have no UE_ counterpart here. | Row = parameter, columns = category 1..5. |
| Weather.tsv | 36 | Prototype weather model: wind transition matrices, clouds/rain/sea by wind, a sample 48 h run, an event overlap matrix. Marked "prototype" by the team. | Several small blocks on one sheet. |
| UE_WindSetup.tsv | 4 | Wind state transition probabilities (Calm, Normal, Gale). | |

### World, biomes, resource sources
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| Biome_Types.tsv | 34 | Which biomes may border which (+/-), biome descriptions, island/object types per biome with rarity. | Biome names. |
| World_Tiles.tsv | 46 | Island and sea tile types (`Biome_01`..`Biome_37`, plus 9 rows marked `removed`): sub type, biomes, rarity, quantity, size, deposit kinds, description, notes. | First column = tile id. |
| BiomSetup.tsv | 71 | Asset checklist: Unreal map files per tile and the biome tile names they serve (e.g. `Desert_1x1_1`). No header row. Event tiles (wreckage, giants, rings) and the main goal tile are listed. | |
| UE_Deposits.tsv | 21 | The 21 raw resources that spawn as deposits: rarity, amount min/max, which deposit clusters contain them. | `id` = item id (`res_..`), `ClusterName`. |
| DepositsResourceData.tsv | 26 | Rarity spawn chances; deposit clusters (ore types) with their elements, biomes, and cluster density per biome, surface and underground. | Cluster names match `ClusterName` in UE_Deposits. "Resources in cluster" holds odd values (46057), probably a date-formatted cell. |
| ResourceTables.tsv | 16 | Team design table: per raw resource, a weight per biome, surface and underground. Check columns removed. Not exported. | `Resource ID`. |
| WIP_Deposits_per_biome.tsv | 90 | WORK IN PROGRESS. Deposit amounts and chances per biome, surface and underground. Covers 5 biomes (Tropical, Volcanic, Polar, Rocky, Desert) and the 5 blocks are identical. | `Resource ID`. |

### Items
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_ResourcesMerged.tsv | 102 | Master item list: raws (tier 0), crafted items (tiers 1-5), food, medicine, energy cells, fleet units, quest resources, waste, blueprint. With recipe and producing buildings. | `Resource ID`, `Resource` (name), `Rarity`, `Tier`, `Type`, `Resources1..3` + `Amount1..3` (ingredient names, `,` = OR), `Result Amount`, `ProducedIn` (building names), `DisposalEntropy`. |
| UE_Food.tsv | 11 | Food: charges and health/morale/immunity buff. | `FoodName` = item name. |
| UE_Consumables.tsv | 9 | Usable items (Tricoder, Comm-Link, Cyberware, Portable Force Shield, ...): charges and effects. | `Consumable Name` = item name. |
| UE_StartResources.tsv | 10 | What the ship starts a run with. | `id`, `Resource`, `Quantity`. |

### Buildings and services
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_BuildingsFunctional.tsv | 75 | Master building list: category, tier, R&D unlock flag, crew, storage, productivity, recipes made at high/mid/low efficiency, services, energy use, waste, tags. | First column = building id. `ProducesHighEfficiency` etc. hold item names. |
| UE_BuildingsRecipes.tsv | 75 | Construction cost of each building (up to 3 ingredient slots). | `ID` = building id; `Resources1..3` = item names (`,` = OR). |
| UE_BuidingsCategories.tsv | 9 | Building categories with UI colour. | `Name` matches `Category` in UE_BuildingsFunctional. |
| Buildings_High_Level.tsv | 97 | Team list of all buildings by tier with implementation status "as of June 25" (Implemented / not implemented / in progress). Many category cells were broken lookups (now empty). | Building names, not ids. |
| Services.tsv | 50 | Service functions and descriptions. The team marks it "needs to be updated". | `Function`. |
| ServicesInBuildings.tsv | 9 | Which service building offers which services and which items they use. | `Building id`, item names. |
| Synergy_Buffs_Debuffs.tsv | 83 | Per building: which buildings it boosts (synergy) or harms (debuff), effect name, area. | `ID` = building id; affected buildings as id lists. |
| Waste_managment.tsv | 21 | Waste types, their morale debuff, recycling output, entropy per dumped unit, accumulation variables. | Uses ids `res_35..res_38` that do NOT match UE_ResourcesMerged (there, `res_34` = Bio Waste, `res_36` = Manufacturing Waste, `res_38` = Prebiotic Matter). |
| UE_SolarEnergySetup.tsv, UE_EnergyAccumulatorSetup.tsv | 2 each | Solar day curve and accumulator capacity/rates. | `BuildingID` (`b_energy_07/11`, `b_energy_08/12`). |

### Crew, species, health
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_CrewStats.tsv | 6 | Current species stats: efficiency, health, morale, food use, susceptibility, trait bonus. | `SpeciesName`. |
| UE_CrewParameters.tsv | 6 | Older species setup (the team marks it "outdated"): HP, stamina, sleep, specialization chances. | `SpeciesName`. |
| Crew_Parameters.tsv | 6 | Design copy of UE_CrewParameters plus each species' food and consumer product preferences. | `Species name`. |
| UE_CrewEfficiency.tsv | 11 | Efficiency bonus by morale and health state. | `CrewState`. |
| Species_Bonuses.tsv | 24 | Which species is good at which building category. Two tables: an old one and a "New category" one. The team marks it "old, needs discussion". | |
| UE_Sickness.tsv | 9 | 3 diseases x 3 strains: contagiousness, severity, duration, spawn weight by entropy. | Biomes and treatment columns are empty placeholders. |
| BuffsDebuffs.tsv | 48 | Catalogue of status effects (food, morale, immunity, HP, production, energy, trade, waste). Effects only; value and time columns are empty. | `Name`. |

### Trade, units, combat, creatures
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_TraderProfiles.tsv | 400 | 5 trader profiles x 80 items: stock amounts, chance, game stage, interest flags, fixed price. Only the two Nasobi profiles are filled in; the Aetherid and Crabari profiles have prices only. | `Trader ID` (first row of each block), `Resource ID` = item id. |
| UE_Units.tsv | 3 | Fleet units: Worker, Scout, Cargo (charge, health, crew, transfer, storage, speed). | `Type`. |
| UE_Turrets.tsv | 2 | Turret settings for `b_survival_02` (Gatling Gun) and `b_survival_03` (Photon Gun). | Building id. |
| UE_Creature_Configs.tsv, UE_Creature_SpawnParams.tsv | 2 each | Two sea creatures (Dreadlot, Aetherfin): combat stats, aggression, spawn biomes and hours. | `ID`, name. |

### Progression, run setup, UI
| File | Rows | What it is | Key columns / links |
|---|---|---|---|
| UE_GlobalSettings.tsv | 304 | All global game constants (time, speeds, morale, food, waste, R&D, traders, events, ...). | `Name`, `Value`. |
| UE_RnDPoolPossibility.tsv | 5 | R&D lab: chance of each building tier by roll number. | `RollFrom`, `RollTo`. |
| UE_Artifacts.tsv | 27 | 26 artifacts (`art_01`..`art_26`): effect, power, tier S/A/B, which building kinds they fit, where they are found (islands, traders). Two header rows. | `ID`. |
| DimensionalVariables.tsv | 68 | Run modifiers the player can buy with Knowledge (start resources, crew, unlocked buildings, buffs) with price. Miro link column removed. | `Text` holds the code name (e.g. `DV_GiveFusionCell_x1`). |
| RevisedDimensionalConstants.tsv | 40 | Run-level world/ship modifiers (starting entropy, day length, biome mix, wind, entropy gain, ...) with implementation state. Miro link column removed. | Code names like `DC_StartingEntropy_1`. |
| Rules.tsv | 29 | The team's core rules for recipes (1-3 ingredients, OR-alternatives, tier rule, one product line per product) and the list of resource tags. | |
| UE_Notifications.tsv | 77 | In-game notification texts and categories. | `Category` (e.g. `Crew.OneCrew.Joined`). |
| Notifications.tsv | 77 | Design copy with the trigger condition, timing, click action and status. QA columns removed. | `Category` joins to UE_Notifications. |
| Tips.tsv | 24 | Tutorial tips: text and trigger. | `id`. |

## Dropped sheets

| Sheet | Why |
|---|---|
| 42 | Main balancing sheet: calculations. |
| PricesCalculation | Price estimate calculations. |
| KnowledgeEntropyBalance | Balance estimate of knowledge and entropy per run (design numbers, not settings). |
| StorageCalculations | Storage slot calculations. |
| DangerousEventsCalculation | Event spawn calculations; the result is in UE_EntropyInfo and UE_GameEvents. |
| Game_Balance_Regular_Checklist | Team playtest checklist (opinions per build). |
| Combined Data | Helper dump of resource lists and usage counts. |
| Ship_Speeds | Energy-per-speed and collision estimates; the team marks it "not sure if up to date". Min/max speed is in UE_GlobalSettings. |
| Meshes | Art pipeline list. |
| NAVIGATION | Table of contents of the workbook. |
| Version | Only a date and an editor; the date is quoted at the top of this file. |
| Resources, Manufactured, Consumables | Source sheets of UE_ResourcesMerged: same 102 rows, same values. Their extra columns are helper look-ups ("Used in ...", "Recipe check"). |
| Buildings functional | Identical to UE_BuildingsFunctional (cell by cell). |
| Buildings Recipe | Identical to UE_BuildingsRecipes. |
| Deposits | Identical to UE_Deposits. |
| DangerousEvents | Same as UE_GameEvents; it only adds the note "specific behavior" for the movement of Creature Attack, Tsunami and Underwater Volcano. |
| UE_TraderProfiles_v2 | Broken in the export: `Resource ID` is `#REF!` or empty and every price is `#N/A`. The team calls it "alternative trader profiles". UE_TraderProfiles is complete, so it is the one kept. |

## Cross-check with the two crafting grids

Grids: `data/grid/grid_prototype.json` (team prototype, 80 items, 75 buildings; the game) and `data/grid/draft_v14_3_OUTDATED/grid_v14_3.json` (OUTDATED DRAFT v14.3, 86 items, 75 buildings; direction of change only). Every grid item carries `teamId`, the id used here.
Grid raw ids carry a name suffix (`res_04_Iron`); they were matched to the team id by the `res_NN` part.

**Buildings:** the same 75 building ids and names in the team sheet and in both grids.

**Team item ids absent from both grids (23):**
- Waste: `res_34` Bio Waste, `res_36` Manufacturing Waste.
- `blueprint_02` Architectural Blueprint (in start resources and in a reward preset).
- `old_04` HibernationCapsule (only in UE_StartResources; not in UE_ResourcesMerged either).
- Species quest resources (type "Quest Resource"): `questitem_01` Nasobi Wares; `nasobires_01` Nasobi Metal Work, `nasobires_02` Nasobi Combustibles, `nasobires_03` Nasobi Marine Armament; `aetheridisres_01` Aetheridis Wire Weaving, `aetheridisres_02` Aetheridis Electromagnetic Matrix, `aetheridisres_03` Aetheridis Tech Parts; `crabarires_01` Crabri Bioframe, `crabarires_02` Crabri Organic Membrane, `crabarires_03` Crabri Scrap Metal; `luminidres_01` Luminid Chip, `luminidres_02` Luminid Personal Energy Barrier, `luminidres_03` Luminid Micro Implant; `aurires_01` Auri Biosubstrate, `aurires_02` Auri Ambrosia, `aurires_03` Auri Fiber Tissue; `knidariares_01` Knidaria Sensorics Fiber, `knidariares_02` Knidaria Healing Slime, `knidariares_03` Knidaria Symbiont.
  Several of these appear as OR-alternatives in building construction costs (UE_BuildingsRecipes), e.g. Crabri Bioframe, Nasobi Metal Work, Aetheridis Wire Weaving, Auri Fiber Tissue.

**Grid item ids absent from the team sheet:**
- Prototype: none.
- Outdated draft v14.3 (not in the game): `res_mugywkvu5c5` Mycelium (T0), `craft_electrolyte_salts` Electrolyte Salts (T1), `craft_electrocyte_pack` Electrocyte Pack (T2), `craft_servo_drive` Servo Drive (T2), `craft_neural_mesh` Neural Mesh (T3), `craft_isotope_source` Isotope Source (T4).

**Same id, different name:** `processing_05` is "Nano Parts" in the team sheet and "Composite Panels" in the outdated v14.3 draft.

**Names that do not resolve to any id:** "Nickel" in reward preset `Raw_Metals_Common_B_V2` (no Nickel item exists in UE_ResourcesMerged or in either grid).
