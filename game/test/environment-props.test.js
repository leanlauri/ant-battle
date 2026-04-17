import { describe, expect, test } from 'vitest';
import { createEnvironmentalPropLayout, ENVIRONMENT_PROP_CONFIG } from '../src/environment-props.js';

const summarize = (layout) => layout.slice(0, 24).map((entry) => ({
  type: entry.type,
  x: Number(entry.position.x.toFixed(3)),
  z: Number(entry.position.z.toFixed(3)),
  sx: Number(entry.scale.x.toFixed(3)),
  sy: Number(entry.scale.y.toFixed(3)),
}));

describe('environment prop scatter', () => {
  test('is deterministic for the same seed/profile', () => {
    const terrainProfile = { width: 100, depth: 100, maxHeight: 4.4, noiseScale: 0.05, octaves: 4 };
    const nests = [{ position: { x: 0, z: 0 }, collapsed: false }];

    const layoutA = createEnvironmentalPropLayout({ seed: 'level-17', terrainProfile, nests });
    const layoutB = createEnvironmentalPropLayout({ seed: 'level-17', terrainProfile, nests });

    expect(layoutA.length).toBeGreaterThan(40);
    expect(summarize(layoutA)).toEqual(summarize(layoutB));
  });

  test('diverges with different seeds', () => {
    const terrainProfile = { width: 100, depth: 100, maxHeight: 4.4, noiseScale: 0.05, octaves: 4 };
    const nests = [{ position: { x: 0, z: 0 }, collapsed: false }];

    const layoutA = createEnvironmentalPropLayout({ seed: 'level-18-a', terrainProfile, nests });
    const layoutB = createEnvironmentalPropLayout({ seed: 'level-18-b', terrainProfile, nests });

    expect(summarize(layoutA)).not.toEqual(summarize(layoutB));
  });

  test('keeps props outside protected nest/center zones', () => {
    const terrainProfile = { width: 100, depth: 100, maxHeight: 4.2, noiseScale: 0.05, octaves: 4 };
    const nests = [
      { position: { x: 0, z: 0 }, collapsed: false },
      { position: { x: -26, z: -18 }, collapsed: false },
      { position: { x: 28, z: 22 }, collapsed: false },
    ];

    const layout = createEnvironmentalPropLayout({ seed: 'safety-zones', terrainProfile, nests });

    for (const entry of layout) {
      const centerDistance = Math.hypot(entry.position.x, entry.position.z);
      expect(centerDistance).toBeGreaterThan(ENVIRONMENT_PROP_CONFIG.protectedCenterRadius - 0.15);

      for (const nest of nests) {
        const nestDistance = Math.hypot(entry.position.x - nest.position.x, entry.position.z - nest.position.z);
        expect(nestDistance).toBeGreaterThan(ENVIRONMENT_PROP_CONFIG.protectedNestRadius - 0.15);
      }
    }
  });
});
