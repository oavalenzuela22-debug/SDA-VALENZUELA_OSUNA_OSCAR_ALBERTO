// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Pendientes.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Pendientes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, Upload, Eye, ArrowLeft, AlertTriangle } from 'lucide-react';

export const Pendientes = ({ guarderias, onSelectGuarderia, onChangePage, initialEstatusFilter }) => {
  const { token } = useAuth();
  const [cargas, setCargas] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Filtros reactivos
  const [filtroEncargada, setFiltroEncargada] = useState('');
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState(initialEstatusFilter || '');

  // Sincronizar filtro cuando cambia el prop initialEstatusFilter
  useEffect(() => {
    setFiltroEstatus(initialEstatusFilter || '');
  }, [initialEstatusFilter]);

  const [guarderiasList, setGuarderiasList] = useState([]);

  // Gestión de Excel
  const [encargadaPlantilla, setEncargadaPlantilla] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState('');
  const fileInputRef = useRef(null);

  // Cargar datos de pendientes y guarderías
  const fetchPendientes = async () => {
    try {
      setLoading(true);
      const [resCargas, resGuarderias] = await Promise.all([
        fetch('/api/import-export/cargas-pendientes', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        }),
        fetch('/api/guarderias', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        })
      ]);

      if (resCargas.ok) {
        const data = await resCargas.json();
        setCargas(data || []);
      }
      if (resGuarderias.ok) {
        const dataG = await resGuarderias.json();
        setGuarderiasList(dataG || []);
      }
    } catch (error) {
      console.error('Error al cargar pendientes y guarderías:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendientes();
  }, [token]);

  // Lista única de encargadas y municipios para poblar los filtros
  const encargadas = [...new Set((guarderiasList || []).flatMap(g => (g.encargada || '').split(',').map(s => s.trim())).filter(Boolean))].sort();
  const municipios = [...new Set((guarderiasList || []).map(g => g.municipio).filter(Boolean))].sort();

  // Filtrado reactivo en caliente
  const cargasFiltradas = cargas.filter(c => {
    const coincideEncargada = !filtroEncargada || (c.encargada || '').toLowerCase().includes(filtroEncargada.toLowerCase());
    const coincideMunicipio = !filtroMunicipio || c.municipio === filtroMunicipio;
    const coincideEstatus = !filtroEstatus || c.estado === filtroEstatus;
    return coincideEncargada && coincideMunicipio && coincideEstatus;
  });

  // Agrupar los pendientes filtrados por guardería
  const groupedGuarderias = {};
  cargasFiltradas.forEach(c => {
    if (!groupedGuarderias[c.guarderia_id]) {
      groupedGuarderias[c.guarderia_id] = {
        id: c.guarderia_id,
        numero: c.guarderia_numero,
        nombre: c.guarderia_nombre,
        municipio: c.municipio,
        vencido: 0,
        por_vencer: 0
      };
    }
    if (c.estado === 'vencido') {
      groupedGuarderias[c.guarderia_id].vencido++;
    } else if (c.estado === 'por vencer') {
      groupedGuarderias[c.guarderia_id].por_vencer++;
    }
  });

  const listaGuarderiasPendientes = Object.values(groupedGuarderias).filter(
    g => g.vencido > 0 || g.por_vencer > 0
  );

  // Contadores semafóricos globales de los elementos filtrados
  const vencidoCount = cargasFiltradas.filter(c => c.estado === 'vencido').length;
  const porVencerCount = cargasFiltradas.filter(c => c.estado === 'por vencer').length;

  // Descargar Plantilla Excel
  const handleDownloadPlantilla = () => {
    if (!encargadaPlantilla) {
      alert('Debe seleccionar una encargada');
      return;
    }
    const url = `/api/import-export/plantilla-encargada?encargada=${encodeURIComponent(encargadaPlantilla)}&token=${encodeURIComponent(token || '')}`;
    window.location.href = url;
  };

  // Cargar Plantilla Excel
  const handleUploadExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadResult('<span style="color:var(--muted)">Procesando archivo...</span>');

    const fd = new FormData();
    fd.append('archivo', file);

    try {
      const res = await fetch('/api/import-export/carga-encargada', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: fd
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Error en el servidor');
      }

      const data = await res.json();
      if (data.error) {
        setUploadResult(`<span style="color:var(--danger)">❌ Error: ${data.error}</span>`);
      } else {
        alert('Carga finalizada con éxito');
        let resHtml = `<div style="color:var(--ok); font-weight:600; margin-bottom:4px;">✅ Carga exitosa: ${data.encargada}</div>`;
        resHtml += `<div>• Guarderías: <strong>${data.guarderiasActualizadas}</strong> | Expedientes: <strong>${data.expedientesActualizados}</strong></div>`;
        if (data.advertencias && data.advertencias.length > 0) {
          resHtml += `<div style="margin-top:8px; max-height:100px; overflow-y:auto; border-top:1px solid var(--border); padding-top:4px;">`;
          resHtml += `<span style="color:var(--warn); font-weight:600;">⚠️ Advertencias:</span><ul style="padding-left:15px; margin-top:4px;">`;
          data.advertencias.forEach(adv => {
            resHtml += `<li style="color:var(--muted); font-size:11px;">${adv}</li>`;
          });
          resHtml += '</ul></div>';
        }
        setUploadResult(resHtml);
        fetchPendientes(); // Recargar la lista de pendientes
      }
    } catch (error) {
      setUploadResult(`<span style="color:var(--danger)">❌ Error: ${error.message}</span>`);
    } finally {
      setUploading(false);
      e.target.value = ''; // Reset file input
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Pendientes</div>
          <div className="section-sub">Documentos vencidos y próximos a vencer</div>
        </div>
        <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {/* Filtros Reactivos e Instantáneos */}
      <div className="filtros-panel">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="filtro-label">Encargada</span>
            <select 
              className="form-input filtro-select" 
              value={filtroEncargada}
              onChange={(e) => setFiltroEncargada(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="">Todas</option>
              {encargadas.map(e => (
                <option key={e} value={e}>{e}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="filtro-label">Municipio</span>
            <select 
              className="form-input filtro-select" 
              value={filtroMunicipio}
              onChange={(e) => setFiltroMunicipio(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="">Todos</option>
              {municipios.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="filtro-label">Estatus</span>
            <select 
              className="form-input filtro-select" 
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value)}
              style={{ minWidth: '140px' }}
            >
              <option value="">Todos</option>
              <option value="vencido">🔴 Vencidos</option>
              <option value="por vencer">⚠️ Por vencer</option>
            </select>
          </div>
        </div>
      </div>

      {/* Panel de Descarga y Carga de Plantilla Excel */}
      <div className="exp-section" style={{ marginTop: '1rem', borderColor: 'var(--border)', background: 'var(--s1)', padding: '15px', maxWidth: '100%' }}>
        <h5 style={{ marginBottom: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, color: 'var(--text)', fontSize: '14px' }}>
          <Download size={16} /> Plantilla
        </h5>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', width: '100%' }}>
          <select 
            className="form-input filtro-select" 
            value={encargadaPlantilla}
            onChange={(e) => setEncargadaPlantilla(e.target.value)}
            style={{ flex: 1, minWidth: '250px', width: 'auto', marginBottom: 0, height: '36px', fontSize: '13px', padding: '0 30px 0 12px' }}
          >
            <option value="">Selecciona encargada</option>
            {encargadas.map(e => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={handleDownloadPlantilla}
            style={{ height: '36px', fontSize: '13px', whiteSpace: 'nowrap', padding: '0 20px' }}
            title="Descargar Excel filtrado"
          >
            <Download size={14} /> Descargar
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleUploadExcel}
            accept=".xlsx,.xlsm" 
            style={{ display: 'none' }} 
          />
          
          <button 
            type="button" 
            className="btn btn-primary btn-sm" 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            style={{ height: '36px', fontSize: '13px', whiteSpace: 'nowrap', padding: '0 20px' }}
          >
            <Upload size={14} /> {uploading ? 'Cargando...' : 'Cargar Excel'}
          </button>
        </div>
        
        {uploadResult && (
          <div 
            id="resultadoCarga" 
            style={{ marginTop: '8px', fontSize: '11px' }}
            dangerouslySetInnerHTML={{ __html: uploadResult }}
          />
        )}
      </div>

      {/* Contadores Semafóricos */}
      <div className="alerts-dashboard">
        <div className="alerts-row alerts-danger">
          <span className="alerts-icon">🔴</span>
          <span className="alerts-text">
            <strong>{vencidoCount}</strong> vencidos
          </span>
        </div>
        <div className="alerts-row">
          <span className="alerts-icon">⚠️</span>
          <span className="alerts-text">
            <strong>{porVencerCount}</strong> por vencer
          </span>
        </div>
      </div>

      {/* Listado de Cargas */}
      {loading ? (
        <div className="loading">Cargando pendientes...</div>
      ) : listaGuarderiasPendientes.length === 0 ? (
        <div className="empty-msg">No hay cargas pendientes con los filtros aplicados.</div>
      ) : (
        <div className="exp-section">
          <div className="table-container">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Guardería</th>
                  <th>Municipio</th>
                  <th style={{ textAlign: 'right' }}>Pendientes</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {listaGuarderiasPendientes.map(g => (
                  <tr 
                    key={g.id} 
                    onClick={() => onSelectGuarderia(String(g.id))} 
                    className="row-clickable" 
                    style={{ cursor: 'pointer' }}
                  >
                    <td>{g.numero} {g.nombre}</td>
                    <td>{g.municipio}</td>
                    <td style={{ textAlign: 'right' }}>
                      {g.vencido > 0 && <span className="sec-badge badge-danger">🔴 {g.vencido}</span>}{' '}
                      {g.por_vencer > 0 && <span className="sec-badge badge-warn">⚠️ {g.por_vencer}</span>}
                    </td>
                    <td>
                      <div className="td-actions" style={{ justifyContent: 'flex-end' }}>
                        <button 
                          type="button" 
                          className="action-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectGuarderia(String(g.id));
                          }}
                        >
                          <Eye size={12} /> Ver
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
};
