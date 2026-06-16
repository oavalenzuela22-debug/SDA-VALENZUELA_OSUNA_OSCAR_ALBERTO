// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/alertas.js
// MÓDULO    : Alertas y Diagnóstico (Rutas API)
// PROPÓSITO : Endpoints para gestión de alertas, diagnóstico de datos y envío de correos electrónicos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');
const { buildMensaje, ejecutarAlertas } = require('../cron/alertas');

const router = express.Router();
// ------------------------------------------------------------
// FUNCIÓN  : GET /ejecutar
// PROPÓSITO: Desencadenar la ejecución manual del proceso de alertas mediante validación de token secreto.
// ------------------------------------------------------------
router.get('/ejecutar', async (req, res) => {
  const token = req.headers['x-cron-token'] || req.query.token;
  if (token !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    res.json({ ok: true, mensaje: 'Alertas iniciadas' });
    await ejecutarAlertas();
  } catch (e) {
    console.error('[Cron Manual] Error:', e.message);
  }
});

router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /plantilla-correo
// PROPÓSITO: Generar una vista previa del contenido y estructura del correo de alerta con datos de ejemplo.
// ------------------------------------------------------------
router.get('/plantilla-correo', (req, res) => {
  const sample = [
    { guarderia_numero: 'U-1114', guarderia_nombre: 'GUARDERÍA INFANTIL CANACO CULIACÁN, A.C.', documento_nombre: 'Licencia de Uso de suelo', fecha_vigencia: '2025-04-15', estado: 'por vencer', url: (req.protocol + '://' + req.get('host') + '/#/guarderia/1') },
    { guarderia_numero: 'G-0001', guarderia_nombre: 'GUARDERIA ORDINARIA MAZATLAN', documento_nombre: 'Póliza seguro de responsabilidad civil', fecha_vigencia: '2025-04-20', estado: 'por vencer', url: (req.protocol + '://' + req.get('host') + '/#/guarderia/2') }
  ];
  const { asunto, cuerpo, cuerpoHtml } = buildMensaje({ nombre: 'Guardería de Prueba', numero: 'U-1114', encargada: 'Encargada Ejemplo' }, sample, {});
  res.json({ asunto, cuerpoTexto: cuerpo, cuerpoHtml });
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /enviar-ahora
// PROPÓSITO: Ejecutar de forma inmediata el motor de alertas o realizar una prueba de conectividad de correo.
// ------------------------------------------------------------
router.post('/enviar-ahora', usuarioActivo, async (req, res) => {
  const baseUrl = req.protocol + '://' + req.get('host');
  const { runAlertas, runPruebaCorreo } = require('../cron/alertas');
  try {
    const r = req.query.prueba === '1' ? await runPruebaCorreo(baseUrl) : await runAlertas(baseUrl);
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, enviados: r.enviados });
  } catch (e) {
    console.error('[Alertas] Error en enviar-ahora:', e);
    res.status(500).json({ error: 'Fallo en proceso de alertas: ' + e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /prueba-plantilla
// PROPÓSITO: Validar visualmente y mediante envío real una plantilla de correo personalizada.
// ------------------------------------------------------------
router.post('/prueba-plantilla', usuarioActivo, async (req, res) => {
  const { asunto, cuerpo, label } = req.body;
  if (!asunto || !cuerpo) return res.status(400).json({ error: 'Faltan campos' });
  const { runPruebaCorreo } = require('../cron/alertas');
  try {
    const r = await runPruebaCorreo('', { asunto, cuerpo, label });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, enviados: r.enviados });
  } catch (e) {
    console.error('[Alertas] Error en prueba-plantilla:', e);
    res.status(500).json({ error: 'Fallo al probar plantilla: ' + e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /actualizar-estados
// PROPÓSITO: Forzar la actualización masiva de los estados de vigencia en los expedientes.
// ------------------------------------------------------------
router.post('/actualizar-estados', usuarioActivo, async (req, res) => {
  try {
    const { actualizarEstados } = require('../cron/actualizarEstados');
    const n = await actualizarEstados();
    res.json({ ok: true, actualizados: n });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /diagnostico-datos
// PROPÓSITO: Realizar un análisis de integridad y volumetría de los datos almacenados en la base de datos.
// ------------------------------------------------------------
router.get('/diagnostico-datos', usuarioActivo, async (req, res) => {
  try {
    const counts = {};
    const tables = ['usuarios', 'guarderias', 'secciones', 'documentos_catalogo', 'expedientes'];
    for (const t of tables) {
      const { rows } = await pool.query(`SELECT COUNT(*) as n FROM ${t}`);
      counts[t] = rows[0].n;
    }
    
    // Conteo de expedientes agrupados por su estado actual
    const { rows: pend } = await pool.query(`SELECT estado, COUNT(*) as n FROM expedientes GROUP BY estado`);
    
    // Verificación de guarderías con configuración de notificación activa
    const { rows: guards } = await pool.query(`SELECT id, numero, correos_aviso, activo FROM guarderias WHERE correos_aviso IS NOT NULL AND correos_aviso != ''`);

    res.json({ 
      counts,
      estados_expedientes: pend,
      guarderias_con_correo: guards.length,
      detalle_guarderias: guards.map(g => ({ id: g.id, num: g.numero, mail: g.correos_aviso, activo: g.activo }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /diagnostico-smtp
// PROPÓSITO: Verificar la existencia de credenciales configuradas para el servicio de correo SMTP.
// ------------------------------------------------------------
router.get('/diagnostico-smtp', usuarioActivo, async (req, res) => {
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return res.json({ ok: false, error: 'Faltan credenciales de Gmail en el servidor' });
  }
  return res.json({ ok: true, mensaje: 'Credenciales de Gmail SMTP detectadas correctamente' });
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /historial
// PROPÓSITO: Recuperar el registro histórico detallado de las alertas enviadas recientemente.
// ------------------------------------------------------------
router.get('/historial', usuarioActivo, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT ha.*, g.numero as guarderia_numero, g.nombre as guarderia_nombre, d.nombre as documento_nombre
      FROM historial_alertas ha
      LEFT JOIN expedientes e ON e.id = ha.expediente_id
      LEFT JOIN guarderias g ON g.id = e.guarderia_id
      LEFT JOIN documentos_catalogo d ON d.id = e.documento_id
      ORDER BY ha.fecha_envio DESC
      LIMIT 200
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /enviar-manual/:guarderiaId
// PROPÓSITO: Ejecutar el envío forzado de alertas para una guardería específica ignorando restricciones de frecuencia.
// ------------------------------------------------------------
router.post('/enviar-manual/:guarderiaId', usuarioActivo, async (req, res) => {
  const gId = parseInt(req.params.guarderiaId, 10);
  const baseUrl = req.protocol + '://' + req.get('host');
  const { runAlertas } = require('../cron/alertas');
  try {
    const r = await runAlertas(baseUrl, { forzarPrueba: true, guarderiaIds: [gId], comoCron: true });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, enviados: r.enviados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /enviar-masivo
// PROPÓSITO: Ejecutar el envío de alertas para un conjunto seleccionado de guarderías.
// ------------------------------------------------------------
router.post('/enviar-masivo', usuarioActivo, async (req, res) => {
  const { ids } = req.body;
  if (!ids || !Array.isArray(ids)) return res.status(400).json({ error: 'Falta lista de IDs' });
  const baseUrl = req.protocol + '://' + req.get('host');
  const { runAlertas } = require('../cron/alertas');
  try {
    const r = await runAlertas(baseUrl, { forzarPrueba: true, guarderiaIds: ids, comoCron: true });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, enviados: r.enviados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /extintores/enviar-masivo
// PROPÓSITO: Envío manual forzado de alertas de extintores del día de hoy a todas las guarderías.
// ------------------------------------------------------------
router.post('/extintores/enviar-masivo', usuarioActivo, async (req, res) => {
  const { runAlertasExtintores } = require('../cron/alertas');
  try {
    const r = await runAlertasExtintores({ forzarPrueba: true, comoCron: true });
    if (r.error) return res.status(400).json({ error: r.error });
    res.json({ ok: true, enviados: r.enviados });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});
module.exports = router;

