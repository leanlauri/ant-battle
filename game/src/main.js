/* global __BUILD_ID__ */
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AntSystem } from './ant-system.js';
import { FOOD_CONFIG, FoodSystem } from './food-system.js';
import { PheromoneSystem } from './pheromone-system.js';
import { TERRAIN_CONFIG, createTerrainMesh, createTerrainOverlay, getTriangleCount } from './terrain.js';

const BUILD_ID_FALLBACK = '9172f01';
const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : BUILD_ID_FALLBACK;
const BUILD_INFO = {
  value: BUILD_ID,
  source: typeof __BUILD_ID__ !== 'undefined' ? 'bundle' : 'fallback',
};

const refreshBuildIdFromGitHub = async () => {
  try {
    const response = await fetch('https://api.github.com/repos/leanlauri/web-experiments/commits?sha=main&path=ants&per_page=1');
    if (!response.ok) return;
    const commits = await response.json();
    const sha = commits?.[0]?.sha;
    if (typeof sha === 'string' && sha.length >= 7) {
      BUILD_INFO.value = sha.slice(0, 7);
      BUILD_INFO.source = 'github';
    }
  } catch {
    // Keep the bundled or checked-in fallback id.
  }
};

const showFatalError = (error) => {
  const overlay = document.getElementById('fatalOverlay');
  const message = document.getElementById('fatalMessage');
  const detail = error instanceof Error ? error.message : String(error);
  if (message) message.textContent = `The 3D scene could not start.\n\n${detail}`;
  if (overlay) overlay.style.display = 'flex';
};

const updateHud = ({ terrain, antSystem }) => {
  const cameraInfo = document.getElementById('cameraInfo');
  const meshInfo = document.getElementById('meshInfo');
  const antInfo = document.getElementById('antInfo');
  const foodInfo = document.getElementById('foodInfo');
  const buildInfo = document.getElementById('buildInfo');
  const hudHint = document.getElementById('hudHint');
  const hud = document.getElementById('hud');

  if (hudHint && hud) hudHint.textContent = hud.open ? 'tap to collapse' : 'tap to expand';
  if (cameraInfo) cameraInfo.textContent = 'Camera: drag to orbit, pinch or wheel to zoom.';
  if (meshInfo) meshInfo.textContent = `Terrain: ${getTriangleCount(terrain.geometry)} tris, x/z [-50, 50], y [-${TERRAIN_CONFIG.maxHeight}, ${TERRAIN_CONFIG.maxHeight}].`;

  if (antInfo && antSystem) {
    const summary = antSystem.getSummary();
    antInfo.textContent = `Ants: ${summary.total} total, carrying ${summary.carrying}, roles S/F/W ${summary.scouts}/${summary.foragers}/${summary.workers}, render ${summary.fullMesh}/${summary.impostor}.`;
  }

  if (foodInfo && antSystem) {
    const remaining = antSystem.foods.filter((item) => !item.delivered).length;
    const heaviest = antSystem.foods.reduce((max, food) => Math.max(max, food.requiredCarriers), 1);
    foodInfo.textContent = `Food: ${remaining} left, nest stored ${(antSystem.foodSystem?.nestStored ?? 0).toFixed(1)}, max carriers ${heaviest}, sense ~${FOOD_CONFIG.senseDistance}m.`;
  }

  if (buildInfo) {
    buildInfo.textContent = `Build: ${BUILD_INFO.value}`;
  }
};

const bootstrap = async () => {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.shadowMap.enabled = true;
  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xdbe7f4);
  scene.fog = new THREE.Fog(0xdbe7f4, 39, 104);

  const camera = new THREE.PerspectiveCamera(48, window.innerWidth / window.innerHeight, 0.1, 260);
  camera.position.set(36, 26, 36);
  camera.up.set(0, 1, 0);
  camera.lookAt(0, 0, 0);

  const debugVisualsToggle = document.getElementById('debugVisualsToggle');

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 2, 0);
  controls.minDistance = 10;
  controls.maxDistance = 120;
  controls.maxPolarAngle = Math.PI * 0.48;
  controls.enablePan = true;

  scene.add(new THREE.HemisphereLight(0xf2f7ff, 0x7e93a8, 1.4));
  const sun = new THREE.DirectionalLight(0xffffff, 1.8);
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

  const debugVisualsGroup = new THREE.Group();
  const axesHelper = new THREE.AxesHelper(12);
  debugVisualsGroup.add(axesHelper);
  scene.add(debugVisualsGroup);
  const grid = new THREE.GridHelper(100, 20, 0x3a658f, 0x89a7c3);
  grid.position.y = -0.02;
  debugVisualsGroup.add(grid);

  const terrain = createTerrainMesh();
  scene.add(terrain);
  scene.add(createTerrainOverlay(terrain.geometry));

  const foodSystem = new FoodSystem({ scene });
  const pheromoneSystem = new PheromoneSystem();
  const antSystem = new AntSystem({ scene, camera, foodSystem, pheromoneSystem, foods: foodSystem.items, count: 200 });

  await refreshBuildIdFromGitHub();

  const setDebugVisualsVisible = (visible) => {
    debugVisualsGroup.visible = !!visible;
    foodSystem.setDebugVisualsVisible(visible);
    if (debugVisualsToggle) debugVisualsToggle.checked = !!visible;
  };

  setDebugVisualsVisible(debugVisualsToggle?.checked ?? false);
  debugVisualsToggle?.addEventListener('change', () => {
    setDebugVisualsVisible(debugVisualsToggle.checked);
  });

  updateHud({ terrain, antSystem });

  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  const clock = new THREE.Clock();
  const fixedStep = 1 / 60;
  const maxFrameDt = 0.1;
  const maxSubsteps = 4;
  let accumulator = 0;

  const animate = () => {
    const dt = Math.min(maxFrameDt, clock.getDelta());
    accumulator += dt;
    controls.update();

    let substeps = 0;
    while (accumulator >= fixedStep && substeps < maxSubsteps) {
      pheromoneSystem.update(fixedStep);
      foodSystem.update(fixedStep);
      antSystem.update(fixedStep);
      accumulator -= fixedStep;
      substeps += 1;
    }

    updateHud({ terrain, antSystem });
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
  };

  animate();
};

bootstrap().catch((error) => {
  console.error('Ants bootstrap failed:', error);
  showFatalError(error);
});
