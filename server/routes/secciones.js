// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/secciones.js
// MÓDULO    : Catálogo de Secciones (Rutas API)
// PROPÓSITO : Gestión de categorías principales para la organización y agrupación de documentos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');

const router = express.Router();
router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado de secciones activas, ordenadas según su prioridad establecida.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT id, nombre, orden, activo FROM secciones WHERE activo = true ORDER BY orden, id`);
    res.json(rows);
  } catch (e) {
    console.error('[Secciones] GET /:', e.message);
    res.status(500).json({ error: 'Error al obtener secciones' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /todas
// PROPÓSITO: Recuperar la totalidad de secciones registradas, incluyendo aquellas marcadas como inactivas.
// ------------------------------------------------------------
router.get('/todas', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre, orden, activo FROM secciones ORDER BY orden, id');
    res.json(rows);
  } catch (e) {
    console.error('[Secciones] GET /todas:', e.message);
    res.status(500).json({ error: 'Error al obtener secciones' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /
// PROPÓSITO: Registrar una nueva sección en el catálogo, asignando automáticamente un número de orden si no se especifica.
// ------------------------------------------------------------
router.post('/', usuarioActivo, async (req, res) => {
  const { nombre, orden } = req.body || {};
  if (!nombre || nombre.trim().length < 2) return res.status(400).json({ error: 'Nombre requerido (mín. 2 caracteres)' });
  try {
    const { rows: maxRow } = await pool.query('SELECT COALESCE(MAX(orden),0) as m FROM secciones');
    const maxOrden = parseInt(maxRow[0].m, 10);
    const newOrden = orden != null ? orden : maxOrden + 1;
    const { rows } = await pool.query(`INSERT INTO secciones (nombre, orden, activo) VALUES ($1, $2, true) RETURNING id`, [nombre.trim(), newOrden]);
    res.status(201).json({ id: rows[0].id, nombre: nombre.trim() });
  } catch (e) {
    console.error('[Secciones] POST /:', e.message);
    res.status(500).json({ error: 'Error al crear sección' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar el nombre, orden de visualización o estado de activación de una sección existente.
// ------------------------------------------------------------
router.put('/:id', usuarioActivo, async (req, res) => {
  const { nombre, orden, activo } = req.body || {};
  const id = req.params.id;
  try {
    const { rows: chk } = await pool.query('SELECT id FROM secciones WHERE id = $1', [id]);
    if (!chk[0]) return res.status(404).json({ error: 'Sección no encontrada' });

    await pool.query(
      `UPDATE secciones SET nombre = COALESCE($1, nombre), orden = COALESCE($2, orden), activo = COALESCE($3, activo) WHERE id = $4`,
      [nombre != null ? nombre.trim() : null, orden != null ? orden : null, activo != null ? Boolean(activo) : null, id]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('[Secciones] PUT /:id:', e.message);
    res.status(500).json({ error: 'Error al actualizar sección' });
  }
});

module.exports = router;

