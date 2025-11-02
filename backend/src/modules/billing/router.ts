import { Router } from 'express';
import { InvoiceType, Role } from '@prisma/client';
import { z } from 'zod';
import PDFDocument from 'pdfkit';

import env from '../../config/env';
import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';

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
  lines: z.array(invoiceLineSchema)
});

const getNextInvoiceNumber = async () => {
  const lastInvoice = await prisma.invoice.findFirst({
    orderBy: { issueDate: 'desc' }
  });
  const { rangeStart, rangeEnd } = env.sar;
  const prefix = rangeStart.substring(0, rangeStart.lastIndexOf('-') + 1);
  const startNumber = Number(rangeStart.split('-').pop());
  const endNumber = Number(rangeEnd.split('-').pop());
  let next = startNumber;
  if (lastInvoice) {
    const lastNumber = Number(lastInvoice.number.split('-').pop());
    next = lastNumber + 1;
  }
  if (next > endNumber) {
    throw new Error('Rango de facturación agotado');
  }
  return `${prefix}${String(next).padStart(rangeStart.split('-').pop()?.length ?? 8, '0')}`;
};

router.get('/invoices', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.BRANCH_MANAGER]), async (req, res) => {
  const { branchId, customerId } = req.query;
  const invoices = await prisma.invoice.findMany({
    where: {
      branchId: branchId ? String(branchId) : undefined,
      customerId: customerId ? String(customerId) : undefined
    },
    include: { lines: true, customer: { include: { user: true } }, branch: true },
    orderBy: { issueDate: 'desc' }
  });
  res.json(invoices);
});

router.post('/invoices', authenticate, authorize([Role.SUPER_ADMIN, Role.CASHIER, Role.ACCOUNTANT]), async (req, res) => {
  try {
    const data = invoiceSchema.parse(req.body);
    const number = await getNextInvoiceNumber();
    const totals = data.lines.reduce(
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

    const invoice = await prisma.invoice.create({
      data: {
        number,
        type: data.type,
        branchId: data.branchId,
        customerId: data.customerId,
        workOrderId: data.workOrderId,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        cai: env.sar.cai,
        lines: {
          create: data.lines.map((line) => ({
            ...line,
            total: line.quantity * line.unitPrice + line.quantity * line.unitPrice * (line.taxRate / 100)
          }))
        }
      }
    });

    res.status(201).json(invoice);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/invoices/:id', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.BRANCH_MANAGER, Role.CUSTOMER]), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: {
      lines: true,
      customer: { include: { user: true } },
      branch: true
    }
  });
  if (!invoice) {
    return res.status(404).json({ message: 'Factura no encontrada' });
  }
  res.json(invoice);
});

router.get('/invoices/:id/pdf', authenticate, authorize([Role.SUPER_ADMIN, Role.ACCOUNTANT, Role.CASHIER, Role.CUSTOMER]), async (req, res) => {
  const invoice = await prisma.invoice.findUnique({
    where: { id: req.params.id },
    include: { lines: true, customer: { include: { user: true } }, branch: true }
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
  doc.text(`Factura: ${invoice.number}`);
  doc.text(`Cliente: ${invoice.customer.user.firstName} ${invoice.customer.user.lastName}`);
  doc.text(`Fecha: ${invoice.issueDate.toISOString().split('T')[0]}`);
  doc.moveDown();
  doc.text('Detalle:');
  invoice.lines.forEach((line) => {
    doc.text(`${line.description} - Cant: ${line.quantity} - Precio: L.${line.unitPrice.toFixed(2)} - Total: L.${line.total.toFixed(2)}`);
  });
  doc.moveDown();
  doc.text(`Subtotal: L.${invoice.subtotal.toFixed(2)}`);
  doc.text(`Impuesto: L.${invoice.tax.toFixed(2)}`);
  doc.text(`Total: L.${invoice.total.toFixed(2)}`);
  doc.end();
});

export default router;
