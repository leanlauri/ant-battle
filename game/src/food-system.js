import * as THREE from 'three';
import { TERRAIN_CONFIG, sampleHeight } from './terrain.js';

export const FOOD_CONFIG = Object.freeze({
  count: 28,
  senseDistance: 24,
  size: 0.3,
  sizeMinScale: 0.85,
  sizeMaxScale: 2.4,
  pickupDistance: 0.7,
  regrowDelayMin: 8,
  regrowDelayMax: 16,
});

export const NEST_CONFIG = Object.freeze({
  radius: 2.4,
  rimHeight: 0.5,
  dropoffDistance: 1.6,
  queueRadius: 3.8,
  entranceRadius: 1.2,
  queueSlots: 6,
  position: new THREE.Vector3(0, 0, 0),
});

const randomRange = (min, max) => min + Math.random() * (max - min);

const deriveFoodWeight = (sizeScale) => {
  const normalized = (sizeScale - FOOD_CONFIG.sizeMinScale) / (FOOD_CONFIG.sizeMaxScale - FOOD_CONFIG.sizeMinScale);
  const clamped = THREE.MathUtils.clamp(normalized, 0, 1);
  const requiredCarriers = 1 + Math.round(clamped * 3);
  return {
    sizeScale,
    weight: THREE.MathUtils.lerp(1, 4.2, clamped),
    requiredCarriers,
  };
};

const randomFoodPosition = (sizeScale = 1) => {
  const x = randomRange(-TERRAIN_CONFIG.width / 2 + 2, TERRAIN_CONFIG.width / 2 - 2);
  const z = randomRange(-TERRAIN_CONFIG.depth / 2 + 2, TERRAIN_CONFIG.depth / 2 - 2);
  const y = sampleHeight(x, z) + FOOD_CONFIG.size * sizeScale * 0.55;
  return new THREE.Vector3(x, y, z);
};

export const createFoodItems = (count = FOOD_CONFIG.count) => {
  const foods = [];
  for (let i = 0; i < count; i += 1) {
    const sizeScale = randomRange(FOOD_CONFIG.sizeMinScale, FOOD_CONFIG.sizeMaxScale);
    const profile = deriveFoodWeight(sizeScale);
    foods.push({
      id: i,
      position: randomFoodPosition(sizeScale),
      sizeScale,
      weight: profile.weight,
      requiredCarriers: profile.requiredCarriers,
      claimedBy: null,
      carriedBy: null,
      supportAntIds: [],
      delivered: false,
      carried: false,
      regrowAt: null,
    });
  }
  return foods;
};

export const getNestPosition = () => {
  const x = NEST_CONFIG.position.x;
  const z = NEST_CONFIG.position.z;
  return new THREE.Vector3(x, sampleHeight(x, z), z);
};

export const getFoodCarryFactor = (food) => {
  const supportCount = Math.max(0, food.supportAntIds?.length ?? 0);
  const ratio = food.requiredCarriers > 0 ? supportCount / food.requiredCarriers : 1;
  return THREE.MathUtils.clamp(0.16 + ratio * 0.84, 0.16, 1);
};

export const findNearestFood = (foods, position, maxDistance = FOOD_CONFIG.senseDistance) => {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;

  for (const food of foods) {
    if (food.delivered || food.carried) continue;
    const distanceSq = position.distanceToSquared(food.position);
    if (distanceSq <= nearestDistanceSq) {
      nearest = food;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};

export const findNearestCarryAssistFood = (foods, position, maxDistance = FOOD_CONFIG.senseDistance) => {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;

  for (const food of foods) {
    if (!food.carried || food.delivered) continue;
    if ((food.supportAntIds?.length ?? 0) >= food.requiredCarriers) continue;
    const distanceSq = position.distanceToSquared(food.position);
    if (distanceSq <= nearestDistanceSq) {
      nearest = food;
      nearestDistanceSq = distanceSq;
    }
  }

  return nearest;
};

export const getFoodById = (foods, foodId) => foods.find((food) => food.id === foodId) ?? null;

const createFoodVisual = (food) => {
  const group = new THREE.Group();
  const foodMaterial = new THREE.MeshToonMaterial({ color: 0xc84b31 });
  const leafMaterial = new THREE.MeshToonMaterial({ color: 0x3e7f4a });

  const berry = new THREE.Mesh(new THREE.IcosahedronGeometry(FOOD_CONFIG.size * food.sizeScale, 0), foodMaterial);
  berry.castShadow = true;
  berry.receiveShadow = true;
  group.add(berry);

  const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.08 * food.sizeScale, 0.18 * food.sizeScale, 5), leafMaterial);
  leaf.position.y = 0.22 * food.sizeScale;
  leaf.rotation.z = 0.3;
  leaf.castShadow = true;
  group.add(leaf);

  return group;
};

const createNestVisual = () => {
  const group = new THREE.Group();
  const debugGroup = new THREE.Group();
  const nestBaseY = sampleHeight(NEST_CONFIG.position.x, NEST_CONFIG.position.z);
  const nestMaterial = new THREE.MeshToonMaterial({ color: 0x8b5a2b });
  const innerMaterial = new THREE.MeshToonMaterial({ color: 0x5a3414 });
  const queueMaterial = new THREE.MeshToonMaterial({ color: 0xffd54f });
  const entranceMaterial = new THREE.MeshToonMaterial({ color: 0x00e5ff });
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });

  const mound = new THREE.Mesh(new THREE.ConeGeometry(NEST_CONFIG.radius * 1.25, NEST_CONFIG.radius * 1.3, 28, 1), nestMaterial);
  mound.position.y = (NEST_CONFIG.radius * 1.3) * 0.5;
  mound.castShadow = true;
  mound.receiveShadow = true;
  group.add(mound);

  const moundBase = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 1.05, NEST_CONFIG.radius * 1.2, 0.18, 28), nestMaterial);
  moundBase.position.y = 0.09;
  moundBase.castShadow = true;
  moundBase.receiveShadow = true;
  group.add(moundBase);

  const entrance = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 0.36, NEST_CONFIG.radius * 0.42, 0.14, 18), innerMaterial);
  entrance.position.set(0, 0.08, NEST_CONFIG.radius * 0.18);
  entrance.receiveShadow = true;
  group.add(entrance);

  for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
    const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
    const queueMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), queueMaterial);
    const queueX = Math.cos(angle) * NEST_CONFIG.queueRadius;
    const queueZ = Math.sin(angle) * NEST_CONFIG.queueRadius;
    const queueWorldX = NEST_CONFIG.position.x + queueX;
    const queueWorldZ = NEST_CONFIG.position.z + queueZ;
    const queueLocalY = sampleHeight(queueWorldX, queueWorldZ) - nestBaseY;
    queueMarker.position.set(queueX, queueLocalY + 0.22, queueZ);
    queueMarker.castShadow = false;
    queueMarker.receiveShadow = false;
    debugGroup.add(queueMarker);

    const entranceMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), entranceMaterial);
    const entranceX = Math.cos(angle) * NEST_CONFIG.entranceRadius;
    const entranceZ = Math.sin(angle) * NEST_CONFIG.entranceRadius;
    const entranceWorldX = NEST_CONFIG.position.x + entranceX;
    const entranceWorldZ = NEST_CONFIG.position.z + entranceZ;
    const entranceLocalY = sampleHeight(entranceWorldX, entranceWorldZ) - nestBaseY;
    entranceMarker.position.set(entranceX, entranceLocalY + 0.28, entranceZ);
    entranceMarker.castShadow = false;
    entranceMarker.receiveShadow = false;
    debugGroup.add(entranceMarker);

    const pathGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(queueX, queueLocalY + 0.32, queueZ),
      new THREE.Vector3(entranceX, entranceLocalY + 0.32, entranceZ),
    ]);
    const pathLine = new THREE.Line(pathGeometry, pathMaterial);
    debugGroup.add(pathLine);
  }

  group.add(debugGroup);
  group.userData.debugGroup = debugGroup;

  return group;
};

const computeNestScale = (nestStored) => 1 + Math.min(0.85, nestStored * 0.012);

export class FoodSystem {
  constructor({ scene, count = FOOD_CONFIG.count } = {}) {
    this.items = createFoodItems(count);
    this.meshes = [];
    this.nestStored = 0;
    this.nestPosition = getNestPosition();
    this.nestMesh = createNestVisual();
    this.nestMesh.position.copy(this.nestPosition);
    scene.add(this.nestMesh);
    this.queueAssignments = new Map();
    this.updateNestVisual();

    for (const food of this.items) {
      const mesh = createFoodVisual(food);
      mesh.position.copy(food.position);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  claimFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.claimedBy = antId;
    return true;
  }

  joinCarry(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.delivered) return false;
    if (!food.supportAntIds.includes(antId)) food.supportAntIds.push(antId);
    return true;
  }

  leaveCarry(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food) return;
    food.supportAntIds = food.supportAntIds.filter((id) => id !== antId);
  }

  pickUpFood(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.carried = true;
    food.carriedBy = antId;
    food.claimedBy = antId;
    food.supportAntIds = [antId];
    return true;
  }

  reserveNestSlot(antId, antPosition) {
    if (this.queueAssignments.has(antId)) return this.queueAssignments.get(antId);
    const candidates = [];
    for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
      const occupied = [...this.queueAssignments.values()].some((slot) => slot.index === i);
      if (occupied) continue;
      const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
      const queuePosition = new THREE.Vector3(
        this.nestPosition.x + Math.cos(angle) * NEST_CONFIG.queueRadius,
        sampleHeight(
          this.nestPosition.x + Math.cos(angle) * NEST_CONFIG.queueRadius,
          this.nestPosition.z + Math.sin(angle) * NEST_CONFIG.queueRadius,
        ),
        this.nestPosition.z + Math.sin(angle) * NEST_CONFIG.queueRadius,
      );
      const entrancePosition = new THREE.Vector3(
        this.nestPosition.x + Math.cos(angle) * NEST_CONFIG.entranceRadius,
        sampleHeight(
          this.nestPosition.x + Math.cos(angle) * NEST_CONFIG.entranceRadius,
          this.nestPosition.z + Math.sin(angle) * NEST_CONFIG.entranceRadius,
        ),
        this.nestPosition.z + Math.sin(angle) * NEST_CONFIG.entranceRadius,
      );
      candidates.push({ index: i, queuePosition, entrancePosition, distanceSq: antPosition.distanceToSquared(queuePosition) });
    }
    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    const chosen = candidates[0] ?? {
      index: 0,
      queuePosition: this.nestPosition.clone(),
      entrancePosition: this.nestPosition.clone(),
    };
    this.queueAssignments.set(antId, chosen);
    return chosen;
  }

  releaseNestSlot(antId) {
    this.queueAssignments.delete(antId);
  }

  dropFoodInNest(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.carriedBy !== antId) return false;
    food.delivered = true;
    food.carried = false;
    food.carriedBy = null;
    food.claimedBy = null;
    food.supportAntIds = [];
    food.regrowAt = randomRange(FOOD_CONFIG.regrowDelayMin, FOOD_CONFIG.regrowDelayMax);
    this.nestStored += food.weight;
    this.releaseNestSlot(antId);
    this.updateNestVisual();
    return true;
  }

  updateNestVisual() {
    const scale = computeNestScale(this.nestStored);
    this.nestMesh.scale.set(scale, 1 + (scale - 1) * 1.4, scale);
    this.nestMesh.position.set(this.nestPosition.x, this.nestPosition.y, this.nestPosition.z);
  }

  setDebugVisualsVisible(visible) {
    const debugGroup = this.nestMesh?.userData?.debugGroup;
    if (debugGroup) debugGroup.visible = !!visible;
  }

  syncCarriedFood(foodId, carrierPosition) {
    const foodIndex = this.items.findIndex((item) => item.id === foodId);
    if (foodIndex === -1) return;
    const food = this.items[foodIndex];
    const mesh = this.meshes[foodIndex];
    if (!food || !mesh || !food.carried) return;
    food.position.copy(carrierPosition);
    mesh.position.copy(carrierPosition);
    mesh.position.y += 0.22 * food.sizeScale;
  }

  update(dt) {
    for (const food of this.items) {
      if (!food.delivered || food.regrowAt == null) continue;
      food.regrowAt -= dt;
      if (food.regrowAt > 0) continue;
      const sizeScale = randomRange(FOOD_CONFIG.sizeMinScale, FOOD_CONFIG.sizeMaxScale);
      const profile = deriveFoodWeight(sizeScale);
      food.delivered = false;
      food.carried = false;
      food.carriedBy = null;
      food.claimedBy = null;
      food.supportAntIds = [];
      food.regrowAt = null;
      food.sizeScale = sizeScale;
      food.weight = profile.weight;
      food.requiredCarriers = profile.requiredCarriers;
      food.position.copy(randomFoodPosition(sizeScale));
    }
    this.updateVisuals();
  }

  updateVisuals() {
    for (let i = 0; i < this.items.length; i += 1) {
      const food = this.items[i];
      const mesh = this.meshes[i];
      if (!mesh) continue;
      mesh.visible = !food.delivered;
      if (!food.carried && !food.delivered) mesh.position.copy(food.position);
    }
  }
}
