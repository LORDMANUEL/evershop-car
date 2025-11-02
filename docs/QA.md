# QA · Fase 3 → Fase 4

## Objetivo actual

Validar que la API sin dependencias externas cubre:

- Transferencias multi-sucursal con doble validación (solicitud → aprobación → recepción).
- Auditorías con bitácora y ajustes opcionales.
- Emisión SAR (series activas, facturas y notas de crédito).
- Conciliaciones contables por periodo.

## Checklist funcional

- [x] `/api/v1/inventory/transfers` crea solicitudes con stock reservado.
- [x] `/api/v1/inventory/transfers/:id/approve` descuenta existencias en origen.
- [x] `/api/v1/inventory/transfers/:id/receive` acredita existencias en destino.
- [x] `/api/v1/inventory/audits` inicia sesión de auditoría.
- [x] `/api/v1/inventory/audits/:id/records` registra hallazgos y ajustes.
- [x] `/api/v1/billing/invoices` emite factura con correlativo CAI.
- [x] `/api/v1/billing/credit-notes` marca factura como acreditada y genera asiento inverso.
- [x] `/api/v1/accounting/reconciliations` resume débitos/créditos y diferencias.

## Automatización mínima

Ejecutar en CI o localmente:

```bash
node backend/src/tests/run-tests.js
```

Cobertura actual: flujos críticos de login, transferencias y asiento contable. 

## Próxima iteración (Fase 4)

1. Añadir pruebas HTTP end-to-end usando `fetch` nativo.
2. Registrar métricas ligeras (latencia y errores) en `backend/data/metrics.json`.
3. Automatizar reconciliaciones nocturnas via `cron` + script en `scripts/scheduler.sh`.
4. Documentar casos de regresión detectados durante QA manual.

## Incidencias abiertas

| ID | Descripción | Estado |
|----|-------------|--------|
| QA-403 | Error de registro npm en entornos restringidos | **Resuelto**: eliminado uso de npm |
| QA-INV-02 | Ajustes de auditoría sin responsable opcional | Pendiente: agregar campo `reviewedBy` |

