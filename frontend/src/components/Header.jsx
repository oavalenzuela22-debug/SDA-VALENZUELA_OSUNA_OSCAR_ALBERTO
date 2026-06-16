// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Header.jsx
// MÓDULO    : Componente UI (React)
// PROPÓSITO : Componente de la interfaz de usuario.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Search, Sun, Moon } from 'lucide-react';

export const Header = ({ searchQuery, setSearchQuery, theme, setTheme, guarderias, onSelectGuarderia }) => {
  const { user, logout } = useAuth();
  const [time, setTime] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Efecto para el reloj en tiempo real
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      };
      // Formatear al estándar en español
      setTime(now.toLocaleDateString('es-ES', options));
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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

  // Filtrar coincidencias para el dropdown (límite de 12 por rendimiento)
  const q = searchQuery.toLowerCase().trim();
  const filteredHits = q && guarderias
    ? guarderias.filter(g =>
        (g.numero || '').toLowerCase().includes(q) ||
        (g.nombre || '').toLowerCase().includes(q) ||
        (g.municipio || '').toLowerCase().includes(q)
      ).slice(0, 12)
    : [];

  return (
    <header>
      <div className="logo" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
        <img src="/SDA.png" className="logo-img" alt="Logo SDA" />
        <span className="logo-text">SDA</span>
      </div>
      <span className="header-title">Departamento de Guarderías IMSS OOAD Sinaloa</span>
      
      <div className="header-search-wrap">
        <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
          <Search 
            size={16} 
            className="lucide-icon" 
            style={{ position: 'absolute', left: '12px', color: 'var(--muted)' }} 
          />
          <input
            type="text"
            placeholder="Buscar guardería..."
            id="headerSearchGuarderia"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setTimeout(() => setIsFocused(false), 200)}
            autoComplete="off"
            style={{ paddingLeft: '36px', width: '100%' }}
          />
          {isFocused && filteredHits.length > 0 && (
            <div className="header-search-dropdown open" style={{ display: 'block', top: '100%', left: 0, right: 0 }}>
              {filteredHits.map(g => (
                <div 
                  key={g.id} 
                  className="search-hit" 
                  onMouseDown={() => {
                    onSelectGuarderia(String(g.id));
                    setSearchQuery('');
                  }}
                >
                  <span className="search-hit-num">{g.numero || ''}</span>
                  <span className="search-hit-name">{(g.nombre || '').substring(0, 35)}</span>
                  <div className="search-hit-mun">{g.municipio || ''}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="header-right">
        <div className="header-theme">
          <button
            type="button"
            className={`header-theme-btn ${theme === 'oscuro' ? 'active' : ''}`}
            onClick={() => setTheme('oscuro')}
            title="Tema oscuro"
          >
            <Moon size={14} />
          </button>
          <button
            type="button"
            className={`header-theme-btn ${theme === 'claro' ? 'active' : ''}`}
            onClick={() => setTheme('claro')}
            title="Tema claro"
          >
            <Sun size={14} />
          </button>
        </div>
        
        {user && (
          <span className="user-badge">
            Usuario: <strong>{user.usuario}</strong>{' '}
            <span style={{ color: 'var(--muted)' }}>
              ({getNombreRol(user.rol)})
            </span>
          </span>
        )}
        
        <span id="clock" style={{ fontSize: '12px', color: 'var(--muted)', minWidth: '180px', textAlign: 'right' }}>
          {time}
        </span>
        
        <button className="btn btn-secondary" onClick={logout}>
          Cerrar sesión
        </button>
      </div>
    </header>
  );
};
