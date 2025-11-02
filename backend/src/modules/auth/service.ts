import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

import env from '../../config/env';
import prisma from '../../config/prisma';

const accessTokenTtl = '1h';
const refreshTokenTtl = '7d';

export const login = async (email: string, password: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
    include: { customer: true }
  });
  if (!user || !user.isActive) {
    throw new Error('Credenciales inválidas');
  }

  const match = await bcrypt.compare(password, user.password);
  if (!match) {
    throw new Error('Credenciales inválidas');
  }

  const accessToken = jwt.sign({ role: user.role }, env.jwtSecret, {
    subject: user.id,
    expiresIn: accessTokenTtl
  });

  const refreshToken = jwt.sign({}, env.jwtRefreshSecret, {
    subject: user.id,
    expiresIn: refreshTokenTtl
  });

  await prisma.refreshToken.create({
    data: {
      token: refreshToken,
      userId: user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    }
  });

  const { password: _password, ...safeUser } = user;
  return { accessToken, refreshToken, user: safeUser };
};

export const refreshSession = async (token: string) => {
  try {
    const payload = jwt.verify(token, env.jwtRefreshSecret) as { sub: string };
    const stored = await prisma.refreshToken.findUnique({ where: { token } });
    if (!stored || stored.expiresAt < new Date()) {
      throw new Error('Token expirado');
    }
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    const accessToken = jwt.sign({ role: user.role }, env.jwtSecret, {
      subject: user.id,
      expiresIn: accessTokenTtl
    });
    return { accessToken };
  } catch (error) {
    throw new Error('Token inválido');
  }
};

export const revokeRefreshToken = async (token: string) => {
  await prisma.refreshToken.deleteMany({ where: { token } });
};
