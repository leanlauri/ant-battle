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
  maxHp: 260,
  position: new THREE.Vector3(0, 0, 0),
});

export const UPGRADE_CONFIG = Object.freeze({
  repairNest: Object.freeze({ id: 'repair-nest', cost: 10, repairHp: 70, label: 'Repair Nest' }),
  spawnWorkers: Object.freeze({ id: 'spawn-workers', cost: 12, count: 6, label: 'Call Workers' }),
  spawnFighters: Object.freeze({ id: 'spawn-fighters', cost: 16, count: 3, label: 'Call Fighters' }),
  broodChambers: Object.freeze({ id: 'brood-chambers', cost: 18, extraWorkers: 4, label: 'Brood Chambers' }),
  warNest: Object.freeze({ id: 'war-nest', cost: 22, extraFighters: 2, label: 'War Nest' }),
  fortifyNest: Object.freeze({ id: 'fortify-nest', cost: 20, extraMaxHp: 90, label: 'Fortify Nest' }),
});

export const ENEMY_ECONOMY_CONFIG = Object.freeze({
  productionCooldownMin: 6,
  productionCooldownMax: 10,
  workerBatch: Object.freeze({ cost: 10, count: 4 }),
  fighterBatch: Object.freeze({ cost: 14, count: 2 }),
  fighterPressureThreshold: 12,
});

export const FACTION = Object.freeze({
  player: 'player',
  enemy: 'enemy',
});

export const COLONY = Object.freeze({
  player: 'player',
  enemyAlpha: 'enemy-alpha',
  enemyBeta: 'enemy-beta',
});

const COLONY_STYLE = Object.freeze({
  [COLONY.player]: {
    mound: 0x8b5a2b,
    inner: 0x5a3414,
    ring: 0xbaff9c,
  },
  [COLONY.enemyAlpha]: {
    mound: 0x7a4158,
    inner: 0x481d31,
    ring: 0xff859f,
  },
  [COLONY.enemyBeta]: {
    mound: 0x4a527f,
    inner: 0x22284d,
    ring: 0x8eb4ff,
  },
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
      claimedByColonyId: null,
      carriedBy: null,
      carriedByColonyId: null,
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

const createNestDefinition = ({ id, x, z, faction, colonyId = faction, label }) => {
  const position = new THREE.Vector3(x, sampleHeight(x, z), z);
  return { id, faction, colonyId, label, position, maxHp: NEST_CONFIG.maxHp, hp: NEST_CONFIG.maxHp, collapsed: false };
};

export const createNestDefinitions = ({ enemyNestCount = 2 } = {}) => {
  const allNests = [
    createNestDefinition({ id: 'player-1', x: NEST_CONFIG.position.x, z: NEST_CONFIG.position.z, faction: FACTION.player, colonyId: COLONY.player, label: 'Home Nest' }),
    createNestDefinition({ id: 'enemy-1', x: -26, z: -18, faction: FACTION.enemy, colonyId: COLONY.enemyAlpha, label: 'Enemy Nest Alpha' }),
    createNestDefinition({ id: 'enemy-2', x: 28, z: 22, faction: FACTION.enemy, colonyId: COLONY.enemyBeta, label: 'Enemy Nest Beta' }),
  ];
  const clampedEnemyNestCount = THREE.MathUtils.clamp(enemyNestCount, 0, allNests.length - 1);
  return [allNests[0], ...allNests.slice(1, 1 + clampedEnemyNestCount)];
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

export const findNearestCarryAssistFood = (foods, position, colonyId, maxDistance = FOOD_CONFIG.senseDistance) => {
  let nearest = null;
  let nearestDistanceSq = maxDistance * maxDistance;

  for (const food of foods) {
    if (!food.carried || food.delivered) continue;
    if (colonyId != null && food.carriedByColonyId != null && food.carriedByColonyId !== colonyId) continue;
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

const createNestVisual = (nest) => {
  const group = new THREE.Group();
  const debugGroup = new THREE.Group();
  const style = COLONY_STYLE[nest.colonyId] ?? COLONY_STYLE[COLONY.player];
  const nestBaseY = nest.position.y;
  const nestMaterial = new THREE.MeshToonMaterial({ color: style.mound });
  const innerMaterial = new THREE.MeshToonMaterial({ color: style.inner });
  const queueMaterial = new THREE.MeshToonMaterial({ color: 0xffd54f });
  const entranceMaterial = new THREE.MeshToonMaterial({ color: 0x00e5ff });
  const pathMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false });

  const mound = new THREE.Mesh(new THREE.ConeGeometry(NEST_CONFIG.radius * 1.25, NEST_CONFIG.radius * 1.3, 28, 1), nestMaterial);
  mound.userData.baseColor = style.mound;
  mound.position.y = (NEST_CONFIG.radius * 1.3) * 0.5;
  mound.castShadow = true;
  mound.receiveShadow = true;
  group.add(mound);

  const moundBase = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 1.05, NEST_CONFIG.radius * 1.2, 0.18, 28), nestMaterial);
  moundBase.userData.baseColor = style.mound;
  moundBase.position.y = 0.09;
  moundBase.castShadow = true;
  moundBase.receiveShadow = true;
  group.add(moundBase);

  const entrance = new THREE.Mesh(new THREE.CylinderGeometry(NEST_CONFIG.radius * 0.36, NEST_CONFIG.radius * 0.42, 0.14, 18), innerMaterial);
  entrance.userData.baseColor = style.inner;
  entrance.position.set(0, 0.08, NEST_CONFIG.radius * 0.18);
  entrance.receiveShadow = true;
  group.add(entrance);

  for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
    const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
    const queueMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.12, 12), queueMaterial);
    queueMarker.userData.baseColor = 0xffd54f;
    const queueX = Math.cos(angle) * NEST_CONFIG.queueRadius;
    const queueZ = Math.sin(angle) * NEST_CONFIG.queueRadius;
    const queueWorldX = nest.position.x + queueX;
    const queueWorldZ = nest.position.z + queueZ;
    const queueLocalY = sampleHeight(queueWorldX, queueWorldZ) - nestBaseY;
    queueMarker.position.set(queueX, queueLocalY + 0.22, queueZ);
    debugGroup.add(queueMarker);

    const entranceMarker = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.16, 12), entranceMaterial);
    entranceMarker.userData.baseColor = 0x00e5ff;
    const entranceX = Math.cos(angle) * NEST_CONFIG.entranceRadius;
    const entranceZ = Math.sin(angle) * NEST_CONFIG.entranceRadius;
    const entranceWorldX = nest.position.x + entranceX;
    const entranceWorldZ = nest.position.z + entranceZ;
    const entranceLocalY = sampleHeight(entranceWorldX, entranceWorldZ) - nestBaseY;
    entranceMarker.position.set(entranceX, entranceLocalY + 0.28, entranceZ);
    debugGroup.add(entranceMarker);

    const pathGeometry = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(queueX, queueLocalY + 0.32, queueZ),
      new THREE.Vector3(entranceX, entranceLocalY + 0.32, entranceZ),
    ]);
    debugGroup.add(new THREE.Line(pathGeometry, pathMaterial));
  }

  const selectionRing = new THREE.Mesh(
    new THREE.TorusGeometry(NEST_CONFIG.radius * 1.35, 0.12, 10, 48),
    new THREE.MeshBasicMaterial({ color: style.ring, transparent: true, opacity: nest.faction === FACTION.player ? 0.95 : 0.45 }),
  );
  selectionRing.userData.baseColor = style.ring;
  selectionRing.rotation.x = Math.PI / 2;
  selectionRing.position.y = 0.26;
  selectionRing.visible = false;
  group.add(selectionRing);

  group.userData.debugGroup = debugGroup;
  group.userData.selectionRing = selectionRing;
  group.userData.nestId = nest.id;
  group.add(debugGroup);

  return group;
};

const createFocusMarker = () => {
  const group = new THREE.Group();
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(1.1, 0.08, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xbaff9c, transparent: true, opacity: 0.96 }),
  );
  ring.rotation.x = Math.PI / 2;
  group.add(ring);

  const spike = new THREE.Mesh(
    new THREE.ConeGeometry(0.26, 0.6, 6),
    new THREE.MeshToonMaterial({ color: 0x4fbf67 }),
  );
  spike.position.y = 0.38;
  group.add(spike);

  group.visible = false;
  return group;
};

const getNestSurfaceY = (nestPosition, radius = NEST_CONFIG.radius * 1.35) => {
  let highest = nestPosition.y;
  for (let i = 0; i < 10; i += 1) {
    const angle = (i / 10) * Math.PI * 2;
    const x = nestPosition.x + Math.cos(angle) * radius;
    const z = nestPosition.z + Math.sin(angle) * radius;
    highest = Math.max(highest, sampleHeight(x, z));
  }
  return highest;
};

const computeNestScale = (nestStored, hpRatio = 1) => {
  const growthScale = 1 + Math.min(0.85, nestStored * 0.012);
  const healthScale = THREE.MathUtils.lerp(0.52, 1, THREE.MathUtils.clamp(hpRatio, 0, 1));
  return growthScale * healthScale;
};

export class FoodSystem {
  constructor({ scene, count = FOOD_CONFIG.count, enemyNestCount = 2 } = {}) {
    this.scene = scene;
    this.items = createFoodItems(count);
    this.meshes = [];
    this.nestStoredById = new Map();
    this.nests = createNestDefinitions({ enemyNestCount }).map((nest) => ({
      ...nest,
      mesh: createNestVisual(nest),
    }));
    this.playerNest = this.nests.find((nest) => nest.faction === FACTION.player);
    this.enemyNests = this.nests.filter((nest) => nest.faction === FACTION.enemy);
    for (const nest of this.nests) this.nestStoredById.set(nest.id, 0);
    this.nestPosition = this.playerNest.position.clone();
    this.nestMesh = this.playerNest.mesh;
    this.selectedNestId = this.playerNest.id;
    this.focusTarget = null;
    this.focusTargetMeta = null;
    this.focusMarker = createFocusMarker();
    this.queueAssignments = new Map();

    for (const nest of this.nests) {
      nest.upgrades = {
        broodChambers: false,
        warNest: false,
        fortifyNest: false,
      };
      nest.mesh.position.copy(nest.position);
      scene.add(nest.mesh);
    }
    scene.add(this.focusMarker);
    this.updateNestVisual();
    this.updateSelectionVisuals();

    for (const food of this.items) {
      const mesh = createFoodVisual(food);
      mesh.position.copy(food.position);
      scene.add(mesh);
      this.meshes.push(mesh);
    }
  }

  get nestStored() {
    return this.getNestStored(this.playerNest?.id);
  }

  set nestStored(value) {
    if (!this.playerNest) return;
    this.nestStoredById.set(this.playerNest.id, value);
  }

  getNestStored(nestId) {
    return this.nestStoredById.get(nestId) ?? 0;
  }

  getNestById(nestId) {
    return this.nests.find((nest) => nest.id === nestId) ?? null;
  }

  getSelectedNest() {
    return this.nests.find((nest) => nest.id === this.selectedNestId) ?? this.playerNest;
  }

  getSelectedNestLabel() {
    return this.getSelectedNest()?.label ?? 'No nest selected';
  }

  getSelectedNestHealth() {
    const nest = this.getSelectedNest();
    if (!nest) return null;
    return {
      id: nest.id,
      hp: nest.hp,
      maxHp: nest.maxHp,
      collapsed: nest.collapsed,
    };
  }

  getSelectedNestStored() {
    const nest = this.getSelectedNest();
    if (!nest) return 0;
    return this.getNestStored(nest.id);
  }

  getUpgradeShortfall(nestId, cost) {
    return Math.max(0, cost - this.getNestStored(nestId));
  }

  getNestUpgradeState(nestId) {
    const nest = this.getNestById(nestId);
    return {
      broodChambers: !!nest?.upgrades?.broodChambers,
      warNest: !!nest?.upgrades?.warNest,
      fortifyNest: !!nest?.upgrades?.fortifyNest,
    };
  }

  getSpawnBatchProfile(nestId, role) {
    const upgrades = this.getNestUpgradeState(nestId);
    if (role === 'worker') {
      return {
        cost: UPGRADE_CONFIG.spawnWorkers.cost,
        count: UPGRADE_CONFIG.spawnWorkers.count + (upgrades.broodChambers ? UPGRADE_CONFIG.broodChambers.extraWorkers : 0),
      };
    }
    if (role === 'fighter') {
      return {
        cost: UPGRADE_CONFIG.spawnFighters.cost,
        count: UPGRADE_CONFIG.spawnFighters.count + (upgrades.warNest ? UPGRADE_CONFIG.warNest.extraFighters : 0),
      };
    }
    return { cost: 0, count: 0 };
  }

  spendNestFood(nestId, amount) {
    const available = this.getNestStored(nestId);
    if (available < amount) return false;
    this.nestStoredById.set(nestId, Math.max(0, available - amount));
    this.updateNestVisual();
    return true;
  }

  repairNest(nestId, hpAmount, foodCost = 0) {
    const nest = this.getNestById(nestId);
    if (!nest || nest.collapsed || nest.hp >= nest.maxHp) return false;
    if (foodCost > 0 && !this.spendNestFood(nestId, foodCost)) return false;
    nest.hp = Math.min(nest.maxHp, nest.hp + hpAmount);
    this.updateNestVisual();
    return true;
  }

  unlockNestUpgrade(nestId, upgradeId) {
    const nest = this.getNestById(nestId);
    if (!nest || nest.collapsed || nest.faction !== FACTION.player) return false;

    if (upgradeId === UPGRADE_CONFIG.broodChambers.id) {
      if (nest.upgrades.broodChambers || !this.spendNestFood(nestId, UPGRADE_CONFIG.broodChambers.cost)) return false;
      nest.upgrades.broodChambers = true;
      return true;
    }

    if (upgradeId === UPGRADE_CONFIG.warNest.id) {
      if (nest.upgrades.warNest || !this.spendNestFood(nestId, UPGRADE_CONFIG.warNest.cost)) return false;
      nest.upgrades.warNest = true;
      return true;
    }

    if (upgradeId === UPGRADE_CONFIG.fortifyNest.id) {
      if (nest.upgrades.fortifyNest || !this.spendNestFood(nestId, UPGRADE_CONFIG.fortifyNest.cost)) return false;
      nest.upgrades.fortifyNest = true;
      nest.maxHp += UPGRADE_CONFIG.fortifyNest.extraMaxHp;
      nest.hp = Math.min(nest.maxHp, nest.hp + UPGRADE_CONFIG.fortifyNest.extraMaxHp);
      this.updateNestVisual();
      return true;
    }

    return false;
  }

  getUpgradeOptions(nestId = this.selectedNestId) {
    const nest = this.getNestById(nestId);
    if (!nest || nest.faction !== FACTION.player || nest.collapsed) return [];
    const stored = this.getNestStored(nest.id);
    const needsRepair = nest.hp < nest.maxHp;
    const workerBatch = this.getSpawnBatchProfile(nest.id, 'worker');
    const fighterBatch = this.getSpawnBatchProfile(nest.id, 'fighter');
    return [
      {
        id: UPGRADE_CONFIG.repairNest.id,
        label: UPGRADE_CONFIG.repairNest.label,
        description: needsRepair ? `Restore ${UPGRADE_CONFIG.repairNest.repairHp} HP.` : 'Nest already at full health.',
        cost: UPGRADE_CONFIG.repairNest.cost,
        affordable: needsRepair && stored >= UPGRADE_CONFIG.repairNest.cost,
        disabled: !needsRepair || stored < UPGRADE_CONFIG.repairNest.cost,
        shortfall: needsRepair ? this.getUpgradeShortfall(nest.id, UPGRADE_CONFIG.repairNest.cost) : 0,
      },
      {
        id: UPGRADE_CONFIG.spawnWorkers.id,
        label: UPGRADE_CONFIG.spawnWorkers.label,
        description: `Spawn ${workerBatch.count} worker ants at this nest${nest.upgrades.broodChambers ? ' (brood bonus active)' : ''}.`,
        cost: workerBatch.cost,
        affordable: stored >= workerBatch.cost,
        disabled: stored < workerBatch.cost,
        shortfall: this.getUpgradeShortfall(nest.id, workerBatch.cost),
      },
      {
        id: UPGRADE_CONFIG.spawnFighters.id,
        label: UPGRADE_CONFIG.spawnFighters.label,
        description: `Spawn ${fighterBatch.count} fighter ants at this nest${nest.upgrades.warNest ? ' (war bonus active)' : ''}.`,
        cost: fighterBatch.cost,
        affordable: stored >= fighterBatch.cost,
        disabled: stored < fighterBatch.cost,
        shortfall: this.getUpgradeShortfall(nest.id, fighterBatch.cost),
      },
      {
        id: UPGRADE_CONFIG.broodChambers.id,
        label: UPGRADE_CONFIG.broodChambers.label,
        description: nest.upgrades.broodChambers
          ? 'Installed. Worker call-ups now bring a larger batch.'
          : `Permanent. Worker call-ups spawn +${UPGRADE_CONFIG.broodChambers.extraWorkers} ants.`,
        cost: UPGRADE_CONFIG.broodChambers.cost,
        affordable: !nest.upgrades.broodChambers && stored >= UPGRADE_CONFIG.broodChambers.cost,
        disabled: nest.upgrades.broodChambers || stored < UPGRADE_CONFIG.broodChambers.cost,
        shortfall: nest.upgrades.broodChambers ? 0 : this.getUpgradeShortfall(nest.id, UPGRADE_CONFIG.broodChambers.cost),
      },
      {
        id: UPGRADE_CONFIG.warNest.id,
        label: UPGRADE_CONFIG.warNest.label,
        description: nest.upgrades.warNest
          ? 'Installed. Fighter call-ups now bring a larger strike force.'
          : `Permanent. Fighter call-ups spawn +${UPGRADE_CONFIG.warNest.extraFighters} ants.`,
        cost: UPGRADE_CONFIG.warNest.cost,
        affordable: !nest.upgrades.warNest && stored >= UPGRADE_CONFIG.warNest.cost,
        disabled: nest.upgrades.warNest || stored < UPGRADE_CONFIG.warNest.cost,
        shortfall: nest.upgrades.warNest ? 0 : this.getUpgradeShortfall(nest.id, UPGRADE_CONFIG.warNest.cost),
      },
      {
        id: UPGRADE_CONFIG.fortifyNest.id,
        label: UPGRADE_CONFIG.fortifyNest.label,
        description: nest.upgrades.fortifyNest
          ? 'Installed. This nest now has a larger HP pool.'
          : `Permanent. Gain +${UPGRADE_CONFIG.fortifyNest.extraMaxHp} max HP and restore that much immediately.`,
        cost: UPGRADE_CONFIG.fortifyNest.cost,
        affordable: !nest.upgrades.fortifyNest && stored >= UPGRADE_CONFIG.fortifyNest.cost,
        disabled: nest.upgrades.fortifyNest || stored < UPGRADE_CONFIG.fortifyNest.cost,
        shortfall: nest.upgrades.fortifyNest ? 0 : this.getUpgradeShortfall(nest.id, UPGRADE_CONFIG.fortifyNest.cost),
      },
    ];
  }

  setSelectedNest(nestId) {
    const nest = this.nests.find((candidate) => candidate.id === nestId);
    if (!nest || nest.faction !== FACTION.player) return false;
    this.selectedNestId = nest.id;
    this.updateSelectionVisuals();
    return true;
  }

  updateSelectionVisuals() {
    for (const nest of this.nests) {
      const ring = nest.mesh?.userData?.selectionRing;
      if (!ring) continue;
      ring.visible = nest.id === this.selectedNestId && nest.faction === FACTION.player;
    }
  }

  setFocusTarget(position, meta = null) {
    this.focusTarget = new THREE.Vector3(position.x, sampleHeight(position.x, position.z), position.z);
    this.focusTargetMeta = meta ? { ...meta } : null;
    this.focusMarker.visible = true;
    this.focusMarker.position.set(this.focusTarget.x, this.focusTarget.y + 0.14, this.focusTarget.z);
  }

  getFocusTarget() {
    return this.focusTarget ? this.focusTarget.clone() : null;
  }

  getFocusTargetMeta() {
    return this.focusTargetMeta ? { ...this.focusTargetMeta } : null;
  }

  findNestHit(raycaster) {
    const hits = [];
    for (const nest of this.nests) {
      const intersections = raycaster.intersectObject(nest.mesh, true);
      if (intersections[0]) hits.push({ nest, distance: intersections[0].distance });
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0]?.nest ?? null;
  }

  findFoodHit(raycaster) {
    const hits = [];
    for (let i = 0; i < this.meshes.length; i += 1) {
      const food = this.items[i];
      if (!food || food.delivered) continue;
      const intersections = raycaster.intersectObject(this.meshes[i], true);
      if (intersections[0]) hits.push({ food, distance: intersections[0].distance });
    }
    hits.sort((a, b) => a.distance - b.distance);
    return hits[0]?.food ?? null;
  }

  claimFood(foodId, antId, colonyId = null) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.claimedBy = antId;
    food.claimedByColonyId = colonyId;
    return true;
  }

  joinCarry(foodId, antId, colonyId = null) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.delivered) return false;
    if (colonyId != null && food.carriedByColonyId != null && food.carriedByColonyId !== colonyId) return false;
    if (!food.supportAntIds.includes(antId)) food.supportAntIds.push(antId);
    return true;
  }

  leaveCarry(foodId, antId) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food) return;
    food.supportAntIds = food.supportAntIds.filter((id) => id !== antId);
  }

  pickUpFood(foodId, antId, colonyId = null) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || food.delivered || food.carried) return false;
    food.carried = true;
    food.carriedBy = antId;
    food.carriedByColonyId = colonyId;
    food.claimedBy = antId;
    food.claimedByColonyId = colonyId;
    food.supportAntIds = [antId];
    return true;
  }

  reserveNestSlot(antId, antPosition, nestId = this.playerNest.id) {
    if (this.queueAssignments.has(antId)) return this.queueAssignments.get(antId);
    const nest = this.getNestById(nestId) ?? this.playerNest;
    const nestPosition = nest.position;
    const candidates = [];
    for (let i = 0; i < NEST_CONFIG.queueSlots; i += 1) {
      const occupied = [...this.queueAssignments.values()].some((slot) => slot.index === i && slot.nestId === nest.id);
      if (occupied) continue;
      const angle = (i / NEST_CONFIG.queueSlots) * Math.PI * 2;
      const queuePosition = new THREE.Vector3(
        nestPosition.x + Math.cos(angle) * NEST_CONFIG.queueRadius,
        sampleHeight(
          nestPosition.x + Math.cos(angle) * NEST_CONFIG.queueRadius,
          nestPosition.z + Math.sin(angle) * NEST_CONFIG.queueRadius,
        ),
        nestPosition.z + Math.sin(angle) * NEST_CONFIG.queueRadius,
      );
      const entrancePosition = new THREE.Vector3(
        nestPosition.x + Math.cos(angle) * NEST_CONFIG.entranceRadius,
        sampleHeight(
          nestPosition.x + Math.cos(angle) * NEST_CONFIG.entranceRadius,
          nestPosition.z + Math.sin(angle) * NEST_CONFIG.entranceRadius,
        ),
        nestPosition.z + Math.sin(angle) * NEST_CONFIG.entranceRadius,
      );
      candidates.push({ nestId: nest.id, index: i, queuePosition, entrancePosition, distanceSq: antPosition.distanceToSquared(queuePosition) });
    }
    candidates.sort((a, b) => a.distanceSq - b.distanceSq);
    const chosen = candidates[0] ?? {
      nestId: nest.id,
      index: 0,
      queuePosition: nestPosition.clone(),
      entrancePosition: nestPosition.clone(),
    };
    this.queueAssignments.set(antId, chosen);
    return chosen;
  }

  releaseNestSlot(antId) {
    this.queueAssignments.delete(antId);
  }

  dropFoodInNest(foodId, antId, nestId = this.playerNest.id) {
    const food = this.items.find((item) => item.id === foodId);
    if (!food || !food.carried || food.carriedBy !== antId) return false;
    food.delivered = true;
    food.carried = false;
    food.carriedBy = null;
    food.carriedByColonyId = null;
    food.claimedBy = null;
    food.claimedByColonyId = null;
    food.supportAntIds = [];
    food.regrowAt = randomRange(FOOD_CONFIG.regrowDelayMin, FOOD_CONFIG.regrowDelayMax);
    this.nestStoredById.set(nestId, this.getNestStored(nestId) + food.weight);
    this.releaseNestSlot(antId);
    this.updateNestVisual();
    return true;
  }

  damageNest(nestId, damage) {
    const nest = this.getNestById(nestId);
    if (!nest || nest.collapsed) return null;
    const wasCollapsed = nest.collapsed;
    nest.hp = Math.max(0, nest.hp - Math.max(0, damage));
    if (nest.hp <= 0) nest.collapsed = true;
    this.updateNestVisual();
    return {
      nestId: nest.id,
      hp: nest.hp,
      maxHp: nest.maxHp,
      collapsed: nest.collapsed,
      justCollapsed: nest.collapsed && !wasCollapsed,
    };
  }

  getActiveNestCount(faction) {
    return this.nests.filter((nest) => nest.faction === faction && !nest.collapsed).length;
  }

  getActiveEnemyNestCount() {
    return this.getActiveNestCount(FACTION.enemy);
  }

  getActivePlayerNestCount() {
    return this.getActiveNestCount(FACTION.player);
  }

  updateNestVisual() {
    for (const nest of this.nests) {
      const hpRatio = nest.maxHp > 0 ? nest.hp / nest.maxHp : 0;
      const scale = computeNestScale(this.getNestStored(nest.id), hpRatio);
      nest.mesh.scale.set(scale, 1 + (scale - 1) * 1.4, scale);
      nest.mesh.position.set(nest.position.x, nest.position.y, nest.position.z);
      const ring = nest.mesh?.userData?.selectionRing;
      if (ring) {
        ring.scale.setScalar(Math.max(0.7, scale));
        ring.position.y = getNestSurfaceY(nest.position, NEST_CONFIG.radius * scale * 1.35) - nest.position.y + 0.18;
      }
      nest.mesh.traverse((child) => {
        if (!child.isMesh || !child.material?.color) return;
        const shade = nest.collapsed ? 0.42 : THREE.MathUtils.lerp(0.68, 1, hpRatio);
        child.material.color.setHex(child.userData.baseColor ?? (COLONY_STYLE[nest.colonyId] ?? COLONY_STYLE[COLONY.player]).mound).multiplyScalar(shade);
      });
    }
  }

  setDebugVisualsVisible(visible) {
    for (const nest of this.nests) {
      const debugGroup = nest.mesh?.userData?.debugGroup;
      if (debugGroup) debugGroup.visible = !!visible;
    }
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
      food.carriedByColonyId = null;
      food.claimedBy = null;
      food.claimedByColonyId = null;
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
