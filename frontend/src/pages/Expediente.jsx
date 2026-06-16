// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Expediente.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Expediente.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Bell, 
  Mail, 
  ChevronRight, 
  Edit2, 
  Trash2, 
  X, 
  Save, 
  RefreshCw 
} from 'lucide-react';

export const Expediente = ({ activeGuarderiaId, onChangePage }) => {
  const { token, user } = useAuth();
  const [data, setData] = useState(null);
  const [extintores, setExtintores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [highlightDocName, setHighlightDocName] = useState('');

  useEffect(() => {
    const docName = sessionStorage.getItem('highlightDocumentName');
    if (docName) {
      setHighlightDocName(docName);
      // Mantenerlo un momento para que se note la animación/resaltado y luego limpiar
      const timer = setTimeout(() => {
        sessionStorage.removeItem('highlightDocumentName');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [activeGuarderiaId]);
  
  // Filtros y colapsables
  const [filtroEstado, setFiltroEstado] = useState('');
  const [expandedSections, setExpandedSections] = useState({});
  const [naCollapsed, setNaCollapsed] = useState(true);

  // Estados del Modal de Edición de Documento
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [modalVigencia, setModalVigencia] = useState('');
  const [modalEstado, setModalEstado] = useState('vencido');
  const [modalNoAplica, setModalNoAplica] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);

  // Estados del Modal de Extintor
  const [isExtModalOpen, setIsExtModalOpen] = useState(false);
  const [selectedExt, setSelectedExt] = useState(null);
  const [extModelo, setExtModelo] = useState('');
  const [extCapacidad, setExtCapacidad] = useState('');
  const [extUnidad, setExtUnidad] = useState('KG');
  const [extCantidad, setExtCantidad] = useState('1');
  const [extVencimiento, setExtVencimiento] = useState('');
  const [extEstatus, setExtEstatus] = useState('VIGENTE');
  const [extSaving, setExtSaving] = useState(false);

  // Determinar permisos
  const rol = (user?.rol || '').trim();
  const puedeEditar = rol.toLowerCase() !== 'invitado';
  const esAdmin = ['programador', 'programadora', 'jefe del departamento', 'jefa del departamento'].includes(rol.toLowerCase());

  // Cargar datos del expediente y extintores
  const loadExpediente = async () => {
    if (!token || !activeGuarderiaId) return;
    try {
      setLoading(true);
      const res = await fetch(`/api/expedientes/guarderia/${activeGuarderiaId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const result = await res.json();
        setData(result);

        // Inicializar secciones expandidas por defecto (todas abiertas)
        const initialExpanded = {};
        if (result.secciones) {
          result.secciones.forEach(s => {
            initialExpanded[`sec-${s.id}`] = true;
          });
        }
        setExpandedSections(initialExpanded);

        // Cargar extintores usando la clave de la guardería
        if (result.guarderia?.numero) {
          fetchExtintores(result.guarderia.numero);
        }
      }
    } catch (error) {
      console.error('Error al cargar expediente:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExtintores = async (clave) => {
    try {
      const res = await fetch(`/api/extintores/${clave}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const list = await res.json();
        setExtintores(list || []);
      }
    } catch (error) {
      console.error('Error al cargar extintores de guardería:', error);
    }
  };

  useEffect(() => {
    loadExpediente();
  }, [activeGuarderiaId, token]);

  if (loading) {
    return <div className="loading">Cargando expediente...</div>;
  }

  if (!data || !data.guarderia) {
    return <div className="empty-msg">No se pudo cargar el expediente.</div>;
  }

  const { guarderia, secciones = [] } = data;

  // Acciones rápidas por API
  const handleReenviarAlertas = async () => {
    if (!window.confirm('¿Enviar alertas de vigencia a esta guardería ahora mismo?')) return;
    alert('Enviando...');
    try {
      const res = await fetch(`/api/alertas/enviar-manual/${guarderia.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const resData = await res.json();
      if (resData.error) alert(`Error: ${resData.error}`);
      else alert(`Enviado: ${resData.enviados} documentos avisados`);
    } catch (e) {
      alert('Error de conexión');
    }
  };

  const handleEnviarResumen = async () => {
    if (!window.confirm('¿Enviar el resumen de vigencia a esta guardería ahora mismo?')) return;
    alert('Enviando resumen...');
    try {
      const res = await fetch('/api/correo/enviar-resumen-guarderia', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ guarderia_id: guarderia.id })
      });
      const resData = await res.json();
      if (resData.error) alert(`Error: ${resData.error}`);
      else alert('Resumen enviado con éxito');
    } catch (e) {
      alert('Error de conexión');
    }
  };

  // Contabilizar estatus de documentos (excepto N/A)
  let cuentaVigente = 0, cuentaPorVencer = 0, cuentaVencido = 0;
  secciones.forEach(s => (s.documentos || []).forEach(doc => {
    if (doc.no_aplica) return;
    if (doc.estado === 'vigente') cuentaVigente++;
    else if (doc.estado === 'por vencer') cuentaPorVencer++;
    else cuentaVencido++;
  }));

  // Alternar colapsado de sección
  const toggleSection = (sid) => {
    setExpandedSections(prev => ({
      ...prev,
      [sid]: !prev[sid]
    }));
  };

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

  // Calcular Días Restantes
  const getDiasRestantes = (fechaVigencia) => {
    if (!fechaVigencia) return '—';
    const hoy = new Date().toISOString().slice(0, 10);
    const fv = String(fechaVigencia).slice(0, 10);
    const diff = Math.ceil((new Date(fv) - new Date(hoy)) / (1000 * 60 * 60 * 24));
    return diff < 0 ? 'Vencido' : String(diff);
  };

  // Filtrar documentos por estatus y no_aplica
  const docsNoAplica = [];
  const getDocumentosFiltrados = (documentos) => {
    return (documentos || []).filter(doc => {
      if (doc.no_aplica) {
        if (!docsNoAplica.some(d => d.expediente_id === doc.expediente_id)) {
          docsNoAplica.push(doc);
        }
        return false;
      }
      return !filtroEstado || doc.estado === filtroEstado;
    });
  };

  // Modal: Abrir edición de documento
  const openEditModal = async (expedienteId) => {
    try {
      const res = await fetch(`/api/expedientes/uno/${expedienteId}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const exp = await res.json();
        setSelectedDoc(exp);
        setModalVigencia(exp.fecha_vigencia || '');
        setModalEstado(exp.estado || 'vencido');
        setModalNoAplica(!!exp.no_aplica);
        setIsModalOpen(true);
      }
    } catch (e) {
      alert('Error al cargar datos del documento');
    }
  };

  // Modal: Guardar cambios del documento
  const handleSaveDoc = async () => {
    if (!selectedDoc) return;
    setModalSaving(true);
    try {
      const res = await fetch(`/api/expedientes/${selectedDoc.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          estado: modalNoAplica ? 'vigente' : modalEstado,
          fecha_vigencia: modalNoAplica ? null : (modalVigencia || null),
          no_aplica: modalNoAplica
        })
      });
      if (res.ok) {
        setIsModalOpen(false);
        loadExpediente();
      } else {
        alert('Error al guardar cambios');
      }
    } catch (e) {
      alert('Error al conectar con servidor');
    } finally {
      setModalSaving(false);
    }
  };

  // Modal: Vaciar/Limpiar documento
  const handleVaciarDoc = async () => {
    if (!selectedDoc) return;
    if (!window.confirm('¿Vaciar este documento? Se borrarán vigencia, estatus y observaciones. El documento quedará como vencido.')) return;
    setModalSaving(true);
    try {
      const res = await fetch(`/api/expedientes/${selectedDoc.id}/vaciar`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        setIsModalOpen(false);
        loadExpediente();
      } else {
        alert('Error al vaciar documento');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setModalSaving(false);
    }
  };

  // Modal Extintor: Abrir creación/edición
  const openExtintorModal = (ext) => {
    if (ext) {
      setSelectedExt(ext);
      setExtModelo(ext.modelo || '');
      setExtCapacidad(ext.capacidad || '');
      setExtUnidad(ext.unidad || 'KG');
      setExtCantidad(ext.cantidad || '1');
      setExtVencimiento(ext.fecha_vencimiento ? String(ext.fecha_vencimiento).slice(0, 10) : '');
      setExtEstatus(ext.estado || 'VIGENTE');
    } else {
      setSelectedExt(null);
      setExtModelo('');
      setExtCapacidad('');
      setExtUnidad('KG');
      setExtCantidad('1');
      setExtVencimiento('');
      setExtEstatus('VIGENTE');
    }
    setIsExtModalOpen(true);
  };

  // Modal Extintor: Guardar
  const handleSaveExtintor = async () => {
    setExtSaving(true);
    const extId = selectedExt?.id;
    const url = extId ? `/api/extintores/${extId}` : `/api/extintores/${guarderia.numero}`;
    const method = extId ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          modelo: extModelo,
          capacidad: extCapacidad,
          unidad: extUnidad,
          cantidad: extCantidad || 1,
          fecha_vencimiento: extVencimiento || null
        })
      });

      if (res.ok) {
        setIsExtModalOpen(false);
        fetchExtintores(guarderia.numero);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Error al guardar extintor');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setExtSaving(false);
    }
  };

  // Modal Extintor: Eliminar
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
        fetchExtintores(guarderia.numero);
      } else {
        alert('Error al eliminar extintor');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  // Modal Extintor: Mantenimiento Rápido
  const handleMantenimientoRapido = async (extId) => {
    const defaultDate = new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString().slice(0, 10);
    const fVenc = window.prompt('Nueva fecha de vencimiento (AAAA-MM-DD):', defaultDate);
    if (!fVenc) return;

    try {
      const res = await fetch(`/api/extintores/${extId}/mantenimiento`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ultimo_mantenimiento: new Date().toISOString().slice(0, 10),
          fecha_vencimiento: fVenc
        })
      });
      if (res.ok) {
        fetchExtintores(guarderia.numero);
      } else {
        alert('Error al registrar mantenimiento');
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
            {guarderia.numero || ''} — {guarderia.nombre || ''}
          </div>
          <div className="section-sub">
            Expediente electrónico · {guarderia.municipio || ''}
            {guarderia.encargada ? ` · ${guarderia.encargada}` : ''}
          </div>
        </div>
        
        <div className="section-actions" style={{ display: 'flex', gap: '8px' }}>
          {puedeEditar && (
            <>
              <button className="btn btn-primary" onClick={handleReenviarAlertas} title="Enviar alertas de vencimiento">
                <Bell size={14} /> Enviar Alertas
              </button>
              <button className="btn btn-primary" onClick={handleEnviarResumen} title="Enviar resumen completo del expediente">
                <Mail size={14} /> Enviar Resumen
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>

      {/* Contadores */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-label">Vigentes</div>
          <div className="stat-val c-ok">{cuentaVigente}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Por vencer</div>
          <div className="stat-val c-warn">{cuentaPorVencer}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Vencidos</div>
          <div className="stat-val c-danger">{cuentaVencido}</div>
        </div>
      </div>

      {/* Filtro por Estatus - ¡INSTANTÁNEO Y REACTIVO! */}
      <div className="filtros-panel" style={{ marginBottom: '16px' }}>
        <span className="filtro-label">Ver por estatus</span>
        <select 
          className="form-input filtro-select" 
          value={filtroEstado} 
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">Todos los documentos</option>
          <option value="vigente">✅ Solo vigentes</option>
          <option value="por vencer">⚠️ Solo por vencer</option>
          <option value="vencido">🔴 Solo vencidos</option>
        </select>
      </div>

      {/* Secciones Plegables de Documentos */}
      {secciones.map(sec => {
        const filteredDocs = getDocumentosFiltrados(sec.documentos);
        const selectorSeccion = `sec-${sec.id}`;
        const isExpanded = expandedSections[selectorSeccion];

        // Contar estados de la sección
        let sOk = 0, sWarn = 0, sDanger = 0;
        (sec.documentos || []).forEach(doc => {
          if (doc.no_aplica) return;
          if (doc.estado === 'vigente') sOk++;
          else if (doc.estado === 'por vencer') sWarn++;
          else sDanger++;
        });

        // Ocultar sección completa si el filtro no devuelve elementos
        if (filtroEstado && filteredDocs.length === 0) return null;

        return (
          <div className="exp-section" key={sec.id}>
            <div className="exp-section-head" onClick={() => toggleSection(selectorSeccion)}>
              <div className={`sec-toggle ${isExpanded ? 'open' : ''}`}>
                <ChevronRight size={14} />
              </div>
              <span className="sec-name">{sec.nombre || ''}</span>
              <div className="sec-badges">
                {sOk > 0 && <span className="sec-badge badge-ok">✅ {sOk}</span>}
                {sWarn > 0 && <span className="sec-badge badge-warn">⚠️ {sWarn}</span>}
                {sDanger > 0 && <span className="sec-badge badge-danger">🔴 {sDanger}</span>}
              </div>
            </div>

            {isExpanded && (
              <div>
                <div className="table-container">
                  <table className="docs-table">
                    <thead>
                      <tr>
                        <th>Documento</th>
                        <th>Vigencia</th>
                        <th>Días restantes</th>
                        <th>Estatus</th>
                        <th className="td-actions-column">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDocs.map(doc => {
                        const pillClass = doc.estado === 'vigente' ? 'pill-ok' : doc.estado === 'por vencer' ? 'pill-warn' : 'pill-danger';
                        const pillText = doc.estado === 'vigente' ? '✅ Vigente' : doc.estado === 'por vencer' ? '⚠️ Por Vencer' : '🔴 Vencido';
                        const isHighlighted = doc.documento_nombre === highlightDocName;

                        return (
                          <tr 
                            key={doc.expediente_id}
                            style={isHighlighted ? { backgroundColor: 'rgba(18, 93, 50, 0.15)', borderLeft: '4px solid var(--imss)', transition: 'background-color 0.5s ease' } : {}}
                          >
                            <td style={{ fontWeight: 500 }}>{doc.documento_nombre || ''}</td>
                            <td>{formatDateDMY(doc.fecha_vigencia)}</td>
                            <td>{getDiasRestantes(doc.fecha_vigencia)}</td>
                            <td>
                              <span className={`status-pill ${pillClass}`}>{pillText}</span>
                            </td>
                            <td className="td-actions-column">
                              <button className="action-btn" onClick={() => openEditModal(doc.expediente_id)}>
                                <Edit2 size={12} /> Editar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* Sección Documentos No Aplicables */}
      {docsNoAplica.length > 0 && (
        <div className="exp-section" style={{ marginTop: '40px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <div className="exp-section-head" onClick={() => setNaCollapsed(!naCollapsed)}>
            <div className={`sec-toggle ${!naCollapsed ? 'open' : ''}`}>
              <ChevronRight size={14} />
            </div>
            <span className="sec-name">Documentos No Aplicables (Ocultos)</span>
            <span className="sec-badge" style={{ background: '#e5e7eb', color: '#4b5563' }}>
              ⚪ {docsNoAplica.length}
            </span>
          </div>

          {!naCollapsed && (
            <div>
              <div className="table-container">
                <table className="docs-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Vigencia</th>
                      <th>Estatus</th>
                      <th className="td-actions-column">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {docsNoAplica.map(doc => {
                      const isHighlighted = doc.documento_nombre === highlightDocName;
                      return (
                        <tr 
                          key={doc.expediente_id} 
                          className="row-na"
                          style={isHighlighted ? { backgroundColor: 'rgba(18, 93, 50, 0.15)', borderLeft: '4px solid var(--imss)', transition: 'background-color 0.5s ease' } : {}}
                        >
                          <td style={{ fontWeight: 500, color: 'var(--muted)' }}>{doc.documento_nombre || ''}</td>
                          <td style={{ color: 'var(--muted)' }}>{formatDateDMY(doc.fecha_vigencia)}</td>
                          <td>
                            <span className="status-pill pill-na">⚪ No Aplica</span>
                          </td>
                          <td className="td-actions-column">
                            <button className="action-btn" onClick={() => openEditModal(doc.expediente_id)}>
                              <Edit2 size={12} /> Recuperar / Editar
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Inventario de Extintores de la Guardería */}
      <div className="exp-section" style={{ marginTop: '30px' }}>
        <div className="exp-section-head" style={{ cursor: 'default' }}>
          <span className="sec-name">🧯 Inventario de Extintores</span>
          {puedeEditar && (
            <button className="btn btn-primary btn-sm" onClick={() => openExtintorModal(null)} style={{ fontSize: '11px', padding: '4px 10px' }}>
              + Nuevo Extintor
            </button>
          )}
        </div>
        
        <div className="table-container">
          <table className="docs-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Modelo</th>
                <th>Capacidad</th>
                <th>Unidad</th>
                <th>Cantidad</th>
                <th>Último Mant.</th>
                <th>Vencimiento</th>
                <th>Mantenimiento</th>
                {puedeEditar && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {extintores.map((e, idx) => {
                const hoy = new Date().toISOString().slice(0, 10);
                const fv = e.fecha_vencimiento || '';
                let pill = 'pill-ok', txt = '✅ Vigente';

                if (fv) {
                  const diff = Math.ceil((new Date(fv) - new Date(hoy)) / (1000 * 60 * 60 * 24));
                  if (diff < 0) { pill = 'pill-danger'; txt = '🔴 Vencido'; }
                  else if (diff <= 45) { pill = 'pill-warn'; txt = '⚠️ Por vencer'; }
                } else {
                  pill = 'pill-obs'; txt = '🔵 Sin fecha';
                }

                return (
                  <tr key={e.id}>
                    <td>{idx + 1}</td>
                    <td style={{ fontWeight: 600 }}>{e.modelo || 'N/A'}</td>
                    <td>{e.capacidad || '—'}</td>
                    <td>{e.unidad || ''}</td>
                    <td>{e.cantidad || 1}</td>
                    <td>{formatDateDMY(e.ultimo_mantenimiento)}</td>
                    <td>{formatDateDMY(fv)}</td>
                    <td>
                      <span className={`status-pill ${pill}`}>{txt}</span>
                    </td>
                    {puedeEditar && (
                      <td>
                        <div className="td-actions">
                          <button className="action-btn" onClick={() => handleMantenimientoRapido(e.id)} title="Mantenimiento de 1 año">
                            <RefreshCw size={12} />
                          </button>
                          <button className="action-btn" onClick={() => openExtintorModal(e)} title="Editar">
                            <Edit2 size={12} />
                          </button>
                          {esAdmin && (
                            <button className="action-btn" onClick={() => handleDeleteExtintor(e.id)} style={{ color: 'var(--danger)' }} title="Eliminar permanentemente">
                              <Trash2 size={12} />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
              {extintores.length === 0 && (
                <tr>
                  <td colSpan={puedeEditar ? 9 : 8} className="empty-msg">No hay extintores registrados en esta guardería.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Edición de Documento */}
      {isModalOpen && selectedDoc && (
        <div className="modal-overlay open">
          <div className="modal modal-doc">
            <div className="modal-head">
              <span className="modal-title">Editar: {selectedDoc.documento_nombre || ''}</span>
              <button className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>
            
            <div className="modal-body">
              <div className="form-row">
                <label className="form-label">Vigencia (Vencimiento)</label>
                <input 
                  type="date" 
                  className="form-input" 
                  value={modalVigencia ? String(modalVigencia).slice(0, 10) : ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setModalVigencia(val);
                    if (val) {
                      const hoy = new Date().toISOString().slice(0, 10);
                      const diff = Math.ceil((new Date(val) - new Date(hoy)) / (1000 * 60 * 60 * 24));
                      if (diff < 0) {
                        setModalEstado('vencido');
                      } else if (diff <= 45) {
                        setModalEstado('por vencer');
                      } else {
                        setModalEstado('vigente');
                      }
                    }
                  }}
                  disabled={modalNoAplica || !puedeEditar}
                />
              </div>

              <div className="form-row" style={{ marginTop: '-8px', marginBottom: '16px' }}>
                <label style={{ fontSize: '12px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--muted)' }}>
                  <input 
                    type="checkbox" 
                    checked={modalNoAplica}
                    onChange={(e) => {
                      setModalNoAplica(e.target.checked);
                      if (e.target.checked) {
                        setModalVigencia('');
                        setModalEstado('vigente');
                      }
                    }}
                    style={{ width: '16px', height: '16px' }}
                    disabled={!puedeEditar}
                  /> 
                  ¿No aplica para este documento? (N/A)
                </label>
              </div>

              <div className="form-row">
                <label className="form-label">Estatus</label>
                <select 
                  className="form-input" 
                  value={modalEstado}
                  onChange={(e) => setModalEstado(e.target.value)}
                  disabled={modalNoAplica || !puedeEditar}
                >
                  <option value="vigente">✅ Vigente / Completo</option>
                  <option value="por vencer">⚠️ Por vencer</option>
                  <option value="vencido">🔴 Vencido</option>
                </select>
              </div>
            </div>

            <div className="modal-actions">
              {puedeEditar && (
                <button type="button" className="btn btn-danger-outline" onClick={handleVaciarDoc} disabled={modalSaving}>
                  <Trash2 size={12} /> Vaciar documento
                </button>
              )}
              <div className="modal-actions-right">
                <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancelar
                </button>
                {puedeEditar && (
                  <button className="btn btn-primary" onClick={handleSaveDoc} disabled={modalSaving}>
                    <Save size={14} /> {modalSaving ? 'Guardando...' : 'Guardar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Gestión de Extintor */}
      {isExtModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">{selectedExt ? 'Editar Extintor' : 'Nuevo Extintor'}</span>
              <button className="modal-close" onClick={() => setIsExtModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              <div className="doc-form-row">
                <div className="doc-field">
                  <label className="form-label">Modelo</label>
                  <input 
                    className="form-input" 
                    placeholder="Ej. PQS ABC" 
                    value={extModelo}
                    onChange={(e) => setExtModelo(e.target.value)}
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
                      value={extCapacidad}
                      onChange={(e) => setExtCapacidad(e.target.value)}
                    />
                    <select 
                      className="form-input" 
                      value={extUnidad}
                      onChange={(e) => setExtUnidad(e.target.value)}
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
                    value={extEstatus}
                    onChange={(e) => setExtEstatus(e.target.value)}
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
                    value={extVencimiento}
                    onChange={(e) => {
                      const val = e.target.value;
                      setExtVencimiento(val);
                      if (val) {
                        const hoy = new Date().toISOString().slice(0, 10);
                        const diff = Math.ceil((new Date(val) - new Date(hoy)) / (1000 * 60 * 60 * 24));
                        if (diff < 0) {
                          setExtEstatus('VENCIDO');
                        } else if (diff <= 45) {
                          setExtEstatus('POR_VENCER');
                        } else {
                          setExtEstatus('VIGENTE');
                        }
                      }
                    }}
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
                    value={extCantidad}
                    onChange={(e) => setExtCantidad(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="modal-actions">
              <div className="modal-actions-right" style={{ marginLeft: 'auto' }}>
                <button className="btn btn-secondary" onClick={() => setIsExtModalOpen(false)}>
                  Cancelar
                </button>
                <button className="btn btn-primary" onClick={handleSaveExtintor} disabled={extSaving}>
                  <Save size={14} /> {extSaving ? 'Guardando...' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
