import { Router } from 'express';
import { InventoryMovementType, Role } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

const productSchema = z.object({
  sku: z.string(),
  name: z.string(),
  description: z.string().optional(),
  brand: z.string().optional(),
  compatibleWith: z.array(z.string()).default([]),
  cost: z.number().positive(),
  price: z.number().positive(),
  minStock: z.number().int().nonnegative(),
  supplierId: z.string().optional(),
  branchId: z.string().optional(),
  initialStock: z.number().int().nonnegative().optional()
});

const movementSchema = z.object({
  productId: z.string(),
  branchId: z.string(),
  quantity: z.number().int(),
  type: z.nativeEnum(InventoryMovementType),
  reference: z.string().optional(),
  notes: z.string().optional()
});

router.get('/products', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER, Role.TECHNICIAN]), async (_req, res) => {
  const products = await prisma.inventoryProduct.findMany({
    include: { stocks: true, supplier: true }
  });
  const mapped = products.map((p) => ({
    ...p,
    totalStock: p.stocks.reduce((acc, stock) => acc + stock.quantity, 0)
  }));
  res.json(mapped);
});

router.post('/products', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), async (req, res) => {
  try {
    const data = productSchema.parse(req.body);
    const { branchId, initialStock, ...productData } = data;
    const product = await prisma.inventoryProduct.create({
      data: {
        ...productData,
        stocks: branchId
          ? {
              create: {
                branchId,
                quantity: initialStock ?? 0
              }
            }
          : undefined
      }
    });
    res.status(201).json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/products/:id', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), async (req, res) => {
  const schema = productSchema.partial();
  try {
    const data = schema.parse(req.body);
    const { branchId, initialStock, ...productData } = data;
    const product = await prisma.inventoryProduct.update({
      where: { id: req.params.id },
      data: productData
    });
    if (branchId && typeof initialStock === 'number') {
      await prisma.inventoryStock.upsert({
        where: { productId_branchId: { productId: product.id, branchId } },
        update: { quantity: initialStock },
        create: { branchId, productId: product.id, quantity: initialStock }
      });
    }
    res.json(product);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/low-stock', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]), async (_req, res) => {
  const products = await prisma.inventoryProduct.findMany({ include: { stocks: true } });
  const lowStock = products
    .map((product) => ({
      product,
      totalStock: product.stocks.reduce((sum, stock) => sum + stock.quantity, 0)
    }))
    .filter(({ product, totalStock }) => totalStock <= product.minStock);
  res.json(lowStock);
});

router.get('/movements', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]), async (req, res) => {
  const { productId, branchId } = req.query;
  const movements = await prisma.inventoryMovement.findMany({
    where: {
      productId: productId ? String(productId) : undefined,
      branchId: branchId ? String(branchId) : undefined
    },
    include: { product: true, branch: true, user: true },
    orderBy: { createdAt: 'desc' }
  });
  res.json(movements);
});

router.post('/movements', authenticate, authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER]), async (req, res) => {
  try {
    const data = movementSchema.parse(req.body);
    const authReq = req as AuthRequest;
    const movement = await prisma.$transaction(async (tx) => {
      const existingStock = await tx.inventoryStock.findUnique({
        where: { productId_branchId: { productId: data.productId, branchId: data.branchId } }
      });

      if (existingStock) {
        const newQuantity = existingStock.quantity + data.quantity;
        if (newQuantity < 0) {
          throw new Error('El stock no puede quedar negativo');
        }
        await tx.inventoryStock.update({
          where: { id: existingStock.id },
          data: { quantity: newQuantity }
        });
      } else {
        if (data.quantity < 0) {
          throw new Error('No hay inventario disponible para este movimiento');
        }
        await tx.inventoryStock.create({
          data: { productId: data.productId, branchId: data.branchId, quantity: data.quantity }
        });
      }

      const movementCreated = await tx.inventoryMovement.create({
        data: {
          ...data,
          userId: authReq.user?.id
        }
      });

      return movementCreated;
    });

    res.status(201).json(movement);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
