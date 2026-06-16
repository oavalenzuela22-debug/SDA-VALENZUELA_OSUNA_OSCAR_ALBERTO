// ============================================================
// PROYECTO  : SDA (Sistema de Administración de Documentos)
// ARCHIVO   : server/db/seed-extintores.js
// MÓDULO    : Base de Datos (Semillas / Carga Inicial)
// PROPÓSITO : Carga masiva de inventario de extintores a partir de archivos Excel heredados (legacy).
// AUTOR     : Oscar Alberto Valenzuela Osuna
// ============================================================

const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });
const { pool } = require('./connection');
// ------------------------------------------------------------
// FUNCIÓN  : seedExtintores
// PROPÓSITO: Procesar el archivo 'REGISTRO DE EXTINTORES.xlsx' para extraer y persistir los datos técnicos de equipos contra incendio en la base de datos PostgreSQL.
// PARÁMETROS: Ninguno.
// RETORNA  : Promise<void>.
// ------------------------------------------------------------
async function seedExtintores() {
  console.log('[Seed-Extintores] Iniciando importación...');
  
  if (!pool) {
    console.error('[Seed-Extintores] Error: No se detectó una conexión activa a la base de datos.');
    process.exit(1);
  }

  // Apertura y lectura del libro de trabajo Excel
  const workbook = new ExcelJS.Workbook();
  const filePath = path.join(__dirname, '..', '..', 'REGISTRO DE EXTINTORES.xlsx');
  
  try {
    await workbook.xlsx.readFile(filePath);
  } catch (e) {
    console.error('[Seed-Extintores] Error al leer el archivo Excel:', e.message);
    process.exit(1);
  }

  const sheet = workbook.getWorksheet(1);
  const rowCount = sheet.rowCount;
  const colCount = sheet.columnCount;

  let insertados = 0;
  let guarderiasProcesadas = 0;

  // Recorrido por columnas: cada columna identifica una guardería institucional.
  for (let c = 3; c <= colCount; c++) {
    const clave = sheet.getRow(1).getCell(c).value;
    if (!clave) continue;

    guarderiasProcesadas++;
    let numExtintor = 1;

    // Recorrido por bloques de filas: cada bloque de 7 filas define un equipo extintor individual.
    for (let r = 4; r <= rowCount; r += 7) {
      const modelo = sheet.getRow(r).getCell(c).value;
      const capacidad = sheet.getRow(r + 1).getCell(c).value;
      const unidad = sheet.getRow(r + 2).getCell(c).value;
      const cantidad = sheet.getRow(r + 3).getCell(c).value;
      const mantenimiento = sheet.getRow(r + 4).getCell(c).value;
      const vencimiento = sheet.getRow(r + 5).getCell(c).value;

      // Validación de integridad mínima para omitir registros vacíos.
      if (!modelo && !vencimiento) continue;

      try {
        await pool.query(
          `INSERT INTO extintores (
            guarderia_clave, numero_extintor, modelo, capacidad, unidad, cantidad, 
            ultimo_mantenimiento, fecha_vencimiento
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            String(clave).trim(),
            numExtintor++,
            modelo ? String(modelo).trim() : null,
            capacidad ? parseFloat(capacidad) : null,
            unidad ? String(unidad).trim() : null,
            cantidad ? parseInt(cantidad, 10) : 1,
            mantenimiento instanceof Date ? mantenimiento : null,
            vencimiento instanceof Date ? vencimiento : null
          ]
        );
        insertados++;
      } catch (err) {
        console.error(`[Seed-Extintores] Error en inserción de extintor ${numExtintor-1} para la clave ${clave}:`, err.message);
      }
    }
  }

  console.log(`[Seed-Extintores] Informe de resultados:`);
  console.log(`- Guarderías procesadas: ${guarderiasProcesadas}`);
  console.log(`- Extintores insertados: ${insertados}`);
}

seedExtintores()
  .then(() => {
    console.log('[Seed-Extintores] Proceso completado exitosamente.');
    process.exit(0);
  })
  .catch(err => {
    console.error('[Seed-Extintores] Error crítico durante la ejecución:', err);
    process.exit(1);
  });

