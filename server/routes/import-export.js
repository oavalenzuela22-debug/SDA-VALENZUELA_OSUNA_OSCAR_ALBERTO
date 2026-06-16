// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/import-export.js
// MÓDULO    : Reporteo y Carga Masiva (Rutas API)
// PROPÓSITO : Generación de plantillas Excel y procesamiento de cargas masivas de expedientes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const ExcelJS = require('exceljs');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');
const { calcularEstadoSemaforo, getReglasVigencia } = require('../utils/semaforo');
const { logSistema } = require('../utils/logger');


const router = express.Router();
router.use(authMiddleware);

// Configuración de multer para la recepción temporal de archivos Excel
const upload = multer({
  dest: path.join(__dirname, '..', 'tmp'),
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite de 10 MB
  },
  fileFilter: (req, file, cb) => {
    const extensionesPermitidas = ['.xlsx', '.xls'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (!extensionesPermitidas.includes(ext)) {
      return cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
    cb(null, true);
  }
});

// Diccionario de equivalencias: Base de Datos -> Excel
const MAP_BD_A_EXCEL = {
  'vigente': 'VIGENTE',
  'vencido': 'VENCIDO',
  'por vencer': 'POR VENCER',
  'no aplica': 'NO APLICA'
};

// Diccionario de equivalencias: Excel -> Base de Datos
const MAP_EXCEL_A_BD = {
  'VIGENTE': 'vigente',
  'VENCIDO': 'vencido',
  'POR VENCER': 'por vencer',
  'NO APLICA': 'no aplica',
  'NO APLICA AÚN': 'no aplica',
  'N/A': 'no aplica'
};

// ------------------------------------------------------------
// FUNCIÓN  : getCellValueAsString
// PROPÓSITO: Extraer el valor de una celda de Excel de forma segura, gestionando RichText, resultados de fórmulas y objetos Date.
// PARÁMETROS: cell (Object) - Objeto de celda de ExcelJS.
// RETORNA  : String — Representación textual procesada del contenido de la celda.
// ------------------------------------------------------------
function getCellValueAsString(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  if (typeof cell.value === 'string') return cell.value.trim();
  if (typeof cell.value === 'object') {
    if (cell.value.richText && Array.isArray(cell.value.richText)) {
      return cell.value.richText.map(rt => rt.text || '').join('').trim();
    }
    if (cell.value.result !== undefined) return String(cell.value.result).trim();
    if (cell.value instanceof Date) return cell.value.toISOString();
  }
  return String(cell.value).trim();
}

// ------------------------------------------------------------
// FUNCIÓN  : parseExcelDate
// PROPÓSITO: Normalizar y convertir diversos formatos de fecha provenientes de Excel a un objeto Date de JavaScript.
// PARÁMETROS: val (Mixed) - Valor original extraído de la celda.
// RETORNA  : Date|null — Objeto Date normalizado o null si la conversión no es factible.
// ------------------------------------------------------------
function parseExcelDate(val) {
  if (!val) return null;
  
  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'object' && val.result instanceof Date) {
    date = val.result;
  } else if (typeof val === 'object' && val.result !== undefined) {
    val = val.result;
  }

  if (date instanceof Date && !isNaN(date.getTime())) {
    // Se extraen componentes UTC para evitar desfases por zona horaria del servidor.
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const sVal = String(val).trim().toUpperCase();
  if (!sVal || sVal === 'N/A' || sVal === 'NA' || sVal === 'NO APLICA' || sVal === 'INDETERMINADO') return null;

  // Validación de formato dd/mm/aaaa o dd-mm-aaaa
  const m1 = sVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m1) {
    let d = m1[1].padStart(2, '0'), mm = m1[2].padStart(2, '0'), y = m1[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mm}-${d}`;
  }

  // Validación de formato aaaa/mm/dd o aaaa-mm-dd
  const m2 = sVal.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) {
    return `${m2[1]}-${m2[2].padStart(2, '0')}-${m2[3].padStart(2, '0')}`;
  }

  const dFinal = new Date(sVal);
  if (!isNaN(dFinal.getTime())) {
    const y = dFinal.getFullYear();
    const m = String(dFinal.getMonth() + 1).padStart(2, '0');
    const d = String(dFinal.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

// ------------------------------------------------------------
// FUNCIÓN  : GET /encargadas
// PROPÓSITO: Obtener el listado único de encargadas registradas en el sistema para selectores de interfaz.
// ------------------------------------------------------------
router.get('/encargadas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT DISTINCT encargada FROM guarderias WHERE activo = true AND encargada IS NOT NULL AND encargada != \'\' ORDER BY encargada');
    res.json(rows.map(r => r.encargada));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /reporte-guarderia/:guarderiaId
// PROPÓSITO: Generar la estructura de datos para el reporte detallado de expedientes de una guardería específica.
// ------------------------------------------------------------
router.get('/reporte-guarderia/:guarderiaId', async (req, res) => {
  const gid = req.params.guarderiaId;
  try {
    const { rows: gRows } = await pool.query(`SELECT numero, nombre, municipio FROM guarderias WHERE id = $1`, [gid]);
    if (!gRows[0]) return res.status(404).json({ error: 'Guardería no encontrada' });
    const { rows } = await pool.query(`
      SELECT d.nombre as documento_nombre, s.nombre as seccion_nombre, e.estado, e.oficio, e.fecha_documento, e.fecha_vigencia, e.notas
      FROM expedientes e
      JOIN documentos_catalogo d ON d.id = e.documento_id
      JOIN secciones s ON s.id = d.seccion_id
      WHERE e.guarderia_id = $1
      ORDER BY s.orden, d.orden
    `, [gid]);
    res.json({ guarderia: gRows[0], documentos: rows });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /reporte-general
// PROPÓSITO: Compilar el estado global de cumplimiento de todas las guarderías para reportes consolidados.
// ------------------------------------------------------------
router.get('/reporte-general', usuarioActivo, async (req, res) => {
  try {
    const { rows: guarderias } = await pool.query(`SELECT id, numero, nombre, municipio FROM guarderias WHERE activo = true`);
    const { rows: expedientes } = await pool.query(`
      SELECT e.guarderia_id, e.estado
      FROM expedientes e
      JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true
    `);
    const porG = {};
    guarderias.forEach(g => { porG[g.id] = { ...g, vigente: 0, por_vencer: 0, vencido: 0, total: 0, no_aplica: 0 }; });
    expedientes.forEach(e => {
      const s = porG[e.guarderia_id];
      if (s) {
        if (s[e.estado] !== undefined) s[e.estado]++;
        if (e.estado !== 'no aplica') s.total++;
      }
    });
    const lista = Object.values(porG).map(s => ({
      ...s,
      porcentaje: s.total ? Math.round((s.vigente / s.total) * 100) : 0
    }));
    res.json(lista);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /plantilla-encargada
// PROPÓSITO: Generar un archivo Excel con la estructura de control de expedientes para las guarderías asignadas a una encargada.
// ------------------------------------------------------------
router.get('/plantilla-encargada', async (req, res) => {
  const { encargada } = req.query;
  if (!encargada) return res.status(400).json({ error: 'Debe especificar la encargada' });

  try {
    const { rows: docs } = await pool.query(`
      SELECT dc.id, dc.nombre, dc.requiere_vigencia
      FROM documentos_catalogo dc
      JOIN secciones s ON s.id = dc.seccion_id
      WHERE dc.activo = true
      ORDER BY s.orden, dc.orden
    `);

    const { rows: guarderias } = await pool.query(`
      SELECT id, numero, nombre, municipio, encargada, director
      FROM guarderias 
      WHERE (encargada = $1 OR encargada ILIKE '%' || $1 || '%') AND activo = true 
      ORDER BY numero
    `, [encargada]);

    const gIds = guarderias.map(g => g.id);
    if (!gIds.length) {
      return res.status(404).json({ error: 'No se encontraron guarderías para esta encargada' });
    }
    const { rows: expedientes } = await pool.query(`
      SELECT guarderia_id, documento_id, estado, fecha_vigencia, no_aplica, notas
      FROM expedientes
      WHERE guarderia_id = ANY($1)
    `, [gIds]);

    const expMap = {};
    expedientes.forEach(e => { expMap[`${e.guarderia_id}_${e.documento_id}`] = e; });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Control de Expedientes');
    
    // Configuración visual de encabezados
    const headerStyle = {
      font: { bold: true, color: { argb: 'FFFFFFFF' } },
      fill: { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004A23' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      border: {
        top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' }
      }
    };

    const headers = ['#', 'ENCARGADAS', 'COORDINADORAS', 'CLAVE', 'MUNICIPIO', 'NOMBRE', 'DOCUMENTO', 'ESTATUS', 'OBSERVACIONES', 'FEC. VENC.'];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell(cell => { cell.style = headerStyle; });
    headerRow.height = 25;

    let index = 1;
    guarderias.forEach(g => {
      docs.forEach(doc => {
        const exp = expMap[`${g.id}_${doc.id}`];
        const rowData = [
          index++,
          g.encargada || encargada,
          g.director || '', 
          g.numero,
          g.municipio,
          g.nombre,
          doc.nombre,
          exp ? (exp.no_aplica ? 'N/A' : (MAP_BD_A_EXCEL[exp.estado] || '')) : '',
          exp ? (exp.notas || '') : '',
          exp && exp.fecha_vigencia ? (exp.fecha_vigencia instanceof Date ? exp.fecha_vigencia : new Date(exp.fecha_vigencia)) : null
        ];
        
        const row = worksheet.addRow(rowData);
        
        // Se aplica validación de datos para la columna de ESTATUS
        row.getCell(8).dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: ['"VIGENTE,VENCIDO,POR VENCER,N/A"']
        };

        if (rowData[9]) {
          row.getCell(10).numFmt = 'dd/mm/yyyy';
        }

        // Estilización de bordes y fuentes de las celdas de datos
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            left: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            bottom: { style: 'thin', color: { argb: 'FFD1D5DB' } },
            right: { style: 'thin', color: { argb: 'FFD1D5DB' } }
          };
          cell.font = { size: 10 };
        });
      });
    });

    // Definición de anchos de columna
    worksheet.getColumn(1).width = 5;
    worksheet.getColumn(2).width = 25;
    worksheet.getColumn(3).width = 25;
    worksheet.getColumn(4).width = 12;
    worksheet.getColumn(5).width = 18;
    worksheet.getColumn(6).width = 45;
    worksheet.getColumn(7).width = 45;
    worksheet.getColumn(8).width = 18;
    worksheet.getColumn(9).width = 40;
    worksheet.getColumn(10).width = 15;

    // Se incluye una hoja de metadatos oculta para trazabilidad en la carga
    const metaSheet = workbook.addWorksheet('_meta');
    metaSheet.state = 'veryHidden';
    metaSheet.getCell('A1').value = 'encargada';
    metaSheet.getCell('B1').value = encargada;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="Expediente_SDA_${encargada.replace(/\s+/g, '_')}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();

  } catch (e) {
    console.error('[Excel] Error plantilla vertical:', e);
    res.status(500).json({ error: 'Error al generar Excel vertical' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /carga-encargada
// PROPÓSITO: Procesar el archivo Excel cargado para actualizar masivamente los expedientes en la base de datos.
// ------------------------------------------------------------
router.post('/carga-encargada', usuarioActivo, (req, res, next) => {
  upload.single('archivo')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: 'El archivo excede el límite de 10 MB.' });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No se subió ningún archivo' });

  const filePath = req.file.path;
  const workbook = new ExcelJS.Workbook();
  
  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet('Control de Expedientes') || workbook.getWorksheet(1);
    
    // Se mapea el catálogo de documentos para su identificación por nombre
    const { rows: dcRows } = await pool.query('SELECT id, nombre FROM documentos_catalogo WHERE activo = true');
    const catalogMap = {};
    dcRows.forEach(d => { catalogMap[d.nombre.trim().toUpperCase()] = d.id; });

    const client = await pool.connect();
    let guarderiasActualizadas = new Set();
    let expedientesActualizados = 0;
    const advertencias = [];

    try {
      await client.query('BEGIN');
      const reglas = await getReglasVigencia(pool);
      
      const rows = [];
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) rows.push(row); 
      });

      for (const row of rows) {
        const clave = getCellValueAsString(row.getCell(4)); 
        const muni = getCellValueAsString(row.getCell(5)); 
        const docNombre = getCellValueAsString(row.getCell(7)).toUpperCase(); 
        const excelEst = getCellValueAsString(row.getCell(8)).toUpperCase(); 
        const valFecRaw = row.getCell(10).value; 

        if (!clave || !docNombre) continue;

        // Se identifica la guardería combinando Número y Municipio
        const { rows: gRows } = await client.query(
          'SELECT id FROM guarderias WHERE numero = $1 AND (municipio = $2 OR municipio ILIKE $2) AND activo = true', 
          [clave, muni]
        );
        if (!gRows.length) {
          if (!advertencias.includes(`Guardería ${clave} (${muni}) no encontrada`)) {
             advertencias.push(`Guardería ${clave} (${muni}) no encontrada`);
          }
          continue;
        }
        const gId = gRows[0].id;
        guarderiasActualizadas.add(gId);

        // Se identifica el documento en el catálogo
        const dId = catalogMap[docNombre];
        if (!dId) {
          if (!advertencias.includes(`Documento "${docNombre}" no reconocido`)) {
            advertencias.push(`Documento "${docNombre}" no reconocido`);
          }
          continue;
        }

        const sFec = getCellValueAsString(row.getCell(10)).toUpperCase();
        let fechaVig = parseExcelDate(valFecRaw);
        let bdEst = MAP_EXCEL_A_BD[excelEst] || (excelEst ? 'vencido' : 'vigente');
        
        if (sFec === 'INDETERMINADO') {
            bdEst = 'vigente';
            fechaVig = null;
        }

        // Detección de estados "No Aplica" en las columnas de estatus y fecha
        const noAplicaStrings = ['N/A', 'NA', 'NO APLICA', 'NO APLICA AÚN', 'N/A AÚN'];
        let noAplicaFlag = noAplicaStrings.includes(excelEst) || noAplicaStrings.includes(sFec);
        
        if (noAplicaFlag) {
          bdEst = 'no aplica';
          fechaVig = null;
        } else {
          // Si hay una fecha válida, recalculamos el estado según las reglas del semáforo
          // Esto evita que fechas futuras se marquen como vencidas si el Excel venía mal.
          bdEst = calcularEstadoSemaforo({
            estado: bdEst,
            fecha_vigencia: fechaVig,
            no_aplica: false
          }, muni, docNombre, reglas);
        }

        const { rows: oldExp } = await client.query(
          'SELECT id, estado, notas FROM expedientes WHERE guarderia_id = $1 AND documento_id = $2',
          [gId, dId]
        );

        if (oldExp.length) {
          const expId = oldExp[0].id;
          const prevEst = oldExp[0].estado;

          await client.query(
            `UPDATE expedientes SET estado = $1, fecha_vigencia = $2, no_aplica = $3, notas = $4, usuario_id = $5, updated_at = NOW() WHERE id = $6`,
            [bdEst, fechaVig, noAplicaFlag, '', req.user.id, expId]
          );

          if (prevEst !== bdEst) {
            await client.query(
              'INSERT INTO historial (expediente_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo) VALUES ($1, $2, \'estado\', $3, $4)',
              [expId, req.user.id, prevEst, bdEst]
            );
          }
        } else {
          await client.query(
            `INSERT INTO expedientes (guarderia_id, documento_id, estado, fecha_vigencia, no_aplica, notas, usuario_id, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
            [gId, dId, bdEst, fechaVig, noAplicaFlag, '', req.user.id]
          );
          expedientesActualizados++;
        }
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await logSistema('INFORMATIVO', 'DATA', 'Carga masiva de Excel procesada', {
      archivo: req.file.originalname,
      guarderias_afectadas: guarderiasActualizadas.size,
      expedientes_actualizados: expedientesActualizados,
      advertencias_count: advertencias.length
    }, req.user.id, 'SUCCESS');
    res.json({ ok: true, guarderiasActualizadas: guarderiasActualizadas.size, expedientesActualizados, advertencias });

  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    await logSistema('CRÍTICO', 'DATA', 'Fallo en carga masiva de Excel', { error: err.message }, req.user.id, 'FAILURE');
    console.error('[Excel] Error carga vertical:', err);
    res.status(500).json({ error: `Error en la carga: ${err.message}` });
  }

});

// ------------------------------------------------------------
// FUNCIÓN  : GET /proximos-vencer
// PROPÓSITO: Obtener el listado de expedientes cuya vigencia expirará en un lapso determinado.
// ------------------------------------------------------------
router.get('/proximos-vencer', async (req, res) => {
  try {
    const dias = parseInt(req.query.dias, 10) || 45;
    const hoy = new Date().toISOString().slice(0, 10);
    const limite = new Date();
    limite.setDate(limite.getDate() + dias);
    const limiteStr = limite.toISOString().slice(0, 10);
    
    const { rows } = await pool.query(`
      SELECT e.id as expediente_id, e.guarderia_id, e.fecha_vigencia, e.estado, g.numero as guarderia_numero, g.nombre as guarderia_nombre, d.nombre as documento_nombre
      FROM expedientes e
      JOIN guarderias g ON g.id = e.guarderia_id
      JOIN documentos_catalogo d ON d.id = e.documento_id
      WHERE e.fecha_vigencia IS NOT NULL AND e.fecha_vigencia >= $1 AND e.fecha_vigencia <= $2 AND e.estado != 'vigente'
      ORDER BY e.fecha_vigencia
    `, [hoy, limiteStr]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /requiere-retramitacion
// PROPÓSITO: Listar expedientes vencidos que requieren acciones administrativas de renovación.
// ------------------------------------------------------------
router.get('/requiere-retramitacion', async (req, res) => {
  try {
    const hoy = new Date().toISOString().slice(0, 10);
    const { rows } = await pool.query(`
      SELECT e.id as expediente_id, e.guarderia_id, e.fecha_vigencia, e.estado, g.numero as guarderia_numero, g.nombre as guarderia_nombre, g.municipio, g.encargada, d.nombre as documento_nombre
      FROM expedientes e
      JOIN guarderias g ON g.id = e.guarderia_id AND g.activo = true
      JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true
      WHERE e.fecha_vigencia IS NOT NULL AND e.fecha_vigencia < $1
      ORDER BY e.fecha_vigencia, g.numero
    `, [hoy]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /cargas-pendientes
// PROPÓSITO: Listar documentos con estado no vigente, recalculando su semáforo en tiempo real para asegurar exactitud.
// ------------------------------------------------------------
router.get('/cargas-pendientes', async (req, res) => {
  try {
    const estadoFiltro = (req.query.estado || '').trim().toLowerCase();
    const municipioFiltro = (req.query.municipio || '').trim();
    const encargadaFiltro = (req.query.encargada || '').trim();
    
    const sql = `
      SELECT e.id as expediente_id, e.guarderia_id, e.fecha_vigencia, e.estado, e.no_aplica,
             g.numero as guarderia_numero, g.nombre as guarderia_nombre, g.municipio, g.encargada,
             d.nombre as documento_nombre,
             (SELECT COUNT(*) FROM observaciones_expediente oe WHERE oe.expediente_id = e.id AND oe.resuelta = false) as obs_activas
      FROM expedientes e
      JOIN guarderias g ON g.id = e.guarderia_id AND g.activo = true
      JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true
    `;
    
    const { rows } = await pool.query(sql);
    
    // Procesamiento y filtrado en memoria para garantizar consistencia con las reglas de negocio del semáforo
    let resultados = rows.map(r => {
      const tieneObs = parseInt(r.obs_activas, 10) > 0;
      const estadoReal = calcularEstadoSemaforo(
        { estado: r.estado, fecha_vigencia: r.fecha_vigencia, no_aplica: r.no_aplica },
        tieneObs,
        r.municipio,
        r.documento_nombre
      );
      return { ...r, estado: estadoReal };
    });

    resultados = resultados.filter(r => r.estado !== 'vigente');

    if (estadoFiltro) {
      resultados = resultados.filter(r => r.estado === estadoFiltro);
    }
    if (municipioFiltro) {
      resultados = resultados.filter(r => (r.municipio || '').toLowerCase() === municipioFiltro.toLowerCase());
    }
    if (encargadaFiltro) {
      const eLow = encargadaFiltro.toLowerCase();
      resultados = resultados.filter(r => (r.encargada || '').toLowerCase().includes(eLow));
    }

    // Criterio de ordenamiento: Vencidos seguidos de Por Vencer
    resultados.sort((a, b) => {
      const prioridades = { 'vencido': 1, 'por vencer': 2 };
      const pA = prioridades[a.estado] || 99;
      const pB = prioridades[b.estado] || 99;
      if (pA !== pB) return pA - pB;
      
      const fA = a.fecha_vigencia ? new Date(a.fecha_vigencia).getTime() : 9999999999999;
      const fB = b.fecha_vigencia ? new Date(b.fecha_vigencia).getTime() : 9999999999999;
      if (fA !== fB) return fA - fB;
      
      return (a.guarderia_numero || '').localeCompare(b.guarderia_numero || '');
    });

    res.json(resultados);
  } catch(e) {
    console.error('[Cargas Pendientes] Error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// RUTA     : POST /api/import-export/importar-directorio
// PROPÓSITO: Actualizar masivamente las encargadas y correos de aviso de las guarderías vía Excel.
// ------------------------------------------------------------
router.post('/importar-directorio', usuarioActivo, upload.single('archivo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ ok: false, error: 'No se subió ningún archivo' });

  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.readFile(req.file.path);
    const worksheet = workbook.getWorksheet(1);
    if (!worksheet) throw new Error('No se encontró la primera hoja del Excel');

    let actualizados = 0;
    let errores = [];

    // Empezamos desde la fila 2 para saltar encabezados
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const clave = getCellValueAsString(row.getCell(1)).trim(); // Columna A: Clave (U-XXXX)
      const encargada = getCellValueAsString(row.getCell(2)).trim(); // Columna B: Encargada
      const correos = getCellValueAsString(row.getCell(3)).trim(); // Columna C: Correos

      if (!clave) continue;

      // Actualización en la base de datos
      const result = await pool.query(
        'UPDATE guarderias SET encargada = $1, correos_aviso = $2 WHERE numero = $3 AND activo = true RETURNING id',
        [encargada, correos, clave]
      );

      if (result.rowCount > 0) {
        actualizados++;
      } else {
        errores.push(`Fila ${i}: No se encontró la guardería con clave ${clave}`);
      }
    }

    // Limpieza de archivo temporal
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

    res.json({ ok: true, actualizados, errores });

  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    console.error('[Import] Error al importar directorio:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
});

module.exports = router;

