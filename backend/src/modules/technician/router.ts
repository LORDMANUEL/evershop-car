import { Router } from 'express';
import { Role, WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

const workOrderSchema = z.object({
  customerId: z.string(),
  vehicleId: z.string(),
  branchId: z.string(),
  description: z.string().optional(),
  mileage: z.number().optional(),
  fuelLevel: z.number().optional(),
  assignedToId: z.string().optional()
});

router.get('/work-orders', authenticate, authorize([Role.SUPER_ADMIN, Role.TECHNICIAN, Role.BRANCH_MANAGER]), async (req, res) => {
  const authReq = req as AuthRequest;
  const { status } = req.query;
  const workOrders = await prisma.workOrder.findMany({
    where: {
      branchId: authReq.user?.branchId ?? undefined,
      status: status ? (status as WorkOrderStatus) : undefined,
      assignedToId: authReq.user?.role === Role.TECHNICIAN ? authReq.user.id : undefined
    },
    include: {
      customer: { include: { user: true } },
      vehicle: true,
      parts: { include: { product: true } },
      labours: { include: { service: true } }
    },
    orderBy: { createdAt: 'desc' }
  });
  res.json(workOrders);
});

router.post('/work-orders', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TECHNICIAN]), async (req, res) => {
  try {
    const data = workOrderSchema.parse(req.body);
    const authReq = req as AuthRequest;
    const code = await generateWorkOrderCode();
    const order = await prisma.workOrder.create({
      data: {
        code,
        customerId: data.customerId,
        vehicleId: data.vehicleId,
        branchId: data.branchId,
        description: data.description,
        mileage: data.mileage,
        fuelLevel: data.fuelLevel,
        createdById: authReq.user?.id ?? data.assignedToId!,
        assignedToId: data.assignedToId
      }
    });
    res.status(201).json(order);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/work-orders/:id/status', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.TECHNICIAN]), async (req, res) => {
  const schema = z.object({ status: z.nativeEnum(WorkOrderStatus) });
  try {
    const data = schema.parse(req.body);
    const order = await prisma.workOrder.update({
      where: { id: req.params.id },
      data: {
        status: data.status,
        completedAt: data.status === WorkOrderStatus.COMPLETED ? new Date() : undefined
      }
    });
    res.json(order);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/work-orders/:id/parts', authenticate, authorize([Role.SUPER_ADMIN, Role.TECHNICIAN, Role.BRANCH_MANAGER]), async (req, res) => {
  const schema = z.object({ productId: z.string(), quantity: z.number().int().positive(), price: z.number().positive() });
  try {
    const data = schema.parse(req.body);
    const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!workOrder) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.inventoryStock.findUnique({
        where: { productId_branchId: { productId: data.productId, branchId: workOrder.branchId } }
      });
      if (!stock || stock.quantity < data.quantity) {
        throw new Error('Stock insuficiente para la pieza solicitada');
      }
      const part = await tx.workOrderPart.create({
        data: {
          workOrderId: workOrder.id,
          productId: data.productId,
          quantity: data.quantity,
          price: data.price
        }
      });
      await tx.inventoryMovement.create({
        data: {
          productId: data.productId,
          branchId: workOrder.branchId,
          quantity: -data.quantity,
          type: 'SERVICE_USAGE',
          reference: workOrder.code
        }
      });
      await tx.inventoryStock.update({
        where: { productId_branchId: { productId: data.productId, branchId: workOrder.branchId } },
        data: { quantity: { decrement: data.quantity } }
      });
      return part;
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/work-orders/:id/labours', authenticate, authorize([Role.SUPER_ADMIN, Role.TECHNICIAN, Role.BRANCH_MANAGER]), async (req, res) => {
  const schema = z.object({ serviceId: z.string(), hours: z.number().positive(), rate: z.number().positive() });
  try {
    const data = schema.parse(req.body);
    const workOrder = await prisma.workOrder.findUnique({ where: { id: req.params.id } });
    if (!workOrder) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    const labour = await prisma.workOrderLabour.create({
      data: {
        workOrderId: workOrder.id,
        serviceId: data.serviceId,
        hours: data.hours,
        rate: data.rate
      }
    });
    res.status(201).json(labour);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

const generateWorkOrderCode = async () => {
  const last = await prisma.workOrder.findFirst({ orderBy: { createdAt: 'desc' } });
  if (!last) {
    return 'OS-0001';
  }
  const lastNumber = Number(last.code.split('-')[1]);
  return `OS-${String(lastNumber + 1).padStart(4, '0')}`;
};

export default router;
