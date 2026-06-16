// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/correo.js
// MÓDULO    : Correo Electrónico (Rutas API)
// PROPÓSITO : Endpoints para el envío manual de resúmenes de cumplimiento a las guarderías.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================
const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');
const { sendMail } = require('../utils/mailer');
const { buildMensaje, getConfig } = require('../cron/alertas');

const router = express.Router();
// ------------------------------------------------------------
// FUNCIÓN  : formatDateDMY
// PROPÓSITO: Convertir un objeto Date o cadena ISO al formato regional estándar (DD/MM/YYYY).
// PARÁMETROS: date (Date/String) - La fecha objeto de la transformación.
// RETORNA  : String — Representación textual de la fecha en formato día/mes/año.
// ------------------------------------------------------------
function formatDateDMY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

router.use(authMiddleware);
router.use(usuarioActivo);

// ------------------------------------------------------------
// FUNCIÓN  : POST /enviar-resumen-guarderia
// PROPÓSITO: Desencadenar el envío manual de un resumen exhaustivo de documentos (vencidos, por vencer y vigentes) a una guardería específica.
// ------------------------------------------------------------
router.post('/enviar-resumen-guarderia', async (req, res) => {
  const { guarderia_id } = req.body;
  if (!guarderia_id) return res.status(400).json({ error: 'Falta guarderia_id' });

  try {
    const { runAlertas } = require('../cron/alertas');
    const baseUrl = req.protocol + '://' + req.get('host');

    const result = await runAlertas(baseUrl, { 
      forzarPrueba: true, 
      guarderiaIds: [parseInt(guarderia_id, 10)],
      incluirVigentes: true 
    });

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      ok: true, 
      mensaje: 'Resumen enviado correctamente',
      documentos_avisados: result.enviados 
    });

  } catch (e) {
    console.error('[Correo] Error:', e.message);
    res.status(500).json({ error: 'Error interno al procesar el resumen' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /enviar-masivo
// PROPÓSITO: Ejecutar el envío masivo de correos (Alertas o Resúmenes) a todas las guarderías.
// RESTRICCIÓN: Solo Jefes o Programadores.
// ------------------------------------------------------------
router.post('/enviar-masivo', async (req, res) => {
  const { tipo } = req.body; // 'alertas' o 'resumen'
  const u = req.user;

  // Verificación de rol (Solo Jefes o Programadores)
  const rolesPermitidos = ['programador', 'programadora', 'jefe del departamento', 'jefa del departamento'];
  if (!u || !rolesPermitidos.includes(u.rol.toLowerCase())) {
    return res.status(403).json({ error: 'No tienes permisos para realizar envíos masivos.' });
  }

  try {
    const { runAlertas } = require('../cron/alertas');
    const baseUrl = req.protocol + '://' + req.get('host');

    // Si es tipo resumen, incluimos vigentes. Si es alertas, solo vencidos/por vencer.
    const options = {
      forzarPrueba: true, // Para ignorar si la automatización está apagada en ajustes
      incluirVigentes: (tipo === 'resumen'),
      comoCron: (tipo === 'alertas')
    };

    // Ejecución masiva (guarderiaIds = null dispara a todas las activas)
    const result = await runAlertas(baseUrl, options);

    if (result.error) {
      return res.status(400).json({ error: result.error });
    }

    res.json({ 
      ok: true, 
      mensaje: `Envío masivo de ${tipo === 'resumen' ? 'resúmenes' : 'alertas'} iniciado`,
      enviados: result.enviados 
    });

  } catch (e) {
    console.error('[Correo Masivo] Error:', e.message);
    res.status(500).json({ error: 'Error interno al procesar el envío masivo' });
  }
});

module.exports = router;

