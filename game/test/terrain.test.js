import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { TERRAIN_CONFIG, createTerrainGeometry, createTerrainMaterial, createTerrainOverlay, getTerrainEdgeAttenuation, getTriangleCount, sampleHeight } from '../src/terrain.js';

describe('terrain bootstrap helpers', () => {
  test('creates a densely triangulated X/Z ground plane', () => {
    const geometry = createTerrainGeometry({
      width: TERRAIN_CONFIG.width,
      depth: TERRAIN_CONFIG.depth,
      widthSegments: TERRAIN_CONFIG.widthSegments,
      depthSegments: TERRAIN_CONFIG.depthSegments,
      maxHeight: TERRAIN_CONFIG.maxHeight,
    });
    geometry.computeBoundingBox();

    expect(getTriangleCount(geometry)).toBe(TERRAIN_CONFIG.widthSegments * TERRAIN_CONFIG.depthSegments * 2);
    expect(geometry.boundingBox.min.x).toBeCloseTo(-50, 5);
    expect(geometry.boundingBox.max.x).toBeCloseTo(50, 5);
    expect(geometry.boundingBox.min.z).toBeCloseTo(-50, 5);
    expect(geometry.boundingBox.max.z).toBeCloseTo(50, 5);
    expect(geometry.boundingBox.min.y).toBeGreaterThanOrEqual(-TERRAIN_CONFIG.maxHeight - 0.001);
    expect(geometry.boundingBox.max.y).toBeLessThanOrEqual(TERRAIN_CONFIG.maxHeight + 0.001);
    expect(geometry.boundingBox.max.y - geometry.boundingBox.min.y).toBeGreaterThan(4);
  });

  test('softens terrain relief near the outer rim to keep battlefield edges readable', () => {
    const centerAttenuation = getTerrainEdgeAttenuation(0, 0);
    const edgeAttenuation = getTerrainEdgeAttenuation(TERRAIN_CONFIG.width / 2, TERRAIN_CONFIG.depth / 2);

    expect(centerAttenuation).toBeCloseTo(1, 5);
    expect(edgeAttenuation).toBeLessThan(0.3);

    const nearEdgeHeight = Math.abs(sampleHeight(TERRAIN_CONFIG.width / 2, 0));
    const unattenuatedNearEdgeHeight = Math.abs(sampleHeight(TERRAIN_CONFIG.width / 2, 0, {
      edgeFadeStart: 1,
      edgeHeightScale: 1,
    }));
    expect(nearEdgeHeight).toBeLessThan(unattenuatedNearEdgeHeight * 0.3);
  });

  test('uses nearest-filtered gradient steps for toon shading', () => {
    const material = createTerrainMaterial();

    expect(material.type).toBe('MeshToonMaterial');
    expect(material.gradientMap).toBeTruthy();
    expect(material.gradientMap.magFilter).toBe(THREE.NearestFilter);
    expect(material.gradientMap.minFilter).toBe(THREE.NearestFilter);
  });

  test('adds a lightweight wireframe overlay to clarify terrain shape', () => {
    const geometry = createTerrainGeometry();
    const overlay = createTerrainOverlay(geometry);

    expect(overlay.type).toBe('LineSegments');
    expect(overlay.material.opacity).toBeGreaterThan(0);
  });
});
