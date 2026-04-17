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
} = {}) => {
  const base = fractalNoise2D(x * noiseScale, z * noiseScale, { octaves });
  const attenuation = getTerrainEdgeAttenuation(x, z, {
    width,
    depth,
    edgeFadeStart,
    edgeHeightScale,
  });
  return THREE.MathUtils.clamp(base * maxHeight * attenuation, -maxHeight, maxHeight);
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

export const createTerrainMaterial = () => new THREE.MeshToonMaterial({
  color: 0xffffff,
  vertexColors: true,
  gradientMap: createToonGradient(),
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
} = {}) => {
  const underlay = new THREE.Mesh(
    new THREE.PlaneGeometry(width * 3, depth * 3, 1, 1),
    new THREE.MeshToonMaterial({
      color: 0xdbe7f4,
      gradientMap: createToonGradient(),
    }),
  );
  underlay.rotation.x = -Math.PI / 2;
  underlay.position.y = -Math.max(10, maxHeight * 3);
  underlay.receiveShadow = false;
  underlay.castShadow = false;
  return underlay;
};

export const createTerrainMesh = (options = {}) => {
  const geometry = createTerrainGeometry(options);
  const material = createTerrainMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  return mesh;
};

export const getTriangleCount = (geometry) => {
  if (geometry.index) return geometry.index.count / 3;
  return geometry.attributes.position.count / 3;
};
