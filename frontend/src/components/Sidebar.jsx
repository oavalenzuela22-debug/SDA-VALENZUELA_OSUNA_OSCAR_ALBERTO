// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Sidebar.jsx
// MÓDULO    : Componente UI (React)
// PROPÓSITO : Componente de la interfaz de usuario.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ChevronRight, 
  ChevronDown, 
  Search, 
  LayoutDashboard, 
  ClipboardList, 
  History, 
  School, 
  FileText, 
  Flame, 
  Settings, 
  ScrollText, 
  Users 
} from 'lucide-react';

export const Sidebar = ({ 
  guarderias, 
  activeGuarderiaId, 
  onSelectGuarderia, 
  currentPage, 
  onChangePage,
  searchQuery,
  setSearchQuery
}) => {
  const { user } = useAuth();
  const [pinned, setPinned] = useState(localStorage.getItem('sidebarPinned') === 'true');
  const [listCollapsed, setListCollapsed] = useState(false);

  useEffect(() => {
    localStorage.setItem('sidebarPinned', pinned);
  }, [pinned]);

  const togglePin = () => setPinned(!pinned);
  const toggleList = () => setListCollapsed(!listCollapsed);

  // Filtrar guarderías según el valor de búsqueda
  const filteredGuarderias = (guarderias || []).filter(g => {
    const q = searchQuery.toLowerCase();
    return (
      (g.numero || '').toLowerCase().includes(q) ||
      (g.nombre || '').toLowerCase().includes(q) ||
      (g.municipio || '').toLowerCase().includes(q)
    );
  });

  // Determinar permisos basados en el rol
  const rol = (user?.rol || '').trim();
  const esProgramador = ['Programador', 'Programadora'].includes(rol);
  const esJefe = ['Jefe del Departamento', 'Jefa del Departamento'].includes(rol);
  const esInvitado = rol === 'Invitado';
  const esAdmin = esProgramador || esJefe;

  return (
    <aside className={pinned ? 'pinned' : ''}>
      <div className="sidebar-body">
        <div className="sidebar-peek" onClick={togglePin} title={pinned ? 'Liberar menú' : 'Fijar menú'}>
          <ChevronRight size={16} />
        </div>
        
        <div className="sidebar-inner">
          <div className="sidebar-search">
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <Search 
                size={14} 
                className="lucide-icon" 
                style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} 
              />
              <input
                type="text"
                placeholder="Buscar guardería..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '100%' }}
              />
            </div>
          </div>

          <div 
            className="sidebar-section-title" 
            onClick={toggleList}
            title="Ocultar/Mostrar lista de guarderías"
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', userSelect: 'none' }}
          >
            <span>Guarderías ({filteredGuarderias.length})</span>
            <ChevronDown 
              size={14} 
              style={{ 
                transform: listCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s'
              }} 
            />
          </div>

          <div className={`sidebar-list-wrapper ${listCollapsed ? 'collapsed' : ''}`}>
            <div className="sidebar-list">
              {filteredGuarderias.map(g => {
                const porcentaje = g.porcentaje || 0;
                const pointColor = porcentaje >= 90 && g.vencido === 0 ? 'dot-ok' : porcentaje >= 60 ? 'dot-warn' : 'dot-danger';
                const pctClass = porcentaje >= 90 ? 'pct-ok' : porcentaje >= 60 ? 'pct-warn' : 'pct-danger';
                const activeClass = activeGuarderiaId === String(g.id) ? 'active' : '';

                return (
                  <div 
                    key={g.id}
                    className={`g-item ${activeClass}`}
                    onClick={() => onSelectGuarderia(String(g.id))}
                  >
                    <div className={`g-dot ${pointColor}`}></div>
                    <span className="g-num">{g.numero || ''}</span>
                    <span className="g-mun-sidebar">{(g.municipio || '').substring(0, 22)}</span>
                    <span className={`g-pct ${pctClass}`}>{porcentaje}%</span>
                  </div>
                );
              })}
              {filteredGuarderias.length === 0 && (
                <div className="empty-msg">Sin guarderías</div>
              )}
            </div>
          </div>

          <div className="nav-extra">
            <div 
              className={`g-item ${currentPage === 'dashboard' ? 'active' : ''}`}
              onClick={() => onChangePage('dashboard')}
            >
              <span className="nav-icon"><LayoutDashboard size={14} /></span> Resumen
            </div>
            
            <div 
              className={`g-item ${currentPage === 'pendientes' ? 'active' : ''}`}
              onClick={() => onChangePage('pendientes')}
            >
              <span className="nav-icon"><ClipboardList size={14} /></span> Pendientes
            </div>
            
            <div 
              className={`g-item ${currentPage === 'historial' ? 'active' : ''}`}
              onClick={() => onChangePage('historial')}
            >
              <span className="nav-icon"><History size={14} /></span> Historial
            </div>

            {/* Configs y otros menús con visualización condicionada */}
            <div 
              className={`g-item ${currentPage === 'guarderias' ? 'active' : ''}`}
              onClick={() => onChangePage('guarderias')}
            >
              <span className="nav-icon"><School size={14} /></span> Guarderías
            </div>

            {!esInvitado && (
              <div 
                className={`g-item ${currentPage === 'catalogo' ? 'active' : ''}`}
                onClick={() => onChangePage('catalogo')}
              >
                <span className="nav-icon"><FileText size={14} /></span> Documentos
              </div>
            )}

            <div 
              className={`g-item ${currentPage === 'extintores' ? 'active' : ''}`}
              onClick={() => onChangePage('extintores')}
            >
              <span className="nav-icon"><Flame size={14} /></span> Extintores
            </div>

            {esAdmin && (
              <div 
                className={`g-item ${currentPage === 'config' ? 'active' : ''}`}
                onClick={() => onChangePage('config')}
              >
                <span className="nav-icon"><Settings size={14} /></span> Ajustes
              </div>
            )}

            {esProgramador && (
              <div 
                className={`g-item ${currentPage === 'bitacora' ? 'active' : ''}`}
                onClick={() => onChangePage('bitacora')}
              >
                <span className="nav-icon"><ScrollText size={14} /></span> Bitácora
              </div>
            )}

            {esAdmin && (
              <div 
                className={`g-item ${currentPage === 'usuarios' ? 'active' : ''}`}
                onClick={() => onChangePage('usuarios')}
              >
                <span className="nav-icon"><Users size={14} /></span> Usuarios
              </div>
            )}
          </div>
        </div>
      </div>
    </aside>
  );
};
