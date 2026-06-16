// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/logs.js
// MÓDULO    : Bitácora del Sistema (Rutas API)
// PROPÓSITO : Endpoints para consultar y gestionar los registros de actividad (logs).
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, adminOnly } = require('../middlewares/auth');

const { logSistema } = require('../utils/logger');

const router = express.Router();

// Todas las rutas de logs requieren autenticación y nivel de Programador/Admin
router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado de logs con filtros opcionales.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  // Solo los roles de programación pueden ver la bitácora completa
  const rolesLog = ['Programador', 'Programadora'];
  if (!rolesLog.includes((req.user.rol || '').trim())) {
    return res.status(403).json({ error: 'No tiene permisos para ver la bitácora del sistema.' });
  }

  const { nivel, modulo, desde, hasta, limite = 100 } = req.query;
  try {
    let sql = `
      SELECT l.*, u.nombre as usuario_nombre, u.rol as usuario_rol
      FROM logs_sistema l
      LEFT JOIN usuarios u ON u.id = l.usuario_id
      WHERE 1=1
    `;
    const params = [];

    if (nivel) {
      params.push(nivel);
      sql += ` AND l.nivel = $${params.length}`;
    }
    if (modulo) {
      params.push(modulo);
      sql += ` AND l.modulo = $${params.length}`;
    }
    if (desde) {
      params.push(desde);
      sql += ` AND l.timestamp >= $${params.length}`;
    }
    if (hasta) {
      params.push(hasta);
      sql += ` AND l.timestamp <= $${params.length}`;
    }

    sql += ` ORDER BY l.timestamp DESC LIMIT $${params.length + 1}`;
    params.push(parseInt(limite, 10));

    const { rows } = await pool.query(sql, params);
    res.json(rows);
  } catch (e) {
    console.error('[Logs] Error:', e.message);
    res.status(500).json({ error: 'Error al obtener la bitácora' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /limpiar
// PROPÓSITO: Eliminar logs antiguos (más de 90 días por defecto).
// ------------------------------------------------------------
router.delete('/limpiar', adminOnly, async (req, res) => {
  try {
    const { rowCount } = await pool.query(`DELETE FROM logs_sistema`);
    // Registrar el hecho de que la bitácora fue limpiada (esto quedará como el registro 1 de la nueva bitácora)
    await logSistema('CRÍTICO', 'SISTEMA', 'Limpieza TOTAL de la Bitácora del Programador', { registros_eliminados: rowCount }, req.user.id, 'SUCCESS');
    res.json({ ok: true, eliminados: rowCount });
  } catch (e) {
    console.error('[Logs] Error al limpiar:', e.message);
    res.status(500).json({ error: e.message });
  }
});



module.exports = router;
