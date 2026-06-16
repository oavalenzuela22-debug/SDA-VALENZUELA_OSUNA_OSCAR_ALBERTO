-- ============================================================
-- PROYECTO  : SDA (Sistema de Administración de Documentos)
-- ARCHIVO   : server/db/schema-postgres.sql
-- MÓDULO    : Base de Datos (PostgreSQL)
-- PROPÓSITO : Definición de tablas, índices y restricciones del sistema.
-- AUTOR     : Oscar Alberto Valenzuela Osuna
-- ============================================================


-- ------------------------------------------------------------
-- TABLA     : usuarios
-- PROPÓSITO : Gestión de cuentas de usuario y niveles de acceso.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS usuarios (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  rol TEXT NOT NULL CHECK(rol IN ('Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías', 'Invitado')),
  correo TEXT,
  activo BOOLEAN NOT NULL DEFAULT true,
  ultima_sesion TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA     : guarderias
-- PROPÓSITO : Catálogo de unidades institucionales (guarderías).
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guarderias (
  id SERIAL PRIMARY KEY,
  numero TEXT NOT NULL,
  nombre TEXT NOT NULL,
  municipio TEXT NOT NULL DEFAULT '',
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  director TEXT DEFAULT '',
  encargada TEXT DEFAULT '',
  correo TEXT DEFAULT '',
  correos_aviso TEXT DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA     : secciones
-- PROPÓSITO : Categorías organizativas para los documentos.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secciones (
  id SERIAL PRIMARY KEY,
  nombre TEXT NOT NULL,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- TABLA     : documentos_catalogo
-- PROPÓSITO : Definición de requisitos técnicos por tipo de documento.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS documentos_catalogo (
  id SERIAL PRIMARY KEY,
  seccion_id INTEGER NOT NULL REFERENCES secciones(id),
  nombre TEXT NOT NULL,
  requiere_vigencia BOOLEAN NOT NULL DEFAULT true,
  requiere_oficio BOOLEAN NOT NULL DEFAULT true,
  requiere_firma BOOLEAN NOT NULL DEFAULT false,
  requiere_sello BOOLEAN NOT NULL DEFAULT false,
  periodicidad TEXT DEFAULT 'anual',
  obligatorio BOOLEAN NOT NULL DEFAULT true,
  orden INTEGER NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT true,
  UNIQUE(seccion_id, nombre)
);

-- ------------------------------------------------------------
-- TABLA     : expedientes
-- PROPÓSITO : Registro centralizado de documentos por guardería.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS expedientes (
  id SERIAL PRIMARY KEY,
  guarderia_id INTEGER NOT NULL REFERENCES guarderias(id),
  documento_id INTEGER NOT NULL REFERENCES documentos_catalogo(id),
  estado TEXT NOT NULL DEFAULT 'vencido' CHECK(estado IN ('vigente','por vencer','vencido','no aplica')),
  oficio TEXT DEFAULT '',
  fecha_documento DATE,
  fecha_vigencia DATE,
  no_aplica BOOLEAN NOT NULL DEFAULT false,
  notas TEXT DEFAULT '',
  usuario_id INTEGER REFERENCES usuarios(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(guarderia_id, documento_id)
);

-- ------------------------------------------------------------
-- TABLA     : historial
-- PROPÓSITO : Auditoría de cambios en los expedientes.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial (
  id SERIAL PRIMARY KEY,
  expediente_id INTEGER REFERENCES expedientes(id),
  usuario_id INTEGER REFERENCES usuarios(id),
  campo_modificado TEXT NOT NULL,
  valor_anterior TEXT,
  valor_nuevo TEXT,
  fecha TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------
-- TABLA     : historial_alertas
-- PROPÓSITO : Trazabilidad de notificaciones enviadas por correo.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS historial_alertas (
  id SERIAL PRIMARY KEY,
  expediente_id INTEGER NOT NULL REFERENCES expedientes(id),
  tipo_alerta TEXT NOT NULL,
  destinatario TEXT NOT NULL,
  fecha_envio TIMESTAMPTZ DEFAULT NOW(),
  exitoso BOOLEAN NOT NULL DEFAULT true
);

-- ------------------------------------------------------------
-- TABLA     : configuracion
-- PROPÓSITO : Almacenamiento de parámetros globales del sistema.
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT
);

-- ============================================================
-- SECCIÓN: ÍNDICES DE OPTIMIZACIÓN
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_exp_guarderia ON expedientes(guarderia_id);
CREATE INDEX IF NOT EXISTS idx_exp_documento ON expedientes(documento_id);
CREATE INDEX IF NOT EXISTS idx_exp_estado ON expedientes(estado);
CREATE INDEX IF NOT EXISTS idx_exp_vigencia ON expedientes(fecha_vigencia);

