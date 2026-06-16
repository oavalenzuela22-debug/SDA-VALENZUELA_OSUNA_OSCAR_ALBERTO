// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : Ajustes.jsx
// MÓDULO    : Vista/Página (React)
// PROPÓSITO : Vista principal para el módulo de Ajustes.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ArrowLeft, 
  Mail, 
  Flame, 
  Clock, 
  Send, 
  RefreshCw, 
  Bell, 
  Save, 
  FolderOpen,
  Database
} from 'lucide-react';

export const Ajustes = ({ onChangePage }) => {
  const { token, user } = useAuth();
  const [loading, setLoading] = useState(true);

  // Estados del Formulario de Configuración
  const [autoCorreo, setAutoCorreo] = useState(false);
  const [autoCorreoExtintores, setAutoCorreoExtintores] = useState(false);
  const [avisoHora, setAvisoHora] = useState(8);
  const [diasAviso45, setDiasAviso45] = useState(45);
  const [diasAviso30, setDiasAviso30] = useState(30);
  const [diasAviso15, setDiasAviso15] = useState(15);

  // Plantillas de Correo
  const [asuntoGeneral, setAsuntoGeneral] = useState('');
  const [cuerpoGeneral, setCuerpoGeneral] = useState('');
  const [asuntoResumen, setAsuntoResumen] = useState('');
  const [cuerpoResumen, setCuerpoResumen] = useState('');
  const [asuntoExtintores, setAsuntoExtintores] = useState('');
  const [cuerpoExtintores, setCuerpoExtintores] = useState('');

  // Estados de proceso
  const [savingConfig, setSavingConfig] = useState(false);
  const [updatingEstados, setUpdatingEstados] = useState(false);
  const [runningMotor, setRunningMotor] = useState(false);
  const [msgEstados, setMsgEstados] = useState('');
  const [msgRespaldo, setMsgRespaldo] = useState('');
  const [respaldoLoading, setRespaldoLoading] = useState(false);

  // Cargar configuración
  const fetchConfig = async () => {
    if (!token) return;
    try {
      setLoading(true);
      const res = await fetch('/api/configuracion', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const config = await res.json();
        setAutoCorreo(config.auto_correo === '1');
        setAutoCorreoExtintores(config.auto_correo_extintores === '1');
        setAvisoHora(parseInt(config.aviso_hora || '8', 10));
        setDiasAviso45(config.dias_aviso_45 || '45');
        setDiasAviso30(config.dias_aviso_30 || '30');
        setDiasAviso15(config.dias_aviso_15 || '15');

        setAsuntoGeneral(config.plantilla_asunto_general || '');
        setCuerpoGeneral(config.plantilla_cuerpo_general || '');
        setAsuntoResumen(config.plantilla_asunto_resumen || '');
        setCuerpoResumen(config.plantilla_cuerpo_resumen || '');
        setAsuntoExtintores(config.plantilla_asunto_extintores || '');
        setCuerpoExtintores(config.plantilla_cuerpo_extintores || '');
      }
    } catch (e) {
      console.error('Error al cargar configuración:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, [token]);

  // Guardar configuración general
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const res = await fetch('/api/configuracion', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          auto_correo: autoCorreo ? '1' : '0',
          auto_correo_extintores: autoCorreoExtintores ? '1' : '0',
          aviso_hora: String(avisoHora),
          aviso_dias: '0,1,2,3,4,5,6',
          dias_aviso_45: String(diasAviso45),
          dias_aviso_30: String(diasAviso30),
          dias_aviso_15: String(diasAviso15),
          plantilla_asunto_general: asuntoGeneral,
          plantilla_cuerpo_general: cuerpoGeneral,
          plantilla_asunto_resumen: asuntoResumen,
          plantilla_cuerpo_resumen: cuerpoResumen,
          plantilla_asunto_extintores: asuntoExtintores,
          plantilla_cuerpo_extintores: cuerpoExtintores
        })
      });

      if (res.ok) {
        alert('Configuración guardada exitosamente');
      } else {
        alert('Error al guardar configuración');
      }
    } catch (e) {
      alert('Error de conexión');
    } finally {
      setSavingConfig(false);
    }
  };

  // Probar plantilla de correo
  const handleProbarPlantilla = async (tipo, label) => {
    let asunto = '';
    let cuerpo = '';

    if (tipo === 'general') {
      asunto = asuntoGeneral;
      cuerpo = cuerpoGeneral;
    } else if (tipo === 'resumen') {
      asunto = asuntoResumen;
      cuerpo = cuerpoResumen;
    } else if (tipo === 'extintores') {
      asunto = asuntoExtintores;
      cuerpo = cuerpoExtintores;
    }

    if (!asunto || !cuerpo) {
      alert('Asunto y cuerpo son requeridos para realizar la prueba');
      return;
    }

    alert(`Enviando prueba de plantilla: ${label}...`);
    try {
      const res = await fetch('/api/alertas/prueba-plantilla', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ asunto, cuerpo, label: `PRUEBA ${label}` })
      });
      const data = await res.json();
      if (data.error) alert(`Error: ${data.error}`);
      else alert('Correo de prueba enviado con éxito');
    } catch (e) {
      alert('Error de conexión');
    }
  };

  // Actualizar Estados Semáforo Manual
  const handleActualizarEstados = async () => {
    setUpdatingEstados(true);
    setMsgEstados('Actualizando semáforos...');
    try {
      const res = await fetch('/api/alertas/actualizar-estados', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMsgEstados(`Actualizados con éxito: ${data.actualizados || 0}`);
        alert('Estatus semafóricos actualizados en el sistema');
      } else {
        setMsgEstados('Error al actualizar');
      }
    } catch (e) {
      setMsgEstados('Error de red');
    } finally {
      setUpdatingEstados(false);
    }
  };

  // Ejecutar Motor de Alertas Ahora
  const handleEjecutarMotor = async () => {
    if (!window.confirm('¿Estás seguro de ejecutar el motor de alertas ahora mismo?')) return;
    setRunningMotor(true);
    setMsgEstados('Ejecutando motor de envío...');
    try {
      const res = await fetch('/api/alertas/enviar-ahora', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      if (res.ok) {
        const data = await res.json();
        setMsgEstados(`Motor ejecutado: ${data.enviados || 0} avisos enviados.`);
        alert('Motor de alertas completado exitosamente');
      } else {
        setMsgEstados('Error al ejecutar motor');
      }
    } catch (e) {
      setMsgEstados('Error de red');
    } finally {
      setRunningMotor(false);
    }
  };

  // Generar Respaldo Base de Datos
  const handleGenerarRespaldo = async () => {
    const isElectron = typeof window.electronAPI !== 'undefined';
    let path = null;

    if (isElectron) {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10);
      const defaultName = `SDA_Respaldo_${dateStr}.dump`;
      path = await window.electronAPI.selectSavePath(defaultName);
      if (!path) return;
    } else {
      const confirmRespaldo = window.confirm(
        "Estás en modo web. El respaldo se guardará automáticamente en la carpeta 'backups' del servidor. ¿Deseas continuar?"
      );
      if (!confirmRespaldo) return;
    }

    setRespaldoLoading(true);
    setMsgRespaldo('Procesando copia de seguridad...');

    try {
      const res = await fetch('/api/configuracion/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ customPath: path })
      });

      const data = await res.json();
      if (data.ok) {
        setMsgRespaldo(isElectron ? 'Copia de seguridad guardada con éxito.' : `Guardado en el servidor: ${data.ruta}`);
        alert('Respaldo finalizado correctamente');
      } else {
        setMsgRespaldo(`Error: ${data.error}`);
        alert(`Error al generar respaldo: ${data.error}`);
      }
    } catch (e) {
      setMsgRespaldo('Error de red al respaldar');
    } finally {
      setRespaldoLoading(false);
    }
  };

  // Restaurar Respaldo Base de Datos
  const handleCargarRespaldo = async () => {
    const isElectron = typeof window.electronAPI !== 'undefined';
    let path = null;

    if (isElectron) {
      path = await window.electronAPI.selectOpenPath();
      if (!path) return;
    } else {
      // Modo web: Pedir lista de respaldos al servidor
      try {
        const listRes = await fetch('/api/configuracion/backups-list', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          }
        });
        const list = await listRes.json();
        if (!list || list.length === 0) {
          alert("No hay respaldos disponibles en la carpeta 'backups' del servidor.");
          return;
        }

        let options = "Selecciona el respaldo a restaurar (escribe el número):\n\n";
        list.forEach((f, i) => {
          options += `${i + 1}. ${f.nombre} (${new Date(f.fecha).toLocaleString()})\n`;
        });

        const choice = window.prompt(options);
        if (choice === null) return;
        const idx = parseInt(choice, 10) - 1;
        if (list[idx]) {
          path = list[idx].ruta;
        } else {
          alert('Opción inválida');
          return;
        }
      } catch (e) {
        alert('Error al conectar con servidor');
        return;
      }
    }

    const confirmRestore = window.confirm(
      "¡ADVERTENCIA CRÍTICA!\n\nSe SOBRESCRIBIRÁN los datos actuales de la aplicación.\n\n¿Deseas continuar?"
    );
    if (!confirmRestore) return;

    const generatePreventive = window.confirm(
      "¿Deseas generar una copia de seguridad (respaldo preventivo) de la base de datos actual antes de realizar la restauración?"
    );

    setRespaldoLoading(true);
    setMsgRespaldo('Restaurando copia de seguridad...');

    try {
      const res = await fetch('/api/configuracion/restore', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ filePath: path, skipBackup: !generatePreventive })
      });

      const data = await res.json();
      if (data.ok) {
        setMsgRespaldo('Restauración completada con éxito. Reiniciando...');
        alert('Base de datos restaurada. La aplicación se reiniciará.');
        setTimeout(() => {
          if (isElectron) window.electronAPI.relaunchApp();
          else window.location.reload();
        }, 1500);
      } else {
        setMsgRespaldo(`Error: ${data.error}`);
        alert(`Fallo en restauración: ${data.error}`);
      }
    } catch (e) {
      setMsgRespaldo('Error de conexión en restauración');
    } finally {
      setRespaldoLoading(false);
    }
  };

  // Restablecer Base de Datos de Fábrica
  const handleRestablecerFabrica = async () => {
    if (!window.confirm('¡ADVERTENCIA CRÍTICA!\n\nSe ELIMINARÁN permanentemente todos los datos (guarderías, expedientes, historial, configuraciones) y la base de datos se restablecerá a su estado inicial de fábrica.\n\n¿Estás seguro de que deseas continuar?')) return;
    const confirmation = window.prompt('Escribe "RESTABLECER" para confirmar esta acción:');
    if (confirmation !== 'RESTABLECER') {
      alert('Restablecimiento cancelado.');
      return;
    }

    setRespaldoLoading(true);
    setMsgRespaldo('Restableciendo base de datos de fábrica...');
    try {
      const res = await fetch('/api/configuracion/reset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setMsgRespaldo('Base de datos restablecida de fábrica. Reiniciando...');
        alert('Base de datos restablecida de fábrica correctamente. La aplicación se reiniciará.');
        setTimeout(() => {
          const isElectron = typeof window.electronAPI !== 'undefined';
          if (isElectron) window.electronAPI.relaunchApp();
          else window.location.reload();
        }, 1500);
      } else {
        setMsgRespaldo(`Error: ${data.error}`);
        alert(`Error al restablecer: ${data.error}`);
      }
    } catch (e) {
      setMsgRespaldo('Error de red al restablecer');
    } finally {
      setRespaldoLoading(false);
    }
  };

  const rolLower = (user?.rol || '').trim().toLowerCase();
  const esProgramador = rolLower === 'programador' || rolLower === 'programadora';

  if (loading) {
    return <div className="loading">Cargando configuración...</div>;
  }

  return (
    <>
      <div className="section-header">
        <div>
          <div className="section-title">Configuración</div>
          <div className="section-sub">Solo jefe de área y administradores</div>
        </div>
        <button className="btn btn-secondary" onClick={() => onChangePage('dashboard')}>
          <ArrowLeft size={14} /> Volver
        </button>
      </div>

      {/* Automatización de Correos */}
      <div className="exp-section">
        <div className="exp-section-head" style={{ cursor: 'default' }}>
          <span className="sec-name">Automatización de Correos</span>
        </div>
        
        <div style={{ padding: '16px' }}>
          <div className="config-card">
            <div className="config-info">
              <div className="config-icon"><Mail size={18} /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Recordatorios automáticos</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Enviar avisos de vigencia de forma automatizada</div>
              </div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={autoCorreo}
                onChange={(e) => setAutoCorreo(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="config-card" style={{ marginTop: '12px' }}>
            <div className="config-info">
              <div className="config-icon"><Flame size={18} /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Alertas de Extintores</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Enviar avisos de vencimiento de extintores</div>
              </div>
            </div>
            <label className="switch">
              <input 
                type="checkbox" 
                checked={autoCorreoExtintores}
                onChange={(e) => setAutoCorreoExtintores(e.target.checked)}
              />
              <span className="slider"></span>
            </label>
          </div>

          {/* Ajustar hora de envío */}
          <div className="config-card" style={{ marginTop: '16px' }}>
            <div className="config-info">
              <div className="config-icon"><Clock size={18} /></div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Ajustar hora de envío</div>
                <div style={{ fontSize: '11px', color: 'var(--muted)' }}>Establecer horario para disparar los correos</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'var(--s3)', padding: '8px 12px', borderRadius: '10px', border: '1px solid var(--border)' }}>
              <input 
                type="number" 
                className="form-input" 
                min="0" 
                max="23" 
                value={avisoHora}
                onChange={(e) => setAvisoHora(Math.max(0, Math.min(23, parseInt(e.target.value, 10) || 0)))}
                style={{ maxWidth: '65px', margin: 0, textAlign: 'center', fontWeight: 700, border: 'none', background: 'transparent' }}
              />
              <span style={{ fontSize: '16px', fontWeight: 700, color: 'var(--imss)', fontFamily: 'var(--mono)', minWidth: '60px', textAlign: 'right' }}>
                {String(avisoHora).padStart(2, '0')}:00
              </span>
            </div>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--muted)', margin: '-8px 0 20px 8px' }}>
            * El sistema usa formato de 24 horas (00:00 - 23:00)
          </div>

          {/* Umbrales de aviso */}
          <div className="form-row">
            <label className="form-label">Avisos (3 niveles)</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
              <div>
                <span className="form-label" style={{ fontSize: '10px' }}>Nivel 1</span>
                <input 
                  className="form-input" 
                  type="number" 
                  value={diasAviso45} 
                  onChange={(e) => setDiasAviso45(e.target.value)}
                  style={{ maxWidth: '90px' }} 
                />
              </div>
              <div>
                <span className="form-label" style={{ fontSize: '10px' }}>Nivel 2</span>
                <input 
                  className="form-input" 
                  type="number" 
                  value={diasAviso30} 
                  onChange={(e) => setDiasAviso30(e.target.value)}
                  style={{ maxWidth: '90px' }} 
                />
              </div>
              <div>
                <span className="form-label" style={{ fontSize: '10px' }}>Nivel 3</span>
                <input 
                  className="form-input" 
                  type="number" 
                  value={diasAviso15} 
                  onChange={(e) => setDiasAviso15(e.target.value)}
                  style={{ maxWidth: '90px' }} 
                />
              </div>
            </div>
          </div>

          <button 
            type="button" 
            className="btn btn-primary" 
            onClick={handleSaveConfig}
            disabled={savingConfig}
          >
            Guardar configuración
          </button>
        </div>
      </div>

      {/* Plantillas de Correo */}
      <div className="exp-section">
        <div className="exp-section-head" style={{ cursor: 'default' }}>
          <span className="sec-name">Plantillas de Correo Institucional</span>
        </div>
        <div style={{ padding: '16px' }}>
          {/* Plantilla A: General */}
          <div style={{ marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--imss)', marginBottom: '10px' }}>
              A. Cuerpo de Alertas de Vigencia (General)
            </div>
            <div className="form-row">
              <label className="form-label">Asunto del Correo</label>
              <input 
                className="form-input" 
                style={{ fontSize: '13px' }}
                value={asuntoGeneral} 
                onChange={(e) => setAsuntoGeneral(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Cuerpo del Mensaje</label>
              <textarea 
                className="form-input" 
                rows={10} 
                value={cuerpoGeneral}
                onChange={(e) => setCuerpoGeneral(e.target.value)}
                style={{ fontSize: '12px', fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', minHeight: '200px', resize: 'vertical' }}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleProbarPlantilla('general', 'General')}>
              <Send size={12} /> Probar Alerta
            </button>
          </div>

          {/* Plantilla B: Resumen */}
          <div style={{ marginBottom: '30px', paddingBottom: '15px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--warn)', marginBottom: '10px' }}>
              B. Cuerpo de Resumen de Estatus
            </div>
            <div className="form-row">
              <label className="form-label">Asunto del Resumen</label>
              <input 
                className="form-input" 
                style={{ fontSize: '13px' }}
                value={asuntoResumen} 
                onChange={(e) => setAsuntoResumen(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Cuerpo del Resumen</label>
              <textarea 
                className="form-input" 
                rows={10} 
                value={cuerpoResumen}
                onChange={(e) => setCuerpoResumen(e.target.value)}
                style={{ fontSize: '12px', fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', minHeight: '200px', resize: 'vertical' }}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleProbarPlantilla('resumen', 'Resumen')}>
              <Send size={12} /> Probar Resumen
            </button>
          </div>

          {/* Plantilla C: Extintores */}
          <div style={{ marginBottom: '20px', paddingBottom: '15px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--danger)', marginBottom: '10px' }}>
              C. Cuerpo de Alertas de Extintores
            </div>
            <div className="form-row">
              <label className="form-label">Asunto de Extintores</label>
              <input 
                className="form-input" 
                style={{ fontSize: '13px' }}
                value={asuntoExtintores} 
                onChange={(e) => setAsuntoExtintores(e.target.value)}
              />
            </div>
            <div className="form-row">
              <label className="form-label">Cuerpo de Extintores</label>
              <textarea 
                className="form-input" 
                rows={10} 
                value={cuerpoExtintores}
                onChange={(e) => setCuerpoExtintores(e.target.value)}
                style={{ fontSize: '12px', fontFamily: 'var(--mono)', whiteSpace: 'pre-wrap', minHeight: '200px', resize: 'vertical' }}
              />
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => handleProbarPlantilla('extintores', 'Extintores')}>
              <Send size={12} /> Probar Extintores
            </button>
          </div>

          <p style={{ fontSize: '11px', color: 'var(--muted)', marginBottom: '10px' }}>
            Marcadores disponibles: <strong>{"{{GUARDERIA}}"}</strong>, <strong>{"{{ENCARGADA}}"}</strong>, <strong>{"{{LISTA}}"}</strong>, <strong>{"{{FECHA}}"}</strong>, <strong>{"{{TIPO}}"}</strong>
          </p>
        </div>
      </div>

      {/* Mantenimiento */}
      <div className="exp-section">
        <div className="exp-section-head" style={{ cursor: 'default' }}>
          <span className="sec-name">Mantenimiento</span>
        </div>
        <div style={{ padding: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            <button 
              type="button" 
              className="btn btn-secondary btn-sm" 
              onClick={handleActualizarEstados}
              disabled={updatingEstados}
            >
              <RefreshCw size={12} /> Actualizar semáforo manual
            </button>
            
            <button 
              type="button" 
              className="btn btn-primary btn-sm" 
              onClick={handleEjecutarMotor}
              disabled={runningMotor}
            >
              <Bell size={12} /> Ejecutar Motor Ahora
            </button>
          </div>
          {msgEstados && (
            <span id="msgEstados" style={{ display: 'block', marginTop: '10px', fontSize: '12px', color: 'var(--muted)' }}>
              {msgEstados}
            </span>
          )}
        </div>
      </div>

      {/* Base de Datos (Respaldos) - Solo programadores */}
      {esProgramador && (
        <div className="exp-section">
          <div className="exp-section-head" style={{ cursor: 'default' }}>
            <span className="sec-name">Base de Datos</span>
          </div>
          <div style={{ padding: '16px' }}>
            <p style={{ fontSize: '12px', color: 'var(--muted)', marginBottom: '12px' }}>
              Gestión de copias de seguridad físicas (.dump) del esquema PostgreSQL del sistema.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleGenerarRespaldo}
                disabled={respaldoLoading}
              >
                <Database size={14} /> Generar Respaldo
              </button>
              
              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleCargarRespaldo}
                disabled={respaldoLoading}
              >
                <FolderOpen size={14} /> Cargar Respaldo
              </button>

              <button 
                type="button" 
                className="btn btn-danger" 
                onClick={handleRestablecerFabrica}
                disabled={respaldoLoading}
                style={{ backgroundColor: 'var(--danger)', color: 'white' }}
              >
                <RefreshCw size={14} /> Restablecer de Fábrica
              </button>
            </div>
            {msgRespaldo && (
              <span id="msgRespaldo" style={{ display: 'block', marginTop: '12px', fontSize: '12px', color: 'var(--muted)' }}>
                {msgRespaldo}
              </span>
            )}
          </div>
        </div>
      )}
    </>
  );
};

