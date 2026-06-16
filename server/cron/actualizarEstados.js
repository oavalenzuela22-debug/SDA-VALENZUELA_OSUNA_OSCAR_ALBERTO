// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/cron/actualizarEstados.js
// MÓDULO    : Procesos Automáticos (Cron Jobs)
// PROPÓSITO : Re-calcular y actualizar masivamente los estados de semáforo de todos los expedientes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { pool } = require('../db/connection');
const { 
  calcularEstadoSemaforo, 
  esVigenciaIndeterminada, 
  getReglasVigencia, 
  VIGENCIA_INDETERMINADA_DEFAULT 
} = require('../utils/semaforo');

// ------------------------------------------------------------
// FUNCIÓN  : actualizarEstados
// PROPÓSITO: Iterar sobre todos los expedientes activos, recalcular su estado de vigencia y sincronizar cambios en la base de datos.
// PARÁMETROS: Ninguno
// RETORNA  : Promise<Number> — Cantidad de expedientes cuyo estado fue modificado.
// ERRORES  : Se capturan y notifican fallos durante la consulta o actualización SQL.
// ------------------------------------------------------------
async function actualizarEstados() {
  try {
    const reglas = await getReglasVigencia(pool);
    const { rows: expedientes } = await pool.query(
      `SELECT e.id, e.estado, e.fecha_vigencia, e.no_aplica, g.municipio, d.nombre as documento_nombre
       FROM expedientes e
       JOIN guarderias g ON g.id = e.guarderia_id AND g.activo = true
       JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true`
    );

    let actualizados = 0;
    for (const exp of expedientes) {
      const nuevoEstado = calcularEstadoSemaforo(
        { estado: exp.estado, fecha_vigencia: exp.fecha_vigencia, no_aplica: exp.no_aplica },
        exp.municipio,
        exp.documento_nombre,
        reglas
      );

      
      if (nuevoEstado !== exp.estado) {
        await pool.query(
          `UPDATE expedientes SET estado = $1, updated_at = NOW() WHERE id = $2`,
          [nuevoEstado, exp.id]
        );
        actualizados++;
      }
    }
    return actualizados;
  } catch (e) {
    console.error('[Cron] Error en actualizarEstados:', e.message);
    throw e;
  }
}

module.exports = { 
  actualizarEstados, 
  esVigenciaIndeterminada, 
  getReglasVigencia, 
  VIGENCIA_INDETERMINADA_DEFAULT 
};

