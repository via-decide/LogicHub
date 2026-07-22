import { z } from 'zod';
import { createLogicHubError } from '@logichub-engineering/shared';
import { ProductCaseSchema, type ProductCase, type RuleId } from '../contracts/case.schema.js';
import { ReferenceProductSchema, type ReferenceProduct } from '../contracts/product.schema.js';
import { RuleResultSchema, type RuleResult, combineStatuses, type RuleResultStatus } from '../contracts/rule-result.schema.js';
import { RULE_REGISTRY, getRule } from '../rules/registry.js';
import { hashRuleResult, canonicalBytes } from './canonical.js';
import { sha256Hex } from '../util/hash.js';

export interface EvaluationDocument {
  schemaVersion: '0.1.0';
  kernelVersion: string;
  productId: string;
  productRevision: string;
  evaluationId: string;
  caseId: string;
  intent: ProductCase['intent'];
  ruleResults: RuleResult[];
  overallStatus: RuleResultStatus;
  /** SHA-256 of the JCS form of this document with documentHash absent */
  documentHash: string;
}

export const KERNEL_VERSION = '0.1.0';

export function parseProduct(raw: unknown): ReferenceProduct {
  const parsed = ReferenceProductSchema.safeParse(raw);
  if (!parsed.success) {
    throw createLogicHubError('LH_SCHEMA_INVALID', `product.json does not conform to ReferenceProductSchema: ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

export function parseCase(raw: unknown): ProductCase {
  const parsed = ProductCaseSchema.safeParse(raw);
  if (!parsed.success) {
    throw createLogicHubError('LH_SCHEMA_INVALID', `case does not conform to ProductCaseSchema: ${formatZodError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * Evaluate a normalized product case against the requested rules.
 *
 * The kernel calculates, compares, classifies, and records. It never mutates
 * inputs, never invents missing values, and never converts unknown into pass.
 */
export function evaluateCase(product: ReferenceProduct, productCase: ProductCase): EvaluationDocument {
  if (productCase.intent.productId !== product.productId) {
    throw createLogicHubError(
      'LH_SCHEMA_INVALID',
      `case intent targets product '${productCase.intent.productId}' but the supplied product is '${product.productId}'`,
    );
  }
  if (productCase.intent.productRevision !== product.productRevision) {
    throw createLogicHubError(
      'LH_SCHEMA_INVALID',
      `case intent targets revision '${productCase.intent.productRevision}' but the supplied product is '${product.productRevision}'`,
    );
  }

  const requested: readonly RuleId[] = productCase.rules === 'all'
    ? RULE_REGISTRY.map(r => r.ruleId)
    : productCase.rules;

  const ruleResults: RuleResult[] = [];
  for (const ruleId of [...requested].sort()) {
    const rule = getRule(ruleId);
    if (!rule) {
      throw createLogicHubError('LH_SCHEMA_INVALID', `unknown rule id '${ruleId}'`);
    }
    const inputs = productCase.inputs[rule.inputKey];
    let result: RuleResult;
    if (inputs === undefined) {
      result = hashRuleResult({
        schemaVersion: '0.1.0',
        ruleId: rule.ruleId,
        ruleVersion: rule.definition.ruleVersion,
        inputs: {},
        inputProvenance: {},
        assumptions: [],
        procedure: [],
        trace: [],
        thresholds: {},
        checks: [
          {
            check: 'inputs-present',
            status: 'unknown',
            detail: `Case '${productCase.caseId}' supplies no '${String(rule.inputKey)}' inputs for ${rule.ruleId}. Absent input sections are unknown, never pass.`,
          },
        ],
        metrics: {},
        status: 'unknown',
        confidenceClass: 'insufficient_evidence',
        confidenceRationale: 'No inputs were supplied for this rule in the case document.',
        unknowns: [{ field: String(rule.inputKey), reason: 'input section absent from case' }],
        warnings: [],
        failureModes: [],
        requiredTests: [],
        affectedObjects: [],
        evidenceReferences: [],
      });
    } else {
      try {
        result = hashRuleResult(rule.evaluate(inputs));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        result = hashRuleResult({
          schemaVersion: '0.1.0',
          ruleId: rule.ruleId,
          ruleVersion: rule.definition.ruleVersion,
          inputs: {},
          inputProvenance: {},
          assumptions: [],
          procedure: [],
          trace: [],
          thresholds: {},
          checks: [{ check: 'evaluation', status: 'error', detail: `Rule evaluation raised: ${message}` }],
          metrics: {},
          status: 'error',
          confidenceClass: 'insufficient_evidence',
          confidenceRationale: `Evaluation error: ${message}`,
          unknowns: [],
          warnings: [],
          failureModes: [],
          requiredTests: [],
          affectedObjects: [],
          evidenceReferences: [],
        });
      }
    }
    RuleResultSchema.parse(result);
    ruleResults.push(result);
  }

  const unhashed = {
    schemaVersion: '0.1.0' as const,
    kernelVersion: KERNEL_VERSION,
    productId: product.productId,
    productRevision: product.productRevision,
    evaluationId: productCase.intent.evaluationId,
    caseId: productCase.caseId,
    intent: productCase.intent,
    ruleResults,
    overallStatus: combineStatuses(ruleResults.map(r => r.status)),
  };
  const documentHash = sha256Hex(canonicalBytes(unhashed));
  return { ...unhashed, documentHash };
}

function formatZodError(error: z.ZodError): string {
  return error.issues
    .slice(0, 10)
    .map(i => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('; ');
}
