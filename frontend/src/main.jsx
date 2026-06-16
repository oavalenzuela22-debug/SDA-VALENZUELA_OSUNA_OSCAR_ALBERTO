// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : main.jsx
// MÓDULO    : Núcleo de Aplicación (React)
// PROPÓSITO : Punto de entrada y enrutamiento principal de la interfaz.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
