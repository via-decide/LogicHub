import type { RuleDefinition } from '../contracts/rule-definition.schema.js';
import type { ProductCase, RuleId } from '../contracts/case.schema.js';
import type { UnhashedRuleResult } from './shared.js';
import * as power from './sec-power-thermal-001.js';
import * as optical from './sec-optical-classification-001.js';
import * as iface from './sec-interface-integrity-001.js';
import * as mech from './sec-mechanical-ruggedness-001.js';
import * as econ from './sec-manufacturing-economics-001.js';

export interface RuleModule {
  ruleId: RuleId;
  inputKey: keyof ProductCase['inputs'];
  definition: RuleDefinition;
  evaluate(inputs: unknown): UnhashedRuleResult;
}

export const RULE_REGISTRY: readonly RuleModule[] = [
  {
    ruleId: 'SEC-POWER-THERMAL-001',
    inputKey: 'power',
    definition: power.definition,
    evaluate: inputs => power.evaluate(inputs as Parameters<typeof power.evaluate>[0]),
  },
  {
    ruleId: 'SEC-OPTICAL-CLASSIFICATION-001',
    inputKey: 'optical',
    definition: optical.definition,
    evaluate: inputs => optical.evaluate(inputs as Parameters<typeof optical.evaluate>[0]),
  },
  {
    ruleId: 'SEC-INTERFACE-INTEGRITY-001',
    inputKey: 'interface',
    definition: iface.definition,
    evaluate: inputs => iface.evaluate(inputs as Parameters<typeof iface.evaluate>[0]),
  },
  {
    ruleId: 'SEC-MECHANICAL-RUGGEDNESS-001',
    inputKey: 'mechanical',
    definition: mech.definition,
    evaluate: inputs => mech.evaluate(inputs as Parameters<typeof mech.evaluate>[0]),
  },
  {
    ruleId: 'SEC-MANUFACTURING-ECONOMICS-001',
    inputKey: 'economics',
    definition: econ.definition,
    evaluate: inputs => econ.evaluate(inputs as Parameters<typeof econ.evaluate>[0]),
  },
] as const;

export function getRule(ruleId: string): RuleModule | undefined {
  return RULE_REGISTRY.find(r => r.ruleId === ruleId);
}
