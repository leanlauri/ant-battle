import * as THREE from 'three';

export const PHEROMONE_CONFIG = Object.freeze({
  cellSize: 3,
  depositFood: 1.0,
  depositHome: 0.7,
  evaporationPerSecond: 0.18,
  sampleRadiusCells: 2,
  minStrength: 0.02,
});

const cellCoord = (value, size) => Math.floor(value / size);
const cellKey = (x, z) => `${x},${z}`;

export class PheromoneSystem {
  constructor(config = {}) {
    this.config = { ...PHEROMONE_CONFIG, ...config };
    this.food = new Map();
    this.home = new Map();
  }

  deposit(kind, position, amount) {
    const map = kind === 'home' ? this.home : this.food;
    const cx = cellCoord(position.x, this.config.cellSize);
    const cz = cellCoord(position.z, this.config.cellSize);
    const key = cellKey(cx, cz);
    map.set(key, (map.get(key) ?? 0) + amount);
  }

  sample(kind, position) {
    const map = kind === 'home' ? this.home : this.food;
    const baseX = cellCoord(position.x, this.config.cellSize);
    const baseZ = cellCoord(position.z, this.config.cellSize);
    const result = new THREE.Vector3();

    for (let dz = -this.config.sampleRadiusCells; dz <= this.config.sampleRadiusCells; dz += 1) {
      for (let dx = -this.config.sampleRadiusCells; dx <= this.config.sampleRadiusCells; dx += 1) {
        const cx = baseX + dx;
        const cz = baseZ + dz;
        const strength = map.get(cellKey(cx, cz)) ?? 0;
        if (strength <= 0) continue;
        const worldX = (cx + 0.5) * this.config.cellSize;
        const worldZ = (cz + 0.5) * this.config.cellSize;
        const dir = new THREE.Vector3(worldX - position.x, 0, worldZ - position.z);
        const distSq = Math.max(1, dir.lengthSq());
        dir.normalize().multiplyScalar(strength / distSq);
        result.add(dir);
      }
    }

    return result;
  }

  update(dt) {
    const decay = Math.exp(-this.config.evaporationPerSecond * dt);
    for (const map of [this.food, this.home]) {
      for (const [key, value] of map.entries()) {
        const next = value * decay;
        if (next < this.config.minStrength) map.delete(key);
        else map.set(key, next);
      }
    }
  }
}
