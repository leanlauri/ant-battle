/* eslint-env node */
/* global process */
import { execSync } from 'node:child_process';
import { defineConfig } from 'vite';

const buildId = (() => {
  const ciSha = process.env.GITHUB_SHA || process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF;
  if (ciSha) return ciSha.slice(0, 7);
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return `stamp-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
  }
})();

const pagesBase = (() => {
  if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_REPOSITORY) {
    const [, repo] = process.env.GITHUB_REPOSITORY.split('/');
    if (repo) return `/${repo}/`;
  }
  return '/';
})();

export default defineConfig({
  base: pagesBase,
  define: {
    __BUILD_ID__: JSON.stringify(buildId),
  },
  server: {
    open: true,
  },
});
