// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/extintores.js
// MÓDULO    : Gestión de Extintores (Rutas API)
// PROPÓSITO : Control de inventario, vigencias y mantenimiento de extintores por guardería.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const ExcelJS = require('exceljs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo, adminOnly } = require('../middlewares/auth');

const router = express.Router();

// Configuración del middleware de carga de archivos (Multer)
const upload = multer({
  dest: path.join(__dirname, '..', 'tmp'),
  limits: {
    fileSize: 10 * 1024 * 1024 // Límite máximo de 10 MB
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

// ------------------------------------------------------------
// FUNCIÓN  : logAccion
// PROPÓSITO: Registrar eventos de modificación en el historial de auditoría del sistema de extintores.
// PARÁMETROS:
//   - usuario_id (Integer): Identificador del usuario que ejecuta la acción.
//   - entidad_id (Integer): Identificador único del extintor.
//   - clave (String): Número identificador de la guardería.
//   - accion (String): Tipo de operación realizada (CREAR, EDITAR, BAJA, etc).
//   - antes (Object): Estado del registro previo a la modificación.
//   - despues (Object): Estado final del registro tras la operación.
// ------------------------------------------------------------
async function logAccion(usuario_id, entidad_id, clave, accion, antes, despues) {
  try {
    await pool.query(
      `INSERT INTO historial (usuario_id, entidad, entidad_id, guarderia_clave, campo_modificado, valor_anterior, valor_nuevo)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [usuario_id, 'extintor', entidad_id, clave, accion, JSON.stringify(antes), JSON.stringify(despues)]
    );
  } catch (e) {
    console.error('[Extintores] Error en logAccion:', e.message);
  }
}

// ------------------------------------------------------------
// FUNCIÓN  : getCellValue
// PROPÓSITO: Normalizar y extraer el contenido textual de una celda de ExcelJS, manejando objetos y fórmulas.
// ------------------------------------------------------------
function getCellValue(cell) {
  if (!cell) return '';
  const val = cell.value;
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') {
    if (val.result !== undefined) return String(val.result).trim();
    if (val.text !== undefined) return String(val.text).trim();
    if (val.richText !== undefined) return val.richText.map(t => t.text).join('').trim();
  }
  return String(val).trim();
}

// ------------------------------------------------------------
// FUNCIÓN  : parseExcelDate
// PROPÓSITO: Interpretar y convertir diversos formatos de fecha provenientes de archivos Excel a objetos Date válidos.
// ------------------------------------------------------------
function parseExcelDate(val) {
  if (!val) return null;
  
  let date;
  if (val instanceof Date) {
    date = val;
  } else if (typeof val === 'object' && val.result instanceof Date) {
    date = val.result;
  }

  if (date instanceof Date && !isNaN(date.getTime())) {
    // Se extraen componentes UTC para evitar desfases por zona horaria del servidor.
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const sVal = String(val).trim().toUpperCase();
  if (!sVal || sVal === 'N/A' || sVal === 'NA') return null;

  // Validación de formato dd/mm/aaaa o dd-mm-aaaa
  const m = sVal.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let d = m[1].padStart(2, '0'), mm = m[2].padStart(2, '0'), y = m[3];
    if (y.length === 2) y = '20' + y;
    return `${y}-${mm}-${d}`;
  }

  const dObj = new Date(sVal);
  if (!isNaN(dObj.getTime())) {
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const d = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return null;
}

router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /exportar
// PROPÓSITO: Generar y descargar un reporte en formato Excel con el inventario de extintores vigente.
// ------------------------------------------------------------
router.get('/exportar', async (req, res) => {
  try {
    const { encargada } = req.query;
    let sql = `
      SELECT e.*, g.nombre as guarderia_nombre, g.municipio 
      FROM extintores e
      JOIN (
        SELECT DISTINCT ON (numero) numero, nombre, municipio, encargada 
        FROM guarderias 
        WHERE activo = TRUE 
        ORDER BY numero, id DESC
      ) g ON e.guarderia_clave = g.numero
      WHERE e.activo = TRUE 
    `;
    const params = [];
    if (encargada) {
      sql += ` AND (g.encargada = $1 OR g.encargada ILIKE '%' || $1 || '%')`;
      params.push(encargada);
    }
    sql += ` ORDER BY e.guarderia_clave, e.numero_extintor`;

    const { rows } = await pool.query(sql, params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Registro de Extintores');
    
    // Definición de estructura de columnas para el reporte
    worksheet.columns = [
      { header: 'CLAVE', key: 'clave', width: 12 },
      { header: 'MUNICIPIO', key: 'municipio', width: 18 },
      { header: 'NOMBRE DE LA GUARDERÍA', key: 'nombre', width: 45 },
      { header: 'EXTINTORES | MODELOS', key: 'modelo', width: 25 },
      { header: 'CAPACIDAD', key: 'capacidad', width: 15 },
      { header: 'UNIDAD (KG/LB/LTS)', key: 'unidad', width: 20 },
      { header: 'CANTIDAD', key: 'cantidad', width: 10 },
      { header: 'MANTENIMIENTO', key: 'mantenimiento', width: 18 },
      { header: 'FECHA VENCIMIENTO', key: 'vencimiento', width: 18 }
    ];

    // Aplicación de estilos de encabezado
    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF004A23' } };
    headerRow.alignment = { horizontal: 'center', vertical: 'middle' };

    rows.forEach(r => {
      worksheet.addRow({
        clave: r.guarderia_clave,
        municipio: r.municipio,
        nombre: r.guarderia_nombre,
        modelo: r.modelo,
        capacidad: r.capacidad,
        unidad: r.unidad,
        cantidad: r.cantidad,
        mantenimiento: r.ultimo_mantenimiento ? r.ultimo_mantenimiento.toISOString().slice(0,10) : '',
        vencimiento: r.fecha_vencimiento ? r.fecha_vencimiento.toISOString().slice(0,10) : ''
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Registro_Extintores_SDA.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /importar
// PROPÓSITO: Realizar la carga masiva de extintores mediante archivo Excel, desactivando los registros previos de las guarderías afectadas.
// ------------------------------------------------------------
router.post('/importar', usuarioActivo, (req, res, next) => {
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
  const client = await pool.connect();

  try {
    await workbook.xlsx.readFile(filePath);
    const worksheet = workbook.getWorksheet(1);
    const rows = [];
    worksheet.eachRow((row, rowNumber) => { if (rowNumber > 1) rows.push(row); });

    await client.query('BEGIN');
    
    // Identificación de guarderías incluidas en el archivo para su depuración previa
    const clavesEnArchivo = new Set();
    rows.forEach(row => {
      const c = getCellValue(row.getCell(1));
      if (c && c !== 'TOTAL DE EXTINTORES' && c !== 'CLAVE' && !c.includes('TOTAL')) {
        clavesEnArchivo.add(c);
      }
    });

    if (clavesEnArchivo.size > 0) {
      await client.query(`
        UPDATE extintores SET activo = FALSE, motivo_baja = 'Reemplazo por carga masiva Excel', fecha_baja = NOW()
        WHERE guarderia_clave = ANY($1) AND activo = TRUE
      `, [[...clavesEnArchivo]]);
    }

    let insertados = 0;
    for (const row of rows) {
      const clave = getCellValue(row.getCell(1));
      const modelo = getCellValue(row.getCell(4));
      
      // Omisión de filas sin información válida de extintores.
      if (!clave || !modelo || clave === 'TOTAL DE EXTINTORES' || clave === 'CLAVE' || clave.includes('TOTAL')) continue;

      const capacidad = parseFloat(getCellValue(row.getCell(5))) || 0;
      const unidad = getCellValue(row.getCell(6));
      const cantidad = parseInt(getCellValue(row.getCell(7)), 10) || 1;
      
      const fMant = parseExcelDate(row.getCell(8).value);
      const fVenc = parseExcelDate(row.getCell(9).value);

      const { rows: gExist } = await client.query('SELECT id FROM guarderias WHERE numero = $1 LIMIT 1', [clave]);
      if (gExist.length === 0) continue;

      const { rows: maxR } = await client.query('SELECT MAX(numero_extintor) as maximo FROM extintores WHERE guarderia_clave = $1', [clave]);
      const nro = (maxR[0].maximo || 0) + 1;

      await client.query(`
        INSERT INTO extintores (guarderia_clave, numero_extintor, modelo, capacidad, unidad, cantidad, ultimo_mantenimiento, fecha_vencimiento)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [clave, nro, modelo, capacidad, unidad, cantidad, fMant, fVenc]);
      
      insertados++;
    }

    await client.query('COMMIT');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.json({ ok: true, guarderias_afectadas: clavesEnArchivo.size, extintores_importados: insertados });

  } catch (e) {
    if (client) await client.query('ROLLBACK');
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('[Extintores Import] Error:', e.message);
    res.status(500).json({ error: `Error en la carga: ${e.message}` });
  } finally {
    if (client) client.release();
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado completo de extintores, calculando dinámicamente el estado de vigencia y días restantes.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const isAdmin = ['Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías'].includes(req.user.rol);
    const incluirBajas = req.query.incluir_bajas === 'true';
    
    let sql = `
      SELECT e.*, g.nombre as guarderia_nombre, g.municipio 
      FROM extintores e
      JOIN (
        SELECT DISTINCT ON (numero) numero, nombre, municipio 
        FROM guarderias 
        WHERE activo = TRUE 
        ORDER BY numero, id DESC
      ) g ON e.guarderia_clave = g.numero
      WHERE 1=1
    `;
    const params = [];
    if (!isAdmin) {
      sql += ` AND e.guarderia_clave = $${params.length + 1}`;
      params.push(req.user.usuario);
    }
    if (!incluirBajas) sql += ` AND e.activo = TRUE`;
    sql += ` ORDER BY e.guarderia_clave, e.numero_extintor`;

    const { rows } = await pool.query(sql, params);
    const now = new Date();
    const result = rows.map(r => {
      let diasRestantes = null;
      let estado = 'VIGENTE';
      if (r.fecha_vencimiento) {
        const vence = new Date(r.fecha_vencimiento);
        const diff = vence.getTime() - now.getTime();
        diasRestantes = Math.ceil(diff / (1000 * 60 * 60 * 24));
        
        if (diasRestantes < 0) estado = 'VENCIDO';
        else if (diasRestantes <= 45) estado = 'POR_VENCER';
        else estado = 'VIGENTE';
      } else {
        estado = 'VIGENTE';
      }
      
      return { ...r, dias_restantes: diasRestantes, estado };
    });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener extintores' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /encargadas
// PROPÓSITO: Obtener el catálogo único de personas encargadas asociadas a guarderías con extintores activos.
// ------------------------------------------------------------
router.get('/encargadas', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT DISTINCT g.encargada FROM guarderias g
      JOIN extintores e ON e.guarderia_clave = g.numero
      WHERE g.activo = true AND e.activo = true AND g.encargada IS NOT NULL AND g.encargada != ''
    `);
    const nombres = new Set();
    rows.forEach(r => {
      r.encargada.split(',').forEach(n => {
        const cleaned = n.trim();
        if (cleaned) nombres.add(cleaned);
      });
    });
    res.json([...nombres].sort());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /resumen-dashboard
// PROPÓSITO: Generar métricas estadísticas sobre el estado de vigencia de los extintores para su visualización en el panel principal.
// ------------------------------------------------------------
router.get('/resumen-dashboard', async (req, res) => {
  try {
    const isAdmin = ['Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías'].includes(req.user.rol);
    let sql = 'SELECT fecha_vencimiento FROM extintores WHERE activo = TRUE';
    const params = [];
    if (!isAdmin) {
      sql += ' AND guarderia_clave = $1';
      params.push(req.user.usuario);
    }
    const { rows } = await pool.query(sql, params);
    const resumen = { vencidos: 0, por_vencer: 0, vigentes: 0 };
    const now = new Date();
    now.setHours(0,0,0,0);

    rows.forEach(r => {
      if (!r.fecha_vencimiento) {
        resumen.vigentes++;
      } else {
        const vence = new Date(r.fecha_vencimiento);
        vence.setHours(0,0,0,0);
        const diff = vence.getTime() - now.getTime();
        const dias = Math.floor(diff / (1000 * 60 * 60 * 24));
        if (dias < 0) resumen.vencidos++;
        else if (dias <= 45) resumen.por_vencer++;
        else resumen.vigentes++;
      }
    });
    res.json(resumen);
  } catch (e) {
    res.status(500).json({ error: 'Error al obtener resumen' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /:clave
// PROPÓSITO: Recuperar los extintores vinculados a una guardería específica identificada por su clave.
// ------------------------------------------------------------
router.get('/:clave', async (req, res) => {
  const { clave } = req.params;
  const isAdmin = ['Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías'].includes(req.user.rol);
  if (!isAdmin && req.user.usuario !== clave) return res.status(403).json({ error: 'No autorizado' });
  try {
    const incluirBajas = req.query.incluir_bajas === 'true';
    let sql = 'SELECT * FROM extintores WHERE guarderia_clave = $1';
    if (!incluirBajas) sql += ' AND activo = TRUE';
    sql += ' ORDER BY numero_extintor';
    const { rows } = await pool.query(sql, [clave]);
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'Error' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /:clave
// PROPÓSITO: Registrar un nuevo extintor en el inventario de una guardería específica.
// ------------------------------------------------------------
router.post('/:clave', usuarioActivo, async (req, res) => {
  const { clave } = req.params;
  const b = req.body;
  try {
    const { rows: maxRows } = await pool.query('SELECT MAX(numero_extintor) as maximo FROM extintores WHERE guarderia_clave = $1',[clave]);
    const siguiente = (maxRows[0].maximo || 0) + 1;
    const sql = `INSERT INTO extintores (guarderia_clave, numero_extintor, modelo, capacidad, unidad, cantidad, ultimo_mantenimiento, fecha_vencimiento, observaciones) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`;
    const values = [clave, siguiente, b.modelo, b.capacidad, b.unidad, b.cantidad || 1, b.ultimo_mantenimiento || null, b.fecha_vencimiento || null, b.observaciones || ''];
    const { rows } = await pool.query(sql, values);
    const nuevo = rows[0];
    await logAccion(req.user.id, nuevo.id, clave, 'CREAR', null, nuevo);
    res.status(201).json(nuevo);
  } catch (e) {
    res.status(500).json({ error: 'Error al crear' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar integralmente la información de un extintor existente.
// ------------------------------------------------------------
router.put('/:id', usuarioActivo, async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  try {
    const { rows: oldRows } = await pool.query('SELECT * FROM extintores WHERE id = $1', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'No encontrado' });
    const antes = oldRows[0];
    const sql = `UPDATE extintores SET modelo = $1, capacidad = $2, unidad = $3, cantidad = $4, ultimo_mantenimiento = $5, fecha_vencimiento = $6, observaciones = $7, updated_at = NOW() WHERE id = $8 RETURNING *`;
    const { rows } = await pool.query(sql, [b.modelo !== undefined ? b.modelo : antes.modelo, b.capacidad !== undefined ? b.capacidad : antes.capacidad, b.unidad !== undefined ? b.unidad : antes.unidad, b.cantidad !== undefined ? b.cantidad : antes.cantidad, b.ultimo_mantenimiento !== undefined ? b.ultimo_mantenimiento : antes.ultimo_mantenimiento, b.fecha_vencimiento !== undefined ? b.fecha_vencimiento : antes.fecha_vencimiento, b.observaciones !== undefined ? b.observaciones : antes.observaciones, id]);
    const despues = rows[0];
    await logAccion(req.user.id, id, antes.guarderia_clave, 'EDITAR', antes, despues);
    res.json(despues);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ------------------------------------------------------------
// FUNCIÓN  : PATCH /:id/mantenimiento
// PROPÓSITO: Actualizar específicamente las fechas de mantenimiento y vencimiento de un equipo.
// ------------------------------------------------------------
router.patch('/:id/mantenimiento', usuarioActivo, async (req, res) => {
  const { id } = req.params;
  const b = req.body;
  try {
    const { rows: oldRows } = await pool.query('SELECT * FROM extintores WHERE id = $1', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'No encontrado' });
    const antes = oldRows[0];
    const sql = `UPDATE extintores SET ultimo_mantenimiento = $1, fecha_vencimiento = $2, observaciones = $3, updated_at = NOW() WHERE id = $4 RETURNING *`;
    const { rows } = await pool.query(sql, [b.ultimo_mantenimiento, b.fecha_vencimiento, b.observaciones, id]);
    const despues = rows[0];
    await logAccion(req.user.id, id, antes.guarderia_clave, 'MANTENIMIENTO', antes, despues);
    res.json(despues);
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /:id
// PROPÓSITO: Registrar la baja lógica de un extintor del inventario activo, especificando el motivo del retiro.
// ------------------------------------------------------------
router.delete('/:id', usuarioActivo, async (req, res) => {
  const { id } = req.params;
  const { motivo_baja } = req.body;
  try {
    const { rows: oldRows } = await pool.query('SELECT * FROM extintores WHERE id = $1', [id]);
    if (!oldRows.length) return res.status(404).json({ error: 'No encontrado' });
    const antes = oldRows[0];
    await pool.query('UPDATE extintores SET activo = FALSE, motivo_baja = $1, fecha_baja = NOW() WHERE id = $2', [motivo_baja, id]);
    await logAccion(req.user.id, id, antes.guarderia_clave, 'BAJA', antes, { activo: false });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /:id/permanente
// PROPÓSITO: Ejecutar la eliminación física y definitiva de un registro de extintor de la base de datos (Restringido a Programadores).
// ------------------------------------------------------------
router.delete('/:id/permanente', adminOnly, async (req, res) => {
  const rolesTop = ['Programador', 'Programadora'];
  if (!rolesTop.includes(req.user.rol)) return res.status(403).json({ error: 'No autorizado' });
  const { id } = req.params;
  try {
    const { rows: oldRows } = await pool.query('SELECT * FROM extintores WHERE id = $1', [id]);
    if (oldRows.length) await logAccion(req.user.id, id, oldRows[0].guarderia_clave, 'ELIMINAR_PERMANENTE', oldRows[0], null);
    await pool.query('DELETE FROM extintores WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: 'Error' }); }
});

module.exports = router;

