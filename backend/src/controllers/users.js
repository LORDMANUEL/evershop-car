import { Router } from '../lib/router.js';
import { authenticate, authorize, createUser, updateUser } from '../lib/auth.js';
import { readDatabase } from '../lib/db.js';
import { sendError, sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/users' });

router.get('/', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const db = await readDatabase();
  const users = db.users
    .filter((u) => (user.role === 'BRANCH_MANAGER' ? u.branchId === user.branchId || u.role === 'SUPER_ADMIN' : true))
    .map(({ passwordHash, passwordSalt, ...rest }) => rest);
  sendJson(res, 200, users);
});

router.post('/', async (req, res) => {
  const requester = await authenticate(req, res);
  if (!requester) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const body = req.body || {};
  try {
    if (!body.email || !body.password || !body.role || !body.firstName || !body.lastName) {
      throw new Error('Campos requeridos: email, password, role, firstName, lastName');
    }
    if (requester.role === 'BRANCH_MANAGER' && body.role === 'SUPER_ADMIN') {
      throw new Error('No autorizado a crear super administradores');
    }
    if (requester.role === 'BRANCH_MANAGER' && body.branchId && body.branchId !== requester.branchId) {
      throw new Error('Solo puede crear usuarios en su sucursal');
    }
    const user = await createUser({
      email: body.email,
      password: body.password,
      role: requester.role === 'BRANCH_MANAGER' ? 'TECHNICIAN' : body.role,
      firstName: body.firstName,
      lastName: body.lastName,
      branchId: body.branchId || requester.branchId,
      phone: body.phone
    });
    const { passwordHash, passwordSalt, ...rest } = user;
    sendJson(res, 201, rest);
  } catch (error) {
    sendError(res, 400, error.message);
  }
});

router.patch('/:id', async (req, res) => {
  const requester = await authenticate(req, res);
  if (!requester) return;
  const canProceed = await authorize(['SUPER_ADMIN', 'BRANCH_MANAGER'])(req, res);
  if (!canProceed) return;
  const { id } = req.params;
  const data = req.body || {};
  if (requester.role === 'BRANCH_MANAGER' && data.role === 'SUPER_ADMIN') {
    sendError(res, 403, 'No autorizado a modificar rol a SUPER_ADMIN');
    return;
  }
  try {
    const updated = await updateUser(id, data);
    const { passwordHash, passwordSalt, ...rest } = updated;
    sendJson(res, 200, rest);
  } catch (error) {
    sendError(res, 404, error.message);
  }
});

export default router;
