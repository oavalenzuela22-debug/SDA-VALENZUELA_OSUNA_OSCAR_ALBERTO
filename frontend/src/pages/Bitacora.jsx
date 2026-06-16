// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Bitacora.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Bitacora.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, Trash2, ArrowLeft } from 'lucide-react';

export const Bitacora = ({ onChangePage }) => {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros reactivos
  const [filtroNivel, setFiltroNivel] = useState('');
  const [filtroModulo, setFiltroModulo] = useState('');

  // Cargar registros de la bitácora
  const fetchLogs = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/logs?_=${Date.now()}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setLogs(data || []);
      }
    } catch (error) {
      console.error('Error al cargar la bitácora:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [token]);

  // Lista única de módulos para los filtros
  const modulos = [...new Set((logs || []).map(l => l.modulo).filter(Boolean))].sort();

  // Filtrado reactivo en caliente
  const logsFiltrados = logs.filter(l => {
    const coincideNivel = !filtroNivel || l.nivel === filtroNivel;
    const coincideModulo = !filtroModulo || l.modulo === filtroModulo;
    return coincideNivel && coincideModulo;
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

  // Limpiar/Borrar bitácora
  const handleLimpiarLogs = async () => {
    if (!window.confirm('¿Estás seguro de borrar TODA la bitácora del sistema? Esta acción no se puede deshacer.')) return;

    try {
      const res = await fetch('/api/logs/limpiar', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        alert('Bitácora borrada');
        fetchLogs();
      } else {
        alert('Error al borrar la bitácora');
      }
    } catch (error) {
      alert('Error de conexión');
    }
  };

  // Descargar bitácora como CSV
  const descargarLogsCSV = () => {
    if (!logs || !logs.length) {
      alert('No hay registros para descargar');
      return;
    }
    const headers = ['Timestamp', 'Nivel', 'Modulo', 'Usuario', 'Accion', 'Status', 'Detalles'];
    const rows = logs.map(l => [
      l.timestamp,
      l.nivel,
      l.modulo,
      l.usuario_nombre || 'SISTEMA',
      l.accion,
      l.status,
      JSON.stringify(l.detalles || {})
    ]);
    
    let csvContent = "\uFEFF"; // BOM para asegurar codificación UTF-8 en Excel
    csvContent += headers.join(",") + "\n";
    rows.forEach(row => {
      csvContent += row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(",") + "\n";
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bitacora_sda_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Bitácora del Programador</div>
          <div className="section-sub">Eventos de sistema, errores y auditoría técnica</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={descargarLogsCSV}>
            <Download size={14} /> Descargar (CSV)
          </button>
          <button type="button" className="btn btn-danger-outline btn-sm" onClick={handleLimpiarLogs}>
            <Trash2 size={14} /> Borrar bitácora
          </button>
          <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>

      {/* Filtros Reactivos e Instantáneos */}
      <div className="filtros-panel">
        <span className="filtro-label">Nivel</span>
        <select 
          className="form-input filtro-select"
          value={filtroNivel}
          onChange={(e) => setFiltroNivel(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="INFORMATIVO">INFORMATIVO</option>
          <option value="ADVERTENCIA">ADVERTENCIA</option>
          <option value="CRÍTICO">CRÍTICO</option>
        </select>

        <span className="filtro-label">Módulo</span>
        <select 
          className="form-input filtro-select"
          value={filtroModulo}
          onChange={(e) => setFiltroModulo(e.target.value)}
        >
          <option value="">Todos</option>
          {modulos.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      {/* Tabla de logs */}
      {loading ? (
        <div className="loading">Cargando bitácora del sistema...</div>
      ) : logsFiltrados.length === 0 ? (
        <div className="empty-msg">No se encontraron registros en la bitácora.</div>
      ) : (
        <div className="exp-section">
          <div className="table-container">
            <table className="docs-table" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th style={{ width: '160px' }}>Timestamp</th>
                  <th style={{ width: '110px' }}>Nivel</th>
                  <th style={{ width: '90px' }}>Módulo</th>
                  <th style={{ width: '100px' }}>Usuario</th>
                  <th>Mensaje / Detalles</th>
                  <th style={{ width: '100px' }}>Estado</th>
                </tr>
              </thead>
              <tbody>
                {logsFiltrados.map((l, index) => {
                  const levelClass = l.nivel === 'CRÍTICO' ? 'badge-danger' : l.nivel === 'ADVERTENCIA' ? 'badge-warn' : 'badge-ok';
                  const statusPill = l.status === 'FAILURE' ? 'pill-danger' : l.status === 'SUCCESS' ? 'pill-ok' : l.status === 'PENDING' ? 'pill-warn' : '';
                  const metaStr = l.detalles ? JSON.stringify(l.detalles, null, 2) : '';

                  return (
                    <tr key={l.id || index}>
                      <td style={{ fontFamily: 'var(--mono)', fontSize: '11px' }}>
                        {formatDateDMY(l.timestamp)} {new Date(l.timestamp).toLocaleTimeString()}
                      </td>
                      <td>
                        <span className={`sec-badge ${levelClass}`} style={{ width: '100%', justifyContent: 'center' }}>
                          {l.nivel}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600, fontSize: '11px', textAlign: 'center' }}>{l.modulo}</td>
                      <td style={{ fontSize: '11px' }}>{l.usuario_nombre || 'SISTEMA'}</td>
                      <td style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.accion || ''}>
                        <div style={{ fontWeight: 600 }}>{l.accion || ''}</div>
                        <div style={{ color: 'var(--muted)', fontSize: '10px', fontFamily: 'var(--mono)' }}>
                          {metaStr.substring(0, 100)}{metaStr.length > 100 ? '...' : ''}
                        </div>
                      </td>
                      <td>
                        <span className={`status-pill ${statusPill}`} style={{ width: '100%', justifyContent: 'center' }}>
                          {l.status || ''}
                        </span>
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
