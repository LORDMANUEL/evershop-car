# Manual Operativo

## Inicio de sesión de demostración

- Usuario administrador: `admin@taller.com` / `Admin123*`
- Usuario cliente: `cliente@demo.com` / `Cliente123*`

## Módulos disponibles

### Inventario
- Registro y actualización de repuestos.
- Movimientos de entradas y salidas con auditoría.
- Alertas de stock bajo.

### Mano de obra
- Catálogo de servicios con tarifas.
- Integración con órdenes de servicio.

### Garage 3D
- Portal visual para clientes con modelos interactivos.
- Selección de repuestos compatibles por VIN.
- Historial de servicios.

### Facturación SAR
- Emisión de facturas con numeración autorizada.
- Exportación a PDF con formato preimpreso.

### Contabilidad
- Registro de compras, cuentas y asientos contables.
- Reporte financiero básico.

### Técnico
- Gestión completa del flujo de órdenes de servicio.
- Consumo de inventario por uso en taller.

### Reportes
- Tableros y gráficos para desempeño del taller.

### Marketing
- Campañas multicanal y notificaciones personalizadas.

### OpenSignage
- Carga de videos y playlists para pantallas.

## Pruebas automatizadas

```bash
cd backend
npm test
```

## Construcción del frontend

```bash
cd frontend
npm run build
```

## Semillas de datos

El comando `npm run seed` en `backend` carga usuarios y datos de ejemplo.
