#!/usr/bin/env node
/**
 * Generates the smart-plant-pot KiCad 7 fixture projects (base + proposed).
 *
 * The fixtures are committed as static files; this script documents how they
 * were authored and allows regeneration. UUIDs are deterministic (derived
 * from stable object keys) so unchanged objects keep the same identity
 * across base and proposed — mirroring how a real project evolves in git.
 *
 * Run: node generate-fixtures.mjs
 */
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

function uuidFor(key) {
  const h = createHash('sha256').update(key).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const FONT = '(effects (font (size 1.27 1.27)))';
const FONT_HIDE = '(effects (font (size 1.27 1.27)) hide)';

// ---------------------------------------------------------------- symbols

function pinDef(type, num, name, x, y, angle, length) {
  return `      (pin ${type} line (at ${x} ${y} ${angle}) (length ${length})
        (name "${name}" ${FONT})
        (number "${num}" ${FONT})
      )`;
}

function twoPinSymbol(libName, refPrefix, defaultValue) {
  return `    (symbol "${libName}" (pin_numbers hide) (pin_names (offset 0.254)) (in_bom yes) (on_board yes)
      (property "Reference" "${refPrefix}" (at 0 2.54 0) ${FONT})
      (property "Value" "${defaultValue}" (at 0 -2.54 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONT_HIDE})
      (property "Datasheet" "" (at 0 0 0) ${FONT_HIDE})
      (symbol "${libName.split(':')[1]}_0_1"
        (rectangle (start -2.54 -1.27) (end 2.54 1.27) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "${libName.split(':')[1]}_1_1"
${pinDef('passive', '1', '1', -3.81, 0, 0, 1.27)}
${pinDef('passive', '2', '2', 3.81, 0, 180, 1.27)}
      )
    )`;
}

function regulatorSymbol(libName) {
  return `    (symbol "${libName}" (pin_names (offset 0.254)) (in_bom yes) (on_board yes)
      (property "Reference" "U" (at 0 3.81 0) ${FONT})
      (property "Value" "${libName.split(':')[1]}" (at 0 -3.81 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONT_HIDE})
      (property "Datasheet" "" (at 0 0 0) ${FONT_HIDE})
      (symbol "${libName.split(':')[1]}_0_1"
        (rectangle (start -2.54 -2.54) (end 2.54 2.54) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "${libName.split(':')[1]}_1_1"
${pinDef('passive', '1', 'VI', -5.08, 0, 0, 2.54)}
${pinDef('passive', '2', 'GND', 0, -5.08, 90, 2.54)}
${pinDef('passive', '3', 'VO', 5.08, 0, 180, 2.54)}
      )
    )`;
}

function mcuSymbol() {
  return `    (symbol "splp:MCU_SensorCtrl" (pin_names (offset 0.254)) (in_bom yes) (on_board yes)
      (property "Reference" "U" (at 0 6.35 0) ${FONT})
      (property "Value" "MCU_SensorCtrl" (at 0 -6.35 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONT_HIDE})
      (property "Datasheet" "" (at 0 0 0) ${FONT_HIDE})
      (symbol "MCU_SensorCtrl_0_1"
        (rectangle (start -5.08 -5.08) (end 5.08 5.08) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "MCU_SensorCtrl_1_1"
${pinDef('passive', '1', 'VCC', -7.62, 2.54, 0, 2.54)}
${pinDef('passive', '2', 'GND', -7.62, -2.54, 0, 2.54)}
${pinDef('passive', '3', 'SENSE', 7.62, 2.54, 180, 2.54)}
${pinDef('passive', '4', 'LED', 7.62, -2.54, 180, 2.54)}
      )
    )`;
}

function conn3Symbol(libName) {
  return `    (symbol "${libName}" (pin_names (offset 0.254)) (in_bom yes) (on_board yes)
      (property "Reference" "J" (at 0 6.35 0) ${FONT})
      (property "Value" "${libName.split(':')[1]}" (at 0 -6.35 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONT_HIDE})
      (property "Datasheet" "" (at 0 0 0) ${FONT_HIDE})
      (symbol "${libName.split(':')[1]}_0_1"
        (rectangle (start -2.54 -5.08) (end 2.54 5.08) (stroke (width 0.254) (type default)) (fill (type none)))
      )
      (symbol "${libName.split(':')[1]}_1_1"
${pinDef('passive', '1', 'VCC', -3.81, 2.54, 0, 1.27)}
${pinDef('passive', '2', 'SENSE', -3.81, 0, 0, 1.27)}
${pinDef('passive', '3', 'GND', -3.81, -2.54, 0, 1.27)}
      )
    )`;
}

function powerSymbol(libName, netName, pinType) {
  return `    (symbol "${libName}" (power) (pin_names (offset 0)) (in_bom yes) (on_board yes)
      (property "Reference" "#PWR" (at 0 -1.27 0) ${FONT_HIDE})
      (property "Value" "${netName}" (at 0 1.27 0) ${FONT})
      (property "Footprint" "" (at 0 0 0) ${FONT_HIDE})
      (property "Datasheet" "" (at 0 0 0) ${FONT_HIDE})
      (symbol "${libName.split(':')[1]}_1_1"
${pinDef(pinType, '1', netName, 0, 0, 270, 0)}
      )
    )`;
}

// ---------------------------------------------------------------- schematic

/**
 * Placed symbol. pinsAt: computed absolute pin positions are implied by the
 * lib definitions above; this function only needs placement + identity.
 */
function placedSymbol({ key, libId, ref, value, footprint, at, project, rootUuid, pinCount, isPower }) {
  const uuid = uuidFor(key);
  const pins = [];
  for (let n = 1; n <= pinCount; n++) {
    pins.push(`    (pin "${n}" (uuid "${uuidFor(`${key}/pin${n}`)}"))`);
  }
  const [x, y] = at;
  return `  (symbol (lib_id "${libId}") (at ${x} ${y} 0) (unit 1)
    (in_bom ${isPower ? 'no' : 'yes'}) (on_board yes) (dnp no)
    (uuid "${uuid}")
    (property "Reference" "${ref}" (at ${x} ${y - 5.08} 0) ${isPower ? FONT_HIDE : FONT})
    (property "Value" "${value}" (at ${x} ${y + 5.08} 0) ${FONT})
    (property "Footprint" "${footprint ?? ''}" (at ${x} ${y} 0) ${FONT_HIDE})
    (property "Datasheet" "" (at ${x} ${y} 0) ${FONT_HIDE})
${pins.join('\n')}
    (instances (project "${project}" (path "/${rootUuid}" (reference "${ref}") (unit 1))))
  )`;
}

function wire(key, [x1, y1], [x2, y2]) {
  return `  (wire (pts (xy ${x1} ${y1}) (xy ${x2} ${y2}))
    (stroke (width 0) (type default))
    (uuid "${uuidFor(key)}")
  )`;
}

function noConnect(key, [x, y]) {
  return `  (no_connect (at ${x} ${y}) (uuid "${uuidFor(key)}"))`;
}

function buildSchematic({ project, variant, libSymbols, symbols, wires, noConnects }) {
  const rootUuid = uuidFor(`${project}/root-sheet`);
  return `(kicad_sch (version 20230121) (generator eeschema)

  (uuid "${rootUuid}")

  (paper "A4")

  (title_block
    (title "Smart Plant Pot — ${variant}")
    (company "LogicHub Fixtures")
    (rev "${variant}")
  )

  (lib_symbols
${libSymbols.join('\n')}
  )

${symbols.join('\n')}

${wires.join('\n')}
${noConnects.length > 0 ? noConnects.join('\n') + '\n' : ''}
  (sheet_instances (path "/" (page "1")))
)
`;
}

// ---------------------------------------------------------------- pcb

const LAYERS = `  (layers
    (0 "F.Cu" signal)
    (31 "B.Cu" signal)
    (32 "B.Adhes" user "B.Adhesive")
    (33 "F.Adhes" user "F.Adhesive")
    (34 "B.Paste" user)
    (35 "F.Paste" user)
    (36 "B.SilkS" user "B.Silkscreen")
    (37 "F.SilkS" user "F.Silkscreen")
    (38 "B.Mask" user)
    (39 "F.Mask" user)
    (40 "Dwgs.User" user "User.Drawings")
    (41 "Cmts.User" user "User.Comments")
    (44 "Edge.Cuts" user)
    (46 "B.CrtYd" user "B.Courtyard")
    (47 "F.CrtYd" user "F.Courtyard")
    (48 "B.Fab" user)
    (49 "F.Fab" user)
  )`;

function pcbFootprint({ key, libId, ref, value, at, pads }) {
  const [fx, fy] = at;
  const padStrs = pads.map(p => {
    const net = p.net ? ` (net ${p.net[0]} "${p.net[1]}")` : '';
    return `    (pad "${p.num}" smd rect (at ${p.at[0]} ${p.at[1]}) (size 1.6 1.6) (layers "F.Cu" "F.Paste" "F.Mask")${net} (tstamp "${uuidFor(`${key}/pad${p.num}`)}"))`;
  });
  return `  (footprint "${libId}" (layer "F.Cu")
    (tstamp "${uuidFor(key)}")
    (at ${fx} ${fy})
    (attr smd)
    (fp_text reference "${ref}" (at 0 -2.5) (layer "F.SilkS") ${FONT} (tstamp "${uuidFor(`${key}/reftext`)}"))
    (fp_text value "${value}" (at 0 2.5) (layer "F.Fab") ${FONT} (tstamp "${uuidFor(`${key}/valtext`)}"))
${padStrs.join('\n')}
  )`;
}

function segment(key, [x1, y1], [x2, y2], netOrdinal) {
  return `  (segment (start ${x1} ${y1}) (end ${x2} ${y2}) (width 0.5) (layer "F.Cu") (net ${netOrdinal}) (tstamp "${uuidFor(key)}"))`;
}

function buildPcb({ nets, footprints, segments, outlineKey }) {
  const netDecls = nets.map(([n, name]) => `  (net ${n} "${name}")`).join('\n');
  return `(kicad_pcb (version 20221018) (generator pcbnew)

  (general
    (thickness 1.6)
  )

  (paper "A4")

${LAYERS}

  (setup
    (pad_to_mask_clearance 0)
  )

  (net 0 "")
${netDecls}

${footprints.join('\n\n')}

${segments.join('\n')}

  (gr_rect (start 15 20) (end 125 60)
    (stroke (width 0.1) (type default)) (fill none)
    (layer "Edge.Cuts") (tstamp "${uuidFor(outlineKey)}"))
)
`;
}

// ---------------------------------------------------------------- project

function buildPro(name) {
  return JSON.stringify({
    board: { design_settings: { rules: {} } },
    boards: [],
    libraries: { pinned_footprint_libs: [], pinned_symbol_libs: [] },
    meta: { filename: `${name}.kicad_pro`, version: 1 },
    net_settings: { classes: [{ name: 'Default', clearance: 0.2, track_width: 0.5 }] },
    schematic: { drawing: {}, meta: { version: 1 } },
    sheets: [],
    text_variables: {},
  }, null, 2) + '\n';
}

// ================================================================ BASE

function generateBase() {
  const project = 'smart-plant-pot';
  const rootUuid = uuidFor(`${project}/root-sheet`);
  const P = (args) => placedSymbol({ ...args, project, rootUuid });

  const libSymbols = [
    twoPinSymbol('splp:Conn_Power', 'J', 'Conn_Power'),
    twoPinSymbol('splp:C', 'C', 'C'),
    twoPinSymbol('splp:R', 'R', 'R'),
    twoPinSymbol('splp:LED', 'D', 'LED'),
    regulatorSymbol('splp:AMS1117-3.3'),
    mcuSymbol(),
    conn3Symbol('splp:Conn_1x03'),
    powerSymbol('splp-power:+5V', '+5V', 'power_in'),
    powerSymbol('splp-power:+3V3', '+3V3', 'power_in'),
    powerSymbol('splp-power:GND', 'GND', 'power_in'),
    powerSymbol('splp-power:PWR_FLAG', 'PWR_FLAG', 'power_out'),
  ];

  const symbols = [
    // Components. Pin positions (rotation 0): abs = (x + sx, y - sy).
    P({ key: 'J1', libId: 'splp:Conn_Power', ref: 'J1', value: 'USB_B_Micro_Power', footprint: 'splp:CONN_2P', at: [40, 60], pinCount: 2 }),
    P({ key: 'U1', libId: 'splp:AMS1117-3.3', ref: 'U1', value: 'AMS1117-3.3', footprint: 'splp:SOT-223', at: [70, 60], pinCount: 3 }),
    P({ key: 'C1', libId: 'splp:C', ref: 'C1', value: '10uF', footprint: 'splp:C_0805', at: [55, 75], pinCount: 2 }),
    P({ key: 'C2', libId: 'splp:C', ref: 'C2', value: '100nF', footprint: 'splp:C_0603', at: [85, 75], pinCount: 2 }),
    P({ key: 'U2', libId: 'splp:MCU_SensorCtrl', ref: 'U2', value: 'MCU_SensorCtrl', footprint: 'splp:SOIC-4', at: [120, 60], pinCount: 4 }),
    P({ key: 'J2', libId: 'splp:Conn_1x03', ref: 'J2', value: 'Conn_Sensor', footprint: 'splp:CONN_3P', at: [150, 57.46], pinCount: 3 }),
    P({ key: 'R1', libId: 'splp:R', ref: 'R1', value: '330R', footprint: 'splp:R_0603', at: [131.43, 62.54], pinCount: 2 }),
    P({ key: 'D1', libId: 'splp:LED', ref: 'D1', value: 'LED_Status', footprint: 'splp:LED_0603', at: [139.05, 62.54], pinCount: 2 }),
    // Power symbols stacked directly on pin endpoints.
    P({ key: 'PWR-5V-J1', libId: 'splp-power:+5V', ref: '#PWR01', value: '+5V', at: [36.19, 60], pinCount: 1, isPower: true }),
    P({ key: 'PWR-5V-U1', libId: 'splp-power:+5V', ref: '#PWR02', value: '+5V', at: [64.92, 60], pinCount: 1, isPower: true }),
    P({ key: 'PWR-5V-C1', libId: 'splp-power:+5V', ref: '#PWR03', value: '+5V', at: [51.19, 75], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-U1', libId: 'splp-power:+3V3', ref: '#PWR04', value: '+3V3', at: [75.08, 60], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-C2', libId: 'splp-power:+3V3', ref: '#PWR05', value: '+3V3', at: [81.19, 75], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-U2', libId: 'splp-power:+3V3', ref: '#PWR06', value: '+3V3', at: [112.38, 57.46], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-J2', libId: 'splp-power:+3V3', ref: '#PWR07', value: '+3V3', at: [146.19, 54.92], pinCount: 1, isPower: true }),
    P({ key: 'GND-J1', libId: 'splp-power:GND', ref: '#PWR08', value: 'GND', at: [43.81, 60], pinCount: 1, isPower: true }),
    P({ key: 'GND-U1', libId: 'splp-power:GND', ref: '#PWR09', value: 'GND', at: [70, 65.08], pinCount: 1, isPower: true }),
    P({ key: 'GND-C1', libId: 'splp-power:GND', ref: '#PWR10', value: 'GND', at: [58.81, 75], pinCount: 1, isPower: true }),
    P({ key: 'GND-C2', libId: 'splp-power:GND', ref: '#PWR11', value: 'GND', at: [88.81, 75], pinCount: 1, isPower: true }),
    P({ key: 'GND-U2', libId: 'splp-power:GND', ref: '#PWR12', value: 'GND', at: [112.38, 62.54], pinCount: 1, isPower: true }),
    P({ key: 'GND-J2', libId: 'splp-power:GND', ref: '#PWR13', value: 'GND', at: [146.19, 60], pinCount: 1, isPower: true }),
    P({ key: 'GND-D1', libId: 'splp-power:GND', ref: '#PWR14', value: 'GND', at: [142.86, 62.54], pinCount: 1, isPower: true }),
    P({ key: 'FLG-5V', libId: 'splp-power:PWR_FLAG', ref: '#FLG01', value: 'PWR_FLAG', at: [36.19, 60], pinCount: 1, isPower: true }),
    P({ key: 'FLG-3V3', libId: 'splp-power:PWR_FLAG', ref: '#FLG02', value: 'PWR_FLAG', at: [75.08, 60], pinCount: 1, isPower: true }),
    P({ key: 'FLG-GND', libId: 'splp-power:PWR_FLAG', ref: '#FLG03', value: 'PWR_FLAG', at: [43.81, 60], pinCount: 1, isPower: true }),
  ];

  const wires = [
    wire('wire-sense', [127.62, 57.46], [146.19, 57.46]),
  ];

  const sch = buildSchematic({ project, variant: 'base', libSymbols, symbols, wires, noConnects: [] });

  const nets = [[1, '+5V'], [2, 'GND'], [3, '+3V3'], [4, 'SENSE'], [5, 'LED'], [6, 'LED_A']];
  const footprints = [
    pcbFootprint({ key: 'fp-J1', libId: 'splp:CONN_2P', ref: 'J1', value: 'USB_B_Micro_Power', at: [30, 40], pads: [
      { num: '1', at: [0, -10], net: [1, '+5V'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-C1', libId: 'splp:C_0805', ref: 'C1', value: '10uF', at: [40, 40], pads: [
      { num: '1', at: [0, -10], net: [1, '+5V'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-U1', libId: 'splp:SOT-223', ref: 'U1', value: 'AMS1117-3.3', at: [50, 40], pads: [
      { num: '1', at: [0, -10], net: [1, '+5V'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
      { num: '3', at: [2.54, -5], net: [3, '+3V3'] },
    ]}),
    pcbFootprint({ key: 'fp-C2', libId: 'splp:C_0603', ref: 'C2', value: '100nF', at: [60, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-U2', libId: 'splp:SOIC-4', ref: 'U2', value: 'MCU_SensorCtrl', at: [75, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
      { num: '3', at: [5.08, 0], net: [4, 'SENSE'] },
      { num: '4', at: [2.54, 2.54], net: [5, 'LED'] },
    ]}),
    pcbFootprint({ key: 'fp-R1', libId: 'splp:R_0603', ref: 'R1', value: '330R', at: [85, 42.54], pads: [
      { num: '1', at: [0, 0], net: [5, 'LED'] },
      { num: '2', at: [5.08, 0], net: [6, 'LED_A'] },
    ]}),
    pcbFootprint({ key: 'fp-D1', libId: 'splp:LED_0603', ref: 'D1', value: 'LED_Status', at: [95, 42.54], pads: [
      { num: '1', at: [0, 0], net: [6, 'LED_A'] },
      { num: '2', at: [0, 5.08], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-J2', libId: 'splp:CONN_3P', ref: 'J2', value: 'Conn_Sensor', at: [105, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 0], net: [4, 'SENSE'] },
      { num: '3', at: [0, 10], net: [2, 'GND'] },
    ]}),
  ];

  const segments = [
    // +5V rail (y=30)
    segment('seg-5v-1', [30, 30], [40, 30], 1),
    segment('seg-5v-2', [40, 30], [50, 30], 1),
    // +3V3 rail (y=35)
    segment('seg-3v3-1', [52.54, 35], [60, 35], 3),
    segment('seg-3v3-2', [60, 35], [75, 35], 3),
    segment('seg-3v3-3', [75, 35], [105, 35], 3),
    // GND rail (y=50)
    segment('seg-gnd-1', [30, 50], [40, 50], 2),
    segment('seg-gnd-2', [40, 50], [50, 50], 2),
    segment('seg-gnd-3', [50, 50], [60, 50], 2),
    segment('seg-gnd-4', [60, 50], [75, 50], 2),
    segment('seg-gnd-5', [75, 50], [95, 50], 2),
    segment('seg-gnd-6', [95, 50], [105, 50], 2),
    segment('seg-gnd-d1', [95, 47.62], [95, 50], 2),
    // SENSE
    segment('seg-sense', [80.08, 40], [105, 40], 4),
    // LED chain
    segment('seg-led', [77.54, 42.54], [85, 42.54], 5),
    segment('seg-led-a', [90.08, 42.54], [95, 42.54], 6),
  ];

  const pcb = buildPcb({ nets, footprints, segments, outlineKey: 'outline' });
  return { sch, pcb, pro: buildPro('smart-plant-pot') };
}

// ================================================================ PROPOSED
//
// Controlled change relative to base (spec section 14):
//  - Battery input replaces USB (J1 value updated), new VIN net + D2 protection
//  - U1: AMS1117-3.3 LDO replaced by TPS62A02 buck (component replacement)
//  - D2 schottky input protection added (added component)
//  - R1 + D1 status LED chain removed (removed component)
//  - C3 100nF added → (100nF, C_0603) BOM quantity 1 → 2
//  - J2 moved and footprint changed (placement + footprint change)

function generateProposed() {
  const project = 'smart-plant-pot';
  const rootUuid = uuidFor(`${project}/root-sheet`);
  const P = (args) => placedSymbol({ ...args, project, rootUuid });

  const libSymbols = [
    twoPinSymbol('splp:Conn_Power', 'J', 'Conn_Power'),
    twoPinSymbol('splp:C', 'C', 'C'),
    twoPinSymbol('splp:D_Schottky', 'D', 'D_Schottky'),
    regulatorSymbol('splp:TPS62A02'),
    mcuSymbol(),
    conn3Symbol('splp:Conn_1x03'),
    powerSymbol('splp-power:+5V', '+5V', 'power_in'),
    powerSymbol('splp-power:+3V3', '+3V3', 'power_in'),
    powerSymbol('splp-power:GND', 'GND', 'power_in'),
    powerSymbol('splp-power:PWR_FLAG', 'PWR_FLAG', 'power_out'),
  ];

  const symbols = [
    P({ key: 'J1', libId: 'splp:Conn_Power', ref: 'J1', value: 'BATT_JST_PH2', footprint: 'splp:CONN_2P', at: [40, 60], pinCount: 2 }),
    P({ key: 'D2', libId: 'splp:D_Schottky', ref: 'D2', value: 'SS14', footprint: 'splp:D_SMA', at: [52, 52], pinCount: 2 }),
    P({ key: 'U1', libId: 'splp:TPS62A02', ref: 'U1', value: 'TPS62A02', footprint: 'splp:SOT-23-5', at: [70, 60], pinCount: 3 }),
    P({ key: 'C1', libId: 'splp:C', ref: 'C1', value: '10uF', footprint: 'splp:C_0805', at: [55, 75], pinCount: 2 }),
    P({ key: 'C2', libId: 'splp:C', ref: 'C2', value: '100nF', footprint: 'splp:C_0603', at: [85, 75], pinCount: 2 }),
    P({ key: 'C3', libId: 'splp:C', ref: 'C3', value: '100nF', footprint: 'splp:C_0603', at: [95, 75], pinCount: 2 }),
    P({ key: 'U2', libId: 'splp:MCU_SensorCtrl', ref: 'U2', value: 'MCU_SensorCtrl', footprint: 'splp:SOIC-4', at: [120, 60], pinCount: 4 }),
    P({ key: 'J2', libId: 'splp:Conn_1x03', ref: 'J2', value: 'Conn_Sensor', footprint: 'splp:CONN_3P_Vertical', at: [155, 57.46], pinCount: 3 }),
    // Power symbols
    P({ key: 'PWR-5V-D2', libId: 'splp-power:+5V', ref: '#PWR01', value: '+5V', at: [55.81, 52], pinCount: 1, isPower: true }),
    P({ key: 'PWR-5V-U1', libId: 'splp-power:+5V', ref: '#PWR02', value: '+5V', at: [64.92, 60], pinCount: 1, isPower: true }),
    P({ key: 'PWR-5V-C1', libId: 'splp-power:+5V', ref: '#PWR03', value: '+5V', at: [51.19, 75], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-U1', libId: 'splp-power:+3V3', ref: '#PWR04', value: '+3V3', at: [75.08, 60], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-C2', libId: 'splp-power:+3V3', ref: '#PWR05', value: '+3V3', at: [81.19, 75], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-C3', libId: 'splp-power:+3V3', ref: '#PWR15', value: '+3V3', at: [91.19, 75], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-U2', libId: 'splp-power:+3V3', ref: '#PWR06', value: '+3V3', at: [112.38, 57.46], pinCount: 1, isPower: true }),
    P({ key: 'PWR-3V3-J2', libId: 'splp-power:+3V3', ref: '#PWR07', value: '+3V3', at: [151.19, 54.92], pinCount: 1, isPower: true }),
    P({ key: 'GND-J1', libId: 'splp-power:GND', ref: '#PWR08', value: 'GND', at: [43.81, 60], pinCount: 1, isPower: true }),
    P({ key: 'GND-U1', libId: 'splp-power:GND', ref: '#PWR09', value: 'GND', at: [70, 65.08], pinCount: 1, isPower: true }),
    P({ key: 'GND-C1', libId: 'splp-power:GND', ref: '#PWR10', value: 'GND', at: [58.81, 75], pinCount: 1, isPower: true }),
    P({ key: 'GND-C2', libId: 'splp-power:GND', ref: '#PWR11', value: 'GND', at: [88.81, 75], pinCount: 1, isPower: true }),
    P({ key: 'GND-C3', libId: 'splp-power:GND', ref: '#PWR16', value: 'GND', at: [98.81, 75], pinCount: 1, isPower: true }),
    P({ key: 'GND-U2', libId: 'splp-power:GND', ref: '#PWR12', value: 'GND', at: [112.38, 62.54], pinCount: 1, isPower: true }),
    P({ key: 'GND-J2', libId: 'splp-power:GND', ref: '#PWR13', value: 'GND', at: [151.19, 60], pinCount: 1, isPower: true }),
    P({ key: 'FLG-5V', libId: 'splp-power:PWR_FLAG', ref: '#FLG01', value: 'PWR_FLAG', at: [55.81, 52], pinCount: 1, isPower: true }),
    P({ key: 'FLG-3V3', libId: 'splp-power:PWR_FLAG', ref: '#FLG02', value: 'PWR_FLAG', at: [75.08, 60], pinCount: 1, isPower: true }),
    P({ key: 'FLG-GND', libId: 'splp-power:PWR_FLAG', ref: '#FLG03', value: 'PWR_FLAG', at: [43.81, 60], pinCount: 1, isPower: true }),
  ];

  const wires = [
    // VIN: J1.1 up and across to D2.A
    wire('wire-vin-1', [36.19, 60], [36.19, 52]),
    wire('wire-vin-2', [36.19, 52], [48.19, 52]),
    wire('wire-sense', [127.62, 57.46], [151.19, 57.46]),
  ];

  const noConnects = [
    noConnect('nc-u2-led', [127.62, 62.54]),
  ];

  const sch = buildSchematic({ project, variant: 'proposed', libSymbols, symbols, wires, noConnects });

  const nets = [[1, '+5V'], [2, 'GND'], [3, '+3V3'], [4, 'SENSE'], [5, 'VIN']];
  const footprints = [
    pcbFootprint({ key: 'fp-J1', libId: 'splp:CONN_2P', ref: 'J1', value: 'BATT_JST_PH2', at: [30, 40], pads: [
      { num: '1', at: [0, -10], net: [5, 'VIN'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-D2', libId: 'splp:D_SMA', ref: 'D2', value: 'SS14', at: [35, 30], pads: [
      { num: '1', at: [0, 0], net: [5, 'VIN'] },
      { num: '2', at: [2.54, 0], net: [1, '+5V'] },
    ]}),
    pcbFootprint({ key: 'fp-C1', libId: 'splp:C_0805', ref: 'C1', value: '10uF', at: [40, 40], pads: [
      { num: '1', at: [0, -10], net: [1, '+5V'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-U1', libId: 'splp:SOT-23-5', ref: 'U1', value: 'TPS62A02', at: [50, 40], pads: [
      { num: '1', at: [0, -10], net: [1, '+5V'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
      { num: '3', at: [2.54, -5], net: [3, '+3V3'] },
    ]}),
    pcbFootprint({ key: 'fp-C2', libId: 'splp:C_0603', ref: 'C2', value: '100nF', at: [60, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-C3', libId: 'splp:C_0603', ref: 'C3', value: '100nF', at: [67, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
    ]}),
    pcbFootprint({ key: 'fp-U2', libId: 'splp:SOIC-4', ref: 'U2', value: 'MCU_SensorCtrl', at: [75, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 10], net: [2, 'GND'] },
      { num: '3', at: [5.08, 0], net: [4, 'SENSE'] },
      { num: '4', at: [2.54, 2.54] },
    ]}),
    pcbFootprint({ key: 'fp-J2', libId: 'splp:CONN_3P_Vertical', ref: 'J2', value: 'Conn_Sensor', at: [110, 40], pads: [
      { num: '1', at: [0, -5], net: [3, '+3V3'] },
      { num: '2', at: [0, 0], net: [4, 'SENSE'] },
      { num: '3', at: [0, 10], net: [2, 'GND'] },
    ]}),
  ];

  const segments = [
    // VIN (J1.1 → D2.A)
    segment('seg-vin', [30, 30], [35, 30], 5),
    // +5V rail (D2.K → C1 → U1)
    segment('seg-5v-1', [37.54, 30], [40, 30], 1),
    segment('seg-5v-2', [40, 30], [50, 30], 1),
    // +3V3 rail
    segment('seg-3v3-1', [52.54, 35], [60, 35], 3),
    segment('seg-3v3-2', [60, 35], [75, 35], 3),
    segment('seg-3v3-3', [75, 35], [110, 35], 3),
    // GND rail
    segment('seg-gnd-1', [30, 50], [40, 50], 2),
    segment('seg-gnd-2', [40, 50], [50, 50], 2),
    segment('seg-gnd-3', [50, 50], [60, 50], 2),
    segment('seg-gnd-4', [60, 50], [75, 50], 2),
    segment('seg-gnd-5', [75, 50], [95, 50], 2),
    segment('seg-gnd-6', [95, 50], [110, 50], 2),
    // SENSE
    segment('seg-sense', [80.08, 40], [110, 40], 4),
  ];

  const pcb = buildPcb({ nets, footprints, segments, outlineKey: 'outline' });
  return { sch, pcb, pro: buildPro('smart-plant-pot') };
}

// ---------------------------------------------------------------- emit

for (const [variant, gen] of [['base', generateBase], ['proposed', generateProposed]]) {
  const dir = join(HERE, variant);
  mkdirSync(dir, { recursive: true });
  const { sch, pcb, pro } = gen();
  writeFileSync(join(dir, 'smart-plant-pot.kicad_sch'), sch);
  writeFileSync(join(dir, 'smart-plant-pot.kicad_pcb'), pcb);
  writeFileSync(join(dir, 'smart-plant-pot.kicad_pro'), pro);
  console.log(`generated ${variant}/`);
}
