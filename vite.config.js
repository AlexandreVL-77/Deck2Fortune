import { defineConfig } from 'vite';
import { cp } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  // Keep URLs relative so the game works from its GitHub Pages subpath.
  base: './',
  plugins: [{
    name: 'copy-original-game-assets',
    apply: 'build',
    // Vite cannot detect asset paths stored as strings in cards.js.
    // Copy the original assets folder unchanged so dynamic card art exists in dist.
    closeBundle: async () => {
      await cp(resolve(rootDir, 'assets'), resolve(rootDir, 'dist/assets'), { recursive: true, force: true });
    }
  }]
});
