import { describe, it, expect } from 'vitest';
import { REFERENCE_KITS, requireKit } from '../src/kits/index.js';
import { PRODUCT_TEMPLATES } from '../../product-graph/src/discovery/templates.js';

describe('Gate 4 — research bundles', () => {
  it('resolves all supportedProductTemplateIds to real templates', () => {
    const validTemplateIds = new Set(PRODUCT_TEMPLATES.map(t => t.id));
    for (const kit of REFERENCE_KITS) {
      for (const templateId of kit.supportedProductTemplateIds) {
        expect(validTemplateIds.has(templateId), `${kit.id} uses unknown template: ${templateId}`).toBe(true);
      }
    }
  });

  it('exposes stepper components for the Voron 3D printer kit', () => {
    const voron = requireKit('voron_3d_printer_engineering_bundle');
    const componentIds = voron.components.map(c => c.componentId);
    expect(componentIds).toContain('motor-stepper');
    expect(componentIds).toContain('driver-stepper');
  });

  it('exposes the high-voltage contactor for the OpenEVSE research kit', () => {
    const evse = requireKit('openevse_research_bundle');
    const componentIds = evse.components.map(c => c.componentId);
    expect(componentIds).toContain('actuator-contactor');
    expect(componentIds).toContain('sensor-current');
  });

  it('exposes global shutter camera for OpenMV vision kit', () => {
    const openmv = requireKit('openmv_openipc_local_vision_bundle');
    const componentIds = openmv.components.map(c => c.componentId);
    expect(componentIds).toContain('camera-global-shutter');
  });

  it('exposes the SDR receiver for the SatNOGS ground station', () => {
    const satnogs = requireKit('satnogs_ground_station_research_bundle');
    const componentIds = satnogs.components.map(c => c.componentId);
    expect(componentIds).toContain('radio-sdr');
  });
  
  it('assigns applicable tools to all reference kits', () => {
    for (const kit of REFERENCE_KITS) {
      expect(kit.applicableToolIds.length).toBeGreaterThan(0);
      for (const toolId of kit.applicableToolIds) {
        expect(toolId).toMatch(/^T\d{2}$/);
      }
    }
  });
});
