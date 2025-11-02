# Roadmap de Implementación

| Fase | Objetivo | Entregables clave | Estado |
|------|----------|-------------------|--------|
| 1. Fundaciones | Sustituir dependencias externas | Router nativo, almacenamiento JSON, PBKDF2 | ✅ Completado |
| 2. Prototipo funcional | Probar flujos críticos | API nativa operativa, panel estático, seeds multi-sucursal | ✅ Completado |
| 3. Profundización funcional | Inventario avanzado y SAR | Transferencias doble validación, auditorías, facturación y conciliaciones | ✅ Completado |
| 4. Calidad y pruebas | QA automatizado y monitoreo | Tests HTTP adicionales, métricas básicas, bitácora de incidentes | ⏳ En progreso |
| 5. Experiencia de usuario | UX y portal cliente | Estados offline, hotspots 3D opcionales, tutoriales | ⏳ Pendiente |
| 6. Preparación productiva | Hardening y operación continua | Respaldos, runbooks, SLA, checklist lanzamiento | ⏳ Pendiente |

## Dependencias inter-fase

- F4 depende de los endpoints consolidados en F3 (se evitaron regresiones con `node:test`).
- F5 requiere métricas de F4 para priorizar mejoras UX.
- F6 necesita el backlog QA cerrado y documentación de procesos.

## Backlog abierto (prioridad F4)

1. Métricas ligeras (`/metrics` JSON) para tiempo de respuesta y errores.
2. Script `scripts/scheduler.sh` para reconciliaciones nocturnas (cron-friendly).
3. Endpoint `POST /api/v1/inventory/audits/:id/review` para capturar `reviewedBy`.
4. Test de regresión para notas de crédito parciales.

