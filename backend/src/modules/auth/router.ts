import { Router } from 'express';
import { z } from 'zod';

import { authenticate } from '../../middlewares/auth';
import prisma from '../../config/prisma';
import { login, refreshSession, revokeRefreshToken } from './service';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6)
});

router.post('/login', async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const { accessToken, refreshToken, user } = await login(data.email, data.password);
    res.json({ accessToken, refreshToken, user: { id: user.id, role: user.role, email: user.email } });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/refresh', async (req, res) => {
  const schema = z.object({ refreshToken: z.string() });
  try {
    const { refreshToken } = schema.parse(req.body);
    const result = await refreshSession(refreshToken);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/logout', async (req, res) => {
  const schema = z.object({ refreshToken: z.string() });
  try {
    const { refreshToken } = schema.parse(req.body);
    await revokeRefreshToken(refreshToken);
    res.json({ message: 'Sesión cerrada' });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
});

router.get('/me', authenticate, async (req, res) => {
  if (!req.user) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    include: { customer: { include: { vehicles: true } }, branch: true }
  });
  res.json(user);
});

export default router;
