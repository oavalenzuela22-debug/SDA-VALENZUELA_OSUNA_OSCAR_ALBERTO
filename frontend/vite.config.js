// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : vite.config.js
// MÓDULO    : Configuración
// PROPÓSITO : Configuración del empaquetador Vite.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/SDA.png': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      }
    }
  }
})
