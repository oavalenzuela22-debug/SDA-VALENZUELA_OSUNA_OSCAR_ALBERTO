// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/routes/expedientes.js
// MÓDULO    : Gestión de Expedientes (Rutas API)
// PROPÓSITO : Control de documentos por guardería, cálculo de semáforo y estadísticas.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const express = require('express');
const { pool } = require('../db/connection');
const { authMiddleware, usuarioActivo } = require('../middlewares/auth');
const { calcularEstadoSemaforo, esVigenciaIndeterminada } = require('../utils/semaforo');

const router = express.Router();
router.use(authMiddleware);

// ------------------------------------------------------------
// FUNCIÓN  : GET /panel
// PROPÓSITO: Recuperar el resumen estadístico global y el estado por guardería para el panel principal.
// ------------------------------------------------------------
router.get('/panel', async (req, res) => {
  try {
    const { rows: guarderias } = await pool.query(
      `SELECT g.id, g.numero, g.nombre, g.municipio FROM guarderias g WHERE g.activo = true ORDER BY g.numero, g.municipio`
    );
    const { rows: expedientes } = await pool.query(
      `SELECT e.id, e.guarderia_id, e.documento_id, e.estado, e.fecha_vigencia, e.no_aplica, e.updated_at, g.municipio, d.nombre as documento_nombre
       FROM expedientes e
       JOIN guarderias g ON g.id = e.guarderia_id AND g.activo = true
       JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true`
    );

    const stats = { vigente: 0, por_vencer: 0, vencido: 0, total: 0, no_aplica: 0 };
    const porGuarderia = {};
    guarderias.forEach(g => { porGuarderia[g.id] = { guarderia: g, vigente: 0, por_vencer: 0, vencido: 0, total: 0, no_aplica: 0 }; });

    expedientes.forEach(e => {
      const est = calcularEstadoSemaforo(e, e.municipio || '', e.documento_nombre || '');
      const key = est.replace(/ /g, '_');
      const gs = porGuarderia[e.guarderia_id];
      if (gs) {
        if (gs[key] !== undefined) gs[key]++;
        if (est !== 'no aplica') gs.total++;
      }
      if (stats[key] !== undefined) stats[key]++;
      if (est !== 'no aplica') stats.total++;
    });

    const lista = guarderias.map(g => {
      const s = porGuarderia[g.id];
      const pct = s.total ? Math.round(((s.vigente + s.por_vencer) / s.total) * 100) : 0;
      let semaforo = 'vencido';
      if (pct >= 90 && s.vencido === 0) semaforo = 'vigente';
      else if (pct >= 60 || s.vencido === 0) semaforo = 'por vencer';
      return { id: g.id, numero: g.numero, nombre: g.nombre, municipio: g.municipio, ...s, porcentaje: pct, semaforo };
    }).sort((a, b) => a.vencido !== b.vencido ? b.vencido - a.vencido : a.porcentaje - b.porcentaje);

    res.json({ guarderias: lista, global: stats, ultimaActualizacion: new Date().toISOString() });
  } catch (e) {
    console.error('[Expedientes] GET /panel:', e.message);
    res.status(500).json({ error: 'Error al obtener panel' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /guarderia/:guarderiaId
// PROPÓSITO: Recuperar todos los expedientes de una guardería agrupados por secciones del catálogo.
// ------------------------------------------------------------
router.get('/guarderia/:guarderiaId', async (req, res) => {
  try {
    const { rows: gRows } = await pool.query(
      `SELECT id, numero, nombre, municipio, encargada FROM guarderias WHERE id = $1 AND activo = true`,

      [req.params.guarderiaId]
    );
    if (!gRows[0]) return res.status(404).json({ error: 'Guardería no encontrada' });
    const guarderia = gRows[0];
    const municipio = guarderia.municipio || '';

    const { rows: secciones } = await pool.query(
      `SELECT id, nombre, orden FROM secciones WHERE activo = true ORDER BY orden`
    );
    const { rows: docs } = await pool.query(
      `SELECT d.id as documento_id, d.nombre as documento_nombre, d.requiere_vigencia, d.requiere_oficio, d.orden, s.id as seccion_id, s.nombre as seccion_nombre
       FROM documentos_catalogo d JOIN secciones s ON s.id = d.seccion_id AND s.activo = true
       WHERE d.activo = true ORDER BY s.orden, d.orden`
    );
    const { rows: expedientes } = await pool.query(
      `SELECT e.id, e.documento_id, e.estado, e.no_aplica, e.oficio, e.fecha_documento, e.fecha_vigencia, e.notas, e.usuario_id, e.updated_at, u.nombre as usuario_nombre, u.usuario as usuario_login FROM expedientes e LEFT JOIN usuarios u ON u.id = e.usuario_id WHERE e.guarderia_id = $1`,
      [req.params.guarderiaId]
    );
    const expMap = {};
    expedientes.forEach(e => { expMap[e.documento_id] = e; });

    const { rows: obsAll } = await pool.query(
        `SELECT oe.expediente_id, oe.id, oe.texto_libre, oe.resuelta, oc.texto FROM observaciones_expediente oe LEFT JOIN observaciones_catalogo oc ON oc.id = oe.observacion_id WHERE oe.expediente_id = ANY(SELECT id FROM expedientes WHERE guarderia_id = $1)`,
      [req.params.guarderiaId]
    );
    const obsByExp = {};
    obsAll.forEach(r => {
      if (!obsByExp[r.expediente_id]) obsByExp[r.expediente_id] = [];
      obsByExp[r.expediente_id].push({ id: r.id, texto: r.texto || r.texto_libre, resuelta: r.resuelta });
    });

    const porSeccion = {};
    secciones.forEach(sec => { porSeccion[sec.id] = { seccion: sec, documentos: [] }; });

    docs.forEach(d => {
      const e = expMap[d.documento_id];
      const expId = e ? e.id : null;
      const estado = e ? calcularEstadoSemaforo(e, municipio, d.documento_nombre) : 'vencido';
      porSeccion[d.seccion_id].documentos.push({
        expediente_id: expId, documento_id: d.documento_id, documento_nombre: d.documento_nombre,
        requiere_vigencia: d.requiere_vigencia, requiere_oficio: d.requiere_oficio, 
        estado, no_aplica: e ? e.no_aplica : false,
        oficio: e ? e.oficio : '', fecha_documento: e ? e.fecha_documento : null,
        fecha_vigencia: e ? e.fecha_vigencia : null, notas: e ? e.notas : '',
        usuario_nombre: e ? e.usuario_nombre : null, usuario_login: e ? e.usuario_login : null,
        updated_at: e ? e.updated_at : null
      });
    });

    res.json({ guarderia, secciones: secciones.map(sec => ({ ...sec, documentos: porSeccion[sec.id].documentos })) });
  } catch (e) {
    console.error('[Expedientes] GET /guarderia/:id:', e.message);
    res.status(500).json({ error: 'Error al obtener expedientes' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /uno/:id
// PROPÓSITO: Recuperar la información de un único expediente mediante su identificador.
// ------------------------------------------------------------
router.get('/uno/:id', async (req, res) => {
  try {
    const sql = `SELECT e.*, g.numero as guarderia_numero, g.nombre as guarderia_nombre, d.nombre as documento_nombre, d.requiere_vigencia, d.requiere_oficio FROM expedientes e JOIN guarderias g ON g.id = e.guarderia_id JOIN documentos_catalogo d ON d.id = e.documento_id WHERE e.id = $1`;
    const { rows } = await pool.query(sql, [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Expediente no encontrado' });
    const row = rows[0];
    res.json(row);
  } catch (e) {
    console.error('[Expedientes] GET /uno/:id:', e.message);
    res.status(500).json({ error: 'Error al obtener expediente' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : PUT /:id
// PROPÓSITO: Actualizar los campos técnicos de un expediente y recalcular su estado en el semáforo.
// ------------------------------------------------------------
router.put('/:id', usuarioActivo, async (req, res) => {
  const id = req.params.id;
  const { estado, fecha_documento, fecha_vigencia, notas, no_aplica } = req.body || {};
  try {
    const expSql = `SELECT e.*, g.municipio, d.nombre as documento_nombre FROM expedientes e JOIN guarderias g ON g.id = e.guarderia_id JOIN documentos_catalogo d ON d.id = e.documento_id WHERE e.id = $1`;
    const { rows: expRows } = await pool.query(expSql, [id]);
    if (!expRows[0]) return res.status(404).json({ error: 'Expediente no encontrado' });
    const exp = expRows[0];

    const hoy = new Date().toISOString().slice(0, 10);
    let est = estado !== undefined ? estado : exp.estado;

    // Recálculo del estado según la vigencia. Se aplica si no se utiliza el estado "No Aplica".
    if (!no_aplica) {
      if (fecha_vigencia !== undefined && !esVigenciaIndeterminada(exp.documento_nombre, exp.municipio)) {
        const fv = fecha_vigencia ? (fecha_vigencia instanceof Date ? fecha_vigencia.toISOString().slice(0, 10) : String(fecha_vigencia).slice(0, 10)) : null;
        if (fv && fv < hoy) {
          est = 'vencido';
        } else if (fv) {
          const dAviso = new Date(fv);
          dAviso.setDate(dAviso.getDate() - 45);
          if (hoy >= dAviso.toISOString().slice(0, 10)) {
            est = 'por vencer';
          } else {
            est = 'vigente';
          }
        }
      }
    } else {
      est = 'vigente';
    }

    const finalEst = calcularEstadoSemaforo({ ...exp, estado: est, fecha_vigencia: (fecha_vigencia !== undefined ? fecha_vigencia : exp.fecha_vigencia), no_aplica: (no_aplica !== undefined ? no_aplica : exp.no_aplica) }, exp.municipio, exp.documento_nombre);
    
    est = finalEst;

    if (!updates_exist(estado, fecha_documento, fecha_vigencia, notas, no_aplica)) {
      return res.json(exp);
    }

    const sets = [];
    const vals = [];
    let n = 1;
    if (estado !== undefined) { sets.push(`estado = $${n++}`); vals.push(est); }
    if (fecha_documento !== undefined) { sets.push(`fecha_documento = $${n++}`); vals.push(fecha_documento || null); }
    if (fecha_vigencia !== undefined) { sets.push(`fecha_vigencia = $${n++}`); vals.push(fecha_vigencia || null); }
    if (no_aplica !== undefined) { sets.push(`no_aplica = $${n++}`); vals.push(!!no_aplica); }
    if (notas !== undefined) { sets.push(`notas = $${n++}`); vals.push(notas || ''); }
    sets.push(`usuario_id = $${n++}`, `updated_at = NOW()`);
    vals.push(req.user.id);
    vals.push(id);
    await pool.query(`UPDATE expedientes SET ${sets.join(', ')} WHERE id = $${n}`, vals);

    if (estado !== undefined && estado !== exp.estado) {
      const hisSql = `INSERT INTO historial (expediente_id, usuario_id, campo_modificado, valor_anterior, valor_nuevo) VALUES ($1, $2, 'estado', $3, $4)`;
      await pool.query(hisSql, [id, req.user.id, exp.estado, est]);
    }

    const { rows: upd } = await pool.query('SELECT * FROM expedientes WHERE id = $1', [id]);
    res.json(upd[0]);
  } catch (e) {
    console.error('[Expedientes] PUT /:id:', e.message);
    res.status(500).json({ error: 'Error al actualizar expediente' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : updates_exist
// PROPÓSITO: Verificar si existen cambios pendientes en los campos del expediente antes de procesar la actualización.
// ------------------------------------------------------------
function updates_exist(estado, fecha_documento, fecha_vigencia, notas, no_aplica) {
  return estado !== undefined || fecha_documento !== undefined || fecha_vigencia !== undefined || notas !== undefined || no_aplica !== undefined;
}

// ------------------------------------------------------------
// FUNCIÓN  : POST /:id/vaciar
// PROPÓSITO: Resetear la información de un expediente a sus valores nulos y estado vencido por defecto.
// ------------------------------------------------------------
router.post('/:id/vaciar', usuarioActivo, async (req, res) => {
  const id = req.params.id;
  try {
    const chkSql = 'SELECT * FROM expedientes WHERE id = $1';
    const { rows } = await pool.query(chkSql, [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Expediente no encontrado' });

    const updSql = `UPDATE expedientes SET oficio = '', fecha_documento = NULL, fecha_vigencia = NULL, no_aplica = FALSE, estado = 'vencido', notas = '', usuario_id = $1, updated_at = NOW() WHERE id = $2`;
    await pool.query(updSql, [req.user.id, id]);

    const { rows: upd } = await pool.query('SELECT * FROM expedientes WHERE id = $1', [id]);
    res.json(upd[0]);
  } catch (e) {
    console.error('[Expedientes] POST /:id/vaciar:', e.message);
    res.status(500).json({ error: 'Error al vaciar expediente' });
  }
});

// ------------------------------------------------------------
// FUNCIÓN  : GET /buscar
// PROPÓSITO: Realizar una búsqueda de expedientes mediante el número o nombre de guardería, o número de oficio.
// ------------------------------------------------------------
router.get('/buscar', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (q.length < 2) return res.json([]);
    const term = '%' + q + '%';
    const sql = `SELECT e.id, e.oficio, g.numero as guarderia_numero, g.nombre as guarderia_nombre, d.nombre as documento_nombre, e.estado
             FROM expedientes e JOIN guarderias g ON g.id = e.guarderia_id JOIN documentos_catalogo d ON d.id = e.documento_id
             WHERE e.oficio ILIKE $1 OR g.numero ILIKE $1 OR g.nombre ILIKE $1 LIMIT 50`;
    const { rows } = await pool.query(sql, [term]);
    res.json(rows);
  } catch (e) {
    console.error('[Expedientes] GET /buscar:', e.message);
    res.status(500).json({ error: 'Error en búsqueda' });
  }
});

module.exports = router;

