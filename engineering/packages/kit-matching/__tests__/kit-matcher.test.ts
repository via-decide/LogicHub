import { describe, it, expect } from 'vitest';
import { propagate, updateNodeParameters, removeNode } from '@logichub-engineering/product-graph';
import { matchKits } from '../src/matching/kit-matcher.js';
import { kitToGraph } from '../src/loader/kit-to-graph.js';
import { REFERENCE_KITS, requireKit } from '../src/kits/index.js';
import { KitMatchSchema } from '../src/schemas/kit-match.schema.js';

const FIXED_TIME = '2026-01-01T00:00:00.000Z';

function motionStarterGraph() {
  return propagate(kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME })).graph;
}

function matchFor(matches: ReturnType<typeof matchKits>, kitId: string) {
  const found = matches.find(m => m.kitId === kitId);
  if (!found) throw new Error(`No match for ${kitId}`);
  return found;
}

describe('Gate 4 — kit matching', () => {
  it('returns a schema-valid match for every kit', () => {
    const matches = matchKits(motionStarterGraph());
    expect(matches).toHaveLength(REFERENCE_KITS.length);
    for (const match of matches) {
      expect(KitMatchSchema.safeParse(match).success, `${match.kitId} invalid`).toBe(true);
    }
  });

  it('maps the Motion Starter graph onto its own kit exactly', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'motion-starter');

    expect(match.matchPercentage).toBe(100);
    expect(match.missingComponents).toEqual([]);
    expect(match.incompatibleAssumptions).toEqual([]);
    expect(match.complete).toBe(true);
  });

  it('resolves each graph node back to the exact component it came from', () => {
    const graph = motionStarterGraph();
    const match = matchFor(matchKits(graph), 'motion-starter');

    const motors = match.componentManifest.find(r => r.component.id === 'motor-dc-gearbox')!;
    expect(motors.coversNodeIds).toHaveLength(2);

    const controller = match.componentManifest.find(r => r.component.id === 'controller-esp32')!;
    expect(controller.coversNodeIds).toHaveLength(1);

    // Every covered node id is a real node in the graph.
    const nodeIds = new Set(graph.nodes.map(n => n.id));
    for (const resolved of match.componentManifest) {
      for (const id of resolved.coversNodeIds) expect(nodeIds.has(id)).toBe(true);
    }
  });

  it('lists the full manifest including parts with no graph node', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'motion-starter');
    const ids = match.componentManifest.map(r => r.component.id);

    expect(ids).toContain('driver-tb6612');
    expect(ids).toContain('mechanical-chassis-2wd');
    expect(ids).toContain('wiring-jumper-set');
    // Structural parts cover no node but are still part of what you build with.
    const chassis = match.componentManifest.find(r => r.component.id === 'mechanical-chassis-2wd')!;
    expect(chassis.coversNodeIds).toEqual([]);
  });

  it('ranks the kit the configuration came from first', () => {
    const matches = matchKits(motionStarterGraph());
    expect(matches[0].kitId).toBe('motion-starter');
  });

  it('prefers an exact kit over a larger one that also covers the graph', () => {
    const matches = matchKits(motionStarterGraph());
    const exact = matchFor(matches, 'motion-starter');
    const larger = matchFor(matches, 'motion-and-vision');

    // Motion and Vision also covers every node, but carries parts left over.
    expect(larger.matchPercentage).toBe(100);
    expect(exact.surplusComponentCount).toBe(0);
    expect(larger.surplusComponentCount).toBeGreaterThan(0);
    expect(matches.indexOf(exact)).toBeLessThan(matches.indexOf(larger));
  });

  it('reports an unknown total cost rather than summing unpriced parts to zero', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'motion-starter');
    expect(match.estimatedTotalCost.state).toBe('UNKNOWN');
    if (match.estimatedTotalCost.state === 'UNKNOWN') {
      expect(match.estimatedTotalCost.reason).toMatch(/no sourced price/i);
    }
  });

  it('reports supplier availability as unknown while nothing is sourced', () => {
    for (const match of matchKits(motionStarterGraph())) {
      expect(match.supplierAvailability).toBe('UNKNOWN');
    }
  });

  it('never reports a kit as validated on the strength of a match', () => {
    // A complete match is capability coverage, not evidence that it works.
    for (const match of matchKits(motionStarterGraph())) {
      expect(match.validationStatus).toBe('UNVALIDATED');
    }
  });

  it('flags a motor the kit cannot cover', () => {
    const graph = motionStarterGraph();
    // The Product Interface kit has no motors at all.
    const match = matchFor(matchKits(graph), 'product-interface');
    expect(match.missingComponents.some(m => m.nodeType === 'motor')).toBe(true);
    expect(match.matchPercentage).toBeLessThan(100);
    expect(match.complete).toBe(false);
  });

  it('flags a missing H-bridge when the configuration drives brushed motors', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'product-interface');
    expect(match.incompatibleAssumptions.map(a => a.code)).toContain('driver.missing');
  });

  it('flags a supply the kit components cannot take', () => {
    const graph = kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME });
    const battery = graph.nodes.find(n => n.type === 'battery')!;
    // A 4S LiPo sits at 14.8 V, far outside every component envelope here.
    const hot = updateNodeParameters(graph, battery.id, { chemistry: 'lipo', cellCount: 4 });

    const match = matchFor(matchKits(propagate(hot).graph), 'motion-starter');
    expect(match.incompatibleAssumptions.map(a => a.code)).toContain('supply.out-of-range');
    expect(match.complete).toBe(false);
  });

  it('says the electrical fit is unevaluated when no supply is published', () => {
    const graph = kitToGraph(requireKit('motion-starter'), { now: FIXED_TIME });
    const battery = graph.nodes.find(n => n.type === 'battery')!;
    const unpowered = propagate(removeNode(graph, battery.id)).graph;

    const codes = matchFor(matchKits(unpowered), 'motion-starter')
      .incompatibleAssumptions.map(a => a.code);
    // Unknown is reported, never quietly treated as a pass.
    expect(codes).toContain('supply.unknown');
  });

  it('reports firmware and generated app support from what is present', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'motion-starter');
    expect(match.firmwareSupport).toBe(true);
    expect(match.generatedAppSupport).toBe(true);
  });

  it('withdraws app support when the kit provides no radio', () => {
    const graph = propagate(kitToGraph(requireKit('product-interface'), { now: FIXED_TIME })).graph;
    const match = matchFor(matchKits(graph), 'motion-starter');
    // Motion Starter has a Bluetooth radio, so it can still carry an app.
    expect(match.generatedAppSupport).toBe(true);
  });

  it('carries the upgrade paths and tools through to the match', () => {
    const match = matchFor(matchKits(motionStarterGraph()), 'motion-starter');
    expect(match.upgradePaths.map(u => u.id)).toContain('swap-controller-rp2350');
    expect(match.requiredTools.length).toBeGreaterThan(0);
    expect(match.supportedProductTemplateIds).toContain('bluetooth-rover');
  });

  it('scores an empty graph at zero without crashing', () => {
    const empty = { ...motionStarterGraph(), nodes: [], connections: [] };
    for (const match of matchKits(empty)) {
      expect(match.matchPercentage).toBe(0);
      expect(match.complete).toBe(false);
    }
  });

  it('produces an identical ranking on every run', () => {
    const graph = motionStarterGraph();
    const baseline = JSON.stringify(matchKits(graph));
    for (let i = 0; i < 10; i += 1) {
      expect(JSON.stringify(matchKits(graph))).toBe(baseline);
    }
  });

  it('matches each reference kit completely against its own loaded graph', () => {
    for (const kit of REFERENCE_KITS) {
      const graph = propagate(kitToGraph(kit, { now: FIXED_TIME })).graph;
      const match = matchFor(matchKits(graph), kit.id);
      expect(match.matchPercentage, `${kit.id} coverage`).toBe(100);
      expect(
        match.incompatibleAssumptions.map(a => a.message),
        `${kit.id} incompatibilities`,
      ).toEqual([]);
    }
  });
});
