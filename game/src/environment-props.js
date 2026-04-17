import * as THREE from 'three';
import { createSeededRandom, deriveSeed } from './seeded-random.js';
import { sampleHeight } from './terrain.js';

export const ENVIRONMENT_PROP_CONFIG = Object.freeze({
  edgePadding: 4,
  protectedCenterRadius: 7,
  protectedNestRadius: 8,
  maxAttemptsMultiplier: 30,
  rockDensity: 0.0048,
  plantDensity: 0.013,
  maxRocks: 84,
  maxPlants: 220,
  minRocks: 26,
  minPlants: 70,
  rockSpacing: 1.9,
  plantSpacing: 0.82,
  visibleDistancePerspective: 78,
  visibleDistanceBattlefield: 66,
  updateInterval: 0.2,
});

const randomRange = (random, min, max) => min + random() * (max - min);

const toProtectedZones = (nests = [], baseRadius = ENVIRONMENT_PROP_CONFIG.protectedNestRadius) => nests
  .filter((nest) => !nest?.collapsed)
  .map((nest) => ({
    x: nest.position.x,
    z: nest.position.z,
    radius: baseRadius,
  }));

const isInsideBounds = (x, z, terrainProfile, edgePadding = ENVIRONMENT_PROP_CONFIG.edgePadding) => {
  const halfWidth = (terrainProfile?.width ?? 100) / 2;
  const halfDepth = (terrainProfile?.depth ?? 100) / 2;
  return (
    x >= -halfWidth + edgePadding
    && x <= halfWidth - edgePadding
    && z >= -halfDepth + edgePadding
    && z <= halfDepth - edgePadding
  );
};

const collidesWithProtectedZone = (x, z, radius, protectedZones = []) => {
  for (const zone of protectedZones) {
    const dx = x - zone.x;
    const dz = z - zone.z;
    const minDistance = radius + (zone.radius ?? 0);
    if ((dx * dx) + (dz * dz) < minDistance * minDistance) return true;
  }
  return false;
};

const collidesWithExistingProp = (x, z, radius, props = []) => {
  for (const prop of props) {
    const dx = x - prop.position.x;
    const dz = z - prop.position.z;
    const minDistance = radius + prop.clearance;
    if ((dx * dx) + (dz * dz) < minDistance * minDistance) return true;
  }
  return false;
};

const chooseType = (random) => (random() < 0.31 ? 'rock' : 'plant');

const createProp = (type, x, z, random, terrainProfile) => {
  const y = sampleHeight(x, z, terrainProfile);
  if (type === 'rock') {
    const scale = randomRange(random, 0.85, 2.2);
    return {
      type,
      position: new THREE.Vector3(x, y + 0.2 * scale, z),
      rotationY: random() * Math.PI * 2,
      scale: new THREE.Vector3(
        scale * randomRange(random, 0.85, 1.25),
        scale * randomRange(random, 0.64, 1.1),
        scale * randomRange(random, 0.85, 1.2),
      ),
      clearance: ENVIRONMENT_PROP_CONFIG.rockSpacing * (0.65 + scale * 0.25),
      colorShift: randomRange(random, -0.08, 0.06),
    };
  }

  const scale = randomRange(random, 0.58, 1.46);
  return {
    type,
    position: new THREE.Vector3(x, y + 0.05, z),
    rotationY: random() * Math.PI * 2,
    scale: new THREE.Vector3(
      scale * randomRange(random, 0.72, 1.1),
      scale * randomRange(random, 0.8, 1.35),
      scale * randomRange(random, 0.72, 1.1),
    ),
    clearance: ENVIRONMENT_PROP_CONFIG.plantSpacing * (0.7 + scale * 0.2),
    colorShift: randomRange(random, -0.1, 0.08),
  };
};

export const createEnvironmentalPropLayout = ({
  seed,
  terrainProfile,
  nests = [],
} = {}) => {
  const random = createSeededRandom(deriveSeed(seed ?? 'ant-battle', 'terrain-props'));
  const width = terrainProfile?.width ?? 100;
  const depth = terrainProfile?.depth ?? 100;
  const area = width * depth;
  const targetRocks = THREE.MathUtils.clamp(Math.round(area * ENVIRONMENT_PROP_CONFIG.rockDensity), ENVIRONMENT_PROP_CONFIG.minRocks, ENVIRONMENT_PROP_CONFIG.maxRocks);
  const targetPlants = THREE.MathUtils.clamp(Math.round(area * ENVIRONMENT_PROP_CONFIG.plantDensity), ENVIRONMENT_PROP_CONFIG.minPlants, ENVIRONMENT_PROP_CONFIG.maxPlants);
  const targetTotal = targetRocks + targetPlants;
  const maxAttempts = targetTotal * ENVIRONMENT_PROP_CONFIG.maxAttemptsMultiplier;

  const protectedZones = [
    { x: 0, z: 0, radius: ENVIRONMENT_PROP_CONFIG.protectedCenterRadius },
    ...toProtectedZones(nests),
  ];

  const props = [];
  let rockCount = 0;
  let plantCount = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (rockCount >= targetRocks && plantCount >= targetPlants) break;

    let type = chooseType(random);
    if (type === 'rock' && rockCount >= targetRocks) type = 'plant';
    if (type === 'plant' && plantCount >= targetPlants) type = 'rock';

    const x = randomRange(random, -width / 2, width / 2);
    const z = randomRange(random, -depth / 2, depth / 2);
    const baseRadius = type === 'rock' ? ENVIRONMENT_PROP_CONFIG.rockSpacing : ENVIRONMENT_PROP_CONFIG.plantSpacing;

    if (!isInsideBounds(x, z, terrainProfile)) continue;
    if (collidesWithProtectedZone(x, z, baseRadius, protectedZones)) continue;
    if (collidesWithExistingProp(x, z, baseRadius, props)) continue;

    const prop = createProp(type, x, z, random, terrainProfile);
    props.push(prop);
    if (type === 'rock') rockCount += 1;
    else plantCount += 1;
  }

  return props;
};

const createRockMesh = (maxCount) => {
  const geometry = new THREE.DodecahedronGeometry(0.46, 0);
  const material = new THREE.MeshToonMaterial({ color: 0x8e9cb2 });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, maxCount));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
};

const createPlantMesh = (maxCount) => {
  const geometry = new THREE.ConeGeometry(0.22, 0.58, 6, 1);
  const material = new THREE.MeshToonMaterial({ color: 0x607f58 });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, maxCount));
  mesh.castShadow = false;
  mesh.receiveShadow = true;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  return mesh;
};

export class EnvironmentalPropsSystem {
  constructor({ scene, seed, terrainProfile, nests = [] } = {}) {
    this.scene = scene;
    this.layout = createEnvironmentalPropLayout({ seed, terrainProfile, nests });
    this.group = new THREE.Group();
    this.tempMatrix = new THREE.Matrix4();
    this.tempQuaternion = new THREE.Quaternion();
    this.tempScale = new THREE.Vector3();
    this.tempColor = new THREE.Color();
    this.elapsed = ENVIRONMENT_PROP_CONFIG.updateInterval;

    this.rockEntries = this.layout.filter((entry) => entry.type === 'rock');
    this.plantEntries = this.layout.filter((entry) => entry.type === 'plant');

    this.rockMesh = createRockMesh(this.rockEntries.length);
    this.plantMesh = createPlantMesh(this.plantEntries.length);
    this.group.add(this.rockMesh);
    this.group.add(this.plantMesh);
    this.scene.add(this.group);

    this.update(null, 0, true);
  }

  getCounts() {
    return {
      total: this.layout.length,
      rocks: this.rockEntries.length,
      plants: this.plantEntries.length,
    };
  }

  getVisibleDistance(camera) {
    if (!camera) return ENVIRONMENT_PROP_CONFIG.visibleDistancePerspective;
    if (camera.isOrthographicCamera) {
      return THREE.MathUtils.clamp(
        ENVIRONMENT_PROP_CONFIG.visibleDistanceBattlefield / Math.max(0.6, camera.zoom ?? 1),
        22,
        88,
      );
    }
    return ENVIRONMENT_PROP_CONFIG.visibleDistancePerspective;
  }

  applyEntries(entries, mesh, baseColor, cameraPosition, maxDistanceSq) {
    let count = 0;
    for (const entry of entries) {
      if (cameraPosition) {
        const dx = entry.position.x - cameraPosition.x;
        const dz = entry.position.z - cameraPosition.z;
        if ((dx * dx) + (dz * dz) > maxDistanceSq) continue;
      }

      this.tempQuaternion.setFromEuler(new THREE.Euler(0, entry.rotationY, 0));
      this.tempScale.copy(entry.scale);
      this.tempMatrix.compose(entry.position, this.tempQuaternion, this.tempScale);
      mesh.setMatrixAt(count, this.tempMatrix);

      this.tempColor.copy(baseColor);
      this.tempColor.offsetHSL(0, 0, entry.colorShift);
      mesh.setColorAt(count, this.tempColor);
      count += 1;
    }

    mesh.count = count;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  update(camera, dt = 0, force = false) {
    this.elapsed += dt;
    if (!force && this.elapsed < ENVIRONMENT_PROP_CONFIG.updateInterval) return;
    this.elapsed = 0;

    const visibleDistance = this.getVisibleDistance(camera);
    const maxDistanceSq = visibleDistance * visibleDistance;
    const cameraPosition = camera?.position ?? null;

    this.applyEntries(this.rockEntries, this.rockMesh, new THREE.Color(0x8e9cb2), cameraPosition, maxDistanceSq);
    this.applyEntries(this.plantEntries, this.plantMesh, new THREE.Color(0x607f58), cameraPosition, maxDistanceSq);
  }

  dispose() {
    if (this.group?.parent) this.group.parent.remove(this.group);
    for (const mesh of [this.rockMesh, this.plantMesh]) {
      mesh?.geometry?.dispose?.();
      mesh?.material?.dispose?.();
    }
  }
}
