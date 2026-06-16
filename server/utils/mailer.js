// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/utils/mailer.js
// MÓDULO    : Utilidades de Red
// PROPÓSITO : Configuración de transporte SMTP y envío de correos electrónicos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const nodemailer = require('nodemailer');

// ------------------------------------------------------------
// FUNCIÓN  : sendMail
// PROPÓSITO: Configurar el transporte y enviar un correo electrónico vía Gmail SMTP.
// PARÁMETROS:
//   - to (String|Array): Destinatario(s) del correo.
//   - subject (String): Asunto del correo.
//   - html (String): Contenido HTML (opcional).
//   - text (String): Contenido en texto plano.
// RETORNA  : (Object) { ok: boolean, result?: info, error?: string }
// ERRORES  :
//   500 — Error de conexión SMTP o autenticación de Gmail.
// ------------------------------------------------------------
async function sendMail({ to, subject, html, text }) {
  /* Verificación de credenciales en variables de entorno. */
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.warn('[Mailer] Credenciales de Gmail no configuradas en .env');
    return { ok: false, error: 'Credenciales de Gmail no configuradas' };
  }

  /* Configuración del transporte SMTP para Gmail con TLS. */
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  /* Normalización y limpieza de la lista de destinatarios. */
  const toList = (Array.isArray(to) ? to : [to])
    .filter(Boolean)
    .map(email => email.trim().toLowerCase())
    .join(', ');

  if (!toList.length) return { ok: false, error: 'Sin destinatarios' };

  /* Definición de la estructura del mensaje y cabeceras institucionales. */
  const mailOptions = {
    from: `"Departamento de Guarderías IMSS OOAD Sinaloa" <${process.env.GMAIL_USER}>`,
    to: toList,
    subject: subject,
    text: text || '',
    html: html || `<pre>${text || ''}</pre>`,
    headers: {
      'X-Mailer': 'SDA-IMSS-OOAD-Sinaloa',
      'X-Priority': '3',
      'Precedence': 'bulk',
      'Auto-Submitted': 'auto-generated'
    }
  };

  try {
    /* Ejecución del envío asíncrono. */
    const info = await transporter.sendMail(mailOptions);
    console.log('[Mailer] Correo enviado:', info.messageId);
    return { ok: true, result: info };
  } catch (err) {
    console.error('[Mailer] Error Nodemailer:', err.message);
    return { ok: false, error: err.message };
  }
}

module.exports = { sendMail };
