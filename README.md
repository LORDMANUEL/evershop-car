# Plataforma de Gestión de Taller Automotriz bylmfr

Este repositorio contiene una plataforma integral para la gestión de talleres automotrices con soporte multi-sucursal, portal de clientes con experiencia 3D, módulos de inventario, facturación compatible con SAR Honduras y herramientas administrativas.

## Estructura del repositorio

- `backend/`: API REST construida con Node.js, Express y Prisma sobre PostgreSQL.
- `frontend/`: Aplicación SPA construida con React y Vite.
- `scripts/`: Scripts de despliegue y utilidades (por ejemplo instalador para Ubuntu).
- `docs/`: Documentación técnica y manuales.

## Requisitos

- Node.js 18+
- npm 9+
- PostgreSQL 14+
- Python 3 (para ejecutar scripts auxiliares opcionales)

## Instalación rápida en Ubuntu

```bash
./scripts/install.sh
```

El instalador crea la base de datos, instala dependencias, ejecuta migraciones y compila el frontend.

## Variables de entorno

Copiar `.env.example` a `.env` en la carpeta `backend` y `frontend` y ajustar según el entorno.

## Ejecución en desarrollo

En una terminal:

```bash
cd backend
npm run dev
```

En otra terminal:

```bash
cd frontend
npm run dev
```

La aplicación web estará disponible en `http://localhost:5173` y consumirá la API en `http://localhost:3000`.

## Pruebas

El backend incluye pruebas automatizadas con Jest. Ejecutar:

```bash
cd backend
npm test
```

## Despliegue

El script `install.sh` también puede utilizarse como guía para el despliegue manual en servidores Ubuntu. Se recomienda configurar Nginx como reverse proxy y habilitar HTTPS.

Para mayor detalle revisar la documentación en `docs/`.
