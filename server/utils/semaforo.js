// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/utils/semaforo.js
// MÓDULO    : Utilidades de Negocio
// PROPÓSITO : Lógica centralizada del semáforo de estados para expedientes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

// Municipios donde ciertos documentos no poseen una fecha de vencimiento fija (indeterminada)
const VIGENCIA_INDETERMINADA_DEFAULT = {
  'Licencia de Uso de suelo': ['Culiacán', 'Navolato']
};

// ------------------------------------------------------------
// FUNCIÓN  : getReglasVigencia
// PROPÓSITO: Obtener las reglas de vigencia personalizada desde la base de datos.
// PARÁMETROS:
//   - pool (Object): Instancia de conexión a PostgreSQL.
// RETORNA  : Promise<Object> — Mapeo de documento hacia lista de municipios.
// ERRORES  : Se retorna el valor por defecto ante fallos en la consulta SQL.
// ------------------------------------------------------------
async function getReglasVigencia(pool) {
  try {
    const { rows } = await pool.query("SELECT valor FROM configuracion WHERE clave = 'reglas_vigencia'");
    if (rows[0] && rows[0].valor) {
      const parsed = JSON.parse(rows[0].valor);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch (e) {
    
  }
  return VIGENCIA_INDETERMINADA_DEFAULT;
}

// ------------------------------------------------------------
// FUNCIÓN  : esVigenciaIndeterminada
// PROPÓSITO: Determinar si un documento califica para vigencia indeterminada según su nombre y municipio.
// PARÁMETROS:
//   - documentoNombre (String): Nombre del documento en el catálogo.
//   - municipio (String)      : Municipio de ubicación de la guardería.
//   - reglas (Object)         : (Opcional) Reglas inyectadas.
// RETORNA  : Boolean — True si se cumple la condición de indeterminación.
// ------------------------------------------------------------
function esVigenciaIndeterminada(documentoNombre, municipio, reglas = null) {
  const r = reglas || VIGENCIA_INDETERMINADA_DEFAULT;
  const municipios = r[documentoNombre];
  if (!municipios || !Array.isArray(municipios)) return false;
  const munNorm = (municipio || '').trim().toLowerCase();
  return municipios.some(m => (m || '').trim().toLowerCase() === munNorm);
}

// ------------------------------------------------------------
// FUNCIÓN  : calcularEstadoSemaforo
// PROPÓSITO: Calcular el estado visual (semáforo) de un expediente basándose en su vigencia actual.
// PARÁMETROS:
//   - exp (Object)            : Datos del expediente (estado, fecha_vigencia, no_aplica).
//   - municipio (String)      : Municipio de la guardería asociada.
//   - documentoNombre (String): Nombre del documento para evaluación de reglas.
//   - reglas (Object)         : (Opcional) Reglas de vigencia personalizada.
// RETORNA  : String — Estado resultante ('vigente', 'por vencer', 'vencido', 'no aplica').
// ------------------------------------------------------------
function calcularEstadoSemaforo(exp, municipio, documentoNombre, reglas = null) {
  if (exp.no_aplica) {
    return 'no aplica';
  }
  
  const hoy = new Date().toISOString().slice(0, 10);
  const vig = exp.fecha_vigencia ? (exp.fecha_vigencia instanceof Date ? exp.fecha_vigencia.toISOString().slice(0, 10) : String(exp.fecha_vigencia).slice(0, 10)) : null;

  // 1. Evaluación de casos con vigencia indeterminada
  if (esVigenciaIndeterminada(documentoNombre, municipio, reglas)) {
    // En caso de estados obsoletos o inaplicables, se normaliza el valor a 'vencido'
    if (exp.estado === 'no aplica' || exp.estado === 'con observaciones') return 'vencido';
    return exp.estado || 'vencido';
  }

  // 2. Evaluación de expedientes sin fecha de vigencia registrada
  if (!vig) {
    // Ante la ausencia de fecha, se descartan los estados de vigencia positiva
    if (exp.estado === 'no aplica' || exp.estado === 'con observaciones') return 'vencido';
    return exp.estado || 'vencido';
  }

  // 3. Verificación de documento vencido
  if (vig < hoy) return 'vencido';
  
  // 4. Verificación de documento por vencer (umbral preventivo de 45 días)
  const dAviso = new Date(vig);
  dAviso.setDate(dAviso.getDate() - 45);
  
  if (hoy >= dAviso.toISOString().slice(0, 10)) {
    return 'por vencer';
  }
  
  // 5. Documento en estado vigente
  return 'vigente';
}

module.exports = {
  esVigenciaIndeterminada,
  calcularEstadoSemaforo,
  getReglasVigencia,
  VIGENCIA_INDETERMINADA_DEFAULT
};

