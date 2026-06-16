// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Historial.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Historial.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Eye, ArrowLeft, Trash2 } from 'lucide-react';

export const Historial = ({ guarderias, onSelectGuarderia, onChangePage }) => {
  const { token, user } = useAuth();
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros reactivos
  const [filtroGuarderia, setFiltroGuarderia] = useState('');
  const [filtroUsuario, setFiltroUsuario] = useState('');
  const [diasLimpieza, setDiasLimpieza] = useState('0');

  // Cargar historial de cambios
  const fetchHistorial = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/historial?limit=10000', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistorial(data || []);
      }
    } catch (error) {
      console.error('Error al cargar historial:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistorial();
  }, [token]);

  // Lista única de usuarios para los filtros
  const usuarios = [...new Set(historial.map(h => h.usuario_login || h.usuario_nombre).filter(Boolean))].sort();

  // Filtrado reactivo en caliente
  const historialFiltrado = historial.filter(h => {
    const coincideGuarderia = !filtroGuarderia || String(h.guarderia_id) === filtroGuarderia;
    const coincideUsuario = !filtroUsuario || (h.usuario_login || h.usuario_nombre) === filtroUsuario;
    return coincideGuarderia && coincideUsuario;
  });

  // Formatear fecha
  const formatDateDMY = (str) => {
    if (!str) return '—';
    const s = String(str).trim();
    const matchISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) {
      return `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`;
    }
    return s;
  };

  // Renderizar pills de estatus
  const renderEstadoPill = (valor) => {
    if (!valor) return '—';
    const normalized = String(valor).toLowerCase().trim().replace(/_/g, ' ');
    if (normalized === 'vigente') return <span className="status-pill pill-ok">✅ Vigente</span>;
    if (normalized === 'por vencer') return <span className="status-pill pill-warn">⚠️ Por vencer</span>;
    if (normalized === 'vencido') return <span className="status-pill pill-danger">🔴 Vencido</span>;
    return valor;
  };

  // Formatear los valores de los cambios
  const formatValor = (campo, valor) => {
    if (campo === 'estado') return renderEstadoPill(valor);
    if (campo === 'fecha_vigencia') return formatDateDMY(valor);
    return valor || '—';
  };

  // Purga técnica del historial
  const handleLimpiarHistorial = async () => {
    const n = parseInt(diasLimpieza, 10);
    const msg = n > 0 
      ? `¿Borrar registros de más de ${n} días de antigüedad?` 
      : '¿Borrar TODO el historial? PERDERÁ TODOS LOS REGISTROS DE FORMA PERMANENTE. ¿Desea continuar?';
    
    if (!window.confirm(msg)) return;

    try {
      const query = n > 0 ? `?dias=${n}` : '';
      const res = await fetch(`/api/historial${query}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Registros borrados: ${result.eliminados || 0}`);
        fetchHistorial();
      } else {
        alert('Error al borrar registros');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Historial de cambios</div>
          <div className="section-sub">Últimos cambios en expedientes</div>
        </div>
        <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {/* Filtros Reactivos e Instantáneos + Herramienta de Limpieza */}
      <div className="filtros-panel">
        <span className="filtro-label">Guardería</span>
        <select 
          className="form-input filtro-select"
          value={filtroGuarderia}
          onChange={(e) => setFiltroGuarderia(e.target.value)}
        >
          <option value="">Todas</option>
          {(guarderias || []).map(gu => (
            <option key={gu.id} value={gu.id}>
              {gu.numero} - {gu.nombre}
            </option>
          ))}
        </select>

        <span className="filtro-label">Usuario</span>
        <select 
          className="form-input filtro-select"
          value={filtroUsuario}
          onChange={(e) => setFiltroUsuario(e.target.value)}
        >
          <option value="">Todos</option>
          {usuarios.map(u => (
            <option key={u} value={u}>{u}</option>
          ))}
        </select>

        {/* Purga del historial */}
        <span style={{ marginLeft: '8px', borderLeft: '1px solid var(--border)', paddingLeft: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select 
            className="form-input filtro-select"
            value={diasLimpieza}
            onChange={(e) => setDiasLimpieza(e.target.value)}
            style={{ maxWidth: '140px', margin: 0 }}
          >
            <option value="0">Borrar todo</option>
            <option value="30">Más de 30 días</option>
            <option value="90">Más de 90 días</option>
            <option value="180">Más de 180 días</option>
          </select>
          <button 
            type="button" 
            className="btn btn-danger-outline btn-sm"
            onClick={handleLimpiarHistorial}
          >
            <Trash2 size={12} /> Borrar
          </button>
        </span>
      </div>

      {/* Listado de auditoría */}
      {loading ? (
        <div className="loading">Cargando historial...</div>
      ) : historialFiltrado.length === 0 ? (
        <div className="empty-msg">No se encontraron registros de auditoría.</div>
      ) : (
        <div className="exp-section">
          <div className="table-container">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Guardería</th>
                  <th>Documento</th>
                  <th>Campo</th>
                  <th>Antes</th>
                  <th>Después</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {historialFiltrado.map((h, idx) => {
                  const campoDisplay = h.campo_modificado === 'estado' ? 'estatus' : h.campo_modificado;
                  return (
                    <tr 
                      key={idx}
                      className="row-clickable"
                      onClick={() => {
                        sessionStorage.setItem('highlightDocumentName', h.documento_nombre);
                        onSelectGuarderia(String(h.guarderia_id));
                      }}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>
                        {formatDateDMY(h.fecha)}
                      </td>
                      <td>{h.usuario_login || h.usuario_nombre}</td>
                      <td>{h.guarderia_numero}</td>
                      <td>{(h.documento_nombre || '').substring(0, 40)}</td>
                      <td>{campoDisplay || ''}</td>
                      <td>{formatValor(h.campo_modificado, h.valor_anterior)}</td>
                      <td>{formatValor(h.campo_modificado, h.valor_nuevo)}</td>
                      <td>
                        <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                          <button 
                            type="button" 
                            className="action-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              sessionStorage.setItem('highlightDocumentName', h.documento_nombre);
                              onSelectGuarderia(String(h.guarderia_id));
                            }}
                          >
                            <Eye size={12} /> Ver
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
