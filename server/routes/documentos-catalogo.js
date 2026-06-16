// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/documentos-catalogo.js
// MÓDULO    : Catálogo de Documentación (Rutas API)
// PROPÓSITO : Gestión de tipos de documentos, periodicidad y requisitos normativos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado de documentos activos del catálogo, con opción de filtrar por sección.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const seccionId = req.query.seccion_id;
    let sql = `SELECT d.id, d.seccion_id, s.nombre as seccion_nombre, d.nombre, d.requiere_vigencia, d.requiere_oficio, d.requiere_firma, d.requiere_sello, d.periodicidad, d.obligatorio, d.orden, d.activo FROM documentos_catalogo d JOIN secciones s ON s.id = d.seccion_id WHERE d.activo = true`;
    const params = [];
    if (seccionId) {
      sql += ' AND d.seccion_id = $1';
      params.push(seccionId);
    }
    sql += ' ORDER BY s.orden, d.orden, d.id';
    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[DocsCatalogo] GET /:', e.message);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /todas
// PROPÓSITO: Recuperar la totalidad de documentos registrados en el catálogo, incluyendo aquellos marcados como inactivos.
// ------------------------------------------------------------
router.get('/todas', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT d.id, d.seccion_id, s.nombre as seccion_nombre, d.nombre, d.requiere_vigencia, d.requiere_oficio, d.requiere_firma, d.requiere_sello, d.periodicidad, d.obligatorio, d.orden, d.activo FROM documentos_catalogo d JOIN secciones s ON s.id = d.seccion_id ORDER BY s.orden, d.orden, d.id`);
    res.json(rows);
  } catch (e) {
    console.error('[DocsCatalogo] GET /todas:', e.message);
    res.status(500).json({ error: 'Error al obtener documentos' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /
// PROPÓSITO: Registrar un nuevo tipo de documento en el catálogo e inicializar sus expedientes correspondientes para todas las guarderías activas.
// ------------------------------------------------------------
router.post('/', usuarioActivo, async (req, res) => {
  const { seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden } = req.body || {};
  if (!seccion_id || !nombre || nombre.trim().length < 2) return res.status(400).json({ error: 'Sección y nombre requeridos' });
  try {
    const { rows: maxRow } = await pool.query(`SELECT COALESCE(MAX(orden),0) as m FROM documentos_catalogo WHERE seccion_id = $1`, [seccion_id]);
    const maxOrden = parseInt(maxRow[0].m, 10);
    const newOrden = orden != null ? orden : maxOrden + 1;

    const { rows } = await pool.query(
      `INSERT INTO documentos_catalogo (seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden, activo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id`,
      [seccion_id, nombre.trim(), !!requiere_vigencia, !!requiere_oficio, !!requiere_firma, !!requiere_sello, periodicidad || 'anual', !!obligatorio, newOrden]
    );
    const newId = rows[0].id;

    // Sincronización masiva. Se crean los expedientes para cada guardería activa bajo este nuevo tipo de documento.
    const { rows: guarderiaIds } = await pool.query(`SELECT id FROM guarderias WHERE activo = true`);
    for (const g of guarderiaIds) {
      await pool.query(`INSERT INTO expedientes (guarderia_id, documento_id, estado) VALUES ($1, $2, 'vencido') ON CONFLICT DO NOTHING`, [g.id, newId]);
    }
    res.status(201).json({ id: newId, nombre: nombre.trim() });
  } catch (e) {
    console.error('[DocsCatalogo] POST /:', e.message);
    res.status(500).json({ error: 'Error al crear documento' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar los parámetros normativos, de periodicidad o de visualización de un documento del catálogo.
// ------------------------------------------------------------
router.get('/:id', usuarioActivo, async (req, res) => {
  const { seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden, activo } = req.body || {};
  const id = req.params.id;
  try {
    const { rows: chk } = await pool.query('SELECT id FROM documentos_catalogo WHERE id = $1', [id]);
    if (!chk[0]) return res.status(404).json({ error: 'Documento no encontrado' });

    await pool.query(
      `UPDATE documentos_catalogo SET seccion_id = COALESCE($1, seccion_id), nombre = COALESCE($2, nombre), requiere_vigencia = COALESCE($3, requiere_vigencia), requiere_oficio = COALESCE($4, requiere_oficio), requiere_firma = COALESCE($5, requiere_firma), requiere_sello = COALESCE($6, requiere_sello), periodicidad = COALESCE($7, periodicidad), obligatorio = COALESCE($8, obligatorio), orden = COALESCE($9, orden), activo = COALESCE($10, activo) WHERE id = $11`,
      [seccion_id ?? null, nombre != null ? nombre.trim() : null, requiere_vigencia != null ? Boolean(requiere_vigencia) : null, requiere_oficio != null ? Boolean(requiere_oficio) : null, requiere_firma != null ? Boolean(requiere_firma) : null, requiere_sello != null ? Boolean(requiere_sello) : null, periodicidad || null, obligatorio != null ? Boolean(obligatorio) : null, orden ?? null, activo != null ? Boolean(activo) : null, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[DocsCatalogo] PUT /:id:', e.message);
    res.status(500).json({ error: 'Error al actualizar documento' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /:id
// PROPÓSITO: Eliminar de forma definitiva un tipo de documento del catálogo y depurar en cascada todos los expedientes e historiales relacionados.
// ------------------------------------------------------------
router.delete('/:id', usuarioActivo, async (req, res) => {
  const id = req.params.id;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Eliminación de dependencias. Se borran observaciones, historial de cambios y registro de alertas enviadas.
    await client.query(
      `DELETE FROM observaciones_expediente WHERE expediente_id IN (SELECT id FROM expedientes WHERE documento_id = $1)`,
      [id]
    );

    await client.query(
      `DELETE FROM historial WHERE expediente_id IN (SELECT id FROM expedientes WHERE documento_id = $1)`,
      [id]
    );

    await client.query(
      `DELETE FROM historial_alertas WHERE expediente_id IN (SELECT id FROM expedientes WHERE documento_id = $1)`,
      [id]
    );

    // Eliminación de los expedientes físicos vinculados al documento.
    await client.query('DELETE FROM expedientes WHERE documento_id = $1', [id]);

    // Eliminación del registro en el catálogo.
    const { rowCount } = await client.query('DELETE FROM documentos_catalogo WHERE id = $1', [id]);
    
    if (rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Documento no encontrado' });
    }

    await client.query('COMMIT');
    res.json({ ok: true, mensaje: 'Documento eliminado del catálogo y expedientes asociados' });
  } catch (e) {
    await client.query('ROLLBACK');
    console.error('[DocsCatalogo] DELETE /:id:', e.message);
    res.status(500).json({ error: 'Error al eliminar documento' });
  } finally {
    client.release();
  }
});

module.exports = router;

