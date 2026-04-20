import * as THREE from 'three';

export const TERRAIN_CONFIG = Object.freeze({
  width: 100,
  depth: 100,
  widthSegments: 100,
  depthSegments: 100,
  maxHeight: 5,
  noiseScale: 0.055,
  octaves: 4,
  edgeFadeStart: 0.76,
  edgeHeightScale: 0.22,
  riverDepthScale: 1,
});

const TERRAIN_COLOR_CONFIG = Object.freeze({
  low: new THREE.Color(0x7ea7c2),
  high: new THREE.Color(0xdaf0fb),
  slope: new THREE.Color(0x5f7f9b),
  contourAmplitude: 0.035,
  contourFrequency: 2.35,
  slopeInfluence: 0.46,
  ridgeInfluence: 0.14,
  valleyDarken: 0.1,
});

let activeTerrainProfile = { ...TERRAIN_CONFIG };

const RIVER_LAYOUT_CONFIG = Object.freeze({
  edgePadding: 8,
  bridgeHalfLength: 3.2,
});

const RIDGE_LAYOUT_CONFIG = Object.freeze({
  edgePadding: 7,
  passHalfLength: 2.9,
  passHalfWidth: 2.5,
});

const BASE_RIVER_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'river-north-fork',
    axis: 'z',
    offsetRatio: -0.16,
    amplitudeRatio: 0.065,
    frequency: 0.09,
    phase: 0.42,
    width: 2.35,
    depth: 1.15,
    bridgeRatios: Object.freeze([-0.32, -0.08, 0.14, 0.34]),
  }),
  Object.freeze({
    id: 'river-east-fork',
    axis: 'x',
    offsetRatio: 0.18,
    amplitudeRatio: 0.055,
    frequency: 0.084,
    phase: 1.63,
    width: 2.05,
    depth: 1.0,
    bridgeRatios: Object.freeze([-0.34, -0.1, 0.08, 0.3]),
  }),
]);

const BASE_RIDGE_DEFINITIONS = Object.freeze([
  Object.freeze({
    id: 'ridge-west-spine',
    axis: 'z',
    offsetRatio: -0.34,
    amplitudeRatio: 0.04,
    frequency: 0.062,
    phase: 0.86,
    width: 2.7,
    height: 4.9,
    passRatios: Object.freeze([-0.34, -0.06, 0.24]),
  }),
  Object.freeze({
    id: 'ridge-south-spine',
    axis: 'x',
    offsetRatio: 0.36,
    amplitudeRatio: 0.038,
    frequency: 0.066,
    phase: 2.11,
    width: 2.5,
    height: 4.4,
    passRatios: Object.freeze([-0.32, -0.04, 0.2]),
  }),
]);

export const setActiveTerrainProfile = (profile = {}) => {
  activeTerrainProfile = {
    ...TERRAIN_CONFIG,
    ...profile,
  };
};

export const resetActiveTerrainProfile = () => {
  activeTerrainProfile = { ...TERRAIN_CONFIG };
};

export const getActiveTerrainProfile = () => ({ ...activeTerrainProfile });

export const createToonGradient = () => {
  const colors = new Uint8Array([
    23, 44, 72, 255,
    44, 78, 112, 255,
    78, 119, 153, 255,
    122, 164, 193, 255,
    181, 214, 230, 255,
    239, 247, 252, 255,
  ]);
  const texture = new THREE.DataTexture(colors, 6, 1, THREE.RGBAFormat);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestFilter;
  texture.generateMipmaps = false;
  texture.needsUpdate = true;
  return texture;
};

const smoothStep = (t) => t * t * (3 - 2 * t);

const hash2D = (x, z) => {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453123;
  return (s - Math.floor(s)) * 2 - 1;
};

const valueNoise2D = (x, z) => {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const x1 = x0 + 1;
  const z1 = z0 + 1;

  const tx = smoothStep(x - x0);
  const tz = smoothStep(z - z0);

  const n00 = hash2D(x0, z0);
  const n10 = hash2D(x1, z0);
  const n01 = hash2D(x0, z1);
  const n11 = hash2D(x1, z1);

  const nx0 = THREE.MathUtils.lerp(n00, n10, tx);
  const nx1 = THREE.MathUtils.lerp(n01, n11, tx);
  return THREE.MathUtils.lerp(nx0, nx1, tz);
};

const fractalNoise2D = (x, z, { octaves }) => {
  let amplitude = 1;
  let frequency = 1;
  let sum = 0;
  let totalAmplitude = 0;

  for (let i = 0; i < octaves; i += 1) {
    sum += valueNoise2D(x * frequency, z * frequency) * amplitude;
    totalAmplitude += amplitude;
    amplitude *= 0.5;
    frequency *= 2;
  }

  return totalAmplitude > 0 ? sum / totalAmplitude : 0;
};

const getFlowRangeForRiver = (river, { width, depth }) => {
  if (river.axis === 'x') {
    const half = width / 2;
    return {
      min: -half + RIVER_LAYOUT_CONFIG.edgePadding,
      max: half - RIVER_LAYOUT_CONFIG.edgePadding,
    };
  }
  const half = depth / 2;
  return {
    min: -half + RIVER_LAYOUT_CONFIG.edgePadding,
    max: half - RIVER_LAYOUT_CONFIG.edgePadding,
  };
};

const getRiverCenterAtFlow = (river, flowValue, { width, depth }) => {
  const extent = river.axis === 'x' ? depth : width;
  const offset = extent * river.offsetRatio;
  const amplitude = extent * river.amplitudeRatio;
  const wave = Math.sin(flowValue * river.frequency + river.phase) * amplitude;
  if (river.axis === 'x') {
    return { x: flowValue, z: offset + wave };
  }
  return { x: offset + wave, z: flowValue };
};

const getRiverTangentAtFlow = (river, flowValue, { width, depth }) => {
  const extent = river.axis === 'x' ? depth : width;
  const amplitude = extent * river.amplitudeRatio;
  const dWave = Math.cos(flowValue * river.frequency + river.phase) * amplitude * river.frequency;
  const tangent = river.axis === 'x'
    ? new THREE.Vector2(1, dWave)
    : new THREE.Vector2(dWave, 1);
  return tangent.normalize();
};

const getFlowRangeForRidge = (ridge, { width, depth }) => {
  if (ridge.axis === 'x') {
    const half = width / 2;
    return {
      min: -half + RIDGE_LAYOUT_CONFIG.edgePadding,
      max: half - RIDGE_LAYOUT_CONFIG.edgePadding,
    };
  }
  const half = depth / 2;
  return {
    min: -half + RIDGE_LAYOUT_CONFIG.edgePadding,
    max: half - RIDGE_LAYOUT_CONFIG.edgePadding,
  };
};

const getRidgeCenterAtFlow = (ridge, flowValue, { width, depth }) => {
  const extent = ridge.axis === 'x' ? depth : width;
  const offset = extent * ridge.offsetRatio;
  const amplitude = extent * ridge.amplitudeRatio;
  const wave = Math.sin(flowValue * ridge.frequency + ridge.phase) * amplitude;
  if (ridge.axis === 'x') {
    return { x: flowValue, z: offset + wave };
  }
  return { x: offset + wave, z: flowValue };
};

const getRidgeTangentAtFlow = (ridge, flowValue, { width, depth }) => {
  const extent = ridge.axis === 'x' ? depth : width;
  const amplitude = extent * ridge.amplitudeRatio;
  const dWave = Math.cos(flowValue * ridge.frequency + ridge.phase) * amplitude * ridge.frequency;
  const tangent = ridge.axis === 'x'
    ? new THREE.Vector2(1, dWave)
    : new THREE.Vector2(dWave, 1);
  return tangent.normalize();
};

export const getTerrainRivers = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
} = {}) => BASE_RIVER_DEFINITIONS.map((river) => {
  const flowRange = getFlowRangeForRiver(river, { width, depth });
  const bridgeHalfWidth = Math.max((river.width * 0.5) + 0.55, 1.7);
  const bridges = river.bridgeRatios.map((ratio) => {
    const flow = THREE.MathUtils.lerp(flowRange.min, flowRange.max, (ratio + 1) * 0.5);
    const center = getRiverCenterAtFlow(river, flow, { width, depth });
    const tangent = getRiverTangentAtFlow(river, flow, { width, depth });
    return {
      flow,
      center,
      tangent,
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      halfLength: RIVER_LAYOUT_CONFIG.bridgeHalfLength,
      halfWidth: bridgeHalfWidth,
    };
  });

  return {
    ...river,
    flowRange,
    bridges,
  };
});

export const getTerrainLakes = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
} = {}) => {
  const rivers = getTerrainRivers({ width, depth });
  const lakes = [];
  for (const river of rivers) {
    const start = getRiverCenterAtFlow(river, river.flowRange.min, { width, depth });
    const end = getRiverCenterAtFlow(river, river.flowRange.max, { width, depth });
    lakes.push(
      {
        id: `${river.id}-start-lake`,
        x: start.x,
        z: start.z,
        radiusX: river.width * 1.85,
        radiusZ: river.width * 1.55,
        depth: river.depth * 1.9,
      },
      {
        id: `${river.id}-end-lake`,
        x: end.x,
        z: end.z,
        radiusX: river.width * 1.85,
        radiusZ: river.width * 1.55,
        depth: river.depth * 1.9,
      },
    );
  }
  return lakes;
};

export const getTerrainRidges = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
} = {}) => BASE_RIDGE_DEFINITIONS.map((ridge) => {
  const flowRange = getFlowRangeForRidge(ridge, { width, depth });
  const passes = ridge.passRatios.map((ratio) => {
    const flow = THREE.MathUtils.lerp(flowRange.min, flowRange.max, (ratio + 1) * 0.5);
    const center = getRidgeCenterAtFlow(ridge, flow, { width, depth });
    const tangent = getRidgeTangentAtFlow(ridge, flow, { width, depth });
    return {
      flow,
      center,
      tangent,
      normal: new THREE.Vector2(-tangent.y, tangent.x),
      halfLength: RIDGE_LAYOUT_CONFIG.passHalfLength,
      halfWidth: RIDGE_LAYOUT_CONFIG.passHalfWidth,
    };
  });

  return {
    ...ridge,
    flowRange,
    passes,
  };
});

const getRiverDistanceInfo = (x, z, rivers, { width, depth } = activeTerrainProfile) => {
  let nearest = null;
  for (const river of rivers) {
    const flow = river.axis === 'x' ? x : z;
    if (flow < river.flowRange.min - 0.001 || flow > river.flowRange.max + 0.001) continue;
    const center = getRiverCenterAtFlow(river, flow, { width, depth });
    const across = river.axis === 'x'
      ? Math.abs(z - center.z)
      : Math.abs(x - center.x);
    if (!nearest || across < nearest.across) {
      nearest = { river, flow, center, across };
    }
  }
  return nearest;
};

export const isPointOnBridge = (x, z, {
  rivers = getTerrainRivers(),
  margin = 0,
} = {}) => {
  for (const river of rivers) {
    for (const bridge of river.bridges) {
      const dx = x - bridge.center.x;
      const dz = z - bridge.center.z;
      const along = dx * bridge.tangent.x + dz * bridge.tangent.y;
      const across = dx * bridge.normal.x + dz * bridge.normal.y;
      if (Math.abs(along) <= bridge.halfLength + margin && Math.abs(across) <= bridge.halfWidth + margin) return true;
    }
  }
  return false;
};

export const isPointInLake = (x, z, {
  lakes = getTerrainLakes(),
} = {}) => {
  for (const lake of lakes) {
    const dx = (x - lake.x) / Math.max(0.001, lake.radiusX);
    const dz = (z - lake.z) / Math.max(0.001, lake.radiusZ);
    if ((dx * dx + dz * dz) <= 1) return true;
  }
  return false;
};

export const isPointOnRidgePass = (x, z, {
  ridges = getTerrainRidges(),
  margin = 0,
} = {}) => {
  for (const ridge of ridges) {
    for (const pass of ridge.passes) {
      const dx = x - pass.center.x;
      const dz = z - pass.center.z;
      const along = dx * pass.tangent.x + dz * pass.tangent.y;
      const across = dx * pass.normal.x + dz * pass.normal.y;
      if (Math.abs(along) <= pass.halfLength + margin && Math.abs(across) <= pass.halfWidth + margin) return true;
    }
  }
  return false;
};

export const isPointOnRidgeBarrier = (x, z, {
  ridges = getTerrainRidges(),
  margin = 0,
  passMargin = 0,
} = {}) => {
  if (isPointOnRidgePass(x, z, { ridges, margin: passMargin })) return false;
  for (const ridge of ridges) {
    const flow = ridge.axis === 'x' ? x : z;
    if (flow < ridge.flowRange.min - 0.001 || flow > ridge.flowRange.max + 0.001) continue;
    const center = getRidgeCenterAtFlow(ridge, flow, activeTerrainProfile);
    const across = ridge.axis === 'x'
      ? Math.abs(z - center.z)
      : Math.abs(x - center.x);
    if (across <= ridge.width * 0.46 + margin) return true;
  }
  return false;
};

export const isPointInWater = (x, z, {
  rivers = getTerrainRivers(),
  lakes = getTerrainLakes(),
  margin = 0,
  bridgeMargin = 0,
} = {}) => {
  if (isPointOnBridge(x, z, { rivers, margin: bridgeMargin })) return false;
  if (isPointInLake(x, z, { lakes })) return true;
  const nearest = getRiverDistanceInfo(x, z, rivers);
  if (!nearest) return false;
  return nearest.across <= (nearest.river.width * 0.5 + margin);
};

export const segmentCrossesWater = (from, to, {
  rivers = getTerrainRivers(),
  lakes = getTerrainLakes(),
  bridgeMargin = 0,
} = {}) => {
  if (!from || !to) return false;
  const dx = (to.x ?? 0) - (from.x ?? 0);
  const dz = (to.z ?? 0) - (from.z ?? 0);
  const distance = Math.hypot(dx, dz);
  const samples = Math.max(2, Math.min(24, Math.ceil(distance / 0.65)));
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = (from.x ?? 0) + dx * t;
    const z = (from.z ?? 0) + dz * t;
    if (isPointInWater(x, z, { rivers, lakes, bridgeMargin })) return true;
  }
  return false;
};

export const segmentCrossesRidgeBarrier = (from, to, {
  ridges = getTerrainRidges(),
  passMargin = 0,
} = {}) => {
  if (!from || !to) return false;
  const dx = (to.x ?? 0) - (from.x ?? 0);
  const dz = (to.z ?? 0) - (from.z ?? 0);
  const distance = Math.hypot(dx, dz);
  const samples = Math.max(2, Math.min(24, Math.ceil(distance / 0.65)));
  for (let i = 0; i <= samples; i += 1) {
    const t = i / samples;
    const x = (from.x ?? 0) + dx * t;
    const z = (from.z ?? 0) + dz * t;
    if (isPointOnRidgeBarrier(x, z, { ridges, passMargin })) return true;
  }
  return false;
};

export const segmentCrossesTerrainBarrier = (from, to, {
  rivers = getTerrainRivers(),
  lakes = getTerrainLakes(),
  ridges = getTerrainRidges(),
  bridgeMargin = 0,
  passMargin = 0,
} = {}) => segmentCrossesWater(from, to, { rivers, lakes, bridgeMargin }) || segmentCrossesRidgeBarrier(from, to, { ridges, passMargin });

export const findNearestBridgePosition = (x, z, {
  target = null,
  rivers = getTerrainRivers(),
} = {}) => {
  let best = null;
  for (const river of rivers) {
    for (const bridge of river.bridges) {
      const dx = bridge.center.x - x;
      const dz = bridge.center.z - z;
      const distanceSq = dx * dx + dz * dz;
      const targetBias = target
        ? ((bridge.center.x - target.x) ** 2 + (bridge.center.z - target.z) ** 2) * 0.28
        : 0;
      const score = distanceSq + targetBias;
      if (!best || score < best.score) {
        best = { score, center: bridge.center };
      }
    }
  }
  if (!best) return null;
  return new THREE.Vector3(best.center.x, sampleHeight(best.center.x, best.center.z), best.center.z);
};

export const findNearestTerrainCrossingPosition = (x, z, {
  target = null,
  rivers = getTerrainRivers(),
  ridges = getTerrainRidges(),
} = {}) => {
  const crossings = [];
  for (const river of rivers) {
    for (const bridge of river.bridges) crossings.push({ x: bridge.center.x, z: bridge.center.z });
  }
  for (const ridge of ridges) {
    for (const pass of ridge.passes) crossings.push({ x: pass.center.x, z: pass.center.z });
  }

  let best = null;
  for (const crossing of crossings) {
    const dx = crossing.x - x;
    const dz = crossing.z - z;
    const distanceSq = dx * dx + dz * dz;
    const targetBias = target
      ? ((crossing.x - target.x) ** 2 + (crossing.z - target.z) ** 2) * 0.26
      : 0;
    const score = distanceSq + targetBias;
    if (!best || score < best.score) best = { score, crossing };
  }

  if (!best) return null;
  return new THREE.Vector3(best.crossing.x, sampleHeight(best.crossing.x, best.crossing.z), best.crossing.z);
};

const getTerrainCrossings = ({
  rivers = getTerrainRivers(),
  ridges = getTerrainRidges(),
} = {}) => {
  const crossings = [];
  for (const river of rivers) {
    for (const bridge of river.bridges) {
      crossings.push({ id: `bridge:${river.id}:${bridge.flow.toFixed(3)}`, x: bridge.center.x, z: bridge.center.z });
    }
  }
  for (const ridge of ridges) {
    for (const pass of ridge.passes) {
      crossings.push({ id: `pass:${ridge.id}:${pass.flow.toFixed(3)}`, x: pass.center.x, z: pass.center.z });
    }
  }
  return crossings;
};

export const findTerrainRouteTarget = (from, to, {
  rivers = getTerrainRivers(),
  lakes = getTerrainLakes(),
  ridges = getTerrainRidges(),
} = {}) => {
  if (!from || !to) return null;
  if (!segmentCrossesTerrainBarrier(from, to, { rivers, lakes, ridges })) {
    return new THREE.Vector3(to.x, sampleHeight(to.x, to.z), to.z);
  }

  const crossings = getTerrainCrossings({ rivers, ridges });
  if (!crossings.length) return null;

  const isOpen = (a, b) => !segmentCrossesTerrainBarrier(a, b, { rivers, lakes, ridges });
  const startNodes = crossings.filter((node) => isOpen(from, node));
  const endNodeIds = new Set(crossings.filter((node) => isOpen(node, to)).map((node) => node.id));

  if (!startNodes.length) {
    const fallback = findNearestTerrainCrossingPosition(from.x, from.z, { target: to, rivers, ridges });
    return fallback;
  }

  const byId = new Map(crossings.map((node) => [node.id, node]));
  const distances = new Map();
  const previous = new Map();
  const queue = [];

  for (const node of crossings) distances.set(node.id, Number.POSITIVE_INFINITY);
  for (const node of startNodes) {
    const d = Math.hypot(node.x - from.x, node.z - from.z);
    distances.set(node.id, d);
    queue.push(node.id);
  }

  while (queue.length) {
    queue.sort((a, b) => (distances.get(a) ?? Infinity) - (distances.get(b) ?? Infinity));
    const currentId = queue.shift();
    const current = byId.get(currentId);
    if (!current) continue;
    if (endNodeIds.has(currentId)) {
      let cursor = currentId;
      while (previous.has(cursor) && startNodes.every((node) => node.id !== cursor)) {
        cursor = previous.get(cursor);
      }
      const nextNode = byId.get(cursor);
      if (!nextNode) return null;
      return new THREE.Vector3(nextNode.x, sampleHeight(nextNode.x, nextNode.z), nextNode.z);
    }

    for (const neighbor of crossings) {
      if (neighbor.id === currentId) continue;
      if (!isOpen(current, neighbor)) continue;
      const edge = Math.hypot(neighbor.x - current.x, neighbor.z - current.z);
      const candidate = (distances.get(currentId) ?? Infinity) + edge;
      if (candidate < (distances.get(neighbor.id) ?? Infinity)) {
        distances.set(neighbor.id, candidate);
        previous.set(neighbor.id, currentId);
        if (!queue.includes(neighbor.id)) queue.push(neighbor.id);
      }
    }
  }

  return findNearestTerrainCrossingPosition(from.x, from.z, { target: to, rivers, ridges });
};

const getRiverDepthAtPoint = (x, z, {
  rivers,
  lakes,
  width,
  depth,
  riverDepthScale = activeTerrainProfile.riverDepthScale,
} = {}) => {
  let depthValue = 0;
  for (const river of rivers) {
    const flow = river.axis === 'x' ? x : z;
    if (flow < river.flowRange.min - 0.001 || flow > river.flowRange.max + 0.001) continue;
    const center = getRiverCenterAtFlow(river, flow, { width, depth });
    const across = river.axis === 'x'
      ? Math.abs(z - center.z)
      : Math.abs(x - center.x);
    const bank = THREE.MathUtils.smoothstep(across, river.width * 0.4, river.width * 1.5);
    const channel = 1 - THREE.MathUtils.clamp(across / Math.max(0.001, river.width * 0.5), 0, 1);
    depthValue = Math.max(depthValue, (channel ** 2.2) * river.depth * 2.15 * bank * riverDepthScale);
  }

  for (const lake of lakes ?? []) {
    const dx = (x - lake.x) / Math.max(0.001, lake.radiusX);
    const dz = (z - lake.z) / Math.max(0.001, lake.radiusZ);
    const ellipse = dx * dx + dz * dz;
    if (ellipse > 1.35) continue;
    const centerFalloff = 1 - THREE.MathUtils.clamp(ellipse, 0, 1);
    const bank = THREE.MathUtils.smoothstep(ellipse, 1, 0.25);
    depthValue = Math.max(depthValue, (centerFalloff ** 1.7) * lake.depth * bank * riverDepthScale);
  }
  return depthValue;
};

const getRidgeHeightAtPoint = (x, z, {
  ridges,
  width,
  depth,
} = {}) => {
  let ridgeHeight = 0;
  for (const ridge of ridges ?? []) {
    const flow = ridge.axis === 'x' ? x : z;
    if (flow < ridge.flowRange.min - 0.001 || flow > ridge.flowRange.max + 0.001) continue;
    const center = getRidgeCenterAtFlow(ridge, flow, { width, depth });
    const tangent = getRidgeTangentAtFlow(ridge, flow, { width, depth });
    const normal = new THREE.Vector2(-tangent.y, tangent.x);
    const dx = x - center.x;
    const dz = z - center.z;
    const across = Math.abs(dx * normal.x + dz * normal.y);
    const ridgeCore = Math.max(0, 1 - (across / Math.max(0.001, ridge.width)));
    if (ridgeCore <= 0) continue;

    let passAttenuation = 1;
    for (const pass of ridge.passes) {
      const pdx = x - pass.center.x;
      const pdz = z - pass.center.z;
      const passAlong = pdx * pass.tangent.x + pdz * pass.tangent.y;
      const passAcross = pdx * pass.normal.x + pdz * pass.normal.y;
      const passMask = Math.exp(
        -((passAlong * passAlong) / Math.max(0.001, pass.halfLength * pass.halfLength * 1.45)
        + (passAcross * passAcross) / Math.max(0.001, pass.halfWidth * pass.halfWidth * 1.15)),
      );
      passAttenuation *= (1 - THREE.MathUtils.clamp(passMask, 0, 0.92));
    }

    const ridgeContribution = (ridgeCore ** 2.05) * ridge.height * passAttenuation;
    const flowEdgeFade = THREE.MathUtils.smoothstep(
      Math.abs((flow - (ridge.flowRange.min + ridge.flowRange.max) * 0.5) / Math.max(0.001, (ridge.flowRange.max - ridge.flowRange.min) * 0.5)),
      1,
      0.84,
    );
    ridgeHeight = Math.max(ridgeHeight, ridgeContribution * flowEdgeFade);
  }
  return ridgeHeight;
};

export const getTerrainEdgeAttenuation = (x, z, {
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
  edgeFadeStart = activeTerrainProfile.edgeFadeStart,
  edgeHeightScale = activeTerrainProfile.edgeHeightScale,
} = {}) => {
  const halfWidth = Math.max(0.001, width / 2);
  const halfDepth = Math.max(0.001, depth / 2);
  const edgeDistance = Math.max(Math.abs(x) / halfWidth, Math.abs(z) / halfDepth);
  const fade = THREE.MathUtils.clamp(
    (edgeDistance - edgeFadeStart) / Math.max(0.001, 1 - edgeFadeStart),
    0,
    1,
  );
  return THREE.MathUtils.lerp(1, edgeHeightScale, smoothStep(fade));
};

export const sampleHeight = (x, z, {
  maxHeight = activeTerrainProfile.maxHeight,
  noiseScale = activeTerrainProfile.noiseScale,
  octaves = activeTerrainProfile.octaves,
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
  edgeFadeStart = activeTerrainProfile.edgeFadeStart,
  edgeHeightScale = activeTerrainProfile.edgeHeightScale,
  riverDepthScale = activeTerrainProfile.riverDepthScale,
} = {}) => {
  const rivers = getTerrainRivers({ width, depth });
  const lakes = getTerrainLakes({ width, depth });
  const ridges = getTerrainRidges({ width, depth });
  const base = fractalNoise2D(x * noiseScale, z * noiseScale, { octaves });
  const attenuation = getTerrainEdgeAttenuation(x, z, {
    width,
    depth,
    edgeFadeStart,
    edgeHeightScale,
  });
  const riverDepth = getRiverDepthAtPoint(x, z, { rivers, lakes, width, depth, riverDepthScale });
  const ridgeHeight = getRidgeHeightAtPoint(x, z, { ridges, width, depth });
  return THREE.MathUtils.clamp((base * maxHeight * attenuation) - riverDepth + ridgeHeight, -maxHeight, maxHeight);
};

export const createTerrainGeometry = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
  widthSegments = activeTerrainProfile.widthSegments,
  depthSegments = activeTerrainProfile.depthSegments,
  maxHeight = activeTerrainProfile.maxHeight,
  noiseScale = activeTerrainProfile.noiseScale,
  octaves = activeTerrainProfile.octaves,
} = {}) => {
  const geometry = new THREE.PlaneGeometry(width, depth, widthSegments, depthSegments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    const x = position.getX(i);
    const z = position.getZ(i);
    position.setY(i, sampleHeight(x, z, { maxHeight, noiseScale, octaves }));
  }

  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  const minHeight = geometry.boundingBox?.min?.y ?? -maxHeight;
  const maxHeightRange = geometry.boundingBox?.max?.y ?? maxHeight;
  const heightSpan = Math.max(0.0001, maxHeightRange - minHeight);
  const normal = geometry.getAttribute('normal');
  const colors = new Float32Array(position.count * 3);
  const baseColor = new THREE.Color();

  for (let i = 0; i < position.count; i += 1) {
    const y = position.getY(i);
    const heightRatio = THREE.MathUtils.clamp((y - minHeight) / heightSpan, 0, 1);
    const slope = 1 - Math.abs(normal.getY(i));
    const slopeRatio = THREE.MathUtils.clamp((slope - 0.02) / 0.7, 0, 1);
    const ridge = THREE.MathUtils.smoothstep(heightRatio, 0.65, 1);
    const valley = 1 - THREE.MathUtils.smoothstep(heightRatio, 0.14, 0.42);
    const contour = 1 + Math.sin((y - minHeight) * TERRAIN_COLOR_CONFIG.contourFrequency) * TERRAIN_COLOR_CONFIG.contourAmplitude;

    baseColor.copy(TERRAIN_COLOR_CONFIG.low).lerp(TERRAIN_COLOR_CONFIG.high, heightRatio);
    baseColor.lerp(
      TERRAIN_COLOR_CONFIG.slope,
      slopeRatio * TERRAIN_COLOR_CONFIG.slopeInfluence + ridge * TERRAIN_COLOR_CONFIG.ridgeInfluence,
    );
    baseColor.multiplyScalar((1 - valley * TERRAIN_COLOR_CONFIG.valleyDarken) * contour);
    colors[i * 3] = baseColor.r;
    colors[i * 3 + 1] = baseColor.g;
    colors[i * 3 + 2] = baseColor.b;
  }

  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.computeBoundingSphere();
  return geometry;
};

export const createTerrainMaterial = ({ color = 0xffffff } = {}) => new THREE.MeshToonMaterial({
  color,
  vertexColors: true,
  gradientMap: createToonGradient(),
});

export const createTerrainHeightBandsMaterial = ({
  minHeight = -5,
  maxHeight = 5,
  greenStartOffsetMeters = 1,
} = {}) => new THREE.ShaderMaterial({
  uniforms: {
    minHeight: { value: minHeight },
    maxHeight: { value: maxHeight },
    greenStartT: { value: THREE.MathUtils.clamp(0.66 - (greenStartOffsetMeters / Math.max(0.001, maxHeight - minHeight)), 0.4, 0.66) },
  },
  vertexShader: `
    varying float vHeight;
    varying vec3 vNormalW;
    void main() {
      vHeight = position.y;
      vNormalW = normalize(normalMatrix * normal);
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying float vHeight;
    varying vec3 vNormalW;
    uniform float minHeight;
    uniform float maxHeight;
    uniform float greenStartT;

    vec3 bandColor(float t) {
      vec3 c0 = vec3(0.46, 0.47, 0.45); // gray
      vec3 c1 = vec3(0.44, 0.31, 0.19); // brown
      vec3 c2 = vec3(0.76, 0.67, 0.33); // yellow
      vec3 c3 = vec3(0.29, 0.57, 0.24); // green
      if (t < 0.33) {
        return mix(c0, c1, smoothstep(0.0, 0.33, t));
      }
      if (t < greenStartT) {
        return mix(c1, c2, smoothstep(0.33, greenStartT, t));
      }
      return mix(c2, c3, smoothstep(greenStartT, 1.0, t));
    }

    void main() {
      float span = max(0.0001, maxHeight - minHeight);
      float t = clamp((vHeight - minHeight) / span, 0.0, 1.0);
      vec3 base = bandColor(t);
      vec3 lightDir = normalize(vec3(0.35, 0.9, 0.45));
      float diff = clamp(dot(normalize(vNormalW), lightDir), 0.0, 1.0);
      float shade = 0.68 + diff * 0.38;
      gl_FragColor = vec4(base * shade, 1.0);
    }
  `,
});

export const createTerrainOverlay = (geometry) => {
  const wireframe = new THREE.LineSegments(
    new THREE.WireframeGeometry(geometry),
    new THREE.LineBasicMaterial({
      color: 0x173554,
      transparent: true,
      opacity: 0.22,
    }),
  );
  wireframe.position.y += 0.03;
  return wireframe;
};

export const createTerrainUnderlay = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
  maxHeight = activeTerrainProfile.maxHeight,
  color = 0xdbe7f4,
} = {}) => {
  const underlay = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 3, depth * 3, 1, 1),
    new THREE.MeshToonMaterial({
      color,
      gradientMap: createToonGradient(),
    }),
  );
  underlay.rotation.x = -Math.PI / 2;
  underlay.position.y = -Math.max(10, maxHeight * 3);
  underlay.receiveShadow = false;
  underlay.castShadow = false;
  return underlay;
};

export const createTerrainRivers = ({
  width = activeTerrainProfile.width,
  depth = activeTerrainProfile.depth,
} = {}) => {
  const rivers = getTerrainRivers({ width, depth });
  const lakes = getTerrainLakes({ width, depth });
  const group = new THREE.Group();
  const waterMaterial = new THREE.MeshToonMaterial({
    color: 0x5ea6cf,
    transparent: true,
    opacity: 0.56,
    depthWrite: false,
    gradientMap: createToonGradient(),
  });
  const bridgeMaterial = new THREE.MeshToonMaterial({
    color: 0x8f6a41,
    gradientMap: createToonGradient(),
  });

  for (const river of rivers) {
    const sampleCount = 64;
    const positions = [];
    const indices = [];
    for (let i = 0; i <= sampleCount; i += 1) {
      const t = i / sampleCount;
      const flow = THREE.MathUtils.lerp(river.flowRange.min, river.flowRange.max, t);
      const center = getRiverCenterAtFlow(river, flow, { width, depth });
      const tangent = getRiverTangentAtFlow(river, flow, { width, depth });
      const normal = new THREE.Vector2(-tangent.y, tangent.x);
      const leftX = center.x + normal.x * river.width * 0.52;
      const leftZ = center.z + normal.y * river.width * 0.52;
      const rightX = center.x - normal.x * river.width * 0.52;
      const rightZ = center.z - normal.y * river.width * 0.52;
      const centerWaterY = sampleHeight(center.x, center.z) + river.depth * 0.82 + 0.03;
      const leftY = Math.min(centerWaterY, sampleHeight(leftX, leftZ) + 0.1);
      const rightY = Math.min(centerWaterY, sampleHeight(rightX, rightZ) + 0.1);
      positions.push(leftX, leftY, leftZ, rightX, rightY, rightZ);
      if (i < sampleCount) {
        const base = i * 2;
        indices.push(base, base + 2, base + 1, base + 1, base + 2, base + 3);
      }
    }

    const riverGeometry = new THREE.BufferGeometry();
    riverGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    riverGeometry.setIndex(indices);
    riverGeometry.computeVertexNormals();
    const riverMesh = new THREE.Mesh(riverGeometry, waterMaterial);
    riverMesh.receiveShadow = false;
    riverMesh.castShadow = false;
    group.add(riverMesh);

    for (const bridge of river.bridges) {
      const bridgeWidth = bridge.halfWidth * 2 + 0.7;
      const bridgeLength = bridge.halfLength * 2;
      const bridgeMesh = new THREE.Mesh(
        new THREE.BoxGeometry(bridgeWidth, 0.24, bridgeLength),
        bridgeMaterial,
      );
      bridgeMesh.position.set(
        bridge.center.x,
        sampleHeight(bridge.center.x, bridge.center.z) + 0.18,
        bridge.center.z,
      );
      bridgeMesh.rotation.y = Math.atan2(bridge.tangent.x, bridge.tangent.y);
      bridgeMesh.castShadow = true;
      bridgeMesh.receiveShadow = true;
      group.add(bridgeMesh);
    }
  }

  for (const lake of lakes) {
    const lakeMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(lake.radiusX, lake.radiusX * 0.94, 0.22, 28),
      waterMaterial,
    );
    lakeMesh.scale.z = lake.radiusZ / Math.max(0.001, lake.radiusX);
    lakeMesh.position.set(lake.x, sampleHeight(lake.x, lake.z) + lake.depth * 0.82 + 0.03, lake.z);
    lakeMesh.receiveShadow = false;
    lakeMesh.castShadow = false;
    group.add(lakeMesh);
  }

  return group;
};

export const createTerrainMesh = (options = {}) => {
  const geometry = createTerrainGeometry(options);
  const material = createTerrainMaterial({ color: options.materialTint ?? 0xffffff });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
};

export const getTriangleCount = (geometry) => {
  if (geometry.index) return geometry.index.count / 3;
  return geometry.attributes.position.count / 3;
};
