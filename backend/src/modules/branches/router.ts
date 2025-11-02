import { Router } from 'express';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize } from '../../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

const branchSchema = z.object({
  name: z.string(),
  code: z.string(),
  address: z.string(),
  phone: z.string().optional()
});

router.get('/', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER, Role.ACCOUNTANT]), async (_req, res) => {
  const branches = await prisma.branch.findMany({ orderBy: { name: 'asc' } });
  res.json(branches);
});

router.post('/', authenticate, authorize([Role.SUPER_ADMIN]), async (req, res) => {
  try {
    const data = branchSchema.parse(req.body);
    const branch = await prisma.branch.create({ data });
    res.status(201).json(branch);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
