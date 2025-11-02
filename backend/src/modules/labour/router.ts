import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';

const router = Router();

const serviceSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string().optional(),
  hours: z.number().positive(),
  hourlyRate: z.number().positive()
});

router.get('/services', authenticate, authorize([Role.SUPER_ADMIN, Role.TECHNICIAN, Role.BRANCH_MANAGER]), async (_req, res) => {
  const services = await prisma.labourService.findMany({ orderBy: { name: 'asc' } });
  res.json(services);
});

router.post('/services', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  try {
    const data = serviceSchema.parse(req.body);
    const service = await prisma.labourService.create({ data });
    res.status(201).json(service);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/services/:id', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  try {
    const data = serviceSchema.partial().parse(req.body);
    const service = await prisma.labourService.update({ where: { id: req.params.id }, data });
    res.json(service);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
