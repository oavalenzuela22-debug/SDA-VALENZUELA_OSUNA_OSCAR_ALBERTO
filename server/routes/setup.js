// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/setup.js
// MÓDULO    : Configuración y Migraciones (Rutas API)
// PROPÓSITO : Endpoints protegidos para la inicialización del sistema y mantenimiento de la base de datos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { runSeed } = require('../db/seedLogic');

const router = express.Router();

// ------------------------------------------------------------
// FUNCIÓN  : POST /migrate-cvmsg-enero
// PROPÓSITO: Ejecutar la migración específica para la incorporación de variantes "Testado" y "No testado" del documento CVMSG de enero 2022.
// ------------------------------------------------------------
router.post('/migrate-cvmsg-enero', async (req, res) => {
  const key = req.query.key || (req.body && req.body.key);
  const secret = process.env.SETUP_SECRET;
  if (!secret || key !== secret) {
    return res.status(403).json({ ok: false, error: 'Clave inválida o no configurada' });
  }
  try {
    // Verificación de existencia previa de la migración para evitar duplicidad
    const { rows: exist } = await pool.query(
      `SELECT id FROM documentos_catalogo WHERE nombre = $1`,
      ['CVMSG IMSS (Portal IMSS enero 2022) No testado']
    );
    if (exist[0]) return res.json({ ok: true, message: 'Migración ya aplicada.' });

    const { rows: secRows } = await pool.query(`SELECT id FROM secciones WHERE nombre = $1`, ['Expediente vigente']);
    if (!secRows[0]) return res.status(500).json({ ok: false, error: 'Sección no encontrada' });
    const secId = secRows[0].id;

    // Inserción del nuevo tipo de documento "No testado"
    const { rows } = await pool.query(
      `INSERT INTO documentos_catalogo (seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden, activo)
       VALUES ($1, 'CVMSG IMSS (Portal IMSS enero 2022) No testado', false, false, false, false, 'anual', true, 27, true) RETURNING id`,
      [secId]
    );
    const newId = rows[0].id;

    // Inicialización de expedientes vinculados para guarderías activas
    const { rows: guarderias } = await pool.query(`SELECT id FROM guarderias WHERE activo = true`);
    for (const g of guarderias) {
      await pool.query(`INSERT INTO expedientes (guarderia_id, documento_id, estado) VALUES ($1, $2, 'vencido') ON CONFLICT DO NOTHING`, [g.id, newId]);
    }

    // Normalización de la nomenclatura para documentos antiguos hacia la variante "Testado"
    const nombresAntiguos = ['CVMSG IMSS (Portal IMSS enero 2022)', 'CVMSG IMSS (Portal IMSS enero 2022) [TESTADO]'];
    for (const nom of nombresAntiguos) {
      const { rows: old } = await pool.query(`SELECT id FROM documentos_catalogo WHERE nombre = $1`, [nom]);
      if (old[0]) {
        await pool.query(`UPDATE documentos_catalogo SET nombre = $1 WHERE id = $2`, ['CVMSG IMSS (Portal IMSS enero 2022) Testado', old[0].id]);
        break;
      }
    }
    res.json({ ok: true, message: 'Migración aplicada. Documentos Testado y No testado configurados.' });
  } catch (err) {
    console.error('[Setup] Error en migrate-cvmsg-enero:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /seed
// PROPÓSITO: Ejecutar la carga completa de datos iniciales y configuración por defecto del sistema (protegido por clave).
// ------------------------------------------------------------
router.get('/seed', async (req, res) => {
  const key = req.query.key;
  const secret = process.env.SETUP_SECRET;
  if (!secret || key !== secret) {
    return res.status(403).json({ ok: false, error: 'Clave inválida o no configurada' });
  }
  try {
    const result = await runSeed(pool, true);
    res.json({ ok: true, message: 'Seed ejecutado correctamente.', ...result });
  } catch (err) {
    console.error('[Setup] Error en seed:', err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;

