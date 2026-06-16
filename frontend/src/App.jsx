// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : App.jsx
// MÓDULO    : Núcleo de Aplicación (React)
// PROPÓSITO : Punto de entrada y enrutamiento principal de la interfaz.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './pages/Login';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { Expediente } from './pages/Expediente';
import { Pendientes } from './pages/Pendientes';
import { Historial } from './pages/Historial';
import { Extintores } from './pages/Extintores';
import { Catalogo } from './pages/Catalogo';
import { Ajustes } from './pages/Ajustes';
import { Bitacora } from './pages/Bitacora';
import { Usuarios } from './pages/Usuarios';
import { Guarderias } from './pages/Guarderias';

function AppContent() {
  const { user, loading } = useAuth();
  const [currentPage, setCurrentPage] = useState(() => {
    return sessionStorage.getItem('currentPage') || 'dashboard';
  });
  const [activeGuarderiaId, setActiveGuarderiaId] = useState(() => {
    return sessionStorage.getItem('activeGuarderiaId') || null;
  });
  const [initialEstatusFilter, setInitialEstatusFilter] = useState(() => {
    return sessionStorage.getItem('initialEstatusFilter') || '';
  });

  if (loading) {
    return <div className="loading">Cargando...</div>;
  }

  if (!user) {
    return <Login />;
  }

  // Manejo de la selección de guardería en la barra lateral o en las tablas
  const handleSelectGuarderia = (id) => {
    setActiveGuarderiaId(id);
    sessionStorage.setItem('activeGuarderiaId', id);
    setCurrentPage('expediente');
    sessionStorage.setItem('currentPage', 'expediente');
  };

  const handleChangePage = (pageName, filter = '') => {
    setCurrentPage(pageName);
    sessionStorage.setItem('currentPage', pageName);
    setInitialEstatusFilter(filter);
    sessionStorage.setItem('initialEstatusFilter', filter);
    setActiveGuarderiaId(null); // Resetea la guardería activa si sale a otra sección general
    sessionStorage.removeItem('activeGuarderiaId');
  };

  // Renderizar la página correspondiente según el estado de navegación
  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return (
          <Dashboard 
            onSelectGuarderia={handleSelectGuarderia}
            onChangePage={handleChangePage}
          />
        );
      case 'expediente':
        return (
          <Expediente 
            activeGuarderiaId={activeGuarderiaId}
            onChangePage={handleChangePage}
          />
        );
      case 'pendientes':
        return (
          <Pendientes 
            onSelectGuarderia={handleSelectGuarderia}
            onChangePage={handleChangePage}
            initialEstatusFilter={initialEstatusFilter}
          />
        );
      case 'historial':
        return (
          <Historial 
            onSelectGuarderia={handleSelectGuarderia}
            onChangePage={handleChangePage}
          />
        );
      case 'extintores':
        return (
          <Extintores 
            onSelectGuarderia={handleSelectGuarderia}
            onChangePage={handleChangePage}
          />
        );
      case 'catalogo':
        return (
          <Catalogo 
            onChangePage={handleChangePage}
          />
        );
      case 'config':
        return (
          <Ajustes 
            onChangePage={handleChangePage}
          />
        );
      case 'bitacora':
        return (
          <Bitacora 
            onChangePage={handleChangePage}
          />
        );
      case 'usuarios':
        return (
          <Usuarios 
            onChangePage={handleChangePage}
          />
        );
      case 'guarderias':
        return (
          <Guarderias 
            onSelectGuarderia={handleSelectGuarderia}
            onChangePage={handleChangePage}
          />
        );
      default:
        return (
          <div style={{ padding: '20px' }}>
            <div className="section-header">
              <div>
                <div className="section-title">Módulo en Desarrollo</div>
                <div className="section-sub">La sección "{currentPage}" se encuentra en proceso de migración.</div>
              </div>
              <button className="btn btn-secondary" onClick={() => handleChangePage('dashboard')}>
                Volver
              </button>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout 
      currentPage={currentPage}
      onChangePage={handleChangePage}
      activeGuarderiaId={activeGuarderiaId}
      onSelectGuarderia={handleSelectGuarderia}
    >
      {renderPage()}
    </Layout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
