// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/scripts/service-install.js
// MÓDULO    : Servicios de Sistema (Windows)
// PROPÓSITO : Registro del backend como servicio persistente para crons y alertas.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const Service = require('node-windows').Service;
const path = require('path');
const svc = new Service({
  name: 'SDA_Background_Alerts',
  description: 'Servicio de segundo plano para el Sistema de Administración SDA (Alertas y Crons).',
  script: path.join(__dirname, '..', 'index.js'),
  env: [
    {
      name: "NODE_ENV",
      value: "production"
    }
  ]
});

// ------------------------------------------------------------
// EVENTO: install
// PROPÓSITO: Se ejecuta cuando el servicio se ha instalado correctamente.
// ------------------------------------------------------------
svc.on('install', function() {
  console.log('[Service] Instalación completada con éxito.');
  console.log('[Service] Iniciando servicio...');
  svc.start();
});

// ------------------------------------------------------------
// EVENTO: alreadyinstalled
// PROPÓSITO: Se ejecuta si el servicio ya existe en el sistema.
// ------------------------------------------------------------
svc.on('alreadyinstalled', function() {
  console.log('[Service] El servicio ya está instalado.');
});

console.log('[Service] Iniciando proceso de instalación...');
svc.install();
