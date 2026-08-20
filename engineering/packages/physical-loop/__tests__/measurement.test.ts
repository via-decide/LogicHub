import { describe, it, expect } from 'vitest';
import { propagate } from '@logichub-engineering/product-graph';
import { kitToGraph, requireKit } from '@logichub-engineering/kit-matching';
import {
  compareToEstimates,
  REQUIRED_QUANTITIES,
  QUANTITY_UNITS,
} from '../src/measurement/comparison.js';
import { ComparisonReportSchema } from '../src/schemas/measurement.schema.js';
import { FIXED_TIME, measurement } from './helpers.js';

function roverGraph() {
  return propagate(kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME })).graph;
}

function entryFor(report: ReturnType<typeof compareToEstimates>, quantity: string) {
  const found = report.comparisons.find(c => c.quantity === quantity);
  if (!found) throw new Error(`No comparison for ${quantity}`);
  return found;
}

describe('Gate 7 — estimate versus measurement', () => {
  it('asks for the eight quantities the Motion Starter loop requires', () => {
    expect(REQUIRED_QUANTITIES).toEqual([
      'battery.voltage', 'idle.current', 'motor.current', 'motor.peakCurrent',
      'runtime', 'bluetooth.range', 'motor.response', 'sensor.detectionRange',
    ]);
    for (const quantity of REQUIRED_QUANTITIES) {
      expect(QUANTITY_UNITS[quantity].length).toBeGreaterThan(0);
    }
  });

  it('reports every required quantity, measured or not', () => {
    const report = compareToEstimates(roverGraph(), []);
    expect(ComparisonReportSchema.safeParse(report).success).toBe(true);
    expect(report.comparisons).toHaveLength(REQUIRED_QUANTITIES.length);
  });

  it('marks an unmeasured quantity NOT_MEASURED rather than zero', () => {
    // The estimate must not be quietly read as agreeing with itself.
    const entry = entryFor(compareToEstimates(roverGraph(), []), 'battery.voltage');

    expect(entry.state).toBe('NOT_MEASURED');
    expect(entry.estimated).toBe(4.8);
    expect(entry.measured).toBeUndefined();
    expect(entry.difference).toBeUndefined();
    expect(entry.note).toMatch(/estimate stands untested/);
  });

  it('keeps the estimate and the measurement side by side', () => {
    const report = compareToEstimates(roverGraph(), [measurement('battery.voltage', 4.62)]);
    const entry = entryFor(report, 'battery.voltage');

    expect(entry.state).toBe('COMPARED');
    expect(entry.estimated).toBe(4.8);
    expect(entry.measured).toBe(4.62);
    expect(entry.note).toMatch(/neither replaces the other/);
  });

  it('computes the difference and percentage against the estimate', () => {
    const report = compareToEstimates(roverGraph(), [measurement('battery.voltage', 4.32)]);
    const entry = entryFor(report, 'battery.voltage');

    expect(entry.difference).toBe(-0.48);
    expect(entry.percentDifference).toBe(-10);
  });

  it('rejects a reading recorded in a non-canonical unit', () => {
    expect(() => compareToEstimates(roverGraph(), [
      measurement('battery.voltage', 4800, { unit: 'mV' }),
    ])).toThrow(/requires V/);
  });

  it('uses the referenced motor node for its estimate', () => {
    const graph = roverGraph();
    const motors = graph.nodes.filter(node => node.type === 'motor');
    expect(motors).toHaveLength(2);
    const secondMotor = motors[1]!;
    const adjusted = {
      ...graph,
      nodes: graph.nodes.map(node => node.id === secondMotor.id
        ? { ...node, derivedMetrics: { ...node.derivedMetrics, typicalCurrentA: 0.75 } }
        : node),
    };

    const entry = entryFor(compareToEstimates(adjusted, [
      measurement('motor.current', 0.8, { nodeId: secondMotor.id }),
    ]), 'motor.current');

    expect(entry.estimated).toBe(0.75);
    expect(entry.difference).toBe(0.05);
  });

  it('offers no estimate for quantities the model does not derive', () => {
    // Motor response time and sensor detection range are properties of real
    // parts; nothing in the graph predicts them, so no stand-in is invented.
    const report = compareToEstimates(roverGraph(), [
      measurement('motor.response', 45),
      measurement('sensor.detectionRange', 1800),
    ]);

    for (const quantity of ['motor.response', 'sensor.detectionRange']) {
      const entry = entryFor(report, quantity);
      expect(entry.state).toBe('NO_ESTIMATE');
      expect(entry.estimated).toBeUndefined();
      expect(entry.measured).toBeDefined();
      expect(entry.difference).toBeUndefined();
      expect(entry.note).toMatch(/no baseline/);
    }
  });

  it('carries the evidence reference through to the comparison', () => {
    const report = compareToEstimates(roverGraph(), [measurement('runtime', 1.2)]);
    const entry = entryFor(report, 'runtime');
    expect(entry.evidenceRef).toBe('ev_runtime');
    expect(entry.measurementId).toBe('m_runtime');
  });

  it('is not complete until every required quantity is measured', () => {
    const partial = compareToEstimates(roverGraph(), [measurement('battery.voltage', 4.8)]);
    expect(partial.complete).toBe(false);
    expect(partial.unmeasuredQuantities).toHaveLength(REQUIRED_QUANTITIES.length - 1);
    expect(partial.summary).toMatch(/not fully characterised/);
  });

  it('is complete when all eight are measured', () => {
    const full = compareToEstimates(
      roverGraph(),
      REQUIRED_QUANTITIES.map(q => measurement(q, 1)),
    );
    expect(full.complete).toBe(true);
    expect(full.unmeasuredQuantities).toEqual([]);
  });

  it('prefers the later reading when a quantity is measured twice', () => {
    const report = compareToEstimates(roverGraph(), [
      measurement('battery.voltage', 4.8, { id: 'm_early', recordedAt: '2026-03-01T08:00:00.000Z' }),
      measurement('battery.voltage', 4.5, { id: 'm_late', recordedAt: '2026-03-01T10:00:00.000Z' }),
    ]);
    expect(entryFor(report, 'battery.voltage').measured).toBe(4.5);
    expect(entryFor(report, 'battery.voltage').measurementId).toBe('m_late');
  });

  it('does not depend on the order measurements are supplied in', () => {
    const graph = roverGraph();
    const readings = [measurement('battery.voltage', 4.5), measurement('runtime', 1.1)];
    const forward = JSON.stringify(compareToEstimates(graph, readings));
    const reversed = JSON.stringify(compareToEstimates(graph, [...readings].reverse()));
    expect(reversed).toBe(forward);
  });

  it('omits a percentage when the estimate is zero rather than reporting infinity', () => {
    const graph = roverGraph();
    const zeroed = {
      ...graph,
      nodes: graph.nodes.map(n =>
        n.type === 'controller'
          ? { ...n, derivedMetrics: { ...n.derivedMetrics, idleCurrentMa: 0 } }
          : n),
    };

    const entry = entryFor(
      compareToEstimates(zeroed, [measurement('idle.current', 18)]),
      'idle.current',
    );
    expect(entry.difference).toBe(18);
    expect(entry.percentDifference).toBeUndefined();
  });

  it('reports UNKNOWN when neither side exists', () => {
    const empty = { ...roverGraph(), nodes: [], connections: [] };
    expect(entryFor(compareToEstimates(empty, []), 'battery.voltage').state).toBe('UNKNOWN');
  });

  it('produces the same report for the same inputs every time', () => {
    const graph = roverGraph();
    const readings = [measurement('battery.voltage', 4.5)];
    const baseline = JSON.stringify(compareToEstimates(graph, readings));
    for (let i = 0; i < 5; i += 1) {
      expect(JSON.stringify(compareToEstimates(graph, readings))).toBe(baseline);
    }
  });
});
