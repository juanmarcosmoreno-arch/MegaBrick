import { defineConfig } from 'vite';

// Ruta base para GitHub Pages (https://USUARIO.github.io/<repo>/).
// En GitHub Actions se toma el nombre real del repositorio (GitHub Pages
// distingue mayúsculas en la ruta); en local se usa '/megabrick/'.
const repo = process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'megabrick';

export default defineConfig({
  base: `/${repo}/`,
  build: {
    target: 'es2022',
    // Todo el juego va en un solo archivo (three.js, el mundo, Coco y los
    // animales hechos por código): ~1,1 MB, ~330 kB comprimido.
    chunkSizeWarningLimit: 1400,
  },
  server: {
    open: false,
  },
});
