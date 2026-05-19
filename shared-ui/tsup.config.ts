import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  external: ['react', 'react-dom', 'next', 'framer-motion'],
  jsx: 'preserve',
  treeshake: true,
  splitting: false,
  sourcemap: false,
})
