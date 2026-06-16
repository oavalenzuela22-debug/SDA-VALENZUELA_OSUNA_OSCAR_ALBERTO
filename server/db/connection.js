// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/db/connection.js
// MÓDULO    : Base de Datos
// PROPÓSITO : Configuración y exportación del pool de conexiones PostgreSQL.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { Pool } = require('pg');
let pool;

if (process.env.DATABASE_URL || process.env.PG_URL) {
  // Configuración del Pool para PostgreSQL.
  pool = new Pool({
    connectionString: process.env.DATABASE_URL || process.env.PG_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false
  });
  console.log('[DB] Conectado a PostgreSQL');
} else {
  // Error crítico. El sistema requiere PostgreSQL para la persistencia SDA.
  console.error('[DB] Error: No se encontró DATABASE_URL o PG_URL. PostgreSQL es obligatorio.');
  process.exit(1);
}

module.exports = { pool };

