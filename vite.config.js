import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'MAP_BOX_TOKEN');
  const token = process.env.MAP_BOX_TOKEN || env.MAP_BOX_TOKEN || '';
  if (token && !token.startsWith('pk.')) {
    throw new Error('MAP_BOX_TOKEN must be a public Mapbox token (starting with pk.).');
  }
  return {
    define: { __MAP_BOX_TOKEN__: JSON.stringify(token) },
  };
});
