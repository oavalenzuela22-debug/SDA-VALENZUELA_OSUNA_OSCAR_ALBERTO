// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Extintores.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Extintores.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { Download, Upload, Plus, Bell, ArrowLeft, Edit2, Trash2, X, Save, Flame } from 'lucide-react';

export const Extintores = ({ guarderias, onSelectGuarderia, onChangePage }) => {
  const { token, user } = useAuth();
  const [extintores, setExtintores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros reactivos
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroEstatus, setFiltroEstatus] = useState('');

  // Estados del Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState(null);
  const [modalClave, setModalClave] = useState('');
  const [modalModelo, setModalModelo] = useState('');
  const [modalCapacidad, setModalCapacidad] = useState('');
  const [modalUnidad, setModalUnidad] = useState('KG');
  const [modalCantidad, setModalCantidad] = useState('1');
  const [modalVencimiento, setModalVencimiento] = useState('');
  const [modalEstatus, setModalEstatus] = useState('VIGENTE');
  const [modalSaving, setModalSaving] = useState(false);

  // Gestión de importación Excel
  const [importResult, setImportResult] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  // Determinar roles
  const rol = (user?.rol || '').trim().toLowerCase();
  const puedeEditar = rol !== 'invitado';
  const esAdmin = ['programador', 'programadora', 'jefe del departamento', 'jefa del departamento'].includes(rol);

  // Cargar lista de extintores
  const fetchExtintores = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/extintores', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setExtintores(data || []);
      }
    } catch (error) {
      console.error('Error al cargar extintores:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtintores();
  }, [token]);

  // Lista única de municipios para el filtro
  const municipios = [...new Set(extintores.map(e => e.municipio).filter(Boolean))].sort();

  // Filtrado reactivo e instantáneo en caliente
  const extintoresFiltrados = extintores.filter(e => {
    const coincideMunicipio = !filtroMunicipio || e.municipio === filtroMunicipio;
    const coincideEstatus = !filtroEstatus || e.estado === filtroEstatus;
    return coincideMunicipio && coincideEstatus;
  });

  // Ordenar priorizando vencidos al inicio de la tabla
  const extintoresOrdenados = [...extintoresFiltrados].sort((a, b) => {
    if (a.estado === 'VENCIDO' && b.estado !== 'VENCIDO') return -1;
    if (a.estado !== 'VENCIDO' && b.estado === 'VENCIDO') return 1;
    return (a.dias_restantes || 0) - (b.dias_restantes || 0);
  });

  // Totales estadísticos
  const totalVencidos = extintoresFiltrados.filter(e => e.estado === 'VENCIDO').length;
  const totalPorVencer = extintoresFiltrados.filter(e => e.estado === 'POR_VENCER').length;
  const totalVigentes = extintoresFiltrados.filter(e => e.estado === 'VIGENTE').length;

  // Formatear Fecha
  const formatDateDMY = (str) => {
    if (!str) return '—';
    const s = String(str).trim();
    const matchISO = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchISO) {
      return `${matchISO[3]}/${matchISO[2]}/${matchISO[1]}`;
    }
    return s;
  };

  // Exportar Excel
  const handleExportarExcel = () => {
    window.location.href = `/api/extintores/exportar?token=${encodeURIComponent(token || '')}`;
  };

  // Importar Excel
  const handleImportarExcel = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImporting(true);
    setImportResult('<span class="loading">Procesando inventario...</span>');

    const formData = new FormData();
    formData.append('archivo', file);

    try {
      const res = await fetch('/api/extintores/importar', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await res.json();
      if (data.error) {
        setImportResult(`<span style="color:var(--danger)">❌ ${data.error}</span>`);
        alert(`Error: ${data.error}`);
      } else {
        setImportResult(`<span style="color:var(--ok)">✅ ${data.extintores_importados} extintores procesados en ${data.guarderias_afectadas} guarderías.</span>`);
        alert('Inventario de extintores actualizado con éxito');
        fetchExtintores();
      }
    } catch (err) {
      setImportResult('<span style="color:var(--danger)">❌ Error de conexión</span>');
    } finally {
      setImporting(false);
      e.target.value = '';
    }
  };

  // Enviar alertas masivas (solo Jefes/Programadores)
  const handleEnviarAlertasTodas = async () => {
    if (!window.confirm('¿Enviar alertas de extintores del día de hoy a todas las guarderías?\n\nSolo se enviarán los avisos correspondientes a hoy (vencidos hoy y avisos exactos de 15/30/45 días).')) return;
    
    alert('Enviando alertas de extintores...');
    try {
      const res = await fetch('/api/alertas/extintores/enviar-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const result = await res.json();
      if (result.error) throw new Error(result.error);
      alert(`Alertas de extintores enviadas (${result.enviados} correos)`);
    } catch (e) {
      alert('Error: ' + e.message);
    }
  };

  // Modal: Abrir edición/creación
  const openModal = (ext) => {
    if (ext) {
      setSelectedExt(ext);
      setModalClave(ext.guarderia_clave || '');
      setModalModelo(ext.modelo || '');
      setModalCapacidad(ext.capacidad || '');
      setModalUnidad(ext.unidad || 'KG');
      setModalCantidad(ext.cantidad || '1');
      setModalVencimiento(ext.fecha_vencimiento ? String(ext.fecha_vencimiento).slice(0, 10) : '');
      setModalEstatus(ext.estado || 'VIGENTE');
    } else {
      setSelectedExt(null);
      setModalClave(guarderias[0]?.numero || '');
      setModalModelo('');
      setModalCapacidad('');
      setModalUnidad('KG');
      setModalCantidad('1');
      setModalVencimiento('');
      setModalEstatus('VIGENTE');
    }
    setIsModalOpen(true);
  };

  // Modal: Guardar
  const handleSaveExtintor = async () => {
    if (!modalClave) {
      alert('Debe seleccionar una guardería');
      return;
    }
    setModalSaving(true);
    const extId = selectedExt?.id;
    const method = extId ? 'PUT' : 'POST';
    const url = extId ? `/api/extintores/${extId}` : `/api/extintores/${modalClave}`;

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelo: modalModelo,
          capacidad: modalCapacidad,
          unidad: modalUnidad,
          cantidad: modalCantidad || 1,
          fecha_vencimiento: modalVencimiento || null
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchExtintores();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al guardar extintor');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setModalSaving(false);
    }
  };

  // Modal: Eliminar
  const handleDeleteExtintor = async (extId) => {
    if (!window.confirm('¿Estás seguro de eliminar este extintor por completo?')) return;
    try {
      const res = await fetch(`/api/extintores/${extId}/permanente`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ confirmar: true })
      });
      if (res.ok) {
        fetchExtintores();
      } else {
        alert('Error al eliminar extintor');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">
            <Flame size={20} style={{ color: 'var(--danger)', verticalAlign: 'middle', marginRight: '8px' }} /> 
            Monitoreo de Extintores
          </div>
          <div className="section-sub">Resumen de vigencias en todo el estado</div>
        </div>
        
        <div className="section-actions" style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-primary btn-sm" onClick={handleExportarExcel} title="Descargar inventario completo en Excel">
            <Download size={14} /> Descargar
          </button>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            accept=".xlsx" 
            style={{ display: 'none' }} 
            onChange={handleImportarExcel}
          />
          <button className="btn btn-primary btn-sm" onClick={() => fileInputRef.current?.click()} title="Cargar inventario desde Excel (Reemplazo)">
            <Upload size={14} /> Cargar Excel
          </button>
          
          {puedeEditar && (
            <button className="btn btn-primary btn-sm" onClick={() => openModal(null)}>
              <Plus size={14} /> Nuevo Extintor
            </button>
          )}

          {esAdmin && (
            <button className="btn btn-primary btn-sm" onClick={handleEnviarAlertasTodas} title="Reenviar alertas del día de hoy a todas las guarderías">
              <Bell size={14} /> Enviar Alertas a Todos
            </button>
          )}

          <button className="btn btn-secondary btn-sm" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>

      {importResult && (
        <div id="resultadoCargaExtintores" style={{ marginBottom: '15px', fontSize: '11px' }} dangerouslySetInnerHTML={{ __html: importResult }} />
      )}

      {/* Widget de estadísticas rápidas */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Vencidos</div>
          <div className="stat-val c-danger">{totalVencidos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Por vencer</div>
          <div className="stat-val c-warn">{totalPorVencer}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vigentes</div>
          <div className="stat-val c-ok">{totalVigentes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total</div>
          <div className="stat-val c-obs" style={{ color: 'var(--text)' }}>{extintoresOrdenados.length}</div>
        </div>
      </div>

      {/* Filtros Reactivos e Instantáneos */}
      <div className="exp-section" style={{ marginBottom: '15px', padding: '15px', background: 'var(--s1)' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '10px' }}>Municipio</label>
            <select 
              className="form-input" 
              value={filtroMunicipio}
              onChange={(e) => setFiltroMunicipio(e.target.value)}
              style={{ width: '180px', marginBottom: 0 }}
            >
              <option value="">Todos</option>
              {municipios.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="form-label" style={{ fontSize: '10px' }}>Estatus</label>
            <select 
              className="form-input" 
              value={filtroEstatus}
              onChange={(e) => setFiltroEstatus(e.target.value)}
              style={{ width: '180px', marginBottom: 0 }}
            >
              <option value="">Todos</option>
              <option value="VIGENTE">✅ Vigentes</option>
              <option value="POR_VENCER">⚠️ Por vencer</option>
              <option value="VENCIDO">🔴 Vencidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabla Maestra de Extintores */}
      {loading ? (
        <div className="loading">Cargando monitoreo de extintores...</div>
      ) : (
        <div className="exp-section">
          <div className="table-container">
            <table className="docs-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Clave</th>
                  <th style={{ width: '120px' }}>Municipio</th>
                  <th>Nombre de la Guardería</th>
                  <th style={{ width: '120px' }}>Modelo</th>
                  <th style={{ width: '100px' }}>Capacidad</th>
                  <th style={{ width: '70px' }}>Unidad</th>
                  <th style={{ width: '60px' }}>Cant.</th>
                  <th style={{ width: '110px' }}>Mantenimiento</th>
                  <th style={{ width: '100px' }}>Fecha Venc.</th>
                  {puedeEditar && <th style={{ width: '90px' }}>Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {extintoresOrdenados.map(e => {
                  const pill = e.estado === 'VENCIDO' ? 'pill-danger' : e.estado === 'POR_VENCER' ? 'pill-warn' : 'pill-ok';
                  const txt = e.estado === 'VENCIDO' ? '🔴 Vencidos' : e.estado === 'POR_VENCER' ? '⚠️ Por vencer' : '✅ Vigentes';

                  return (
                    <tr key={e.id}>
                      <td 
                        style={{ fontFamily: 'var(--mono)', fontWeight: 700, color: 'var(--imss)', cursor: 'pointer' }}
                        onClick={() => onSelectGuarderia(String(e.guarderia_id || ''))}
                      >
                        {e.guarderia_clave}
                      </td>
                      <td>{e.municipio}</td>
                      <td>
                        <span style={{ fontSize: '11px' }}>{e.guarderia_nombre}</span>
                      </td>
                      <td>{e.modelo}</td>
                      <td>{e.capacidad || '—'}</td>
                      <td>{e.unidad || ''}</td>
                      <td>{e.cantidad || 1}</td>
                      <td>
                        <span className={`status-pill ${pill}`}>{txt}</span>
                      </td>
                      <td>{formatDateDMY(e.fecha_vencimiento)}</td>
                      {puedeEditar && (
                        <td>
                          <div className="td-actions">
                            <button className="action-btn" onClick={() => openModal(e)} title="Editar">
                              <Edit2 size={12} />
                            </button>
                            {esAdmin && (
                              <button className="action-btn" onClick={() => handleDeleteExtintor(e.id)} style={{ color: 'var(--danger)' }} title="Eliminar">
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
                {extintoresOrdenados.length === 0 && (
                  <tr>
                    <td colSpan={puedeEditar ? 10 : 9} className="empty-msg">No hay extintores que coincidan con la búsqueda.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal de Creación/Edición */}
      {isModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">{selectedExt ? `Editar Extintor #${selectedExt.id}` : 'Nuevo Extintor'}</span>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {!selectedExt && (
                <div className="form-row" id="row_ext_guarderia_sel">
                  <label className="form-label">Guardería Destino</label>
                  <select 
                    className="form-input" 
                    value={modalClave}
                    onChange={(e) => setModalClave(e.target.value)}
                  >
                    {(guarderias || []).map(g => (
                      <option key={g.id} value={g.numero}>
                        {g.numero} - {g.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="doc-form-row">
                <div className="doc-field">
                  <label className="form-label">Modelo</label>
                  <input 
                    className="form-input" 
                    placeholder="Ej. PQS ABC"
                    value={modalModelo}
                    onChange={(e) => setModalModelo(e.target.value)}
                  />
                </div>
                
                <div className="doc-field">
                  <label className="form-label">Capacidad</label>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input 
                      className="form-input" 
                      type="number" 
                      step="0.1" 
                      style={{ flex: 1 }} 
                      placeholder="Ej. 6.0"
                      value={modalCapacidad}
                      onChange={(e) => setModalCapacidad(e.target.value)}
                    />
                    <select 
                      className="form-input" 
                      value={modalUnidad}
                      onChange={(e) => setModalUnidad(e.target.value)}
                      style={{ width: '85px' }}
                    >
                      <option value="KG">KG</option>
                      <option value="LTS">LTS</option>
                      <option value="LB">LB</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="doc-form-row">
                <div className="doc-field">
                  <label className="form-label">Estatus</label>
                  <select 
                    className="form-input" 
                    value={modalEstatus}
                    onChange={(e) => setModalEstatus(e.target.value)}
                  >
                    <option value="VIGENTE">✅ Vigente</option>
                    <option value="POR_VENCER">⚠️ Por vencer</option>
                    <option value="VENCIDO">🔴 Vencido</option>
                  </select>
                </div>

                <div className="doc-field">
                  <label className="form-label">Fecha de Vencimiento</label>
                  <input 
                    type="date" 
                    className="form-input" 
                    value={modalVencimiento}
                    onChange={(e) => setModalVencimiento(e.target.value)}
                  />
                </div>
              </div>

              <div className="doc-form-row">
                <div className="doc-field">
                  <label className="form-label">Cantidad</label>
                  <input 
                    className="form-input" 
                    type="number" 
                    min="1" 
                    placeholder="Ej. 1"
                    value={modalCantidad}
                    onChange={(e) => setModalCantidad(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <div className="modal-actions-right" style={{ marginLeft: 'auto' }}>
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveExtintor} disabled={modalSaving}>
                  <Save size={14} /> {modalSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
