import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { TERRAIN_CONFIG, createTerrainGeometry, createTerrainHeightBandsMaterial, createTerrainMaterial, createTerrainOverlay, createTerrainRivers, findNearestBridgePosition, getTerrainEdgeAttenuation, getTerrainRivers, getTriangleCount, isPointInWater, sampleHeight, segmentCrossesWater } from '../src/terrain.js';

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
    expect(material.vertexColors).toBe(true);
    expect(material.gradientMap).toBeTruthy();
    expect(material.gradientMap.magFilter).toBe(THREE.NearestFilter);
    expect(material.gradientMap.minFilter).toBe(THREE.NearestFilter);
  });

  test('bakes terrain vertex colors so elevation and slope are more readable', () => {
    const geometry = createTerrainGeometry();
    const color = geometry.getAttribute('color');

    expect(color).toBeTruthy();
    expect(color.itemSize).toBe(3);
    expect(color.count).toBe(geometry.attributes.position.count);

    const swatchA = [color.getX(0), color.getY(0), color.getZ(0)];
    let foundVariation = false;
    for (let i = 1; i < Math.min(240, color.count); i += 1) {
      const diff = Math.abs(color.getX(i) - swatchA[0])
        + Math.abs(color.getY(i) - swatchA[1])
        + Math.abs(color.getZ(i) - swatchA[2]);
      if (diff > 0.02) {
        foundVariation = true;
        break;
      }
    }
    expect(foundVariation).toBe(true);
  });

  test('adds a lightweight wireframe overlay to clarify terrain shape', () => {
    const geometry = createTerrainGeometry();
    const overlay = createTerrainOverlay(geometry);

    expect(overlay.type).toBe('LineSegments');
    expect(overlay.material.opacity).toBeGreaterThan(0);
  });

  test('height-band shader starts green band lower by about one meter', () => {
    const material = createTerrainHeightBandsMaterial({ minHeight: -5, maxHeight: 5 });
    expect(material.uniforms.greenStartT.value).toBeCloseTo(0.56, 2);
  });

  test('builds small rivers with bridge crossings and blocks direct water crossing', () => {
    const rivers = getTerrainRivers();
    expect(rivers.length).toBeGreaterThanOrEqual(2);
    expect(rivers.some((river) => river.bridges.length > 0)).toBe(true);

    const bridge = findNearestBridgePosition(0, 0);
    expect(bridge).toBeTruthy();
    expect(isPointInWater(bridge.x, bridge.z)).toBe(false);

    const river = rivers.find((entry) => entry.axis === 'z') ?? rivers[0];
    const flow = THREE.MathUtils.lerp(river.flowRange.min, river.flowRange.max, 0.14);
    const extent = TERRAIN_CONFIG.width;
    const centerX = extent * river.offsetRatio
      + Math.sin(flow * river.frequency + river.phase) * extent * river.amplitudeRatio;
    const nearBankA = { x: centerX - 4.1, z: flow };
    const nearBankB = { x: centerX + 4.1, z: flow };
    expect(segmentCrossesWater(nearBankA, nearBankB)).toBe(true);
  });

  test('creates visible river and bridge meshes', () => {
    const riversGroup = createTerrainRivers();
    expect(riversGroup.children.length).toBeGreaterThan(3);
    const hasBridgeBox = riversGroup.children.some((child) => child.geometry?.type === 'BoxGeometry');
    expect(hasBridgeBox).toBe(true);
  });
});
