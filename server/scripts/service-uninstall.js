// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/scripts/service-uninstall.js
// MÓDULO    : Servicios de Sistema (Windows)
// PROPÓSITO : Eliminación segura del servicio de segundo plano del backend SDA.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const Service = require('node-windows').Service;
const path = require('path');
const svc = new Service({
  name: 'SDA_Background_Alerts',
  script: path.join(__dirname, '..', 'index.js')
});

// ------------------------------------------------------------
// EVENTO: uninstall
// PROPÓSITO: Se ejecuta cuando el servicio se ha eliminado.
// ------------------------------------------------------------
svc.on('uninstall', function() {
  console.log('[Service] El servicio ha sido desinstalado.');
  console.log('[Service] El sistema ya no ejecutará SDA en segundo plano al iniciar.');
});

console.log('[Service] Iniciando proceso de desinstalación...');
svc.uninstall();
