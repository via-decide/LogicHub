import { describe, it, expect } from 'vitest';
import { matchProducts, aggregateCapabilities } from '../src/discovery/matcher.js';
import { PRODUCT_TEMPLATES } from '../src/discovery/templates.js';
import { propagate } from '../src/propagation/propagation-engine.js';
import { connection, graphOf, motionStarterGraph, node } from './helpers.js';

function verdictFor(results: ReturnType<typeof matchProducts>, templateId: string) {
  const match = results.find(r => r.templateId === templateId);
  if (!match) throw new Error(`No result for ${templateId}`);
  return match;
}

describe('Gate 3 — product discovery', () => {
  it('sums counts and ORs booleans when aggregating capabilities', () => {
    const { graph } = propagate(motionStarterGraph());
    const capabilities = aggregateCapabilities(graph);

    expect(capabilities['motor.count']).toBe(2);
    expect(capabilities['sensor.count']).toBe(1);
    expect(capabilities['wireless.bluetooth']).toBe(true);
    expect(capabilities['controller.present']).toBe(true);
  });

  it('ranks the Motion Starter slice as CAN_MAKE for the bluetooth rover', () => {
    const { graph } = propagate(motionStarterGraph());
    const results = matchProducts(graph);
    const rover = verdictFor(results, 'bluetooth-rover');

    expect(rover.verdict).toBe('CAN_MAKE');
    expect(rover.score).toBe(1);
    expect(rover.missingCapabilities).toEqual([]);
  });

  it('puts CAN_MAKE results first in the ranking', () => {
    const { graph } = propagate(motionStarterGraph());
    const results = matchProducts(graph);
    expect(results[0].verdict).toBe('CAN_MAKE');

    const verdicts = results.map(r => r.verdict);
    const rank = { CAN_MAKE: 0, ALMOST_POSSIBLE: 1, NOT_RECOMMENDED: 2 } as const;
    for (let i = 1; i < verdicts.length; i += 1) {
      expect(rank[verdicts[i]]).toBeGreaterThanOrEqual(rank[verdicts[i - 1]]);
    }
  });

  it('returns one result per template', () => {
    const { graph } = propagate(motionStarterGraph());
    expect(matchProducts(graph)).toHaveLength(PRODUCT_TEMPLATES.length);
  });

  it('marks every template NOT_RECOMMENDED for an empty graph', () => {
    const results = matchProducts(graphOf([], []));
    expect(results.every(r => r.verdict === 'NOT_RECOMMENDED')).toBe(true);
    expect(results.every(r => r.score < 0.6)).toBe(true);
  });

  it('calls a rover ALMOST_POSSIBLE when only the wireless link is missing', () => {
    // An RP2040 has no radio of its own and no connectivity node is attached.
    const graph = graphOf(
      [
        node('n1', 'battery', { chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5 }),
        node('n2', 'controller', { controller: 'rp2040' }),
        node('n3', 'motor', { ratedVoltageV: 3 }),
        node('n4', 'motor', { ratedVoltageV: 3 }),
        node('n5', 'sensor', { sensorType: 'distance' }),
      ],
      [
        connection('c1', 'n1', 'n2', 'power'),
        connection('c2', 'n1', 'n3', 'power'),
        connection('c3', 'n1', 'n4', 'power'),
        connection('c4', 'n2', 'n3', 'control'),
        connection('c5', 'n2', 'n4', 'control'),
      ],
    );

    const rover = verdictFor(matchProducts(propagate(graph).graph), 'bluetooth-rover');
    expect(rover.verdict).toBe('ALMOST_POSSIBLE');
    expect(rover.missingCapabilities).toEqual(['wireless.bluetooth']);
    expect(rover.suggestedChanges.join(' ')).toMatch(/wireless\.bluetooth/);
  });

  it('never reaches CAN_MAKE while a required capability is missing', () => {
    const graph = graphOf(
      [node('n1', 'battery'), node('n2', 'controller', { controller: 'esp32' })],
      [connection('c1', 'n1', 'n2', 'power')],
    );
    const results = matchProducts(propagate(graph).graph);
    for (const result of results) {
      if (result.missingCapabilities.length > 0) {
        expect(result.verdict).not.toBe('CAN_MAKE');
      }
    }
  });

  it('treats an unpublished capability as unknown rather than satisfied', () => {
    // A bare battery publishes no runtime until loads exist, so a template
    // asking for runtime must not count it as met.
    const graph = graphOf([node('n1', 'battery')], []);
    const results = matchProducts(propagate(graph).graph);
    const monitor = verdictFor(results, 'greenhouse-monitor');
    expect(monitor.matchedCapabilities).not.toContain('battery.runtimeH');
  });

  it('produces an identical ranking on every run', () => {
    const { graph } = propagate(motionStarterGraph());
    const baseline = JSON.stringify(matchProducts(graph));
    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(matchProducts(graph))).toBe(baseline);
    }
  });

  it('never lowers a score when a matching capability is added', () => {
    const base = graphOf(
      [
        node('n1', 'battery', { chemistry: 'nimh', cellCount: 3, capacityMah: 2000, dischargeRating: 5 }),
        node('n2', 'controller', { controller: 'esp32' }),
        node('n3', 'motor', { ratedVoltageV: 3 }),
      ],
      [connection('c1', 'n1', 'n2', 'power'), connection('c2', 'n1', 'n3', 'power')],
    );
    const extended = {
      ...base,
      nodes: [...base.nodes, node('n4', 'motor', { ratedVoltageV: 3 })],
      connections: [...base.connections, connection('c3', 'n1', 'n4', 'power')],
    };

    const before = matchProducts(propagate(base).graph);
    const after = matchProducts(propagate(extended).graph);

    for (const template of PRODUCT_TEMPLATES) {
      const scoreBefore = verdictFor(before, template.id).score;
      const scoreAfter = verdictFor(after, template.id).score;
      expect(scoreAfter).toBeGreaterThanOrEqual(scoreBefore);
    }
  });

  it('describes what to change for each missing requirement', () => {
    const graph = graphOf([node('n1', 'battery')], []);
    const rover = verdictFor(matchProducts(propagate(graph).graph), 'bluetooth-rover');
    expect(rover.suggestedChanges).toHaveLength(rover.missingCapabilities.length);
    expect(rover.suggestedChanges.every(s => s.length > 0)).toBe(true);
  });

  it('keeps every template well-formed', () => {
    const ids = new Set<string>();
    for (const template of PRODUCT_TEMPLATES) {
      expect(ids.has(template.id)).toBe(false);
      ids.add(template.id);
      expect(template.requiredCapabilities.length).toBeGreaterThan(0);
      expect(template.requiredCapabilities.every(r => r.required)).toBe(true);
      expect(template.optionalCapabilities.every(r => !r.required)).toBe(true);
    }
    expect(PRODUCT_TEMPLATES).toHaveLength(10);
  });
});
