/* global __BUILD_ID__ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AntSystem } from './ant-system.js';
import { ENEMY_ECONOMY_CONFIG, FOOD_CONFIG, FoodSystem, UPGRADE_CONFIG } from './food-system.js';
import { getLevelDefinition } from './level-definition.js';
import { PheromoneSystem } from './pheromone-system.js';
import { TERRAIN_CONFIG, createTerrainMesh, createTerrainOverlay, getTriangleCount, resetActiveTerrainProfile, sampleHeight, setActiveTerrainProfile } from './terrain.js';

const BUILD_ID_FALLBACK = '9ae531b';
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : BUILD_ID_FALLBACK;

const createBuildInfo = () => ({
  value: BUILD_ID,
  source: typeof __BUILD_ID__ !== 'undefined' ? 'bundle' : 'fallback',
});

const formatHudSummary = ({ terrain, antSystem, buildInfo, levelDefinition }) => {
  const antSummary = antSystem.getSummary();
  const remainingFood = antSystem.foods.filter((item) => !item.delivered).length;
  const heaviestFood = antSystem.foods.reduce((max, food) => Math.max(max, food.requiredCarriers), 1);
  const focusTarget = antSystem.foodSystem?.getFocusTarget?.();
  const focusTargetMeta = antSystem.foodSystem?.getFocusTargetMeta?.();
  const selectedNestHealth = antSystem.foodSystem?.getSelectedNestHealth?.();
  const selectedNestLabel = antSystem.foodSystem?.getSelectedNestLabel?.() ?? 'Home Nest';
  const selectedNest = antSystem.foodSystem?.getSelectedNest?.();

  return {
    cameraText: 'Camera: drag to orbit, pinch or wheel to zoom.',
    terrainText: `Terrain: ${getTriangleCount(terrain.geometry)} tris, x/z [-50, 50], y [-${levelDefinition?.terrain?.maxHeight ?? TERRAIN_CONFIG.maxHeight}, ${levelDefinition?.terrain?.maxHeight ?? TERRAIN_CONFIG.maxHeight}], ${levelDefinition?.label ?? 'sandbox'} (${levelDefinition?.timeOfDay ?? 'day'}).`,
    antText: `Ants: ${antSummary.total} total, carrying ${antSummary.carrying}, classes W/F ${antSummary.workers}/${antSummary.fighters}, opening ${levelDefinition?.setup?.playerStartingCounts?.workers ?? 0}/${levelDefinition?.setup?.playerStartingCounts?.fighters ?? 0}, render ${antSummary.fullMesh}/${antSummary.impostor}.`,
    selectedNestText: `Selected nest: ${selectedNestLabel}${selectedNestHealth ? `, HP ${selectedNestHealth.hp}/${selectedNestHealth.maxHp}${selectedNestHealth.collapsed ? ' (collapsed)' : ''}` : ''}, stored ${(antSystem.foodSystem?.getSelectedNestStored?.() ?? 0).toFixed(1)}`,
    focusText: focusTarget
      ? `Focus: ${focusTargetMeta?.label ?? 'terrain'} at x ${focusTarget.x.toFixed(1)}, z ${focusTarget.z.toFixed(1)}`
      : 'Focus: none',
    objectiveText: `Objective: ${levelDefinition?.objectiveText ?? 'Destroy hostile nests.'}`,
    battleText: `Battle: ${antSummary.enemyAntsDefeated} enemy down, ${antSummary.playerAntsLost} player lost, ${antSummary.enemyNestsDestroyed} enemy nests down, ${antSystem.foodSystem?.getActiveEnemyNestCount?.() ?? 0} enemy nests still active.`,
    foodText: `Food: ${remainingFood} left, selected nest stored ${(antSystem.foodSystem?.getSelectedNestStored?.() ?? 0).toFixed(1)}, max carriers ${heaviestFood}, sense ~${FOOD_CONFIG.senseDistance}m.`,
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
  const buildInfo = createBuildInfo();
  const enemyProductionCooldowns = new Map();

  const randomEnemyProductionCooldown = () => THREE.MathUtils.lerp(
    ENEMY_ECONOMY_CONFIG.productionCooldownMin,
    ENEMY_ECONOMY_CONFIG.productionCooldownMax,
    Math.random(),
  );

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

  let currentLevelDefinition = getLevelDefinition(1);

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
    if (pointerUpHandler && renderer?.domElement) renderer.domElement.removeEventListener('pointerup', pointerUpHandler);
    pointerDownHandler = null;
    pointerUpHandler = null;
    pointerDown = null;
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
      camera.position.set(36, 26, 36);
      camera.up.set(0, 1, 0);
      camera.lookAt(0, 0, 0);

      controls = new OrbitControls(camera, renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.target.set(0, 2, 0);
      controls.minDistance = 10;
      controls.maxDistance = 120;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.enablePan = true;

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

      foodSystem = new FoodSystem({ scene, count: currentLevelDefinition.foodCount, enemyNestCount: currentLevelDefinition.enemyNestCount });
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
        pointerDown = { x: event.clientX, y: event.clientY };
      };
      pointerUpHandler = (event) => {
        if (!pointerDown || !camera || !terrain || !foodSystem || !antSystem) return;
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
  };
};
