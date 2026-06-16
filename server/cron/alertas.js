// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/cron/alertas.js
// MÓDULO    : Procesos Automáticos (Alertas por Correo)
// PROPÓSITO : Motor de notificación y alertas de vigencia para documentos y extintores.
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const { sendMail } = require('../utils/mailer');
const { pool } = require('../db/connection');
const { logSistema } = require('../utils/logger');
// ------------------------------------------------------------
// FUNCIÓN  : getConfig
// PROPÓSITO: Obtener las claves de configuración del sistema desde la base de datos.
// PARÁMETROS: Ninguno
// RETORNA  : Promise<Object> — Mapa de configuración { clave: valor }.
// ERRORES  : Lanza error si falla la consulta SQL.
// ------------------------------------------------------------
async function getConfig() {
  const { rows } = await pool.query('SELECT clave, valor FROM configuracion');
  const c = {};
  rows.forEach(r => { c[r.clave] = r.valor; });
  return c;
}

// ------------------------------------------------------------
// FUNCIÓN  : delay
// PROPÓSITO: Generar una pausa asíncrona para evitar saturación de envíos.
// PARÁMETROS: ms (Number) — Tiempo de espera en milisegundos.
// RETORNA  : Promise
// ------------------------------------------------------------
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const CATEGORIAS_ORDEN = [
  ' DOCUMENTOS CONSTITUTIVOS Y LEGALES',
  ' DOCUMENTOS DE INMUEBLE Y USO',
  ' SEGURIDAD Y PROTECCIÓN CIVIL',
  ' PLANOS Y DICTÁMENES TÉCNICOS',
  ' CONTRATOS Y CONVENIOS IMSS',
  ' SEGUROS Y FIANZAS',
  ' ANEXOS Y FORMATOS OFICIALES',
  ' RECURSOS HUMANOS Y CAPACITACIÓN',
  ' REGISTROS OFICIALES',
  ' DOCUMENTOS OPERATIVOS'
];

// ------------------------------------------------------------
// FUNCIÓN  : getCategory
// PROPÓSITO: Clasificar un documento en una categoría institucional según su nombre.
// ------------------------------------------------------------
function getCategory(docName) {
  const name = (docName || '').toUpperCase().trim();
  
  if (name.includes('ESCRITURA PÚBLICA') || name.includes('ACTA DE NACIMIENTO') || name.includes('IDENTIFICACIÓN VIGENTE') || name.includes('CURP')) 
    return '📋 DOCUMENTOS CONSTITUTIVOS Y LEGALES';
    
  if (name.includes('LICENCIA DE USO DE SUELO') || name.includes('POSESIÓN LEGAL DEL INMUEBLE') || name.includes('COMPROBANTE DE DOMICILIO') || name.includes('LICENCIA DE FUNCIONAMIENTO') || name.includes('LICENCIA SANITARIA'))
    return '🏢 DOCUMENTOS DE INMUEBLE Y USO';
    
  if (name.includes('CVMSG') || name.includes('PROTECCIÓN CIVIL') || name.includes('BOMBEROS') || name.includes('SEGURIDAD ESTRUCTURAL') || name.includes('EXTINTORES') || name.includes('ESTÁNDARES DE SEGURIDAD'))
    return '🛡️ SEGURIDAD Y PROTECCIÓN CIVIL';
    
  if (name.includes('PLANOS') || name.includes('INSTALACIÓN ELÉCTRICA') || name.includes('INSTALACIÓN HIDRÁULICA') || name.includes('VERIFICACIÓN DE LAS INSTALACIONES'))
    return '📐 PLANOS Y DICTÁMENES TÉCNICOS';
    
  if (name.includes('SATISFACCIÓN DE USUARIO') || name.includes('CONVENIO AJUSTE CUOTA') || name.includes('CONVENIOS MODIFICATORIOS') || name.includes('CONSEJO TÉCNICO') || name.includes('ACTA FALLO') || name.includes('OFICIO NOTIFICACIÓN'))
    return '📄 CONTRATOS Y CONVENIOS IMSS';
    
  if (name.includes('PÓLIZA SEGURO DE RESPONSABILIDAD CIVIL') || name.includes('PÓLIZA DE FIANZA') || name.includes('CENTRAL DE ALARMA'))
    return '💼 SEGUROS Y FIANZAS';
    
  if (name.includes('ANEXO') || name.includes('FORMATO ÚNICO') || name.includes('MANIFESTACIÓN DE LOS ART.'))
    return '📑 ANEXOS Y FORMATOS OFICIALES';
    
  if (name.includes('CURRÍCULUM VITAE') || name.includes('CAPACITACIÓN') || name.includes('VALIDEZ OFICIAL DE ESTUDIOS'))
    return '👥 RECURSOS HUMANOS Y CAPACITACIÓN';
    
  if (name.includes('REGISTRO PATRONAL') || name.includes('REGISTRO INFONAVIT') || name.includes('REGISTRO FEDERAL DE CONTRIBUYENTES'))
    return '🏛️ REGISTROS OFICIALES';
    
  if (name.includes('REGLAMENTO INTERNO') || name.includes('MANUAL PARA LAS MADRES') || name.includes('REPORTE DE VISITAS'))
    return '📚 DOCUMENTOS OPERATIVOS';
    
  return '📑 ANEXOS Y FORMATOS OFICIALES';
}

// ------------------------------------------------------------
// FUNCIÓN  : getSubCategory
// PROPÓSITO: Clasificar sub-secciones dentro de Seguridad y PC.
// ------------------------------------------------------------
function getSubCategory(docName, category) {
  if (category !== '🛡️ SEGURIDAD Y PROTECCIÓN CIVIL') return null;
  const name = (docName || '').toUpperCase();
  if (name.includes('CVMSG')) return 'Cédulas de Verificación (CVMSG IMSS):';
  return 'Protección Civil:';
}

// ------------------------------------------------------------
// FUNCIÓN  : renderDocRow
// PROPÓSITO: Generar una fila de tabla HTML estilizada para un documento.
// ------------------------------------------------------------
function renderDocRow(it, index) {
  const fechaStr = formatDateDMY(it.fecha_vigencia);
  let statusText = '';
  let color = '#333';
  
  if (it.tier === 'vencido') {
    statusText = `🔴 VENCIDO`;
    color = '#e74c3c';
  } else if (it.tier === '15d' || it.tier === '30d' || it.tier === 'por vencer') {
    statusText = `⚠️ PRÓXIMO A VENCER`;
    color = '#e67e22';
  } else if (it.tier === '45d') {
    statusText = `🔵 AVISO PREVENTIVO`;
    color = '#3498db';
  } else if (it.tier === 'vigente') {
    statusText = `🟢 VIGENTE`;
    color = '#27ae60';
  }

  return `
    <tr style="border-bottom: 1px solid #f0f0f0;">
      <td style="padding: 6px 0; font-size: 13px; color: #555;">${index}. ${escapeHtml(it.documento_nombre)}</td>
      <td style="padding: 6px 0; text-align: right; color: ${color}; font-weight: bold; font-size: 12px; white-space: nowrap;">${statusText}${fechaStr ? ` (${fechaStr})` : ''}</td>
    </tr>
  `;
}

const DEFAULT_ASUNTO = 'SDA — Notificación de Estatus de Documentación Institucional · {{GUARDERIA}}';
const DEFAULT_CUERPO = `Estimada(s) {{ENCARGADA}}:

Por medio del presente, y de acuerdo a los requerimientos institucionales del IMSS, nos dirigimos a usted para notificarle que la Guardería {{GUARDERIA}} ({{NUMERO}}) cuenta con documentos en su expediente que requieren su atención y/o actualización correspondiente.

A continuación, se presenta el desglose del estado actual de dichos documentos:

{{LISTA}}

Le exhortamos amablemente a iniciar el proceso de regularización a la brevedad posible para evitar incumplimientos ante la normativa vigente. Su Coordinadora o Analista asignada se encuentra a su disposición para cualquier orientación adicional.`;

// ------------------------------------------------------------
// FUNCIÓN  : resolver
// PROPÓSITO: Reemplazar etiquetas dinámicas en plantillas con valores reales.
// PARÁMETROS:
//   - texto (String): Plantilla original.
//   - datos (Object): Valores para el reemplazo.
// RETORNA  : String — Texto procesado.
// ------------------------------------------------------------
function resolver(texto, datos) {
  if (!texto) return '';
  return texto
    .split('{{GUARDERIA}}').join(datos.guarderia || '')
    .split('{{ENCARGADA}}').join(datos.encargada || '')
    .split('{{NUMERO}}').join(datos.numero || '')
    .split('{{LISTA}}').join(datos.lista || '')
    .split('{{FECHA}}').join(datos.fecha || '')
    .split('{{TIPO}}').join(datos.tipo || '');
}

// ------------------------------------------------------------
// FUNCIÓN  : escapeHtml
// PROPÓSITO: Sanitizar cadenas para prevenir inyecciones HTML en correos.
// PARÁMETROS: s (String)
// RETORNA  : String
// ------------------------------------------------------------
function escapeHtml(s) {
  if (!s) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ------------------------------------------------------------
// FUNCIÓN  : formatDateDMY
// PROPÓSITO: Formatear objetos Date a cadena DD/MM/AAAA.
// PARÁMETROS: date (Date/String)
// RETORNA  : String
// ------------------------------------------------------------
function formatDateDMY(date) {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return date;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// ------------------------------------------------------------
// FUNCIÓN  : buildListaTexto
// PROPÓSITO: Generar el cuerpo de texto plano con el listado de documentos agrupados por nivel de urgencia.
// PARÁMETROS: items (Array)
// RETORNA  : String
// ------------------------------------------------------------
function buildListaTexto(items) {
  const groups = {
    vencido: { title: '🔴 DOCUMENTOS VENCIDOS (Atención Inmediata)', docs: [] },
    '15d': { title: '🟠 AVISO URGENTE (Plazo: 0 a 15 días)', docs: [] },
    '30d': { title: '🟡 AVISO MEDIO (Plazo: 16 a 30 días)', docs: [] },
    '45d': { title: '🔵 AVISO PREVENTIVO (Plazo: 31 a 45 días)', docs: [] },
    'por vencer': { title: '🟡 DOCUMENTOS POR VENCER (Próximo Vencimiento)', docs: [] },
    vigente: { title: '🟢 DOCUMENTOS VIGENTES (Correctos)', docs: [] }
  };

  items.forEach(it => {
    if (groups[it.tier]) groups[it.tier].docs.push(it);
  });

  let s = '';
  for (const key of ['vencido', '15d', '30d', '45d', 'por vencer', 'vigente']) {
    const g = groups[key];
    if (g.docs.length > 0) {
      s += `${g.title}\n`;
      g.docs.forEach(it => {
        const fechaStr = formatDateDMY(it.fecha_vigencia);
        let verbo = 'Vence:';
        if (it.tier === 'vencido') verbo = 'Venció el';
        if (it.tier === 'vigente') verbo = 'Vigente hasta:';
        if (it.tier === 'por vencer') verbo = 'Vence:';
        s += `  • ${it.documento_nombre || ''} (${verbo} ${fechaStr})\n`;
      });
      s += '\n';
    }
  }
  return s.trim();
}

// ------------------------------------------------------------
// FUNCIÓN  : buildListaHtml
// PROPÓSITO: Generar el bloque HTML estilizado con el listado de documentos para el correo.
// PARÁMETROS: items (Array)
// RETORNA  : String (HTML)
// ------------------------------------------------------------
function buildListaHtml(items) {
  const groups = {};
  CATEGORIAS_ORDEN.forEach(c => { groups[c] = []; });

  items.forEach(it => {
    const cat = getCategory(it.documento_nombre);
    groups[cat].push(it);
  });

  return CATEGORIAS_ORDEN.map((catName, index) => {
    const docs = groups[catName];
    if (docs.length === 0) return '';

    const marginTop = index === 0 ? '5px' : '15px';

    // Ordenamiento numérico inteligente (Anexo 1, Anexo 2, Anexo 10...)
    docs.sort((a, b) => a.documento_nombre.localeCompare(b.documento_nombre, undefined, { numeric: true, sensitivity: 'base' }));

    
    const firstSpace = catName.indexOf(' ');
    const icon = firstSpace !== -1 ? catName.substring(0, firstSpace) : '';
    const title = firstSpace !== -1 ? catName.substring(firstSpace + 1) : catName;

    const categoryLetter = String.fromCharCode(65 + index);

  
    if (catName === '🛡️ SEGURIDAD Y PROTECCIÓN CIVIL') {
      const subGroups = {
        'Cédulas de Verificación (CVMSG IMSS):': [],
        'Protección Civil:': []
      };
      docs.forEach(d => {
        const sub = getSubCategory(d.documento_nombre, catName);
        subGroups[sub].push(d);
      });

      let innerHtml = '';
      let subIndex = 1;
      ['Cédulas de Verificación (CVMSG IMSS):', 'Protección Civil:'].forEach(subTitle => {
        if (subGroups[subTitle].length === 0) return;
        innerHtml += `<p style="font-size: 11px; color: #777; margin: 8px 0 3px 5px; font-weight: bold; text-transform: uppercase;">${subTitle}</p>`;
        innerHtml += `<table style="width: 100%; border-collapse: collapse; margin-left: 10px;">`;
        innerHtml += subGroups[subTitle].map(d => renderDocRow(d, subIndex++)).join('');
        innerHtml += `</table>`;
      });

      return `
        <div style="margin-top: ${marginTop}; margin-bottom: 5px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fcfcfc; border-left: 4px solid #004A23; border-bottom: 1px solid #f0f0f0;">
            <tr>
              <td width="25" valign="middle" style="padding: 10px 0 10px 15px; font-weight: bold; color: #004A23; font-size: 15px; font-family: Arial, Helvetica, sans-serif; vertical-align: middle; line-height: 1;">${categoryLetter}</td>
              <td width="25" valign="middle" style="padding: 10px 0; font-size: 15px; text-align: center; vertical-align: middle; line-height: 1;">${icon}</td>
              <td valign="middle" style="padding: 10px 5px; white-space: nowrap; vertical-align: middle;">
                <div style="margin: 0; font-size: 13px; color: #004A23; text-transform: uppercase; font-weight: bold; font-family: Arial, Helvetica, sans-serif; line-height: 1;">${title}</div>
              </td>
              <td width="110" align="right" valign="middle" style="padding: 10px 15px; font-size: 10px; color: #888; font-weight: bold; white-space: nowrap; font-family: Arial, Helvetica, sans-serif; vertical-align: middle; line-height: 1;">
                ${docs.length} DOCUMENTO(S)
              </td>
            </tr>
          </table>
          ${innerHtml}
        </div>
      `;
    }

   
    return `
      <div style="margin-top: ${marginTop}; margin-bottom: 5px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fcfcfc; border-left: 4px solid #004A23; border-bottom: 1px solid #f0f0f0;">
          <tr>
            <td width="25" valign="middle" style="padding: 10px 0 10px 15px; font-weight: bold; color: #004A23; font-size: 15px; font-family: Arial, Helvetica, sans-serif; vertical-align: middle; line-height: 1;">${categoryLetter}</td>
            <td width="25" valign="middle" style="padding: 10px 0; font-size: 15px; text-align: center; vertical-align: middle; line-height: 1;">${icon}</td>
            <td valign="middle" style="padding: 10px 5px; white-space: nowrap; vertical-align: middle;">
              <div style="margin: 0; font-size: 13px; color: #004A23; text-transform: uppercase; font-weight: bold; font-family: Arial, Helvetica, sans-serif; line-height: 1;">${title}</div>
            </td>
            <td width="110" align="right" valign="middle" style="padding: 10px 15px; font-size: 10px; color: #888; font-weight: bold; white-space: nowrap; font-family: Arial, Helvetica, sans-serif; vertical-align: middle; line-height: 1;">
              ${docs.length} DOCUMENTO(S)
            </td>
          </tr>
        </table>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 3px;">
          ${docs.map((d, i) => renderDocRow(d, i + 1)).join('')}
        </table>
      </div>
    `;
  }).join('');
}

// ------------------------------------------------------------
// FUNCIÓN  : buildMensaje
// PROPÓSITO: Construir el asunto y cuerpo del mensaje (texto y HTML) personalizado para una guardería.
// PARÁMETROS:
//   - guarderia (Object): Datos del centro receptor.
//   - items (Array)     : Lista de documentos a notificar.
//   - config (Object)    : Mapa de configuración global del sistema.
// RETORNA  : Object { asunto, cuerpo, cuerpoHtml }
// ------------------------------------------------------------
function buildMensaje(guarderia, items, config) {
  const isResumen = items.some(it => it.isResumen);
  
  let asuntoTemplate, cuerpoTemplate;
  if (isResumen) {
    asuntoTemplate = config['plantilla_asunto_resumen'] || ('[RESUMEN] ' + (config['plantilla_asunto_general'] || DEFAULT_ASUNTO));
    cuerpoTemplate = config['plantilla_cuerpo_resumen'] || (config['plantilla_cuerpo_general'] || DEFAULT_CUERPO);
  } else {
    asuntoTemplate = config['plantilla_asunto_general'] || DEFAULT_ASUNTO;
    cuerpoTemplate = config['plantilla_cuerpo_general'] || DEFAULT_CUERPO;
  }
  
  const datos = {
    guarderia: guarderia.nombre || guarderia.numero,
    numero: guarderia.numero || '',
    encargada: guarderia.encargada || '',
    lista: buildListaTexto(items),
    fecha: formatDateDMY(new Date()),
    tipo: (items.length === 1) ? items[0].label : (isResumen ? 'Resumen de Estatus' : 'Múltiples avisos')
  };

  const asunto = resolver(asuntoTemplate, datos);
  const listaHtml = buildListaHtml(items);

  
  const countTotal = items.length;
  const countVencido = items.filter(it => it.tier === 'vencido').length;
  const countPorVencer = items.filter(it => it.tier === '15d' || it.tier === '30d' || it.tier === 'por vencer').length;
  const countVigente = items.filter(it => it.tier === 'vigente').length;

  const indicadoresHtml = `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #eee;">
      <tr>
        <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Total</div>
          <div style="font-size: 18px; color: #004A23; font-weight: bold;">${countTotal}</div>
        </td>
        <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Vencidos</div>
          <div style="font-size: 18px; color: #e74c3c; font-weight: bold;">${countVencido}</div>
        </td>
        <td style="padding: 10px; text-align: center; ${isResumen ? 'border-right: 1px solid #eee;' : ''}">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Por Vencer</div>
          <div style="font-size: 18px; color: #e67e22; font-weight: bold;">${countPorVencer}</div>
        </td>
        ${isResumen ? `
        <td style="padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Vigentes</div>
          <div style="font-size: 18px; color: #27ae60; font-weight: bold;">${countVigente}</div>
        </td>
        ` : ''}
      </tr>
    </table>
  `;


  const wrapperStart = `
    <div style="background-color: #f4f4f4; padding: 20px 0;">
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background-color: #004A23; padding: 15px 25px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700;">SISTEMA DE ADMINISTRACIÓN DE DOCUMENTOS (SDA)</h1>
          <p style="color: #D4AF37; margin: 4px 0 0 0; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Notificación de Estatus Institucional</p>
        </div>
        <div style="padding: 20px 30px; color: #333333; line-height: 1.5;">
          ${indicadoresHtml}
  `;
  const wrapperEnd = `
          <p style="font-size: 11px; color: #999999; margin-top: 25px; border-top: 1px solid #f0f0f0; padding-top: 15px; text-align: center; line-height: 1.4;">
            Este es un mensaje automático generado por el Sistema SDA y no recibe respuestas.<br>
            <strong>Fecha de evaluación del sistema:</strong> ${formatDateDMY(new Date())}
          </p>
        </div>
        <div style="background-color: #f8f8f8; padding: 15px; text-align: center; font-size: 11px; color: #666666; border-top: 1px solid #e0e0e0;">
          Órgano de Operación Administrativa Desconcentrada Sinaloa <br>
          <strong style="color: #004A23;">Departamento de Guarderías IMSS</strong>
        </div>
      </div>
    </div>
  `;

 
  const cuerpoLimpio = cuerpoTemplate.split('\n').map(line => line.trim() ? `<p style="margin: 0 0 10px 0;">${line}</p>` : '').join('');
  const cuerpoHtmlRaw = resolver(cuerpoLimpio, { ...datos, lista: listaHtml });
  const cuerpoHtml = wrapperStart + cuerpoHtmlRaw + wrapperEnd;

  return { asunto, cuerpo: resolver(cuerpoTemplate, datos), cuerpoHtml };
}


// ------------------------------------------------------------
// FUNCIÓN  : runAlertas
// PROPÓSITO: Ejecutar el escaneo de vigencias y realizar el envío agrupado de correos electrónicos.
// PARÁMETROS:
//   - baseUrl (String): URL base del sistema para hipervínculos.
//   - options (Object): { forzarPrueba, guarderiaIds, incluirVigentes }.
// RETORNA  : Promise<Object> { enviados, error }
// ------------------------------------------------------------
async function runAlertas(baseUrl, options = {}) {
  const inicioTime = Date.now();
  const { forzarPrueba = false, guarderiaIds = null, comoCron = false } = options;

  const config = await getConfig();
  if (!forzarPrueba && config.auto_correo !== '1' && !guarderiaIds) return { enviados: 0, error: 'Automatización apagada' };

  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { enviados: 0, error: 'Faltan credenciales de Gmail en el servidor.' };
  }

  let sql = `
    SELECT e.id, e.guarderia_id, e.fecha_vigencia, e.estado, 
            g.numero as guarderia_numero, g.nombre as guarderia_nombre, g.encargada, g.correos_aviso, 
            d.nombre as documento_nombre 
    FROM expedientes e 
    JOIN guarderias g ON g.id = e.guarderia_id AND g.activo = true
    JOIN documentos_catalogo d ON d.id = e.documento_id AND d.activo = true
    WHERE e.estado != 'no aplica'
  `;
  const params = [];
  if (guarderiaIds && Array.isArray(guarderiaIds) && guarderiaIds.length > 0) {
    sql += ` AND g.id = ANY($1)`;
    params.push(guarderiaIds);
  }

  const { rows: expedientes } = await pool.query(sql, params);
  const hoyData = new Date();
  hoyData.setHours(0,0,0,0);

  const nivelesSDA = [
    { dias: Number(config.dias_aviso_45 || 45), clave: '45d', label: 'AVISO 45 DÍAS' },
    { dias: Number(config.dias_aviso_30 || 30), clave: '30d', label: 'AVISO 30 DÍAS' },
    { dias: Number(config.dias_aviso_15 || 15), clave: '15d', label: 'AVISO 15 DÍAS' },
    { dias: 0, clave: 'vencido', label: 'CRÍTICO: VENCIDO' }
  ];

  const porGuarderia = {};

  for (const e of expedientes) {
    if (e.estado === 'no aplica') continue;

    let tier = null;
    let label = '';

    const fvigRaw = e.fecha_vigencia;
    let diffDays = null;

    if (fvigRaw) {
      const fvig = new Date(fvigRaw);
      fvig.setHours(0,0,0,0);
      const diffMs = fvig - hoyData;
      diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    }

    if (diffDays !== null && diffDays <= 0) {
      // comoCron: solo notificar vencidos del día exacto (hoy). Los de días pasados
      // ya debieron haberse notificado en su momento por el cron automático.
      if (comoCron && diffDays < 0) {
        // Ignorar: venció en días anteriores
      } else {
        tier = 'vencido';
        label = '🔴 VENCIDO';
      }
    } else {
      const match = (diffDays !== null) ? nivelesSDA.find(n => n.dias === diffDays) : null;
      if (match) {
        tier = match.clave;
        label = `⚠️ ${match.label}`;
      } else if (!comoCron && (guarderiaIds || forzarPrueba)) {
        // Envío manual. El estado de la base de datos determina la inclusión si no hay coincidencia de días.
        if (e.estado === 'vencido') {
          tier = 'vencido';
          label = '🔴 VENCIDO';
        } else if (e.estado === 'por vencer') {
          tier = 'por vencer';
          label = '⚠️ POR VENCER';
        } else if (options.incluirVigentes) {
          tier = 'vigente';
          label = '🟢 VIGENTE';
        }
      }
    }

    if (!tier) continue;
    

    if (!forzarPrueba && !guarderiaIds) {
      const checkSql = `
        SELECT id FROM historial_alertas 
        WHERE expediente_id = $1 AND tipo_alerta = $2 AND exitoso = true 
        AND (fecha_referencia = $3 OR (fecha_referencia IS NULL AND fecha_envio > NOW() - INTERVAL '30 days'))
      `;
      const { rows: yaEnviado } = await pool.query(checkSql, [e.id, tier, e.fecha_vigencia]);
      if (yaEnviado.length > 0) continue;
    }

    const key = e.guarderia_id;
    if (!porGuarderia[key]) porGuarderia[key] = {
      guarderia_id: e.guarderia_id,
      nombre: e.guarderia_nombre,
      numero: e.guarderia_numero,
      encargada: e.encargada,
      correos_aviso: e.correos_aviso,
      items: []
    };
    
    porGuarderia[key].items.push({ ...e, tier, label, isResumen: !!options.incluirVigentes });
  }

  let enviados = 0;
  let ultimoError = null;
  console.log(`[Alertas] Iniciando envío de ${Object.keys(porGuarderia).length} resúmenes...`);

  for (const key of Object.keys(porGuarderia)) {
    const guarderia = porGuarderia[key];
    const { correos_aviso, items } = guarderia;
    const dests = (correos_aviso || '').split(/[,;]/).map(e => e.trim()).filter(Boolean);
    if (!dests.length || !items.length) continue;
    
    const { asunto, cuerpo, cuerpoHtml } = buildMensaje(guarderia, items, config);
    
    console.log(`[Alertas] Enviando a ${guarderia.numero} (${dests.join(', ')})...`);
    const res = await sendMail({ to: dests, subject: asunto, text: cuerpo, html: cuerpoHtml });
    
    if (res.ok) {
      console.log(`[Alertas] ✓ Éxito: ${guarderia.numero}`);
      enviados += items.length;
      const queries = [];
      for (const it of items) {
        for (const dest of dests) {
          queries.push(pool.query(
            'INSERT INTO historial_alertas (expediente_id, tipo_alerta, destinatario, fecha_envio, exitoso, asunto, cuerpo, fecha_referencia) VALUES ($1, $2, $3, NOW(), true, $4, $5, $6)',
            [it.id, it.tier, dest, asunto, cuerpo, it.fecha_vigencia]
          ));
        }
      }
      await Promise.all(queries);
    } else {
      console.error(`[Alertas] ✗ Fallo en ${guarderia.numero}:`, res.error);
      ultimoError = res.error;
      const queries = [];
      for (const it of items) {
        for (const dest of dests) {
          queries.push(pool.query(
            'INSERT INTO historial_alertas (expediente_id, tipo_alerta, destinatario, fecha_envio, exitoso, error, asunto, cuerpo, fecha_referencia) VALUES ($1, $2, $3, NOW(), false, $4, $5, $6, $7)',
            [it.id, it.tier, dest, res.error, asunto, cuerpo, it.fecha_vigencia]
          ));
        }
      }
      await Promise.all(queries);
    }

    
    await delay(2000);
  }
  console.log(`[Alertas] Proceso finalizado. Total documentos avisados: ${enviados}`);
  
  const duracion = (Date.now() - inicioTime) / 1000;
  const nivel = (duracion > 10 || ultimoError) ? 'ADVERTENCIA' : 'INFORMATIVO';
  await logSistema(nivel, 'CRON', 'Cron de alertas de documentos finalizado', {
    duracion_segundos: duracion,
    guarderias_procesadas: Object.keys(porGuarderia).length,
    documentos_avisados: enviados,
    error: ultimoError
  }, null, ultimoError ? 'SUCCESS_WITH_WARNING' : 'SUCCESS');

  if (enviados === 0 && ultimoError) return { enviados: 0, error: 'Error al enviar: ' + ultimoError };
  return { enviados, error: null };

}

// ------------------------------------------------------------
// FUNCIÓN  : runPruebaCorreo
// PROPÓSITO: Realizar un envío de prueba a los correos registrados para validar la configuración SMTP.
// PARÁMETROS:
//   - baseUrl (String)       : URL base.
//   - customTemplate (Object): (Opcional) Plantilla personalizada.
// RETORNA  : Promise<Object> { enviados, error }
// ------------------------------------------------------------
async function runPruebaCorreo(baseUrl, customTemplate = null) {
  const config = await getConfig();
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    return { enviados: 0, error: 'Faltan credenciales de Gmail en el servidor.' };
  }

  const { rows } = await pool.query(`SELECT correos_aviso FROM guarderias WHERE activo = true AND correos_aviso IS NOT NULL AND correos_aviso != ''`);
  const set = new Set();
  rows.forEach(r => (r.correos_aviso || '').split(/[,;]/).forEach(e => { if (e.trim()) set.add(e.trim()); }));
  const correos = [...set];
  if (!correos.length) return { enviados: 0, error: 'Configure correos de aviso en al menos una guardería.' };

  const guarderiaMock = { numero: 'U-1114', nombre: 'Guardería de Prueba', encargada: 'Encargada de Prueba' };
  const sample = [{ label: customTemplate ? (customTemplate.label || 'PRUEBA') : 'PRUEBA', documento_nombre: 'Documento de prueba', fecha_vigencia: new Date().toISOString().slice(0, 10), tier: '45d' }];
  
  let result;
  if (customTemplate && customTemplate.asunto && customTemplate.cuerpo) {
      const datos = {
        guarderia: guarderiaMock.nombre,
        numero: guarderiaMock.numero,
        encargada: guarderiaMock.encargada,
        lista: buildListaTexto(sample),
        fecha: formatDateDMY(new Date()),
        tipo: 'PRUEBA'
      };
      result = {
        asunto: resolver(customTemplate.asunto, datos),
        cuerpo: resolver(customTemplate.cuerpo, datos),
        cuerpoHtml: '<div style="font-family:sans-serif; padding:20px; border:1px solid #eee; border-radius:8px;">' + resolver(customTemplate.cuerpo, datos).replace(/\n/g, '<br>') + '</div>'
      };
  } else {
      result = buildMensaje(guarderiaMock, sample, config);
  }

  const res = await sendMail({ 
    to: correos, 
    subject: '[PRUEBA SDA] ' + result.asunto, 
    text: result.cuerpo,
    html: result.cuerpoHtml
  });

  if (res.ok) return { enviados: correos.length, error: null };
  return { enviados: 0, error: 'Error al enviar: ' + res.error };
}

// ------------------------------------------------------------
// FUNCIÓN  : buildMensajeExtintores
// PROPÓSITO: Construir el asunto y cuerpo HTML para las notificaciones del inventario de extintores.
// PARÁMETROS:
//   - guarderia (Object): Datos del centro.
//   - items (Array)     : Lista de extintores afectados.
// RETORNA  : Object { asunto, cuerpoHtml }
// ------------------------------------------------------------
function buildMensajeExtintores(guarderia, items, config = {}) {
  let asunto = config['plantilla_asunto_extintores'] || `SDA — Notificación de Estatus de Extintores · ${guarderia.numero}`;
  const hoyStr = formatDateDMY(new Date());

  // Conteo para indicadores
  const countTotal = items.length;
  const countVencido = items.filter(it => it.tier === 'vencido').length;
  const countPorVencer = items.filter(it => it.tier !== 'vencido' && it.tier !== 'vigente').length;

  const indicadoresHtml = `
    <table style="width: 100%; border-collapse: collapse; margin: 15px 0; background-color: #f9f9f9; border-radius: 8px; border: 1px solid #eee;">
      <tr>
        <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Total</div>
          <div style="font-size: 18px; color: #004A23; font-weight: bold;">${countTotal}</div>
        </td>
        <td style="padding: 10px; text-align: center; border-right: 1px solid #eee;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Vencidos</div>
          <div style="font-size: 18px; color: #e74c3c; font-weight: bold;">${countVencido}</div>
        </td>
        <td style="padding: 10px; text-align: center;">
          <div style="font-size: 10px; color: #888; text-transform: uppercase; font-weight: bold; margin-bottom: 4px;">Por Vencer</div>
          <div style="font-size: 18px; color: #e67e22; font-weight: bold;">${countPorVencer}</div>
        </td>
      </tr>
    </table>
  `;

  const listaHtml = items.map((it, index) => {
    const color = it.tier === 'vencido' ? '#e74c3c' : '#e67e22';
    const fVenc = it.fecha_vencimiento ? formatDateDMY(it.fecha_vencimiento) : 'N/A';
    const statusText = it.tier === 'vencido' ? `🔴 VENCIDO (${fVenc})` : `⚠️ PRÓXIMO A VENCER (${fVenc})`;
    
    return `
      <tr style="border-bottom: 1px solid #f0f0f0;">
        <td style="padding: 6px 0; font-size: 13px; color: #555;">${index + 1}. Extintor #${it.numero_extintor} (${escapeHtml(it.modelo)})</td>
        <td style="padding: 6px 0; text-align: right; color: ${color}; font-weight: bold; font-size: 12px; white-space: nowrap;">${statusText}</td>
      </tr>
    `;
  }).join('');

  const listaTexto = items.map((it, index) => {
      const fVenc = it.fecha_vencimiento ? formatDateDMY(it.fecha_vencimiento) : 'N/A';
      const verbo = it.tier === 'vencido' ? 'Venció' : 'Vence';
      return `  • Extintor #${it.numero_extintor} (${it.modelo}) - ${verbo}: ${fVenc}`;
  }).join('\n');

  const wrapperStart = `
    <div style="background-color: #f4f4f4; padding: 20px 0;">
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 650px; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; background-color: #ffffff; margin: 0 auto; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
        <div style="background-color: #004A23; padding: 15px 25px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 18px; letter-spacing: 1px; text-transform: uppercase; font-weight: 700;">SISTEMA DE ADMINISTRACIÓN DE DOCUMENTOS (SDA)</h1>
          <p style="color: #D4AF37; margin: 4px 0 0 0; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px;">Notificación de Estatus de Extintores</p>
        </div>
        <div style="padding: 20px 30px; color: #333333; line-height: 1.5;">
          ${indicadoresHtml}
  `;
  const wrapperEnd = `
          <p style="font-size: 11px; color: #999999; margin-top: 25px; border-top: 1px solid #f0f0f0; padding-top: 15px; text-align: center; line-height: 1.4;">
            Este es un mensaje automático generado por el Sistema SDA y no recibe respuestas.<br>
            <strong>Fecha de evaluación:</strong> ${hoyStr}
          </p>
        </div>
        <div style="background-color: #f8f8f8; padding: 15px; text-align: center; font-size: 11px; color: #666666; border-top: 1px solid #e0e0e0;">
          Órgano de Operación Administrativa Desconcentrada Sinaloa <br>
          <strong style="color: #004A23;">Departamento de Guarderías IMSS</strong>
        </div>
      </div>
    </div>
  `;

  // Resolver Plantilla
  const datos = {
    guarderia: guarderia.nombre,
    numero: guarderia.numero,
    encargada: guarderia.encargada || 'Directora',
    lista: listaTexto,
    fecha: hoyStr,
    tipo: 'EXTINTORES'
  };

  asunto = resolver(asunto, datos);
  let cuerpoCustom = config['plantilla_cuerpo_extintores'];
  let innerHtml = '';

  if (cuerpoCustom) {
    innerHtml = `<div style="font-size:14px; white-space:pre-wrap; margin-bottom:20px;">${resolver(escapeHtml(cuerpoCustom), datos)}</div>`;
  } else {
    innerHtml = `
      <p style="margin: 0 0 10px 0;">Estimada(s) <strong>${escapeHtml(datos.encargada)}</strong>:</p>
      <p style="margin: 0 0 15px 0;">Se le informa que la <strong>Guardería ${escapeHtml(datos.guarderia)} (${escapeHtml(datos.numero)})</strong> cuenta con equipos de extinción que requieren atención inmediata o mantenimiento preventivo.</p>
    `;
  }

  const cuerpoHtml = wrapperStart + innerHtml + `
    <div style="margin-top: 15px; margin-bottom: 5px;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fcfcfc; border-left: 4px solid #004A23; border-bottom: 1px solid #f0f0f0;">
        <tr>
          <td width="25" valign="middle" style="padding: 8px 0 8px 15px; font-weight: bold; color: #004A23; font-size: 15px; font-family: Arial, sans-serif; vertical-align: middle;">A</td>
          <td width="25" valign="middle" style="padding: 8px 0; font-size: 15px; text-align: center; vertical-align: middle;">🛡️</td>
          <td style="padding: 8px 5px; white-space: nowrap; vertical-align: middle;">
            <div style="margin: 0; font-size: 12px; color: #004A23; text-transform: uppercase; font-weight: bold; font-family: Arial, sans-serif; line-height: 1;">EQUIPOS DE EXTINCIÓN</div>
          </td>
          <td align="right" valign="middle" style="padding: 8px 15px; font-size: 10px; color: #888; font-weight: bold; white-space: nowrap; font-family: Arial, sans-serif; vertical-align: middle;">
            ${items.length} EQUIPO(S)
          </td>
        </tr>
      </table>
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 3px;">
        ${listaHtml}
      </table>
    </div>
  ` + wrapperEnd;
  
  return { asunto, cuerpoHtml };
}

// ------------------------------------------------------------
// FUNCIÓN  : runAlertasExtintores
// PROPÓSITO: Ejecutar el escaneo preventivo de vigencias en el inventario de extintores y notificar vía correo.
// PARÁMETROS:
//   - options (Object): Opciones de ejecución:
//     - forzarPrueba (bool): Si true, ignora el switch auto_correo_extintores (usado por botones manuales).
//     - comoCron (bool): Si true, sólo envía pendientes del día exacto de hoy sin arrastrar días anteriores.
// RETORNA  : Promise<Object> { ok, enviados, error }
// ------------------------------------------------------------
async function runAlertasExtintores(options = {}) {
  const { forzarPrueba = false, comoCron = false } = options;
  const inicioTime = Date.now();
  const config = await getConfig();

  if (!forzarPrueba && config.auto_correo_extintores !== '1') return { enviados: 0, error: 'Automatización de extintores apagada' };
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) return { enviados: 0, error: 'Faltan credenciales de Gmail' };

  try {
    const sql = `
      SELECT e.*, g.nombre as guarderia_nombre, g.numero as guarderia_numero, g.encargada, g.correos_aviso
      FROM extintores e
      JOIN guarderias g ON g.numero = e.guarderia_clave AND g.activo = true
      WHERE e.activo = true AND e.fecha_vencimiento IS NOT NULL
    `;
    const { rows: extintores } = await pool.query(sql);
    
    const hoyStr = new Date().toISOString().slice(0, 10);
    const hoyData = new Date(hoyStr);
    const niveles = [
      { dias: Number(config.dias_aviso_45 || 45), clave: '45d', label: 'AVISO 45 DÍAS' },
      { dias: Number(config.dias_aviso_30 || 30), clave: '30d', label: 'AVISO 30 DÍAS' },
      { dias: Number(config.dias_aviso_15 || 15), clave: '15d', label: 'AVISO 15 DÍAS' },
      { dias: 0, clave: 'vencido', label: 'VENCIDO' }
    ];

    const porGuarderia = {};

    for (const e of extintores) {
      let tier = null;
      let label = '';
      
      const fvigRaw = e.fecha_vencimiento;
      let diffDays = null;
      if (fvigRaw) {
        const fvig = new Date(fvigRaw);
        fvig.setHours(0,0,0,0);
        const diffMs = fvig - hoyData;
        diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      }

      if (diffDays !== null && diffDays <= 0) {
        // comoCron: solo notificar vencidos del día exacto (hoy). Los de días pasados
        // ya debieron haberse notificado en su momento por el cron automático.
        if (comoCron && diffDays < 0) {
          // Ignorar: venció en días anteriores
        } else {
          tier = 'vencido';
          label = '🔴 VENCIDO';
        }
      } else {
        const match = (diffDays !== null) ? niveles.find(n => n.dias === diffDays) : null;
        if (match) {
          tier = match.clave;
          label = `⚠️ ${match.label}`;
        }
      }

      if (!tier) continue;

      // Prevención de duplicados: solo aplica en modo cron automático (no en envíos forzados manuales).
      if (!forzarPrueba) {
        const checkSql = `
          SELECT id FROM historial_alertas 
          WHERE extintor_id = $1 AND tipo_alerta = $2 AND exitoso = true 
          AND (fecha_referencia = $3 OR (fecha_referencia IS NULL AND fecha_envio > NOW() - INTERVAL '30 days'))
        `;
        const { rows: yaEnviado } = await pool.query(checkSql, [e.id, tier, e.fecha_vencimiento]);
        if (yaEnviado.length > 0) continue;
      }

      const key = e.guarderia_clave;
      if (!porGuarderia[key]) porGuarderia[key] = {
        nombre: e.guarderia_nombre,
        numero: e.guarderia_numero,
        encargada: e.encargada,
        correos_aviso: e.correos_aviso,
        items: []
      };
      porGuarderia[key].items.push({ ...e, tier, label });
    }

    let enviados = 0;
    for (const key of Object.keys(porGuarderia)) {
      const g = porGuarderia[key];
      const dests = (g.correos_aviso || '').split(/[,;]/).map(e => e.trim()).filter(Boolean);
      if (!dests.length || !g.items.length) continue;

      const { asunto, cuerpoHtml } = buildMensajeExtintores(g, g.items, config);
      const res = await sendMail({ to: dests, subject: asunto, text: 'Alerta de extintores SDA', html: cuerpoHtml });

      if (res.ok) {
        enviados += dests.length;
        for (const it of g.items) {
          for (const dest of dests) {
            await pool.query(
              `INSERT INTO historial_alertas (extintor_id, tipo_alerta, destinatario, fecha_envio, exitoso, fecha_referencia) VALUES ($1, $2, $3, NOW(), true, $4)`,
              [it.id, it.tier, dest, it.fecha_vencimiento]
            );
          }
        }
      }
      // Retraso para evitar bloqueo de Gmail (2 segundos)
      await delay(2000);
    }

    const duracion = (Date.now() - inicioTime) / 1000;
    const nivel = (duracion > 10) ? 'ADVERTENCIA' : 'INFORMATIVO';
    await logSistema(nivel, 'CRON', 'Cron de alertas de extintores finalizado', {
      duracion_segundos: duracion,
      guarderias_procesadas: Object.keys(porGuarderia).length,
      alertas_enviadas: enviados
    }, null, 'SUCCESS');

    return { ok: true, enviados };
  } catch (e) {
    await logSistema('CRÍTICO', 'CRON', 'Error fatal en cron de extintores', { error: e.message }, null, 'FAILURE');
    console.error('[Cron] Error en runAlertasExtintores:', e.message);
    return { ok: false, error: e.message };
  }
}


// ------------------------------------------------------------
// FUNCIÓN  : ejecutarAlertas
// PROPÓSITO: Punto de entrada para la ejecución manual masiva de alertas ordinarias y de extintores.
// PARÁMETROS: Ninguno.
// RETORNA  : Nada.
// ------------------------------------------------------------
async function ejecutarAlertas() {
  try {
    const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:' + (process.env.PORT || 3002);
    console.log('[Alertas] Ejecutando alertas de documentos...');
    await runAlertas(baseUrl);
    console.log('[Alertas] Ejecutando alertas de extintores...');
    await runAlertasExtintores();
    console.log('[Alertas] Ejecuciones manuales completadas.');
  } catch(e) {
    console.error('[Alertas] Error en ejecutarAlertas manual:', e.message);
  }
}

module.exports = { 
  ejecutarAlertas, 
  runAlertas, 
  runPruebaCorreo, 
  runAlertasExtintores, 
  buildMensaje, 
  getConfig 
};

