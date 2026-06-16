// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/middlewares/auth.js
// MÓDULO    : Seguridad y Control de Acceso (Middlewares)
// PROPÓSITO : Verificación de tokens JWT y validación de roles de usuario.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const jwt = require('jsonwebtoken');
const { pool } = require('../db/connection');
if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET no está definido en .env');
const JWT_SECRET = process.env.JWT_SECRET;
// ------------------------------------------------------------
// FUNCIÓN  : authMiddleware
// PROPÓSITO: Validar el token JWT en cabeceras o query string y verificar la vigencia del usuario en la base de datos.
// PARÁMETROS:
//   - req (Object)  : Objeto de petición Express.
//   - res (Object)  : Objeto de respuesta Express.
//   - next (Function): Función de continuación del flujo middleware.
// RETORNA  : Nada
// ------------------------------------------------------------
async function authMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  let token = null;
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  } else if (req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({ error: 'No autorizado' });
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const { rows } = await pool.query('SELECT id, nombre, usuario, rol, activo FROM usuarios WHERE id = $1', [payload.userId]);
    const user = rows[0];
    if (!user || !user.activo) {
      return res.status(401).json({ error: 'Usuario inactivo' });
    }
    req.user = user;
    next();
  } catch (e) {
    console.error('[AuthMiddleware] Error verificado:', e.message, 'Token length:', token ? token.length : 0);
    return res.status(401).json({ error: 'Token inválido' });
  }
}

// ------------------------------------------------------------
// FUNCIÓN  : adminOnly
// PROPÓSITO: Restringir el acceso a usuarios con privilegios de administración técnica (respaldos y sistema).
// PARÁMETROS: req, res, next
// RETORNA  : Nada
// ------------------------------------------------------------
function adminOnly(req, res, next) {
  const rolesAdmitidos = ['Programador', 'Programadora'];
  const rol = (req.user.rol || '').trim();
  if (!rolesAdmitidos.includes(rol)) {
    return res.status(403).json({ error: 'Solo Programador o Programadora pueden realizar esta acción.' });
  }
  next();
}

// ------------------------------------------------------------
// FUNCIÓN  : adminOJefe
// PROPÓSITO: Restringir el acceso a usuarios con rol administrativo o de jefatura del departamento.
// PARÁMETROS: req, res, next
// RETORNA  : Nada
// ------------------------------------------------------------
function adminOJefe(req, res, next) {
  const rolesAdmitidos = ['Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento'];
  const rol = (req.user.rol || '').trim();
  if (!rolesAdmitidos.includes(rol)) {
    return res.status(403).json({ error: 'Solo personal administrativo o de jefatura puede realizar esta acción.' });
  }
  next();
}

// ------------------------------------------------------------
// FUNCIÓN  : usuarioActivo
// PROPÓSITO: Restringir el acceso a personal operativo y administrativo del departamento de guarderías.
// PARÁMETROS: req, res, next
// RETORNA  : Nada
// ------------------------------------------------------------
function usuarioActivo(req, res, next) {
  const rolesAdmitidos = ['Programador', 'Programadora', 'Jefe del Departamento', 'Jefa del Departamento', 'Colaborador del Departamento de Guarderías'];
  const rol = (req.user.rol || '').trim();
  if (!rolesAdmitidos.includes(rol)) {
    return res.status(403).json({ error: 'No tienes permisos para realizar esta acción.' });
  }
  next();
}

// ------------------------------------------------------------
// FUNCIÓN  : soloLectura
// PROPÓSITO: Permitir el acceso a cualquier usuario autenticado exclusivamente para visualización de datos.
// PARÁMETROS: req, res, next
// RETORNA  : Nada
// ------------------------------------------------------------
function soloLectura(req, res, next) {
  next();
}

module.exports = { authMiddleware, adminOnly, adminOJefe, usuarioActivo, soloLectura, JWT_SECRET };

