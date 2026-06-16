// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/usuarios.js
// MÓDULO    : Gestión de Usuarios (Rutas API)
// PROPÓSITO : Control de cuentas, roles, permisos y seguridad de acceso.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../db/connection');
const { authMiddleware, adminOJefe } = require('../middlewares/auth');

const router = express.Router();

router.use(authMiddleware);
router.use(adminOJefe);

// ------------------------------------------------------------
// FUNCIÓN  : GET /
// PROPÓSITO: Recuperar el listado completo de usuarios registrados, incluyendo metadatos de sesión y área.
// ------------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, nombre, usuario, rol, correo, activo, ultima_sesion, area_adscripcion FROM usuarios ORDER BY usuario');
    res.json(rows);
  } catch (e) {
    console.error('[Usuarios] GET /:', e.message);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : POST /
// PROPÓSITO: Registrar una nueva cuenta de usuario con credenciales cifradas y asignación de rol.
// ------------------------------------------------------------
router.post('/', async (req, res) => {
  const { nombre, usuario, password, rol, correo, area_adscripcion } = req.body || {};
  if (!nombre || !usuario || !password || usuario.trim().length < 2 || password.length < 6) {
    return res.status(400).json({ error: 'Nombre, usuario (mín. 2) y contraseña (mín. 6) requeridos' });
  }
  const login = usuario.trim().toLowerCase();
  try {
    const { rows: exist } = await pool.query('SELECT id FROM usuarios WHERE usuario = $1', [login]);
    if (exist[0]) return res.status(400).json({ error: 'Ese usuario ya existe' });

    const hash = bcrypt.hashSync(password, 10);
    const rolFinal = rol || 'Colaborador del Departamento de Guarderías';
    const { rows } = await pool.query(
      `INSERT INTO usuarios (nombre, usuario, password_hash, rol, correo, area_adscripcion, activo) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`,
      [nombre.trim(), login, hash, rolFinal, (correo || '').trim(), (area_adscripcion || '').trim()]
    );
    const newId = rows[0].id;
    res.status(201).json({ id: newId, nombre: nombre.trim(), usuario: login, rol: rolFinal });
  } catch (e) {
    console.error('[Usuarios] POST /:', e.message);
    res.status(500).json({ error: 'Error al crear usuario' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar la información de perfil, credenciales o estado de activación de un usuario.
// ------------------------------------------------------------
router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const { nombre, usuario, password, rol, correo, activo, area_adscripcion } = req.body || {};
  try {
    const { rows: chk } = await pool.query('SELECT id FROM usuarios WHERE id = $1', [id]);
    if (!chk[0]) return res.status(404).json({ error: 'Usuario no encontrado' });

    const sets = [];
    const vals = [];
    let n = 1;
    if (nombre !== undefined) { sets.push(`nombre = $${n++}`); vals.push(nombre.trim()); }
    if (usuario !== undefined) { sets.push(`usuario = $${n++}`); vals.push(usuario.trim().toLowerCase()); }
    if (password !== undefined && password.length >= 6) { sets.push(`password_hash = $${n++}`); vals.push(bcrypt.hashSync(password, 10)); }
    if (rol !== undefined) { sets.push(`rol = $${n++}`); vals.push(rol); }
    if (correo !== undefined) { sets.push(`correo = $${n++}`); vals.push(correo.trim()); }
    if (area_adscripcion !== undefined) { sets.push(`area_adscripcion = $${n++}`); vals.push(area_adscripcion.trim()); }
    if (activo !== undefined) { sets.push(`activo = $${n++}`); vals.push(Boolean(activo)); }
    if (!sets.length) return res.json({ ok: true });
    vals.push(id);
    await pool.query(`UPDATE usuarios SET ${sets.join(', ')} WHERE id = $${n}`, vals);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Usuarios] PUT /:id:', e.message);
    res.status(500).json({ error: 'Error al actualizar usuario' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : DELETE /:id
// PROPÓSITO: Eliminar de forma permanente un usuario de la base de datos, restringiendo la eliminación del administrador principal.
// ------------------------------------------------------------
router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    const { rows: chk } = await pool.query('SELECT id, usuario FROM usuarios WHERE id = $1', [id]);
    if (!chk[0]) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (chk[0].usuario === 'admin') return res.status(400).json({ error: 'No se puede eliminar el usuario administrador principal' });
    
    await pool.query('DELETE FROM usuarios WHERE id = $1', [id]);
    res.json({ ok: true });
  } catch (e) {
    console.error('[Usuarios] DELETE /:id:', e.message);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

module.exports = router;

