# Project-to-Tool Production Mapping

## 1. Electronics research bundle

**Main role:** Foundation study bundle for electronics, SiC MOSFETs, and embedded Linux.

| Useful tools | Where used | How |
|---|---|---|
| T06 Source Manifest | Research-to-build transition | Convert reports into traceable source ledger before using them for hardware design |
| T10 Thermal/Power Derating | SiC/power electronics learning | Build derating discipline before high-voltage or high-speed switching work |
| T12 QA Fixture | Lab exercises | Turn theory into repeatable bench tests |
| T14 Risk Ledger | Any derived hardware project | Separate learning claims from production-safe claims |

**Production use:** learning pack → lab standard → design checklist

**Key production part:** future power boards, embedded Linux boards, lab fixtures

## 2. Air-gapped 8MB module research pack

**Main role:** Architecture research for offline cartridge, manifest, local-first storage, and integrity.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Cartridge reader board | USB-C or protected 5V/3.3V power input |
| T02 Input FSM | Load/verify/commit button | Deterministic button behavior for cartridge operations |
| T03 Offline Telemetry | OLED/RGB status | Show cartridge loaded, verify, commit, error, rollback |
| T04 Poka-yoke Docking | Cartridge slot | Prevent upside-down or misaligned insertion |
| T05 Fault Fallbacks | SPI NOR read/write | Timeouts, watchdog reset, readable error state |
| T07 Storage Integrity | Flash object store | Dual manifest, CRC/SHA, atomic commit |
| T12 QA Fixture | Cartridge validation | Test read/write/verify/power-loss recovery |

**Production use:** concept → cartridge protocol → offline hardware module

**Key production part:** 8MB cartridge, reader board, manifest firmware

## 3. Air-gapped 8MB CAD implementation bundle

**Main role:** First EVT/CAD implementation of the 8MB module.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | PCB input and flash rails | Validate 5V/3.3V conversion and reverse protection |
| T04 Poka-yoke Docking | Enclosure and slot | Create foolproof cartridge insertion geometry |
| T05 Fault Fallbacks | Firmware scaffold | Watchdog + SPI error display |
| T07 Storage Integrity | NOR flash firmware | Atomic object-store layout |
| T12 QA Fixture | PCBA test | Continuity, flash ID, write/read/verify receipt |
| T13 Enclosure DFM | Cartridge case | Snap fit, guide rails, service access |

**Production use:** EVT prototype → KiCad correction → test fixture → supplier-ready rev

**Key production part:** PCB, enclosure, firmware, fixture

## 4. Drone CAD implementation bundle

**Main role:** Bounded drone flight-controller EVT platform.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | FC power input | Protected 5V/3.3V rails, brownout checks |
| T03 Offline Telemetry | LEDs/buzzer/OLED | Armed, disarmed, fault, IMU fail, logging states |
| T05 Fault Fallbacks | Sensor and flash handling | Watchdog, IMU timeout, blackbox flash fault |
| T08 Sensor Calibration | IMU/barometer | Calibration receipt before motor arming |
| T09 Motor Safety | ESC outputs | Arm gate, failsafe, motor inhibit |
| T10 Thermal/Power | LiPo/ESC/motor current | Runtime and thermal safety margins |
| T12 QA Fixture | Tether and bench test | No-prop test, signal test, IMU drift test |
| T14 Compliance Ledger | Drone rule boundary | Separate test fixture from flyable product |

**Production use:** flight-controller research → tethered validation → drone electronics platform

**Key production part:** FC PCB, firmware, tether fixture, motor-safety state machine

## 5. Pupper V3 open-source research bundle

**Main role:** Open-source quadruped robot research and productization study.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Battery and compute rails | Prevent brownout, unsafe undervoltage, reverse input |
| T03 Offline Telemetry | LCD / LED / debug UI | Show robot state, fault, controller mode |
| T05 Fault Fallbacks | ROS2/control loop | Watchdog when controller stalls |
| T08 Sensor Calibration | IMU/camera/motor zeroing | Baseline capture before walking |
| T09 Motor Safety | Leg actuators | E-stop, torque limit, safe pose, motor disable |
| T10 Thermal/Power | Motors and battery | Thermal derating, runtime limits |
| T11 Local API | Foxglove/ROS2 bridge | Local debugging and service interface |
| T12 QA Fixture | Robot commissioning | Leg direction, IMU, controller, gait test receipts |

**Production use:** robot kit research → safe quadruped build process → local service/education platform

**Key production part:** power system, leg actuator safety, calibration workflow

## 6. FarmBot open-source research bundle

**Main role:** Agriculture automation, CNC-style gantry, electronics, firmware, web app, and tool ecosystem.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Outdoor controller and motor power | Protected input, waterproof cable planning |
| T03 Offline Telemetry | Local field status | LED/OLED state for farm-side operation |
| T04 Poka-yoke Docking | Toolhead/tool mounting | Foolproof tool and cable connection |
| T05 Fault Fallbacks | Axis and tool commands | Stop on missed command, sensor timeout, motor fault |
| T08 Sensor Calibration | Axis homing, soil/camera tools | Calibration receipts for repeatable planting |
| T09 Motor Safety | Gantry movement | Endstop, stall, obstruction, emergency stop |
| T11 Local API | FarmBot app / local bridge | Service without cloud dependency |
| T13 Environmental DFM | Outdoor enclosure | Dust, water, UV, cable strain relief |

**Production use:** agricultural robot → field kit → serviceable MSME product

**Key production part:** outdoor electronics box, toolhead dock, gantry safety, service app

## 7. OpenFlexure Microscope research bundle

**Main role:** Open-source lab microscope and precision positioning platform.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Raspberry Pi / motor / illumination | Stable power for imaging and motion |
| T03 Offline Telemetry | Local UI/status LEDs | Capture state, focus state, error state |
| T04 Poka-yoke Geometry | Sample holder/objective mounts | Prevent wrong orientation or lens collision |
| T08 Sensor Calibration | Optics/stage/illumination | Calibration image, resolution target, stage repeatability |
| T11 Local API | Microscope server/API | Local-first lab control |
| T12 QA Fixture | Optical validation | Resolution, focus, repeatability receipts |
| T14 Risk Ledger | Diagnostic boundary | Prevent unsupported medical/diagnostic claims |

**Production use:** lab instrument → validated education/lab kit → calibration service

**Key production part:** optics calibration, stage validation, sample interface, local software

## 8. SatNOGS satellite ground-station research bundle

**Main role:** Open satellite ground-station stack: antenna, SDR, Linux station, observation workflow.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Raspberry Pi, SDR, rotator | Stable outdoor station power |
| T03 Offline Telemetry | Station status | Signal, observation, network, fault LED/OLED |
| T05 Fault Fallbacks | SDR/client scripts | Restart failed observations, handle missing radio |
| T08 Sensor Calibration | RF chain / antenna / rotator | Frequency offset, signal baseline, pointing check |
| T10 Power/Thermal | Outdoor enclosure | Pi/SDR heat and power budget |
| T11 Local API | Station dashboard | Local station monitoring and logs |
| T13 Environmental DFM | Outdoor RF enclosure | Weatherproofing, grounding, cable strain relief |
| T14 Compliance Ledger | RF rules | Receive-only vs transmit-capable boundary |

**Production use:** receive-only learning station → RF education kit → observatory appliance

**Key production part:** antenna/SDR box, rotator fixture, grounding/weather enclosure

## 9. Voron 3D printer engineering bundle

**Main role:** High-performance open-source 3D printer engineering and kit/productization study.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | 24V/mains/control electronics | Fusing, grounding, protected input |
| T02 Input FSM | Panel/menu/encoder | Deterministic front-panel interaction |
| T03 Offline Telemetry | Display/LED/status | Heating, printing, fault, maintenance states |
| T05 Fault Fallbacks | Klipper/Moonraker/sensors | Heater fault, endstop fault, MCU disconnect |
| T08 Calibration | Bed mesh, input shaping, extrusion | Commissioning receipts |
| T09 Heater/Motor Safety | Hotend, bed, CoreXY gantry | Thermal runaway, motion inhibit |
| T10 Thermal/Power | Enclosed chamber | Wire gauge, PSU margin, airflow |
| T12 QA Fixture | Kit validation | Motion, extrusion, thermal, first-print receipt |
| T13 Enclosure DFM | Panels/printed parts | Chamber heat, serviceability |

**Production use:** kit workflow → printer QA → localized manufacturing and service

**Key production part:** power box, heater safety, chamber design, calibration procedure

## 10. OpenEVSE research bundle

**Main role:** Open EV charging hardware/software platform.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Control board and power supply | Isolation, fusing, protected low-voltage supply |
| T03 Offline Telemetry | Charger status UI | Charging, fault, GFCI, relay, temperature |
| T05 Fault Fallbacks | Controller/gateway | RAPI timeout, watchdog, safe disable |
| T09 Relay Safety | Contactor/relay/GFCI | Stuck relay, diode check, ground monitoring |
| T10 Thermal/Current | Charging current | Temperature throttle and load shaping |
| T11 Local API | ESP32 web/MQTT/OCPP | Local service and integration |
| T12 QA Fixture | EVSE commissioning | GFCI, pilot, relay, ground, temperature tests |
| T14 Compliance Ledger | EV charging | Standards, mains safety, India regulatory gates |

**Production use:** EVSE research → certified charger pathway → service platform

**Key production part:** safety controller, GFCI/relay logic, enclosure, test fixture

## 11. OpenMV + OpenIPC local vision bundle

**Main role:** Local-first camera/vision appliance stack.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Camera module/edge board | Stable 5V/3.3V camera supply |
| T03 Offline Telemetry | Camera status | Recording, detection, offline, privacy, fault |
| T05 Fault Fallbacks | Camera firmware/network | Reboot stream, recover failed capture |
| T08 Sensor Calibration | Lens, exposure, focus, AI threshold | Calibration receipt per deployment |
| T11 Local API | RTSP/HTTP/OpenMV VCP | Local-first vision control |
| T12 QA Fixture | Camera validation | Snapshot, latency, detection, privacy checks |
| T14 Risk Ledger | Privacy/security | No hidden cloud, no unsafe surveillance use |

**Production use:** camera appliance → local AI vision node → privacy-first monitoring

**Key production part:** camera module, firmware image, local dashboard, privacy proof

## 12. BeagleV-Fire / Milk-V Duo RISC-V edge bundle

**Main role:** RISC-V edge computing, FPGA, AIoT, embedded Linux, deterministic IO.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | SBC/edge module carrier | Power budget, brownout and reverse protection |
| T03 Offline Telemetry | Board status | Boot, service, thermal, network, fault |
| T05 Fault Fallbacks | Boot/update/runtime | Watchdog, service recovery, rollback image |
| T07 Storage Integrity | SD/eMMC/rootfs | Image hash, config backup, update rollback |
| T08 Calibration | GPIO, camera, FPGA IO | Self-test for peripherals |
| T10 Thermal/Power | Edge workloads | Thermal throttle, current budget |
| T11 Local API | Edge service interface | Local dashboard, SSH/API, field service |
| T12 QA Fixture | Board validation | GPIO, boot, network, camera, benchmark receipt |
| T14 Security Ledger | Firmware provenance | Trusted image, binary blob, supply-chain review |

**Production use:** edge compute carrier → local AI/automation gateway → deterministic hardware node

**Key production part:** carrier board, boot image, edge runtime, validation fixture

## 13. Precious Plastic machine ecosystem bundle

**Main role:** Plastic recycling and small manufacturing machine ecosystem.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Machine control box | Mains, motor, heater, emergency cutoff |
| T02 Input FSM | Control panel | Start/stop/reverse/heater setpoint buttons |
| T03 Offline Telemetry | Machine status | Heater ready, motor fault, jam, cycle done |
| T04 Poka-yoke Geometry | Moulds, fixtures, guards | Prevent wrong tooling or unsafe access |
| T05 Fault Fallbacks | Controller logic | Jam timeout, heater fault, motor overload |
| T09 Motor/Heater Safety | Shredder/extruder/injection/sheetpress | Interlocks, guarding, E-stop |
| T10 Thermal/Current | Heater barrel and motor | Temperature profile, current draw, derating |
| T12 QA Fixture | Machine commissioning | Torque, heater, guard, cycle receipt |
| T13 Enclosure/Guarding | Machine frame | Covers, shields, fumes, service panels |
| T14 Compliance Ledger | Workshop safety | Industrial hazard register |

**Production use:** verified recycling workspace → product experiments → machine service/build business

**Key production part:** control box, guard system, heater/motor controller, safety checklist

## 14. NASA JPL Rover / OpenAMRobot research bundle

**Main role:** Rover mechanics + modern AMR/ROS2 robot stack.

| Useful tools | Where used | How |
|---|---|---|
| T01 Power Protection | Battery and compute supply | Fuse, disconnect, brownout protection |
| T03 Offline Telemetry | Robot status panel | ROS connected, motor fault, battery, E-stop |
| T04 Poka-yoke Geometry | Battery/dock/sensor modules | Safe insertion and service access |
| T05 Fault Fallbacks | ROS2/micro-ROS | Watchdog, command timeout, safe stop |
| T08 Sensor Calibration | Encoders, IMU, LiDAR, camera, docking tags | Commissioning evidence |
| T09 Motor Safety | Wheels and mobile base | Physical E-stop, motor inhibit, speed limits |
| T10 Thermal/Power | Pi 5, battery, motor drivers | Avoid thermal throttling and brownout |
| T11 Local API/UI | OpenAMRobot dashboard | Local operation and diagnostics |
| T12 QA Fixture | Robot bring-up | Wheel direction, encoder, nav, docking receipt |
| T14 Safety Ledger | Mobile robot operation | E-stop, battery, public-area hazard controls |

**Production use:** education rover → AMR prototype → local warehouse/logistics robot platform

**Key production part:** battery safety, E-stop, motor control, ROS2 commissioning, docking validation
