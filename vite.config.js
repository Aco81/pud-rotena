import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Esto ayuda a depurar si algo falla
    sourcemap: true,
  },
  // Esto asegura que las rutas funcionen bien en Vercel
  base: './',
})
