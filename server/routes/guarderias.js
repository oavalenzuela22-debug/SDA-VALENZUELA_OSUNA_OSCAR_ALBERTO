// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/guarderias.js
// MÓDULO    : Gestión de Guarderías (Rutas API)
// PROPÓSITO : Endpoints para administrar centros de atención, encargadas y sincronización de expedientes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');
const { logSistema } = require('../utils/logger');


const router = express.Router();
router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /encargadas
// PROPÓSITO: Obtener una lista única y desglosada de las encargadas de centros activos.
// ------------------------------------------------------------
router.get('/encargadas', async (req, res) => {
  try {
    const { rows } = await pool.query(`SELECT DISTINCT encargada FROM guarderias WHERE activo = true AND encargada IS NOT NULL AND encargada != ''`);
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
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado de guarderías activas, con opción de incluir el resumen del estado del semáforo.
// PARÁMETROS (Query): q (Filtro), con_estados (Booleano para incluir conteo de expedientes).
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const q = req.query.q;
    const conEstados = req.query.con_estados === '1' || req.query.con_estados === 'true';
    let sql = `SELECT id, numero, nombre, municipio, direccion, telefono, director, encargada, correo, correos_aviso, activo FROM guarderias WHERE activo = true`;
    const params = [];
    if (q && q.trim()) {
      sql += ' AND (numero ILIKE $1 OR nombre ILIKE $1 OR municipio ILIKE $1)';
      params.push('%' + q.trim() + '%');
    }
    sql += ' ORDER BY numero, municipio';
    const { rows } = await pool.query(sql, params);
    if (!conEstados) return res.json(rows);

    const expSql = `SELECT e.guarderia_id, e.estado FROM expedientes e JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true`;
    const { rows: expedientes } = await pool.query(expSql);
    const porG = {};
    rows.forEach(g => { porG[g.id] = { ...g, vigente: 0, con_observaciones: 0, por_vencer: 0, vencido: 0 }; });
    expedientes.forEach(e => {
      const s = porG[e.guarderia_id];
      if (s) {
        const key = (e.estado || '').replace(/ /g, '_');
        if (s[key] !== undefined) s[key]++;
      }
    });
    res.json(Object.values(porG));
  } catch (e) {
    console.error('[Guarderías] GET /:', e.message);
    res.status(500).json({ error: 'Error al obtener guarderías' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /:id
// PROPÓSITO: Obtener la información detallada de una guardería específica mediante su identificador.
// ------------------------------------------------------------
router.get('/:id', async (req, res) => {
  try {
    const sql = `SELECT id, numero, nombre, municipio, direccion, telefono, director, encargada, correo, correos_aviso, activo FROM guarderias WHERE id = $1`;
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Guardería no encontrada' });
    res.json(rows[0]);
  } catch (e) {
    console.error('[Guarderías] GET /:id:', e.message);
    res.status(500).json({ error: 'Error al obtener guardería' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /
// PROPÓSITO: Registrar una nueva guardería e inicializar sus expedientes según el catálogo de documentos vigente.
// ------------------------------------------------------------
router.post('/', usuarioActivo, async (req, res) => {
  const { numero, nombre, municipio, direccion, telefono, director, encargada, correo, correos_aviso } = req.body || {};
  if (!numero || !nombre) return res.status(400).json({ error: 'Número y nombre requeridos' });
  try {
    const { rows } = await pool.query(
      `INSERT INTO guarderias (numero, nombre, municipio, direccion, telefono, director, encargada, correo, correos_aviso, activo) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true) RETURNING id`,
      [numero.trim(), nombre.trim(), (municipio||'').trim(), (direccion||'').trim(), (telefono||'').trim(), (director||'').trim(), (encargada||'').trim(), (correo||'').trim(), (correos_aviso||'').trim()]
    );
    const guarderiaId = rows[0].id;

    // Inicialización de los expedientes para cada documento activo del catálogo.
    const { rows: docs } = await pool.query(`SELECT id FROM documentos_catalogo WHERE activo = true`);
    for (const d of docs) {
      await pool.query(`INSERT INTO expedientes (guarderia_id, documento_id, estado) VALUES ($1, $2, 'vencido') ON CONFLICT DO NOTHING`, [guarderiaId, d.id]);
    }
    await logSistema('INFORMATIVO', 'DATA', 'Nueva guardería creada', { numero: numero.trim(), nombre: nombre.trim() }, req.user.id);
    res.status(201).json({ id: guarderiaId, numero: numero.trim(), nombre: nombre.trim() });

  } catch (e) {
    if (e.message && e.message.includes('unique')) {
      return res.status(400).json({ error: 'Ya existe una guardería con ese número' });
    }
    console.error('[Guarderías] POST /:', e.message);
    res.status(500).json({ error: 'Error al crear guardería' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar la información técnica y administrativa de una guardería existente.
// ------------------------------------------------------------
router.put('/:id', usuarioActivo, async (req, res) => {
  const { numero, nombre, municipio, direccion, telefono, director, encargada, correo, correos_aviso, activo } = req.body || {};
  const id = req.params.id;
  try {
    const { rows: chk } = await pool.query('SELECT id, numero, nombre, municipio, encargada, activo FROM guarderias WHERE id = $1', [id]);
    if (!chk[0]) return res.status(404).json({ error: 'Guardería no encontrada' });

    await pool.query(
      `UPDATE guarderias SET
        numero = COALESCE($1, numero), nombre = COALESCE($2, nombre), municipio = COALESCE($3, municipio),
        direccion = COALESCE($4, direccion), telefono = COALESCE($5, telefono), director = COALESCE($6, director),
        encargada = COALESCE($7, encargada), correo = COALESCE($8, correo), correos_aviso = COALESCE($9, correos_aviso),
        activo = COALESCE($10, activo)
      WHERE id = $11`,
      [
        numero != null ? numero.trim() : null,
        nombre != null ? nombre.trim() : null,
        municipio != null ? municipio.trim() : null,
        direccion != null ? direccion.trim() : null,
        telefono != null ? telefono.trim() : null,
        director != null ? director.trim() : null,
        encargada != null ? encargada.trim() : null,
        correo != null ? correo.trim() : null,
        correos_aviso != null ? correos_aviso.trim() : null,
        activo != null ? Boolean(activo) : null,
        id
      ]
    );

    // Registro de auditoría para cambios en datos maestros
    const cambios = {};
    const old = chk[0];
    const fields = { numero, nombre, municipio, encargada, activo };
    for (const [key, val] of Object.entries(fields)) {
      if (val !== undefined && old[key] !== val) {
        cambios[key] = { antes: old[key], después: val };
      }
    }
    if (Object.keys(cambios).length > 0) {
      await logSistema('ADVERTENCIA', 'DATA', 'Modificación de guardería', { id, cambios }, req.user.id);
    }

    res.json({ ok: true });

  } catch (e) {
    console.error('[Guarderías] PUT /:id:', e.message);
    res.status(500).json({ error: 'Error al actualizar guardería' });
  }
});

module.exports = router;

