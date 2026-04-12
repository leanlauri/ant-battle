/* global __BUILD_ID__ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AntSystem } from './ant-system.js';
import { ENEMY_ECONOMY_CONFIG, FoodSystem, UPGRADE_CONFIG } from './food-system.js';
import { getLevelDefinition } from './level-definition.js';
import { getObjectiveStatus } from './objective-rules.js';
import { PheromoneSystem } from './pheromone-system.js';
import { createSeededRandom, deriveSeed } from './seeded-random.js';
import { createTerrainMesh, createTerrainOverlay, resetActiveTerrainProfile, sampleHeight, setActiveTerrainProfile } from './terrain.js';

const BUILD_ID_FALLBACK = '9ae531b';
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : BUILD_ID_FALLBACK;
const CAMERA_MODE = {
  orbit: 'orbit',
  battlefield: 'battlefield',
};
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 2, 0);
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(36, 26, 36);
const DEFAULT_CAMERA_OFFSET = DEFAULT_CAMERA_POSITION.clone().sub(DEFAULT_CAMERA_TARGET);
const BATTLEFIELD_CAMERA_POLAR_ANGLE = Math.atan2(
  Math.hypot(DEFAULT_CAMERA_OFFSET.x, DEFAULT_CAMERA_OFFSET.z),
  DEFAULT_CAMERA_OFFSET.y,
);

const createBuildInfo = () => ({
  value: BUILD_ID,
  source: typeof __BUILD_ID__ !== 'undefined' ? 'bundle' : 'fallback',
});

const formatHudSummary = ({ antSystem, buildInfo, levelDefinition }) => {
  const objectiveStatus = getObjectiveStatus({ objective: levelDefinition?.objective, foodSystem: antSystem.foodSystem });
  const antSummary = antSystem.getSummary();
  const remainingFood = antSystem.foods.filter((item) => !item.delivered).length;
  const heaviestFood = antSystem.foods.reduce((max, food) => Math.max(max, food.requiredCarriers), 1);
  const focusTarget = antSystem.foodSystem?.getFocusTarget?.();
  const focusTargetMeta = antSystem.foodSystem?.getFocusTargetMeta?.();
  const selectedNestHealth = antSystem.foodSystem?.getSelectedNestHealth?.();
  const selectedNestLabel = antSystem.foodSystem?.getSelectedNestLabel?.() ?? 'Home Nest';
  const selectedNest = antSystem.foodSystem?.getSelectedNest?.();

  return {
    levelLabel: levelDefinition?.isBossLevel
      ? `${levelDefinition?.boss?.shellLabel ?? 'Boss Level'} • ${levelDefinition?.label ?? ''}`.trim()
      : `Level ${levelDefinition?.levelNumber ?? 1} • ${levelDefinition?.label ?? 'Skirmish'}`,
    bossTitle: levelDefinition?.boss?.title ?? null,
    isBossLevel: !!levelDefinition?.isBossLevel,
    selectedNestText: `${selectedNestLabel}${selectedNestHealth
      ? ` • Nest HP ${selectedNestHealth.hp}/${selectedNestHealth.maxHp}${selectedNestHealth.collapsed ? ' • Collapsed' : ''}`
      : ''} • Stored food ${(antSystem.foodSystem?.getSelectedNestStored?.() ?? 0).toFixed(1)}`,
    focusText: focusTarget
      ? `Focus: ${focusTargetMeta?.label ?? 'Marked ground'}`
      : 'Focus: No rally point set',
    objectiveText: objectiveStatus.hudText,
    objectiveCompletionText: objectiveStatus.completionText,
    battleText: `Battle: ${antSummary.enemyAntsDefeated} enemies defeated, ${antSummary.playerAntsLost} ants lost, ${antSummary.enemyNestsDestroyed} enemy nest${antSummary.enemyNestsDestroyed === 1 ? '' : 's'} destroyed. ${objectiveStatus.battleSuffix}`,
    foodText: `Field food remaining: ${remainingFood} cluster${remainingFood === 1 ? '' : 's'} • Largest haul needs ${heaviestFood} carrier${heaviestFood === 1 ? '' : 's'}`,
    selectedNestStored: antSystem.foodSystem?.getSelectedNestStored?.() ?? 0,
    selectedNestId: selectedNest?.id ?? null,
    selectedNestLabel,
    upgradeOptions: antSystem.foodSystem?.getUpgradeOptions?.() ?? [],
    buildText: `Build: ${buildInfo.value}`,
    playerAntCount: antSummary.playerTotal,
    maxPlayerAntCount: antSummary.maxPlayerAnts,
    enemyAntsDefeated: antSummary.enemyAntsDefeated,
    enemyNestsDestroyed: antSummary.enemyNestsDestroyed,
    playerNestsLost: antSummary.playerNestsLost,
  };
};

const refreshBuildIdFromGitHub = async (buildInfo) => {
  try {
    const response = await fetch('https://api.github.com/repos/leanlauri/ant-battle/commits?sha=main&path=game&per_page=1');
    if (!response.ok) return false;
    const commits = await response.json();
    const sha = commits?.[0]?.sha;
    if (typeof sha !== 'string' || sha.length < 7) return false;
    buildInfo.value = sha.slice(0, 7);
    buildInfo.source = 'github';
    return true;
  } catch {
    return false;
  }
};

export const createGameplaySession = ({ mount, onHudUpdate, onFatalError, onNestSelected, onFocusAssigned, onBattleResolved }) => {
  let renderer = null;
  let scene = null;
  let camera = null;
  let controls = null;
  let terrain = null;
  let foodSystem = null;
  let pheromoneSystem = null;
  let antSystem = null;
  let debugVisualsGroup = null;
  let resizeHandler = null;
  let pointerDown = null;
  let pointerDownHandler = null;
  let pointerUpHandler = null;
  let animationFrameId = 0;
  let running = false;
  let accumulator = 0;
  let clock = null;
  let debugVisualsVisible = false;
  let battleResolved = false;
  let cameraMode = CAMERA_MODE.orbit;
  let multiTouchGesture = false;
  const activePointerIds = new Set();
  const buildInfo = createBuildInfo();
  const enemyProductionCooldowns = new Map();
  let currentLevelDefinition = getLevelDefinition(1);
  let foodRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'food'));
  let antSetupRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-setup'));
  let antSpawnRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-spawn'));
  let antDecisionRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-runtime'));
  let antEffectRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-effects'));
  let enemyEconomyRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'enemy-economy'));

  const randomEnemyProductionCooldown = () => {
    const multiplier = currentLevelDefinition?.scenarioRules?.enemyProductionRateMultiplier ?? 1;
    return THREE.MathUtils.lerp(
      ENEMY_ECONOMY_CONFIG.productionCooldownMin,
      ENEMY_ECONOMY_CONFIG.productionCooldownMax,
      enemyEconomyRandom(),
    ) / Math.max(0.1, multiplier);
  };

  const runEnemyProduction = (dt) => {
    if (!foodSystem || !antSystem) return;

    for (const nest of foodSystem.nests) {
      if (nest.faction !== 'enemy' || nest.collapsed) continue;

      const cooldown = (enemyProductionCooldowns.get(nest.id) ?? randomEnemyProductionCooldown()) - dt;
      if (cooldown > 0) {
        enemyProductionCooldowns.set(nest.id, cooldown);
        continue;
      }

      const stored = foodSystem.getNestStored(nest.id);
      const roster = antSystem.getNestRosterSummary(nest.id);
      let produced = false;

      const shouldSpawnFighters = stored >= ENEMY_ECONOMY_CONFIG.fighterBatch.cost
        && (roster.fighters < 2 || roster.workers - roster.fighters >= ENEMY_ECONOMY_CONFIG.fighterPressureThreshold);

      if (shouldSpawnFighters && foodSystem.spendNestFood(nest.id, ENEMY_ECONOMY_CONFIG.fighterBatch.cost)) {
        antSystem.spawnAntBatch({ nestId: nest.id, role: 'fighter', count: ENEMY_ECONOMY_CONFIG.fighterBatch.count });
        produced = true;
      } else if (stored >= ENEMY_ECONOMY_CONFIG.workerBatch.cost && foodSystem.spendNestFood(nest.id, ENEMY_ECONOMY_CONFIG.workerBatch.cost)) {
        antSystem.spawnAntBatch({ nestId: nest.id, role: 'worker', count: ENEMY_ECONOMY_CONFIG.workerBatch.count });
        produced = true;
      }

      enemyProductionCooldowns.set(nest.id, produced ? randomEnemyProductionCooldown() : 2.5);
    }
  };

  const resetLevelRandomStreams = () => {
    foodRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'food'));
    antSetupRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-setup'));
    antSpawnRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-spawn'));
    antDecisionRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-runtime'));
    antEffectRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-effects'));
    enemyEconomyRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'enemy-economy'));
  };

  const projectWorldToScreen = (position) => {
    if (!camera || !renderer || !position) return null;
    const projected = position.clone().project(camera);
    if (projected.z < -1 || projected.z > 1) return null;
    return {
      x: ((projected.x + 1) / 2) * renderer.domElement.clientWidth,
      y: ((-projected.y + 1) / 2) * renderer.domElement.clientHeight - 18,
    };
  };

  const publishHud = () => {
    if (!terrain || !antSystem) return;
    const summary = formatHudSummary({ terrain, antSystem, buildInfo, levelDefinition: currentLevelDefinition });
    const selectedNest = antSystem.foodSystem?.getSelectedNest?.();
    summary.upgradeAnchor = selectedNest ? projectWorldToScreen(selectedNest.position.clone().add(new THREE.Vector3(0, 4.2, 0))) : null;
    onHudUpdate?.(summary);
  };

  const centerCameraOn = (position) => {
    if (!camera || !controls || !position) return;
    const nextTarget = new THREE.Vector3(position.x, position.y ?? sampleHeight(position.x, position.z), position.z);
    const delta = nextTarget.clone().sub(controls.target);
    controls.target.copy(nextTarget);
    camera.position.add(delta);
    controls.update();
  };

  const applyCameraMode = () => {
    if (!controls) return;
    controls.enablePan = true;
    if (cameraMode === CAMERA_MODE.battlefield) {
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controls.minPolarAngle = BATTLEFIELD_CAMERA_POLAR_ANGLE;
      controls.maxPolarAngle = BATTLEFIELD_CAMERA_POLAR_ANGLE;
    } else {
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.48;
    }
    controls.update();
  };

  const enforceBattlefieldCameraConstraints = () => {
    if (!controls || !camera || cameraMode !== CAMERA_MODE.battlefield) return;
    const desiredTargetY = sampleHeight(controls.target.x, controls.target.z);
    const deltaY = desiredTargetY - controls.target.y;
    if (Math.abs(deltaY) > 1e-4) {
      controls.target.y = desiredTargetY;
      camera.position.y += deltaY;
    }
  };

  const setDebugVisualsVisible = (visible) => {
    debugVisualsVisible = !!visible;
    if (debugVisualsGroup) debugVisualsGroup.visible = debugVisualsVisible;
    if (foodSystem) foodSystem.setDebugVisualsVisible(debugVisualsVisible);
  };

  const stop = () => {
    running = false;
    accumulator = 0;
    if (animationFrameId) {
      window.cancelAnimationFrame(animationFrameId);
      animationFrameId = 0;
    }
    if (resizeHandler) {
      window.removeEventListener('resize', resizeHandler);
      resizeHandler = null;
    }
    if (pointerDownHandler && renderer?.domElement) renderer.domElement.removeEventListener('pointerdown', pointerDownHandler);
    if (pointerUpHandler && renderer?.domElement) {
      renderer.domElement.removeEventListener('pointerup', pointerUpHandler);
      renderer.domElement.removeEventListener('pointercancel', pointerUpHandler);
    }
    pointerDownHandler = null;
    pointerUpHandler = null;
    pointerDown = null;
    multiTouchGesture = false;
    activePointerIds.clear();
    controls?.dispose();
    renderer?.dispose();
    if (typeof renderer?.forceContextLoss === 'function') renderer.forceContextLoss();
    if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);

    renderer = null;
    scene = null;
    camera = null;
    controls = null;
    terrain = null;
    foodSystem = null;
    pheromoneSystem = null;
    antSystem = null;
    debugVisualsGroup = null;
    clock = null;
    battleResolved = false;
    enemyProductionCooldowns.clear();
    resetActiveTerrainProfile();
    mount.replaceChildren();
    onHudUpdate?.(null);
  };

  const animate = () => {
    if (!running || !renderer || !controls || !pheromoneSystem || !foodSystem || !antSystem) return;

    const fixedStep = 1 / 60;
    const maxFrameDt = 0.1;
    const maxSubsteps = 4;
    const dt = Math.min(maxFrameDt, clock.getDelta());
    accumulator += dt;
    controls.update();
    enforceBattlefieldCameraConstraints();

    let substeps = 0;
    while (!battleResolved && accumulator >= fixedStep && substeps < maxSubsteps) {
      pheromoneSystem.update(fixedStep);
      foodSystem.update(fixedStep);
      runEnemyProduction(fixedStep);
      antSystem.update(fixedStep);
      accumulator -= fixedStep;
      substeps += 1;
    }

    const outcome = antSystem.getOutcome?.();
    if (outcome && !battleResolved) {
      battleResolved = true;
      const summary = formatHudSummary({ terrain, antSystem, buildInfo, levelDefinition: currentLevelDefinition });
      onHudUpdate?.(summary);
      onBattleResolved?.(outcome, summary);
    }

    publishHud();
    renderer.render(scene, camera);
    animationFrameId = window.requestAnimationFrame(animate);
  };

  const start = async (levelNumber = 1) => {
    stop();
    currentLevelDefinition = getLevelDefinition(levelNumber);
    setActiveTerrainProfile(currentLevelDefinition.terrain);

    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.shadowMap.enabled = true;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(currentLevelDefinition.atmosphere?.background ?? 0xdbe7f4);
      scene.fog = new THREE.Fog(currentLevelDefinition.atmosphere?.fog ?? 0xdbe7f4, 39, 104);

      camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 260);
      camera.position.copy(DEFAULT_CAMERA_POSITION);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.copy(DEFAULT_CAMERA_TARGET);
      controls.minDistance = 10;
      controls.maxDistance = 120;
      applyCameraMode();

      scene.add(new THREE.HemisphereLight(
        currentLevelDefinition.atmosphere?.hemiSky ?? 0xf2f7ff,
        currentLevelDefinition.atmosphere?.hemiGround ?? 0x7e93a8,
        1.4,
      ));
      const sun = new THREE.DirectionalLight(currentLevelDefinition.atmosphere?.sun ?? 0xffffff, 1.8);
      sun.position.set(12, 20, 10);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -60;
      sun.shadow.camera.right = 60;
      sun.shadow.camera.top = 60;
      sun.shadow.camera.bottom = -60;
      sun.shadow.camera.near = 1;
      sun.shadow.camera.far = 90;
      sun.shadow.bias = -0.0004;
      sun.shadow.normalBias = 0.02;
      scene.add(sun);
      scene.add(sun.target);
      sun.target.position.set(0, 0, 0);

      debugVisualsGroup = new THREE.Group();
      debugVisualsGroup.add(new THREE.AxesHelper(12));
      const grid = new THREE.GridHelper(100, 20, 0x3a658f, 0x89a7c3);
      grid.position.y = -0.02;
      debugVisualsGroup.add(grid);
      scene.add(debugVisualsGroup);

      terrain = createTerrainMesh();
      scene.add(terrain);
      scene.add(createTerrainOverlay(terrain.geometry));
      resetLevelRandomStreams();

      foodSystem = new FoodSystem({
        scene,
        count: currentLevelDefinition.foodCount,
        enemyNestCount: currentLevelDefinition.enemyNestCount,
        nestOverrides: currentLevelDefinition.nestOverrides,
        random: foodRandom,
      });
      pheromoneSystem = new PheromoneSystem();
      antSystem = new AntSystem({
        scene,
        camera,
        foodSystem,
        pheromoneSystem,
        foods: foodSystem.items,
        nests: foodSystem.nests,
        count: currentLevelDefinition.antBudget,
        levelSetup: currentLevelDefinition.setup,
        objective: currentLevelDefinition.objective,
        setupRandom: antSetupRandom,
        spawnRandom: antSpawnRandom,
        decisionRandom: antDecisionRandom,
        effectRandom: antEffectRandom,
      });
      setDebugVisualsVisible(debugVisualsVisible);
      publishHud();

      resizeHandler = () => {
        if (!renderer || !camera) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', resizeHandler);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      pointerDownHandler = (event) => {
        activePointerIds.add(event.pointerId);
        if (activePointerIds.size > 1) {
          multiTouchGesture = true;
          pointerDown = null;
          return;
        }
        pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      };
      pointerUpHandler = (event) => {
        const releasedFinalPointer = activePointerIds.size <= 1;
        activePointerIds.delete(event.pointerId);
        if (multiTouchGesture) {
          if (releasedFinalPointer) multiTouchGesture = false;
          pointerDown = null;
          return;
        }
        if (!pointerDown || pointerDown.pointerId !== event.pointerId || !camera || !terrain || !foodSystem || !antSystem) return;
        const travel = Math.hypot(event.clientX - pointerDown.x, event.clientY - pointerDown.y);
        pointerDown = null;
        if (travel > 8) return;

        const rect = renderer.domElement.getBoundingClientRect();
        pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const nestHit = foodSystem.findNestHit(raycaster);
        if (nestHit?.faction === 'player') {
          foodSystem.setSelectedNest(nestHit.id);
          centerCameraOn(nestHit.position);
          onNestSelected?.(nestHit);
          publishHud();
          return;
        }

        const antHit = antSystem.findAntHit(raycaster);
        if (antHit) {
          const target = antHit.position.clone();
          foodSystem.setFocusTarget(target, { type: 'enemy-ant', label: `${antHit.colonyId} ${antHit.role}` });
          antSystem.setFocusTarget(target);
          centerCameraOn(target);
          onFocusAssigned?.(foodSystem.getFocusTarget());
          publishHud();
          return;
        }

        if (nestHit?.faction === 'enemy') {
          foodSystem.setFocusTarget(nestHit.position, { type: 'enemy-nest', label: nestHit.label });
          antSystem.setFocusTarget(nestHit.position);
          centerCameraOn(nestHit.position);
          onFocusAssigned?.(foodSystem.getFocusTarget());
          publishHud();
          return;
        }

        const foodHit = foodSystem.findFoodHit(raycaster);
        if (foodHit) {
          foodSystem.setFocusTarget(foodHit.position, { type: 'food', label: `food ${foodHit.id}` });
          antSystem.setFocusTarget(foodHit.position);
          centerCameraOn(foodHit.position);
          onFocusAssigned?.(foodSystem.getFocusTarget());
          publishHud();
          return;
        }

        const terrainHit = raycaster.intersectObject(terrain, true)[0];
        if (!terrainHit || !foodSystem.getSelectedNest()) return;
        const target = terrainHit.point;
        foodSystem.setFocusTarget(target, { type: 'terrain', label: 'terrain' });
        antSystem.setFocusTarget(target);
        centerCameraOn(target);
        onFocusAssigned?.(foodSystem.getFocusTarget());
        publishHud();
      };
      renderer.domElement.addEventListener('pointerdown', pointerDownHandler);
      renderer.domElement.addEventListener('pointerup', pointerUpHandler);
      renderer.domElement.addEventListener('pointercancel', pointerUpHandler);

      clock = new THREE.Clock();
      running = true;
      animate();

      refreshBuildIdFromGitHub(buildInfo).then((updated) => {
        if (updated && running) publishHud();
      });
    } catch (error) {
      stop();
      onFatalError?.(error);
    }
  };

  return {
    start,
    stop,
    setDebugVisualsVisible,
    setCameraMode: (nextCameraMode) => {
      cameraMode = nextCameraMode === CAMERA_MODE.battlefield ? CAMERA_MODE.battlefield : CAMERA_MODE.orbit;
      applyCameraMode();
      if (cameraMode === CAMERA_MODE.battlefield) enforceBattlefieldCameraConstraints();
      return cameraMode;
    },
    applyUpgrade: (upgradeId) => {
      if (!foodSystem || !antSystem) return false;
      const nest = foodSystem.getSelectedNest();
      if (!nest || nest.faction !== 'player' || nest.collapsed) return false;

      let applied = false;
      if (upgradeId === UPGRADE_CONFIG.repairNest.id) {
        applied = foodSystem.repairNest(nest.id, UPGRADE_CONFIG.repairNest.repairHp, UPGRADE_CONFIG.repairNest.cost);
      } else if (upgradeId === UPGRADE_CONFIG.spawnWorkers.id) {
        const batch = foodSystem.getSpawnBatchProfile(nest.id, 'worker');
        if (foodSystem.spendNestFood(nest.id, batch.cost)) {
          antSystem.spawnAntBatch({ nestId: nest.id, role: 'worker', count: batch.count });
          applied = true;
        }
      } else if (upgradeId === UPGRADE_CONFIG.spawnFighters.id) {
        const batch = foodSystem.getSpawnBatchProfile(nest.id, 'fighter');
        if (foodSystem.spendNestFood(nest.id, batch.cost)) {
          antSystem.spawnAntBatch({ nestId: nest.id, role: 'fighter', count: batch.count });
          applied = true;
        }
      } else if (
        upgradeId === UPGRADE_CONFIG.broodChambers.id
        || upgradeId === UPGRADE_CONFIG.warNest.id
        || upgradeId === UPGRADE_CONFIG.fortifyNest.id
      ) {
        applied = foodSystem.unlockNestUpgrade(nest.id, upgradeId);
      }

      if (applied) publishHud();
      return applied;
    },
    setSelectedNest: (nestId) => {
      if (!foodSystem) return false;
      const changed = foodSystem.setSelectedNest(nestId);
      if (changed) publishHud();
      return changed;
    },
    setNestStored: (nestId, amount) => {
      if (!foodSystem) return false;
      const nest = foodSystem.getNestById(nestId);
      if (!nest) return false;
      foodSystem.nestStoredById.set(nestId, Math.max(0, amount));
      foodSystem.updateNestVisual();
      publishHud();
      return true;
    },
    getUpgradeOptions: (nestId) => {
      if (!foodSystem) return [];
      return foodSystem.getUpgradeOptions(nestId);
    },
  };
};
