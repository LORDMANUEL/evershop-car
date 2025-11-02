import { Router } from '../lib/router.js';
import { authenticate, authorize } from '../lib/auth.js';
import { readDatabase, withDatabase, generateId } from '../lib/db.js';
import { sendError, sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/accounting' });

router.get('/entries', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const db = await readDatabase();
  const entries = db.accountingEntries.filter((entry) => (user.role === 'SUPER_ADMIN' ? true : entry.branchId === user.branchId));
  sendJson(res, 200, entries);
});

router.post('/reconciliations', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'ACCOUNTANT'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    const branchId = body.branchId || user.branchId;
    if (!branchId) throw new Error('Debe indicar branchId');
    const periodStart = body.periodStart || new Date().toISOString().slice(0, 10);
    const periodEnd = body.periodEnd || periodStart;
    const reconciliation = await withDatabase(async (db) => {
      const entries = db.accountingEntries.filter((entry) => {
        const entryDate = entry.createdAt.slice(0, 10);
        return entry.branchId === branchId && entryDate >= periodStart && entryDate <= periodEnd;
      });
      const debit = entries.reduce((acc, entry) => acc + Number(entry.debit || 0), 0);
      const credit = entries.reduce((acc, entry) => acc + Number(entry.credit || 0), 0);
      const tax = entries.reduce((acc, entry) => acc + Number(entry.tax || 0), 0);
      const record = {
        id: generateId('reconciliation'),
        branchId,
        periodStart,
        periodEnd,
        generatedAt: new Date().toISOString(),
        generatedBy: user.id,
        totals: {
          debit,
          credit,
          tax,
          difference: debit - credit
        },
        entries: entries.map((entry) => ({ id: entry.id, source: entry.source, sourceId: entry.sourceId, debit: entry.debit, credit: entry.credit, tax: entry.tax }))
      };
      db.reconciliations.push(record);
      return record;
    });
    sendJson(res, 201, reconciliation);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.get('/reconciliations', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'ACCOUNTANT', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const db = await readDatabase();
  const records = db.reconciliations.filter((rec) => (user.role === 'SUPER_ADMIN' ? true : rec.branchId === user.branchId));
  sendJson(res, 200, records);
});

export default router;
