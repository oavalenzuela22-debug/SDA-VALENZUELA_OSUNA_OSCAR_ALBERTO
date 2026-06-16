// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Usuarios.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Usuarios.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Edit2, Trash2, ArrowLeft, X } from 'lucide-react';

export const Usuarios = ({ onChangePage }) => {
  const { token } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado del modal de usuario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // null significa nuevo usuario

  // Valores de formulario
  const [formNombre, setFormNombre] = useState('');
  const [formUsuario, setFormUsuario] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formRol, setFormRol] = useState('Colaborador del Departamento de Guarderías');
  const [formArea, setFormArea] = useState('');
  const [formCorreo, setFormCorreo] = useState('');
  const [formActivo, setFormActivo] = useState(true);

  // Cargar lista de usuarios
  const fetchUsers = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/usuarios', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data || []);
      }
    } catch (error) {
      console.error('Error al cargar usuarios:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [token]);

  // Traducir roles técnicos a amigables
  const getNombreRol = (r) => {
    const rol = (r || '').trim();
    const rolesMap = {
      'programador': 'Programador',
      'programadora': 'Programadora',
      'jefe del departamento': 'Jefe del Departamento',
      'jefa del departamento': 'Jefa del Departamento',
      'colaborador del departamento de guarderías': 'Colaborador del Departamento de Guarderías',
      'invitado': 'Invitado'
    };
    return rolesMap[rol.toLowerCase()] || rol || 'Invitado';
  };

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

  // Abrir modal para crear
  const handleOpenNewModal = () => {
    setEditingUser(null);
    setFormNombre('');
    setFormUsuario('');
    setFormPassword('');
    setFormRol('Colaborador del Departamento de Guarderías');
    setFormArea('');
    setFormCorreo('');
    setFormActivo(true);
    setIsModalOpen(true);
  };

  // Abrir modal para editar
  const handleOpenEditModal = (u) => {
    setEditingUser(u);
    setFormNombre(u.nombre || '');
    setFormUsuario(u.usuario || '');
    setFormPassword('');
    setFormRol(u.rol || 'Colaborador del Departamento de Guarderías');
    setFormArea(u.area_adscripcion || '');
    setFormCorreo(u.correo || '');
    setFormActivo(u.activo !== false);
    setIsModalOpen(true);
  };

  // Guardar usuario (Crear/Editar)
  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!formNombre.trim()) {
      alert('Nombre requerido');
      return;
    }
    if (!formUsuario.trim()) {
      alert('Usuario requerido');
      return;
    }
    if (formUsuario.trim().length < 2) {
      alert('El usuario debe poseer al menos 2 caracteres');
      return;
    }
    if (!editingUser && (!formPassword || formPassword.length < 6)) {
      alert('La contraseña requiere un mínimo de 6 caracteres');
      return;
    }

    const payload = {
      nombre: formNombre.trim(),
      usuario: formUsuario.trim().toLowerCase(),
      rol: formRol,
      correo: formCorreo.trim(),
      area_adscripcion: formArea.trim()
    };

    if (formPassword) {
      payload.password = formPassword;
    }

    if (editingUser) {
      payload.activo = formActivo;
    }

    const url = editingUser ? `/api/usuarios/${editingUser.id}` : '/api/usuarios';
    const method = editingUser ? 'PUT' : 'POST';

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
        return;
      }

      alert(editingUser ? 'Usuario actualizado' : 'Usuario creado');
      setIsModalOpen(false);
      fetchUsers();
    } catch (error) {
      alert('Error al procesar el guardado');
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (id, login) => {
    if (login === 'admin') {
      alert('No se puede eliminar el usuario administrador principal');
      return;
    }
    if (!window.confirm(`¿Seguro que desea eliminar al usuario "${login}"?`)) return;

    try {
      const res = await fetch(`/api/usuarios/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        alert('Usuario eliminado');
        fetchUsers();
      }
    } catch (error) {
      alert('Error al procesar la eliminación');
    }
  };

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Usuarios</div>
          <div className="section-sub">Gestión de acceso al sistema</div>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button type="button" className="btn btn-primary" onClick={handleOpenNewModal}>
            + Nuevo usuario
          </button>
          <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
            <ArrowLeft size={14} /> Volver
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading">Cargando usuarios...</div>
      ) : (
        <div className="exp-section">
          <div className="exp-section-head" style={{ cursor: 'default' }}>
            <span className="sec-name">Listado</span>
            <span className="sec-badge badge-ok">{users.length}</span>
          </div>
          
          <div className="table-container">
            <table className="docs-table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Nombre</th>
                  <th>Rol</th>
                  <th>Área</th>
                  <th>Última sesión</th>
                  <th>Activo</th>
                  <th style={{ width: '80px' }}></th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  let rClass = '';
                  const rolLower = (u.rol || '').toLowerCase();
                  if (rolLower === 'programador' || rolLower === 'programadora') rClass = 'badge-danger';
                  else if (rolLower === 'jefe del departamento' || rolLower === 'jefa del departamento') rClass = 'badge-jefe';
                  else if (rolLower === 'colaborador del departamento de guarderías' || rolLower === 'colaborador del departamento de guarderias') rClass = 'badge-admin';
                  else if (rolLower === 'invitado') rClass = 'badge-obs';

                  return (
                    <tr key={u.id}>
                      <td style={{ fontFamily: 'var(--mono)', fontWeight: 500 }}>{u.usuario || ''}</td>
                      <td>{u.nombre || ''}</td>
                      <td>
                        <span className={`sec-badge ${rClass}`}>
                          {getNombreRol(u.rol)}
                        </span>
                      </td>
                      <td>{u.area_adscripcion || '—'}</td>
                      <td style={{ fontSize: '11px', color: 'var(--muted)' }}>
                        {formatDateDMY(u.ultima_sesion) || '—'}
                      </td>
                      <td>
                        {u.activo !== false ? (
                          <span style={{ color: 'var(--ok)' }}>Sí</span>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>No</span>
                        )}
                      </td>
                      <td>
                        <div className="td-actions">
                          <button 
                            type="button" 
                            className="action-btn"
                            onClick={() => handleOpenEditModal(u)}
                            title="Editar usuario"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            type="button" 
                            className="action-btn"
                            onClick={() => handleDeleteUser(u.id, u.usuario)}
                            style={{ color: 'var(--danger)' }}
                            title="Eliminar usuario"
                          >
                            <Trash2 size={12} />
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

      {/* Modal: Gestión de Usuarios del Sistema */}
      {isModalOpen && (
        <div className="modal-overlay catalogo-modal open" onClick={() => setIsModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <span className="modal-title">
                {editingUser ? 'Editar usuario' : 'Nuevo usuario'}
              </span>
              <button 
                type="button" 
                className="modal-close" 
                onClick={() => setIsModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleSaveUser}>
              <div className="modal-body">
                <div className="form-row">
                  <label className="form-label">Nombre completo</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formNombre}
                    onChange={(e) => setFormNombre(e.target.value)}
                    placeholder="Ej. María López García"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Usuario</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formUsuario}
                    onChange={(e) => setFormUsuario(e.target.value)}
                    placeholder="Identificador de acceso"
                    readOnly={!!editingUser}
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Contraseña</label>
                  <input 
                    type="password"
                    className="form-input" 
                    value={formPassword}
                    onChange={(e) => setFormPassword(e.target.value)}
                    placeholder={editingUser ? 'Dejar vacío para no cambiar' : 'Mínimo 6 caracteres'}
                    required={!editingUser}
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Rol</label>
                  <select 
                    className="form-input"
                    value={formRol}
                    onChange={(e) => setFormRol(e.target.value)}
                  >
                    <option value="Programador">Programador</option>
                    <option value="Programadora">Programadora</option>
                    <option value="Jefe del Departamento">Jefe del Departamento</option>
                    <option value="Jefa del Departamento">Jefa del Departamento</option>
                    <option value="Colaborador del Departamento de Guarderías">
                      Colaborador del Departamento de Guarderías
                    </option>
                    <option value="Invitado">Invitado</option>
                  </select>
                </div>
                
                <div className="form-row">
                  <label className="form-label">Área de adscripción</label>
                  <input 
                    type="text"
                    className="form-input" 
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    placeholder="Ej. Supervisión de Guarderías"
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Correo (opcional)</label>
                  <input 
                    type="email"
                    className="form-input" 
                    value={formCorreo}
                    onChange={(e) => setFormCorreo(e.target.value)}
                    placeholder="usuario@ejemplo.com"
                  />
                </div>
                
                {editingUser && (
                  <div className="form-row">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                      <input 
                        type="checkbox" 
                        checked={formActivo}
                        onChange={(e) => setFormActivo(e.target.checked)}
                      />
                      Usuario activo
                    </label>
                  </div>
                )}
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
