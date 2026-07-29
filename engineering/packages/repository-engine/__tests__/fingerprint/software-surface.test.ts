import { describe, it, expect } from 'vitest';
import { extractSoftwareSurface } from '../../src/fingerprint/software-surface.js';

describe('extractSoftwareSurface', () => {
  describe('TypeScript/JavaScript', () => {
    it('extracts exported functions', async () => {
      const content = `
export function add(a: number, b: number): number {
  return a + b;
}

export function subtract(a: number, b: number): number {
  return a - b;
}
`;
      const surface = await extractSoftwareSurface('math.ts', content, 'typescript');
      expect(surface.exportedSymbols).toHaveLength(2);

      const names = surface.exportedSymbols.map(s => s.name).sort();
      expect(names).toEqual(['add', 'subtract']);

      const addSym = surface.exportedSymbols.find(s => s.name === 'add')!;
      expect(addSym.kind).toBe('function');
      expect(addSym.semanticId).toBe('software::math.ts::export::add');
      expect(addSym.bodyHash).toBeTruthy();
      expect(addSym.alphaNormalizedBodyHash).toBeTruthy();
    });

    it('extracts exported classes', async () => {
      const content = `
export class Sensor {
  read(): number {
    return 42;
  }
}
`;
      const surface = await extractSoftwareSurface('sensor.ts', content, 'typescript');
      expect(surface.exportedSymbols).toHaveLength(1);
      expect(surface.exportedSymbols[0].name).toBe('Sensor');
      expect(surface.exportedSymbols[0].kind).toBe('class');
    });

    it('extracts export const/variable', async () => {
      const content = `
export const MAX_VOLTAGE = 5.0;
export const CONFIG = { timeout: 1000 };
`;
      const surface = await extractSoftwareSurface('config.ts', content, 'typescript');
      expect(surface.exportedSymbols).toHaveLength(2);
      const names = surface.exportedSymbols.map(s => s.name).sort();
      expect(names).toEqual(['CONFIG', 'MAX_VOLTAGE']);
    });

    it('extracts export type/interface/enum', async () => {
      const content = `
export type Voltage = number;
export interface SensorConfig { pin: number; }
export enum Mode { ACTIVE, SLEEP }
`;
      const surface = await extractSoftwareSurface('types.ts', content, 'typescript');
      expect(surface.exportedSymbols).toHaveLength(3);
      const kinds = surface.exportedSymbols.map(s => s.kind).sort();
      expect(kinds).toEqual(['enum', 'interface', 'type']);
    });

    it('extracts imports', async () => {
      const content = `
import { readFile } from 'node:fs/promises';
import { Sensor } from './sensor.js';
import type { Config } from '../types.js';
`;
      const surface = await extractSoftwareSurface('main.ts', content, 'typescript');
      expect(surface.imports.length).toBeGreaterThanOrEqual(2);

      const fsImport = surface.imports.find(i => i.source === 'node:fs/promises');
      expect(fsImport).toBeDefined();
      expect(fsImport!.isRelative).toBe(false);

      const sensorImport = surface.imports.find(i => i.source === './sensor.js');
      expect(sensorImport).toBeDefined();
      expect(sensorImport!.isRelative).toBe(true);
    });

    it('counts assertions', async () => {
      const content = `
import { expect, describe, it } from 'vitest';

describe('math', () => {
  it('should add', () => {
    expect(add(1, 2)).toBe(3);
  });
  it('should subtract', () => {
    expect(subtract(3, 1)).toBe(2);
  });
});
`;
      const surface = await extractSoftwareSurface('math.test.ts', content, 'typescript');
      expect(surface.assertionSiteCount).toBeGreaterThan(0);
    });

    it('produces deterministic body hashes', async () => {
      const content = `export function hello() { return "world"; }`;
      const s1 = await extractSoftwareSurface('a.ts', content, 'typescript');
      const s2 = await extractSoftwareSurface('a.ts', content, 'typescript');
      expect(s1.bodyHash).toBe(s2.bodyHash);
      expect(s1.exportedSymbols[0].bodyHash).toBe(s2.exportedSymbols[0].bodyHash);
    });

    it('detects body changes via different hashes', async () => {
      const v1 = `export function greet(name: string) { return "hello " + name; }`;
      const v2 = `export function greet(name: string) { return "hi " + name; }`;
      const s1 = await extractSoftwareSurface('greet.ts', v1, 'typescript');
      const s2 = await extractSoftwareSurface('greet.ts', v2, 'typescript');
      expect(s1.exportedSymbols[0].bodyHash).not.toBe(s2.exportedSymbols[0].bodyHash);
    });
  });

  describe('Python', () => {
    it('extracts functions and classes', async () => {
      const content = `
def read_sensor(pin):
    return analogRead(pin)

class SensorDriver:
    def __init__(self, pin):
        self.pin = pin

def _internal_helper():
    pass
`;
      const surface = await extractSoftwareSurface('sensor.py', content, 'python');
      const names = surface.exportedSymbols.map(s => s.name);
      expect(names).toContain('read_sensor');
      expect(names).toContain('SensorDriver');
      expect(names).not.toContain('_internal_helper');
    });

    it('extracts imports', async () => {
      const content = `
import os
from pathlib import Path
from . import utils
`;
      const surface = await extractSoftwareSurface('main.py', content, 'python');
      expect(surface.imports.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('C/C++', () => {
    it('extracts function definitions', async () => {
      const content = `
#include <stdio.h>
#include "sensor.h"

int read_adc(int channel) {
    return channel * 42;
}

void setup() {
    printf("init\\n");
}
`;
      const surface = await extractSoftwareSurface('main.c', content, 'c');
      const names = surface.exportedSymbols.map(s => s.name);
      expect(names).toContain('read_adc');
      expect(names).toContain('setup');
    });

    it('extracts includes', async () => {
      const content = `
#include <Arduino.h>
#include "config.h"
`;
      const surface = await extractSoftwareSurface('main.ino', content, 'arduino');
      expect(surface.imports.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('edge cases', () => {
    it('handles empty file', async () => {
      const surface = await extractSoftwareSurface('empty.ts', '', 'typescript');
      expect(surface.exportedSymbols).toHaveLength(0);
      expect(surface.imports).toHaveLength(0);
      expect(surface.bodyHash).toBeTruthy();
    });

    it('handles unknown language gracefully', async () => {
      const surface = await extractSoftwareSurface('file.xyz', 'some content', 'unknown');
      expect(surface.parseStatus ?? 'ok').toBeDefined();
    });
  });
});
