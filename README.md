# Kamux Backend - Núcleo Core de Datos y Negocio 🧠⚙️

Servidor backend robusto desarrollado sobre NestJS, encargado de orquestar la lógica de negocio central de la plataforma Kamux, la persistencia de datos relacionales, el control de acceso, y la comunicación con el microservicio híbrido de procesamiento multimedia.

---

## 🚀 Arquitectura del Core

El backend opera como la pasarela central de una arquitectura distribuida basada en microservicios, interactuando con las capas del cliente y de infraestructura multimedia de la siguiente manera:

**Flujo:** Angular App (Cliente) ➔ Kamux Backend (NestJS / Puerto 4000) ➔ Motor Híbrido Multiproyecto (Express / Puerto 5001) ➔ PostgreSQL (Base de datos)

### 📊 Gestión de Datos Limpios e Integridad
Tras la reestructuración del flujo inverso de catálogo, el backend procesa exclusivamente metadatos comerciales de estudio pre-validados. Esto blinda las transacciones de las tablas en PostgreSQL, impidiendo que títulos sucios de canales externos (sufijos corporativos, menciones de calidad o nombres de usuarios) corrompan el historial de reproducción o dupliquen entidades musicales de forma descontrolada.

---

## 🏗️ Características Principales

- **Orquestación de Entidades:** Control y modelado relacional de usuarios, canciones, listas de reproducción, historial y sincronización de metadatos de letras.
- **Persistencia de Alta Integridad:** Conexión y mapeo de datos mediante ORM directo a PostgreSQL, optimizado con operaciones en cascada para limpiezas y purgas completas de entorno.
- **Seguridad y Control:** Implementación de pipelines de validación de datos para solicitudes entrantes y despacho controlado de endpoints hacia el cliente Angular.
- **Canalización Híbrida de Medios:** Gateway de enlace que recibe las consultas de reproducción del cliente y las deriva de forma ágil hacia el pool dinámico del microservicio Express.

---

## ⚙️ Configuración del Entorno (Variables de Entorno)

Para inicializar el core en producción o desarrollo local, asegúrate de configurar tu archivo `.env` en la raíz del proyecto con las credenciales de tu base de datos y puertos de enlace:

- `PORT=4000`
- `DB_HOST=localhost`
- `DB_PORT=5432`
- `DB_USERNAME=postgres`
- `DB_PASSWORD=tu_contraseña_segura`
- `DB_DATABASE=kamux` *(Nombre de tu base de datos relacional)*
- `MEDIA_SERVICE_URL=http://localhost:5001` *(Dirección del Motor Híbrido Multiproyecto)*

---

## 🛠️ Comandos de Desarrollo y Mantenimiento

### Instalar Dependencias Locales

Descarga e instala todos los módulos y paquetes estructurales necesarios para el framework NestJS ejecutando:

- `npm install`

### Levantar Servidor en Desarrollo

Para compilar e inicializar el servidor localmente con escucha activa de cambios en caliente (Hot Reload) ejecuta:

- `npm run start:dev`

### Compilar y Desplegar en Producción

Genera la compilación de producción optimizada en JavaScript nativo dentro de la carpeta `dist/` para su ejecución permanente en el VPS mediante administradores de procesos (como PM2):

- `npm run build`
- `pm2 start dist/main.js --name kamux-backend`

---
*Desarrollado como parte del proyecto de arquitectura de sistemas para Kamux Music Platform.*