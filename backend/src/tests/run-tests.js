import test from 'node:test';
import assert from 'node:assert/strict';
import { login } from '../lib/auth.js';
import { resetDatabase, readDatabase, withDatabase, generateId } from '../lib/db.js';

await resetDatabase();

const adminCredentials = { email: 'admin@taller.local', password: 'admin123' };

await test('El administrador puede iniciar sesión con las credenciales sembradas', async () => {
  const { token, user } = await login(adminCredentials.email, adminCredentials.password);
  assert.ok(token.length > 10, 'token generado');
  assert.equal(user.role, 'SUPER_ADMIN');
});

await test('Las transferencias reservan stock al aprobar y completan al recibir', async () => {
  const dbBefore = await readDatabase();
  const itemId = dbBefore.inventoryItems[0].id;
  const fromBranch = 'branch-sanpedro';
  const toBranch = 'branch-tegucigalpa';
  const quantity = 5;

  let transferId;

  await withDatabase(async (db) => {
    const transfer = {
      id: generateId('transfer'),
      itemId,
      quantity,
      fromBranchId: fromBranch,
      toBranchId: toBranch,
      requestedBy: 'user-sanpedro-manager',
      approvedBy: null,
      receivedBy: null,
      status: 'REQUESTED',
      note: null,
      timeline: []
    };
    db.inventoryTransfers.push(transfer);
    transferId = transfer.id;
  });

  await withDatabase(async (db) => {
    const transfer = db.inventoryTransfers.find((t) => t.id === transferId);
    const origin = db.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === fromBranch);
    origin.quantity -= quantity;
    transfer.status = 'IN_TRANSIT';
    transfer.approvedBy = 'user-sanpedro-manager';
  });

  await withDatabase(async (db) => {
    const transfer = db.inventoryTransfers.find((t) => t.id === transferId);
    const destiny = db.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === toBranch);
    destiny.quantity += quantity;
    transfer.status = 'COMPLETED';
    transfer.receivedBy = 'user-sanpedro-manager';
  });

  const dbAfter = await readDatabase();
  const originAfter = dbAfter.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === fromBranch);
  const destinyAfter = dbAfter.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === toBranch);
  assert.equal(originAfter.quantity, dbBefore.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === fromBranch).quantity - quantity);
  assert.equal(destinyAfter.quantity, dbBefore.inventoryStocks.find((s) => s.itemId === itemId && s.branchId === toBranch).quantity + quantity);
});

await test('La creación de facturas aumenta la bitácora contable', async () => {
  const before = await readDatabase();
  const entriesBefore = before.accountingEntries.length;
  await withDatabase(async (db) => {
    const serie = db.fiscalSeries.find((s) => s.branchId === 'branch-sanpedro');
    const invoice = {
      id: generateId('invoice'),
      branchId: 'branch-sanpedro',
      serieId: serie.id,
      number: `${serie.prefix}-${String(serie.nextNumber).padStart(8, '0')}`,
      cai: serie.cai,
      issuedAt: new Date().toISOString(),
      customer: { name: 'Cliente QA', taxId: null, email: null },
      subtotal: 1000,
      tax: 150,
      total: 1150,
      currency: 'HNL',
      lines: [
        { id: generateId('invoice-line'), description: 'Servicio de prueba', quantity: 1, unitPrice: 1000, taxRate: 0.15 }
      ],
      workOrderId: null,
      status: 'EMITTED'
    };
    serie.nextNumber += 1;
    db.invoices.push(invoice);
    db.accountingEntries.push({
      id: generateId('entry'),
      source: 'INVOICE',
      sourceId: invoice.id,
      createdAt: invoice.issuedAt,
      debit: invoice.total,
      credit: invoice.subtotal,
      tax: invoice.tax,
      branchId: invoice.branchId
    });
  });
  const after = await readDatabase();
  assert.equal(after.accountingEntries.length, before.accountingEntries.length + 1);
});

console.log('Pruebas básicas completadas');
