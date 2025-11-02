import { Router } from 'express';
import {
  InventoryAuditStatus,
  InventoryMovementType,
  Prisma,
  Role,
  TransferStatus
} from '@prisma/client';
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

const transferSchema = z
  .object({
    fromBranchId: z.string(),
    toBranchId: z.string(),
    notes: z.string().optional(),
    lines: z
      .array(
        z.object({
          productId: z.string(),
          quantity: z.number().int().positive()
        })
      )
      .min(1)
  })
  .refine((data) => data.fromBranchId !== data.toBranchId, {
    message: 'La sucursal de origen y destino deben ser diferentes',
    path: ['toBranchId']
  });

const auditSessionSchema = z.object({
  branchId: z.string(),
  scheduledAt: z.string().datetime().optional(),
  notes: z.string().optional()
});

const auditRecordSchema = z.object({
  records: z
    .array(
      z.object({
        productId: z.string(),
        countedQuantity: z.number().int().nonnegative()
      })
    )
    .min(1)
});

const appendAuditLog = async (
  userId: string | undefined,
  action: string,
  payload: Record<string, unknown>
) => {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? null,
        module: 'INVENTORY',
        action,
        payload
      }
    });
  } catch (error) {
    console.error('Audit log failure', error);
  }
};

const generateTransferCode = async (tx: Prisma.TransactionClient) => {
  const last = await tx.inventoryTransfer.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastNumber = last?.code?.match(/(\d+)$/);
  const next = lastNumber ? Number(lastNumber[1]) + 1 : 1;
  return `TRF-${String(next).padStart(5, '0')}`;
};

const generateAuditCode = async (tx: Prisma.TransactionClient) => {
  const last = await tx.inventoryAuditSession.findFirst({ orderBy: { createdAt: 'desc' } });
  const lastNumber = last?.code?.match(/(\d+)$/);
  const next = lastNumber ? Number(lastNumber[1]) + 1 : 1;
  return `AUD-${String(next).padStart(5, '0')}`;
};

const toDate = (value?: string) => (value ? new Date(value) : undefined);

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

    await appendAuditLog((req as AuthRequest).user?.id, 'MANUAL_MOVEMENT', {
      movementId: movement.id,
      productId: movement.productId,
      quantity: movement.quantity,
      branchId: movement.branchId,
      type: movement.type
    });

    res.status(201).json(movement);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get(
  '/transfers',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    const { branchId, status } = req.query;
    const transfers = await prisma.inventoryTransfer.findMany({
      where: {
        OR: branchId
          ? [
              { fromBranchId: String(branchId) },
              { toBranchId: String(branchId) }
            ]
          : undefined,
        status: status ? (status as TransferStatus) : undefined
      },
      include: {
        lines: { include: { product: true } },
        fromBranch: true,
        toBranch: true,
        requestedBy: true,
        approvedBy: true,
        receivedBy: true
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(transfers);
  }
);

router.post(
  '/transfers',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const data = transferSchema.parse(req.body);
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const transfer = await prisma.$transaction(async (tx) => {
        const code = await generateTransferCode(tx);

        const uniqueProducts = new Set(data.lines.map((line) => line.productId));
        if (uniqueProducts.size !== data.lines.length) {
          throw new Error('Cada producto solo puede aparecer una vez en la transferencia');
        }

        for (const line of data.lines) {
          const stock = await tx.inventoryStock.findUnique({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: data.fromBranchId
              }
            }
          });
          if (!stock || stock.quantity < line.quantity) {
            throw new Error(
              `Stock insuficiente para el producto ${line.productId} en la sucursal de origen`
            );
          }
        }

        return tx.inventoryTransfer.create({
          data: {
            code,
            fromBranchId: data.fromBranchId,
            toBranchId: data.toBranchId,
            notes: data.notes,
            requestedById: authReq.user.id,
            lines: {
              create: data.lines.map((line) => ({
                productId: line.productId,
                quantity: line.quantity
              }))
            }
          },
          include: {
            lines: { include: { product: true } },
            fromBranch: true,
            toBranch: true,
            requestedBy: true
          }
        });
      });

      await appendAuditLog(authReq.user.id, 'TRANSFER_REQUESTED', {
        transferId: transfer.id,
        fromBranchId: transfer.fromBranchId,
        toBranchId: transfer.toBranchId
      });

      res.status(201).json(transfer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  '/transfers/:id/approve',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const existing = await prisma.inventoryTransfer.findUnique({ where: { id: req.params.id } });
      if (!existing) {
        return res.status(404).json({ message: 'Transferencia no encontrada' });
      }
      if (existing.status !== TransferStatus.REQUESTED) {
        return res.status(400).json({ message: 'La transferencia no está pendiente de aprobación' });
      }
      if (
        authReq.user.role !== Role.SUPER_ADMIN &&
        authReq.user.branchId !== existing.fromBranchId
      ) {
        return res.status(403).json({ message: 'Solo la sucursal de origen puede aprobar' });
      }

      const transfer = await prisma.inventoryTransfer.update({
        where: { id: existing.id },
        data: {
          status: TransferStatus.APPROVED,
          approvedById: authReq.user.id,
          approvedAt: new Date()
        },
        include: {
          lines: { include: { product: true } },
          fromBranch: true,
          toBranch: true,
          requestedBy: true,
          approvedBy: true
        }
      });

      await appendAuditLog(authReq.user.id, 'TRANSFER_APPROVED', {
        transferId: transfer.id
      });

      res.json(transfer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  '/transfers/:id/receive',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const transfer = await prisma.$transaction(async (tx) => {
        const existing = await tx.inventoryTransfer.findUnique({
          where: { id: req.params.id },
          include: { lines: true }
        });

        if (!existing) {
          throw new Error('Transferencia no encontrada');
        }
        if (existing.status !== TransferStatus.APPROVED) {
          throw new Error('La transferencia debe estar aprobada antes de recibirse');
        }
        if (
          authReq.user.role !== Role.SUPER_ADMIN &&
          authReq.user.branchId !== existing.toBranchId
        ) {
          throw new Error('Solo la sucursal de destino puede recibir la transferencia');
        }

        for (const line of existing.lines) {
          const originStock = await tx.inventoryStock.findUnique({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: existing.fromBranchId
              }
            }
          });

          if (!originStock || originStock.quantity < line.quantity) {
            throw new Error(
              `Stock insuficiente en la sucursal de origen para completar la transferencia`
            );
          }

          await tx.inventoryStock.update({
            where: { id: originStock.id },
            data: { quantity: { decrement: line.quantity } }
          });

          await tx.inventoryMovement.create({
            data: {
              productId: line.productId,
              branchId: existing.fromBranchId,
              quantity: -line.quantity,
              type: InventoryMovementType.TRANSFER_OUT,
              reference: existing.code,
              notes: 'Transferencia inter-sucursal',
              userId: authReq.user.id
            }
          });

          await tx.inventoryStock.upsert({
            where: {
              productId_branchId: {
                productId: line.productId,
                branchId: existing.toBranchId
              }
            },
            update: { quantity: { increment: line.quantity } },
            create: {
              productId: line.productId,
              branchId: existing.toBranchId,
              quantity: line.quantity
            }
          });

          await tx.inventoryMovement.create({
            data: {
              productId: line.productId,
              branchId: existing.toBranchId,
              quantity: line.quantity,
              type: InventoryMovementType.TRANSFER_IN,
              reference: existing.code,
              notes: 'Transferencia inter-sucursal',
              userId: authReq.user.id
            }
          });
        }

        return tx.inventoryTransfer.update({
          where: { id: existing.id },
          data: {
            status: TransferStatus.RECEIVED,
            receivedById: authReq.user.id,
            receivedAt: new Date()
          },
          include: {
            lines: { include: { product: true } },
            fromBranch: true,
            toBranch: true,
            requestedBy: true,
            approvedBy: true,
            receivedBy: true
          }
        });
      });

      await appendAuditLog(authReq.user.id, 'TRANSFER_RECEIVED', {
        transferId: transfer.id
      });

      res.json(transfer);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.get(
  '/audits',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    const { branchId, status } = req.query;
    const audits = await prisma.inventoryAuditSession.findMany({
      where: {
        branchId: branchId ? String(branchId) : undefined,
        status: status ? (status as InventoryAuditStatus) : undefined
      },
      include: {
        branch: true,
        createdBy: true,
        approvedBy: true,
        records: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(audits);
  }
);

router.post(
  '/audits',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const data = auditSessionSchema.parse(req.body);
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const audit = await prisma.$transaction(async (tx) => {
        const code = await generateAuditCode(tx);
        return tx.inventoryAuditSession.create({
          data: {
            code,
            branchId: data.branchId,
            scheduledAt: toDate(data.scheduledAt),
            notes: data.notes,
            createdById: authReq.user.id
          },
          include: { branch: true, createdBy: true }
        });
      });

      await appendAuditLog(authReq.user.id, 'AUDIT_CREATED', {
        auditId: audit.id,
        branchId: audit.branchId
      });

      res.status(201).json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  '/audits/:id/start',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const session = await prisma.inventoryAuditSession.findUnique({
        where: { id: req.params.id }
      });

      if (!session) {
        return res.status(404).json({ message: 'Auditoría no encontrada' });
      }
      if (session.status !== InventoryAuditStatus.DRAFT) {
        return res.status(400).json({ message: 'La auditoría ya fue iniciada o cerrada' });
      }
      if (
        authReq.user.role !== Role.SUPER_ADMIN &&
        authReq.user.branchId !== session.branchId
      ) {
        return res.status(403).json({ message: 'Solo la sucursal asignada puede iniciar la auditoría' });
      }

      const audit = await prisma.inventoryAuditSession.update({
        where: { id: session.id },
        data: { status: InventoryAuditStatus.IN_PROGRESS, startedAt: new Date() },
        include: { branch: true, createdBy: true, records: true }
      });

      await appendAuditLog(authReq.user.id, 'AUDIT_STARTED', { auditId: audit.id });

      res.json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  '/audits/:id/records',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const data = auditRecordSchema.parse(req.body);
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const audit = await prisma.$transaction(async (tx) => {
        const session = await tx.inventoryAuditSession.findUnique({
          where: { id: req.params.id }
        });

        if (!session) {
          throw new Error('Auditoría no encontrada');
        }
        if (session.status !== InventoryAuditStatus.IN_PROGRESS) {
          throw new Error('La auditoría no está en curso');
        }
        if (
          authReq.user.role !== Role.SUPER_ADMIN &&
          authReq.user.branchId !== session.branchId
        ) {
          throw new Error('Solo la sucursal asignada puede registrar conteos');
        }

        for (const record of data.records) {
          const stock = await tx.inventoryStock.findUnique({
            where: {
              productId_branchId: {
                productId: record.productId,
                branchId: session.branchId
              }
            }
          });
          const systemQuantity = stock?.quantity ?? 0;
          const difference = record.countedQuantity - systemQuantity;

          await tx.inventoryAuditRecord.upsert({
            where: {
              sessionId_productId: {
                sessionId: session.id,
                productId: record.productId
              }
            },
            create: {
              sessionId: session.id,
              productId: record.productId,
              systemQuantity,
              countedQuantity: record.countedQuantity,
              difference,
              createdById: authReq.user.id
            },
            update: {
              systemQuantity,
              countedQuantity: record.countedQuantity,
              difference,
              createdById: authReq.user.id,
              createdAt: new Date()
            }
          });
        }

        return tx.inventoryAuditSession.findUnique({
          where: { id: session.id },
          include: { branch: true, records: { include: { product: true } } }
        });
      });

      await appendAuditLog(authReq.user.id, 'AUDIT_COUNT_RECORDED', {
        auditId: audit?.id,
        records: data.records.length
      });

      res.json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

router.post(
  '/audits/:id/complete',
  authenticate,
  authorize([Role.SUPER_ADMIN, Role.INVENTORY_MANAGER, Role.BRANCH_MANAGER]),
  async (req, res) => {
    try {
      const authReq = req as AuthRequest;
      if (!authReq.user?.id) {
        throw new Error('Usuario no identificado');
      }

      const audit = await prisma.$transaction(async (tx) => {
        const session = await tx.inventoryAuditSession.findUnique({
          where: { id: req.params.id },
          include: { records: true }
        });

        if (!session) {
          throw new Error('Auditoría no encontrada');
        }
        if (session.status !== InventoryAuditStatus.IN_PROGRESS) {
          throw new Error('La auditoría debe estar en curso para cerrarse');
        }
        if (
          authReq.user.role !== Role.SUPER_ADMIN &&
          authReq.user.branchId !== session.branchId
        ) {
          throw new Error('Solo la sucursal asignada puede cerrar la auditoría');
        }

        for (const record of session.records) {
          if (record.difference === 0) {
            continue;
          }

          const stock = await tx.inventoryStock.findUnique({
            where: {
              productId_branchId: {
                productId: record.productId,
                branchId: session.branchId
              }
            }
          });

          const baseQuantity = stock?.quantity ?? 0;
          const newQuantity = baseQuantity + record.difference;

          if (newQuantity < 0) {
            throw new Error('El ajuste dejaría el inventario en negativo');
          }

          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: { quantity: newQuantity }
            });
          } else {
            await tx.inventoryStock.create({
              data: {
                productId: record.productId,
                branchId: session.branchId,
                quantity: newQuantity
              }
            });
          }

          await tx.inventoryMovement.create({
            data: {
              productId: record.productId,
              branchId: session.branchId,
              quantity: record.difference,
              type: InventoryMovementType.ADJUSTMENT,
              reference: session.code,
              notes: 'Ajuste por auditoría de inventario',
              userId: authReq.user.id
            }
          });
        }

        return tx.inventoryAuditSession.update({
          where: { id: session.id },
          data: {
            status: InventoryAuditStatus.COMPLETED,
            completedAt: new Date(),
            approvedById: authReq.user.id
          },
          include: {
            branch: true,
            approvedBy: true,
            records: { include: { product: true } }
          }
        });
      });

      await appendAuditLog(authReq.user.id, 'AUDIT_COMPLETED', {
        auditId: audit?.id
      });

      res.json(audit);
    } catch (error: any) {
      res.status(400).json({ message: error.message });
    }
  }
);

export default router;
