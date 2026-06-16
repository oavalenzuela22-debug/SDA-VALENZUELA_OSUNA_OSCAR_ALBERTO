// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/utils/logger.js
// MÓDULO    : Utilidad de Bitácora (Logging)
// PROPÓSITO : Función centralizada para el registro de eventos del sistema en la base de datos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { pool } = require('../db/connection');

/**
 * Registra un evento en la bitácora del sistema (logs_sistema).
 * 
 * @param {string} nivel - 'CRÍTICO', 'ADVERTENCIA', 'INFORMATIVO'
 * @param {string} modulo - 'AUTH', 'CRON', 'BACKUP', 'BD', 'EMAIL', 'CONFIG', 'DATA', 'SECURITY'
 * @param {string} accion - Descripción corta de lo ocurrido.
 * @param {object} detalles - Objeto JSON con información adicional técnica.
 * @param {number|null} usuario_id - ID del usuario que generó el evento (null si es el sistema).
 * @param {string} status - 'SUCCESS', 'FAILURE', 'PENDING', 'SUCCESS_WITH_WARNING'
 */
async function logSistema(nivel, modulo, accion, detalles = {}, usuario_id = null, status = 'SUCCESS') {
  try {
    const sql = `
      INSERT INTO logs_sistema (timestamp, nivel, modulo, accion, detalles, usuario_id, status)
      VALUES (NOW(), $1, $2, $3, $4, $5, $6)
    `;
    const params = [
      nivel,
      modulo,
      accion,
      JSON.stringify(detalles),
      usuario_id,
      status
    ];
    await pool.query(sql, params);
    
    // También imprimimos en consola para el desarrollador en tiempo real
    const color = nivel === 'CRÍTICO' ? '\x1b[31m' : (nivel === 'ADVERTENCIA' ? '\x1b[33m' : '\x1b[32m');
    console.log(`${color}[${nivel}] [${modulo}] ${accion}\x1b[0m`, detalles);
  } catch (err) {
    // Si falla el log, lo imprimimos en consola pero no dejamos que rompa la ejecución principal
    console.error('CRÍTICO: Error al guardar log en base de datos:', err.message);
  }
}

module.exports = { logSistema };
