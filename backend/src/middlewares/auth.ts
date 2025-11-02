import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

import env from '../config/env';
import prisma from '../config/prisma';

export interface AuthRequest extends Request {
  user?: { id: string; role: string; branchId?: string | null };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: 'Token requerido' });
  }

  const [, token] = authHeader.split(' ');
  if (!token) {
    return res.status(401).json({ message: 'Token inválido' });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub: string; role: string };
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Usuario no autorizado' });
    }
    req.user = { id: user.id, role: user.role, branchId: user.branchId };
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Token inválido' });
  }
};

export const authorize = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: 'No tiene permisos para esta acción' });
    }
    next();
  };
};
