// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/db/init.js
// MÓDULO    : Base de Datos (Inicialización)
// PROPÓSITO : Lógica de creación de esquema, migraciones y carga inicial de datos.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('./connection');
let Database;
try {
  Database = require('better-sqlite3');
} catch (e) {
}

// ------------------------------------------------------------
// FUNCIÓN  : inicializar
// PROPÓSITO: Crear tablas e índices en PostgreSQL si no existen y aplicar migraciones de esquema necesarias.
// PARÁMETROS: Ninguno
// RETORNA  : Nada
// ERRORES  : Se capturan fallos críticos durante la ejecución de DDL o DML.
// ------------------------------------------------------------
  if (pool) {
    try {
      console.log('[PG] Creando tablas del esquema base...');
      const schemaSqlPath = path.join(__dirname, 'schema-postgres.sql');
      if (fs.existsSync(schemaSqlPath)) {
        const schemaSql = fs.readFileSync(schemaSqlPath, 'utf8');
        await pool.query(schemaSql);
        console.log('[PG] Esquema base ejecutado con éxito.');
      }

      console.log('[PG] Creando tablas adicionales/de control...');

      // Limpieza de módulos obsoletos. Se eliminan las tablas de supervisiones si existen.
      await pool.query('DROP TABLE IF EXISTS seguimientos_iss CASCADE').catch(() => {});
      await pool.query('DROP TABLE IF EXISTS acompanamientos CASCADE').catch(() => {});
      await pool.query('DROP TABLE IF EXISTS incumplimientos CASCADE').catch(() => {});
      await pool.query('DROP TABLE IF EXISTS supervision_resultados CASCADE').catch(() => {});
      await pool.query('DROP TABLE IF EXISTS supervisiones CASCADE').catch(() => {});
      
      // Definición dinámica de tablas base (Extintores).
      const tables = [
        `CREATE TABLE IF NOT EXISTS extintores (
          id SERIAL PRIMARY KEY,
          guarderia_clave VARCHAR(10) NOT NULL,
          numero_extintor INTEGER NOT NULL,
          modelo VARCHAR(20),
          capacidad DECIMAL(5,2),
          unidad VARCHAR(10),
          cantidad INTEGER,
          ultimo_mantenimiento DATE,
          fecha_vencimiento DATE,
          observaciones TEXT,
          activo BOOLEAN DEFAULT TRUE,
          motivo_baja TEXT,
          fecha_baja DATE,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )`
      ];

      for (const sql of tables) {
        await pool.query(sql);
      }

      // Generación de índices. Se optimizan las consultas en el inventario de extintores.
      await pool.query('CREATE INDEX IF NOT EXISTS idx_extintores_clave ON extintores(guarderia_clave)');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_extintores_vencimiento ON extintores(fecha_vencimiento) WHERE activo = TRUE');
      await pool.query('CREATE INDEX IF NOT EXISTS idx_extintores_activo ON extintores(activo)');

      console.log('[PG] Tablas creadas/verificadas con éxito.');

      // Migraciones de esquema en caliente (Hot Migrations).
      
      // Permitir valores nulos en expediente_id. Se aplica para eventos globales o de otros módulos en el historial.
      await pool.query('ALTER TABLE historial ALTER COLUMN expediente_id DROP NOT NULL').catch(() => {});
      // Incorporación de columnas para auditoría extendida.
      await pool.query('ALTER TABLE historial ADD COLUMN IF NOT EXISTS entidad TEXT').catch(() => {});
      await pool.query('ALTER TABLE historial ADD COLUMN IF NOT EXISTS entidad_id INTEGER').catch(() => {});
      await pool.query('ALTER TABLE historial ADD COLUMN IF NOT EXISTS guarderia_clave TEXT').catch(() => {});
      
      // Inyección de configuraciones. Se configuran las plantillas de correo SDA.
      const plantillasDefault = [
        ['plantilla_asunto_general', 'SDA — Notificación de Estatus de Documentación Institucional · {{GUARDERIA}}'],
        ['plantilla_cuerpo_general', 'Estimada(s) {{ENCARGADA}}:\n\nPor medio del presente, y de acuerdo a los requerimientos institucionales del IMSS, nos dirigimos a usted para notificarle que la Guardería {{GUARDERIA}} ({{NUMERO}}) cuenta con documentos en su expediente que requieren su atención y/o actualización correspondiente.\n\nA continuación, se presenta el desglose del estado actual de dichos documentos:\n\n{{LISTA}}\n\nLe exhortamos amablemente a iniciar el proceso de regularización a la brevedad posible para evitar incumplimientos ante la normativa vigente. Su Coordinadora o Analista asignada se encuentra a su disposición para cualquier orientación adicional.\n\nFecha de evaluación del sistema: {{FECHA}}\nNivel de notificación: {{TIPO}}'],
        ['auto_correo_extintores', '0']
      ];

      for (const [clave, valor] of plantillasDefault) {
        // Verificación de la existencia previa. En caso negativo, se intenta copiar de la configuración anterior de 45 días como respaldo (fallback).
        const { rows: exists } = await pool.query('SELECT 1 FROM configuracion WHERE clave = $1', [clave]);
        if (exists.length === 0) {
          const antiguaClave = clave.replace('_general', '_45');
          const { rows: antigua } = await pool.query('SELECT valor FROM configuracion WHERE clave = $1', [antiguaClave]);
          const valorFinal = antigua.length > 0 ? antigua[0].valor : valor;
          await pool.query('INSERT INTO configuracion (clave, valor) VALUES ($1, $2)', [clave, valorFinal]).catch(() => {});
        }
      }

      // Actualización de restricciones de estado e incorporación de soporte para "No aplica".
      await pool.query('ALTER TABLE expedientes ADD COLUMN IF NOT EXISTS no_aplica BOOLEAN DEFAULT FALSE').catch(() => {});
      await pool.query('ALTER TABLE expedientes DROP CONSTRAINT IF EXISTS expedientes_estado_check').catch(() => {});
      await pool.query(`ALTER TABLE expedientes ADD CONSTRAINT expedientes_estado_check CHECK(estado IN ('vigente','por vencer','vencido','no aplica'))`).catch(() => {});

      // Ampliación de la tabla de historial de alertas. Se mejora la trazabilidad y captura de errores.
      await pool.query('ALTER TABLE historial_alertas ALTER COLUMN expediente_id DROP NOT NULL').catch(() => {});
      await pool.query('ALTER TABLE historial_alertas ADD COLUMN IF NOT EXISTS extintor_id INTEGER').catch(() => {});
      await pool.query('ALTER TABLE historial_alertas ADD COLUMN IF NOT EXISTS asunto TEXT').catch(() => {});
      await pool.query('ALTER TABLE historial_alertas ADD COLUMN IF NOT EXISTS cuerpo TEXT').catch(() => {});
      await pool.query('ALTER TABLE historial_alertas ADD COLUMN IF NOT EXISTS fecha_referencia DATE').catch(() => {});
      
      // Carga de datos maestros. Se inicializa el catálogo de observaciones originales.
      const obsOriginales = [
        'Fecha incorrecta', 
        'Ilegible', 
        'No corresponde a la guardería', 
        'Redacción incorrecta', 
        'Sin firma', 
        'Sin sello oficial', 
        'Vigencia vencida en el documento'
      ];
      await pool.query('DELETE FROM observaciones_catalogo').catch(() => {});
      for (const texto of obsOriginales) {
        await pool.query('INSERT INTO observaciones_catalogo (texto, activo) VALUES ($1, true)', [texto]).catch(() => {});
      }

      // Migraciones de usuarios. Se configuran roles y área de adscripción.
      await pool.query('ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS area_adscripcion TEXT').catch(() => {});
      await pool.query('ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_rol_check').catch(() => {});
      // Migración segura. Se realiza la conversión de roles obsoletos a 'Colaborador del Departamento de Guarderías'.
      await pool.query(`
        UPDATE usuarios 
        SET rol = 'Colaborador del Departamento de Guarderías' 
        WHERE rol NOT IN ('Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías', 'Invitado')
        AND usuario != 'admin'
      `).catch(() => {});

      // Se asegura que el usuario administrador posea el rol de Programador.
      await pool.query(`UPDATE usuarios SET rol = 'Programador' WHERE usuario = 'admin'`).catch(() => {});
      await pool.query(`
        ALTER TABLE usuarios 
        ADD CONSTRAINT usuarios_rol_check 
        CHECK(rol IN ('Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías', 'Invitado'))
      `).catch(() => {});
      
      console.log('[PG] Migraciones de fase 2 completadas.');
    } catch (err) {
      console.error('[PG] Error al crear tablas o migrar:', err.message);
    }
  } else {
    console.log('[PG] No se estableció conexión con PostgreSQL.');
  }
}

module.exports = { inicializar };

