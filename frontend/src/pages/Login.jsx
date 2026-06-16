// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Login.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Login.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const Login = () => {
  const { login } = useAuth();
  const [usuario, setUsuario] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(usuario, password);
    } catch (err) {
      setError(err.message || 'Error de conexión');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div id="loginPage">
      <div className="login-card">
        <h1>Sistema SDA — IMSS</h1>
        <p style={{ marginBottom: '20px' }}>Inicia sesión con tu usuario y contraseña.</p>
        <form onSubmit={handleSubmit}>
          <label className="form-label">Usuario</label>
          <input
            type="text"
            className="form-input"
            placeholder="Usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value)}
            autoComplete="username"
            required
            disabled={submitting}
          />
          <label className="form-label">Contraseña</label>
          <input
            type="password"
            className="form-input"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
            disabled={submitting}
          />
          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%' }}
            disabled={submitting}
          >
            {submitting ? 'Iniciando sesión...' : 'Iniciar sesión'}
          </button>
        </form>
        <p className="login-restricted">
          Acceso restringido · Solo personal autorizado del Departamento de Guarderías
        </p>
        {error && (
          <div className="login-error" style={{ display: 'block' }}>
            {error}
          </div>
        )}
      </div>
      <p className="login-footer">IMSS · OOAD Sinaloa · Guarderías · Uso interno 2026</p>
    </div>
  );
};
