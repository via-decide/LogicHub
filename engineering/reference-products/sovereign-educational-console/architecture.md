# Sovereign Educational Console v0.1 — Frozen Architecture

Product ID: `sovereign-educational-console` · Revision: `v0.1` · Frozen: 2026-07-22

This document freezes the v0.1 reference architecture. Alternatives live only
in `decisions/`. The rule kernel evaluates exactly this configuration; it never
receives ambiguous "ESP32-C3 or RP2040" inputs.

## 1. Main controller

**Frozen: Espressif ESP32-C3-MINI-1 module** (ESP32-C3FN4 die, 4 MB in-package
flash). Decision record: `decisions/DEC-001-controller-selection.json`
(RP2040 rejected — rationale recorded there).

- Local firmware execution, no mandatory cloud dependency. Wi-Fi/BLE present in
  silicon but **disabled by default** in the v0.1 firmware profile.
- USB-C for charging and development access (native USB-Serial-JTAG on
  GPIO18/GPIO19).
- ADC acquisition for the four optical wells on ADC1 channels
  (GPIO0, GPIO1, GPIO3, GPIO4).
- Digital control of RGB illumination (single-wire addressable chain,
  GPIO10) and audio feedback (piezo PWM, GPIO5).
- One replaceable daughterboard interface (I2C on GPIO8/GPIO9 + INT on GPIO7).
- Strapping pins GPIO2, GPIO8, GPIO9 are restricted; their permitted uses are
  explicitly declared in `pin-map.json`.

Verification status of the selection criteria (GPIO count, ADC limits, LED and
audio control, UART/I2C/SPI needs, Indian sourcing, unit price, lifecycle,
package feasibility) is recorded per-criterion in `assumptions.json`. Criteria
without corpus evidence (sourcing, price, lifecycle) are marked `estimated`
and carried in `risks.md` — they are inputs to the freeze, not verified facts.

## 2. Power system

- One protected 1200 mAh lithium-polymer battery (nominal 3.7 V) with
  integrated protection PCB (overcharge/overdischarge/overcurrent).
- USB-C charging through a TP4056-class linear charger **accepted only under
  the explicit conditions in `decisions/DEC-002-charger-tp4056-conditions.json`**:
  the implementation must add power-path/load-sharing (P-MOSFET), verify USB-C
  5.1 kΩ CC pull-downs, and verify thermal behavior at 1 A program current.
  A bare generic TP4056 board is NOT assumed to provide safe power-path
  management, load sharing, USB-C negotiation, battery protection, thermal
  protection, or safe charge-while-operate behavior.
- Regulated rail: 3V3 via low-dropout linear regulator (AP2112K-3.3-class,
  600 mV dropout assumed, `estimated`). Unregulated rail: VBAT_SW (switched
  battery voltage) feeding backlight LEDs and the daughterboard VBAT pin.
- Resettable PPTC fuse on the 3V3 daughterboard branch (hold 0.5 A / trip 1.0 A,
  `estimated`) and on VBAT_SW (hold 1.1 A / trip 2.2 A, `estimated`).
- Maximum LED policy: backlight ≤ 60 mA total at 100 % duty; token-well RGB
  strobing one bay at a time, ≤ 24 mA peak per bay, ≤ 5 % duty during
  classification.
- Battery runtime target: ≥ 4 h classroom session at default brightness.
- Battery discharge floor: 3.5 V under load (LDO dropout margin); usable
  capacity derating factor 0.80.
- No exposed user-accessible unsafe power conductors: all conductors are inside
  the enclosure or behind the service panel; the only external contacts are the
  USB-C receptacle and the recessed, PPTC-protected daughterboard connector.

## 3. Optical token system

- Four optical token bays (v0.1).
- Illumination: one addressable RGB LED (WS2812B-class) per bay on a single
  data line — a *verified shared-source architecture* in the sense that one
  data pin drives four physically separate per-bay emitters; only one bay is
  illuminated during a classification strobe.
  Decision record: `decisions/DEC-003-optical-emitter-architecture.json`.
- Detection: one LDR per bay in a resistive divider into ADC1.
- Wells: matte black internal reflectance wells, light-isolated from each other
  and from the backlight cavity (see mechanical system).
- Tokens: passive 3D-printed tokens with a recessed machine-readable color
  region facing the well floor; tactile and textual markings on top.
- Classification: deterministic nearest-centroid over dark-subtracted,
  normalized R/G/B strobe responses. No machine learning in the v0.1 core.
- Calibration routine covers ambient offset and device-to-device variation.
- Explicit `unknown` state (measurement outside calibrated space) and explicit
  `ambiguous` state (two classes within the ambiguity margin). The classifier
  never forces an identity in those states.

## 4. Human interface

- Replaceable 8.5-inch monochrome LCD writing slate (self-contained commercial
  pressure-LCD tablet module with its own erase circuit and cell). The console
  provides mechanical docking only — no electrical connection to the slate in
  v0.1. Manual stylus input.
- Backlit translucent lesson-template area: white PETG diffuser over an LED
  strip; teacher-selected paper or plastic lesson sheets slide over the
  diffuser.
- Tactile and textual token markings on every token.
- Audio feedback: piezo chime (PWM).
- No mandatory graphical computer display.

## 5. Mechanical system

- Print envelope: Bambu Lab A1 compatible (256 × 256 × 256 mm working volume,
  `estimated`). Enclosure printed as two major parts (top facade, bottom tray)
  plus service panel; largest single part ≤ 250 × 190 × 30 mm.
- Structural body: matte black PETG (PLA permitted only with a thermal-creep
  warning — see Rule 4). Diffuser: translucent white PETG, 1.2 mm.
- TPU 95A corner bumpers (4), mechanically retained in printed pockets.
- Carry strap on two printed strap anchors — anchors are **not** load-rated
  until physically tested (`requires_validation`).
- Replaceable bottom service panel on 6 × M3 fasteners into printed bosses
  (boss outer Ø 7 mm, wall ≥ 1.8 mm around a 2.5 mm pilot for M3 thread-forming
  screws; heat-set inserts recorded as alternative).
- Light-isolated token wells: ≥ 1.6 mm opaque walls, ≥ 12 mm well depth, no
  line-of-sight path from backlight cavity or exterior to any LDR.
- Snap-fit internal wiring channels (groove width 2.4 mm for ≤ 1.8 mm OD
  insulated wire, retention by printed spring tabs — no glue assumed).
- Insulated conductors only; no unsupported assumption that bare copper is safe
  for exposed classroom handling — bare conductors are prohibited outside the
  sealed electronics bay (see `constraints.json`).

## 6. Upgrade interface (daughterboard)

- One keyed daughterboard interface: 2 × 6, 2.54 mm shrouded/keyed header,
  recessed in a printed pocket with an asymmetric key post so the board cannot
  be inserted rotated or offset where mechanically feasible.
- Pin allocation (full detail in `interfaces.json` / `pin-map.json`):
  power pins (VBAT_SW, 3V3-PPTC), ground pins (3), logic-voltage reference,
  communication pins (I2C SDA/SCL, INT), reserved pins (3).
- Electrical protection: PPTC on 3V3 branch, series resistors on I2C, ESD
  clamp on connector pins (`estimated` part selection).
- **No hot-plug claim.** Insertion/removal only with the console off; the
  interface is not designed or tested for hot plugging.
  Decision record: `decisions/DEC-004-no-hot-plug-claim.json`.

## Explicit exclusions (v0.1)

- No cloud services, no companion app requirement.
- No machine-learning classifier.
- No claim of toy-safety certification (IS 9873 / EN 71 / IEC 62115 or any
  other), no classroom-safety claim, no drop-rating claim — all such
  properties are `requires_validation` (see `validation-plan.md`).
- No hot-plug support on any connector except USB-C.
- No Wi-Fi/BLE features in the v0.1 firmware profile.
