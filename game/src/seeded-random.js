const FNV_OFFSET = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

export const DEFAULT_RANDOM_SOURCE = () => Math.random();

export const hashSeed = (value) => {
  const text = String(value ?? '');
  let hash = FNV_OFFSET;

  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }

  return hash >>> 0;
};

export const createSeededRandom = (seed) => {
  let state = hashSeed(seed) || 0x6d2b79f5;

  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

export const deriveSeed = (seed, streamName) => `${String(seed ?? 'seed')}::${streamName}`;

export const createRandomRange = (random = DEFAULT_RANDOM_SOURCE) => (min, max) => min + random() * (max - min);
