import { Router } from '../lib/router.js';
import { authenticate, authorize } from '../lib/auth.js';
import { readDatabase, withDatabase, generateId } from '../lib/db.js';
import { sendError, sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/billing' });

function findSeriesForBranch(db, branchId) {
  const active = db.fiscalSeries.find((serie) => serie.branchId === branchId && serie.status === 'ACTIVE');
  if (!active) {
    throw new Error('No existe una serie fiscal activa para la sucursal');
  }
  const today = new Date().toISOString().slice(0, 10);
  if (active.expiresAt && active.expiresAt < today) {
    throw new Error('La serie fiscal está expirada');
  }
  if (active.nextNumber > active.endNumber) {
    throw new Error('La serie fiscal agotó su correlativo');
  }
  return active;
}

function buildInvoiceNumber(series) {
  const correlativo = String(series.nextNumber).padStart(8, '0');
  return `${series.prefix}-${correlativo}`;
}

router.get('/fiscal-series', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER', 'ACCOUNTANT', 'CASHIER'])(req, res);
  if (!canProceed) return;
  const db = await readDatabase();
  const series = db.fiscalSeries.filter((serie) => (user.role === 'SUPER_ADMIN' ? true : serie.branchId === user.branchId));
  sendJson(res, 200, series);
});

router.post('/fiscal-series', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.branchId || !body.cai || !body.prefix || !body.startNumber || !body.endNumber) {
      throw new Error('Campos requeridos: branchId, cai, prefix, startNumber, endNumber');
    }
    const serie = await withDatabase(async (db) => {
      const newSerie = {
        id: generateId('fiscal'),
        branchId: body.branchId,
        cai: body.cai,
        prefix: body.prefix,
        startNumber: Number(body.startNumber),
        endNumber: Number(body.endNumber),
        nextNumber: Number(body.startNumber),
        expiresAt: body.expiresAt || null,
        status: body.status || 'ACTIVE'
      };
      db.fiscalSeries.push(newSerie);
      return newSerie;
    });
    sendJson(res, 201, serie);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.patch('/fiscal-series/:id', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN'])(req, res);
  if (!canProceed) return;
  const { id } = req.params;
  const body = req.body || {};
  try {
    const serie = await withDatabase(async (db) => {
      const record = db.fiscalSeries.find((serie) => serie.id === id);
      if (!record) throw new Error('Serie no encontrada');
      ['status', 'expiresAt', 'endNumber'].forEach((field) => {
        if (body[field] !== undefined) record[field] = body[field];
      });
      return record;
    });
    sendJson(res, 200, serie);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.post('/invoices', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'ACCOUNTANT'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.branchId || !Array.isArray(body.items) || body.items.length === 0) {
      throw new Error('Debe indicar branchId y al menos un item');
    }
    const invoice = await withDatabase(async (db) => {
      const serie = findSeriesForBranch(db, body.branchId);
      const number = buildInvoiceNumber(serie);
      const lines = body.items.map((item) => {
        if (!item.description || item.quantity === undefined || item.unitPrice === undefined) {
          throw new Error('Cada línea requiere description, quantity y unitPrice');
        }
        return {
          id: generateId('invoice-line'),
          description: item.description,
          quantity: Math.round(Number(item.quantity)),
          unitPrice: Number(item.unitPrice),
          taxRate: Number(item.taxRate || body.taxRate || 0.15)
        };
      });
      const subtotal = lines.reduce((acc, line) => acc + line.quantity * line.unitPrice, 0);
      const tax = lines.reduce((acc, line) => acc + line.quantity * line.unitPrice * line.taxRate, 0);
      const total = subtotal + tax;
      const record = {
        id: generateId('invoice'),
        branchId: body.branchId,
        serieId: serie.id,
        number,
        cai: serie.cai,
        issuedAt: new Date().toISOString(),
        customer: {
          name: body.customer?.name || 'Consumidor Final',
          taxId: body.customer?.taxId || null,
          email: body.customer?.email || null
        },
        subtotal,
        tax,
        total,
        currency: body.currency || 'HNL',
        lines,
        workOrderId: body.workOrderId || null,
        status: 'EMITTED'
      };
      serie.nextNumber += 1;
      db.invoices.push(record);
      // Ajustar inventario por cada línea con itemId vinculado
      if (Array.isArray(body.inventoryAdjustments)) {
        body.inventoryAdjustments.forEach((adjust) => {
          const stock = db.inventoryStocks.find(
            (s) => s.itemId === adjust.itemId && s.branchId === body.branchId
          );
          if (stock) {
            stock.quantity = Math.max(0, stock.quantity - Math.round(Number(adjust.quantity || 0)));
          }
        });
      }
      db.accountingEntries.push({
        id: generateId('entry'),
        source: 'INVOICE',
        sourceId: record.id,
        createdAt: record.issuedAt,
        debit: total,
        credit: subtotal,
        tax,
        branchId: record.branchId
      });
      return record;
    });
    sendJson(res, 201, invoice);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.get('/invoices', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const db = await readDatabase();
  const invoices = db.invoices.filter((invoice) => (user.role === 'SUPER_ADMIN' ? true : invoice.branchId === user.branchId));
  sendJson(res, 200, invoices);
});

router.post('/credit-notes', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'ACCOUNTANT'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.invoiceId || !body.reason) {
      throw new Error('Debe indicar invoiceId y reason');
    }
    const creditNote = await withDatabase(async (db) => {
      const invoice = db.invoices.find((inv) => inv.id === body.invoiceId);
      if (!invoice) throw new Error('Factura no encontrada');
      if (invoice.status === 'CREDITED') throw new Error('La factura ya posee nota de crédito');
      const note = {
        id: generateId('credit-note'),
        invoiceId: invoice.id,
        branchId: invoice.branchId,
        amount: Number(body.amount || invoice.total),
        reason: body.reason,
        createdAt: new Date().toISOString(),
        createdBy: user.id
      };
      invoice.status = 'CREDITED';
      db.creditNotes.push(note);
      db.accountingEntries.push({
        id: generateId('entry'),
        source: 'CREDIT_NOTE',
        sourceId: note.id,
        createdAt: note.createdAt,
        debit: -note.amount,
        credit: 0,
        tax: 0,
        branchId: invoice.branchId
      });
      return note;
    });
    sendJson(res, 201, creditNote);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

export default router;
