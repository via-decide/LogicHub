# Verified ZIP Inventory — 14 Created Bundles

This document preserves the verified progress summary for all research ZIP files created so far.

## 1. Electronics research bundle

**Bundle file:** `bundles/electronics_research_bundle.zip`  
**SHA-256:** `4368b952dfca124edb7951cc0f795501f19b59c5806f8d562003ccd0926a99fc`  
**Role:** Foundation study bundle for electronics, SiC MOSFETs, and embedded Linux.

**Done work:** Combined two technical reports into one downloadable bundle: SiC MOSFET Basics and Embedded Linux Engineering Report, with a README for navigation.

**Key finding:** This is a learning/research bundle, not a product bundle. It supports the electronics foundation: power-device behavior, embedded Linux architecture, boot chain, kernel/userspace, drivers, and deployment logic.

**Important safety finding:** SiC MOSFET work is high-risk when moved from theory to hardware because fast switching, high voltage, high dV/dt, thermal design, gate-drive mistakes, and layout parasitics can destroy parts or create shock/fire hazards.

**Important limitation:** No schematics, KiCad files, BOM, PCB, test jig, or CAD assets are included. It is source study material only.

**Production use:** learning pack → lab standard → design checklist

**Key production part:** future power boards, embedded Linux boards, lab fixtures

---

## 2. Air-gapped 8MB module research pack

**Bundle file:** `bundles/air_gapped_8mb_module_research_pack.zip`  
**SHA-256:** `9e3aa6009d51e579d2dd761142a23f1cbca5a8c74552585dcd7e2c6086584032`  
**Role:** Architecture research for offline cartridge, manifest, local-first storage, and integrity.

**Done work:** Created a deep research pack for the ATmega328P + W25Q64 8MB SPI NOR cartridge concept. Included architecture, firmware protocol, manifest/integrity model, power-tree and level-shifting notes, BOM freeze, KiCad requirements, PCBA test plan, threat model, validation plan, schemas, cost model, compliance checklist, and enclosure DFM notes.

**Key finding:** The module is feasible as an offline storage cartridge / manifest token / rule asset holder / integrity-checked local state anchor, but not as a modern AI/LLM compute device. The 8MB flash is useful for manifests, logs, policies, rule tables, receipts, and firmware assets.

**Important safety finding:** The main engineering risk is silent data corruption from brownout, partial writes, floating flash control pins, level-shifting mistakes, and unsafe commit logic.

**Important limitation:** This research pack is not a fabrication package. It does not contain finished KiCad schematics, verified Gerbers, or enclosure STEP files.

**Production use:** concept → cartridge protocol → offline hardware module

**Key production part:** 8MB cartridge, reader board, manifest firmware

---

## 3. Air-gapped 8MB CAD implementation bundle

**Bundle file:** `bundles/airgap8mb_cad_implementation_bundle.zip`  
**SHA-256:** `c761ddf3a66e65ccf18ad0bba8fd1db6f96a7d04b8b9c4434c39759546ee7d78`  
**Role:** First EVT/CAD implementation of the 8MB module.

**Done work:** Created an EVT-style CAD/implementation bundle with preliminary KiCad project files, schematic placeholder, PCB layout, Gerber-like manufacturing outputs, drill file, BOM CSV, firmware scaffold, host validation tool, storage protocol, OpenSCAD enclosure, STL/STEP reference envelopes, DFM checklist, EVT test plan, PCBA test plan, cartridge manifest schema, and risk register.

**Key finding:** Prototype planning can start from this bundle, but it is not ready for commercial production. It frames the device as a physical offline storage cartridge with deterministic flash-object handling.

**Important safety finding:** The design must protect against power-loss corruption, 5V/3.3V interface mistakes, incorrect flash writes, USB serial misuse, and brownout during manifest update.

**Important limitation:** The Gerbers and STEP files are preliminary/reference outputs, not KiCad-verified or CAD-manufacturing-certified. Do not send them directly to a PCB factory without ERC/DRC, footprint validation, supplier review, and regenerated outputs.

**Production use:** EVT prototype → KiCad correction → test fixture → supplier-ready rev

**Key production part:** PCB, enclosure, firmware, fixture

---

## 4. Drone CAD implementation bundle

**Bundle file:** `bundles/drone_cad_implementation_bundle.zip`  
**SHA-256:** `a737bc7c994c6ef5694ad680a248c748f2f0fc07072d84a20763785e193764c5`  
**Role:** Bounded drone flight-controller EVT platform.

**Done work:** Created a drone flight-controller EVT bundle with preliminary KiCad files, Gerber-like outputs, drill file, STM32-based FC architecture, IMU/barometer/flash/USB/SWD/UART/ESC net contract, firmware bring-up scaffold, blackbox flash protocol, target manifest, enclosure/frame OpenSCAD, STL/STEP reference files, India drone-rule notes, DFM checklist, tether-test plan, EVT bench-test plan, schemas, BOM, cost model, and validation tooling.

**Key finding:** The safe first product is not a complete autonomous drone; it is a flight-controller module + logging + validation fixture + tethered test platform.

**Important safety finding:** Untethered flight is not safe from this bundle. Propellers, LiPo batteries, failsafe behavior, IMU calibration, ESC behavior, RF link loss, and motor arming logic must be validated before any real flight.

**Important limitation:** The board files are preliminary and not factory-ready. It does not provide a flight-certified product, finished ESC design, RF system, GPS/autonomy stack, or regulatory-compliant drone.

**Production use:** flight-controller research → tethered validation → drone electronics platform

**Key production part:** FC PCB, firmware, tether fixture, motor-safety state machine

---

## 5. Pupper V3 open-source research bundle

**Bundle file:** `bundles/pupper_v3_open_source_research_bundle.zip`  
**SHA-256:** `44222fba357613f6f7dac4a7ef50d5246d74acc1e7154cf9febee068e051b8ea`  
**Role:** Open-source quadruped robot research and productization study.

**Done work:** Created a Pupper V3 research bundle with deep report, official docs summary, Pupper V3 monorepo summary, older StanfordQuadruped summary, architecture maps, BOM/CAD intake plan, build/validation plan, productization strategy, prior-work integration, next-phase tasks, source manifest, evidence table, bibliography, and original Instagram context image. It also bundled prior generated 8MB/drone ZIPs for cross-project continuity.

**Key finding:** The older StanfordQuadruped repo points to Pupper v1 as end-of-life and describes Pupper V3 as the current direction; the current software authority is the Pupper V3 monorepo and ROS2 workspace. The neural controller is built around real-time ROS2 control and avoids Torch-style runtime latency/jitter in the control loop.

**Important safety finding:** Pupper has real moving legs, torque, pinch/contact hazards, motor heating, battery risk, and E-stop requirements. It also needs careful battery-voltage monitoring because the operating docs noted no hardware low-voltage cutoff in the prior research pass.

**Important limitation:** The bundle does not embed official CAD, PCB manufacturing files, BOM spreadsheets, Onshape/Fusion exports, or kit supplier assets. Those must be downloaded directly from official sources and pinned by version/hash.

**Production use:** robot kit research → safe quadruped build process → local service/education platform

**Key production part:** power system, leg actuator safety, calibration workflow

---

## 6. FarmBot open-source research bundle

**Bundle file:** `bundles/farmbot_open_source_research_bundle.zip`  
**SHA-256:** `a87012f67d79b8ec534c355d4c452396a06d67099c1413d48cc6cb71acb724b7`  
**Role:** Agriculture automation, CNC-style gantry, electronics, firmware, web app, and tool ecosystem.

**Done work:** Created a FarmBot bundle with deep research report, architecture map, GitHub repository map, CAD/BOM/manufacturing intake plan, software stack analysis, LogicHub/GN8R tasks, risk register, licensing/commercialization notes, validation plan, India productization strategy, prior-project alignment, source manifest, JSON schema, graph seed, and README.

**Key finding:** FarmBot is one of the strongest wide-domain open-source hardware/software products because it joins mechanics, electronics, firmware, web app, APIs, agriculture automation, and commercial open-source positioning in one ecosystem.

**Important safety finding:** The machine combines outdoor power, moving gantry axes, belts, water/irrigation, tools, and user-accessible garden operation. Any India-local version needs electrical isolation, cable routing, weatherproofing, emergency stop, stall detection, and safe toolhead rules.

**Important limitation:** Official CAD exports, full production drawings, live BOM, and fabrication files were not embedded. The bundle is a source-intake/research package, not a verified fabrication archive.

**Production use:** agricultural robot → field kit → serviceable MSME product

**Key production part:** outdoor electronics box, toolhead dock, gantry safety, service app

---

## 7. OpenFlexure Microscope research bundle

**Bundle file:** `bundles/openflexure_microscope_research_bundle.zip`  
**SHA-256:** `2a731647de578b185734eca5634676e971c94765bffb9d8ac23a36dd66685c8b`  
**Role:** Open-source lab microscope and precision positioning platform.

**Done work:** Created an OpenFlexure bundle with deep research report, system architecture map, source/repository map, CAD/BOM/manufacturing intake plan, software/API analysis, optics/mechanics/electronics analysis, LogicHub/GN8R tasks, risk register, licensing/commercial/regulatory notes, validation test plan, India productization strategy, prior-project alignment, source manifest, file hashes, JSON schemas, graph seed, Python validation receipt scaffold, and source-intake hash script.

**Key finding:** OpenFlexure is a strong lab-hardware target because it combines 3D-printed precision mechanics, optics, Raspberry Pi control, microscope software, and reproducible scientific-instrument documentation.

**Important safety finding:** The biggest risk is not high-force mechanical danger; it is false measurement confidence. Optical calibration, stage accuracy, illumination, sample handling, contamination, and diagnostic claims must be controlled.

**Important limitation:** It is not automatically a medical or diagnostic product. The bundle does not embed official STL/source ZIPs or SD-card images; those must be pulled from OpenFlexure’s official build/documentation sources and hashed.

**Production use:** lab instrument → validated education/lab kit → calibration service

**Key production part:** optics calibration, stage validation, sample interface, local software

---

## 8. SatNOGS satellite ground-station research bundle

**Bundle file:** `bundles/satnogs_ground_station_research_bundle.zip`  
**SHA-256:** `4c421c8d7d5b5f5f62f1d2f048af64576a329031ef46e7e97160e9db5e550219`  
**Role:** Open satellite ground-station stack: antenna, SDR, Linux station, observation workflow.

**Done work:** Created a SatNOGS bundle with deep research report, architecture map, repository map, RF hardware/CAD/BOM intake plan, software stack analysis, validation plan, India regulatory/safety notes, risk register, commercialization strategy, prior-project alignment, license/contribution notes, bibliography, reference BOM, CAD-intake folder, graph seed, observation receipt schema, station config schema, source manifest schema, RTL-SDR smoke-test script, hashing script, observation-receipt validator, and GN8R tasks.

**Key finding:** The best first product is a receive-only fixed SatNOGS learning station, not a transmit station or rotator-first product. This keeps RF/legal risk lower and validates antenna, SDR, Linux service, observation workflow, and station evidence first.

**Important safety finding:** RF transmit capability, mast/antenna mounting, lightning protection, outdoor cabling, rotator pinch/load risk, and local spectrum rules matter. Receive-only is safer, but still needs grounding and weatherproofing.

**Important limitation:** No official SatNOGS CAD, rotator files, firmware images, station images, or manufacturing files are embedded. The bundle is a research/intake package.

**Production use:** receive-only learning station → RF education kit → observatory appliance

**Key production part:** antenna/SDR box, rotator fixture, grounding/weather enclosure

---

## 9. Voron 3D printer engineering bundle

**Bundle file:** `bundles/voron_3d_printer_engineering_bundle.zip`  
**SHA-256:** `654c3e0a12b9dde6aae6cb0c67edd26363d6d113ba1f4d4bc5e4e0b24a8eb8fa`  
**Role:** High-performance open-source 3D printer engineering and kit/productization study.

**Done work:** Created a Voron bundle with deep research report, printer-family architecture map, source/repository map, CAD/STL/BOM/manual/config intake plan, Klipper software/firmware stack analysis, validation and commissioning plan, risk register, GPLv3 commercialization notes, India productization strategy, LogicHub/GN8R tasks, prior-project alignment, source manifest, schemas, relationship graph seed, hashing script, and asset-manifest validator.

**Key finding:** The best first engineering target is Voron Trident 300 for serious CoreXY productization study, while Voron 0.2r1 is better for compact/low-cost kit workflow study. Voron Trident’s repo identifies recommended sizes of 250×250×250, 300×300×250, and 350×350×250. Voron Zero V0.2r1 is compact, CoreXY, enclosed, 24V bed, Klipper-based, and 120×120×120 build volume.

**Important safety finding:** Voron-class machines involve heaters, hotend, heated bed, enclosed chamber, mains/24V wiring, moving CoreXY gantry, firmware configuration, thermal runaway protection, and printed-part quality.

**Important limitation:** Official CAD, STL, manuals, panel DXFs, and printer configs were not embedded. Those must be downloaded from official VoronDesign sources and pinned by release/commit.

**Production use:** kit workflow → printer QA → localized manufacturing and service

**Key production part:** power box, heater safety, chamber design, calibration procedure

---

## 10. OpenEVSE research bundle

**Bundle file:** `bundles/openevse_research_bundle.zip`  
**SHA-256:** `62eec6401ac1dd934d1145c54ceff773b7773b502b3ab5bc96f03de61b8f95b8`  
**Role:** Open EV charging hardware/software platform.

**Done work:** Created an OpenEVSE bundle with deep research report, architecture map, repository map, hardware/CAD/BOM intake plan, firmware/software stack analysis, India safety/compliance notes, validation and commissioning plan, risk register, licensing/commercialization notes, LogicHub/GN8R tasks, prior-project alignment, bibliography, source manifest, file hashes, JSON schemas, graph seed, read-only RAPI probe scaffold, HTTP API probe scaffold, validation receipt generator, BOM/test/cost templates.

**Key finding:** OpenEVSE has a good architecture split: safety-critical EVSE controller below, ESP32 WiFi/API/MQTT/OCPP/web UI above. The ESP32 firmware README says the gateway communicates with the controller over serial RAPI and serves the web UI locally.

**Important safety finding:** The safety docs list diode check, GFCI self-test, ground monitoring, stuck-relay detection, vent-required detection, and temperature monitoring as controller safety checks. A faulted charger must not be commandable into charging.

**Important limitation:** This is not a fabrication-ready EV charger. Mains voltage, earth/ground protection, GFCI behavior, relay/contactors, enclosure, thermal behavior, EV standards, and India electrical compliance require qualified engineering review and certification.

**Production use:** EVSE research → certified charger pathway → service platform

**Key production part:** safety controller, GFCI/relay logic, enclosure, test fixture

---

## 11. OpenMV + OpenIPC local vision bundle

**Bundle file:** `bundles/openmv_openipc_local_vision_bundle.zip`  
**SHA-256:** `63562164e15bd706db17eb684cde42cf48682070c5e799e6f7fdf093a8eb769c`  
**Role:** Local-first camera/vision appliance stack.

**Done work:** Created a local-first vision bundle covering OpenMV and OpenIPC with deep research report, OpenMV architecture analysis, OpenIPC architecture analysis, local-first system architecture diagrams, privacy/data-flow boundary model, firmware/IDE/RPC/board intake plan, camera firmware/streaming/flashing intake plan, validation matrix, reliability matrix, India productization strategy, monetization model, licensing notes, LogicHub/GN8R tasks, prior-project alignment, source manifest, file hashes, JSON schemas, USB VCP probe, RTSP/HTTP snapshot probes, validation receipt generator, BOM/device/privacy templates.

**Key finding:** Treat this as a two-layer local vision appliance, not one merged firmware project. OpenMV is best for MCU-class AI/event detection and control loops; OpenIPC is best for replacing opaque IP-camera firmware with local/open camera firmware. OpenMV’s README describes Python3 programmability, TensorFlow/ST Edge AI/NPU support, QR/barcode decoding, AprilTag recognition, MJPEG/GIF, and streaming. OpenIPC describes itself as alternative open firmware for IP cameras based on Buildroot.

**Important safety finding:** The core safety issue is privacy/security, not physical force. Camera firmware can leak video, expose credentials, or create surveillance risk. Flashing unsupported IP-camera hardware can also brick devices.

**Important limitation:** No official firmware binaries, camera images, vendor blobs, OpenMV/OpenIPC source archives, or CAD files are embedded. OpenMV also needs a file-level license review because its README notes MIT code plus GPL image code, third-party licenses, and proprietary/non-commercial components.

**Production use:** camera appliance → local AI vision node → privacy-first monitoring

**Key production part:** camera module, firmware image, local dashboard, privacy proof

---

## 12. BeagleV-Fire / Milk-V Duo RISC-V edge bundle

**Bundle file:** `bundles/riscv_edge_beaglev_fire_milkv_duo_bundle.zip`  
**SHA-256:** `d8e8d1538ec0760ad1d79aa9d108f65da7ad7fe860e294cba2e06325751c60c1`  
**Role:** RISC-V edge computing, FPGA, AIoT, embedded Linux, deterministic IO.

**Done work:** Created a RISC-V edge bundle with deep research report, architecture maps, source/repository map, hardware/CAD/BOM intake plan, firmware/software stack analysis, edge AI + FPGA use-case map, validation plan, security/reliability risk register, license/commercialization notes, India productization strategy, LogicHub/GN8R tasks, prior-project alignment, bibliography, source manifest, JSON schemas, graph seed, board probe script, GPIO smoke test, benchmark script, and BOM/CAD/compliance/benchmark templates.

**Key finding:** These are two different product paths. BeagleV-Fire is for RISC-V + FPGA/gateware, deterministic IO, and custom accelerators; its README describes 4× RV64GC application cores, 1× RV64IMAC monitor/boot core, and FPGA fabric. Milk-V Duo is better for low-cost AIoT, camera, sensor, and embedded Linux/RTOS-style edge products.

**Important safety finding:** Main risks are power integrity, thermal throttling, firmware-image provenance, peripheral-voltage mistakes, insecure default network services, and unverified boot/update flows.

**Important limitation:** The ZIP does not embed official schematics, CAD, firmware images, FPGA bitstreams, SDK tarballs, Linux images, or vendor binaries. These must be downloaded, pinned, hashed, and license-reviewed.

**Production use:** edge compute carrier → local AI/automation gateway → deterministic hardware node

**Key production part:** carrier board, boot image, edge runtime, validation fixture

---

## 13. Precious Plastic machine ecosystem bundle

**Bundle file:** `bundles/precious_plastic_machine_ecosystem_bundle.zip`  
**SHA-256:** `6ec1ff6c458f6f6fc6fa8af8e5b0ac494c46e6c7133cd7d0dc0c0af066133465`  
**Role:** Plastic recycling and small manufacturing machine ecosystem.

**Done work:** Created a Precious Plastic bundle with deep research report, ecosystem architecture map, basic/pro machine family map, CAD/BOM/manufacturing intake plan, materials/process/QC notes, workspace/business model, India productization strategy, safety/compliance risk register, validation and commissioning plan, licensing notes, LogicHub/GN8R tasks, prior-project alignment, bibliography, source manifest, file hashes, JSON schemas, relationship graph, source-intake templates, BOM template, material batch log, process run log, safety checklist, hashing script, and validation receipt script.

**Key finding:** The best product path is a verified recycling workspace, not immediate machine resale. Injection workspace, sheetpress product experiments, and process-quality services are safer first steps than selling shredder/pro machines.

**Important safety finding:** Shredders/extruders/injection/compression machines involve blades, high torque, pinch points, hot barrels, fumes, heaters, motors, VFDs, 230/400V wiring, guarding, and material contamination hazards.

**Important limitation:** Official CAD, STEP/F3D, DXF, schematics, manuals, and Google Drive machine packs were not embedded. They must be downloaded from official sources and hashed before fabrication.

**Production use:** verified recycling workspace → product experiments → machine service/build business

**Key production part:** control box, guard system, heater/motor controller, safety checklist

---

## 14. NASA JPL Rover / OpenAMRobot research bundle

**Bundle file:** `bundles/nasa_jpl_rover_openamrobot_research_bundle.zip`  
**SHA-256:** `795cfeaac0a36d245602253e459e977425c2a12037266a382eb0ad3304e421ed`  
**Role:** Rover mechanics + modern AMR/ROS2 robot stack.

**Done work:** Created a combined rover/mobile-robot bundle with deep research report, architecture comparison, NASA JPL OSR source map, OpenAMRobot source map, CAD/BOM/manufacturing intake plan, software/firmware stack analysis, validation and commissioning plan, safety/compliance risk register, India productization strategy, licensing notes, LogicHub/GN8R tasks, prior-project alignment, bibliography, source manifest, schemas, BOM/safety/test/graph templates, hashing script, and validation receipt script.

**Key finding:** These are two distinct robot paths. NASA JPL Open Source Rover is best for a six-wheel rocker-bogie rugged-terrain education/mechanics platform; its README describes it as a scaled-down Mars-rover-style robot made from COTS parts. OpenAMRobot is better for modern ROS2 AMR software, simulation, Nav2, UI, docking, firmware, and product-level repository structure.

**Important safety finding:** OpenAMRobot is still experimental. Its hardware README lists missing safety items: no 24V battery fuse, no battery-side disconnect/hardware E-stop, Pi 5 thermal throttling, Pi brownout risk, and warns that the firmware watchdog is not a substitute for physical E-stop. Its UI README also says the dashboard E-stop is only a software stop, not a latched or safety-rated independent stop.

**Important limitation:** No official CAD, Onshape exports, STEP files, firmware binaries, ROS workspaces, release archives, PCB files, or vendor datasheets were embedded. Those need upstream download, pinning, hashing, and safety validation before powered operation.

**Production use:** education rover → AMR prototype → local warehouse/logistics robot platform

**Key production part:** battery safety, E-stop, motor control, ROS2 commissioning, docking validation
