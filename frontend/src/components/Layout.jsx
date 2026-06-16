// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Layout.jsx
// MÓDULO    : Componente UI (React)
// PROPÓSITO : Componente de la interfaz de usuario.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { useAuth } from '../context/AuthContext';

export const Layout = ({ children, currentPage, onChangePage, activeGuarderiaId, onSelectGuarderia }) => {
  const { token } = useAuth();
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'claro');
  const [searchQuery, setSearchQuery] = useState('');
  const [guarderias, setGuarderias] = useState([]);
  const [loading, setLoading] = useState(true);

  // Sincronizar el tema visual
  useEffect(() => {
    document.body.dataset.theme = theme === 'claro' ? 'claro' : '';
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Cargar lista de guarderías
  const fetchPanelData = async () => {
    if (!token) return;
    try {
      const response = await fetch('/api/expedientes/panel', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setGuarderias(data.guarderias || []);
      }
    } catch (error) {
      console.error('Error al cargar panel de guarderías:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPanelData();
  }, [token]);

  // Clonar los children para inyectar datos compartidos si es necesario (ej. la lista de guarderías y refresco)
  const childrenWithProps = React.Children.map(children, child => {
    if (React.isValidElement(child)) {
      return React.cloneElement(child, { guarderias, refreshPanel: fetchPanelData });
    }
    return child;
  });

  return (
    <div id="app" className="visible">
      <Header 
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        theme={theme}
        setTheme={setTheme}
        guarderias={guarderias}
        onSelectGuarderia={onSelectGuarderia}
      />
      <div className="layout">
        <Sidebar 
          guarderias={guarderias}
          activeGuarderiaId={activeGuarderiaId}
          onSelectGuarderia={onSelectGuarderia}
          currentPage={currentPage}
          onChangePage={onChangePage}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
        />
        <main id="mainContent">
          {loading ? <div className="loading">Cargando...</div> : childrenWithProps}
        </main>
      </div>
    </div>
  );
};
