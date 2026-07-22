# Customer Intake Form

Complete this form before the review begins. The kernel requires structured inputs — incomplete intake delays evaluation and produces `unknown` statuses on missing fields.

## Product identity

- **Product name**:
- **Product revision / version**:
- **Intended use**:
- **Target user / age group**:
- **Operating environment** (indoor/outdoor, temperature range, supervision level):

## Design documents required

Provide as many of the following as exist. Missing documents are recorded as evidence gaps, never as assumed values.

### Power system
- [ ] Battery specification (chemistry, capacity, voltage, protection circuit)
- [ ] Power tree / rail diagram
- [ ] Regulator selection and specifications
- [ ] Charger topology and operating conditions
- [ ] Load current estimates per subsystem (with duty cycles)
- [ ] Runtime target

### Sensing / classification (if applicable)
- [ ] Sensor type, interface, ADC resolution
- [ ] Calibration data (dark reading, ambient, per-class samples)
- [ ] Classification algorithm description
- [ ] Threshold values and decision boundaries

### Interface / connectivity
- [ ] Pin map (GPIO assignments, strapping pins, voltage domains)
- [ ] Connector specifications (keyed? orientation-defined? reserved pins?)
- [ ] Daughterboard / expansion interface details
- [ ] Protection devices (PPTC, TVS, etc.)

### Mechanical
- [ ] CAD files or enclosure dimensions (or largest printed part)
- [ ] Material selection (structural, flexible, diffuser)
- [ ] Print parameters (printer, nozzle, layer height)
- [ ] Fastening method (screws, clips, adhesive)
- [ ] Drop / impact requirements

### Manufacturing
- [ ] Bill of materials with unit costs
- [ ] Assembly time estimate
- [ ] Production quantity target
- [ ] Cost target (ex-factory and/or selling price)

## Evidence declarations

For each item above, please indicate the evidence grade:
- **measured**: Instrument-verified value with documented methodology
- **datasheet**: Manufacturer-published specification
- **estimated**: Engineering estimate without independent verification
- **unknown**: No value available

## Constraints and decisions

- List any design decisions already made (frozen selections, rejected alternatives)
- List any constraints that must be preserved (regulatory, cost, compatibility)
- List any known risks or open questions

## Contact

- **Primary contact**:
- **Email**:
- **Preferred turnaround** (standard 5 days / expedited):
