# SDA - Sistema de Administración de Documentos

El Sistema de Administración de Documentos (SDA) es un proyecto desarrollado para la gestión, control y alerta de expedientes institucionales. 
Esta versión (2.0.0) utilizando una arquitectura apoyada en React, Express y Electron.


## Estructura del Código

El código está estructurado en tres áreas para separar las responsabilidades:

### 1. Lógica de Negocio y Backend (`/server`)
Contiene el servidor Express, el manejo de la base de datos y la API REST.
* `/routes`: Controladores de los endpoints (Autenticación, Expedientes, Guarderías, Catálogos, etc.).
* `/db`: Lógica de conexión con PostgreSQL y scripts de inicialización de datos.
* `/cron`: Tareas automáticas en segundo plano (motor de revisión de vigencias y correos).
* `/utils`: Funciones auxiliares (cálculo de semáforos, configuración de plantillas).

### 2. Interfaz de Usuario (`/frontend/src`)
Contiene la aplicación de lado del Trabajdor del departamento de guarderias en React.
* `/pages`: Vistas principales a las que el usuario accede (Dashboard, Expediente individual, Ajustes).
* `/components`: Elementos gráficos (Menú lateral, encabezado, layouts).
* `/context`: Gestor para la sesión del usuario.

### 3. Entorno de Aplicación de Escritorio (`raíz del proyecto`)
Archivos encargados de levantar la aplicación como un programa de escritorio para Windows utilizando Electron.
* `main.js`: Maneja el ciclo de vida de la ventana y el servidor local de Node.
* `preload.js`: Puente de seguridad (IPC) entre el entorno de escritorio y el entorno web.

## Requisitos para Compilación Local
* Node.js (v18.0.0+)
* PostgreSQL (Servicio activo)

## Comandos Principales

Instalación de todas las dependencias (Backend y Frontend):
```bash
npm install
npm install --prefix frontend
```

Ejecución conjunta en modo desarrollo:
```bash
# Terminal 1: Inicia Vite
npm run frontend:dev

# Terminal 2: Inicia Express y Electron
npm run dev
```

## Autor
**Oscar Alberto Valenzuela Osuna**
