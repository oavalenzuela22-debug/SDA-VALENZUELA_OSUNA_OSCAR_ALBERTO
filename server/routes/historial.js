// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/historial.js
// MÓDULO    : Auditoría e Historial (Rutas API)
// PROPÓSITO : Consulta de eventos de modificación, trazabilidad de cambios y mantenimiento de registros históricos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');

const { logSistema } = require('../utils/logger');

const router = express.Router();
router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el registro histórico de cambios realizados en el sistema, permitiendo filtrar por expediente, guardería, usuario y orden cronológico.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { expediente_id, guarderia_id, usuario_id, limit, orden } = req.query;
    const lim = parseInt(limit, 10) || 1000;
    const params = [];
    let n = 1;
    let sql = `SELECT h.id, h.expediente_id, h.usuario_id, h.campo_modificado, h.valor_anterior, h.valor_nuevo, h.fecha, u.nombre as usuario_nombre, u.usuario as usuario_login, e.guarderia_id, g.numero as guarderia_numero, g.nombre as guarderia_nombre, d.nombre as documento_nombre FROM historial h LEFT JOIN usuarios u ON u.id = h.usuario_id LEFT JOIN expedientes e ON e.id = h.expediente_id LEFT JOIN guarderias g ON g.id = e.guarderia_id LEFT JOIN documentos_catalogo d ON d.id = e.documento_id WHERE 1=1`;

    if (expediente_id) {
      sql += ` AND h.expediente_id = $${n++}`;
      params.push(expediente_id);
    }
    if (guarderia_id) {
      sql += ` AND e.guarderia_id = $${n++}`;
      params.push(guarderia_id);
    }
    if (usuario_id) {
      sql += ` AND h.usuario_id = $${n++}`;
      params.push(usuario_id);
    }
    sql += orden === 'antiguo' ? ' ORDER BY h.fecha ASC' : ' ORDER BY h.fecha DESC';
    sql += ` LIMIT $${n++}`;
    params.push(lim);

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[Historial] GET /:', e.message);
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /
// PROPÓSITO: Depurar los registros del historial, permitiendo la eliminación selectiva por antigüedad o la eliminación total.
// ------------------------------------------------------------
router.delete('/', usuarioActivo, async (req, res) => {
  try {
    const n = req.query.dias ? Math.min(parseInt(req.query.dias, 10) || 0, 365) : 0;
    let result;
    const totalRegistros = await pool.query('SELECT COUNT(*) FROM historial');
    const conteoInicial = parseInt(totalRegistros.rows[0].count, 10);

    if (n > 0) {
      const sql = `DELETE FROM historial WHERE fecha < NOW() - INTERVAL '${n} days'`;
      result = await pool.query(sql);
      await logSistema('ADVERTENCIA', 'AUDITORÍA', 'Limpieza parcial de historial', { dias: n, eliminados: result.rowCount, previo: conteoInicial }, req.user.id, 'SUCCESS');
    } else {
      result = await pool.query('DELETE FROM historial');
      await logSistema('CRÍTICO', 'AUDITORÍA', 'Eliminación TOTAL del historial de cambios', { eliminados: result.rowCount, previo: conteoInicial }, req.user.id, 'SUCCESS');
    }
    res.json({ eliminados: result.rowCount || 0 });
  } catch (e) {
    await logSistema('CRÍTICO', 'AUDITORÍA', 'Error al intentar eliminar historial', { error: e.message }, req.user.id, 'FAILURE');
    console.error('[Historial] DELETE /:', e.message);
    res.status(500).json({ error: 'Error al eliminar historial' });
  }
});

module.exports = router;

