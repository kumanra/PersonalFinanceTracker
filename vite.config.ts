import {defineConfig, type UserConfig} from 'vite'
import react from '@vitejs/plugin-react'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: 'vitest.setup.ts',
    exclude: [...configDefaults.exclude, 'playwright/**', 'cypress/**'],
  }
} as UserConfig)
