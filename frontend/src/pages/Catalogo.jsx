// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Catalogo.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Catalogo.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Plus, Edit2, Trash2, ArrowLeft, ChevronDown, X, Save } from 'lucide-react';

export const Catalogo = ({ onChangePage }) => {
  const { token } = useAuth();
  const [secciones, setSecciones] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Acordeones colapsables
  const [collapsedSections, setCollapsedSections] = useState({});

  // Estados de los Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState(''); // 'nueva-seccion', 'editar-seccion', 'nuevo-doc', 'editar-doc'
  const [selectedId, setSelectedId] = useState(null);

  // Formulario Sección
  const [seccionNombre, setSeccionNombre] = useState('');
  const [seccionOrden, setSeccionOrden] = useState('');

  // Formulario Documento
  const [docSeccionId, setDocSeccionId] = useState('');
  const [docNombre, setDocNombre] = useState('');
  const [docRequiereVigencia, setDocRequiereVigencia] = useState(true);

  const [saving, setSaving] = useState(false);

  // Cargar Catálogo (Secciones + Documentos)
  const fetchCatalogo = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const [secRes, docRes] = await Promise.all([
        fetch('/api/secciones/todas', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/documentos-catalogo/todas', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (secRes.ok && docRes.ok) {
        const secData = await secRes.json();
        const docData = await docRes.json();

        // Ordenar secciones por orden
        const sortedSec = (secData || []).sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);
        setSecciones(sortedSec);
        setDocumentos(docData || []);
      }
    } catch (error) {
      console.error('Error al cargar catálogo:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCatalogo();
  }, [token]);

  // Agrupar documentos por sección
  const docsPorSeccion = {};
  secciones.forEach(s => {
    docsPorSeccion[s.id] = [];
  });
  documentos.forEach(d => {
    if (docsPorSeccion[d.seccion_id]) {
      docsPorSeccion[d.seccion_id].push(d);
    }
  });

  // Ordenar documentos internamente por orden/id
  secciones.forEach(s => {
    if (docsPorSeccion[s.id]) {
      docsPorSeccion[s.id].sort((a, b) => (a.orden || 0) - (b.orden || 0) || a.id - b.id);
    }
  });

  // Alternar acordeón
  const toggleAccordion = (id) => {
    setCollapsedSections(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  // Modal: Abrir edición/creación de Sección
  const handleOpenSeccionModal = (sec = null) => {
    if (sec) {
      setModalMode('editar-seccion');
      setSelectedId(sec.id);
      setSeccionNombre(sec.nombre || '');
      setSeccionOrden(sec.orden ?? '');
    } else {
      setModalMode('nueva-seccion');
      setSelectedId(null);
      setSeccionNombre('');
      setSeccionOrden('');
    }
    setIsModalOpen(true);
  };

  // Modal: Abrir edición/creación de Documento
  const handleOpenDocModal = (doc = null) => {
    if (doc) {
      setModalMode('editar-doc');
      setSelectedId(doc.id);
      setDocSeccionId(String(doc.seccion_id));
      setDocNombre(doc.nombre || '');
      setDocRequiereVigencia(!!doc.requiere_vigencia);
    } else {
      setModalMode('nuevo-doc');
      setSelectedId(null);
      setDocSeccionId(secciones[0]?.id ? String(secciones[0].id) : '');
      setDocNombre('');
      setDocRequiereVigencia(true);
    }
    setIsModalOpen(true);
  };

  // Guardar Modal (Secciones / Documentos)
  const handleSave = async () => {
    setSaving(true);
    try {
      if (modalMode === 'nueva-seccion' || modalMode === 'editar-seccion') {
        if (!seccionNombre.trim()) {
          alert('Escribe el nombre de la sección');
          setSaving(false);
          return;
        }

        const payload = { 
          nombre: seccionNombre.trim(),
          orden: seccionOrden !== '' ? parseInt(seccionOrden, 10) : 0
        };
        const url = modalMode === 'editar-seccion' ? `/api/secciones/${selectedId}` : '/api/secciones';
        const method = modalMode === 'editar-seccion' ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          setIsModalOpen(false);
          fetchCatalogo();
        } else {
          const err = await res.json();
          alert(err.error || 'Error al guardar sección');
        }
      }

      if (modalMode === 'nuevo-doc' || modalMode === 'editar-doc') {
        if (!docNombre.trim()) {
          alert('Escribe el nombre del documento');
          setSaving(false);
          return;
        }
        if (!docSeccionId) {
          alert('Selecciona una sección');
          setSaving(false);
          return;
        }

        const payload = {
          seccion_id: parseInt(docSeccionId, 10),
          nombre: docNombre.trim(),
          requiere_vigencia: docRequiereVigencia
        };
        const url = modalMode === 'editar-doc' ? `/api/documentos-catalogo/${selectedId}` : '/api/documentos-catalogo';
        const method = modalMode === 'editar-doc' ? 'PUT' : 'POST';

        const res = await fetch(url, {
          method,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          setIsModalOpen(false);
          fetchCatalogo();
        } else {
          const err = await res.json();
          alert(err.error || 'Error al guardar documento');
        }
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar Documento del Catálogo
  const handleDeleteDoc = async (id, nombre) => {
    if (!window.confirm(`¿Seguro que deseas eliminar "${nombre}"? Se eliminará de todas las guarderías y se borrará su historial de cumplimiento.`)) return;

    try {
      const res = await fetch(`/api/documentos-catalogo/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        fetchCatalogo();
      } else {
        const err = await res.json();
        alert(err.error || 'Error al eliminar documento');
      }
    } catch (e) {
      alert('Error de conexión');
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Catálogo de Expedientes</div>
          <div className="section-sub">Configuración de secciones y documentos</div>
        </div>
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
          
          <button type="button" className="btn btn-primary" onClick={() => handleOpenSeccionModal(null)}>
            <Plus size={14} /> Nueva sección
          </button>
          
          <button type="button" className="btn btn-primary" onClick={() => handleOpenDocModal(null)}>
            <Plus size={14} /> Nuevo documento
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando...</div>
      ) : (
        <div className="catalogo-wrap" style={{ maxWidth: '800px', margin: '0 auto' }}>
          {secciones.map((sec, idx) => {
            const docs = docsPorSeccion[sec.id] || [];
            const isCollapsed = !!collapsedSections[sec.id];

            return (
              <div className="catalogo-card" key={sec.id}>
                <div 
                  className={`catalogo-card-head ${isCollapsed ? 'collapsed' : ''}`}
                  onClick={() => toggleAccordion(sec.id)}
                >
                  <span className="cat-chevron">
                    <ChevronDown size={14} style={{ transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                  </span>
                  <span className="sec-name">
                    {idx + 1}. {sec.nombre}
                  </span>
                  <span className="sec-meta">
                    Orden {sec.orden ?? '-'} · {docs.length} documento(s)
                  </span>
                  
                  <span className="sec-actions">
                    <button 
                      type="button" 
                      className="btn btn-secondary btn-sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOpenSeccionModal(sec);
                      }}
                      title="Editar sección"
                    >
                      <Edit2 size={12} /> Editar
                    </button>
                  </span>
                </div>

                {!isCollapsed && (
                  <div className="catalogo-card-body">
                    {docs.map(d => (
                      <div className="catalogo-doc-row" key={d.id}>
                        <span className="doc-name">{d.nombre}</span>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button 
                            type="button" 
                            className="action-btn doc-edit" 
                            onClick={() => handleOpenDocModal(d)}
                            title="Editar documento"
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          
                          <button 
                            type="button" 
                            className="action-btn doc-delete" 
                            onClick={() => handleDeleteDoc(d.id, d.nombre)}
                            title="Eliminar documento"
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    ))}
                    {docs.length === 0 && (
                      <div className="catalogo-doc-row" style={{ color: 'var(--muted)', fontSize: '12px' }}>
                        Sin documentos en esta sección.
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {secciones.length === 0 && (
            <div className="empty-msg" style={{ textAlign: 'center', padding: '24px' }}>
              Aún no hay secciones en el catálogo. Crea una con «Nueva sección».
            </div>
          )}
        </div>
      )}

      {/* Modal CRUD Catálogo */}
      {isModalOpen && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-head">
              <span className="modal-title">
                {modalMode === 'nueva-seccion' && 'Nueva sección'}
                {modalMode === 'editar-seccion' && 'Editar sección'}
                {modalMode === 'nuevo-doc' && 'Nuevo documento'}
                {modalMode === 'editar-doc' && 'Editar documento'}
              </span>
              <button type="button" className="modal-close" onClick={() => setIsModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-body">
              {/* Formulario de Sección */}
              {(modalMode === 'nueva-seccion' || modalMode === 'editar-seccion') && (
                <>
                  <div className="form-row">
                    <label className="form-label">Nombre</label>
                    <input 
                      className="form-input" 
                      placeholder="Ej. ANEXO 1" 
                      value={seccionNombre}
                      onChange={(e) => setSeccionNombre(e.target.value)}
                    />
                  </div>
                  <div className="form-row">
                    <label className="form-label">Orden</label>
                    <input 
                      className="form-input" 
                      type="number" 
                      min="0" 
                      placeholder="1"
                      value={seccionOrden}
                      onChange={(e) => setSeccionOrden(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* Formulario de Documento */}
              {(modalMode === 'nuevo-doc' || modalMode === 'editar-doc') && (
                <>
                  <div className="form-row">
                    <label className="form-label">Sección</label>
                    <select 
                      className="form-input"
                      value={docSeccionId}
                      onChange={(e) => setDocSeccionId(e.target.value)}
                    >
                      {secciones.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="form-row">
                    <label className="form-label">Nombre del documento</label>
                    <input 
                      className="form-input" 
                      placeholder="Ej. Licencia de uso de suelo"
                      value={docNombre}
                      onChange={(e) => setDocNombre(e.target.value)}
                    />
                  </div>

                  <div className="form-row" style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={docRequiereVigencia}
                        onChange={(e) => setDocRequiereVigencia(e.target.checked)}
                      /> 
                      Requiere vigencia
                    </label>
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
                <Save size={14} /> {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
