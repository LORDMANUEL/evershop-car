import { Router } from '../lib/router.js';
import { login, authenticate } from '../lib/auth.js';
import { sendError, sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/auth' });

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      sendError(res, 400, 'Credenciales requeridas');
      return;
    }
    const { token, user } = await login(email, password);
    sendJson(res, 200, {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        firstName: user.firstName,
        lastName: user.lastName,
        branchId: user.branchId
      }
    });
  } catch (error) {
    sendError(res, 401, error.message);
  }
});

router.get('/me', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  sendJson(res, 200, {
    id: user.id,
    email: user.email,
    role: user.role,
    firstName: user.firstName,
    lastName: user.lastName,
    branchId: user.branchId
  });
});

export default router;
