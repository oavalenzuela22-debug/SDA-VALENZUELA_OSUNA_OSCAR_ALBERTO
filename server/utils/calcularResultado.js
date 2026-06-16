// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/utils/calcularResultado.js
// MÓDULO    : Utilidades de Auditoría
// PROPÓSITO : Cálculo de porcentajes de cumplimiento basados en ponderaciones.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

// ------------------------------------------------------------
// FUNCIÓN  : calcularResultado
// PROPÓSITO: Calcula el porcentaje de cumplimiento ponderado de una auditoría.
// PARÁMETROS:
//   - resultados (Array): Lista de respuestas del usuario.
//   - catalogo (Array): Catálogo de puntos de control con sus ponderaciones.
// RETORNA  : (Number) Porcentaje (0-100) truncado a 2 decimales.
// ------------------------------------------------------------
function calcularResultado(resultados, catalogo) {
  let sumaObtenida = 0;
  let sumaMaxima = 0;

  /* Itera sobre cada resultado para buscar su ponderación en el catálogo */
  for (const resultado of resultados) {
    const pc = catalogo.find(p => p.numero === resultado.pc_numero);
    if (!pc || parseFloat(pc.ponderacion) === 0) continue;

    const pond = parseFloat(pc.ponderacion);
    sumaMaxima += pond;

    /* Los estados 'SI' y 'NA' (No Aplica) suman el puntaje completo */
    if (resultado.cumplimiento === 'SI' || resultado.cumplimiento === 'NA') {
      sumaObtenida += pond;
    }
    // cumplimiento === 'NO' suma 0
  }

  if (sumaMaxima === 0) return 0;
  
  /* Cálculo final con redondeo a dos decimales para precisión institucional */
  return Math.round((sumaObtenida / sumaMaxima) * 100 * 100) / 100;
}

module.exports = { calcularResultado };
