import { Router } from 'express';
import { Role, WorkOrderStatus } from '@prisma/client';

import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

router.get('/dashboard', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT]), async (_req, res) => {
  const [salesToday, salesMonth, workOrders, topProducts] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { issueDate: { gte: startOfDay(new Date()) } }
    }),
    prisma.invoice.aggregate({
      _sum: { total: true },
      where: { issueDate: { gte: startOfMonth(new Date()) } }
    }),
    prisma.workOrder.groupBy({
      by: ['status'],
      _count: { status: true }
    }),
    prisma.workOrderPart.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    })
  ]);

  const topProductsData = await prisma.inventoryProduct.findMany({
    where: { id: { in: topProducts.map((p) => p.productId) } }
  });

  res.json({
    salesToday: salesToday._sum.total ?? 0,
    salesMonth: salesMonth._sum.total ?? 0,
    workOrders,
    topProducts: topProducts.map((tp) => ({
      product: topProductsData.find((p) => p.id === tp.productId),
      quantity: tp._sum.quantity
    }))
  });
});

router.get('/technicians/performance', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (_req, res) => {
  const technicians = await prisma.user.findMany({ where: { role: Role.TECHNICIAN } });
  const data = await Promise.all(
    technicians.map(async (tech) => {
      const orders = await prisma.workOrder.findMany({
        where: { assignedToId: tech.id, status: WorkOrderStatus.COMPLETED }
      });
      return {
        technician: tech,
        completedOrders: orders.length,
        averageTimeHours:
          orders.length === 0
            ? 0
            : orders.reduce((acc, order) => {
                if (!order.approvedAt || !order.completedAt) {
                  return acc;
                }
                const diff = (order.completedAt.getTime() - order.approvedAt.getTime()) / 1000 / 60 / 60;
                return acc + diff;
              }, 0) / orders.length
      };
    })
  );
  res.json(data);
});

router.get('/inventory/turnover', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.INVENTORY_MANAGER]), async (_req, res) => {
  const products = await prisma.inventoryProduct.findMany({ include: { stocks: true, movements: true } });
  const turnover = products.map((product) => {
    const totalSales = product.movements
      .filter((m) => m.type === 'SALE' || m.type === 'SERVICE_USAGE')
      .reduce((acc, movement) => acc + Math.abs(movement.quantity), 0);
    const averageInventory = product.stocks.reduce((acc, stock) => acc + stock.quantity, 0) / (product.stocks.length || 1);
    return {
      product,
      turnover: averageInventory === 0 ? 0 : totalSales / averageInventory
    };
  });
  res.json(turnover);
});

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);

export default router;
