import { defineConfig } from 'vite';
import solid from 'vite-plugin-solid';

export default defineConfig(({ command }) => {
  return {
    base: command === 'build' ? '/tagstr/' : '/',
    plugins: [solid()],
    server: {
      port: 3000,
      host: true
    },
    build: {
      target: 'esnext'
    }
  };
});