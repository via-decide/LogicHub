import { describe, it, expect } from 'vitest';
import { REFERENCE_KITS, getKit, requireKit } from '../src/kits/index.js';
import { PhysicalKitDefinitionSchema } from '../src/schemas/kit.schema.js';
import { getComponent } from '../src/catalogue/components.js';

describe('Gate 4 — reference kit definitions', () => {
  it('defines the canonical kits', () => {
    expect(REFERENCE_KITS).toHaveLength(16);
    expect(REFERENCE_KITS.map(k => k.id)).toEqual([
      'motion-starter',
      'environment-starter',
      'motion-and-vision',
      'product-interface',
      'electronics_research_bundle',
      'drone_cad_implementation_bundle',
      'pupper_v3_open_source_research_bundle',
      'farmbot_open_source_research_bundle',
      'openflexure_microscope_research_bundle',
      'satnogs_ground_station_research_bundle',
      'voron_3d_printer_engineering_bundle',
      'openevse_research_bundle',
      'openmv_openipc_local_vision_bundle',
      'riscv_edge_beaglev_fire_milkv_duo_bundle',
      'precious_plastic_machine_ecosystem_bundle',
      'nasa_jpl_rover_openamrobot_research_bundle',
    ]);
  });

  it('validates every kit against the schema', () => {
    for (const kit of REFERENCE_KITS) {
      const result = PhysicalKitDefinitionSchema.safeParse(kit);
      expect(result.success, `${kit.id} failed schema validation`).toBe(true);
    }
  });

  it('references only components that exist in the catalogue', () => {
    for (const kit of REFERENCE_KITS) {
      for (const ref of kit.components) {
        expect(getComponent(ref.componentId), `${kit.id} -> ${ref.componentId}`).toBeDefined();
      }
      for (const upgrade of kit.upgradeOptions) {
        expect(getComponent(upgrade.withComponentId)).toBeDefined();
        if (upgrade.replacesComponentId !== null) {
          expect(getComponent(upgrade.replacesComponentId)).toBeDefined();
        }
      }
    }
  });

  it('only offers to replace a component the kit actually contains', () => {
    for (const kit of REFERENCE_KITS) {
      const present = new Set(kit.components.map(c => c.componentId));
      for (const upgrade of kit.upgradeOptions) {
        if (upgrade.replacesComponentId === null) continue;
        expect(present.has(upgrade.replacesComponentId), `${kit.id}/${upgrade.id}`).toBe(true);
      }
    }
  });

  it('marks every kit unvalidated, because none has been built', () => {
    for (const kit of REFERENCE_KITS) {
      expect(kit.validationStatus).toBe('UNVALIDATED');
    }
  });

  it('requires recalculation after any component swap', () => {
    // Substituting a part invalidates the compatibility evaluation done for
    // the part it replaces, so the graph must be recomputed.
    for (const kit of REFERENCE_KITS) {
      for (const upgrade of kit.upgradeOptions) {
        expect(upgrade.requiresRecalculation).toBe(true);
      }
    }
  });

  it('gives every kit assembly steps, a test procedure and tools', () => {
    for (const kit of REFERENCE_KITS) {
      expect(kit.assemblySteps.length).toBeGreaterThan(0);
      expect(kit.testProcedure.length).toBeGreaterThan(0);
      expect(kit.requiredTools.length).toBeGreaterThan(0);
    }
  });

  it('numbers assembly and test steps consecutively from one', () => {
    for (const kit of REFERENCE_KITS) {
      expect(kit.assemblySteps.map(s => s.order))
        .toEqual(kit.assemblySteps.map((_, i) => i + 1));
      expect(kit.testProcedure.map(s => s.order))
        .toEqual(kit.testProcedure.map((_, i) => i + 1));
    }
  });

  it('states an expected result for every test step', () => {
    // A check with no stated pass condition cannot be passed.
    for (const kit of REFERENCE_KITS) {
      for (const step of kit.testProcedure) {
        expect(step.expected.length).toBeGreaterThan(0);
      }
    }
  });

  it('cautions about polarity wherever a battery is connected', () => {
    for (const kit of REFERENCE_KITS) {
      const batterySteps = kit.assemblySteps.filter(s => /batter/i.test(s.instruction));
      expect(batterySteps.length).toBeGreaterThan(0);
      const cautions = batterySteps.flatMap(s => s.cautions).join(' ');
      expect(cautions).toMatch(/polarity/i);
    }
  });

  it('keeps the Motion Starter kit to the products the scope names', () => {
    const kit = requireKit('motion-starter');
    for (const templateId of [
      'bluetooth-rover', 'line-follower', 'obstacle-avoider',
      'camera-slider', 'conveyor-controller',
    ]) {
      expect(kit.supportedProductTemplateIds).toContain(templateId);
    }
  });

  it('warns that the relay kit must not be used at mains voltage', () => {
    const kit = requireKit('environment-starter');
    const cautions = kit.assemblySteps.flatMap(s => s.cautions).join(' ');
    expect(cautions).toMatch(/[Mm]ains-voltage switching is out of scope/);
  });

  it('returns undefined for an unknown kit and throws on require', () => {
    expect(getKit('nope')).toBeUndefined();
    expect(() => requireKit('nope')).toThrow(/Unknown kit/);
  });
});
