import { Router } from '../lib/router.js';
import { authenticate, authorize } from '../lib/auth.js';
import { readDatabase, withDatabase, generateId } from '../lib/db.js';
import { sendError, sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/inventory' });

function getStockRecord(db, itemId, branchId) {
  let stock = db.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === branchId);
  if (!stock) {
    stock = { id: generateId('stock'), itemId, branchId, quantity: 0 };
    db.inventoryStocks.push(stock);
  }
  return stock;
}

function appendTimeline(transfer, status, userId, note) {
  transfer.timeline = transfer.timeline || [];
  transfer.timeline.push({ status, userId, note: note || null, at: new Date().toISOString() });
}

router.get('/items', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const db = await readDatabase();
  const items = db.inventoryItems.map((item) => {
    const stocks = db.inventoryStocks
      .filter((stock) => stock.itemId === item.id)
      .map((stock) => ({ branchId: stock.branchId, quantity: stock.quantity }));
    return { ...item, stocks };
  });
  sendJson(res, 200, items);
});

router.post('/items', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.sku || !body.name || !body.price || !body.cost) {
      throw new Error('Campos requeridos: sku, name, price, cost');
    }
    const item = await withDatabase(async (db) => {
      if (db.inventoryItems.some((i) => i.sku === body.sku)) {
        throw new Error('Ya existe un repuesto con ese SKU');
      }
      const newItem = {
        id: generateId('item'),
        sku: body.sku,
        name: body.name,
        brand: body.brand || null,
        compatibleModels: body.compatibleModels || [],
        cost: Number(body.cost),
        price: Number(body.price),
        unit: body.unit || 'UND',
        minStock: body.minStock || 0,
        createdAt: new Date().toISOString()
      };
      db.inventoryItems.push(newItem);
      if (Array.isArray(body.initialStock)) {
        body.initialStock.forEach((entry) => {
          const stock = getStockRecord(db, newItem.id, entry.branchId);
          stock.quantity = Number(entry.quantity || 0);
        });
      }
      return newItem;
    });
    sendJson(res, 201, item);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.get('/transfers', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const db = await readDatabase();
  const transfers = db.inventoryTransfers.filter((transfer) => {
    if (user.role === 'SUPER_ADMIN') return true;
    return transfer.fromBranchId === user.branchId || transfer.toBranchId === user.branchId;
  });
  sendJson(res, 200, transfers);
});

router.post('/transfers', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.itemId || !body.toBranchId || !body.quantity) {
      throw new Error('itemId, toBranchId y quantity son requeridos');
    }
    const transfer = await withDatabase(async (db) => {
      const item = db.inventoryItems.find((i) => i.id === body.itemId);
      if (!item) throw new Error('Repuesto no encontrado');
      const fromBranchId = body.fromBranchId || user.branchId;
      if (!fromBranchId) throw new Error('Debe indicar sucursal origen');
      if (fromBranchId === body.toBranchId) throw new Error('Sucursal destino debe ser distinta');
      const stock = getStockRecord(db, item.id, fromBranchId);
      if (stock.quantity < Number(body.quantity)) {
        throw new Error('Stock insuficiente en sucursal origen');
      }
      const newTransfer = {
        id: generateId('transfer'),
        itemId: item.id,
        quantity: Number(body.quantity),
        fromBranchId,
        toBranchId: body.toBranchId,
        requestedBy: user.id,
        approvedBy: null,
        receivedBy: null,
        status: 'REQUESTED',
        note: body.note || null,
        timeline: []
      };
      appendTimeline(newTransfer, 'REQUESTED', user.id, 'Solicitud creada');
      db.inventoryTransfers.push(newTransfer);
      return newTransfer;
    });
    sendJson(res, 201, transfer);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/transfers/:id/approve', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const { id } = req.params;
  try {
    const transfer = await withDatabase(async (db) => {
      const record = db.inventoryTransfers.find((t) => t.id === id);
      if (!record) throw new Error('Transferencia no encontrada');
      if (record.status !== 'REQUESTED') throw new Error('La transferencia ya fue procesada');
      if (user.role !== 'SUPER_ADMIN' && record.fromBranchId !== user.branchId) {
        throw new Error('Solo puede aprobar transferencias de su sucursal');
      }
      const stock = getStockRecord(db, record.itemId, record.fromBranchId);
      if (stock.quantity < record.quantity) throw new Error('Stock insuficiente');
      stock.quantity -= record.quantity;
      record.status = 'IN_TRANSIT';
      record.approvedBy = user.id;
      appendTimeline(record, 'APPROVED', user.id, 'Aprobado y enviado');
      appendTimeline(record, 'IN_TRANSIT', user.id, 'En tránsito');
      return record;
    });
    sendJson(res, 200, transfer);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/transfers/:id/receive', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const { id } = req.params;
  try {
    const transfer = await withDatabase(async (db) => {
      const record = db.inventoryTransfers.find((t) => t.id === id);
      if (!record) throw new Error('Transferencia no encontrada');
      if (record.status !== 'IN_TRANSIT') throw new Error('La transferencia no está en tránsito');
      if (user.role !== 'SUPER_ADMIN' && record.toBranchId !== user.branchId) {
        throw new Error('Solo puede recibir transferencias de su sucursal');
      }
      const stock = getStockRecord(db, record.itemId, record.toBranchId);
      stock.quantity += record.quantity;
      record.status = 'COMPLETED';
      record.receivedBy = user.id;
      appendTimeline(record, 'COMPLETED', user.id, 'Transferencia completada');
      return record;
    });
    sendJson(res, 200, transfer);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/audits', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    const branchId = body.branchId || user.branchId;
    if (!branchId) throw new Error('Debe indicar sucursal a auditar');
    const audit = await withDatabase(async (db) => {
      const session = {
        id: generateId('audit'),
        branchId,
        startedBy: user.id,
        startedAt: new Date().toISOString(),
        finishedAt: null,
        status: 'OPEN'
      };
      db.inventoryAudits.push(session);
      return session;
    });
    sendJson(res, 201, audit);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/audits/:id/records', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const { id } = req.params;
  const body = req.body || {};
  try {
    if (!body.itemId || body.counted === undefined) {
      throw new Error('itemId y counted son requeridos');
    }
    const record = await withDatabase(async (db) => {
      const audit = db.inventoryAudits.find((a) => a.id === id);
      if (!audit) throw new Error('Auditoría no encontrada');
      if (audit.status !== 'OPEN') throw new Error('La auditoría está cerrada');
      if (user.role !== 'SUPER_ADMIN' && audit.branchId !== user.branchId) {
        throw new Error('Solo puede registrar auditorías de su sucursal');
      }
      const stock = getStockRecord(db, body.itemId, audit.branchId);
      const difference = Number(body.counted) - stock.quantity;
      const entry = {
        id: generateId('audit-record'),
        auditId: audit.id,
        itemId: body.itemId,
        counted: Number(body.counted),
        systemQuantity: stock.quantity,
        difference,
        note: body.note || null,
        createdBy: user.id,
        createdAt: new Date().toISOString()
      };
      db.inventoryAuditRecords.push(entry);
      if (body.adjust === true) {
        stock.quantity = Number(body.counted);
      }
      return entry;
    });
    sendJson(res, 201, record);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/audits/:id/close', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const { id } = req.params;
  try {
    const audit = await withDatabase(async (db) => {
      const session = db.inventoryAudits.find((a) => a.id === id);
      if (!session) throw new Error('Auditoría no encontrada');
      if (session.status !== 'OPEN') throw new Error('La auditoría ya está cerrada');
      if (user.role !== 'SUPER_ADMIN' && session.branchId !== user.branchId) {
        throw new Error('Solo puede cerrar auditorías de su sucursal');
      }
      session.status = 'CLOSED';
      session.finishedAt = new Date().toISOString();
      return session;
    });
    sendJson(res, 200, audit);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

export default router;
