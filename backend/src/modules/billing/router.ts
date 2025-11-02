import { Router } from 'express';
import {
  FiscalDocumentType,
  InventoryMovementType,
  InvoiceType,
  Prisma,
  Role
} from '@prisma/client';
import { z } from 'zod';
import PDFDocument from 'pdfkit';

import env from '../../config/env';
import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

const invoiceLineSchema = z.object({
  description: z.string(),
  quantity: z.number().positive(),
  unitPrice: z.number().positive(),
  taxRate: z.number().min(0),
  productId: z.string().optional(),
  serviceId: z.string().optional()
});

const invoiceSchema = z.object({
  type: z.nativeEnum(InvoiceType),
  branchId: z.string(),
  customerId: z.string(),
  workOrderId: z.string().optional(),
  seriesId: z.string().optional(),
  lines: z.array(invoiceLineSchema)
});

const fiscalSeriesSchema = z
  .object({
    branchId: z.string(),
    documentType: z.nativeEnum(FiscalDocumentType),
    cai: z.string(),
    prefix: z.string(),
    startNumber: z.number().int().nonnegative(),
    endNumber: z.number().int().nonnegative(),
    nextNumber: z.number().int().nonnegative().optional(),
    expiresAt: z.string().datetime(),
    isActive: z.boolean().optional()
  })
  .refine((data) => data.startNumber <= data.endNumber, {
    message: 'El número inicial debe ser menor o igual al final',
    path: ['endNumber']
  });

const seriesUpdateSchema = fiscalSeriesSchema.partial();

const creditNoteSchema = z.object({
  invoiceId: z.string(),
  reason: z.string(),
  seriesId: z.string().optional(),
  lines: z.array(invoiceLineSchema)
});

const calculateTotals = (lines: z.infer<typeof invoiceLineSchema>[]) => {
  return lines.reduce(
    (acc, line) => {
      const subtotal = line.quantity * line.unitPrice;
      const tax = subtotal * (line.taxRate / 100);
      acc.subtotal += subtotal;
      acc.tax += tax;
      acc.total += subtotal + tax;
      return acc;
    },
    { subtotal: 0, tax: 0, total: 0 }
  );
};

const allocateDocumentNumber = async (
  tx: Prisma.TransactionClient,
  branchId: string,
  documentType: FiscalDocumentType,
  seriesId?: string
) => {
  const today = new Date();
  const series = seriesId
    ? await tx.fiscalSeries.findFirst({
        where: {
          id: seriesId,
          branchId,
          documentType,
          isActive: true
        }
      })
    : await tx.fiscalSeries.findFirst({
        where: {
          branchId,
          documentType,
          isActive: true
        },
        orderBy: { createdAt: 'asc' }
      });

  if (!series) {
    throw new Error('No hay series fiscales activas configuradas para la sucursal');
  }

  if (series.expiresAt < today) {
    await tx.fiscalSeries.update({
      where: { id: series.id },
      data: { isActive: false }
    });
    throw new Error('La serie fiscal seleccionada está expirada');
  }

  if (series.nextNumber > series.endNumber) {
    await tx.fiscalSeries.update({
      where: { id: series.id },
      data: { isActive: false }
    });
    throw new Error('El rango autorizado de la serie fiscal se ha agotado');
  }

  const padLength = Math.max(series.endNumber.toString().length, series.startNumber.toString().length);
  const number = `${series.prefix}${String(series.nextNumber).padStart(padLength, '0')}`;

  const nextNumber = series.nextNumber + 1;
  const stillActive = nextNumber <= series.endNumber && series.expiresAt >= today;

  await tx.fiscalSeries.update({
    where: { id: series.id },
    data: {
      nextNumber,
      isActive: stillActive
    }
  });

  return { number, series };
};

router.get(
  '/series',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]),
  async (_req, res) => {
    const series = await prisma.fiscalSeries.findMany({
      include: { branch: true },
      orderBy: { createdAt: 'desc' }
    });
    res.json(series);
  }
);

router.post(
  '/series',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]),
  async (req, res) => {
    try {
      const data = fiscalSeriesSchema.parse(req.body);
      const nextNumber = data.nextNumber ?? data.startNumber;
      if (nextNumber < data.startNumber || nextNumber > data.endNumber) {
        throw new Error('El siguiente número debe estar dentro del rango autorizado');
      }
      const series = await prisma.fiscalSeries.create({
        data: {
          branchId: data.branchId,
          documentType: data.documentType,
          cai: data.cai,
          prefix: data.prefix,
          startNumber: data.startNumber,
          endNumber: data.endNumber,
          nextNumber,
          expiresAt: new Date(data.expiresAt),
          isActive: data.isActive ?? true
        },
        include: { branch: true }
      });
      res.status(201).json(series);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.patch(
  '/series/:id',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT]),
  async (req, res) => {
    try {
      const data = seriesUpdateSchema.parse(req.body);
      const existing = await prisma.fiscalSeries.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ message: 'Serie fiscal no encontrada' });
      }
      const start = data.startNumber ?? existing.startNumber;
      const end = data.endNumber ?? existing.endNumber;
      if (start > end) {
        throw new Error('El número inicial debe ser menor o igual al final');
      }
      if (
        data.nextNumber !== undefined &&
        (data.nextNumber < start || data.nextNumber > end)
      ) {
        throw new Error('El siguiente número debe permanecer dentro del rango autorizado');
      }
      const series = await prisma.fiscalSeries.update({
        where: { id: req.params.id },
        data: {
          ...data,
          expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined
        },
        include: { branch: true }
      });
      res.json(series);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get(
  '/invoices',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    const { branchId, customerId } = req.query;
    const invoices = await prisma.invoice.findMany({
      where: {
        branchId: branchId ? String(branchId) : undefined,
        customerId: customerId ? String(customerId) : undefined
      },
      include: {
        lines: true,
        customer: { include: { user: true } },
        branch: true,
        fiscalSeries: true,
        creditNotes: true
      },
      orderBy: { issueDate: 'desc' }
    });
    res.json(invoices);
  }
);

router.post(
  '/invoices',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.CASHIER, Role.ACCOUNTANT]),
  async (req, res) => {
    try {
      const data = invoiceSchema.parse(req.body);
      const invoice = await prisma.$transaction(async (tx) => {
        const allocation = await allocateDocumentNumber(
          tx,
          data.branchId,
          FiscalDocumentType.INVOICE,
          data.seriesId
        );
        const totals = calculateTotals(data.lines);
        return tx.invoice.create({
          data: {
            number: allocation.number,
            type: data.type,
            branchId: data.branchId,
            customerId: data.customerId,
            workOrderId: data.workOrderId,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            cai: allocation.series.cai,
            fiscalSeriesId: allocation.series.id,
            lines: {
              create: data.lines.map((line) => ({
                ...line,
                total:
                  line.quantity * line.unitPrice +
                  line.quantity * line.unitPrice * (line.taxRate / 100)
              }))
            }
          },
          include: {
            lines: true,
            fiscalSeries: true
          }
        });
      });

      res.status(201).json(invoice);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get(
  '/invoices/:id',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.BRANCH_MANAGER, Role.CUSTOMER]),
  async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        lines: true,
        customer: { include: { user: true } },
        branch: true,
        fiscalSeries: true,
        creditNotes: { include: { lines: true, fiscalSeries: true } }
      }
    });
    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    res.json(invoice);
  }
);

router.get(
  '/invoices/:id/pdf',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.CUSTOMER]),
  async (req, res) => {
    const invoice = await prisma.invoice.findUnique({
      where: { id: req.params.id },
      include: {
        lines: true,
        customer: { include: { user: true } },
        branch: true,
        fiscalSeries: true
      }
    });
    if (!invoice) {
      return res.status(404).json({ message: 'Factura no encontrada' });
    }
    res.setHeader('Content-Type', 'application/pdf');
    const doc = new PDFDocument({ margin: 40 });
    doc.pipe(res);
    doc.text(env.sar.companyName, { align: 'center', fontSize: 18 });
    doc.moveDown();
    doc.text(`RTN: ${env.sar.rtn}`);
    doc.text(`CAI: ${invoice.cai}`);
    doc.text(`Serie: ${invoice.fiscalSeries.prefix}`);
    doc.text(
      `Vigencia: ${invoice.fiscalSeries.expiresAt.toISOString().split('T')[0]} / Rango ${invoice.fiscalSeries.startNumber} - ${invoice.fiscalSeries.endNumber}`
    );
    doc.text(`Factura: ${invoice.number}`);
    doc.text(
      `Cliente: ${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`
    );
    doc.text(`Fecha: ${invoice.issueDate.toISOString().split('T')[0]}`);
    doc.moveDown();
    doc.text('Detalle:');
    invoice.lines.forEach((line) => {
      doc.text(
        `${line.description} - Cant: ${line.quantity} - Precio: L.${line.unitPrice.toFixed(2)} - Total: L.${line.total.toFixed(2)}`
      );
    });
    doc.moveDown();
    doc.text(`Subtotal: L.${invoice.subtotal.toFixed(2)}`);
    doc.text(`Impuesto: L.${invoice.tax.toFixed(2)}`);
    doc.text(`Total: L.${invoice.total.toFixed(2)}`);
    doc.end();
  }
);

router.get(
  '/credit-notes',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER]),
  async (req, res) => {
    const { invoiceId } = req.query;
    const creditNotes = await prisma.creditNote.findMany({
      where: {
        invoiceId: invoiceId ? String(invoiceId) : undefined
      },
      include: {
        invoice: true,
        lines: true,
        fiscalSeries: true,
        createdBy: true
      },
      orderBy: { issuedAt: 'desc' }
    });
    res.json(creditNotes);
  }
);

router.post(
  '/credit-notes',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER]),
  async (req, res) => {
    try {
      const data = creditNoteSchema.parse(req.body);
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }
      const creditNote = await prisma.$transaction(async (tx) => {
        const invoice = await tx.invoice.findUnique({
          where: { id: data.invoiceId }
        });
        if (!invoice) {
          throw new Error('Factura asociada no encontrada');
        }

        const allocation = await allocateDocumentNumber(
          tx,
          invoice.branchId,
          FiscalDocumentType.CREDIT_NOTE,
          data.seriesId
        );
        const totals = calculateTotals(data.lines);

        const created = await tx.creditNote.create({
          data: {
            number: allocation.number,
            invoiceId: invoice.id,
            fiscalSeriesId: allocation.series.id,
            cai: allocation.series.cai,
            reason: data.reason,
            subtotal: totals.subtotal,
            tax: totals.tax,
            total: totals.total,
            createdById: authReq.user.id,
            lines: {
              create: data.lines.map((line) => ({
                ...line,
                total:
                  line.quantity * line.unitPrice +
                  line.quantity * line.unitPrice * (line.taxRate / 100)
              }))
            }
          },
          include: {
            lines: true,
            fiscalSeries: true
          }
        });

        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: 'CREDITED' }
        });

        for (const line of data.lines) {
          if (!line.productId) {
            continue;
          }
          await tx.inventoryStock.upsert({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: invoice.branchId
              }
            },
            update: { quantity: { increment: line.quantity } },
            create: {
              productId: line.productId,
              branchId: invoice.branchId,
              quantity: line.quantity
            }
          });
          await tx.inventoryMovement.create({
            data: {
              productId: line.productId,
              branchId: invoice.branchId,
              quantity: line.quantity,
              type: InventoryMovementType.RETURN,
              reference: created.number,
              notes: data.reason,
              userId: authReq.user.id
            }
          });
        }

        return created;
      });

      res.status(201).json(creditNote);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

export default router;
