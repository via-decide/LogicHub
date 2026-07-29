export {
  ComponentFamilySchema, type ComponentFamily,
  SourcingStateSchema, type SourcingState,
  AvailabilityStateSchema, type AvailabilityState,
  CostEstimateSchema, type CostEstimate,
  UNKNOWN_COST,
  EnvelopeSourceSchema, type EnvelopeSource,
  ElectricalEnvelopeSchema, type ElectricalEnvelope,
  SourcingRecordSchema, type SourcingRecord,
  PhysicalComponentSchema, type PhysicalComponent,
} from './schemas/component.schema.js';

export {
  ValidationStatusSchema, type ValidationStatus,
  AssemblyDifficultySchema, type AssemblyDifficulty,
  KitComponentRefSchema, type KitComponentRef,
  AssemblyStepSchema, type AssemblyStep,
  TestStepSchema, type TestStep,
  UpgradeOptionSchema, type UpgradeOption,
  PhysicalKitDefinitionSchema, type PhysicalKitDefinition,
} from './schemas/kit.schema.js';

export {
  ResolvedComponentSchema, type ResolvedComponent,
  IncompatibleAssumptionSchema, type IncompatibleAssumption,
  MissingComponentSchema, type MissingComponent,
  KitMatchSchema, type KitMatch,
} from './schemas/kit-match.schema.js';

export {
  COMPONENT_CATALOGUE,
  getComponent,
  requireComponent,
  componentsForNodeType,
} from './catalogue/components.js';

export {
  REFERENCE_KITS,
  MOTION_STARTER_KIT,
  ENVIRONMENT_STARTER_KIT,
  MOTION_AND_VISION_KIT,
  PRODUCT_INTERFACE_KIT,
  getKit,
  requireKit,
} from './kits/index.js';

export { matchKits } from './matching/kit-matcher.js';
export {
  checkSupplyVoltage,
  totalCost,
  aggregateAvailability,
  type VoltageVerdict,
} from './matching/compatibility.js';

export { kitToGraph, type KitToGraphOptions } from './loader/kit-to-graph.js';
