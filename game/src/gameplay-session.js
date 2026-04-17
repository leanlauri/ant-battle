/* global __BUILD_ID__ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AntSystem } from './ant-system.js';
import { FoodSystem, UPGRADE_CONFIG } from './food-system.js';
import { runEnemyProductionStep } from './enemy-economy.js';
import { EnvironmentalPropsSystem } from './environment-props.js';
import { getLevelDefinition } from './level-definition.js';
import { getObjectiveStatus } from './objective-rules.js';
import { PheromoneSystem } from './pheromone-system.js';
import { createSeededRandom, deriveSeed } from './seeded-random.js';
import { createTerrainMesh, createTerrainOverlay, createTerrainUnderlay, getActiveTerrainProfile, resetActiveTerrainProfile, sampleHeight, setActiveTerrainProfile } from './terrain.js';

const BUILD_ID_FALLBACK = '9ae531b';
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : BUILD_ID_FALLBACK;
const CAMERA_MODE = {
  orbit: 'orbit',
  battlefield: 'battlefield',
};
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 2, 0);
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(36, 26, 36);
const DEFAULT_CAMERA_OFFSET = DEFAULT_CAMERA_POSITION.clone().sub(DEFAULT_CAMERA_TARGET);
const BATTLEFIELD_FIXED_POLAR_ANGLE = Math.PI / 4;
const BATTLEFIELD_CAMERA_TILT_OFFSET = new THREE.Vector3(0, 40, 40);
const BATTLEFIELD_ORTHOGRAPHIC_SIZE = 34;
const BATTLEFIELD_FRUSTUM_TOP_RATIO = 0.9;
const BATTLEFIELD_FRUSTUM_BOTTOM_RATIO = 1.1;
const BATTLEFIELD_NEAR_PLANE = 0.05;
const BATTLEFIELD_FAR_PLANE = 320;
const BATTLEFIELD_MIN_ZOOM = 0.85;
const BATTLEFIELD_MAX_ZOOM = 5.2;
const BATTLEFIELD_EDGE_PADDING = -60;
const BATTLEFIELD_EDGE_PADDING_AT_MAX_ZOOM = -10;
const PERSPECTIVE_FOG_NEAR = 50;
const PERSPECTIVE_FOG_FAR = 104;
const PERSPECTIVE_FOG_NEAR_ORTHO = 70;
const PERSPECTIVE_FOG_FAR_ORTHO = 110;

const updateOrthographicFrustum = (orthographicCamera) => {
  if (!orthographicCamera) return;
  const aspect = Math.max(0.001, window.innerWidth / Math.max(1, window.innerHeight));
  orthographicCamera.left = -BATTLEFIELD_ORTHOGRAPHIC_SIZE * aspect;
  orthographicCamera.right = BATTLEFIELD_ORTHOGRAPHIC_SIZE * aspect;
  orthographicCamera.top = BATTLEFIELD_ORTHOGRAPHIC_SIZE * BATTLEFIELD_FRUSTUM_TOP_RATIO;
  orthographicCamera.bottom = -BATTLEFIELD_ORTHOGRAPHIC_SIZE * BATTLEFIELD_FRUSTUM_BOTTOM_RATIO;
  orthographicCamera.near = BATTLEFIELD_NEAR_PLANE;
  orthographicCamera.far = BATTLEFIELD_FAR_PLANE;
  orthographicCamera.updateProjectionMatrix();
};

const getBattlefieldCameraOffset = () => BATTLEFIELD_CAMERA_TILT_OFFSET.clone();

const getBattlefieldGroundFootprint = ({
  cameraTarget = DEFAULT_CAMERA_TARGET,
  zoom = 1,
  cameraPosition = cameraTarget.clone().add(getBattlefieldCameraOffset()),
} = {}) => {
  const aspect = Math.max(0.001, window.innerWidth / Math.max(1, window.innerHeight));
  const halfWidth = (BATTLEFIELD_ORTHOGRAPHIC_SIZE * aspect) / Math.max(0.001, zoom);
  const top = (BATTLEFIELD_ORTHOGRAPHIC_SIZE * BATTLEFIELD_FRUSTUM_TOP_RATIO) / Math.max(0.001, zoom);
  const bottom = (BATTLEFIELD_ORTHOGRAPHIC_SIZE * BATTLEFIELD_FRUSTUM_BOTTOM_RATIO) / Math.max(0.001, zoom);

  const tempCamera = new THREE.OrthographicCamera(-halfWidth, halfWidth, top, -bottom, BATTLEFIELD_NEAR_PLANE, BATTLEFIELD_FAR_PLANE);
  tempCamera.up.set(0, 1, 0);
  tempCamera.position.copy(cameraPosition);
  tempCamera.lookAt(cameraTarget);
  tempCamera.updateMatrixWorld(true);

  const forward = new THREE.Vector3(0, 0, -1).applyQuaternion(tempCamera.quaternion).normalize();
  if (Math.abs(forward.y) < 1e-5) {
    return {
      minX: -halfWidth,
      maxX: halfWidth,
      minZ: -bottom,
      maxZ: top,
    };
  }

  const corners = [
    new THREE.Vector3(-halfWidth, top, 0),
    new THREE.Vector3(halfWidth, top, 0),
    new THREE.Vector3(-halfWidth, -bottom, 0),
    new THREE.Vector3(halfWidth, -bottom, 0),
  ];

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  for (const corner of corners) {
    const origin = corner.clone().applyQuaternion(tempCamera.quaternion).add(tempCamera.position);
    const t = (cameraTarget.y - origin.y) / forward.y;
    const point = origin.addScaledVector(forward, t);
    const offset = point.sub(cameraTarget);
    minX = Math.min(minX, offset.x);
    maxX = Math.max(maxX, offset.x);
    minZ = Math.min(minZ, offset.z);
    maxZ = Math.max(maxZ, offset.z);
  }

  return { minX, maxX, minZ, maxZ };
};

const getBattlefieldEdgePadding = (zoom = 1) => {
  const zoomAlpha = THREE.MathUtils.clamp(
    (zoom - BATTLEFIELD_MIN_ZOOM) / Math.max(0.001, BATTLEFIELD_MAX_ZOOM - BATTLEFIELD_MIN_ZOOM),
    0,
    1,
  );
  return THREE.MathUtils.lerp(BATTLEFIELD_EDGE_PADDING, BATTLEFIELD_EDGE_PADDING_AT_MAX_ZOOM, zoomAlpha);
};

const clampBattlefieldTargetToTerrain = (target, zoom = 1, cameraPosition = target?.clone().add(getBattlefieldCameraOffset())) => {
  if (!target) return target;
  const terrainProfile = getActiveTerrainProfile();
  const terrainHalfWidth = (terrainProfile.width ?? 100) / 2;
  const terrainHalfDepth = (terrainProfile.depth ?? 100) / 2;
  const footprint = getBattlefieldGroundFootprint({
    cameraTarget: target,
    zoom,
    cameraPosition,
  });
  const edgePadding = getBattlefieldEdgePadding(zoom);

  const minTargetX = (-terrainHalfWidth + edgePadding) - footprint.minX;
  const maxTargetX = (terrainHalfWidth - edgePadding) - footprint.maxX;
  const minTargetZ = (-terrainHalfDepth + edgePadding) - footprint.minZ;
  const maxTargetZ = (terrainHalfDepth - edgePadding) - footprint.maxZ;

  target.x = THREE.MathUtils.clamp(target.x, minTargetX, maxTargetX);
  target.z = THREE.MathUtils.clamp(target.z, minTargetZ, maxTargetZ);
  return target;
};

const syncSceneFog = (sceneRef, activeCamera) => {
  const fog = sceneRef?.fog;
  if (!fog || !activeCamera) return;
  if (activeCamera.isOrthographicCamera) {
    fog.near = PERSPECTIVE_FOG_NEAR_ORTHO;
    fog.far = PERSPECTIVE_FOG_FAR_ORTHO;
    return;
  }
  fog.near = PERSPECTIVE_FOG_NEAR;
  fog.far = PERSPECTIVE_FOG_FAR;
};

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
  let orbitCamera = null;
  let battlefieldCamera = null;
  let controls = null;
  let terrain = null;
  let foodSystem = null;
  let pheromoneSystem = null;
  let antSystem = null;
  let debugVisualsGroup = null;
  let environmentProps = null;
  let resizeHandler = null;
  let pointerDown = null;
  let pointerDownHandler = null;
  let pointerMoveHandler = null;
  let pointerUpHandler = null;
  let animationFrameId = 0;
  let running = false;
  let accumulator = 0;
  let clock = null;
  let debugVisualsVisible = false;
  let battleResolved = false;
  let cameraMode = CAMERA_MODE.battlefield;
  let multiTouchGesture = false;
  const activePointerIds = new Set();
  const pointerPositions = new Map();
  const buildInfo = createBuildInfo();
  const enemyProductionCooldowns = new Map();
  let currentLevelDefinition = getLevelDefinition(1);
  let foodRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'food'));
  let antSetupRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-setup'));
  let antSpawnRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-spawn'));
  let antDecisionRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-runtime'));
  let antEffectRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'ants-effects'));
  let enemyEconomyRandom = createSeededRandom(deriveSeed(currentLevelDefinition.seed, 'enemy-economy'));

  const runEnemyProduction = (dt) => {
    runEnemyProductionStep({
      dt,
      foodSystem,
      antSystem,
      enemyProductionCooldowns,
      levelDefinition: currentLevelDefinition,
      random: enemyEconomyRandom,
    });
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

  const createControls = (activeCamera) => {
    if (!renderer || !activeCamera) return null;
    const nextControls = new OrbitControls(activeCamera, renderer.domElement);
    nextControls.enableDamping = true;
    nextControls.dampingFactor = 0.08;
    nextControls.target.copy(DEFAULT_CAMERA_TARGET);
    nextControls.enablePan = true;
    return nextControls;
  };

  const syncBattlefieldCameraToTarget = (target = controls?.target ?? DEFAULT_CAMERA_TARGET) => {
    if (!battlefieldCamera) return;
    const nextTarget = target.clone();
    clampBattlefieldTargetToTerrain(nextTarget, battlefieldCamera.zoom, battlefieldCamera.position.clone());
    nextTarget.y = sampleHeight(nextTarget.x, nextTarget.z);
    const currentOffset = battlefieldCamera.position.clone().sub(controls?.target ?? nextTarget);
    const hasExistingOffset = Number.isFinite(currentOffset.lengthSq()) && currentOffset.lengthSq() > 0.0001;
    battlefieldCamera.position.copy(nextTarget.clone().add(hasExistingOffset ? currentOffset : getBattlefieldCameraOffset()));
    battlefieldCamera.lookAt(nextTarget);
    battlefieldCamera.updateMatrixWorld();
  };

  const syncOrbitCameraToTarget = (target = controls?.target ?? DEFAULT_CAMERA_TARGET) => {
    if (!orbitCamera) return;
    const nextTarget = target.clone();
    orbitCamera.position.copy(nextTarget.clone().add(DEFAULT_CAMERA_OFFSET));
    orbitCamera.lookAt(nextTarget);
    orbitCamera.updateMatrixWorld();
  };

  const applyCameraMode = () => {
    if (!renderer) return;
    const nextTarget = controls?.target?.clone() ?? DEFAULT_CAMERA_TARGET.clone();
    const nextZoom = battlefieldCamera?.zoom ?? 1;
    controls?.dispose();

    if (cameraMode === CAMERA_MODE.battlefield) {
      camera = battlefieldCamera;
      if (!camera) return;
      antSystem?.setCamera?.(camera);
      updateOrthographicFrustum(camera);
      camera.zoom = THREE.MathUtils.clamp(nextZoom, BATTLEFIELD_MIN_ZOOM, BATTLEFIELD_MAX_ZOOM);
      camera.updateProjectionMatrix();
      syncBattlefieldCameraToTarget(nextTarget);
      syncSceneFog(scene, camera);
      controls = createControls(camera);
      if (!controls) return;
      controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
      controls.touches.ONE = THREE.TOUCH.PAN;
      controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
      controls.enableRotate = true;
      controls.rotateSpeed = 0.9;
      controls.screenSpacePanning = true;
      controls.minPolarAngle = BATTLEFIELD_FIXED_POLAR_ANGLE;
      controls.maxPolarAngle = BATTLEFIELD_FIXED_POLAR_ANGLE;
      controls.minZoom = BATTLEFIELD_MIN_ZOOM;
      controls.maxZoom = BATTLEFIELD_MAX_ZOOM;
      controls.zoomSpeed = 1.4;
    } else {
      camera = orbitCamera;
      if (!camera) return;
      antSystem?.setCamera?.(camera);
      syncOrbitCameraToTarget(nextTarget);
      syncSceneFog(scene, camera);
      controls = createControls(camera);
      if (!controls) return;
      controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
      controls.mouseButtons.MIDDLE = THREE.MOUSE.DOLLY;
      controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
      controls.enableRotate = true;
      controls.rotateSpeed = 1;
      controls.minPolarAngle = 0;
      controls.maxPolarAngle = Math.PI * 0.48;
      controls.minDistance = 10;
      controls.maxDistance = 120;
    }
    controls.target.copy(nextTarget);
    controls.update();
  };

  const enforceBattlefieldCameraConstraints = () => {
    if (!controls || !camera || cameraMode !== CAMERA_MODE.battlefield) return;
    const previousTarget = controls.target.clone();
    clampBattlefieldTargetToTerrain(controls.target, camera.zoom, camera.position.clone());
    const desiredTargetY = sampleHeight(controls.target.x, controls.target.z);
    if (Math.abs(desiredTargetY - controls.target.y) > 1e-4) controls.target.y = desiredTargetY;
    const targetDelta = controls.target.clone().sub(previousTarget);
    if (targetDelta.lengthSq() > 0.000001) camera.position.add(targetDelta);
    controls.update();
  };

  const setBattlefieldCameraZoom = (zoom) => {
    if (!battlefieldCamera) return null;
    battlefieldCamera.zoom = THREE.MathUtils.clamp(zoom, BATTLEFIELD_MIN_ZOOM, BATTLEFIELD_MAX_ZOOM);
    battlefieldCamera.updateProjectionMatrix();
    if (cameraMode === CAMERA_MODE.battlefield) {
      controls.minZoom = BATTLEFIELD_MIN_ZOOM;
      controls.maxZoom = BATTLEFIELD_MAX_ZOOM;
      enforceBattlefieldCameraConstraints();
      syncSceneFog(scene, battlefieldCamera);
    }
    return battlefieldCamera.zoom;
  };

  const setBattlefieldCameraTarget = ({ x, z }) => {
    if (!controls) return null;
    controls.target.set(x, controls.target.y, z);
    if (cameraMode === CAMERA_MODE.battlefield) {
      enforceBattlefieldCameraConstraints();
    } else {
      syncOrbitCameraToTarget(controls.target);
    }
    return {
      x: controls.target.x,
      y: controls.target.y,
      z: controls.target.z,
    };
  };

  const getCameraState = () => ({
    mode: cameraMode,
    projectionType: camera?.isOrthographicCamera ? 'orthographic' : 'perspective',
    zoom: camera?.isOrthographicCamera ? camera.zoom : null,
    frustum: camera?.isOrthographicCamera
      ? {
        left: camera.left,
        right: camera.right,
        top: camera.top,
        bottom: camera.bottom,
        near: camera.near,
        far: camera.far,
      }
      : null,
    position: camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null,
    target: controls ? { x: controls.target.x, y: controls.target.y, z: controls.target.z } : null,
    azimuthAngle: typeof controls?.getAzimuthalAngle === 'function' ? controls.getAzimuthalAngle() : null,
    polarAngle: typeof controls?.getPolarAngle === 'function' ? controls.getPolarAngle() : null,
  });

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
    if (pointerMoveHandler && renderer?.domElement) renderer.domElement.removeEventListener('pointermove', pointerMoveHandler);
    if (pointerUpHandler && renderer?.domElement) {
      renderer.domElement.removeEventListener('pointerup', pointerUpHandler);
      renderer.domElement.removeEventListener('pointercancel', pointerUpHandler);
    }
    pointerDownHandler = null;
    pointerMoveHandler = null;
    pointerUpHandler = null;
    pointerDown = null;
    multiTouchGesture = false;
    activePointerIds.clear();
    pointerPositions.clear();
    controls?.dispose();
    renderer?.dispose();
    if (typeof renderer?.forceContextLoss === 'function') renderer.forceContextLoss();
    if (renderer?.domElement?.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);

    renderer = null;
    scene = null;
    camera = null;
    orbitCamera = null;
    battlefieldCamera = null;
    controls = null;
    terrain = null;
    foodSystem = null;
    pheromoneSystem = null;
    antSystem = null;
    environmentProps?.dispose?.();
    environmentProps = null;
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
    environmentProps?.update(camera, dt, false, controls?.target ?? null);
    syncSceneFog(scene, camera);

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
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      mount.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(currentLevelDefinition.atmosphere?.background ?? 0xdbe7f4);
      scene.fog = new THREE.Fog(currentLevelDefinition.atmosphere?.fog ?? 0xdbe7f4, PERSPECTIVE_FOG_NEAR, PERSPECTIVE_FOG_FAR);

      orbitCamera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 260);
      orbitCamera.position.copy(DEFAULT_CAMERA_POSITION);
      orbitCamera.up.set(0, 1, 0);
      orbitCamera.lookAt(0, 0, 0);

      battlefieldCamera = new THREE.OrthographicCamera();
      battlefieldCamera.position.copy(DEFAULT_CAMERA_POSITION);
      battlefieldCamera.up.set(0, 1, 0);
      battlefieldCamera.zoom = 1.8;

      updateOrthographicFrustum(battlefieldCamera);
      syncBattlefieldCameraToTarget(DEFAULT_CAMERA_TARGET);

      applyCameraMode();

      scene.add(new THREE.HemisphereLight(
        currentLevelDefinition.atmosphere?.hemiSky ?? 0xf2f7ff,
        currentLevelDefinition.atmosphere?.hemiGround ?? 0x7e93a8,
        1.15,
      ));
      scene.add(new THREE.AmbientLight(0xffffff, 0.18));

      const sun = new THREE.DirectionalLight(currentLevelDefinition.atmosphere?.sun ?? 0xffffff, 2.05);
      sun.position.set(28, 30, -16);
      sun.castShadow = true;
      sun.shadow.mapSize.set(2048, 2048);
      sun.shadow.camera.left = -74;
      sun.shadow.camera.right = 74;
      sun.shadow.camera.top = 64;
      sun.shadow.camera.bottom = -64;
      sun.shadow.camera.near = 0.5;
      sun.shadow.camera.far = 120;
      sun.shadow.bias = -0.00016;
      sun.shadow.normalBias = 0.015;
      scene.add(sun);
      scene.add(sun.target);
      sun.target.position.set(0, 0, 0);

      const fillLight = new THREE.DirectionalLight(currentLevelDefinition.atmosphere?.hemiSky ?? 0xdfeeff, 0.34);
      fillLight.position.set(-22, 20, 26);
      fillLight.castShadow = false;
      scene.add(fillLight);

      debugVisualsGroup = new THREE.Group();
      debugVisualsGroup.add(new THREE.AxesHelper(12));
      const grid = new THREE.GridHelper(100, 20, 0x3a658f, 0x89a7c3);
      grid.position.y = -0.02;
      debugVisualsGroup.add(grid);
      scene.add(debugVisualsGroup);

      terrain = createTerrainMesh();
      scene.add(createTerrainUnderlay());
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
      environmentProps = new EnvironmentalPropsSystem({
        scene,
        seed: currentLevelDefinition.seed,
        terrainProfile: getActiveTerrainProfile(),
        nests: foodSystem.nests,
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
        decisionSeed: deriveSeed(currentLevelDefinition.seed, 'ants-runtime'),
        decisionRandom: antDecisionRandom,
        effectRandom: antEffectRandom,
      });
      setDebugVisualsVisible(debugVisualsVisible);
      environmentProps.update(camera, 0, true, controls?.target ?? null);
      publishHud();

      resizeHandler = () => {
        if (!renderer || !camera) return;
        if (orbitCamera) {
          orbitCamera.aspect = window.innerWidth / window.innerHeight;
          orbitCamera.updateProjectionMatrix();
        }
        updateOrthographicFrustum(battlefieldCamera);
        if (cameraMode === CAMERA_MODE.battlefield) enforceBattlefieldCameraConstraints();
        renderer.setSize(window.innerWidth, window.innerHeight);
        publishHud();
      };
      window.addEventListener('resize', resizeHandler);

      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      pointerDownHandler = (event) => {
        activePointerIds.add(event.pointerId);
        pointerPositions.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (activePointerIds.size > 1) {
          multiTouchGesture = true;
          pointerDown = null;
          return;
        }
        pointerDown = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      };
      pointerMoveHandler = (event) => {
        if (!activePointerIds.has(event.pointerId)) return;
        pointerPositions.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (cameraMode !== CAMERA_MODE.battlefield || !controls) return;
        if (activePointerIds.size < 2) return;

        const pointers = [...activePointerIds]
          .map((id) => pointerPositions.get(id))
          .filter(Boolean);
        if (pointers.length < 2) return;

        const centroidY = pointers.reduce((sum, point) => sum + point.y, 0) / pointers.length;
        const height = Math.max(1, renderer?.domElement?.clientHeight ?? window.innerHeight);
        const yNorm = THREE.MathUtils.clamp((centroidY / height) * 2 - 1, -1, 1);
        const signedSpeed = THREE.MathUtils.clamp(-0.9 * yNorm, -0.9, 0.9);
        controls.rotateSpeed = Math.abs(signedSpeed) < 0.16
          ? (yNorm >= 0 ? -0.16 : 0.16)
          : signedSpeed;
      };
      pointerUpHandler = (event) => {
        const releasedFinalPointer = activePointerIds.size <= 1;
        activePointerIds.delete(event.pointerId);
        pointerPositions.delete(event.pointerId);
        if (multiTouchGesture) {
          if (releasedFinalPointer) multiTouchGesture = false;
          pointerDown = null;
          if (cameraMode === CAMERA_MODE.battlefield && controls) controls.rotateSpeed = 0.9;
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
          foodSystem.setFocusTarget(nestHit.position, { type: 'enemy-nest', nestId: nestHit.id, label: nestHit.label });
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
      renderer.domElement.addEventListener('pointermove', pointerMoveHandler);
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
      publishHud();
      return cameraMode;
    },
    getCameraProjectionType: () => (camera?.isOrthographicCamera ? 'orthographic' : 'perspective'),
    getCameraState,
    setBattlefieldCameraZoom,
    setBattlefieldCameraTarget,
    rotateBattlefieldCamera: (azimuthDelta) => {
      if (!controls || !camera || cameraMode !== CAMERA_MODE.battlefield) return null;
      const offset = camera.position.clone().sub(controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), azimuthDelta);
      camera.position.copy(controls.target.clone().add(offset));
      camera.lookAt(controls.target);
      camera.updateMatrixWorld();
      controls.update();
      enforceBattlefieldCameraConstraints();
      publishHud();
      return getCameraState();
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
