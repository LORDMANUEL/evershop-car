import { Router } from '../lib/router.js';
import { authenticate } from '../lib/auth.js';
import { readDatabase } from '../lib/db.js';
import { sendJson } from '../lib/http.js';

const router = new Router({ basePath: '/api/v1/branches' });

router.get('/', async (req, res) => {
  const user = await authenticate(req, res);
  if (!user) return;
  const db = await readDatabase();
  sendJson(res, 200, db.branches);
});

export default router;
