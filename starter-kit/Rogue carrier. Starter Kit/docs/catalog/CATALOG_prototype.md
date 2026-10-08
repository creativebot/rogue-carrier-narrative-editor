# Team prototype grid — catalog

The grid as it is in the game build (team exports, 2026-09-23). The team's current baseline.

- No amounts and no tags: options are listed, quantities live in the team sheet (data/team_sheet/UE_ResourcesMerged.tsv: Amount1..3 for slots 1..3 at the best grade, Result Amount = units made).
- madeIn.grade comes from the team sheet (UE_BuildingsFunctional: ProducesHighEfficiency = 3, Mid = 2, Low = 1). Grade 3 = fewest inputs, shortest time; grade 2 uses x1.4 inputs, grade 1 x1.8 (game settings).
- A recipe slot is filled by ONE of its options. A building cost slot likewise.

Generated from `data/grid/grid_prototype.json`. One recipe slot = pick one option (`A | B`). `xN` = relative quantity.

## Items by tier

### Tier 0 (raw resources)

**Gold** `res_01_Gold` — raw, Exotic
- Used in recipes: Conductive Materials, Electronic Components, Basic Scanner

**Copper** `res_03_Copper` — raw, Uncommon
- Used in recipes: Alloyed Metal, Conductive Materials, Electronic Components
- Used to build: Tools Workshop, Electronics Workshop, Repairs Workshop, Processing Workshop

**Iron** `res_04_Iron` — raw, Common
- Used in recipes: Alloyed Metal, Metal Constructions
- Used to build: General quarters, Resource Allocation Center, Tools Workshop, Electronics Workshop, Repairs Workshop, Processing Workshop, Synthesis Workshop, Compounds Workshop, Chemistry Workshop, Bioengineering Workshop, Farm, Plantation, Universum, Gatling Gun

**Chromium** `res_06_Chrom` — raw, Uncommon
- Used in recipes: Basic Toolkit, Metal Constructions, Standard Ammunition Pack, Nano Parts, Personal Defence Kit
- Used to build: Tools Workshop, Repairs Workshop, Processing Workshop, Synthesis Workshop, Flamethrower

**Aluminum** `res_07_Alum` — raw, Common
- Used in recipes: Alloyed Metal, Basic Toolkit, Metal Constructions
- Used to build: General quarters, Resource Allocation Center, Tools Workshop, Electronics Workshop, Synthesis Workshop, Compounds Workshop, Chemistry Workshop, Bioengineering Workshop, Farm, Plantation, Universum, Gatling Gun

**Titanium** `res_08_Titan` — raw, Uncommon
- Used in recipes: Alloyed Metal, Basic Toolkit, Modular Container
- Used to build: Resource Allocation Center, Repairs Workshop, Processing Workshop, Gatling Gun, Flamethrower

**Tungsten** `res_10_Tung` — raw, Uncommon
- Used in recipes: Basic Toolkit, Standard Ammunition Pack, Personal Defence Kit, Propulsion Kit
- Used to build: Flamethrower

**Chlorine** `res_12_Chlor` — raw, Common
- Used in recipes: Biochem Compounds, Composite Enzymes, Thermoplastic

**Phosphorus** `res_13_Phosph` — raw, Common
- Used in recipes: Biopolymer, Omni Fruit, Standard Ammunition Pack, Microcontrollers
- Used to build: Farm, Plantation, Universum

**Sulfur** `res_14_Sulfur` — raw, Common
- Used in recipes: Mycobrick, Standard Ammunition Pack, Thermoplastic, Microcontrollers
- Used to build: General quarters, Compounds Workshop, Chemistry Workshop, Plantation, Gatling Gun

**Sodium** `res_15_Sodium` — raw, Common
- Used in recipes: Biochem Compounds, Composite Enzymes, Nanomaterials, Battery Block
- Used to build: Small Energy Accumulator, Energy Accumulator

**Lithium** `res_16_Lithium` — raw, Rare
- Used in recipes: Nanomaterials, Basic Scanner, Battery Block, Sensors Array
- Used to build: Small Energy Accumulator, Energy Accumulator

**Silicon** `res_17_Silicon` — raw, Common
- Used in recipes: Biopolymer, Chemical Fuel, Electronic Components, Nanomaterials
- Used to build: General quarters, Solar Panels, Electronics Workshop, Synthesis Workshop, Compounds Workshop, Bioengineering Workshop, Farm, Plantation, Universum, Flamethrower

**Eldritium** `res_19_Eldrit` — raw, Unique
- Used in recipes: Portable Force Shield, Fusion Cell
- Used to build: Power Barrier

**Hydrocarbons** `res_27_HydroCarb` — raw, Common
- Used in recipes: Chemical Fuel, Standard Ammunition Pack, Thermoplastic

**Carbon** `res_28_Carbon` — raw, Common
- Used in recipes: Chemical Fuel, Metal Constructions, Mycobrick, Nanomaterials, Standard Ammunition Pack
- Used to build: Tools Workshop, Chemistry Workshop, Bioengineering Workshop, Farm, Universum

**Prebiotic Matter** `res_38_Prebiotic` — raw, Common
- Used in recipes: Biochem Compounds, Grain, Mycobrick, Omni Fruit, Protein Mass

**K-IV Aminoacids** `res_40_k_AminoAc` — raw, Uncommon
- Used in recipes: Biochem Compounds, Cultured Meat, Mycobrick, Protein Mass

**K-IV Plankton** `res_24_k_Plankton` — raw, Common
- Used in recipes: Composite Enzymes, Cultured Meat, Omni Fruit, Protein Mass, Algae Preserves, Krill Preserves

**K-IV Algae** `res_31_k_Algae` — raw, Common
- Used in recipes: Chemical Fuel, Protein Mass, Thermoplastic, Algae Preserves, Fruit Paste

**K-IV Krill** `res_39_k_Krill` — raw, Common
- Used in recipes: Biopolymer, Composite Enzymes, Krill Paste, Krill Preserves

### Tier 1

**Alloyed Metal** `processing_02` — component
- Recipe: (Iron | Aluminum) + (Copper | Titanium)
- Made in: Repairs Workshop (g3), Electronics Workshop (g2), Compounds Workshop (g1)
- Used in recipes: Fuel Cell, Nano Parts, Personal Defence Kit, Sensors Array, Worker Drone, Deep-Sea Trawler, Recon Craft
- Used to build: Generator, Small Energy Accumulator, Energy Accumulator, Medical Center, Bioconversion Lab, Geo Lab, Grenade Launcher, Cyclone Energy Turbine, Electronics Factory, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Social dome, Institute, Aetherid Building, Crabari Building, Advanced Tools Plant, Expedition Plant, Holodeck, Alliance Center, Active defense system, Static Field, Hi-Tech Facility, Experimental Materials Facility, Satellite Control Complex, Advanced Technology Center

**Basic Toolkit** `processing_06` — component
- Recipe: (Titanium | Tungsten) + (Aluminum | Chromium)
- Made in: Tools Workshop (g3), Repairs Workshop (g1)
- Used in recipes: Basic Scanner, Propulsion Kit, Worker Drone
- Used to build: Artifacts Lab, Geo Lab, Grenade Launcher, Nano-Tech Factory

**Biochem Compounds** `synthesis_02` — component
- Recipe: (Prebiotic Matter | K-IV Aminoacids) + (Sodium | Chlorine)
- Made in: Compounds Workshop (g3), Bioengineering Workshop (g2), Bioconversion Lab (g1)
- Used in recipes: Basic Extractor, Explosive Charges, Med Gel, Stem Tissue
- Used to build: Medical Center

**Biopolymer** `synthesized_01` — component
- Recipe: (K-IV Krill | Protein Mass) + (Phosphorus | Silicon)
- Made in: Compounds Workshop (g3), Farm (g1), Bioconversion Lab (g1)
- Used in recipes: Bio Cell, Explosive Charges, Nano Parts, Personal Defence Kit
- Used to build: Generator, Small Energy Accumulator, Artifacts Lab, Hangar, Energy Accumulator, Medical Center, Bioconversion Lab, Grenade Launcher, Residential Complex, Electronics Factory, Expedition Research Factory, Energy Research Factory, Medical Goods Factory, Food Factory, Health and Care Center, Institute, Power Bolt Emitter, Photon Gun, Nasobi Building, Mistralid Building, Knidaria Building, Advanced Tools Plant, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Alliance Center, Evolution Center

**Chemical Fuel** `synthesis_03` — component
- Recipe: (Hydrocarbons | K-IV Algae) + (Carbon | Silicon)
- Made in: Chemistry Workshop (g3), Universum (g2)
- Used in recipes: Basic Extractor, Explosive Charges, Fuel Cell, Smart Ammunition Pack, Underground Deposit Extractor

**Composite Enzymes** `synthesis_05` — component
- Recipe: (K-IV Plankton | K-IV Krill) + (Chlorine | Sodium)
- Made in: Synthesis Workshop (g3), Chemistry Workshop (g1)
- Used in recipes: Bio Cell, Explosive Charges, Med Gel, Stem Tissue
- Used to build: Bioconversion Lab

**Conductive Materials** `processing_04` — component
- Recipe: (Copper | Gold)
- Made in: Tools Workshop (g3), Electronics Workshop (g2)
- Used in recipes: Basic Scanner, Battery Block, Microcontrollers, Propulsion Kit, Worker Drone, Underground Deposit Extractor
- Used to build: Photon Gun

**Cultured Meat** `res_32` — consumable (food)
- Recipe: (K-IV Plankton | K-IV Aminoacids)
- Made in: Plantation (g3), Farm (g2)
- Used in recipes: Nutrient Paste, Stem Tissue

**Electronic Components** `electronics_05` — component
- Recipe: (Silicon) + (Copper | Gold | Nanomaterials)
- Made in: Electronics Workshop (g3), Processing Workshop (g2)
- Used in recipes: Basic Scanner, Microcontrollers, Sensors Array, Worker Drone
- Used to build: Power Bolt Emitter

**Grain** `res_29` — consumable (food)
- Recipe: (Prebiotic Matter)
- Made in: Farm (g3), Universum (g2)
- Used in recipes: Thermoplastic, Energy Bar, Nutrient Paste

**Metal Constructions** `processing_01` — component
- Recipe: (Iron | Aluminum) + (Carbon | Chromium)
- Made in: Processing Workshop (g3), Tools Workshop (g1)
- Used in recipes: Basic Extractor, Modular Container, Propulsion Kit, Worker Drone, Deep-Sea Trawler, Underground Deposit Extractor, Recon Craft
- Used to build: Generator, Solar Panels, Small Energy Accumulator, Artifacts Lab, Hangar, Energy Accumulator, Medical Center, Bioconversion Lab, Geo Lab, Residential Complex, Cyclone Energy Turbine, Pyrogenics Factory, Nano-Tech Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Food Factory, Health and Care Center, Social dome, Power Bolt Emitter, Photon Gun, Solar Reactor, Fusion Core Unit, Nasobi Building, Aetherid Building, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Holodeck, Alliance Center, Active defense system, Power Barrier, Static Field, Hi-Tech Facility, Experimental Materials Facility, Robotics Facility, Antimatter Core Unit, Satellite Control Complex

**Mycobrick** `synthesis_06` — component
- Recipe: (Prebiotic Matter | K-IV Aminoacids | Protein Mass) + (Carbon | Sulfur)
- Made in: Bioengineering Workshop (g3), Chemistry Workshop (g1)
- Used in recipes: Basic Extractor, Battery Block, Bio Cell, Modular Container, Worker Drone, Underground Deposit Extractor
- Used to build: Solar Panels, Artifacts Lab, Hangar, Geo Lab, Grenade Launcher, Residential Complex, Pyrogenics Factory, Container Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Food Factory, Health and Care Center, Institute, Solar Reactor, Fusion Core Unit, Aetherid Building, Crabari Building, Mistralid Building, Expedition Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Power Barrier, Sonic Pulse System, Advanced Wares Facility, Antimatter Core Unit, Advanced Technology Center

**Nanomaterials** `synthesis_04` — component
- Recipe: (Silicon | Carbon) + (Sodium | Lithium)
- Made in: Synthesis Workshop (g3), Processing Workshop (g2)
- Used in recipes: Electronic Components, Battery Block, Microcontrollers, Nano Parts, Sensors Array, Worker Drone
- Used to build: Electronics Factory, Nano-Tech Factory, Prototype Development Factory, Component Factory, Advanced Tools Plant

**Omni Fruit** `res_30` — consumable (food)
- Recipe: (Prebiotic Matter | K-IV Plankton) + (Phosphorus)
- Made in: Universum (g3), Plantation (g2)
- Used in recipes: Energy Bar, Fruit Paste, Med Gel

**Protein Mass** `res_33` — consumable (food)
- Recipe: (Prebiotic Matter | K-IV Aminoacids) + (K-IV Plankton | K-IV Algae)
- Made in: Bioengineering Workshop (g3), Synthesis Workshop (g1)
- Used in recipes: Biopolymer, Mycobrick, Energy Bar, Fruit Paste, Krill Paste, Nutrient Paste

**Standard Ammunition Pack** `ammunition_01` — consumable (ammo)
- Recipe: (Chromium | Tungsten) + (Carbon | Hydrocarbons) + (Sulfur | Phosphorus)
- Made in: Chemistry Workshop (g3), Tools Workshop (g1)
- Used in: nothing (end product)

**Thermoplastic** `processing_03` — component
- Recipe: (Hydrocarbons | K-IV Algae | Grain) + (Sulfur | Chlorine)
- Made in: Repairs Workshop (g3), Plantation (g2)
- Used in recipes: Battery Block, Explosive Charges, Fuel Cell, Modular Container, Personal Defence Kit, Sensors Array
- Used to build: Generator, Small Energy Accumulator, Artifacts Lab, Hangar, Energy Accumulator, Medical Center, Bioconversion Lab, Geo Lab, Grenade Launcher, Residential Complex, Electronics Factory, Pyrogenics Factory, Prototype Development Factory, Container Factory, Expedition Research Factory, Energy Research Factory, Component Factory, Medical Goods Factory, Food Factory, Health and Care Center, Social dome, Institute, Power Bolt Emitter, Photon Gun, Nasobi Building, Knidaria Building, Advanced Tools Plant, Smart Tools Plant, Tactical Production Plant, Consumer Goods Plant, Alliance Center, Sonic Pulse System, Advanced Wares Facility, Evolution Center

### Tier 2

**Algae Preserves** `food_08` — consumable (food)
- Recipe: (K-IV Plankton) + (K-IV Algae)
- Made in: Mistralid Building (g3), Knidaria Building (g3)
- Used in: nothing (end product)

**Basic Extractor** `extractor_01` — consumable (capsule)
- Recipe: (Metal Constructions | Mycobrick) + (Chemical Fuel | Biochem Compounds)
- Made in: Pyrogenics Factory (g3), Container Factory (g2), Expedition Research Factory (g2), Geo Lab (g1), Nasobi Building (g1)
- Used in: nothing (end product)

**Basic Scanner** `machinery_04` — consumable (pulse)
- Recipe: (Basic Toolkit) + (Conductive Materials | Electronic Components) + (Lithium | Gold)
- Made in: Prototype Development Factory (g3), Electronics Factory (g1)
- Used in recipes: Comm-Link, D.A.R.T., Deep-Sea Trawler, Multi-Tool, Tricoder
- Used to build: Hi-Tech Facility

**Battery Block** `machinery_05` — consumable (power_cell)
- Recipe: (Sodium | Lithium) + (Thermoplastic | Mycobrick) + (Conductive Materials | Nanomaterials)
- Made in: Component Factory (g3), Pyrogenics Factory (g1)
- Used in recipes: Comm-Link, Portable Force Shield
- Used to build: Solar Reactor, Power Barrier, Static Field, Experimental Materials Facility, Robotics Facility

**Bio Cell** `powercell_02` — consumable (power_cell)
- Recipe: (Composite Enzymes) + (Biopolymer | Mycobrick)
- Made in: Energy Research Factory (g3), Bioconversion Lab (g1), Medical Goods Factory (g1)
- Used in recipes: D.A.R.T., Underground Deposit Extractor, Fusion Cell

**Energy Bar** `food_05` — consumable (food)
- Recipe: (Grain | Protein Mass) + (Omni Fruit)
- Made in: Food Factory (g3), Aetherid Building (g3), Energy Research Factory (g2)
- Used in recipes: Omni-Meal

**Explosive Charges** `ammunition_02` — consumable (ammo)
- Recipe: (Biopolymer | Thermoplastic) + (Chemical Fuel) + (Biochem Compounds | Composite Enzymes)
- Made in: Pyrogenics Factory (g3), Prototype Development Factory (g1)
- Used in: nothing (end product)

**Fruit Paste** `food_07` — consumable (food)
- Recipe: (Omni Fruit | K-IV Algae) + (Protein Mass)
- Made in: Nasobi Building (g3), Mistralid Building (g3)
- Used in: nothing (end product)

**Fuel Cell** `powercell_01` — consumable (power_cell)
- Recipe: (Chemical Fuel) + (Alloyed Metal | Thermoplastic)
- Made in: Prototype Development Factory (g3), Geo Lab (g1), Pyrogenics Factory (g1)
- Used in recipes: D.A.R.T., Underground Deposit Extractor, Fusion Cell

**Krill Paste** `food_06` — consumable (food)
- Recipe: (K-IV Krill) + (Protein Mass)
- Made in: Nasobi Building (g3), Crabari Building (g3)
- Used in: nothing (end product)

**Krill Preserves** `food_10` — consumable (food)
- Recipe: (K-IV Plankton) + (K-IV Krill)
- Made in: Aetherid Building (g3), Knidaria Building (g3)
- Used in: nothing (end product)

**Med Gel** `medres_01` — consumable (medicine)
- Recipe: (Biochem Compounds) + (Composite Enzymes | Omni Fruit)
- Made in: Medical Goods Factory (g3), Energy Research Factory (g2)
- Used in recipes: Med Kit
- Used to build: Health and Care Center

**Microcontrollers** `electronics_02` — component
- Recipe: (Electronic Components) + (Nanomaterials | Conductive Materials) + (Phosphorus | Sulfur)
- Made in: Electronics Factory (g3), Container Factory (g1)
- Used in recipes: Comm-Link, Multi-Tool, Smart Ammunition Pack, Tricoder
- Used to build: Sonic Pulse System, Experimental Materials Facility, Advanced Wares Facility

**Modular Container** `questres_01` — consumable (rechargeable)
- Recipe: (Metal Constructions) + (Mycobrick | Thermoplastic) + (Titanium)
- Made in: Container Factory (g3), Component Factory (g1)
- Used in recipes: D.A.R.T., Freighter, Multi-Tool, Tech Voxel
- Used to build: Social dome

**Nano Parts** `processing_05` — component
- Recipe: (Nanomaterials) + (Alloyed Metal | Biopolymer) + (Chromium)
- Made in: Nano-Tech Factory (g3), Electronics Factory (g2)
- Used in recipes: Freighter, Portable Force Shield, Tech Voxel
- Used to build: Cyclone Energy Turbine, Institute, Active defense system, Static Field, Hi-Tech Facility, Robotics Facility, Advanced Wares Facility

**Nutrient Paste** `food_01` — consumable (food)
- Recipe: (Cultured Meat | Protein Mass) + (Grain)
- Made in: Food Factory (g3), Crabari Building (g3), Expedition Research Factory (g2)
- Used in recipes: Med Kit, Omni-Meal

**Personal Defence Kit** `medres_04` — consumable (rechargeable)
- Recipe: (Alloyed Metal) + (Thermoplastic | Biopolymer) + (Tungsten | Chromium)
- Made in: Expedition Research Factory (g3), Nano-Tech Factory (g1)
- Used in recipes: Portable Force Shield

**Propulsion Kit** `machinery_01` — component
- Recipe: (Basic Toolkit | Metal Constructions) + (Conductive Materials) + (Tungsten)
- Made in: Nano-Tech Factory (g3), Prototype Development Factory (g1)
- Used in recipes: Deep-Sea Trawler, Freighter, Smart Ammunition Pack, Tech Voxel
- Used to build: Cyclone Energy Turbine, Sonic Pulse System

**Sensors Array** `electronics_03` — component
- Recipe: (Thermoplastic | Alloyed Metal) + (Nanomaterials | Electronic Components) + (Lithium)
- Made in: Component Factory (g3), Electronics Factory (g1)
- Used in recipes: D.A.R.T., Deep-Sea Trawler, Smart Ammunition Pack, Tricoder
- Used to build: Solar Reactor, Active defense system

**Stem Tissue** `medres_03` — consumable (medicine)
- Recipe: (Composite Enzymes | Biochem Compounds) + (Cultured Meat)
- Made in: Medical Goods Factory (g3), Food Factory (g1)
- Used in recipes: Med Kit

**Worker Drone** `unitres_01` — unit
- Recipe: (Basic Toolkit | Alloyed Metal) + (Electronic Components | Conductive Materials | Nanomaterials) + (Metal Constructions | Mycobrick)
- Made in: Hangar (g3)
- Used in: nothing (end product)

### Tier 3

**Comm-Link** `questres_03` — consumable (rechargeable)
- Recipe: (Microcontrollers) + (Battery Block | Basic Scanner)
- Made in: Smart Tools Plant (g3), Consumer Goods Plant (g2), Knidaria Building (g1)
- Used in recipes: AI Core, Cyberware

**D.A.R.T.** `extractor_02` — consumable (capsule)
- Recipe: (Modular Container) + (Basic Scanner | Sensors Array) + (Fuel Cell | Bio Cell)
- Made in: Expedition Plant (g3), Smart Tools Plant (g2), Advanced Wares Facility (g2)
- Used in: nothing (end product)

**Deep-Sea Trawler** `unitres_05` — unit
- Recipe: (Propulsion Kit) + (Sensors Array | Basic Scanner) + (Metal Constructions | Alloyed Metal)
- Made in: Hangar (g3)
- Used in: nothing (end product)

**Freighter** `unitres_02` — unit
- Recipe: (Propulsion Kit) + (Modular Container | Nano Parts)
- Made in: Hangar (g3)
- Used in: nothing (end product)

**Med Kit** `medres_02` — consumable (medicine)
- Recipe: (Med Gel) + (Stem Tissue | Nutrient Paste)
- Made in: Consumer Goods Plant (g3), Tactical Production Plant (g2), Mistralid Building (g1)
- Used in recipes: Cyberware

**Multi-Tool** `scineceres_01` — component
- Recipe: (Modular Container) + (Microcontrollers | Basic Scanner)
- Made in: Smart Tools Plant (g3), Tactical Production Plant (g2), Advanced Wares Facility (g2)
- Used in recipes: Tech Assembly Matrix
- Used to build: Evolution Center

**Omni-Meal** `food_11` — consumable (food)
- Recipe: (Energy Bar) + (Nutrient Paste)
- Made in: Consumer Goods Plant (g3), Crabari Building (g1)
- Used in: nothing (end product)

**Portable Force Shield** `consumer_02` — consumable (rechargeable)
- Recipe: (Personal Defence Kit) + (Nano Parts | Battery Block) + (Eldritium)
- Made in: Expedition Plant (g3), Tactical Production Plant (g2), Aetherid Building (g1)
- Used in recipes: Fusion Cell
- Used to build: Fusion Core Unit, Antimatter Core Unit

**Smart Ammunition Pack** `ammunition_03` — consumable (ammo)
- Recipe: (Microcontrollers | Sensors Array) + (Propulsion Kit) + (Chemical Fuel)
- Made in: Advanced Tools Plant (g3), Smart Tools Plant (g2)
- Used in: nothing (end product)

**Tech Voxel** `machinery_03` — component
- Recipe: (Nano Parts) + (Modular Container | Propulsion Kit)
- Made in: Advanced Tools Plant (g3), Expedition Plant (g2)
- Used in recipes: Recon Craft, Surveying Probe, Tech Assembly Matrix, Satellite
- Used to build: Fusion Core Unit, Holodeck, Satellite Control Complex, Advanced Technology Center

**Tricoder** `questres_05` — consumable (rechargeable)
- Recipe: (Basic Scanner) + (Microcontrollers | Sensors Array)
- Made in: Advanced Tools Plant (g3), Consumer Goods Plant (g2)
- Used in recipes: AI Core, Recon Craft, Surveying Probe, Satellite
- Used to build: Satellite Control Complex

**Underground Deposit Extractor** `extractor_03` — consumable (capsule)
- Recipe: (Metal Constructions | Mycobrick) + (Fuel Cell | Bio Cell) + (Chemical Fuel | Conductive Materials)
- Made in: Tactical Production Plant (g3), Advanced Tools Plant (g2), Expedition Plant (g2)
- Used in: nothing (end product)

### Tier 4

**AI Core** `electronics_01` — component
- Recipe: (Comm-Link) + (Tricoder)
- Made in: Hi-Tech Facility (g3), Robotics Facility (g2)
- Used in recipes: Satellite, Transhuman Form
- Used to build: Holodeck, Evolution Center

**Cyberware** `consumer_01` — consumable (implant)
- Recipe: (Comm-Link) + (Med Kit)
- Made in: Robotics Facility (g3), Hi-Tech Facility (g2)
- Used in recipes: Transhuman Form

**Fusion Cell** `powercell_04` — consumable (power_cell)
- Recipe: (Portable Force Shield) + (Fuel Cell | Bio Cell) + (Eldritium)
- Made in: Robotics Facility (g3), Experimental Materials Facility (g2)
- Used in recipes: Positron Cell
- Used to build: Advanced Technology Center

**Recon Craft** `unitres_03` — unit
- Recipe: (Tech Voxel) + (Tricoder) + (Alloyed Metal | Metal Constructions)
- Made in: Hangar (g3)
- Used in: nothing (end product)

**Surveying Probe** `cn_41` — consumable (capsule)
- Recipe: (Tricoder) + (Tech Voxel)
- Made in: Experimental Materials Facility (g3), Hi-Tech Facility (g2)
- Used in: nothing (end product)

**Tech Assembly Matrix** `machinery_02` — component
- Recipe: (Tech Voxel) + (Multi-Tool)
- Made in: Experimental Materials Facility (g3), Advanced Wares Facility (g2)
- Used in recipes: Positron Cell
- Used to build: Generator, Solar Panels, Cyclone Energy Turbine, Solar Reactor, Fusion Core Unit, Antimatter Core Unit

### Tier 5 (programs)

**Positron Cell** `powercell_05` — program
- Recipe: (Fusion Cell) + (Tech Assembly Matrix)
- Made in: Advanced Technology Center (g3)
- Used in: nothing (end product)

**Satellite** `cn_43` — program
- Recipe: (Tricoder) + (Tech Voxel) + (AI Core)
- Made in: Satellite Control Complex (g3)
- Used in: nothing (end product)

**Transhuman Form** `serviceres_02` — program
- Recipe: (Cyberware) + (AI Core)
- Made in: Evolution Center (g3)
- Used in: nothing (end product)

## Buildings

### Services

**General quarters** `b_accomm_01` — tier 0, Accommodation
- Build cost: (Iron | Aluminum) + (Silicon | Sulfur)

**Resource Allocation Center** `b_production_01` — tier 0, Storage
- Build cost: (Iron | Aluminum | Titanium)

**Medical Center** `b_service_02` — tier 1, Treatment
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Biochem Compounds)

**Bioconversion Lab** `b_service_09` — tier 1, Waste Managment
- Crafts: Bio Cell (g1), Biopolymer (g1), Biochem Compounds (g1)
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Composite Enzymes)

**Geo Lab** `b_service_10` — tier 1, Waste Managment
- Crafts: Basic Extractor (g1), Fuel Cell (g1)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic) + (Basic Toolkit)

**Residential Complex** `b_accomm_02` — tier 2, Accommodation
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer)

**Health and Care Center** `b_service_01` — tier 2, Treatment
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Med Gel)

**Social dome** `b_service_03` — tier 2, Treatment
- Build cost: (Alloyed Metal | Metal Constructions) + (Thermoplastic) + (Modular Container)

**Institute** `b_service_05` — tier 2, Special Sysytem
- Build cost: (Alloyed Metal | Mycobrick) + (Biopolymer | Thermoplastic) + (Nano Parts)

**Holodeck** `b_service_06` — tier 3, Special Sysytem
- Build cost: (Alloyed Metal | Metal Constructions) + (AI Core) + (Tech Voxel)

**Alliance Center** `b_service_07` — tier 3, Special Sysytem
- Build cost: (Alloyed Metal | Metal Constructions) + (Thermoplastic | Biopolymer)

### Other

**Biowaste Dump** `b_dump_bio` — tier 0, Storage

**Manufactured Waste Dump** `b_dump_manufactured` — tier 0, Storage

### Energy

**Generator** `b_energy_03` — tier 0, Energy
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Tech Assembly Matrix)

**Solar Panels** `b_energy_11` — tier 0, Energy
- Build cost: (Metal Constructions | Mycobrick) + (Silicon) + (Tech Assembly Matrix)

**Small Energy Accumulator** `b_energy_12` — tier 0, Battery
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Sodium | Lithium)

**Energy Accumulator** `b_energy_08` — tier 1, Battery
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic) + (Sodium | Lithium)

**Cyclone Energy Turbine** `b_energy_06` — tier 2, Renewable Energy
- Build cost: (Alloyed Metal | Metal Constructions) + (Nano Parts | Propulsion Kit) + (Tech Assembly Matrix)

**Solar Reactor** `b_energy_07` — tier 3, Renewable Energy
- Build cost: (Metal Constructions | Mycobrick) + (Battery Block | Sensors Array) + (Tech Assembly Matrix)

**Fusion Core Unit** `b_energy_09` — tier 3, Energy
- Build cost: (Metal Constructions | Mycobrick) + (Tech Voxel | Portable Force Shield) + (Tech Assembly Matrix)

**Antimatter Core Unit** `b_energyprogram_t5_01` — tier 5, Energy
- Build cost: (Metal Constructions | Mycobrick) + (Portable Force Shield) + (Tech Assembly Matrix)

### Advanced Tech

**Artifacts Lab** `b_exploration_01` — tier 0, Special Sysytem
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer) + (Basic Toolkit)

**Hi-Tech Facility** `b_production_t4_01` — tier 4, Production
- Crafts: AI Core (g3), Surveying Probe (g2), Cyberware (g2)
- Build cost: (Alloyed Metal | Metal Constructions) + (Basic Scanner | Nano Parts)

**Experimental Materials Facility** `b_production_t4_02` — tier 4, Production
- Crafts: Surveying Probe (g3), Tech Assembly Matrix (g3), Fusion Cell (g2)
- Build cost: (Metal Constructions | Alloyed Metal) + (Microcontrollers | Battery Block)

**Robotics Facility** `b_production_t4_03` — tier 4, Production
- Crafts: Fusion Cell (g3), Cyberware (g3), AI Core (g2)
- Build cost: (Metal Constructions) + (Battery Block | Nano Parts)

**Advanced Wares Facility** `b_production_t4_04` — tier 4, Production
- Crafts: Tech Assembly Matrix (g2), Multi-Tool (g2), D.A.R.T. (g2)
- Build cost: (Mycobrick | Thermoplastic) + (Microcontrollers | Nano Parts)

**Evolution Center** `b_evolutionprogram_t5_01` — tier 5, Production
- Crafts: Transhuman Form (g3)
- Build cost: (Thermoplastic | Biopolymer) + (Multi-Tool) + (AI Core)

**Satellite Control Complex** `b_explorationprogram_t5_01` — tier 5, Special Sysytem
- Crafts: Satellite (g3)
- Build cost: (Metal Constructions | Alloyed Metal) + (Tech Voxel) + (Tricoder)

**Advanced Technology Center** `b_powerprogram_t5_01` — tier 5, Production
- Crafts: Positron Cell (g3)
- Build cost: (Mycobrick | Alloyed Metal) + (Tech Voxel) + (Fusion Cell)

### Ship Systems

**Hangar** `b_fleet_02` — tier 0, Neutral
- Crafts: Freighter (g3), Recon Craft (g3), Deep-Sea Trawler (g3), Worker Drone (g3)
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer)

**Power Unit** `shipsystem_01` — tier 0, Neutral

**Sensor System** `shipsystem_02` — tier 0, Neutral

**Engine** `shipsystem_03` — tier 0, Neutral

**Mass Driver** `shipsystem_04` — tier 0, Neutral

**R&D Lab** `shipsystem_05` — tier 0, Exploration

### Workshop

**Tools Workshop** `b_production_t1_01` — tier 1, Production
- Crafts: Basic Toolkit (g3), Conductive Materials (g3), Metal Constructions (g1), Standard Ammunition Pack (g1)
- Build cost: (Iron | Aluminum) + (Chromium | Copper | Carbon)

**Electronics Workshop** `b_production_t1_02` — tier 1, Production
- Crafts: Electronic Components (g3), Conductive Materials (g2), Alloyed Metal (g2)
- Build cost: (Iron | Aluminum) + (Silicon | Copper)

**Repairs Workshop** `b_production_t1_03` — tier 1, Production
- Crafts: Thermoplastic (g3), Alloyed Metal (g3), Basic Toolkit (g1)
- Build cost: (Iron | Titanium) + (Chromium | Copper)

**Processing Workshop** `b_production_t1_04` — tier 1, Production
- Crafts: Metal Constructions (g3), Nanomaterials (g2), Electronic Components (g2)
- Build cost: (Iron | Titanium) + (Chromium | Copper)

**Synthesis Workshop** `b_production_t1_05` — tier 1, Production
- Crafts: Composite Enzymes (g3), Nanomaterials (g3), Protein Mass (g1)
- Build cost: (Iron | Aluminum) + (Silicon | Chromium)

**Compounds Workshop** `b_production_t1_06` — tier 1, Production
- Crafts: Biopolymer (g3), Biochem Compounds (g3), Alloyed Metal (g1)
- Build cost: (Iron | Aluminum) + (Sulfur | Silicon)

**Chemistry Workshop** `b_production_t1_07` — tier 1, Production
- Crafts: Chemical Fuel (g3), Standard Ammunition Pack (g3), Composite Enzymes (g1), Mycobrick (g1)
- Build cost: (Iron | Aluminum) + (Sulfur | Carbon)

**Bioengineering Workshop** `b_production_t1_08` — tier 1, Production
- Crafts: Protein Mass (g3), Mycobrick (g3), Biochem Compounds (g2)
- Build cost: (Iron | Aluminum) + (Carbon | Silicon)

**Farm** `b_production_t1_09` — tier 1, Production
- Crafts: Grain (g3), Cultured Meat (g2), Biopolymer (g1)
- Build cost: (Iron | Aluminum) + (Phosphorus | Carbon | Silicon)

**Plantation** `b_production_t1_10` — tier 1, Production
- Crafts: Cultured Meat (g3), Omni Fruit (g2), Thermoplastic (g2)
- Build cost: (Iron | Aluminum) + (Sulfur | Phosphorus | Silicon)

**Universum** `b_production_t1_11` — tier 1, Production
- Crafts: Omni Fruit (g3), Grain (g2), Chemical Fuel (g2)
- Build cost: (Iron | Aluminum) + (Silicon | Carbon | Phosphorus)

### Defense

**Gatling Gun** `b_survival_02` — tier 1, Weapon
- Build cost: (Iron | Aluminum) + (Titanium) + (Sulfur)

**Grenade Launcher** `b_survival_04` — tier 1, Weapon
- Build cost: (Thermoplastic | Alloyed Metal) + (Biopolymer | Mycobrick) + (Basic Toolkit)

**Flamethrower** `b_survival_06` — tier 1, Weapon
- Build cost: (Titanium) + (Silicon) + (Chromium | Tungsten)

**Power Bolt Emitter** `b_survival_01` — tier 2, Weapon
- Build cost: (Thermoplastic | Biopolymer) + (Metal Constructions) + (Electronic Components)

**Photon Gun** `b_survival_03` — tier 2, Weapon
- Build cost: (Metal Constructions) + (Thermoplastic | Biopolymer) + (Conductive Materials)

**Active defense system** `b_survival_05` — tier 3, Weapon
- Build cost: (Metal Constructions | Alloyed Metal) + (Sensors Array) + (Nano Parts)

**Power Barrier** `b_survival_07` — tier 3, Weapon
- Build cost: (Metal Constructions | Mycobrick) + (Battery Block) + (Eldritium)

**Sonic Pulse System** `b_survival_08` — tier 3, Weapon
- Build cost: (Mycobrick | Thermoplastic) + (Microcontrollers) + (Propulsion Kit)

**Static Field** `b_survival_09` — tier 3, Weapon
- Build cost: (Metal Constructions | Alloyed Metal) + (Battery Block) + (Nano Parts)

### Factory

**Electronics Factory** `b_production_t2_01` — tier 2, Production
- Crafts: Microcontrollers (g3), Nano Parts (g2), Basic Scanner (g1), Sensors Array (g1)
- Build cost: (Alloyed Metal | Thermoplastic) + (Nanomaterials | Biopolymer)

**Pyrogenics Factory** `b_production_t2_02` — tier 2, Production
- Crafts: Explosive Charges (g3), Basic Extractor (g3), Fuel Cell (g1), Battery Block (g1)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Thermoplastic)

**Nano-Tech Factory** `b_production_t2_03` — tier 2, Production
- Crafts: Nano Parts (g3), Propulsion Kit (g3), Personal Defence Kit (g1)
- Build cost: (Alloyed Metal | Metal Constructions) + (Nanomaterials | Basic Toolkit)

**Prototype Development Factory** `b_production_t2_04` — tier 2, Production
- Crafts: Basic Scanner (g3), Fuel Cell (g3), Propulsion Kit (g1), Explosive Charges (g1)
- Build cost: (Alloyed Metal | Metal Constructions) + (Nanomaterials | Thermoplastic)

**Container Factory** `b_production_t2_05` — tier 2, Production
- Crafts: Modular Container (g3), Basic Extractor (g2), Microcontrollers (g1)
- Build cost: (Alloyed Metal | Metal Constructions) + (Mycobrick | Thermoplastic)

**Expedition Research Factory** `b_production_t2_06` — tier 2, Production
- Crafts: Personal Defence Kit (g3), Basic Extractor (g2), Nutrient Paste (g2)
- Build cost: (Alloyed Metal | Metal Constructions) + (Biopolymer | Thermoplastic)

**Energy Research Factory** `b_production_t2_07` — tier 2, Production
- Crafts: Bio Cell (g3), Energy Bar (g2), Med Gel (g2)
- Build cost: (Biopolymer | Thermoplastic) + (Mycobrick | Alloyed Metal)

**Component Factory** `b_production_t2_08` — tier 2, Production
- Crafts: Sensors Array (g3), Battery Block (g3), Modular Container (g1)
- Build cost: (Mycobrick | Alloyed Metal) + (Thermoplastic | Nanomaterials)

**Medical Goods Factory** `b_production_t2_09` — tier 2, Production
- Crafts: Med Gel (g3), Stem Tissue (g3), Bio Cell (g1)
- Build cost: (Mycobrick | Alloyed Metal) + (Biopolymer | Thermoplastic)

**Food Factory** `b_production_t2_10` — tier 2, Production
- Crafts: Nutrient Paste (g3), Energy Bar (g3), Stem Tissue (g1)
- Build cost: (Mycobrick | Metal Constructions) + (Thermoplastic | Biopolymer)

### Plant

**Nasobi Building** `b_locals_t3_01` — tier 3, Production
- Crafts: Fruit Paste (g3), Krill Paste (g3), Basic Extractor (g1)
- Build cost: (Metal Constructions) + (Thermoplastic | Biopolymer)

**Aetherid Building** `b_locals_t3_02` — tier 3, Production
- Crafts: Krill Preserves (g3), Energy Bar (g3), Portable Force Shield (g1)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal)

**Crabari Building** `b_locals_t3_03` — tier 3, Production
- Crafts: Nutrient Paste (g3), Krill Paste (g3), Omni-Meal (g1)
- Build cost: (Mycobrick | Alloyed Metal)

**Mistralid Building** `b_locals_t3_04` — tier 3, Production
- Crafts: Algae Preserves (g3), Fruit Paste (g3), Med Kit (g1)
- Build cost: (Mycobrick) + (Biopolymer)

**Knidaria Building** `b_locals_t3_05` — tier 3, Production
- Crafts: Algae Preserves (g3), Krill Preserves (g3), Comm-Link (g1)
- Build cost: (Thermoplastic) + (Biopolymer)

**Advanced Tools Plant** `b_production_t3_01` — tier 3, Production
- Crafts: Tricoder (g3), Tech Voxel (g3), Smart Ammunition Pack (g3), Underground Deposit Extractor (g2)
- Build cost: (Alloyed Metal | Biopolymer) + (Nanomaterials | Thermoplastic)

**Expedition Plant** `b_production_t3_02` — tier 3, Production
- Crafts: Portable Force Shield (g3), D.A.R.T. (g3), Underground Deposit Extractor (g2), Tech Voxel (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Alloyed Metal | Biopolymer)

**Smart Tools Plant** `b_production_t3_03` — tier 3, Production
- Crafts: Multi-Tool (g3), Comm-Link (g3), Smart Ammunition Pack (g2), D.A.R.T. (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic)

**Tactical Production Plant** `b_production_t3_04` — tier 3, Production
- Crafts: Underground Deposit Extractor (g3), Med Kit (g2), Multi-Tool (g2), Portable Force Shield (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Thermoplastic | Biopolymer)

**Consumer Goods Plant** `b_production_t3_05` — tier 3, Production
- Crafts: Med Kit (g3), Omni-Meal (g3), Comm-Link (g2), Tricoder (g2)
- Build cost: (Metal Constructions | Mycobrick) + (Biopolymer | Thermoplastic)
