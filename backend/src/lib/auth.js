import { readDatabase, withDatabase } from './db.js';
import { signToken, verifyToken, hashPassword, verifyPassword } from './security.js';
import { sendError } from './http.js';

const TOKEN_SECRET = 'taller-secret-key';
const TOKEN_EXP_MINUTES = 60;

export async function login(email, password) {
  const db = await readDatabase();
  const user = db.users.find((u) => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    throw new Error('Credenciales inválidas');
  }
  const valid = verifyPassword(password, user.passwordSalt, user.passwordHash);
  if (!valid) {
    throw new Error('Credenciales inválidas');
  }
  const token = signToken({ sub: user.id, role: user.role, branchId: user.branchId }, TOKEN_SECRET, TOKEN_EXP_MINUTES);
  await withDatabase(async (mutable) => {
    mutable.sessions = mutable.sessions.filter((session) => session.userId !== user.id);
    mutable.sessions.push({
      id: `session-${Date.now()}`,
      userId: user.id,
      token,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + TOKEN_EXP_MINUTES * 60000).toISOString()
    });
  });
  return { token, user };
}

export async function authenticate(req, res) {
  const auth = req.headers['authorization'];
  if (!auth || !auth.startsWith('Bearer ')) {
    sendError(res, 401, 'Token requerido');
    return null;
  }
  const token = auth.slice(7);
  const payload = verifyToken(token, TOKEN_SECRET);
  if (!payload) {
    sendError(res, 401, 'Token inválido');
    return null;
  }
  const db = await readDatabase();
  const user = db.users.find((u) => u.id === payload.sub);
  if (!user) {
    sendError(res, 401, 'Usuario no encontrado');
    return null;
  }
  req.user = user;
  return user;
}

export function authorize(roles = []) {
  return async (req, res) => {
    const user = req.user;
    if (!user) {
      sendError(res, 401, 'No autenticado');
      return false;
    }
    if (roles.length && !roles.includes(user.role)) {
      sendError(res, 403, 'Sin permiso');
      return false;
    }
    return true;
  };
}

export async function createUser(payload) {
  return withDatabase(async (db) => {
    if (db.users.some((u) => u.email.toLowerCase() === payload.email.toLowerCase())) {
      throw new Error('El correo ya está registrado');
    }
    const { salt, hash } = hashPassword(payload.password);
    const user = {
      id: `user-${Date.now()}`,
      email: payload.email,
      role: payload.role,
      passwordSalt: salt,
      passwordHash: hash,
      firstName: payload.firstName,
      lastName: payload.lastName,
      phone: payload.phone || null,
      branchId: payload.branchId || null,
      createdAt: new Date().toISOString()
    };
    db.users.push(user);
    return user;
  });
}

export async function updateUser(id, data) {
  return withDatabase(async (db) => {
    const user = db.users.find((u) => u.id === id);
    if (!user) {
      throw new Error('Usuario no encontrado');
    }
    if (data.password) {
      const { salt, hash } = hashPassword(data.password);
      user.passwordSalt = salt;
      user.passwordHash = hash;
    }
    ['firstName', 'lastName', 'phone', 'role', 'branchId', 'email'].forEach((field) => {
      if (data[field] !== undefined) {
        user[field] = data[field];
      }
    });
    return user;
  });
}
