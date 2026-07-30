import { describe, it, expect } from 'vitest';
import { requireKit } from '@logichub-engineering/kit-matching';
import { encodeKitQr, decodeKitQr, resolveKitFromQr } from '../src/identity/kit-qr.js';
import { buildPrePowerChecklist, evaluateChecklist } from '../src/checklist/pre-power.js';
import type { ChecklistResponse } from '../src/schemas/loop.schema.js';
import { FIXED_TIME, IDENTITY } from './helpers.js';

describe('Gate 7 — kit identity', () => {
  it('round-trips an identity through a QR payload', () => {
    expect(decodeKitQr(encodeKitQr(IDENTITY))).toEqual(IDENTITY);
  });

  it('encodes the same identity identically every time', () => {
    expect(encodeKitQr(IDENTITY)).toBe(encodeKitQr(IDENTITY));
  });

  it('carries no URL, so scanning never depends on reaching a server', () => {
    const payload = encodeKitQr(IDENTITY);
    expect(payload).not.toMatch(/https?:/);
    expect(payload.startsWith('LHKIT:1:')).toBe(true);
  });

  it('rejects a payload that is not a kit code', () => {
    expect(() => decodeKitQr('https://example.invalid/kit/1')).toThrow(/not a LogicHub kit code/);
    expect(() => decodeKitQr('LHKIT:1:too:few')).toThrow(/not a LogicHub kit code/);
  });

  it('rejects an unsupported code version', () => {
    expect(() => decodeKitQr('LHKIT:9:motion-starter:MS-1:hw-a:deadbeef'))
      .toThrow(/Unsupported kit code version/);
  });

  it('catches a mistranscribed code rather than resolving a different kit', () => {
    const payload = encodeKitQr(IDENTITY);
    const corrupted = payload.replace('MS-000123', 'MS-000124');
    expect(() => decodeKitQr(corrupted)).toThrow(/check digest/);
  });

  it('resolves a scanned code to the exact kit manifest', () => {
    const resolved = resolveKitFromQr(encodeKitQr(IDENTITY), { now: FIXED_TIME });

    expect(resolved.identity).toEqual(IDENTITY);
    expect(resolved.kit.id).toBe('motion-starter');
    expect(resolved.kit.components).toEqual(requireKit('motion-starter').components);
  });

  it('loads the resolved kit as an editable graph', () => {
    const resolved = resolveKitFromQr(encodeKitQr(IDENTITY), { now: FIXED_TIME });
    expect(resolved.graph.nodes.length).toBeGreaterThan(0);
    expect(resolved.graph.nodes.some(n => n.type === 'controller')).toBe(true);
  });

  it('refuses a code naming a kit this build does not know', () => {
    const payload = encodeKitQr({ ...IDENTITY, kitId: 'imaginary-kit' });
    expect(() => resolveKitFromQr(payload)).toThrow(/unknown kit/);
  });
});

describe('Gate 7 — pre-power checklist', () => {
  const kit = requireKit('motion-starter');
  const items = buildPrePowerChecklist(kit);

  function respond(value: ChecklistResponse): Record<string, ChecklistResponse> {
    return Object.fromEntries(items.map(i => [i.id, value]));
  }

  it('includes the universal safety checks', () => {
    const ids = items.map(i => i.id);
    expect(ids).toContain('prepower.polarity');
    expect(ids).toContain('prepower.shorts');
    expect(ids).toContain('prepower.mechanical-clear');
  });

  it('promotes every assembly caution to a blocking check', () => {
    const cautionCount = kit.assemblySteps.reduce((n, s) => n + s.cautions.length, 0);
    const fromSteps = items.filter(i => i.sourceStep !== null);

    expect(fromSteps).toHaveLength(cautionCount);
    expect(fromSteps.every(i => i.blocking)).toBe(true);
  });

  it('treats every check as blocking', () => {
    expect(items.every(i => i.blocking)).toBe(true);
  });

  it('clears for power only when every check explicitly passed', () => {
    const outcome = evaluateChecklist(items, respond('PASS'));
    expect(outcome.clearedForPower).toBe(true);
    expect(outcome.failedItemIds).toEqual([]);
    expect(outcome.uncheckedItemIds).toEqual([]);
  });

  it('fails closed on an unanswered check', () => {
    // Silence is not consent: an unrun check is not a passed check.
    const responses = respond('PASS');
    delete responses['prepower.polarity'];

    const outcome = evaluateChecklist(items, responses);
    expect(outcome.clearedForPower).toBe(false);
    expect(outcome.uncheckedItemIds).toContain('prepower.polarity');
    expect(outcome.summary).toMatch(/blocks power exactly as a failed one/);
  });

  it('fails closed when no responses are supplied at all', () => {
    const outcome = evaluateChecklist(items, {});
    expect(outcome.clearedForPower).toBe(false);
    expect(outcome.uncheckedItemIds).toHaveLength(items.length);
  });

  it('blocks on a failed check', () => {
    const responses = respond('PASS');
    responses['prepower.shorts'] = 'FAIL';

    const outcome = evaluateChecklist(items, responses);
    expect(outcome.clearedForPower).toBe(false);
    expect(outcome.failedItemIds).toEqual(['prepower.shorts']);
  });

  it('reports failures and omissions in a stable order', () => {
    const outcome = evaluateChecklist(items, {});
    expect(outcome.uncheckedItemIds).toEqual([...outcome.uncheckedItemIds].sort());
  });
});
