// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : preload.js
// MÓDULO    : Puente de Comunicación (Electron Preload)
// PROPÓSITO : Interfaz segura de IPC entre el proceso principal (Node) y la interfaz gráfica (Renderizador).
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Se selecciona la ruta de guardado del respaldo.
  selectSavePath: (defaultName) => ipcRenderer.invoke('select-save-path', defaultName),
  
  // Se selecciona un archivo de respaldo (.dump) existente.
  selectOpenPath: () => ipcRenderer.invoke('select-open-path'),

  // Solicitud de reinicio de la aplicación. Se envía al proceso principal.
  relaunchApp: () => ipcRenderer.send('relaunch-app')
});

