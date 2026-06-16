// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/db/seed.js
// MÓDULO    : Base de Datos (Semillas / Carga Inicial)
// PROPÓSITO : Carga inicial de datos maestros, usuarios base, guarderías institucionales y catálogo de documentos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('./connection');

const OBS_PREDEFINIDAS = [
  'Sin sello oficial', 'Sin firma', 'Fecha incorrecta', 'Ilegible',
  'Redacción incorrecta', 'No corresponde a la guardería', 'Vigencia vencida en el documento'
];

// ------------------------------------------------------------
// FUNCIÓN  : run
// PROPÓSITO: Poblar la base de datos con la configuración base, catálogos y usuarios iniciales si se detecta una instancia vacía.
// PARÁMETROS: Ninguno.
// RETORNA  : Promise<void>.
// ------------------------------------------------------------
async function run() {

  const guarderiasPath = path.join(__dirname, 'guarderias.json');
  const documentosPath = path.join(__dirname, 'documentos-catalogo.json');
  const guarderias = JSON.parse(fs.readFileSync(guarderiasPath, 'utf8'));
  const documentosCatalogo = JSON.parse(fs.readFileSync(documentosPath, 'utf8'));

  try {
    // Verificación de existencia de datos previa para evitar duplicidad de registros.
    const { rows: check } = await pool.query('SELECT COUNT(*) as n FROM guarderias');
    const count = parseInt(check[0].n || check[0].count || 0, 10);
    if (count > 0) {
      console.log('[Seed] La base de datos ya contiene registros. Se omite el proceso de carga inicial.');
      return;
    }

    // Inserción de registros de guarderías
    for (const g of guarderias) {
      await pool.query(
        `INSERT INTO guarderias (numero, nombre, municipio, direccion, telefono, director, correo, activo)
         VALUES ($1, $2, $3, '', '', '', '', true)`,
        [g.numero, g.nombre, g.municipio || '']
      );
    }
    console.log('[Seed] Guarderías insertadas:', guarderias.length);

    // Inserción de secciones de documentación
    const seccionesUnicas = [...new Set(documentosCatalogo.map(d => d.seccion))];
    for (let i = 0; i < seccionesUnicas.length; i++) {
      await pool.query(
        `INSERT INTO secciones (nombre, orden, activo) VALUES ($1, $2, true)`,
        [seccionesUnicas[i], i + 1]
      );
    }

    const { rows: secRows } = await pool.query('SELECT id, nombre FROM secciones');
    const seccionIds = {};
    secRows.forEach(r => { seccionIds[r.nombre] = r.id; });

    // Inserción de catálogo maestro de documentos
    for (const d of documentosCatalogo) {
      const sid = seccionIds[d.seccion];
      await pool.query(
        `INSERT INTO documentos_catalogo (seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden, activo)
         VALUES ($1, $2, $3, $4, false, false, $5, $6, $7, true)`,
        [sid, d.nombre, !!d.requiere_vigencia, !!d.requiere_oficio, d.periodicidad || 'anual', !!d.obligatorio, d.orden]
      );
    }
    console.log('[Seed] Catálogo de documentos insertado:', documentosCatalogo.length);

    // Inserción de observaciones técnicas predefinidas
    for (const texto of OBS_PREDEFINIDAS) {
      await pool.query(`INSERT INTO observaciones_catalogo (texto, activo) VALUES ($1, true)`, [texto]);
    }

    // Creación del usuario administrador inicial
    const passwordAdmin = process.env.ADMIN_PASSWORD;
    if (!passwordAdmin) throw new Error('La variable de entorno ADMIN_PASSWORD no está definida. Es necesario configurar una contraseña segura antes de ejecutar el proceso.');
    const hash = bcrypt.hashSync(passwordAdmin, 10);
    await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, correo, activo) VALUES ($1, $2, $3, $4, '', true)`,
      ['Administrador', 'admin', hash, 'Programador']
    );
    console.log('[Seed] Usuario administrador creado exitosamente.');

    // Inserción de parámetros de configuración global del sistema
    const configs = [
      ['dias_aviso_45', '45'], ['dias_aviso_30', '30'], ['dias_aviso_20', '20'],
      ['dias_aviso_10', '10'], ['dias_aviso_3', '3'], ['correos_alertas', ''],
      ['reglas_vigencia', '{"Licencia de Uso de suelo":["Culiacán","Navolato"]}'],
      ['plantilla_asunto_general', 'SDA — Notificación de Estatus de Documentación Institucional · {{GUARDERIA}}'],
      ['plantilla_cuerpo_general', 'Estimada(s) {{ENCARGADA}}:\n\nPor medio del presente, y de acuerdo a los requerimientos institucionales del IMSS, nos dirigimos a usted para notificarle que la Guardería {{GUARDERIA}} ({{NUMERO}}) cuenta con documentos en su expediente que requieren su atención y/o actualización correspondiente.\n\nA continuación, se presenta el desglose del estado actual de dichos documentos:\n\n{{LISTA}}\n\nLe exhortamos amablemente a iniciar el proceso de regularización a la brevedad posible para evitar incumplimientos ante la normativa vigente. Su Coordinadora o Analista asignada se encuentra a su disposición para cualquier orientación adicional.\n\nFecha de evaluación del sistema: {{FECHA}}\nNivel de notificación: {{TIPO}}']
    ];
    for (const [clave, valor] of configs) {
      await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING`, [clave, valor]);
    }

    // Inicialización de expedientes digitales (relación guardería-documento)
    const { rows: gRows } = await pool.query('SELECT id FROM guarderias');
    const { rows: dRows } = await pool.query(`SELECT id FROM documentos_catalogo WHERE activo = true`);
    let expCount = 0;
    for (const g of gRows) {
      for (const d of dRows) {
        await pool.query(
          `INSERT INTO expedientes (guarderia_id, documento_id, estado, usuario_id) VALUES ($1, $2, 'vencido', NULL) ON CONFLICT DO NOTHING`,
          [g.id, d.id]
        );
        expCount++;
      }
    }
    console.log('[Seed] Expedientes creados:', expCount);
    console.log('[Seed] Proceso completado exitosamente.');
  } finally {
    // Cierre de la conexión tras la ejecución única del script.
    await pool.end();
  }
}

run().catch(err => {
  console.error('[Seed] Error fatal:', err.message);
  process.exit(1);
});
