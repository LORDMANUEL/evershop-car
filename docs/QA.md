# QA y verificación de Fase 3

Este documento resume el alcance de control de calidad para la Fase 3 (profundización funcional) y prepara el terreno para la entrada a la Fase 4 (calidad y pruebas).

## Alcance cubierto

Las validaciones se enfocan en los entregables recién incorporados:

- **Transferencias multi-sucursal** con aprobación dual, generación de códigos secuenciales (`TRF-00001`, ...), registros de bitácora y ajustes de inventario coordinados.
- **Auditorías de inventario** con sesiones, conteos físicos, diferencias y cierres con movimientos automáticos y logging.
- **Gestión fiscal SAR** por sucursal (series CAI activas/inactivas, asignación de folios, emisión de facturas y notas de crédito).
- **Conciliaciones contables** que consolidan ventas, notas de crédito, compras y asientos auxiliares para revisión financiera.

## Automatización esperada

| Componente | Comando | Objetivo |
|------------|---------|----------|
| Backend | `npm install` | Resolver dependencias y preparar el entorno de pruebas. |
| Backend | `npx prisma migrate deploy` | Aplicar el esquema actualizado con transferencias, auditorías y conciliaciones. |
| Backend | `npm run seed` | Registrar sucursales, series fiscales y datos demo multi-sucursal. |
| Backend | `npm test` | Ejecutar la suite Jest (incluyendo smoke tests de `/health`). |
| Frontend | `cd ../frontend && npm install` | Instalar dependencias de la SPA React/Vite. |
| Frontend | `npm run test` | Validar componentes clave (Garage, Dashboard, formularios) con Vitest. |

> **Nota:** En este entorno aislado los comandos de instalación (`npm install`) responden con `403 Forbidden`. Se requiere ejecutar las pruebas en un entorno con acceso a `registry.npmjs.org`.

## Checklist de QA manual

1. **Transferencias multi-sucursal**
   - Crear una transferencia desde la sucursal MAIN a EAST.
   - Aprobar en sucursal origen y recibir en sucursal destino verificando que los movimientos `TRANSFER_OUT`/`TRANSFER_IN` se registran correctamente.
   - Confirmar que `inventoryTransfer` cambia a `RECEIVED` y que el stock se actualiza en ambas sucursales.
2. **Auditorías de inventario**
   - Abrir sesión con código automático `AUD-xxxxx`.
   - Registrar conteos divergentes y validar que se crean movimientos de ajuste con `difference` correcto y bitácora en `auditLog`.
   - Cerrar sesión y revisar reporte de diferencias.
3. **Facturación SAR y notas de crédito**
   - Emitir factura en sucursal MAIN asegurando que el folio respete la serie activa.
   - Generar nota de crédito ligada a la factura y comprobar que el stock retorna y la conciliación reconoce el documento.
4. **Conciliaciones contables**
   - Ejecutar conciliación en rango que incluya facturas y notas de crédito.
   - Revisar que `accountingReconciliation` se marque como `COMPLETED` y que los `reconciliationLines` reflejen totales correctos.

## Resultados en el entorno actual

- `npm install` (backend) → **Fallido** por restricciones de acceso (`403 Forbidden`).
- `npm install` (frontend) → **Pendiente** por la misma limitante.
- Suites automatizadas → **No ejecutadas** en este contenedor; requieren entorno con conectividad externa.

## Incidencias abiertas y mitigaciones

| ID | Descripción | Estado | Mitigación |
|----|-------------|--------|------------|
| QA-403 | `npm install` devuelve `403 Forbidden` al descargar paquetes (ej. `@prisma/client`). | Bloqueante en entorno sin acceso público. | Se actualizó `scripts/install.sh` para aceptar `NPM_REGISTRY` y se documentó en el README cómo apuntar a un registro accesible o autenticar con token antes de ejecutar el instalador. |

## Defectos detectados y corregidos (2025-11-02)

| Hallazgo | Riesgo | Corrección aplicada |
|----------|--------|---------------------|
| Facturación sin descuento de inventario ni bitácora de movimientos. | Venta de repuestos no reflejaba salidas, afectando conciliaciones y auditoría. | Se valida stock disponible por producto, se descuenta la existencia en la misma transacción y se registra movimiento `SALE` con referencia a la factura. |
| Cantidades decimales permitidas en líneas de factura. | Incompatibilidad con el esquema (`Int`) y riesgo de saldos incoherentes al calcular inventario. | Se reforzó el esquema Zod para aceptar solo cantidades enteras positivas. |

## Próximos pasos hacia la Fase 4

- Restablecer conectividad a `registry.npmjs.org` y ejecutar las suites mencionadas.
- Configurar pipeline CI (lint → test → build) y umbrales de cobertura ≥ 80% para módulos core.
- Incorporar pruebas Playwright que recorran transferencias, auditorías y emisión de notas de crédito desde la interfaz.
- Centralizar resultados (logs estructurados y métricas) en el dashboard de observabilidad planificado.
