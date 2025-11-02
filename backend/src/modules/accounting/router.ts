import { Router } from 'express';
import {
  AccountingEntryType,
  Prisma,
  ReconciliationStatus,
  Role
} from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

const accountSchema = z.object({
  code: z.string(),
  name: z.string(),
  type: z.string()
});

const entrySchema = z.object({
  accountId: z.string(),
  invoiceId: z.string().optional(),
  purchaseId: z.string().optional(),
  amount: z.number(),
  type: z.nativeEnum(AccountingEntryType),
  description: z.string().optional()
});

const purchaseSchema = z.object({
  number: z.string(),
  supplierId: z.string(),
  branchId: z.string(),
  status: z.string().default('RECEIVED'),
  total: z.number(),
  lines: z.array(
    z.object({
      productId: z.string(),
      quantity: z.number().int().positive(),
      unitCost: z.number().positive()
    })
  )
});

const reconciliationSchema = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
  autoClose: z.boolean().default(true)
});

router.get('/accounts', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]), async (_req, res) => {
  const accounts = await prisma.accountingAccount.findMany({ orderBy: { code: 'asc' } });
  res.json(accounts);
});

router.post('/accounts', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]), async (req, res) => {
  try {
    const data = accountSchema.parse(req.body);
    const account = await prisma.accountingAccount.create({ data });
    res.status(201).json(account);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/entries', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]), async (req, res) => {
  const { from, to } = req.query;
  const entries = await prisma.accountingEntry.findMany({
    where: {
      date: {
        gte: from ? new Date(String(from)) : undefined,
        lte: to ? new Date(String(to)) : undefined
      }
    },
    include: { account: true, invoice: true, purchase: true },
    orderBy: { date: 'desc' }
  });
  res.json(entries);
});

router.post('/entries', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]), async (req, res) => {
  try {
    const data = entrySchema.parse(req.body);
    const entry = await prisma.accountingEntry.create({ data });
    res.status(201).json(entry);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/purchases', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.INVENTORY_MANAGER]), async (req, res) => {
  try {
    const data = purchaseSchema.parse(req.body);
    const authReq = req as AuthRequest;
    const purchase = await prisma.$transaction(async (tx) => {
      const order = await tx.purchaseOrder.create({
        data: {
          number: data.number,
          supplierId: data.supplierId,
          branchId: data.branchId,
          status: data.status,
          total: data.total,
          lines: {
            create: data.lines
          }
        },
        include: { lines: true }
      });

      if (data.status === 'RECEIVED') {
        for (const line of data.lines) {
          await tx.inventoryStock.upsert({
            where: { productId_branchId: { productId: line.productId, branchId: data.branchId } },
            create: { productId: line.productId, branchId: data.branchId, quantity: line.quantity },
            update: { quantity: { increment: line.quantity } }
          });
          await tx.inventoryMovement.create({
            data: {
              productId: line.productId,
              branchId: data.branchId,
              quantity: line.quantity,
              type: 'PURCHASE',
              reference: order.number,
              userId: authReq.user?.id ?? null
            }
          });
        }
      }

      await tx.accountingEntry.create({
        data: {
          accountId: await ensureInventoryAccount(tx),
          purchaseId: order.id,
          amount: data.total,
          type: AccountingEntryType.DEBIT,
          description: 'Compra de inventario'
        }
      });

      return order;
    });

    res.status(201).json(purchase);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

const ensureInventoryAccount = async (tx: Prisma.TransactionClient) => {
  const existing = await tx.accountingAccount.findUnique({ where: { code: '1105' } });
  if (existing) {
    return existing.id;
  }
  const created = await tx.accountingAccount.create({
    data: {
      code: '1105',
      name: 'Inventario de Repuestos',
      type: 'Activo'
    }
  });
  return created.id;
};

router.get('/summary', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.BRANCH_MANAGER]), async (req, res) => {
  const { from, to } = req.query;
  const fromDate = from ? new Date(String(from)) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const toDate = to ? new Date(String(to)) : new Date();

  const [sales, purchases, expenses, creditNotes] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true, tax: true },
      where: { issueDate: { gte: fromDate, lte: toDate } }
    }),
    prisma.purchaseOrder.aggregate({
      _sum: { total: true },
      where: { createdAt: { gte: fromDate, lte: toDate } }
    }),
    prisma.accountingEntry.aggregate({
      _sum: { amount: true },
      where: { type: AccountingEntryType.DEBIT, description: { contains: 'Gasto' } }
    }),
    prisma.creditNote.aggregate({
      _sum: { total: true },
      where: { issuedAt: { gte: fromDate, lte: toDate } }
    })
  ]);

  const creditTotal = creditNotes._sum.total ?? 0;
  res.json({
    sales: (sales._sum.total ?? 0) - creditTotal,
    tax: sales._sum.tax ?? 0,
    purchases: purchases._sum.total ?? 0,
    expenses: expenses._sum.amount ?? 0,
    creditNotes: creditTotal,
    netIncome:
      (sales._sum.total ?? 0) -
      creditTotal -
      (purchases._sum.total ?? 0) -
      (expenses._sum.amount ?? 0)
  });
});

router.get(
  '/reconciliations',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]),
  async (req, res) => {
    const reconciliations = await prisma.accountingReconciliation.findMany({
      include: { createdBy: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(reconciliations);
  }
);

router.post(
  '/reconciliations/auto',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]),
  async (req, res) => {
    try {
      const payload = reconciliationSchema.parse(req.body);
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const fromDate = new Date(payload.from);
      const toDate = new Date(payload.to);

      const [invoices, creditNotes, payments, entries] = await Promise.all([
        prisma.invoice.aggregate({
          _sum: { total: true },
          where: { issueDate: { gte: fromDate, lte: toDate } }
        }),
        prisma.creditNote.aggregate({
          _sum: { total: true },
          where: { issuedAt: { gte: fromDate, lte: toDate } }
        }),
        prisma.payment.aggregate({
          _sum: { amount: true },
          where: { paidAt: { gte: fromDate, lte: toDate } }
        }),
        prisma.accountingEntry.groupBy({
          by: ['type'],
          where: { date: { gte: fromDate, lte: toDate } },
          _sum: { amount: true }
        })
      ]);

      const invoiceTotal = invoices._sum.total ?? 0;
      const creditTotal = creditNotes._sum.total ?? 0;
      const paymentTotal = payments._sum.amount ?? 0;
      const debitTotal = entries.find((e) => e.type === AccountingEntryType.DEBIT)?._sum.amount ?? 0;
      const creditEntryTotal = entries.find((e) => e.type === AccountingEntryType.CREDIT)?._sum.amount ?? 0;

      const difference = Number(
        (invoiceTotal - creditTotal - paymentTotal + (debitTotal - creditEntryTotal)).toFixed(2)
      );

      const reconciliation = await prisma.accountingReconciliation.create({
        data: {
          periodStart: fromDate,
          periodEnd: toDate,
          difference,
          status:
            difference === 0 && payload.autoClose
              ? ReconciliationStatus.COMPLETED
              : ReconciliationStatus.OPEN,
          details: {
            invoiceTotal,
            creditTotal,
            paymentTotal,
            debitTotal,
            creditEntryTotal
          },
          createdById: authReq.user.id
        },
        include: { createdBy: true }
      });

      res.status(201).json(reconciliation);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

export default router;
