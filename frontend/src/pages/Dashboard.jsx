// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Dashboard.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Dashboard.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Flame, ShieldAlert, AlertTriangle, CheckCircle } from 'lucide-react';

export const Dashboard = ({ guarderias, onSelectGuarderia, onChangePage }) => {
  const { token } = useAuth();
  const [extintoresResumen, setExtintoresResumen] = useState(null);
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  // Cargar resumen de extintores
  useEffect(() => {
    const fetchExtintoresDashboard = async () => {
      if (!token) return;
      try {
        const response = await fetch('/api/extintores/resumen-dashboard', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        if (response.ok) {
          const data = await response.json();
          setExtintoresResumen(data);
        }
      } catch (error) {
        console.error('Error al cargar resumen de extintores:', error);
      }
    };

    fetchExtintoresDashboard();
  }, [token]);

  // Obtener municipios únicos
  const municipios = [...new Set((guarderias || []).map(g => (g.municipio || '').trim()).filter(Boolean))].sort();

  // Calcular totales globales rápidos
  const totalPorVencer = (guarderias || []).reduce((acc, curr) => acc + (curr.por_vencer || 0), 0);
  const totalVencidos = (guarderias || []).reduce((acc, curr) => acc + (curr.vencido || 0), 0);

  // Filtrar guarderías en memoria
  const guarderiasFiltradas = (guarderias || []).filter(g => {
    const coincideMunicipio = !filtroMunicipio || g.municipio === filtroMunicipio;
    
    let coincideEstatus = true;
    if (filtroEstatus === 'vencido') {
      coincideEstatus = (g.vencido || 0) > 0;
    } else if (filtroEstatus === 'por vencer') {
      coincideEstatus = (g.por_vencer || 0) > 0;
    } else if (filtroEstatus === 'completo') {
      coincideEstatus = (g.vencido || 0) === 0 && (g.por_vencer || 0) === 0;
    }

    return coincideMunicipio && coincideEstatus;
  });

  // Ordenar alfabéticamente/secuencialmente por clave (ej. A-01, B-02)
  const guarderiasOrdenadas = [...guarderiasFiltradas].sort((a, b) => {
    const parseClave = (str) => {
      const match = (str || '').match(/^([A-Z])-?(\d+)$/i);
      if (match) return [match[1].toUpperCase(), parseInt(match[2], 10)];
      return [str || '', 0];
    };
    const [letraA, numA] = parseClave(a.numero);
    const [letraB, numB] = parseClave(b.numero);
    if (letraA !== letraB) return letraA.localeCompare(letraB);
    return numA - numB;
  });

  const totalExtintores = extintoresResumen 
    ? (extintoresResumen.vencidos || 0) + (extintoresResumen.por_vencer || 0) + (extintoresResumen.vigentes || 0) + (extintoresResumen.sin_fecha || 0)
    : 0;

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Resumen</div>
          <div className="section-sub">OOAD Sinaloa · Expedientes por guardería</div>
        </div>
      </div>

      {/* Tarjetas de Resumen Global */}
      <div className="dashboard-cards">
        <div 
          className="dash-card card-warn" 
          onClick={() => onChangePage('pendientes', 'por vencer')}
          style={{ borderLeft: '4px solid var(--warn)' }}
        >
          <div className="card-val">{totalPorVencer}</div>
          <div className="card-lbl">Próximos a vencer</div>
        </div>

        <div 
          className="dash-card card-danger" 
          onClick={() => onChangePage('pendientes', 'vencido')}
          style={{ borderLeft: '4px solid var(--danger)' }}
        >
          <div className="card-val">{totalVencidos}</div>
          <div className="card-lbl">Vencidos</div>
        </div>

        <div 
          className="dash-card card-danger" 
          id="cardExtintores" 
          onClick={() => onChangePage('extintores')}
          style={{ borderLeft: '4px solid var(--danger)', position: 'relative' }}
        >
          <div className="card-val">{totalExtintores || '...'}</div>
          <div className="card-lbl">🧯 Extintores</div>
          {extintoresResumen && (
            <div id="extResumenMini" style={{ fontSize: '10px', marginTop: '5px', color: 'var(--muted)' }}>
              <span className="c-danger">🔴 {extintoresResumen.vencidos || 0}</span> ·{' '}
              <span className="c-warn">⚠️ {extintoresResumen.por_vencer || 0}</span> ·{' '}
              <span className="c-ok">✅ {extintoresResumen.vigentes || 0}</span>
            </div>
          )}
        </div>
      </div>

      {/* Filtros */}
      <div className="filtros-panel">
        <span className="filtro-label">Municipio</span>
        <select 
          className="form-input filtro-select" 
          value={filtroMunicipio} 
          onChange={(e) => setFiltroMunicipio(e.target.value)}
        >
          <option value="">Todos</option>
          {municipios.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <span className="filtro-label">Estatus</span>
        <select 
          className="form-input filtro-select" 
          value={filtroEstatus} 
          onChange={(e) => setFiltroEstatus(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="vencido">🔴 Vencidos</option>
          <option value="por vencer">⚠️ Por vencer</option>
          <option value="completo">✅ Completo</option>
        </select>
      </div>

      {/* Tabla Maestra */}
      <div className="exp-section">
        <div className="exp-section-head" style={{ cursor: 'default' }}>
          <span className="sec-name">Guarderías en Sistema</span>
          <span className="sec-badge badge-ok" id="panelCount">
            {guarderiasOrdenadas.length}
          </span>
        </div>
        
        <div className="table-container">
          <table className="panel-table">
            <thead>
              <tr>
                <th style={{ width: '80px' }}>Clave</th>
                <th>Nombre</th>
                <th>Municipio</th>
                <th style={{ width: '200px', textAlign: 'right' }}>Pendientes</th>
              </tr>
            </thead>
            <tbody id="panelListBody">
              {guarderiasOrdenadas.map(gu => (
                <tr key={gu.id} onClick={() => onSelectGuarderia(String(gu.id))}>
                  <td className="g-num">{gu.numero || ''}</td>
                  <td style={{ fontWeight: 500 }}>{gu.nombre || ''}</td>
                  <td>{gu.municipio || ''}</td>
                  <td style={{ textAlign: 'right' }}>
                    <div className="panel-row-badges" style={{ justifyContent: 'flex-end', gap: '6px' }}>
                      {(gu.vencido || 0) > 0 && (
                        <span className="sec-badge badge-danger">🔴 {gu.vencido}</span>
                      )}
                      {(gu.por_vencer || 0) > 0 && (
                        <span className="sec-badge badge-warn">⚠️ {gu.por_vencer}</span>
                      )}
                      {(gu.vencido || 0) === 0 && (gu.por_vencer || 0) === 0 && (
                        <span className="sec-badge badge-ok">✅ Completo</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {guarderiasOrdenadas.length === 0 && (
                <tr>
                  <td colSpan="4" className="empty-msg">Sin guarderías registradas</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};
