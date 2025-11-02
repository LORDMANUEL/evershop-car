import { Router } from 'express';
import { Role, WorkOrderStatus } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

router.get('/vehicles', authenticate, authorize([Role.CUSTOMER, Role.SUPER_ADMIN]), async (req, res) => {
  const authReq = req as AuthRequest;
  const vehicles = await prisma.vehicle.findMany({
    where: authReq.user?.role === Role.CUSTOMER ? { customer: { userId: authReq.user.id } } : {},
    include: {
      customer: { include: { user: true } },
      workOrders: {
        include: { parts: { include: { product: true } }, labours: { include: { service: true } } },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  res.json(vehicles);
});

router.get('/vehicles/:vin/history', authenticate, authorize([Role.CUSTOMER, Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  const authReq = req as AuthRequest;
  const vehicle = await prisma.vehicle.findUnique({
    where: { vin: req.params.vin },
    include: {
      workOrders: {
        include: {
          parts: { include: { product: true } },
          labours: { include: { service: true } },
          invoices: true
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
  if (!vehicle) {
    return res.status(404).json({ message: 'Vehículo no encontrado' });
  }
  if (authReq.user?.role === Role.CUSTOMER) {
    const isOwner = await prisma.customerProfile.findFirst({
      where: { userId: authReq.user.id, vehicles: { some: { id: vehicle.id } } }
    });
    if (!isOwner) {
      return res.status(403).json({ message: 'No autorizado' });
    }
  }
  res.json(vehicle);
});

router.get('/vehicles/:vin/compatible-parts', authenticate, authorize([Role.CUSTOMER, Role.SUPER_ADMIN, Role.TECHNICIAN]), async (req, res) => {
  const vehicle = await prisma.vehicle.findUnique({ where: { vin: req.params.vin } });
  if (!vehicle) {
    return res.status(404).json({ message: 'Vehículo no encontrado' });
  }
  const label = `${vehicle.make} ${vehicle.model} ${vehicle.year ?? ''}`.trim();
  const parts = await prisma.inventoryProduct.findMany({
    where: { compatibleWith: { has: label } },
    include: { stocks: true }
  });
  res.json({ vehicle, parts });
});

router.post('/work-orders/:id/approval', authenticate, authorize([Role.CUSTOMER]), async (req, res) => {
  const schema = z.object({ approved: z.boolean(), notes: z.string().optional() });
  const authReq = req as AuthRequest;
  try {
    const data = schema.parse(req.body);
    const workOrder = await prisma.workOrder.findUnique({
      where: { id: req.params.id },
      include: { customer: true }
    });
    if (!workOrder) {
      return res.status(404).json({ message: 'Orden no encontrada' });
    }
    if (workOrder.customer.userId !== authReq.user?.id) {
      return res.status(403).json({ message: 'No autorizado' });
    }
    const approval = await prisma.workOrderApproval.create({
      data: {
        workOrderId: workOrder.id,
        approved: data.approved,
        notes: data.notes,
        approvedBy: authReq.user?.id
      }
    });

    await prisma.workOrder.update({
      where: { id: workOrder.id },
      data: {
        status: data.approved ? WorkOrderStatus.APPROVED : WorkOrderStatus.DIAGNOSIS,
        approvedAt: data.approved ? new Date() : null
      }
    });

    res.json(approval);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/notifications', authenticate, authorize([Role.CUSTOMER]), async (req, res) => {
  const authReq = req as AuthRequest;
  const notifications = await prisma.notification.findMany({
    where: { userId: authReq.user?.id },
    orderBy: { createdAt: 'desc' }
  });
  res.json(notifications);
});

export default router;
