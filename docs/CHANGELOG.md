# Changelog

## 2025-11-02 · Eliminación de dependencias npm (Fase 3 consolidada)

- Reescritura completa del backend en Node.js nativo (sin Express, Prisma ni paquetes externos).
- Implementación de almacenamiento JSON transaccional y seed multi-sucursal.
- Rutas para transferencias, auditorías, facturación SAR y conciliaciones.
- Panel frontend estático sin compilación (HTML + CSS + JS vanilla).
- Script de pruebas básicas con `node:test`.
- Documentación QA y roadmap actualizados.

## 2025-10-30 · (Histórico) Instalador con npm *(deprecado)*

- Se removió esta aproximación por incompatibilidades `npm ERR! code E403`.

