# Arquitectura del Sistema

Este documento describe la arquitectura general de la plataforma de gestión de taller automotriz.

## Stack Tecnológico

- **Backend**: Node.js + Express + Prisma ORM sobre PostgreSQL.
- **Frontend**: React + Vite + TypeScript, con integración de Babylon.js para visualización 3D y Chart.js para analíticas.
- **Autenticación**: JWT con refresh tokens, BCrypt para hash de contraseñas.
- **Testing**: Jest y Supertest en backend, Vitest en frontend.
- **CI**: Scripts listos para integración en GitHub Actions.

## Módulos Principales

1. **Inventario**: Gestión de productos, movimientos, auditorías y stock por sucursal.
2. **Mano de Obra**: Catálogo de servicios, tarifas y registro de horas.
3. **Garage (Portal Cliente)**: Perfil del cliente, visualización 3D, historial y aprobación de presupuestos.
4. **Facturación (SAR)**: Emisión de facturas con cumplimiento de normativas hondureñas, numeración y PDF.
5. **Contabilidad**: Compras, cuentas por pagar/cobrar, libros contables básicos.
6. **Técnico**: Órdenes de servicio, diagnósticos, flujo de aprobación y cierre.
7. **Reportes & Dashboard**: Gráficos interactivos y reportes exportables.
8. **Marketing**: Campañas de notificación y recordatorios.
9. **OpenSignage**: Gestión de contenido multimedia y playlists para pantallas.
10. **Sucursales**: Multi-tienda, inventario distribuido y permisos por ubicación.
11. **Usuarios y Seguridad**: Roles, permisos, bitácora de auditoría y gestión de sesiones.

## Interacción entre Módulos

Los módulos comparten un núcleo de datos a través de Prisma. Las órdenes de servicio disparan flujos hacia inventario, facturación y contabilidad. Las aprobaciones del cliente se registran y notifican mediante el módulo de marketing. Los dashboards se nutren de vistas materializadas y endpoints dedicados.

## Estructura de Carpetas (Backend)

```
backend/
├── prisma/
│   ├── schema.prisma
│   └── seed.ts
├── src/
│   ├── app.ts
│   ├── server.ts
│   ├── config/
│   ├── middlewares/
│   ├── modules/
│   │   ├── inventory/
│   │   ├── labour/
│   │   ├── garage/
│   │   ├── billing/
│   │   ├── accounting/
│   │   ├── technician/
│   │   ├── reports/
│   │   ├── marketing/
│   │   ├── signage/
│   │   ├── branches/
│   │   └── users/
│   └── tests/
└── package.json
```

## Seguridad y Cumplimiento

- Cifrado de contraseñas con bcrypt.
- JWT almacenado en cookies httpOnly o almacenamiento seguro del frontend.
- Validación de datos con Zod.
- Auditoría automática en movimientos de inventario y facturación.
- Plantillas SAR configurables desde la base de datos.

## Despliegue

- Servicio systemd para backend (`/etc/systemd/system/taller.service`).
- Nginx como reverse proxy y servidor de archivos estáticos del frontend.
- Script de instalación prepara base de datos y corre migraciones.

## Escalabilidad

- Prisma con conexiones agrupadas.
- Vistas precomputadas para reportes intensivos.
- Cache opcional vía Redis (hook preparado en configuración).

