import * as THREE from 'three';

export const TERRAIN_CONFIG = Object.freeze({
  width: 100,
  depth: 100,
  widthSegments: 100,
  depthSegments: 100,
  maxHeight: 5,
  noiseScale: 0.055,
  octaves: 4,
});

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

export const sampleHeight = (x, z, {
  maxHeight = TERRAIN_CONFIG.maxHeight,
  noiseScale = TERRAIN_CONFIG.noiseScale,
  octaves = TERRAIN_CONFIG.octaves,
} = {}) => {
  const base = fractalNoise2D(x * noiseScale, z * noiseScale, { octaves });
  return THREE.MathUtils.clamp(base * maxHeight, -maxHeight, maxHeight);
};

export const createTerrainGeometry = ({
  width = TERRAIN_CONFIG.width,
  depth = TERRAIN_CONFIG.depth,
  widthSegments = TERRAIN_CONFIG.widthSegments,
  depthSegments = TERRAIN_CONFIG.depthSegments,
  maxHeight = TERRAIN_CONFIG.maxHeight,
  noiseScale = TERRAIN_CONFIG.noiseScale,
  octaves = TERRAIN_CONFIG.octaves,
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
  geometry.computeBoundingSphere();
  return geometry;
};

export const createTerrainMaterial = () => new THREE.MeshToonMaterial({
  color: 0xa7d0e8,
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
