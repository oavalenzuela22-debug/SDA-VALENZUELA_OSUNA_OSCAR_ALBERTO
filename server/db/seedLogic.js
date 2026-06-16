// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/db/seedLogic.js
// MÓDULO    : Base de Datos / Lógica de Semilla
// PROPÓSITO : Lógica de reinicio maestro de datos y población inicial de catálogos y parámetros.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
// ------------------------------------------------------------
// FUNCIÓN  : runSeed
// PROPÓSITO: Ejecutar el restablecimiento integral de la base de datos y realizar la carga masiva de catálogos maestros, usuarios y parámetros iniciales.
// PARÁMETROS: pool (Object) - Conexión activa a la base de datos PostgreSQL.
// RETORNA  : Promise<Object> — Resumen estadístico de registros procesados.
// ------------------------------------------------------------
async function runSeed(pool) {
  const guarderiasPath = path.join(__dirname, 'guarderias.json');
  const documentosPath = path.join(__dirname, 'documentos-catalogo.json');
  const guarderias = JSON.parse(fs.readFileSync(guarderiasPath, 'utf8'));
  const documentosCatalogo = JSON.parse(fs.readFileSync(documentosPath, 'utf8'));

  // Depuración de tablas en orden jerárquico para respetar restricciones de integridad referencial (FK)
  const tablas = ['historial', 'historial_alertas', 'extintores', 'expedientes',
    'documentos_catalogo', 'secciones', 'guarderias', 'configuracion', 'usuarios'];
  for (const t of tablas) {
    await pool.query(`DELETE FROM ${t}`).catch(() => {});
  }

  // Población del catálogo de guarderías
  for (const g of guarderias) {
    await pool.query(
      `INSERT INTO guarderias (numero, nombre, municipio, direccion, telefono, director, correo, activo) VALUES ($1, $2, $3, '', '', '', '', true)`,
      [g.numero, g.nombre, g.municipio || '']
    );
  }

  // Identificación y registro de secciones únicas del catálogo de documentos
  const seccionesUnicas = [...new Set(documentosCatalogo.map(d => d.seccion))];
  for (let i = 0; i < seccionesUnicas.length; i++) {
    await pool.query(`INSERT INTO secciones (nombre, orden, activo) VALUES ($1, $2, true)`, [seccionesUnicas[i], i + 1]);
  }

  const { rows: secRows } = await pool.query('SELECT id, nombre FROM secciones');
  const seccionIds = {};
  secRows.forEach(r => { seccionIds[r.nombre] = r.id; });

  // Inserción de definiciones de documentos en el catálogo maestro
  for (const d of documentosCatalogo) {
    const sid = seccionIds[d.seccion];
    await pool.query(
      `INSERT INTO documentos_catalogo (seccion_id, nombre, requiere_vigencia, requiere_oficio, requiere_firma, requiere_sello, periodicidad, obligatorio, orden, activo) VALUES ($1, $2, $3, $4, false, false, $5, $6, $7, true)`,
      [sid, d.nombre, !!d.requiere_vigencia, !!d.requiere_oficio, d.periodicidad || 'anual', !!d.obligatorio, d.orden]
    );
  }

  // Creación de la cuenta de administración principal con credenciales cifradas
  const passwordAdmin = process.env.ADMIN_PASSWORD || 'admin123';
  const hash = bcrypt.hashSync(passwordAdmin, 10);
  await pool.query(
    `INSERT INTO usuarios (nombre, usuario, password_hash, rol, correo, activo) VALUES ($1, $2, $3, $4, '', true)`,
    ['Administrador', 'admin', hash, 'Programador']
  );

  // Inicialización de parámetros globales de configuración (umbrales de aviso y reglas de negocio)
  const configs = [
    ['dias_aviso_45', '45'], ['dias_aviso_30', '30'], ['dias_aviso_20', '20'],
    ['dias_aviso_10', '10'], ['dias_aviso_3', '3'], ['correos_alertas', ''],
    ['reglas_vigencia', '{"Licencia de Uso de suelo":["Culiacán","Navolato"]}']
  ];
  for (const [clave, valor] of configs) {
    await pool.query(`INSERT INTO configuracion (clave, valor) VALUES ($1, $2) ON CONFLICT (clave) DO NOTHING`, [clave, valor]);
  }

  // Generación matricial de expedientes físicos: vinculación de cada guardería con cada tipo de documento activo
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

  return { guarderias: guarderias.length, documentos: documentosCatalogo.length, expedientes: expCount };
}
module.exports = { runSeed };

