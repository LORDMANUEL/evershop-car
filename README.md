# Plataforma Integral de Taller Automotriz

> **Estado**: Fase 3 completada · Fase 4 enfocada en QA y automatización.

Este repositorio contiene una implementación sin dependencias externas que cubre los flujos críticos del blueprint del taller automotriz: inventario multi-sucursal, facturación SAR, conciliaciones contables y panel web ligero. Se eliminó la dependencia de `npm install` para operar en entornos restringidos: todo el código se ejecuta con Node.js estándar y recursos estáticos.

## Estructura

```text
backend/        API HTTP en Node.js nativo (sin paquetes externos)
  data/         Base de datos JSON con datos de muestra multi-sucursal
  src/
    controllers/ Rutas para autenticación, inventario, facturación y contabilidad
    lib/         Utilidades de almacenamiento, seguridad y ruteo
    tests/       Pruebas básicas usando `node:test`
frontend/       Panel estático (HTML, CSS, JS vanilla) que consulta la API
scripts/        Utilidades de despliegue (instalación sin npm, monitoreo)
docs/           Roadmap por fases, guía QA y bitácora de incidencias
```

## Requisitos

- Node.js 18+
- Opcional: `pm2` o `systemd` para ejecutar el backend como servicio

No se requieren `npm install` ni gestores externos.

## Puesta en marcha

```bash
# 1. Iniciar la API
cd backend
node src/server.js

# 2. Ejecutar pruebas
node src/tests/run-tests.js

# 3. Abrir el panel
cd ..
python3 -m http.server --directory frontend 5173
# Visite http://localhost:5173 y defina la URL de la API si está en otro host
```

El backend expone `http://localhost:3000`. El panel utiliza las credenciales sembradas (`admin@taller.local` / `admin123`) para consultas internas.

## API destacada

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/health` | GET | Diagnóstico general de la API |
| `/api/v1/auth/login` | POST | Autenticación basada en PBKDF2 + tokens HMAC |
| `/api/v1/inventory/items` | GET | Catálogo de repuestos y stock por sucursal |
| `/api/v1/inventory/transfers` | POST | Solicitud de transferencia con doble validación |
| `/api/v1/inventory/audits` | POST | Inicia auditoría con bitácora y ajustes opcionales |
| `/api/v1/billing/invoices` | POST | Emite factura SAR usando series CAI activas |
| `/api/v1/billing/credit-notes` | POST | Genera notas de crédito y asientos inversos |
| `/api/v1/accounting/reconciliations` | POST | Consolida débitos/créditos por periodo |

## Roadmap por fases

| Estado | Fase | Enfoque |
|--------|------|---------|
| ✅ | Fase 1 · Fundaciones | Estructura sin dependencias, seed multi-sucursal |
| ✅ | Fase 2 · Prototipo funcional | API nativa, panel estático y scripts de QA |
| ✅ | **Fase 3 · Profundización funcional** | Transferencias con doble validación, auditorías completas, series SAR activas y conciliaciones trimestrales |
| ⏳ | Fase 4 · Calidad y pruebas | Ampliar cobertura con `node:test`, observabilidad ligera y pipeline sin npm |
| ⏳ | Fase 5 · Experiencia de usuario | Mejoras UX del portal estático (estados offline, hotspots 3D opcionales) |
| ⏳ | Fase 6 · Preparación productiva | Hardening, respaldos crontab y manuales operativos finales |

### Entregables cerrados en Fase 3

- Transferencias multi-sucursal con reservas de stock, seguimiento de línea de tiempo y recepción controlada.
- Auditorías de inventario con registros y ajuste opcional del conteo físico.
- Facturación SAR sin dependencias externas: series CAI, emisión y notas de crédito.
- Conciliaciones contables con bitácora de asientos y diferencias por periodo.
- Documentación de QA para iniciar la Fase 4 (ver `docs/QA.md`).

## Solución al error `npm ERR! code E403`

Todos los comandos que dependían de `npm install` fueron reemplazados por scripts y código nativo. No es necesario configurar proxies ni tokens. Si se requiere reinstalar, basta con:

```bash
rm backend/data/database.json # opcional, reinicia los datos
node backend/src/server.js
```

## Contribuir

1. Cree una rama (`git checkout -b feature/nueva-funcionalidad`).
2. Actualice `backend/src/tests/run-tests.js` con pruebas relevantes.
3. Documente el cambio en `docs/CHANGELOG.md`.
4. Abra un PR indicando la fase impactada.

## Licencia

[MIT](./LICENSE)
