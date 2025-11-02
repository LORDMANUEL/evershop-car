import { Router } from 'express';
import { Role } from '@prisma/client';
import { z } from 'zod';

import prisma from '../../config/prisma';
import { authenticate, authorize, AuthRequest } from '../../middlewares/auth';

const router = Router();

const userSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  firstName: z.string(),
  lastName: z.string(),
  role: z.nativeEnum(Role),
  phone: z.string().optional(),
  branchId: z.string().nullable().optional()
});

router.get('/', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  const authReq = req as AuthRequest;
  const branchFilter =
    authReq.user?.role === Role.BRANCH_MANAGER && authReq.user.branchId ? { branchId: authReq.user.branchId } : {};
  const users = await prisma.user.findMany({
    where: branchFilter,
    include: { branch: true }
  });
  res.json(users);
});

router.post('/', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  try {
    const data = userSchema.parse(req.body);
    const user = await prisma.user.create({ data });
    res.status(201).json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.patch('/:id', authenticate, authorize([Role.SUPER_ADMIN, Role.BRANCH_MANAGER]), async (req, res) => {
  const schema = userSchema.partial();
  try {
    const data = schema.parse(req.body);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    res.json(user);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:id/reset-password', authenticate, authorize([Role.SUPER_ADMIN]), async (req, res) => {
  const schema = z.object({ password: z.string().min(6) });
  try {
    const { password } = schema.parse(req.body);
    const hashed = await import('bcrypt').then(({ default: bcrypt }) => bcrypt.hash(password, 10));
    await prisma.user.update({ where: { id: req.params.id }, data: { password: hashed } });
    res.json({ message: 'Contraseña actualizada' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
