# Grid v14.3 — OUTDATED DRAFT — catalog

> **OUTDATED DRAFT. Grid v14.3 is a rough draft of the game designer's rework of the crafting grid (2026-10-01) and is already out of date: it does NOT match the current state of the game or of the design. Use it only to see the general direction in which the game economy is changing. Never use it as a source of items, recipes, buildings, tiers or numbers: for those use the team prototype grid (data/grid/grid_prototype.json) and the team sheet.**

Outdated draft, direction of change only. Not in the game build and no longer the current design.

- qty = relative units of that option in the slot (1 when not stated). In-game amounts are set per recipe grade in the team sheet.
- madeIn.grade: 3 = best recipe grade (fewest inputs, shortest time). Lower grades use the same ingredients in larger amounts (x1.4 for grade 2 and x1.8 for grade 1, game settings BuildingMidEfficiencyRecipeMultiplier / BuildingsLowEfficiencyRecipeMultiplier) and take longer.
- A recipe slot is filled by ONE of its options. A building cost slot likewise.
- startKit: the first buildings (Generator, Solar Panels, T1 workshops) are built with Tech Voxel from the start kit; the count is not decided.

Generated from `data/grid/draft_v14_3_OUTDATED/grid_v14_3.json`. One recipe slot = pick one option (`A | B`). `xN` = relative quantity.

## Items by tier

### Tier 0 (raw resources)

**Gold** `res_01_Gold` — raw, Exotic, branch electronics
- Used in recipes: Conductive Materials, Electronic Components
- Used to build: Expedition Research Factory

**Copper** `res_03_Copper` — raw, Uncommon, branch electronics
- Used in recipes: Alloyed Metal, Chemical Fuel, Conductive Materials, Electronic Components
- Used to build: Solar Panels, Flamethrower, Component Factory

**Iron** `res_04_Iron` — raw, Common, branch metal
- Used in recipes: Metal Constructions, Chemical Fuel, Basic Toolkit, Standard Ammunition Pack, Fuel Cell
- Used to build: General quarters, Resource Allocation Center, Tools Workshop, Electronics Workshop, Repairs Workshop, Synthesis Workshop, Chemistry Workshop, Bioengineering Workshop, Plantation, Gatling Gun, Crabari Building

**Chromium** `res_06_Chrom` — raw, Uncommon, branch metal
- Used in recipes: Alloyed Metal, Metal Constructions, Basic Toolkit, Fuel Cell, Propulsion Kit
- Used to build: Gatling Gun, Flamethrower, Pyrogenics Factory

**Aluminum** `res_07_Alum` — raw, Common, branch metal
- Used in recipes: Alloyed Metal, Metal Constructions, Explosive Charges, Sensors Array
- Used to build: General quarters, Resource Allocation Center, Electronics Workshop, Repairs Workshop, Synthesis Workshop, Compounds Workshop, Farm, Gatling Gun, Flamethrower, Container Factory, Component Factory

**Titanium** `res_08_Titan` — raw, Uncommon, branch metal
- Used in recipes: Alloyed Metal, Basic Toolkit, Propulsion Kit, Personal Defence Kit, Sensors Array
- Used to build: Tools Workshop, Repairs Workshop, Processing Workshop, Chemistry Workshop, Plantation, Universum, Flamethrower, Crabari Building

**Tungsten** `res_10_Tung` — raw, Uncommon, branch metal
- Used in recipes: Alloyed Metal, Metal Constructions, Basic Toolkit, Standard Ammunition Pack, Propulsion Kit, Personal Defence Kit
- Used to build: Geo Lab, Gatling Gun, Flamethrower, Pyrogenics Factory

**Chlorine** `res_12_Chlor` — raw, Common, branch chemistry
- Used in recipes: Thermoplastic, Biochem Compounds, Conductive Materials, Explosive Charges, Microcontrollers
- Used to build: Gatling Gun, Container Factory, Medical Goods Factory

**Phosphorus** `res_13_Phosph` — raw, Common, branch chemistry
- Used in recipes: Thermoplastic, Biochem Compounds, Nanomaterials, Explosive Charges, Microcontrollers, D.A.R.T.
- Used to build: Electronics Workshop, Processing Workshop, Compounds Workshop, Plantation, Universum

**Sulfur** `res_14_Sulfur` — raw, Common, branch chemistry
- Used in recipes: Biochem Compounds, Standard Ammunition Pack, Explosive Charges, D.A.R.T.
- Used to build: General quarters, Synthesis Workshop, Chemistry Workshop, Bioengineering Workshop, Farm

**Sodium** `res_15_Sodium` — raw, Common, branch energy
- Used in recipes: Biochem Compounds, Chemical Fuel, Explosive Charges, Basic Scanner, Electrolyte Salts
- Used to build: Small Energy Accumulator, Energy Accumulator, Synthesis Workshop, Energy Research Factory, Medical Goods Factory, Aetherid Building

**Lithium** `res_16_Lithium` — raw, Rare, branch energy
- Used in recipes: Nanomaterials, Basic Scanner, Fusion Cell, Electrolyte Salts
- Used to build: Small Energy Accumulator, Energy Accumulator, Energy Research Factory, Aetherid Building

**Silicon** `res_17_Silicon` — raw, Common, branch electronics
- Used in recipes: Thermoplastic, Conductive Materials, Electronic Components, Electrolyte Salts
- Used to build: General quarters, Solar Panels, Electronics Workshop, Repairs Workshop, Processing Workshop, Compounds Workshop, Flamethrower, Expedition Research Factory

**Eldritium** `res_19_Eldrit` — raw, Unique, branch energy
- Used in recipes: Positron Cell
- Used to build: Power Barrier

**Hydrocarbons** `res_27_HydroCarb` — raw, Common, branch energy
- Used in recipes: Thermoplastic, Chemical Fuel, Nanomaterials, Freighter, Fusion Cell, Electrolyte Salts
- Used to build: Tools Workshop, Chemistry Workshop, Bioengineering Workshop, Plantation, Universum, Gatling Gun

**Carbon** `res_28_Carbon` — raw, Common, branch electronics
- Used in recipes: Conductive Materials, Electronic Components, Nanomaterials, Standard Ammunition Pack
- Used to build: Solar Panels, Processing Workshop, Bioengineering Workshop, Farm, Universum, Geo Lab, Pyrogenics Factory, Food Factory

**Prebiotic Matter** `res_38_Prebiotic` — raw, Common, branch organics
- Used in recipes: Mycobrick, Biopolymer, Grain, Omni Fruit, Protein Mass, Cultured Meat, Nutrient Paste

**K-IV Aminoacids** `res_40_k_AminoAc` — raw, Uncommon, branch organics
- Used in recipes: Mycobrick, Composite Enzymes, Omni Fruit, Cultured Meat, Krill Preserves, Energy Bar

**K-IV Plankton** `res_24_k_Plankton` — raw, Common, branch organics
- Used in recipes: Composite Enzymes, Grain, Protein Mass, Cultured Meat, Electrocyte Pack, Algae Preserves, Krill Paste, Energy Bar
- Used to build: Bioconversion Lab, Food Factory, Knidaria Building

**K-IV Algae** `res_31_k_Algae` — raw, Common, branch organics
- Used in recipes: Mycobrick, Biopolymer, Grain, Omni Fruit, Protein Mass, Cultured Meat, Algae Preserves, Nutrient Paste, Freighter
- Used to build: Food Factory, Mistralid Building, Knidaria Building

**K-IV Krill** `res_39_k_Krill` — raw, Common, branch organics
- Used in recipes: Biopolymer, Composite Enzymes, Omni Fruit, Protein Mass, Cultured Meat, Electrocyte Pack, Krill Preserves, Krill Paste
- Used to build: Mistralid Building

**Mycelium** `res_mugywkvu5c5` — raw, Common, branch organics
- Used in recipes: Mycobrick, Biopolymer, Composite Enzymes, Grain, Protein Mass, Cultured Meat
- Used to build: Tools Workshop, Compounds Workshop, Farm, Bioconversion Lab

### Tier 1

**Alloyed Metal** `processing_02` — component, branch metal
- Recipe: (Aluminum x2 | Titanium x2) + (Chromium | Tungsten | Copper)
- Made in: Tools Workshop (g3), Processing Workshop (g2)
- Used in recipes: Battery Block, Servo Drive, Worker Drone, Modular Container, Composite Panels, Basic Extractor, Algae Preserves, Krill Preserves, Freighter, Fusion Cell
- Used to build: Generator, Small Energy Accumulator, Hangar, Energy Accumulator, Geo Lab, Grenade Launcher, Electronics Factory, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Food Factory, Institute, Nasobi Building, Smart Tools Plant, Tactical Production Plant, Hi-Tech Facility, Robotics Facility, Advanced Wares Facility

**Metal Constructions** `processing_01` — component, branch metal
- Recipe: (Iron x2 | Aluminum x2) + (Chromium | Tungsten)
- Made in: Repairs Workshop (g3), Compounds Workshop (g2)
- Used in recipes: Modular Container, Basic Extractor, Freighter
- Used to build: Generator, Solar Panels, Small Energy Accumulator, Artifacts Lab, Hangar, Energy Accumulator, Medical Center, Bioconversion Lab, Geo Lab, Residential Complex, Cyclone Energy Turbine, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Energy Research Factory, Component Factory, Food Factory, Health and Care Center, Social dome, Power Bolt Emitter, Photon Gun, Solar Reactor, Fusion Core Unit, Advanced Tools Plant, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Holodeck, Alliance Center, Active defense system, Power Barrier, Static Field, Hi-Tech Facility, Experimental Materials Facility, Robotics Facility, Advanced Wares Facility, Antimatter Core Unit, Evolution Center, Satellite Control Complex, Advanced Technology Center

**Mycobrick** `synthesis_06` — component, branch organic
- Recipe: (Mycelium | K-IV Algae x2) + (Prebiotic Matter x2 | K-IV Aminoacids x2)
- Made in: Compounds Workshop (g3), Plantation (g2)
- Used in recipes: Modular Container
- Used to build: Solar Panels, Artifacts Lab, Hangar, Medical Center, Bioconversion Lab, Geo Lab, Grenade Launcher, Residential Complex, Cyclone Energy Turbine, Electronics Factory, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Food Factory, Health and Care Center, Social dome, Institute, Power Bolt Emitter, Photon Gun, Solar Reactor, Fusion Core Unit, Mistralid Building, Advanced Tools Plant, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Holodeck, Alliance Center, Active defense system, Power Barrier, Sonic Pulse System, Static Field, Hi-Tech Facility, Experimental Materials Facility, Robotics Facility, Advanced Wares Facility, Antimatter Core Unit, Evolution Center, Satellite Control Complex, Advanced Technology Center

**Thermoplastic** `processing_03` — component, branch chemistry
- Recipe: (Hydrocarbons x2 | Chlorine x2) + (Phosphorus | Silicon)
- Made in: Synthesis Workshop (g3), Processing Workshop (g2)
- Used in recipes: Med Gel, Servo Drive, Modular Container, Composite Panels, Basic Extractor, Personal Defence Kit, Algae Preserves, Krill Preserves
- Used to build: Generator, Small Energy Accumulator, Artifacts Lab, Hangar, Energy Accumulator, Medical Center, Geo Lab, Grenade Launcher, Residential Complex, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Food Factory, Health and Care Center, Social dome, Institute, Power Bolt Emitter, Photon Gun, Crabari Building, Knidaria Building, Advanced Tools Plant, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Alliance Center, Sonic Pulse System, Robotics Facility, Advanced Wares Facility, Antimatter Core Unit, Evolution Center, Satellite Control Complex

**Biopolymer** `synthesized_01` — component, branch organic
- Recipe: (K-IV Krill x2 | K-IV Algae x2) + (Prebiotic Matter | Mycelium)
- Made in: Bioengineering Workshop (g3), Bioconversion Lab (g3), Synthesis Workshop (g2)
- Used in recipes: Modular Container, Personal Defence Kit, Algae Preserves, Krill Preserves
- Used to build: Generator, Small Energy Accumulator, Artifacts Lab, Energy Accumulator, Medical Center, Grenade Launcher, Residential Complex, Nano-Tech Factory, Expedition Research Factory, Medical Goods Factory, Health and Care Center, Social dome, Institute, Power Bolt Emitter, Photon Gun, Crabari Building, Mistralid Building, Knidaria Building, Advanced Tools Plant, Expedition Plant, Tactical Production Plant, Consumer Goods Plant, Alliance Center, Antimatter Core Unit, Evolution Center

**Biochem Compounds** `synthesis_02` — component, branch chemistry
- Recipe: (Phosphorus x2 | Sulfur x2) + (Chlorine | Sodium)
- Made in: Chemistry Workshop (g3), Farm (g2)
- Used in recipes: Med Gel, Battery Block, Electrocyte Pack, Composite Panels, Stem Tissue, Fruit Paste, Transhuman Form, Isotope Source
- Used to build: Medical Center, Prototype Development Factory

**Composite Enzymes** `synthesis_05` — component, branch organic
- Recipe: (Mycelium x2 | K-IV Plankton x2) + (K-IV Aminoacids | K-IV Krill)
- Made in: Bioengineering Workshop (g3), Bioconversion Lab (g3), Compounds Workshop (g2)
- Used in recipes: Med Gel, Bio Cell, Basic Extractor, Krill Paste, Fruit Paste, AI Core, Transhuman Form
- Used to build: Medical Center

**Chemical Fuel** `synthesis_03` — component, branch energy
- Recipe: (Hydrocarbons x2 | Sodium x2) + (Iron | Copper)
- Made in: Universum (g3), Chemistry Workshop (g2), Bioconversion Lab (g2)
- Used in recipes: Fuel Cell, Bio Cell, Propulsion Kit, Basic Extractor
- Used to build: Satellite Control Complex

**Conductive Materials** `processing_04` — component, branch electronics
- Recipe: (Copper x2 | Carbon x2 | Gold) + (Silicon | Chlorine)
- Made in: Processing Workshop (g3), Repairs Workshop (g2)
- Used in recipes: Microcontrollers, Basic Scanner, Battery Block, Servo Drive, Worker Drone, D.A.R.T., Fusion Cell
- Used to build: Cyclone Energy Turbine, Electronics Factory, Nano-Tech Factory, Photon Gun

**Electronic Components** `electronics_05` — component, branch electronics
- Recipe: (Silicon | Carbon) + (Copper x2 | Gold)
- Made in: Electronics Workshop (g3), Repairs Workshop (g2)
- Used in recipes: Basic Scanner, Servo Drive, Worker Drone, Sensors Array, D.A.R.T., Smart Ammunition Pack, AI Core
- Used to build: Artifacts Lab, Grenade Launcher, Power Bolt Emitter, Photon Gun, Solar Reactor, Evolution Center

**Nanomaterials** `synthesis_04` — component, branch electronics
- Recipe: (Carbon x2 | Hydrocarbons x2) + (Phosphorus | Lithium)
- Made in: Electronics Workshop (g3), Chemistry Workshop (g2)
- Used in recipes: Microcontrollers, Battery Block, Servo Drive, Worker Drone, Composite Panels, Sensors Array, Smart Ammunition Pack, Fusion Cell
- Used to build: Cyclone Energy Turbine, Electronics Factory, Nano-Tech Factory, Power Bolt Emitter, Solar Reactor

**Basic Toolkit** `processing_06` — component, branch metal
- Recipe: (Tungsten | Chromium) + (Iron x2 | Titanium x2)
- Made in: Tools Workshop (g3), Repairs Workshop (g2)
- Used in recipes: Worker Drone
- Used to build: Artifacts Lab, Grenade Launcher, Prototype Development Factory, Nasobi Building, Evolution Center

**Grain** `res_29` — consumable (food), branch organic
- Recipe: (Prebiotic Matter x2 | Mycelium x2) + (K-IV Algae | K-IV Plankton)
- Made in: Farm (g3), Universum (g2)
- Used in recipes: Stem Tissue, Fruit Paste, Energy Bar, Nutrient Paste

**Omni Fruit** `res_30` — consumable (food), branch organic
- Recipe: (K-IV Aminoacids | K-IV Algae x2) + (Prebiotic Matter | K-IV Krill)
- Made in: Plantation (g3), Farm (g2)
- Used in recipes: Med Gel, Fruit Paste

**Protein Mass** `res_33` — consumable (food), branch organic
- Recipe: (K-IV Plankton x2 | Mycelium x2 | K-IV Algae x2) + (Prebiotic Matter | K-IV Krill)
- Made in: Plantation (g3), Bioconversion Lab (g3), Bioengineering Workshop (g2)
- Used in recipes: Bio Cell, Stem Tissue, Krill Paste, Energy Bar, Nutrient Paste, Omni-Meal

**Cultured Meat** `res_32` — consumable (food), branch organic
- Recipe: (Mycelium x2 | K-IV Krill x2 | K-IV Plankton x2) + (Prebiotic Matter | K-IV Aminoacids | K-IV Algae)
- Made in: Farm (g3), Bioengineering Workshop (g2)
- Used in recipes: Stem Tissue, Nutrient Paste, Omni-Meal

**Standard Ammunition Pack** `ammunition_01` — consumable (ammo), branch metal
- Recipe: (Iron x2 | Tungsten x2) + (Sulfur | Carbon)
- Made in: Tools Workshop (g3), Synthesis Workshop (g2)
- Used in recipes: Smart Ammunition Pack

**Explosive Charges** `ammunition_02` — consumable (ammo), branch chemistry
- Recipe: (Sulfur x2 | Chlorine x2) + (Phosphorus | Aluminum | Sodium)
- Made in: Chemistry Workshop (g3), Synthesis Workshop (g2)
- Used in recipes: Propulsion Kit, Basic Extractor, Smart Ammunition Pack

**Electrolyte Salts** `craft_electrolyte_salts` — component, branch energy
- Recipe: (Sodium x2 | Lithium) + (Hydrocarbons | Silicon)
- Made in: Universum (g3), Electronics Workshop (g2)
- Used in recipes: Battery Block, Electrocyte Pack, Fuel Cell, Bio Cell, Isotope Source

### Tier 2

**Med Gel** `medres_01` — consumable (medicine), branch chemistry
- Recipe: (Biochem Compounds | Thermoplastic) + (Composite Enzymes | Omni Fruit)
- Made in: Medical Goods Factory (g3), Expedition Research Factory (g2)
- Used in recipes: Neural Mesh, Med Kit
- Used to build: Health and Care Center

**Microcontrollers** `electronics_02` — component, branch electronics
- Recipe: (Nanomaterials | Conductive Materials) + (Chlorine x2 | Phosphorus x2)
- Made in: Electronics Factory (g3), Nano-Tech Factory (g2)
- Used in recipes: Comm-Link, Multi-Tool, AI Core, Cyberware, Tech Assembly Matrix
- Used to build: Smart Tools Plant, Alliance Center, Sonic Pulse System

**Basic Scanner** `machinery_04` — consumable (pulse), branch electronics
- Recipe: (Electronic Components | Conductive Materials) + (Lithium | Sodium x3)
- Made in: Nano-Tech Factory (g3), Expedition Research Factory (g2)
- Used in recipes: Tricoder, Multi-Tool, Surveying Probe
- Used to build: Expedition Plant, Active defense system, Sonic Pulse System

**Battery Block** `machinery_05` — consumable (power_cell), branch energy
- Recipe: (Electrolyte Salts | Biochem Compounds) + (Conductive Materials | Nanomaterials | Alloyed Metal)
- Made in: Energy Research Factory (g3), Container Factory (g2)
- Used in recipes: Comm-Link, Tricoder, Tech Voxel, Portable Force Shield, Fusion Cell, Recon Craft
- Used to build: Solar Reactor, Fusion Core Unit, Power Barrier, Static Field, Advanced Wares Facility

**Electrocyte Pack** `craft_electrocyte_pack` — component, branch energy
- Recipe: (Electrolyte Salts | Biochem Compounds) + (K-IV Krill x3 | K-IV Plankton x3)
- Made in: Energy Research Factory (g3), Medical Goods Factory (g2)
- Used in recipes: Comm-Link, Tricoder, Tech Voxel, Neural Mesh, Portable Force Shield, AI Core
- Used to build: Solar Reactor, Consumer Goods Plant, Power Barrier, Advanced Wares Facility

**Fuel Cell** `powercell_01` — consumable (power_cell), branch energy
- Recipe: (Chemical Fuel | Electrolyte Salts) + (Iron x2 | Chromium x2)
- Made in: Prototype Development Factory (g3), Energy Research Factory (g2)
- Used in recipes: Tech Voxel, Fusion Cell, Recon Craft, Deep-Sea Trawler
- Used to build: Fusion Core Unit, Static Field

**Bio Cell** `powercell_02` — consumable (power_cell), branch organic
- Recipe: (Composite Enzymes | Protein Mass) + (Chemical Fuel | Electrolyte Salts)
- Made in: Expedition Research Factory (g3), Energy Research Factory (g2)
- Used in recipes: Neural Mesh, Fusion Cell, Recon Craft, Deep-Sea Trawler

**Servo Drive** `craft_servo_drive` — component, branch metal
- Recipe: (Alloyed Metal | Thermoplastic) + (Conductive Materials | Nanomaterials | Electronic Components)
- Made in: Component Factory (g3), Prototype Development Factory (g2)
- Used in recipes: Tech Voxel, Med Kit, Underground Deposit Extractor, Recon Craft, Tech Assembly Matrix, Satellite
- Used to build: Advanced Tools Plant, Tactical Production Plant, Sonic Pulse System

**Propulsion Kit** `machinery_01` — component, branch metal
- Recipe: (Tungsten x3 | Titanium x3 | Chromium x3) + (Chemical Fuel | Explosive Charges)
- Made in: Component Factory (g3), Pyrogenics Factory (g2)
- Used in recipes: Tech Voxel, Underground Deposit Extractor, Recon Craft, Satellite
- Used to build: Cyclone Energy Turbine, Advanced Tools Plant, Tactical Production Plant, Sonic Pulse System

**Worker Drone** `unitres_01` — unit, branch metal
- Recipe: (Basic Toolkit | Alloyed Metal) + (Electronic Components | Conductive Materials | Nanomaterials)
- Made in: Hangar (g3)
- Used in: nothing (end product)

**Modular Container** `questres_01` — consumable (rechargeable), branch metal
- Recipe: (Metal Constructions | Alloyed Metal) + (Thermoplastic | Biopolymer | Mycobrick)
- Made in: Container Factory (g3), Component Factory (g2)
- Used in recipes: Multi-Tool, Surveying Probe, Deep-Sea Trawler, Isotope Source
- Used to build: Social dome, Nasobi Building, Aetherid Building, Crabari Building, Mistralid Building, Knidaria Building

**Composite Panels** `processing_05` — component, branch chemistry
- Recipe: (Thermoplastic | Biochem Compounds) + (Alloyed Metal | Nanomaterials)
- Made in: Geo Lab (g3), Nano-Tech Factory (g2)
- Used in recipes: Portable Force Shield, Surveying Probe, Deep-Sea Trawler, Isotope Source
- Used to build: Cyclone Energy Turbine, Social dome, Institute, Nasobi Building, Aetherid Building, Crabari Building, Mistralid Building, Knidaria Building, Active defense system, Static Field

**Basic Extractor** `extractor_01` — consumable (capsule), branch chemistry
- Recipe: (Metal Constructions | Alloyed Metal | Thermoplastic) + (Chemical Fuel | Explosive Charges | Composite Enzymes)
- Made in: Pyrogenics Factory (g3), Geo Lab (g2)
- Used in recipes: Underground Deposit Extractor, Surveying Probe

**Personal Defence Kit** `medres_04` — consumable (rechargeable), branch metal
- Recipe: (Titanium | Tungsten) + (Biopolymer | Thermoplastic)
- Made in: Container Factory (g3), Prototype Development Factory (g2)
- Used in recipes: Portable Force Shield

**Stem Tissue** `medres_03` — consumable (medicine), branch organic
- Recipe: (Cultured Meat | Protein Mass) + (Biochem Compounds | Grain)
- Made in: Medical Goods Factory (g3), Food Factory (g2)
- Used in recipes: Neural Mesh, Med Kit, Cyberware
- Used to build: Health and Care Center, Consumer Goods Plant

**Algae Preserves** `food_08` — consumable (food), branch organic
- Recipe: (K-IV Algae | K-IV Plankton) + (Thermoplastic | Biopolymer | Alloyed Metal)
- Made in: Mistralid Building (g3), Knidaria Building (g2)
- Used in: nothing (end product)

**Krill Preserves** `food_10` — consumable (food), branch organic
- Recipe: (K-IV Krill | K-IV Aminoacids) + (Thermoplastic | Biopolymer | Alloyed Metal)
- Made in: Knidaria Building (g3), Aetherid Building (g2)
- Used in: nothing (end product)

**Krill Paste** `food_06` — consumable (food), branch organic
- Recipe: (K-IV Krill | K-IV Plankton) + (Composite Enzymes | Protein Mass)
- Made in: Crabari Building (g3), Nasobi Building (g2)
- Used in recipes: Omni-Meal

**Fruit Paste** `food_07` — consumable (food), branch organic
- Recipe: (Omni Fruit | Grain) + (Composite Enzymes | Biochem Compounds)
- Made in: Nasobi Building (g3), Mistralid Building (g2)
- Used in: nothing (end product)

**Energy Bar** `food_05` — consumable (food), branch organic
- Recipe: (Grain | Protein Mass) + (K-IV Aminoacids | K-IV Plankton)
- Made in: Food Factory (g3), Aetherid Building (g3), Expedition Research Factory (g2), Nasobi Building (g2)
- Used in recipes: Omni-Meal

**Nutrient Paste** `food_01` — consumable (food), branch organic
- Recipe: (Cultured Meat | Protein Mass | Grain) + (Prebiotic Matter | K-IV Algae)
- Made in: Food Factory (g3), Container Factory (g2), Crabari Building (g2), Knidaria Building (g2)
- Used in recipes: Omni-Meal

**Sensors Array** `electronics_03` — component, branch electronics
- Recipe: (Electronic Components | Nanomaterials) + (Aluminum x2 | Titanium x2)
- Made in: Electronics Factory (g3), Geo Lab (g2)
- Used in recipes: Comm-Link, Tricoder, Multi-Tool, Med Kit, Surveying Probe, Tech Assembly Matrix
- Used to build: Institute, Expedition Plant, Smart Tools Plant, Alliance Center, Active defense system, Static Field

**D.A.R.T.** `extractor_02` — consumable (capsule), branch chemistry
- Recipe: (Sulfur | Phosphorus) + (Electronic Components | Conductive Materials)
- Made in: Pyrogenics Factory (g3), Prototype Development Factory (g2)
- Used in recipes: Underground Deposit Extractor

**Smart Ammunition Pack** `ammunition_03` — consumable (ammo), branch chemistry
- Recipe: (Explosive Charges | Standard Ammunition Pack) + (Electronic Components | Nanomaterials)
- Made in: Pyrogenics Factory (g3), Electronics Factory (g2)
- Used in recipes: Underground Deposit Extractor
- Used to build: Active defense system

**Freighter** `unitres_02` — unit, branch metal
- Recipe: (Alloyed Metal | Metal Constructions) + (Hydrocarbons | K-IV Algae)
- Made in: Hangar (g3)
- Used in: nothing (end product)

### Tier 3

**Comm-Link** `questres_03` — consumable (rechargeable), branch electronics
- Recipe: (Microcontrollers | Sensors Array) + (Battery Block | Electrocyte Pack)
- Made in: Smart Tools Plant (g3), Consumer Goods Plant (g2)
- Used in recipes: AI Core, Cyberware, Transhuman Form
- Used to build: Holodeck, Satellite Control Complex, Advanced Technology Center

**Tricoder** `questres_05` — consumable (rechargeable), branch electronics
- Recipe: (Basic Scanner | Sensors Array) + (Battery Block | Electrocyte Pack)
- Made in: Smart Tools Plant (g3), Advanced Tools Plant (g2)
- Used to build: Hi-Tech Facility, Robotics Facility, Evolution Center, Satellite Control Complex

**Multi-Tool** `scineceres_01` — component, branch metal
- Recipe: (Modular Container | Basic Scanner) + (Microcontrollers | Sensors Array)
- Made in: Advanced Tools Plant (g3), Tactical Production Plant (g2), Robotics Facility (g2)
- Used in recipes: Tech Assembly Matrix
- Used to build: Hi-Tech Facility, Experimental Materials Facility, Robotics Facility, Evolution Center, Advanced Technology Center

**Tech Voxel** `machinery_03` — component, branch metal, start kit
- Recipe: (Servo Drive | Propulsion Kit) + (Battery Block | Electrocyte Pack | Fuel Cell)
- Made in: Advanced Wares Facility (g3), Advanced Tools Plant (g2), Experimental Materials Facility (g2)
- Used in recipes: Tech Assembly Matrix, Isotope Source
- Used to build: Generator, Solar Panels, Tools Workshop, Electronics Workshop, Repairs Workshop, Processing Workshop, Synthesis Workshop, Compounds Workshop, Chemistry Workshop, Bioengineering Workshop, Farm, Plantation, Universum, Fusion Core Unit, Antimatter Core Unit

**Neural Mesh** `craft_neural_mesh` — component, branch organic
- Recipe: (Stem Tissue | Bio Cell) + (Med Gel | Electrocyte Pack)
- Made in: Consumer Goods Plant (g3), Advanced Wares Facility (g2)
- Used in recipes: AI Core, Cyberware, Transhuman Form
- Used to build: Holodeck

**Portable Force Shield** `consumer_02` — consumable (rechargeable), branch energy
- Recipe: (Personal Defence Kit | Composite Panels) + (Battery Block | Electrocyte Pack)
- Made in: Advanced Wares Facility (g3), Expedition Plant (g2)
- Used in recipes: Isotope Source
- Used to build: Fusion Core Unit, Experimental Materials Facility, Antimatter Core Unit

**Med Kit** `medres_02` — consumable (medicine), branch organic
- Recipe: (Med Gel | Sensors Array) + (Stem Tissue | Servo Drive)
- Made in: Consumer Goods Plant (g3), Tactical Production Plant (g2)
- Used in recipes: Cyberware

**Underground Deposit Extractor** `extractor_03` — consumable (capsule), branch chemistry
- Recipe: (Basic Extractor | D.A.R.T.) + (Servo Drive | Propulsion Kit | Smart Ammunition Pack)
- Made in: Advanced Tools Plant (g3), Expedition Plant (g2)
- Used in: nothing (end product)

**Omni-Meal** `food_11` — consumable (food), branch organic
- Recipe: (Cultured Meat | Protein Mass) + (Energy Bar | Krill Paste | Nutrient Paste)
- Made in: Crabari Building (g3), Consumer Goods Plant (g3), Mistralid Building (g2), Expedition Plant (g2)
- Used in: nothing (end product)

**Fusion Cell** `powercell_04` — consumable (power_cell), branch energy
- Recipe: (Fuel Cell | Bio Cell | Battery Block) + (Conductive Materials | Nanomaterials | Alloyed Metal) + (Lithium | Hydrocarbons x3)
- Made in: Expedition Plant (g3), Tactical Production Plant (g2)
- Used in recipes: Positron Cell

**Surveying Probe** `cn_41` — consumable (capsule), branch electronics
- Recipe: (Sensors Array | Basic Scanner) + (Modular Container | Composite Panels | Basic Extractor)
- Made in: Tactical Production Plant (g3), Smart Tools Plant (g2)
- Used in recipes: Satellite

**Recon Craft** `unitres_03` — unit, branch metal
- Recipe: (Servo Drive | Propulsion Kit) + (Battery Block | Fuel Cell | Bio Cell)
- Made in: Hangar (g3)
- Used in: nothing (end product)

**Deep-Sea Trawler** `unitres_05` — unit, branch metal
- Recipe: (Composite Panels | Modular Container) + (Fuel Cell | Bio Cell)
- Made in: Hangar (g3)
- Used in: nothing (end product)

### Tier 4

**AI Core** `electronics_01` — component, branch electronics
- Recipe: (Comm-Link | Neural Mesh) + (Electronic Components x4 | Composite Enzymes x6) + (Microcontrollers | Electrocyte Pack)
- Made in: Hi-Tech Facility (g3), Robotics Facility (g2)
- Used in recipes: Satellite
- Used to build: Holodeck

**Cyberware** `consumer_01` — consumable (implant), branch organic
- Recipe: (Med Kit) + (Comm-Link | Neural Mesh) + (Stem Tissue | Microcontrollers)
- Made in: Robotics Facility (g3), Hi-Tech Facility (g2)
- Used in recipes: Transhuman Form
- Used to build: Holodeck

**Tech Assembly Matrix** `machinery_02` — component, branch metal
- Recipe: (Tech Voxel | Multi-Tool) + (Sensors Array | Microcontrollers | Servo Drive)
- Made in: Experimental Materials Facility (g3), Robotics Facility (g2)
- Used to build: Antimatter Core Unit

**Isotope Source** `craft_isotope_source` — component, branch chemistry
- Recipe: (Tech Voxel | Portable Force Shield) + (Electrolyte Salts x4 | Biochem Compounds x4) + (Composite Panels | Modular Container)
- Made in: Experimental Materials Facility (g3), Hi-Tech Facility (g2)
- Used in recipes: Positron Cell

### Tier 5 (programs)

**Positron Cell** `powercell_05` — program
- Recipe: (Isotope Source) + (Fusion Cell) + (Eldritium x2)
- Made in: Advanced Technology Center (g3)
- Used in: nothing (end product)

**Satellite** `cn_43` — program
- Recipe: (AI Core) + (Surveying Probe) + (Propulsion Kit | Servo Drive)
- Made in: Satellite Control Complex (g3)
- Used in: nothing (end product)

**Transhuman Form** `serviceres_02` — program
- Recipe: (Cyberware) + (Neural Mesh | Comm-Link) + (Composite Enzymes x5 | Biochem Compounds x4)
- Made in: Evolution Center (g3)
- Used in: nothing (end product)

## Buildings

### Services

**General quarters** `b_accomm_01` — tier 0, Accommodation
- Build cost: (Iron | Aluminum) + (Silicon | Sulfur)

**Resource Allocation Center** `b_production_01` — tier 0, Storage
- Build cost: (Iron | Aluminum)

**Medical Center** `b_service_02` — tier 1, Treatment
- Build cost: (Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic) + (Biochem Compounds | Composite Enzymes)

**Bioconversion Lab** `b_service_09` — tier 1, Waste Managment
- Crafts: Biopolymer (g3), Composite Enzymes (g3), Protein Mass (g3), Chemical Fuel (g2)
- Build cost: (Metal Constructions | Mycobrick) + (K-IV Plankton | Mycelium)

**Geo Lab** `b_service_10` — tier 2, Waste Managment
- Crafts: Composite Panels (g3), Basic Extractor (g2), Sensors Array (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Tungsten | Carbon)

**Residential Complex** `b_accomm_02` — tier 2, Accommodation
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer)

**Health and Care Center** `b_service_01` — tier 2, Treatment
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Med Gel | Stem Tissue)

**Social dome** `b_service_03` — tier 2, Treatment
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Modular Container | Composite Panels)

**Institute** `b_service_05` — tier 2, Special Sysytem
- Build cost: (Alloyed Metal | Mycobrick) + (Biopolymer | Thermoplastic) + (Composite Panels | Sensors Array)

**Holodeck** `b_service_06` — tier 3, Special Sysytem
- Build cost: (Metal Constructions | Mycobrick) + (AI Core | Cyberware) + (Comm-Link | Neural Mesh)

**Alliance Center** `b_service_07` — tier 3, Special Sysytem
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Sensors Array | Microcontrollers)

### Other

**Biowaste Dump** `b_dump_bio` — tier 0, Storage

**Manufactured Waste Dump** `b_dump_manufactured` — tier 0, Storage

### Energy

**Generator** `b_energy_03` — tier 0, Energy
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Tech Voxel)

**Solar Panels** `b_energy_11` — tier 0, Energy
- Build cost: (Metal Constructions | Mycobrick) + (Silicon | Carbon | Copper) + (Tech Voxel)

**Small Energy Accumulator** `b_energy_12` — tier 0, Battery
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Sodium | Lithium)

**Energy Accumulator** `b_energy_08` — tier 1, Battery
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Sodium | Lithium)

**Cyclone Energy Turbine** `b_energy_06` — tier 2, Renewable Energy
- Build cost: (Metal Constructions | Mycobrick) + (Composite Panels | Propulsion Kit) + (Conductive Materials | Nanomaterials)

**Solar Reactor** `b_energy_07` — tier 3, Renewable Energy
- Build cost: (Metal Constructions | Mycobrick) + (Battery Block | Electrocyte Pack) + (Electronic Components | Nanomaterials)

**Fusion Core Unit** `b_energy_09` — tier 3, Energy
- Build cost: (Metal Constructions | Mycobrick) + (Portable Force Shield | Tech Voxel) + (Fuel Cell | Battery Block)

**Antimatter Core Unit** `b_energyprogram_t5_01` — tier 5, Energy
- Build cost: (Metal Constructions x3 | Mycobrick x3) + (Biopolymer x2 | Thermoplastic x2) + (Tech Voxel | Portable Force Shield) + (Tech Assembly Matrix)

### Advanced Tech

**Artifacts Lab** `b_exploration_01` — tier 0, Special Sysytem
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Basic Toolkit | Electronic Components)

**Advanced Wares Facility** `b_production_t4_04` — tier 3, Production
- Crafts: Portable Force Shield (g3), Tech Voxel (g3), Neural Mesh (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Battery Block | Electrocyte Pack)

**Hi-Tech Facility** `b_production_t4_01` — tier 4, Production
- Crafts: AI Core (g3), Isotope Source (g2), Cyberware (g2)
- Build cost: (Alloyed Metal | Metal Constructions | Mycobrick) + (Multi-Tool | Tricoder)

**Experimental Materials Facility** `b_production_t4_02` — tier 4, Production
- Crafts: Tech Assembly Matrix (g3), Isotope Source (g3), Tech Voxel (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Portable Force Shield | Multi-Tool)

**Robotics Facility** `b_production_t4_03` — tier 4, Production
- Crafts: Cyberware (g3), AI Core (g2), Multi-Tool (g2), Tech Assembly Matrix (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Alloyed Metal) + (Tricoder | Multi-Tool)

**Evolution Center** `b_evolutionprogram_t5_01` — tier 5, Production
- Crafts: Transhuman Form (g3)
- Build cost: (Metal Constructions x3 | Mycobrick x3) + (Biopolymer x2 | Thermoplastic x2) + (Basic Toolkit x3 | Electronic Components x3) + (Multi-Tool | Tricoder)

**Satellite Control Complex** `b_explorationprogram_t5_01` — tier 5, Special Sysytem
- Crafts: Satellite (g3)
- Build cost: (Metal Constructions x3 | Mycobrick x3) + (Chemical Fuel x6 | Thermoplastic x6) + (Tricoder | Comm-Link)

**Advanced Technology Center** `b_powerprogram_t5_01` — tier 5, Production
- Crafts: Positron Cell (g3)
- Build cost: (Metal Constructions x6 | Mycobrick x6) + (Multi-Tool | Comm-Link)

### Ship Systems

**Hangar** `b_fleet_02` — tier 0, Neutral
- Crafts: Worker Drone (g3), Freighter (g3), Recon Craft (g3), Deep-Sea Trawler (g3)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic)

**Power Unit** `shipsystem_01` — tier 0, Neutral

**Sensor System** `shipsystem_02` — tier 0, Neutral

**Engine** `shipsystem_03` — tier 0, Neutral

**Mass Driver** `shipsystem_04` — tier 0, Neutral

**R&D Lab** `shipsystem_05` — tier 0, Exploration

### Workshop

**Tools Workshop** `b_production_t1_01` — tier 1, Production
- Crafts: Alloyed Metal (g3), Basic Toolkit (g3), Standard Ammunition Pack (g3)
- Build cost: (Iron | Titanium) + (Mycelium | Hydrocarbons) + (Tech Voxel)

**Electronics Workshop** `b_production_t1_02` — tier 1, Production
- Crafts: Electronic Components (g3), Nanomaterials (g3), Electrolyte Salts (g2)
- Build cost: (Aluminum | Iron) + (Silicon | Phosphorus) + (Tech Voxel)

**Repairs Workshop** `b_production_t1_03` — tier 1, Production
- Crafts: Metal Constructions (g3), Basic Toolkit (g2), Electronic Components (g2), Conductive Materials (g2)
- Build cost: (Titanium | Aluminum) + (Iron | Silicon) + (Tech Voxel)

**Processing Workshop** `b_production_t1_04` — tier 1, Production
- Crafts: Conductive Materials (g3), Alloyed Metal (g2), Thermoplastic (g2)
- Build cost: (Carbon | Titanium) + (Phosphorus | Silicon) + (Tech Voxel)

**Synthesis Workshop** `b_production_t1_05` — tier 1, Production
- Crafts: Thermoplastic (g3), Explosive Charges (g2), Standard Ammunition Pack (g2), Biopolymer (g2)
- Build cost: (Iron | Aluminum) + (Sodium | Sulfur) + (Tech Voxel)

**Compounds Workshop** `b_production_t1_06` — tier 1, Production
- Crafts: Mycobrick (g3), Composite Enzymes (g2), Metal Constructions (g2)
- Build cost: (Aluminum | Silicon) + (Phosphorus | Mycelium) + (Tech Voxel)

**Chemistry Workshop** `b_production_t1_07` — tier 1, Production
- Crafts: Explosive Charges (g3), Biochem Compounds (g3), Chemical Fuel (g2), Nanomaterials (g2)
- Build cost: (Iron | Titanium) + (Hydrocarbons | Sulfur) + (Tech Voxel)

**Bioengineering Workshop** `b_production_t1_08` — tier 1, Production
- Crafts: Biopolymer (g3), Composite Enzymes (g3), Protein Mass (g2), Cultured Meat (g2)
- Build cost: (Iron | Carbon) + (Sulfur | Hydrocarbons) + (Tech Voxel)

**Farm** `b_production_t1_09` — tier 1, Production
- Crafts: Grain (g3), Cultured Meat (g3), Omni Fruit (g2), Biochem Compounds (g2)
- Build cost: (Mycelium | Sulfur) + (Aluminum | Carbon) + (Tech Voxel)

**Plantation** `b_production_t1_10` — tier 1, Production
- Crafts: Omni Fruit (g3), Protein Mass (g3), Mycobrick (g2)
- Build cost: (Hydrocarbons | Phosphorus) + (Iron | Titanium) + (Tech Voxel)

**Universum** `b_production_t1_11` — tier 1, Production
- Crafts: Chemical Fuel (g3), Electrolyte Salts (g3), Grain (g2)
- Build cost: (Titanium | Carbon) + (Hydrocarbons | Phosphorus) + (Tech Voxel)

### Defense

**Gatling Gun** `b_survival_02` — tier 1, Weapon
- Build cost: (Iron | Aluminum) + (Chromium | Tungsten) + (Chlorine | Hydrocarbons)

**Grenade Launcher** `b_survival_04` — tier 1, Weapon
- Build cost: (Thermoplastic | Alloyed Metal) + (Biopolymer | Mycobrick) + (Basic Toolkit | Electronic Components)

**Flamethrower** `b_survival_06` — tier 1, Weapon
- Build cost: (Titanium | Aluminum) + (Silicon | Copper) + (Chromium | Tungsten)

**Power Bolt Emitter** `b_survival_01` — tier 2, Weapon
- Build cost: (Thermoplastic | Biopolymer) + (Metal Constructions | Mycobrick) + (Electronic Components | Nanomaterials)

**Photon Gun** `b_survival_03` — tier 2, Weapon
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Conductive Materials | Electronic Components)

**Active defense system** `b_survival_05` — tier 3, Weapon
- Build cost: (Metal Constructions | Mycobrick) + (Basic Scanner | Sensors Array) + (Composite Panels | Smart Ammunition Pack)

**Power Barrier** `b_survival_07` — tier 3, Weapon
- Build cost: (Metal Constructions | Mycobrick) + (Battery Block | Electrocyte Pack) + (Eldritium)

**Sonic Pulse System** `b_survival_08` — tier 3, Weapon
- Build cost: (Mycobrick | Thermoplastic) + (Microcontrollers | Basic Scanner) + (Propulsion Kit | Servo Drive)

**Static Field** `b_survival_09` — tier 3, Weapon
- Build cost: (Metal Constructions | Mycobrick) + (Battery Block | Fuel Cell) + (Composite Panels | Sensors Array)

### Factory

**Electronics Factory** `b_production_t2_01` — tier 2, Production
- Crafts: Sensors Array (g3), Microcontrollers (g3), Smart Ammunition Pack (g2)
- Build cost: (Alloyed Metal | Mycobrick) + (Conductive Materials | Nanomaterials)

**Pyrogenics Factory** `b_production_t2_02` — tier 2, Production
- Crafts: D.A.R.T. (g3), Basic Extractor (g3), Smart Ammunition Pack (g3), Propulsion Kit (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Tungsten | Chromium | Carbon)

**Nano-Tech Factory** `b_production_t2_03` — tier 2, Production
- Crafts: Basic Scanner (g3), Microcontrollers (g2), Composite Panels (g2)
- Build cost: (Metal Constructions | Alloyed Metal | Mycobrick) + (Thermoplastic | Biopolymer) + (Nanomaterials | Conductive Materials)

**Prototype Development Factory** `b_production_t2_04` — tier 2, Production
- Crafts: Fuel Cell (g3), D.A.R.T. (g2), Personal Defence Kit (g2), Servo Drive (g2)
- Build cost: (Mycobrick | Alloyed Metal) + (Metal Constructions | Thermoplastic) + (Basic Toolkit | Biochem Compounds)

**Container Factory** `b_production_t2_05` — tier 2, Production
- Crafts: Modular Container (g3), Personal Defence Kit (g3), Battery Block (g2), Nutrient Paste (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Aluminum | Chlorine)

**Expedition Research Factory** `b_production_t2_06` — tier 2, Production
- Crafts: Bio Cell (g3), Med Gel (g2), Energy Bar (g2), Basic Scanner (g2)
- Build cost: (Alloyed Metal | Mycobrick) + (Biopolymer | Metal Constructions) + (Silicon x2 | Gold)

**Energy Research Factory** `b_production_t2_07` — tier 2, Production
- Crafts: Battery Block (g3), Electrocyte Pack (g3), Fuel Cell (g2), Bio Cell (g2)
- Build cost: (Mycobrick | Metal Constructions) + (Thermoplastic | Alloyed Metal) + (Lithium | Sodium x2)

**Component Factory** `b_production_t2_08` — tier 2, Production
- Crafts: Servo Drive (g3), Propulsion Kit (g3), Modular Container (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Copper | Aluminum)

**Medical Goods Factory** `b_production_t2_09` — tier 2, Production
- Crafts: Stem Tissue (g3), Med Gel (g3), Electrocyte Pack (g2)
- Build cost: (Mycobrick | Alloyed Metal) + (Biopolymer | Thermoplastic) + (Chlorine | Sodium)

**Food Factory** `b_production_t2_10` — tier 2, Production
- Crafts: Energy Bar (g3), Nutrient Paste (g3), Stem Tissue (g2)
- Build cost: (Mycobrick | Metal Constructions) + (Alloyed Metal | Thermoplastic) + (Carbon | K-IV Algae | K-IV Plankton)

### Plant

**Nasobi Building** `b_locals_t3_01` — tier 3, Production
- Crafts: Fruit Paste (g3), Krill Paste (g2), Energy Bar (g2)
- Build cost: (Modular Container | Composite Panels) + (Basic Toolkit | Alloyed Metal)

**Aetherid Building** `b_locals_t3_02` — tier 3, Production
- Crafts: Energy Bar (g3), Krill Preserves (g2)
- Build cost: (Modular Container | Composite Panels) + (Lithium | Sodium x2)

**Crabari Building** `b_locals_t3_03` — tier 3, Production
- Crafts: Krill Paste (g3), Nutrient Paste (g2), Omni-Meal (g3)
- Build cost: (Modular Container | Composite Panels) + (Thermoplastic | Biopolymer) + (Titanium | Iron)

**Mistralid Building** `b_locals_t3_04` — tier 3, Production
- Crafts: Algae Preserves (g3), Fruit Paste (g2), Omni-Meal (g2)
- Build cost: (Modular Container | Composite Panels) + (Biopolymer | Mycobrick) + (K-IV Krill | K-IV Algae)

**Knidaria Building** `b_locals_t3_05` — tier 3, Production
- Crafts: Krill Preserves (g3), Algae Preserves (g2), Nutrient Paste (g2)
- Build cost: (Modular Container | Composite Panels) + (Thermoplastic | Biopolymer) + (K-IV Algae | K-IV Plankton)

**Advanced Tools Plant** `b_production_t3_01` — tier 3, Production
- Crafts: Multi-Tool (g3), Underground Deposit Extractor (g3), Tricoder (g2), Tech Voxel (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic) + (Servo Drive | Propulsion Kit)

**Expedition Plant** `b_production_t3_02` — tier 3, Production
- Crafts: Omni-Meal (g2), Portable Force Shield (g2), Fusion Cell (g3), Underground Deposit Extractor (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Basic Scanner | Sensors Array)

**Smart Tools Plant** `b_production_t3_03` — tier 3, Production
- Crafts: Comm-Link (g3), Tricoder (g3), Surveying Probe (g2)
- Build cost: (Mycobrick | Alloyed Metal) + (Thermoplastic | Metal Constructions) + (Microcontrollers | Sensors Array)

**Tactical Production Plant** `b_production_t3_04` — tier 3, Production
- Crafts: Surveying Probe (g3), Med Kit (g2), Multi-Tool (g2), Fusion Cell (g2)
- Build cost: (Alloyed Metal | Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic) + (Propulsion Kit | Servo Drive)

**Consumer Goods Plant** `b_production_t3_05` — tier 3, Production
- Crafts: Neural Mesh (g3), Med Kit (g3), Omni-Meal (g3), Comm-Link (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic) + (Stem Tissue | Electrocyte Pack)

---

> **OUTDATED DRAFT. Grid v14.3 is a rough draft of the game designer's rework of the crafting grid (2026-10-01) and is already out of date: it does NOT match the current state of the game or of the design. Use it only to see the general direction in which the game economy is changing. Never use it as a source of items, recipes, buildings, tiers or numbers: for those use the team prototype grid (data/grid/grid_prototype.json) and the team sheet.**
