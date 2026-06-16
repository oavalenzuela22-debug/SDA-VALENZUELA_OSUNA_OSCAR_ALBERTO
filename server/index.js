// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/index.js
// MÓDULO    : Servidor Principal (Express Backend)
// PROPÓSITO : Punto de entrada del backend, configuración de middleware, rutas y cron jobs.
// AUTOR     : Oscar Alberto Valenzuela Osuna

const nodePath = require('path');
require('dotenv').config({ path: nodePath.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const { pool } = require('./db/connection');
const bcrypt = require('bcryptjs');
const { inicializar } = require('./db/init');

const app = express();
const PORT = process.env.PORT || 3002;

// ------------------------------------------------------------
// FUNCIÓN  : GET /health
// PROPÓSITO: Endpoint de verificación de estado del servicio sin dependencia de base de datos.
// ------------------------------------------------------------
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', port: PORT });
});

const auth = require('./routes/auth');
const guarderias = require('./routes/guarderias');
const secciones = require('./routes/secciones');
const documentosCatalogo = require('./routes/documentos-catalogo');
const expedientes = require('./routes/expedientes');
const historial = require('./routes/historial');
const configuracion = require('./routes/configuracion');
const usuariosRouter = require('./routes/usuarios');
const correoRouter = require('./routes/correo');
const { authMiddleware, adminOnly } = require('./middlewares/auth');
const importExport = require('./routes/import-export');
const alertas = require('./routes/alertas');
const setup = require('./routes/setup');
const extintores = require('./routes/extintores');
const logsRouter = require('./routes/logs');
const { runAlertas, runPruebaCorreo, runAlertasExtintores } = require('./cron/alertas');

const { actualizarEstados } = require('./cron/actualizarEstados');

app.use(cors());
app.use(express.json());

// Configuración del limitador de tasa de peticiones. Se previene el abuso del servicio.
const limitadorGeneral = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Demasiadas peticiones. Intenta de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false
});

app.use(limitadorGeneral);
app.use(express.static(nodePath.join(__dirname, '..', 'frontend', 'dist')));

// ------------------------------------------------------------
// FUNCIÓN  : GET /SDA.png
// PROPÓSITO: Servir el logotipo del sistema.
// ------------------------------------------------------------
app.get('/SDA.png', (req, res) => {
  res.sendFile(nodePath.join(__dirname, '..', 'SDA.png'));
});

// Registro de controladores de API.
app.use('/api/auth', auth);
app.use('/api/guarderias', guarderias);
app.use('/api/secciones', secciones);
app.use('/api/documentos-catalogo', documentosCatalogo);
app.use('/api/expedientes', expedientes);
app.use('/api/historial', historial);
app.use('/api/configuracion', configuracion);
app.use('/api/usuarios', usuariosRouter);
app.use('/api/correo', correoRouter);
app.use('/api/import-export', importExport);
app.use('/api/alertas', alertas);
app.use('/api/setup', setup);
app.use('/api/extintores', extintores);
app.use('/api/logs', logsRouter);



// Redirección de rutas no encontradas al index.html.
app.get('*', (req, res) => {
  res.sendFile(nodePath.join(__dirname, '..', 'frontend', 'dist', 'index.html'));
});


// Actualización de estados del semáforo. Se ejecuta cada hora según vigencias.
cron.schedule('0 * * * *', () => {
  actualizarEstados()
    .then(n => { if (n > 0) console.log('[Cron] Estados actualizados:', n); })
    .catch(e => console.error('[Cron] Error actualizarEstados:', e));
});

// Alertas de vigencia por correo. Se realiza revisión horaria según configuración de usuario.
cron.schedule('0 * * * *', async () => {
  try {
    const { rows } = await pool.query('SELECT clave, valor FROM configuracion');
    const config = {};
    rows.forEach(r => { config[r.clave] = r.valor; });

    if (config.auto_correo !== '1') return;

    const ahora = new Date();
    const horaConfig = parseInt(config.aviso_hora || '8', 10);
    const diasConfig = (config.aviso_dias || '0,1,2,3,4,5,6').split(',').map(Number); // 0=Dom, 1=Lun...

    // Verificación de coincidencia entre la hora y el día actual con la configuración.
    if (ahora.getHours() === horaConfig && diasConfig.includes(ahora.getDay())) {
      console.log('[Cron] Ejecutando envío programado de alertas...');
      const baseUrl = process.env.BASE_URL || 'http://0.0.0.0:' + PORT;
      
      // Procesamiento de Alertas de Documentos
      const r = await runAlertas(baseUrl);
      if (r.error) console.error('[Cron] Error en runAlertas:', r.error);
      else if (r.enviados) console.log('[Cron] Alertas enviadas:', r.enviados);

      // Procesamiento de Alertas de Extintores
      const re = await runAlertasExtintores();
      if (re.error) console.error('[Cron] Error en runAlertasExtintores:', re.error);
      else if (re.enviados) console.log('[Cron] Alertas extintores enviadas:', re.enviados);
    }
  } catch (e) {
    console.error('[Cron] Error en ciclo de alertas:', e.message);
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : iniciar
// PROPÓSITO: Configurar base de datos (migraciones), crear administrador inicial e iniciar el servidor Express.
// PARÁMETROS: Ninguno
// RETORNA  : Nada
// ERRORES  : Se capturan errores derivados de la inicialización de la base de datos.
// ------------------------------------------------------------
async function iniciar() {
  // Aseguramiento de la actualización del esquema de la base de datos.
  await inicializar().catch(e => console.error('[Init] Falló inicialización:', e.message));

  // Inicio de la escucha del servidor HTTP con manejo de errores para evitar cierres inesperados.
  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log('Servidor en http://0.0.0.0:' + PORT + ' (PORT=' + PORT + ')');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`[Server] El puerto ${PORT} ya está en uso. Asumiendo que el servidor ya está corriendo.`);
    } else {
      console.error('[Server] Error fatal al iniciar:', err.message);
    }
  });

  // Ejecución de configuración automática.
  try {
    const { rows } = await pool.query('SELECT COUNT(*) as n FROM usuarios');
    const n = parseInt(rows[0].n || rows[0].count || 0, 10);
    if (n === 0) {
      const passwordAdmin = process.env.ADMIN_PASSWORD || 'admin123';
      const hash = bcrypt.hashSync(passwordAdmin, 10);
      await pool.query(
        `INSERT INTO usuarios (nombre, usuario, password_hash, rol, correo, activo) VALUES ($1, $2, $3, $4, '', true)`,
        ['Administrador', 'admin', hash, 'Programador']
      );
      const configs = [
        ['dias_aviso_45','45'],['dias_aviso_30','30'],['dias_aviso_15','15'],
        ['correos_alertas',''],
        ['reglas_vigencia','{"Licencia de Uso de suelo":["Culiacán","Navolato"]}']
      ];
      for (const [c, v] of configs) {
        await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING`, [c, v]);
      }
      console.log('[Setup] Usuario admin creado (admin / admin123).');
    }
  } catch (err) {
    console.error('[Setup] Error en arranque inicial:', err.message);
  }
}

iniciar();

