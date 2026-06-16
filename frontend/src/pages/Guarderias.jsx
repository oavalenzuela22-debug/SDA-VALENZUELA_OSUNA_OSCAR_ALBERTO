// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Guarderias.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Guarderias.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Bell, Mail, FileUp, ArrowLeft, Edit2, Trash2, X } from 'lucide-react';

export const Guarderias = ({ onSelectGuarderia, onChangePage, refreshPanel }) => {
  const { token, user } = useAuth();
  const [guarderiasList, setGuarderiasList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filtros reactivos
  const [filtroMunicipio, setFiltroMunicipio] = useState('');
  const [filtroEncargada, setFiltroEncargada] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  // Modales
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGuarderia, setEditingGuarderia] = useState(null);

  // Formulario
  const [formNumero, setFormNumero] = useState('');
  const [formNombre, setFormNombre] = useState('');
  const [formMunicipio, setFormMunicipio] = useState('Culiacán');
  const [formEncargada, setFormEncargada] = useState('');
  const [formCorreosAviso, setFormCorreosAviso] = useState('');
  const [formDirector, setFormDirector] = useState('');

  const fetchGuarderias = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/guarderias?con_estados=1', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setGuarderiasList(data || []);
      }
    } catch (error) {
      console.error('Error al cargar guarderías:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGuarderias();
  }, [token]);

  // Generar listas únicas para filtros
  const municipiosList = [...new Set((guarderiasList || []).map(g => g.municipio || '').filter(Boolean))].sort();
  const encargadasList = [...new Set((guarderiasList || []).flatMap(g => (g.encargada || '').split(',')).map(e => e.trim()).filter(Boolean))].sort();

  // Filtrado reactivo en caliente
  const guarderiasFiltradas = guarderiasList.filter(g => {
    const coincideMun = !filtroMunicipio || g.municipio === filtroMunicipio;
    
    const encArray = (g.encargada || '').split(',').map(e => e.trim());
    const coincideEnc = !filtroEncargada || encArray.includes(filtroEncargada);

    const v = g.vigente || 0;
    const am = g.por_vencer || 0;
    const r = g.vencido || 0;
    
    let coincideEst = true;
    if (filtroEstado === 'vencido') coincideEst = r > 0;
    else if (filtroEstado === 'por vencer') coincideEst = am > 0;
    else if (filtroEstado === 'vigente') coincideEst = v > 0 && r === 0 && am === 0;

    return coincideMun && coincideEnc && coincideEst;
  });

  // Determinar permisos
  const rolLower = (user?.rol || '').trim().toLowerCase();
  const esAdmin = ['programador', 'programadora', 'jefe del departamento', 'jefa del departamento'].includes(rolLower);
  const puedeEditar = () => {
    const restringidos = ['invitado'];
    return !restringidos.includes(rolLower);
  };

  // Envíos masivos
  const handleEnviarMasivo = async (tipo) => {
    const label = tipo === 'resumen' ? 'Resúmenes a Todos' : 'Alertas a Todos';
    if (!window.confirm(`¿Estás seguro de enviar ${label} ahora mismo?\n\nEste proceso se realizará en segundo plano con un delay de 2 segundos entre guarderías para evitar bloqueos.`)) return;

    alert('Iniciando envío masivo...');
    try {
      const res = await fetch('/api/correo/enviar-masivo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ tipo })
      });
      const data = await res.json();
      if (data.error) {
        alert('Error: ' + data.error);
      } else {
        alert(`Envío masivo finalizado (${data.enviados} correos enviados)`);
      }
    } catch (error) {
      alert('Error de conexión al realizar el envío masivo');
    }
  };

  // Importar Directorio Excel
  const handleActualizarDirectorio = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.xlsx, .xls';
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const formData = new FormData();
      formData.append('archivo', file);

      alert('Procesando archivo...');
      try {
        const res = await fetch('/api/import-export/importar-directorio', {
          method: 'POST',
          headers: { 
            'Authorization': `Bearer ${token}`
          },
          body: formData
        });
        const data = await res.json();
        if (data.ok) {
          alert(`Directorio actualizado: ${data.actualizados} guarderías.`);
          fetchGuarderias();
          if (refreshPanel) refreshPanel();
        } else {
          alert(data.error || 'Error al importar');
        }
      } catch (error) {
        alert('Error de conexión al cargar el directorio');
      }
    };
    input.click();
  };

  // Guardar (CRUD)
  const handleSaveGuarderia = async (e) => {
    e.preventDefault();
    if (!formNumero.trim() || !formNombre.trim()) {
      alert('Número y nombre son obligatorios');
      return;
    }

    const payload = {
      numero: formNumero.trim(),
      nombre: formNombre.trim(),
      municipio: formMunicipio.trim(),
      encargada: formEncargada.trim(),
      correos_aviso: formCorreosAviso.trim(),
      director: formDirector.trim(),
      direccion: '',
      telefono: '',
      correo: ''
    };

    const id = editingGuarderia?.id;
    const url = id ? `/api/guarderias/${id}` : '/api/guarderias';
    const method = id ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert(id ? 'Guardería actualizada' : 'Guardería creada');
        setIsModalOpen(false);
        fetchGuarderias();
        if (refreshPanel) refreshPanel();
      }
    } catch (error) {
      alert('Error al guardar la guardería');
    }
  };

  // Borrado Lógico
  const handleDeleteGuarderia = async (id, nombre) => {
    if (!window.confirm(`¿Borrar la guardería "${nombre}"? Dejará de aparecer en el listado. Los expedientes se mantienen por si se reactiva.`)) return;
    try {
      const res = await fetch(`/api/guarderias/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ activo: 0 })
      });
      if (res.ok) {
        alert('Guardería borrada');
        fetchGuarderias();
        if (refreshPanel) refreshPanel();
      } else {
        alert('Error al borrar');
      }
    } catch (error) {
      alert('Error de conexión al borrar guardería');
    }
  };

  // Abrir modal creación
  const handleOpenCreateModal = () => {
    setEditingGuarderia(null);
    setFormNumero('');
    setFormNombre('');
    setFormMunicipio('Culiacán');
    setFormEncargada('');
    setFormCorreosAviso('');
    setFormDirector('');
    setIsModalOpen(true);
  };

  // Abrir modal edición
  const handleOpenEditModal = (g) => {
    setEditingGuarderia(g);
    setFormNumero(g.numero || '');
    setFormNombre(g.nombre || '');
    setFormMunicipio(g.municipio || 'Culiacán');
    setFormEncargada(g.encargada || '');
    setFormCorreosAviso(g.correos_aviso || '');
    setFormDirector(g.director || '');
    setIsModalOpen(true);
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Guarderías</div>
          <div className="section-sub">Administración de expedientes electrónicos</div>
        </div>
        <div className="section-actions" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {esAdmin && (
            <>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleEnviarMasivo('alertas')}>
                <Bell size={14} /> Enviar Alertas
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => handleEnviarMasivo('resumen')}>
                <Mail size={14} /> Enviar Resúmenes
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={handleActualizarDirectorio}>
                <FileUp size={14} /> Directorio
              </button>
            </>
          )}
          {puedeEditar() && (
            <button type="button" className="btn btn-primary btn-sm" onClick={handleOpenCreateModal}>
              + Nueva Guardería
            </button>
          )}
          <button className="btn btn-secondary btn-sm" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>

      {/* Panel de Filtros Reactivos */}
      <div className="filtros-panel" style={{ marginBottom: '16px' }}>
        <span className="filtro-label">Municipio</span>
        <select 
          className="form-input filtro-select" 
          value={filtroMunicipio} 
          onChange={(e) => setFiltroMunicipio(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">Todos</option>
          {municipiosList.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <span className="filtro-label">Encargada</span>
        <select 
          className="form-input filtro-select" 
          value={filtroEncargada} 
          onChange={(e) => setFiltroEncargada(e.target.value)}
          style={{ maxWidth: '180px' }}
        >
          <option value="">Todas</option>
          {encargadasList.map(e => (
            <option key={e} value={e}>{e}</option>
          ))}
        </select>

        <span className="filtro-label">Estatus</span>
        <select 
          className="form-input filtro-select" 
          value={filtroEstado} 
          onChange={(e) => setFiltroEstado(e.target.value)}
          style={{ maxWidth: '200px' }}
        >
          <option value="">Todas</option>
          <option value="vencido">🔴 Vencidos</option>
          <option value="por vencer">⚠️ Por vencer</option>
          <option value="vigente">✅ Vigentes</option>
        </select>
      </div>

      {/* Listado de guarderías */}
      {loading ? (
        <div className="loading">Cargando...</div>
      ) : guarderiasFiltradas.length === 0 ? (
        <div className="empty-msg">No se encontraron guarderías.</div>
      ) : (
        <div className="exp-section">
          <div className="exp-section-head" style={{ cursor: 'default' }}>
            <span className="sec-name">Listado</span>
            <span className="sec-badge badge-ok">{guarderiasFiltradas.length}</span>
          </div>

          <div className="table-container">
            <table className="docs-table">
              <thead>
                <tr>
                  <th style={{ width: '80px' }}>Clave</th>
                  <th>Nombre</th>
                  <th style={{ width: '120px' }}>Municipio</th>
                  <th style={{ width: '180px' }}>Estatus</th>
                  <th style={{ width: '200px' }}>Encargada</th>
                  <th style={{ width: '140px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {guarderiasFiltradas.map(g => {
                  const v = g.vigente || 0;
                  const am = g.por_vencer || 0;
                  const r = g.vencido || 0;

                  return (
                    <tr 
                      key={g.id} 
                      className="row-clickable" 
                      onClick={() => onSelectGuarderia(String(g.id))}
                      style={{ cursor: 'pointer' }}
                    >
                      <td style={{ fontFamily: 'var(--mono)' }}>{g.numero || ''}</td>
                      <td>{g.nombre || ''}</td>
                      <td>{g.municipio || ''}</td>
                      <td>
                        <div className="guard-estatus-badges" onClick={(e) => e.stopPropagation()}>
                          {v > 0 && <span className="sec-badge badge-ok" title="Vigentes">✅ {v}</span>}
                          {am > 0 && <span className="sec-badge badge-warn" title="Por vencer">⚠️ {am}</span>}
                          {r > 0 && <span className="sec-badge badge-danger" title="Vencidos">🔴 {r}</span>}
                          {!v && !am && !r && '—'}
                        </div>
                      </td>
                      <td>{(g.encargada || '').substring(0, 25)}</td>
                      <td>
                        <div className="td-actions">
                          <button 
                            type="button" 
                            className="action-btn btn-editar-guarderia" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(g);
                            }}
                            style={{ display: puedeEditar() ? 'inline-flex' : 'none' }}
                          >
                            <Edit2 size={12} /> Editar
                          </button>
                          <button 
                            type="button" 
                            className="action-btn btn-borrar-guarderia" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteGuarderia(g.id, g.nombre);
                            }}
                            style={{ color: 'var(--danger)', display: puedeEditar() ? 'inline-flex' : 'none' }}
                          >
                            <Trash2 size={12} /> Borrar
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

      {/* Modal: Editar/Crear Guardería */}
      {isModalOpen && (
        <div className="modal-overlay catalogo-modal open" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">
                {editingGuarderia ? 'Editar guardería' : 'Nueva guardería'}
              </span>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSaveGuarderia}>
              <div className="modal-body">
                <div className="form-row">
                  <label className="form-label">Número / Clave</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formNumero}
                    onChange={(e) => setFormNumero(e.target.value)}
                    placeholder="Ej. U-1114"
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Nombre</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Nombre del centro"
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Municipio</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formMunicipio}
                    onChange={(e) => setFormMunicipio(e.target.value)}
                    placeholder="Ej. Culiacán"
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Encargada(s)</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formEncargada}
                    onChange={(e) => setFormEncargada(e.target.value)}
                    placeholder="Ej. Ana García, Rosa López (separar por comas)"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Correos para avisos de vigencia</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formCorreosAviso}
                    onChange={(e) => setFormCorreosAviso(e.target.value)}
                    placeholder="encargada@ejemplo.com, otro@ejemplo.com"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Director(a)</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formDirector}
                    onChange={(e) => setFormDirector(e.target.value)}
                    placeholder="Director del centro"
                  />
                </div>
              </div>
              
              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary">
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
