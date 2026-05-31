# Kamux Backend - Sistema Core 🚀

Núcleo central de la plataforma Kamux, desarrollado sobre **NestJS** con arquitectura orientada a servicios. Se encarga de la gestión empresarial del sistema: control de acceso (JWT), persistencia en base de datos relacional (PostgreSQL via TypeORM), sincronización automática de letras y proxy de transmisión multimedia con soporte de rango parcial.

## 📊 Arquitectura de Microservicios
El sistema implementa un desacoplamiento de responsabilidades para optimizar recursos en infraestructura cloud:

1. **NestJS (Puerto 4000):** Gestiona la lógica de negocio, usuarios, playlists, caché en RAM e historial.
2. **Media Service (Puerto 5000):** Consume de forma local la pasarela de extracción multimedia tunelizada.

## 🎤 Funcionalidades Core
- **Módulo de Canciones e Historial:** Registro inteligente de reproducciones recientes en base de datos.
- **Caché en RAM y PostgreSQL:** Persistencia de metadatos y almacenamiento de URLs directas por un máximo de 5 horas para mitigar la tasa de peticiones a la red externa.
- **Pipeline de Letras Integrado:** Sincronización en tiempo real consumiendo la API de LRCLIB con normalización de metadata a dos niveles.
- **Transmisión de Rango Dinámico (HTTP 206):** Controlador optimizado para despachar bytes multimedia bajo demanda (Range: bytes=0-), permitiendo rebobinar pistas en el cliente de Angular de manera fluida.

## 🔐 Configuración de Seguridad en Red
Para evitar colisiones de firmas y bloqueos 403 Forbidden por parte de Google al leer los flujos binarios, el controlador de streaming inyecta de manera quirúrgica un agente de red compatible con el túnel SOCKS5 local para que Axios use la misma IP residencial de Cloudflare WARP.

## 🛠️ Comandos de Mantenimiento (Producción)

### Actualizar y Recompilar el Sistema
* git pull origin main
* npm install
* npm run build

### Reinicio Limpio del Proceso en PM2
Para purgar variables de entorno residuales en la memoria del gestor de procesos:
* pm2 delete kamux-backend
* pm2 start dist/main.js --name kamux-backend
* pm2 save